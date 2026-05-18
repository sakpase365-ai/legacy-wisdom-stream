import { describe, it, expect } from 'vitest';
import { normalizePhone, maskPhone } from '../src/lib/phone';

describe('normalizePhone', () => {
  it('normalizes 10-digit US number', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });
  it('normalizes formatted number with parens and dashes', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
  });
  it('normalizes 11-digit with leading 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });
  it('normalizes +1 prefix already present', () => {
    expect(normalizePhone('+15551234567')).toBe('+15551234567');
  });
  it('returns null for too-short number', () => {
    expect(normalizePhone('12345')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks middle digits of US E.164 number', () => {
    expect(maskPhone('+15551234567')).toBe('+1 (555) ···-4567');
  });
  it('returns raw string for non-US-length number', () => {
    expect(maskPhone('+441234567890')).toBe('+441234567890');
  });
});
