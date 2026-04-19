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

describe('BFF proxy — additional coverage', () => {
  it('forwards POST body to upstream verbatim', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const body = JSON.stringify({ student_id: 42, course_id: 1, scene_index: 3 });
    const req = new NextRequest('http://test/api/symfony/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': String(body.length) },
      body,
    });
    req.cookies.set('access_token', 'tok');
    const { POST } = await import('@/app/api/symfony/[...path]/route');
    const res = await POST(req, { params: Promise.resolve({ path: ['progress'] }) });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://symfony/api/progress',
      expect.objectContaining({
        method: 'POST',
        body,
      }),
    );
  });

  it('retries once on 401 after refresh succeeds, sets new cookies', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'new-access', refresh_token: 'new-refresh' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 }));
    const { __resetInFlightForTest } = await import('@/lib/server/refresh');
    __resetInFlightForTest();
    const req = new NextRequest('http://test/api/symfony/courses');
    req.cookies.set('access_token', 'old-access');
    req.cookies.set('refresh_token', 'old-refresh');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith('access_token=new-access'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('refresh_token=new-refresh'))).toBe(true);
  });

  it('clears cookies when refresh fails after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 })); // refresh fails
    const { __resetInFlightForTest } = await import('@/lib/server/refresh');
    __resetInFlightForTest();
    const req = new NextRequest('http://test/api/symfony/courses');
    req.cookies.set('access_token', 'old-access');
    req.cookies.set('refresh_token', 'bad-refresh');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(res.status).toBe(401);
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.startsWith('access_token=;') || /access_token=;.*Max-Age=0/.test(c))).toBe(true);
  });

  it('rejects oversized POST body with 413 before forwarding', async () => {
    const req = new NextRequest('http://test/api/symfony/courses/1/syllabus', {
      method: 'POST',
      headers: { 'content-length': String(6 * 1024 * 1024) },
      body: 'x'.repeat(100),
    });
    req.cookies.set('access_token', 'tok');
    const { POST } = await import('@/app/api/symfony/[...path]/route');
    const res = await POST(req, { params: Promise.resolve({ path: ['courses', '1', 'syllabus'] }) });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does NOT forward upstream Set-Cookie headers to the browser', async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Set-Cookie': 'symfony_session=danger; Path=/' },
    });
    fetchMock.mockResolvedValueOnce(upstream);
    const req = new NextRequest('http://test/api/symfony/school/branding');
    req.cookies.set('access_token', 'tok');
    const res = await GET(req, { params: Promise.resolve({ path: ['school', 'branding'] }) });
    const setCookies = res.headers.getSetCookie();
    expect(setCookies.some((c) => c.includes('symfony_session'))).toBe(false);
  });

  it('returns 502 NETWORK when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const req = new NextRequest('http://test/api/symfony/courses');
    req.cookies.set('access_token', 'tok');
    const res = await GET(req, { params: Promise.resolve({ path: ['courses'] }) });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('NETWORK');
  });

  it('rejects chunked POST body exceeding 5MB (no content-length header)', async () => {
    const oversized = 'x'.repeat(6 * 1024 * 1024);  // 6 MB string
    const req = new NextRequest('http://test/api/symfony/courses/1/syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // NO content-length
      body: oversized,
    });
    req.cookies.set('access_token', 'tok');
    const { POST } = await import('@/app/api/symfony/[...path]/route');
    const res = await POST(req, { params: Promise.resolve({ path: ['courses', '1', 'syllabus'] }) });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips upstream authorization / www-authenticate / x-service-token headers', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Authorization': 'Bearer leaked',
        'WWW-Authenticate': 'Bearer realm="x"',
        'X-Service-Token': 'also-leaked',
      },
    }));
    const req = new NextRequest('http://test/api/symfony/school/branding');
    req.cookies.set('access_token', 'tok');
    const res = await GET(req, { params: Promise.resolve({ path: ['school', 'branding'] }) });
    expect(res.headers.get('authorization')).toBeNull();
    expect(res.headers.get('www-authenticate')).toBeNull();
    expect(res.headers.get('x-service-token')).toBeNull();
  });
});
