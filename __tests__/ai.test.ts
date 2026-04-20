import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist the mock function so it's available inside the factory
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

// Import after mocking so the module-level `client` uses the mock
import { tagEntry, FALLBACK_PROMPTS } from '../src/lib/ai';

describe('tagEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns safe defaults when AI returns invalid JSON', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'not valid json at all' }] });

    const result = await tagEntry('A letter to my child.', 8);

    expect(result.domain).toBe('identity');
    expect(result.deliveryType).toBe('evergreen');
    expect(result.relevantAge).toBe(18);
    expect(result.summary).toBe('');
  });

  it('whitelists domain — rejects invalid value to identity', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'cooking',           // not a valid domain
          relevantAge: 16,
          deliveryType: 'evergreen',
          summary: 'A letter.',
        }),
      }],
    });

    const result = await tagEntry('About cooking.', 8);
    expect(result.domain).toBe('identity');
  });

  it('passes through a valid domain', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'finances',
          relevantAge: 22,
          deliveryType: 'age-locked',
          summary: 'Lesson about money.',
        }),
      }],
    });

    const result = await tagEntry('About saving money.', 8);
    expect(result.domain).toBe('finances');
    expect(result.deliveryType).toBe('age-locked');
  });

  it('whitelists deliveryType — rejects invalid value to evergreen', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({
          domain: 'resilience',
          relevantAge: 18,
          deliveryType: 'birthday',   // not valid
          summary: 'Lesson about resilience.',
        }),
      }],
    });

    const result = await tagEntry('About hard times.', 10);
    expect(result.deliveryType).toBe('evergreen');
  });

  it('clamps relevantAge below 0 to 0', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'health', relevantAge: -5, deliveryType: 'evergreen', summary: 'Health.' }),
      }],
    });

    const result = await tagEntry('About health.', 5);
    expect(result.relevantAge).toBe(0);
  });

  it('clamps relevantAge above 100 to 100', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'health', relevantAge: 200, deliveryType: 'evergreen', summary: 'Health.' }),
      }],
    });

    const result = await tagEntry('About health.', 5);
    expect(result.relevantAge).toBe(100);
  });

  it('truncates summary longer than 200 chars', async () => {
    const longSummary = 'A'.repeat(300);
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'identity', relevantAge: 18, deliveryType: 'evergreen', summary: longSummary }),
      }],
    });

    const result = await tagEntry('Some content.', 8);
    expect(result.summary.length).toBe(200);
  });

  it('uses 18 as relevantAge fallback when AI returns non-numeric', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        text: JSON.stringify({ domain: 'career', relevantAge: 'adulthood', deliveryType: 'milestone', summary: 'Career.' }),
      }],
    });

    const result = await tagEntry('About work.', 10);
    expect(result.relevantAge).toBe(18);
  });
});

describe('FALLBACK_PROMPTS', () => {
  it('contains at least 10 prompts', () => {
    expect(FALLBACK_PROMPTS.length).toBeGreaterThanOrEqual(10);
  });

  it('all prompts are non-empty strings', () => {
    for (const p of FALLBACK_PROMPTS) {
      expect(typeof p).toBe('string');
      expect(p.trim().length).toBeGreaterThan(0);
    }
  });
});
