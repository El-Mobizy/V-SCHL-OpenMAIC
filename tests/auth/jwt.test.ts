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
    expect(payload?.sub).toBe('1');
    expect(payload?.email).toBe('test@school.com');
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
      email: 'student@school.com',
      name: 'John Doe',
      role: 'student',
      department: 'CS',
      program: 'BSc',
      level: 'L2',
      student_uuid: '01HZQK0123456789ABCDEFGHJK',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const user = extractUser(token);
    expect(user).toEqual({
      email: 'student@school.com',
      name: 'John Doe',
      role: 'student',
      department: 'CS',
      program: 'BSc',
      level: 'L2',
      student_uuid: '01HZQK0123456789ABCDEFGHJK',
    });
  });

  it('returns null for invalid token', () => {
    expect(extractUser('bad')).toBeNull();
  });

  it('extractUser includes student_uuid from payload', () => {
    const token = fakeJwt({
      email: 'stu@school.com',
      name: 'Student One',
      role: 'student',
      department: 'CS',
      program: 'BSc',
      level: 'L1',
      student_uuid: '01HZQK0123456789ABCDEFGHJK',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const user = extractUser(token);
    expect(user?.student_uuid).toBe('01HZQK0123456789ABCDEFGHJK');
  });

  it('extractUser returns empty student_uuid for non-student', () => {
    const token = fakeJwt({
      email: 'admin@school.com',
      name: 'Admin User',
      role: 'admin',
      department: '',
      program: '',
      level: '',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const user = extractUser(token);
    expect(user?.student_uuid).toBe('');
  });
});
