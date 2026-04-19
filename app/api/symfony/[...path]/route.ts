// app/api/symfony/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/server/refresh';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';

const MAX_BODY = 5 * 1024 * 1024;

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx)    { return proxy(req, ctx); }
export async function POST(req: NextRequest, ctx: Ctx)   { return proxy(req, ctx); }
export async function PUT(req: NextRequest, ctx: Ctx)    { return proxy(req, ctx); }
export async function PATCH(req: NextRequest, ctx: Ctx)  { return proxy(req, ctx); }
export async function DELETE(req: NextRequest, ctx: Ctx) { return proxy(req, ctx); }

async function proxy(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const access  = req.cookies.get('access_token')?.value;
  const refresh = req.cookies.get('refresh_token')?.value;
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) {
      return NextResponse.json({ error: 'Content too large (max 5MB)' }, { status: 413 });
    }
  }

  const bodyText =
    req.method === 'GET' || req.method === 'DELETE'
      ? undefined
      : await req.text();

  const upstreamUrl =
    `${process.env.SYMFONY_API_URL}/api/${path.join('/')}` + (req.nextUrl.search || '');

  const firstRes = await forward(upstreamUrl, req.method, access, bodyText, req.headers.get('content-type'));
  if (firstRes.status !== 401 || !refresh) return passthrough(firstRes);

  // 401 + have refresh cookie → single-flight refresh, retry once
  let newTokens;
  try { newTokens = await refreshTokens(refresh); }
  catch {
    const res = await passthrough(firstRes);
    clearAuthCookies(res);
    return res;
  }
  const retryRes = await forward(upstreamUrl, req.method, newTokens.access_token, bodyText, req.headers.get('content-type'));
  const out = await passthrough(retryRes);
  setAuthCookies(out, newTokens.access_token, newTokens.refresh_token);
  return out;
}

async function forward(
  url: string, method: string, token: string, body: string | undefined, contentType: string | null,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
  });
}

async function passthrough(upstream: Response): Promise<NextResponse> {
  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, {
    status: upstream.status,
    headers: upstream.headers,
  });
  return res;
}
