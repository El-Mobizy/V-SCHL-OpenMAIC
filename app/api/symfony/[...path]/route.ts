// app/api/symfony/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/server/refresh';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';

const MAX_BODY = 5 * 1024 * 1024;

const STRIPPED_HEADERS = new Set([
  'set-cookie',
  'content-encoding',
  'content-length',
  'connection',
  'keep-alive',
  'transfer-encoding',
  // P0.5: never forward credentials-bearing headers upstream → downstream
  'authorization',
  'www-authenticate',
  'x-service-token',
]);

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx);
}

async function proxy(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { path } = await ctx.params;
  const access = req.cookies.get('access_token')?.value;
  const refresh = req.cookies.get('refresh_token')?.value;
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ct = req.headers.get('content-type') ?? '';
  const isJson = ct.includes('application/json');

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) {
      return NextResponse.json({ error: 'Content too large (max 5MB)' }, { status: 413 });
    }
  }

  try {
    let body: ArrayBuffer | string | undefined;
    if (req.method === 'GET' || req.method === 'DELETE') {
      body = undefined;
    } else if (isJson) {
      body = await req.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY) {
        return NextResponse.json({ error: 'Content too large (max 5MB)' }, { status: 413 });
      }
    } else {
      body = await req.arrayBuffer();
      if (body.byteLength > MAX_BODY) {
        return NextResponse.json({ error: 'Content too large (max 5MB)' }, { status: 413 });
      }
    }

    // Read env inside the function so vitest stubEnv can override it (see tests/api/symfony-proxy.test.ts).
    const upstreamUrl = `${process.env.SYMFONY_API_URL}/api/${path.join('/')}${req.nextUrl.search || ''}`;

    const firstRes = await forward(upstreamUrl, req.method, access, body, ct || null);
    if (firstRes.status !== 401 || !refresh) return passthrough(firstRes);

    // 401 + have refresh cookie → single-flight refresh, retry once
    let newTokens;
    try {
      newTokens = await refreshTokens(refresh);
    } catch {
      const res = await passthrough(firstRes);
      clearAuthCookies(res);
      return res;
    }
    const retryRes = await forward(
      upstreamUrl,
      req.method,
      newTokens.access_token,
      body,
      ct || null,
    );
    const out = await passthrough(retryRes);
    setAuthCookies(out, newTokens.access_token, newTokens.refresh_token);
    return out;
  } catch {
    return NextResponse.json({ error: 'Upstream unavailable', code: 'NETWORK' }, { status: 502 });
  }
}

async function forward(
  url: string,
  method: string,
  token: string,
  body: ArrayBuffer | string | undefined,
  contentType: string | null,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: body as BodyInit | undefined,
  });
}

async function passthrough(upstream: Response): Promise<NextResponse> {
  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!STRIPPED_HEADERS.has(k.toLowerCase())) headers.set(k, v);
  });
  return new NextResponse(body, { status: upstream.status, headers });
}
