import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch for Symfony calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mocking
const { tokenCounter } = await import('@/lib/server/token-counter');

describe('token-counter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenCounter.clearAll();
  });

  it('initializes quota from Symfony response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ max_tokens: 100000, used_tokens: 5000, reset_date: '2026-05-01' }),
    });

    await tokenCounter.initQuota(42, 'fake-token');
    const check = tokenCounter.checkQuota(42);
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(95000);
  });

  it('records usage and decrements remaining', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ max_tokens: 10000, used_tokens: 0, reset_date: '2026-05-01' }),
    });

    await tokenCounter.initQuota(42, 'fake-token');
    tokenCounter.recordUsage(42, 'openai', 'gpt-4o', 500, 200);

    const check = tokenCounter.checkQuota(42);
    expect(check.remaining).toBe(9300);
  });

  it('blocks when quota exceeded', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ max_tokens: 1000, used_tokens: 950, reset_date: '2026-05-01' }),
    });

    await tokenCounter.initQuota(42, 'fake-token');
    tokenCounter.recordUsage(42, 'openai', 'gpt-4o', 30, 25);

    const check = tokenCounter.checkQuota(42);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
  });
});
