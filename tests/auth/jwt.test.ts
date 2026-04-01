import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, isTokenExpired, extractUser } from '@/lib/auth/jwt';

// Helper: create a fake JWT with a given payload
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const token = fakeJwt({ sub: '1', email: 'test@school.com' });
    const payload = decodeJwtPayload(token);
    expect(payload.sub).toBe('1');
    expect(payload.email).toBe('test@school.com');
  });

  it('returns null for invalid token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns true for expired token', () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('returns false for valid token', () => {
    const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for token without exp', () => {
    const token = fakeJwt({ sub: '1' });
    expect(isTokenExpired(token)).toBe(true);
  });
});

describe('extractUser', () => {
  it('extracts user from JWT payload', () => {
    const token = fakeJwt({
      sub: '42',
      email: 'student@school.com',
      name: 'John Doe',
      role: 'student',
      department: 'CS',
      program: 'BSc',
      level: 'L2',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const user = extractUser(token);
    expect(user).toEqual({
      id: 42,
      email: 'student@school.com',
      name: 'John Doe',
      role: 'student',
      department: 'CS',
      program: 'BSc',
      level: 'L2',
    });
  });

  it('returns null for invalid token', () => {
    expect(extractUser('bad')).toBeNull();
  });
});
