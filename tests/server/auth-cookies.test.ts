import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { setAuthCookies, clearAuthCookies } from '@/lib/server/auth-cookies';

describe('auth-cookies', () => {
  it('setAuthCookies writes both cookies with httpOnly', () => {
    const res = NextResponse.json({ ok: true });
    setAuthCookies(res, 'access-xyz', 'refresh-abc');
    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === 'access_token')!;
    const refresh = cookies.find((c) => c.name === 'refresh_token')!;
    expect(access.value).toBe('access-xyz');
    expect(access.httpOnly).toBe(true);
    expect(access.sameSite).toBe('lax');
    expect(refresh.value).toBe('refresh-abc');
    expect(refresh.maxAge).toBeGreaterThan(access.maxAge!);
  });

  it('clearAuthCookies deletes both', () => {
    const res = NextResponse.json({ ok: true });
    clearAuthCookies(res);
    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === 'access_token');
    expect(access?.value).toBe('');
  });
});
