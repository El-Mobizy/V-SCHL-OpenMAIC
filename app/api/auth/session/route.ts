import { NextRequest, NextResponse } from 'next/server';
import { isTokenExpired, extractUser } from '@/lib/auth/jwt';
import { tokenCounter } from '@/lib/server/token-counter';

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json();

  if (!access_token || isTokenExpired(access_token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set('access_token', access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  response.cookies.set('refresh_token', refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Initialize quota cache for students — non-blocking
  const user = extractUser(access_token);
  if (user && user.role === 'student') {
    tokenCounter.initQuota(user.id, access_token).catch(() => {});
  }

  return response;
}
