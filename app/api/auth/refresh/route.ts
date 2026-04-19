// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/server/refresh';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';

export async function POST(req: NextRequest) {
  const refresh = req.cookies.get('refresh_token')?.value;
  if (!refresh) {
    const res = NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  try {
    const tokens = await refreshTokens(refresh);
    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, tokens.access_token, tokens.refresh_token);
    return res;
  } catch {
    const res = NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
}
