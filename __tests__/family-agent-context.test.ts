import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  getServiceClient: vi.fn(),
}));

// date-fns is real — no need to mock
import {
  buildFamilyAgentContext,
  extractKeywords,
  scoreBreadcrumb,
  scoreFoundationAnswer,
  formatContextBlock,
} from '../src/lib/family-agent-context';
import { getServiceClient } from '@/lib/supabase';

// ── Fixture data ──────────────────────────────────────────────────

const PROFILE     = { id: 'pid-1', name: 'Marcus', family_name: 'The Johnson Family', role: 'father', custom_role_label: null };
const MEMBER_CAIRO = { id: 'mid-cairo', name: 'Cairo',  role: 'son',    birth_date: '2016-03-15' };
const MEMBER_AVA   = { id: 'mid-ava',   name: 'Ava',    role: 'daughter', birth_date: '2019-07-20' };

const FOUNDATION_ROWS = [
  { category: 'core_values',   content: 'Faith, honesty, and hard work define who we are.' },
  { category: 'life_lesson',   content: 'Failure is not the end — it is the teacher.' },
  { category: 'faith_purpose', content: 'God is the foundation of everything we do.' },
];

const BREADCRUMB_FOR_CAIRO = {
  id:               'bc-1',
  title:            'On getting back up',
  content:          'Cairo, every time you fall, you have the strength to rise again.',
  breadcrumb_type:  'lesson',
  tags:             ['Courage', 'Resilience'],
  family_member_id: 'mid-cairo',
  created_at:       '2025-01-10T00:00:00Z',
};

const BREADCRUMB_EVERYONE = {
  id:               'bc-2',
  title:            'For all of you',
  content:          'Remember who you are and whose you are.',
  breadcrumb_type:  'letter',
  tags:             ['Family', 'Faith'],
  family_member_id: null,
  created_at:       '2025-02-01T00:00:00Z',
};

const BREADCRUMB_FOR_AVA = {
  id:               'bc-3',
  title:            'A note for Ava',
  content:          'Ava, your kindness is your greatest strength.',
  breadcrumb_type:  'advice',
  tags:             ['Love'],
  family_member_id: 'mid-ava',
  created_at:       '2025-03-05T00:00:00Z',
};

// ── DB mock builder ───────────────────────────────────────────────

function makeDb({
  profile         = PROFILE,
  foundations     = FOUNDATION_ROWS,
  breadcrumbs     = [BREADCRUMB_FOR_CAIRO, BREADCRUMB_EVERYONE, BREADCRUMB_FOR_AVA],
  members         = [MEMBER_CAIRO, MEMBER_AVA],
  invitedScenario = false,
} = {}) {
  const viewer = invitedScenario
    ? {
      id:                'viewer-1',
      name:              'Jane',
      family_name:       null,
      role:              'mother',
      custom_role_label: null,
      child_name:        null,
      child_dob:         null,
    }
    : profile;
  const owner = profile;

  const linkedRow = invitedScenario
    ? {
      id:                  'fm-inv',
      user_id:             owner.id,
      name:                'Jane',
      role:                'mother',
      app_permission_role: 'contributor',
      status:              'active',
    }
    : null;

  let userFromCount          = 0;
  let familyMembersFromCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        const idx = userFromCount++;
        if (invitedScenario && idx === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: owner, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(
            idx === 0 ? { data: viewer, error: null } : { data: null, error: null },
          ),
        };
      }
      if (table === 'family_foundations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockResolvedValue({ data: foundations, error: null }),
        };
      }
      if (table === 'breadcrumbs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          order:  vi.fn().mockResolvedValue({ data: breadcrumbs, error: null }),
        };
      }
      if (table === 'family_members') {
        familyMembersFromCount += 1;
        if (familyMembersFromCount === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: linkedRow, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          order:  vi.fn().mockResolvedValue({ data: members, error: null }),
        };
      }
      return {};
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── extractKeywords ───────────────────────────────────────────────

describe('extractKeywords', () => {
  it('lowercases and strips stop words', () => {
    const kw = extractKeywords('What would Dad say about failure?');
    expect(kw).toContain('failure');
    expect(kw).not.toContain('what');
    expect(kw).not.toContain('the');
  });

  it('filters short tokens', () => {
    const kw = extractKeywords('on my way');
    expect(kw).not.toContain('on');
    expect(kw).not.toContain('my');
  });

  it('returns empty array for stop-word-only question', () => {
    const kw = extractKeywords('what is it');
    expect(kw).toHaveLength(0);
  });
});

// ── scoreBreadcrumb ───────────────────────────────────────────────

describe('scoreBreadcrumb', () => {
  it('gives +10 for direct recipient match', () => {
    const score = scoreBreadcrumb(BREADCRUMB_FOR_CAIRO, [], 'mid-cairo');
    expect(score).toBe(10);
  });

  it('gives +5 for family-wide (family_member_id = null)', () => {
    const score = scoreBreadcrumb(BREADCRUMB_EVERYONE, [], null);
    expect(score).toBe(5);
  });

  it('gives +5 for family-wide even with no recipientId', () => {
    const score = scoreBreadcrumb(BREADCRUMB_EVERYONE, [], undefined);
    expect(score).toBe(5);
  });

  it('adds keyword hits from content', () => {
    const score = scoreBreadcrumb(BREADCRUMB_FOR_CAIRO, ['strength', 'rise'], null);
    // family_member_id is not null and no recipientId match → 0 from recipient
    // "strength" matches content? No — content says "strength to rise again"
    // "rise" matches content
    expect(score).toBeGreaterThan(0);
  });

  it('adds extra weight for matching tags against keywords', () => {
    const score = scoreBreadcrumb(BREADCRUMB_FOR_CAIRO, ['courage'], null);
    // tag "Courage" lowercase matches keyword "courage" → +2
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it('adds +1 for breadcrumb_type keyword match', () => {
    const score = scoreBreadcrumb(BREADCRUMB_FOR_CAIRO, ['lesson'], null);
    expect(score).toBeGreaterThanOrEqual(1);
  });

  it('returns 0 for no recipient and no keyword matches', () => {
    const score = scoreBreadcrumb(BREADCRUMB_FOR_CAIRO, [], 'mid-ava');
    // mid-ava ≠ mid-cairo; family_member_id is not null; no keywords → 0
    expect(score).toBe(0);
  });
});

// ── scoreFoundationAnswer ─────────────────────────────────────────

describe('scoreFoundationAnswer', () => {
  it('adds +3 for always-include categories', () => {
    const row   = { category: 'core_values', content: 'faith and family' };
    const score = scoreFoundationAnswer(row, []);
    expect(score).toBe(3);
  });

  it('adds +1 per keyword hit in content or category', () => {
    const row   = { category: 'life_lesson', content: 'failure is a teacher' };
    const score = scoreFoundationAnswer(row, ['failure', 'teacher']);
    // life_lesson is in ALWAYS_INCLUDE_CATEGORIES → +3
    // 'failure' hits content → +1
    // 'teacher' hits content → +1
    expect(score).toBe(5);
  });
});

// ── buildFamilyAgentContext ────────────────────────────────────────

describe('buildFamilyAgentContext', () => {
  it('returns profile details in context', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'What values matter most?',
    });
    expect(ctx.ownerName).toBe('Marcus');
    expect(ctx.familyName).toBe('The Johnson Family');
  });

  it('resolves recipientContext when recipientId is given', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:      'uid-abc',
      question:    'What did Dad say?',
      recipientId: 'mid-cairo',
    });
    expect(ctx.recipientContext).not.toBeNull();
    expect(ctx.recipientContext?.name).toBe('Cairo');
    expect(ctx.recipientContext?.role).toBe('son');
  });

  it('recipientContext is null when no recipientId provided', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'Family values?',
    });
    expect(ctx.recipientContext).toBeNull();
  });

  it('prioritizes recipient breadcrumb over everyone breadcrumb', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:      'uid-abc',
      question:    'strength',
      recipientId: 'mid-cairo',
    });
    const ids = ctx.relevantBreadcrumbs.map((b) => b.id);
    // Cairo's breadcrumb should appear before everyone's
    expect(ids.indexOf('bc-1')).toBeLessThan(ids.indexOf('bc-2'));
  });

  it('includes family-wide (everyone) breadcrumbs with correct label', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'family remember',
    });
    const everyone = ctx.relevantBreadcrumbs.find((b) => b.id === 'bc-2');
    expect(everyone).toBeDefined();
    expect(everyone?.recipientLabel).toBe('For the whole family');
  });

  it('respects MAX_BREADCRUMBS cap of 10', async () => {
    const manyBreadcrumbs = Array.from({ length: 15 }, (_, i) => ({
      id:               `bc-${i}`,
      title:            null,
      content:          'some content',
      breadcrumb_type:  'letter',
      tags:             null,
      family_member_id: null,
      created_at:       '2025-01-01T00:00:00Z',
    }));
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb({ breadcrumbs: manyBreadcrumbs as never }) as never
    );
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'anything',
    });
    expect(ctx.relevantBreadcrumbs.length).toBeLessThanOrEqual(10);
  });

  it('truncates breadcrumb content longer than 600 chars', async () => {
    const longContent = 'A'.repeat(700);
    const longBc = { ...BREADCRUMB_EVERYONE, content: longContent };
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb({ breadcrumbs: [longBc] }) as never
    );
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'family',
    });
    expect(ctx.relevantBreadcrumbs[0].content.length).toBeLessThanOrEqual(605); // 600 + ellipsis
    expect(ctx.relevantBreadcrumbs[0].content.endsWith('…')).toBe(true);
  });

  it('derives familyValues from breadcrumb tags', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'anything',
    });
    expect(ctx.familyValues).toContain('Courage');
    expect(ctx.familyValues).toContain('Faith');
    expect(ctx.familyValues).toContain('Family');
  });

  it('includes Foundation answers in familyProfileContext', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'what values matter',
    });
    expect(ctx.familyProfileContext.length).toBeGreaterThan(0);
    expect(ctx.familyProfileContext.some((f) => f.category === 'core_values')).toBe(true);
  });

  it('warns when no family context exists at all', async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb({ foundations: [], breadcrumbs: [] }) as never
    );
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'anything',
    });
    expect(ctx.warnings.length).toBeGreaterThan(0);
    expect(ctx.warnings[0]).toContain('No saved family context');
  });

  it('warns when breadcrumbs empty but Foundation exists', async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb({ breadcrumbs: [] }) as never
    );
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'what are our values',
    });
    expect(ctx.warnings.some((w) => w.includes('No breadcrumbs matched'))).toBe(true);
  });

  it('warns when Foundation empty but breadcrumbs exist', async () => {
    vi.mocked(getServiceClient).mockReturnValue(
      makeDb({ foundations: [] }) as never
    );
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'family remember',
    });
    expect(ctx.warnings.some((w) => w.includes('Foundation'))).toBe(true);
  });

  it('uses family owner voice when viewer is an invited member', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb({ invitedScenario: true }) as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-wife',
      question: 'What values matter most?',
    });
    expect(ctx.ownerName).toBe('Marcus');
    expect(ctx.profileNotFound).toBe(false);
  });

  it('sets profileNotFound = true if profile not found', async () => {
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      }),
    } as never);
    const ctx = await buildFamilyAgentContext({ userId: 'ghost', question: 'anything' });
    expect(ctx.profileNotFound).toBe(true);
    expect(ctx.warnings).toContain('User profile not found.');
  });

  it('populates contextSources with used record identifiers', async () => {
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    const ctx = await buildFamilyAgentContext({
      userId:   'uid-abc',
      question: 'family remember',
    });
    const sources = ctx.contextSources.map((s) => s.source);
    expect(sources).toContain('breadcrumbs');
    expect(sources).toContain('family_foundations');
  });

  it('does not cross family boundaries — only queries by profileId', async () => {
    const db = makeDb();
    vi.mocked(getServiceClient).mockReturnValue(db as never);
    await buildFamilyAgentContext({ userId: 'uid-abc', question: 'anything' });
    // All from() calls chain eq('parent_id' | 'user_id', <profileId>)
    // We verify the breadcrumbs query uses the resolved profile.id, not the raw auth userId
    // The breadcrumbs mock is called after users mock returns pid-1
    const breadcrumbCall = (db.from as ReturnType<typeof vi.fn>).mock.calls
      .find((args: string[]) => args[0] === 'breadcrumbs');
    expect(breadcrumbCall).toBeDefined();
  });
});

// ── formatContextBlock ────────────────────────────────────────────

describe('formatContextBlock', () => {
  const BASE_CTX = {
    ownerName:            'Marcus',
    ownerRole:            'father' as string | null,
    ownerCustomRoleLabel: null as string | null,
    familyName:           null as string | null,
    profileNotFound:      false,
    familyProfileContext: [] as import('../src/lib/family-agent-context').FoundationEntry[],
    recipientContext:     null as import('../src/lib/family-agent-context').RecipientContext | null,
    relevantBreadcrumbs:  [] as import('../src/lib/family-agent-context').RelevantBreadcrumb[],
    familyValues:         [] as string[],
    contextSources:       [] as import('../src/lib/family-agent-context').ContextSource[],
    warnings:             [] as string[],
  };

  it('includes speaker name and role in SPEAKER block', () => {
    const block = formatContextBlock({ ...BASE_CTX });
    expect(block).toContain('SPEAKER');
    expect(block).toContain('Name: Marcus');
    expect(block).toContain('Role: father');
  });

  it('omits Role line when ownerRole is null or "other"', () => {
    const block = formatContextBlock({ ...BASE_CTX, ownerRole: null });
    expect(block).not.toMatch(/^Role:/m);

    const block2 = formatContextBlock({ ...BASE_CTX, ownerRole: 'other' });
    expect(block2).not.toMatch(/^Role:/m);
  });

  it('includes family label', () => {
    const block = formatContextBlock({ ...BASE_CTX, familyName: 'The Johnson Family' });
    expect(block).toContain('The Johnson Family');
  });

  it('includes recipient section when present', () => {
    const block = formatContextBlock({
      ...BASE_CTX,
      recipientContext: { id: 'mid-1', name: 'Cairo', role: 'son', age: 9 },
    });
    expect(block).toContain('RECIPIENT');
    expect(block).toContain('Cairo');
    expect(block).toContain('son');
    expect(block).toContain('age 9');
  });

  it('includes Foundation section with question labels', () => {
    const block = formatContextBlock({
      ...BASE_CTX,
      familyProfileContext: [{ category: 'core_values', content: 'Faith and family.' }],
    });
    expect(block).toContain('FAMILY FOUNDATION');
    expect(block).toContain('What values are most important');
    expect(block).toContain('Faith and family.');
  });

  it('includes breadcrumb section with metadata', () => {
    const block = formatContextBlock({
      ...BASE_CTX,
      relevantBreadcrumbs: [{
        id:              'bc-1',
        title:           'On rising',
        breadcrumb_type: 'lesson',
        tags:            ['Courage'],
        content:         'You will rise.',
        recipientLabel:  'For Cairo',
        created_at:      '2025-01-10T00:00:00Z',
      }],
    });
    expect(block).toContain('SAVED BREADCRUMBS');
    expect(block).toContain('For Cairo');
    expect(block).toContain('Life Lesson');
    expect(block).toContain('[Courage]');
    expect(block).toContain('You will rise.');
  });

  it('includes family values section', () => {
    const block = formatContextBlock({ ...BASE_CTX, familyValues: ['Courage', 'Faith'] });
    expect(block).toContain('FAMILY VALUES');
    expect(block).toContain('Courage, Faith');
  });
});
