import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { refreshTokens, __resetInFlightForTest } from '@/lib/server/refresh';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SYMFONY_API_URL', 'http://symfony');
  __resetInFlightForTest();
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('refreshTokens', () => {
  it('maps Lexik "token" field to access_token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'new-access', refresh_token: 'new-refresh' }), {
        status: 200,
      }),
    );
    const tokens = await refreshTokens('old-refresh');
    expect(tokens.access_token).toBe('new-access');
    expect(tokens.refresh_token).toBe('new-refresh');
  });

  it('also accepts access_token field', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r' }), { status: 200 }),
    );
    const tokens = await refreshTokens('old');
    expect(tokens.access_token).toBe('a');
  });

  it('is single-flight: 10 concurrent callers share one fetch', async () => {
    let resolveIt!: (v: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((r) => {
        resolveIt = r;
      }),
    );
    const calls = Promise.all(Array.from({ length: 10 }, () => refreshTokens('r')));
    resolveIt(new Response(JSON.stringify({ token: 't', refresh_token: 'r2' }), { status: 200 }));
    const results = await calls;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    for (const r of results) expect(r.access_token).toBe('t');
  });

  it('throws ApiError on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(refreshTokens('bad')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
