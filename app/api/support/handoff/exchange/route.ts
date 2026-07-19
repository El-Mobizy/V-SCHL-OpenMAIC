import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies } from '@/lib/server/auth-cookies';
import { toApiError } from '@/lib/api/errors';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'VALIDATION' },
      { status: 400 },
    );
  }

  const code =
    typeof (body as { code?: unknown }).code === 'string'
      ? (body as { code: string }).code.trim()
      : '';

  if (!code) {
    return NextResponse.json(
      { error: 'code required', code: 'VALIDATION' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(
      `${process.env.SYMFONY_API_URL}/api/support/handoff/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      },
    );

    if (!upstream.ok) {
      const err = await toApiError(upstream);
      return NextResponse.json(
        { error: err.detail || 'Exchange failed', code: err.code },
        { status: err.status },
      );
    }

    const result = await upstream.json();
    const token = result?.token;
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Malformed exchange response', code: 'SERVER' },
        { status: 502 },
      );
    }

    const res = NextResponse.json({ success: true });
    // Store support token as access_token cookie (no refresh for support sessions).
    setAuthCookies(res, token, '');
    return res;
  } catch (e) {
    if (e instanceof NextResponse || 'status' in (e as object)) {
      return e as NextResponse;
    }
    return NextResponse.json(
      { error: 'Upstream unavailable', code: 'NETWORK' },
      { status: 502 },
    );
  }
}
