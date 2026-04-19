import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('next/server', async () => {
  const real = await vi.importActual<typeof import('next/server')>('next/server');
  return real;
});

import { GET } from '@/app/api/symfony/[...path]/route';
import { NextRequest } from 'next/server';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('SYMFONY_API_URL', 'http://symfony');
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function reqWithCookie(url: string, cookie: string): NextRequest {
  const r = new NextRequest(url);
  r.cookies.set('access_token', cookie);
  return r;
}

describe('BFF proxy', () => {
  it('returns 401 when cookie missing', async () => {
    const req = new NextRequest('http://test/api/symfony/courses');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(res.status).toBe(401);
  });

  it('forwards with Authorization header and passes body through', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));
    const req = reqWithCookie('http://test/api/symfony/courses?student=42', 'tok');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://symfony/api/courses?student=42',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 1 }]);
  });

  it('passes 429 through with Retry-After', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '30' } }));
    const req = reqWithCookie('http://test/api/symfony/courses', 'tok');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
  });
});
