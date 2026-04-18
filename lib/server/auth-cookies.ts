import type { NextResponse } from 'next/server';

const ACCESS_MAX_AGE  = 60 * 60 * 24;        // 24h
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;   // 30d

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  const common = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookies.set('access_token',  accessToken,  { ...common, maxAge: ACCESS_MAX_AGE });
  res.cookies.set('refresh_token', refreshToken, { ...common, maxAge: REFRESH_MAX_AGE });
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete('access_token');
  res.cookies.delete('refresh_token');
}
