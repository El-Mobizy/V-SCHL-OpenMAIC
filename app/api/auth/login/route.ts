import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';
import { decodeJwtPayload } from '@/lib/auth/jwt';
import { toApiError } from '@/lib/api/errors';
import { tokenCounter } from '@/lib/server/token-counter';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const upstream = await fetch(`${process.env.SYMFONY_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!upstream.ok) {
    const err = await toApiError(upstream);
    const res = NextResponse.json({ error: err.detail, code: err.code }, { status: err.status });
    if (err.code === 'SUSPENDED' || err.code === 'UNAUTHORIZED') clearAuthCookies(res);
    return res;
  }

  const { access_token, refresh_token } = await upstream.json();
  const payload = decodeJwtPayload(access_token);
  if (!payload?.sub) {
    return NextResponse.json({ error: 'Malformed token' }, { status: 502 });
  }

  const user = {
    id: Number(payload.sub),
    email: String(payload.email ?? ''),
    name:  String(payload.name  ?? ''),
    role:  payload.role as 'admin' | 'student',
    department: String(payload.department ?? ''),
    program:    String(payload.program    ?? ''),
    level:      String(payload.level      ?? ''),
  };

  const res = NextResponse.json({ user });
  setAuthCookies(res, access_token, refresh_token);

  if (user.role === 'student') {
    tokenCounter.initQuota(user.id, access_token).catch(() => {});
  }
  return res;
}
