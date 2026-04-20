import { vi } from 'vitest';

// next/headers cookies() is async in Next.js 15+
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll:  () => [],
      set:     vi.fn(),
      delete:  vi.fn(),
    })
  ),
}));
