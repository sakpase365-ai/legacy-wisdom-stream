/**
 * Simplified capture UX: three intents only. Stored as public.breadcrumb_type.
 * Legacy rows may still use letter, story, advice, prayer, family_value, etc.
 */
export const CAPTURE_INTENT_OPTIONS = [
  {
    value:       'message',
    label:       'Message',
    description:
      'A direct note, encouragement, blessing, prayer, or something you want them to hear from you.',
  },
  {
    value:       'memory',
    label:       'Memory',
    description:
      'A story, moment, experience, family history, or something you want remembered.',
  },
  {
    value:       'lesson',
    label:       'Lesson',
    description:
      'Wisdom, values, advice, principles, warnings, or something you want passed down.',
  },
] as const;

export type CaptureIntentValue = (typeof CAPTURE_INTENT_OPTIONS)[number]['value'];

const CAPTURE_VALUES = new Set<string>(CAPTURE_INTENT_OPTIONS.map((o) => o.value));

/** Archive badges + API validation: new intents, legacy app values, and schema enum extras */
export const BREADCRUMB_TYPE_LABEL: Record<string, string> = {
  message:      'Message',
  memory:       'Memory',
  lesson:       'Lesson',
  letter:       'Letter',
  story:        'Story',
  advice:       'Advice',
  prayer:       'Prayer / Blessing',
  family_value: 'Family Value',
  reflection:   'Reflection',
  guidance:     'Guidance',
  wisdom:       'Wisdom',
  answer:       'Answer',
  encouragement: 'Encouragement',
  journal:      'Journal',
};

/** Accept these on POST /api/save-entry (legacy + capture + enum) */
export const ALL_WRITABLE_BREADCRUMB_TYPES = new Set(Object.keys(BREADCRUMB_TYPE_LABEL));

/**
 * Backward compatibility: code/tests that expect { value, label }[].
 * Prefer CAPTURE_INTENT_OPTIONS for capture UI only.
 */
export const BREADCRUMB_TYPES = Object.entries(BREADCRUMB_TYPE_LABEL).map(([value, label]) => ({
  value,
  label,
}));

export type BreadcrumbTypeValue = string;

/** Map foundation/legacy prefill types to a capture intent when opening /capture */
export function normalizePrefillBreadcrumbType(raw: string): CaptureIntentValue {
  if (CAPTURE_VALUES.has(raw)) return raw as CaptureIntentValue;
  const legacyToIntent: Record<string, CaptureIntentValue> = {
    letter:       'message',
    prayer:       'message',
    answer:       'message',
    story:        'memory',
    memory:       'memory',
    reflection:   'memory',
    lesson:       'lesson',
    advice:       'lesson',
    family_value: 'lesson',
    wisdom:       'lesson',
    guidance:     'lesson',
    encouragement: 'message',
    journal:      'memory',
  };
  return legacyToIntent[raw] ?? 'message';
}

export const VALUE_TAGS = [
  'Faith', 'Courage', 'Honesty', 'Consistency', 'Optimism',
  'Discipline', 'Family', 'Love', 'Forgiveness', 'Purpose',
  'Work Ethic', 'Resilience',
] as const;

export type ValueTag = typeof VALUE_TAGS[number];

export const FOUNDATION_QUESTIONS = [
  { key: 'roots_upbringing',     question: 'Where did you grow up, and what shaped you most?' },
  { key: 'heritage_origins',     question: 'Where are your parents and grandparents from?' },
  { key: 'family_sacrifices',    question: 'What sacrifices or values were passed down through your family?' },
  { key: 'partner_meeting',      question: "How did you meet your child's mother/father?" },
  { key: 'partner_attraction',   question: 'What drew you to them?' },
  { key: 'relationship_lessons', question: 'What did that relationship teach you about love, family, faith, or commitment?' },
  { key: 'core_values',          question: 'What values are most important in your family?' },
  { key: 'life_lesson',          question: 'What is one thing your children should always remember about life?' },
  { key: 'handling_failure',     question: 'How should your children deal with failure or discouragement?' },
  { key: 'defining_moment',      question: 'What is one difficult moment that shaped who you became?' },
  { key: 'faith_purpose',        question: 'What role does faith, belief, or purpose play in your life?' },
  { key: 'legacy_message',       question: 'What message do you want passed down through your family for generations?' },
] as const;

export type FoundationKey = typeof FOUNDATION_QUESTIONS[number]['key'];

export const VALID_FOUNDATION_KEYS: Set<string> = new Set(
  FOUNDATION_QUESTIONS.map((q) => q.key)
);
