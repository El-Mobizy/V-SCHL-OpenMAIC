import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveClassroomModelString } from '@/lib/server/admin-default-model';

const originalFetch = global.fetch;

function mockSymfonyResponse(rows: unknown[]): void {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } }),
  ) as unknown as typeof fetch;
}

function mockSymfonyError(): void {
  global.fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
}

describe('resolveClassroomModelString', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
    delete process.env.DEFAULT_MODEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns the client override verbatim when provided', async () => {
    mockSymfonyResponse([{ provider: 'openai', is_default: true, models: [{ id: 'gpt-5.4' }] }]);
    const out = await resolveClassroomModelString({
      clientOverride: 'anthropic/claude-opus-4-7',
      accessToken: 'tok',
    });
    expect(out).toBe('anthropic/claude-opus-4-7');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the row flagged is_default when no override', async () => {
    mockSymfonyResponse([
      { provider: 'openai', is_default: false, models: [{ id: 'gpt-4o-mini' }] },
      { provider: 'anthropic', is_default: true, models: [{ id: 'claude-opus-4-7' }, { id: 'claude-sonnet-4-6' }] },
    ]);
    const out = await resolveClassroomModelString({ accessToken: 'tok' });
    expect(out).toBe('anthropic/claude-opus-4-7');
  });

  it('falls back to first configured provider models[0].id when no row is flagged', async () => {
    mockSymfonyResponse([
      { provider: 'openai', is_default: false, models: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] },
      { provider: 'anthropic', is_default: false, models: [{ id: 'claude-opus-4-7' }] },
    ]);
    const out = await resolveClassroomModelString({ accessToken: 'tok' });
    expect(out).toBe('openai/gpt-4o-mini');
  });

  it('falls back to DEFAULT_MODEL env when Symfony returns empty', async () => {
    mockSymfonyResponse([]);
    process.env.DEFAULT_MODEL = 'google/gemini-2.5-flash';
    const out = await resolveClassroomModelString({ accessToken: 'tok' });
    expect(out).toBe('google/gemini-2.5-flash');
  });

  it('falls back to DEFAULT_MODEL when Symfony errors', async () => {
    mockSymfonyError();
    process.env.DEFAULT_MODEL = 'google/gemini-2.5-flash';
    const out = await resolveClassroomModelString({ accessToken: 'tok' });
    expect(out).toBe('google/gemini-2.5-flash');
  });

  it('final fallback is openai/gpt-4o-mini', async () => {
    mockSymfonyError();
    const out = await resolveClassroomModelString({ accessToken: 'tok' });
    expect(out).toBe('openai/gpt-4o-mini');
  });
});
