import { NextRequest, NextResponse } from 'next/server';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';
import { decodeJwtPayload, decodeStudentId } from '@/lib/auth/jwt';
import { toApiError } from '@/lib/api/errors';
import { tokenCounter } from '@/lib/server/token-counter';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'VALIDATION' }, { status: 400 });
  }

  const email    = typeof (body as { email?: unknown }).email    === 'string' ? (body as { email: string }).email.trim()    : '';
  const password = typeof (body as { password?: unknown }).password === 'string' ? (body as { password: string }).password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required', code: 'VALIDATION' }, { status: 400 });
  }

  const upstream = await fetch(`${process.env.SYMFONY_API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!upstream.ok) {
    const err = await toApiError(upstream);
    // Sanitize 5xx detail — never forward raw upstream error strings to the client.
    const safeDetail = err.status >= 500 ? 'Login failed' : err.detail;
    const res = NextResponse.json({ error: safeDetail, code: err.code }, { status: err.status });
    if (err.code === 'SUSPENDED' || err.code === 'UNAUTHORIZED') clearAuthCookies(res);
    return res;
  }

  let tokens: { access_token?: string; refresh_token?: string };
  try {
    tokens = await upstream.json();
  } catch {
    return NextResponse.json({ error: 'Malformed upstream response', code: 'SERVER' }, { status: 502 });
  }

  const { access_token, refresh_token } = tokens;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Malformed upstream response', code: 'SERVER' }, { status: 502 });
  }

  const studentId = decodeStudentId(access_token);
  if (studentId === null) {
    return NextResponse.json({ error: 'Malformed token', code: 'SERVER' }, { status: 502 });
  }

  const payload = decodeJwtPayload(access_token);
  if (!payload) {
    return NextResponse.json({ error: 'Malformed token', code: 'SERVER' }, { status: 502 });
  }

  const role = payload.role;
  if (role !== 'admin' && role !== 'student') {
    return NextResponse.json({ error: 'Unknown role', code: 'SERVER' }, { status: 502 });
  }

  const user = {
    id: studentId,
    email: String(payload.email ?? ''),
    name:  String(payload.name  ?? ''),
    role,
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
