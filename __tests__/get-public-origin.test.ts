import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getPublicOrigin, safeNextPath } from '../src/lib/get-public-origin';

describe('safeNextPath', () => {
  it('allows relative paths and blocks protocol-relative', () => {
    expect(safeNextPath('/archive')).toBe('/archive');
    expect(safeNextPath('//evil.com')).toBe('/capture');
    expect(safeNextPath(null)).toBe('/capture');
  });
});

describe('getPublicOrigin', () => {
  it('uses NEXT_PUBLIC_SITE_URL when set', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/';
    try {
      const req = new NextRequest('http://internal-host/auth/callback');
      expect(getPublicOrigin(req)).toBe('https://example.com');
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it('falls back to x-forwarded headers', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      const req = new NextRequest('http://127.0.0.1:3000/callback', {
        headers: { 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https' },
      });
      expect(getPublicOrigin(req)).toBe('https://app.example.com');
    } finally {
      if (prev !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});
