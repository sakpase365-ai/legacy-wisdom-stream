import { getServiceClient } from '@/lib/supabase';
import { resolveFamilyAccess } from '@/lib/family-access';
import { FOUNDATION_QUESTIONS, BREADCRUMB_TYPE_LABEL, VALUE_TAGS } from '@/lib/breadcrumbs';
import { logger } from '@/lib/logger';
import { differenceInYears, parseISO } from 'date-fns';
import { firstName } from '@/lib/nameUtils';

const CONTENT_EXCERPT_LENGTH = 600;
const MAX_BREADCRUMBS        = 10;
const MAX_FOUNDATION_ANSWERS = 6;

// Minimal stop-word list for keyword extraction
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'was', 'are', 'were', 'be', 'been', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'can', 'what', 'how', 'when', 'where', 'who', 'why',
  'about', 'that', 'this', 'it', 'my', 'our', 'your', 'his', 'her',
  'their', 'said', 'say', 'told', 'tell', 'dad', 'mom', 'from', 'into',
  'out', 'up', 'any', 'all', 'just', 'one', 'get', 'would', 'not',
]);

// Categories that are always included in Foundation context regardless of relevance score
const ALWAYS_INCLUDE_CATEGORIES = new Set([
  'core_values', 'life_lesson', 'faith_purpose', 'legacy_message',
]);

// ── Public types ──────────────────────────────────────────────────

export interface FamilyAgentContextInput {
  userId:      string;        // Supabase auth UID (session.user.id)
  question:    string;
  recipientId?: string | null;
}

export interface FoundationEntry {
  category: string;
  content:  string;
}

export interface RecipientContext {
  id:    string;
  name:  string;
  role:  string;
  age?:  number;
}

export interface RelevantBreadcrumb {
  id:              string;
  title:           string | null;
  breadcrumb_type: string;
  tags:            string[];
  content:         string;
  recipientLabel:  string;
  created_at:      string;
}

export interface ContextSource {
  source: 'breadcrumbs' | 'family_foundations' | 'family_members';
  id:     string;
}

export interface FamilyAgentContext {
  ownerName:            string;
  ownerRole:            string | null;
  ownerCustomRoleLabel: string | null;
  familyName:           string | null;
  profileNotFound:      boolean;
  familyProfileContext: FoundationEntry[];
  recipientContext:     RecipientContext | null;
  relevantBreadcrumbs:  RelevantBreadcrumb[];
  familyValues:         string[];
  contextSources:       ContextSource[];
  warnings:             string[];
}

// ── Private DB row types ──────────────────────────────────────────

interface BreadcrumbRow {
  id:               string;
  title:            string | null;
  content:          string;
  breadcrumb_type:  string;
  tags:             string[] | null;
  family_member_id: string | null;
  created_at:       string;
}

interface FamilyMemberRow {
  id:         string;
  name:       string;
  role:       string;
  birth_date: string | null;
}

interface FoundationRow {
  category: string;
  content:  string;
}

// ── Helpers ───────────────────────────────────────────────────────

export function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function scoreBreadcrumb(
  row: BreadcrumbRow,
  keywords: string[],
  recipientId: string | null | undefined,
): number {
  let score = 0;

  // P1 — direct recipient match
  if (recipientId && row.family_member_id === recipientId) score += 10;

  // P2 — family-wide (everyone: family_member_id is null)
  else if (row.family_member_id === null) score += 5;

  // P4 — keyword matching in title and content (+1 per hit)
  const searchText = `${row.title ?? ''} ${row.content}`.toLowerCase();
  for (const kw of keywords) {
    if (searchText.includes(kw)) score += 1;
  }

  // Tags scored separately at higher weight (+2) to reflect their curated nature
  for (const tag of row.tags ?? []) {
    if (keywords.includes(tag.toLowerCase())) score += 2;
  }

  // Breadcrumb type keyword match
  if (keywords.includes(row.breadcrumb_type)) score += 1;

  return score;
}

export function scoreFoundationAnswer(row: FoundationRow, keywords: string[]): number {
  let score = 0;

  // High-priority categories always rank highly
  if (ALWAYS_INCLUDE_CATEGORIES.has(row.category)) score += 3;

  const text = (row.category + ' ' + row.content).toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw)) score += 1;
  }

  return score;
}

function buildRecipientLabel(
  familyMemberId: string | null,
  membersById: Map<string, FamilyMemberRow>,
): string {
  if (familyMemberId === null) return 'For the whole family';
  const m = membersById.get(familyMemberId);
  return m ? `For ${firstName(m.name)}` : 'For a family member';
}

function excerptContent(content: string): string {
  if (content.length <= CONTENT_EXCERPT_LENGTH) return content;
  return content.slice(0, CONTENT_EXCERPT_LENGTH).trimEnd() + '…';
}

function deriveFamilyValues(
  foundations: FoundationRow[],
  breadcrumbs: BreadcrumbRow[],
): string[] {
  const values = new Set<string>();

  // Collect all value tags used across breadcrumbs
  for (const bc of breadcrumbs) {
    for (const tag of bc.tags ?? []) {
      values.add(tag);
    }
  }

  // Also check if any VALUE_TAGS appear verbatim in the core_values Foundation answer
  const coreValues = foundations.find((f) => f.category === 'core_values');
  if (coreValues) {
    const text = coreValues.content;
    for (const tag of VALUE_TAGS) {
      if (text.toLowerCase().includes(tag.toLowerCase())) {
        values.add(tag);
      }
    }
  }

  return Array.from(values).sort();
}

// ── Public API ────────────────────────────────────────────────────

export async function buildFamilyAgentContext(
  input: FamilyAgentContextInput,
): Promise<FamilyAgentContext> {
  const { userId, question, recipientId } = input;
  const db = getServiceClient();
  const warnings: string[]       = [];
  const contextSources: ContextSource[] = [];

  // ── 1. Resolve family environment (owner row + family id for data scope) ──
  const access = await resolveFamilyAccess(db, userId);

  if (!access) {
    logger.warn('family agent: user profile not found', { userId });
    return {
      ownerName:            '',
      ownerRole:            null,
      ownerCustomRoleLabel: null,
      familyName:           null,
      profileNotFound:      true,
      familyProfileContext: [],
      recipientContext:     null,
      relevantBreadcrumbs:  [],
      familyValues:         [],
      contextSources:       [],
      warnings:             ['User profile not found.'],
    };
  }

  const profile   = access.familyProfile;
  const profileId = access.familyId;

  // ── 2. Parallel DB fetches ───────────────────────────────────────
  const [foundationsResult, breadcrumbsResult, membersResult] = await Promise.all([
    db
      .from('family_foundations')
      .select('category, content')
      .eq('user_id', profileId),
    db
      .from('breadcrumbs')
      .select('id, title, content, breadcrumb_type, tags, family_member_id, created_at')
      .eq('parent_id', profileId)
      .order('created_at', { ascending: false }),
    db
      .from('family_members')
      .select('id, name, role, birth_date')
      .eq('user_id', profileId)
      .order('created_at', { ascending: true }),
  ]);

  const foundations    = (foundationsResult.data  ?? []) as FoundationRow[];
  const allBreadcrumbs = (breadcrumbsResult.data  ?? []) as BreadcrumbRow[];
  const allMembers     = (membersResult.data       ?? []) as FamilyMemberRow[];
  const membersById    = new Map(allMembers.map((m) => [m.id, m]));

  // ── 3. Recipient context ─────────────────────────────────────────
  // Verify recipientId belongs to this user's family before trusting it.
  // membersById is already scoped to this user, so an unknown UUID returns undefined.
  const ownedRecipientId = recipientId && membersById.has(recipientId) ? recipientId : null;

  let recipientContext: RecipientContext | null = null;
  if (ownedRecipientId) {
    const member = membersById.get(ownedRecipientId)!;
    contextSources.push({ source: 'family_members', id: member.id });
    recipientContext = {
      id:   member.id,
      name: member.name,
      role: member.role,
      age:  member.birth_date
        ? differenceInYears(new Date(), parseISO(member.birth_date))
        : undefined,
    };
  }

  // ── 4. Score and select breadcrumbs ─────────────────────────────
  const keywords = extractKeywords(question);

  const scored = allBreadcrumbs
    .map((row) => ({ row, score: scoreBreadcrumb(row, keywords, ownedRecipientId) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  // Fallback to most recent if nothing scored above 0
  const topRows =
    scored.length > 0
      ? scored.slice(0, MAX_BREADCRUMBS).map(({ row }) => row)
      : allBreadcrumbs.slice(0, MAX_BREADCRUMBS);

  const relevantBreadcrumbs: RelevantBreadcrumb[] = topRows.map((row) => {
    contextSources.push({ source: 'breadcrumbs', id: row.id });
    return {
      id:              row.id,
      title:           row.title,
      breadcrumb_type: row.breadcrumb_type,
      tags:            row.tags ?? [],
      content:         excerptContent(row.content),
      recipientLabel:  buildRecipientLabel(row.family_member_id, membersById),
      created_at:      row.created_at,
    };
  });

  // ── 5. Score and select Foundation answers ───────────────────────
  const scoredFoundations = foundations
    .map((row) => ({ row, score: scoreFoundationAnswer(row, keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FOUNDATION_ANSWERS);

  const familyProfileContext: FoundationEntry[] = scoredFoundations.map(({ row }) => {
    // category is the stable unique key per user — use it as the source ID
    contextSources.push({ source: 'family_foundations', id: row.category });
    return { category: row.category, content: row.content };
  });

  // ── 6. Derive family values ──────────────────────────────────────
  const familyValues = deriveFamilyValues(foundations, allBreadcrumbs);

  // ── 7. Warnings ──────────────────────────────────────────────────
  if (relevantBreadcrumbs.length === 0 && familyProfileContext.length === 0) {
    warnings.push(
      'No saved family context was found. The Family Agent will respond from general knowledge only. ' +
      'Answer Foundation questions or write a breadcrumb to give the agent grounded family content.'
    );
  } else if (relevantBreadcrumbs.length === 0) {
    warnings.push(
      'No breadcrumbs matched this question. The response draws from Family Foundation answers only.'
    );
  } else if (familyProfileContext.length === 0) {
    warnings.push(
      'No Family Foundation answers found. Answering Foundation questions will strengthen future responses.'
    );
  }

  return {
    ownerName:            profile.name,
    ownerRole:            profile.role ?? null,
    ownerCustomRoleLabel: profile.custom_role_label ?? null,
    familyName:           profile.family_name,
    profileNotFound:      false,
    familyProfileContext,
    recipientContext,
    relevantBreadcrumbs,
    familyValues,
    contextSources,
    warnings,
  };
}

// ── Context formatter for AI prompt injection ─────────────────────

export function formatContextBlock(context: FamilyAgentContext): string {
  const parts: string[] = [];

  // Speaker identity — tells the AI whose first-person voice to use
  const speakerLines: string[] = ['SPEAKER (write from this person\'s voice, in first person)'];
  speakerLines.push(`Name: ${context.ownerName}`);
  if (context.ownerRole && context.ownerRole !== 'other') {
    speakerLines.push(`Role: ${context.ownerRole}`);
  }
  if (context.familyName) {
    speakerLines.push(`Family: ${context.familyName}`);
  }
  parts.push(speakerLines.join('\n'));

  // Recipient identity — tells the AI who to address directly
  if (context.recipientContext) {
    const { name, role, age } = context.recipientContext;
    const ageStr = age != null ? `, age ${age}` : '';
    parts.push(`RECIPIENT (address directly in your response)\nName: ${name}\nRole: ${role}${ageStr}`);
  }

  if (context.familyProfileContext.length > 0) {
    parts.push('');
    parts.push('FAMILY FOUNDATION');
    for (const entry of context.familyProfileContext) {
      const q = FOUNDATION_QUESTIONS.find((fq) => fq.key === entry.category);
      const label = q?.question ?? entry.category;
      parts.push(`[${label}]\n${entry.content}`);
    }
  }

  if (context.relevantBreadcrumbs.length > 0) {
    parts.push('');
    parts.push('SAVED BREADCRUMBS');
    for (const bc of context.relevantBreadcrumbs) {
      const typeLabel = BREADCRUMB_TYPE_LABEL[bc.breadcrumb_type] ?? bc.breadcrumb_type;
      const tagStr    = bc.tags.length > 0 ? ` [${bc.tags.join(', ')}]` : '';
      const header    = `${bc.recipientLabel} | ${typeLabel}${tagStr} | ${bc.created_at.slice(0, 10)}`;
      const titleLine = bc.title ? `${bc.title}\n` : '';
      parts.push(`${header}\n${titleLine}${bc.content}`);
    }
  }

  if (context.familyValues.length > 0) {
    parts.push('');
    parts.push(`FAMILY VALUES (from saved content): ${context.familyValues.join(', ')}`);
  }

  return parts.join('\n\n');
}
