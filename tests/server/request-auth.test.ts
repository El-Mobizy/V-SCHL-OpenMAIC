import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { requireStudentId, requireStudentAuth } from '@/lib/server/request-auth';
import { ApiError } from '@/lib/api/errors';

// Helper: create a fake JWT with a given payload (no real signature — only used in unit tests).
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function reqWithToken(token: string): NextRequest {
  const req = new NextRequest('http://test/api/generate');
  req.cookies.set('access_token', token);
  return req;
}

const STUDENT_UUID = '01HZQK0123456789ABCDEFGHJK';
const futureExp = Math.floor(Date.now() / 1000) + 3600;

const studentToken = fakeJwt({
  email: 'stu@school.com',
  name: 'Student One',
  role: 'student',
  department: 'CS',
  program: 'BSc',
  level: 'L1',
  student_uuid: STUDENT_UUID,
  exp: futureExp,
});

const adminToken = fakeJwt({
  email: 'admin@school.com',
  name: 'Admin User',
  role: 'admin',
  department: '',
  program: '',
  level: '',
  exp: futureExp,
});

const studentTokenNoUuid = fakeJwt({
  email: 'stu2@school.com',
  name: 'Student Two',
  role: 'student',
  department: 'Math',
  program: 'BSc',
  level: 'L2',
  student_uuid: '',
  exp: futureExp,
});

describe('requireStudentId', () => {
  it('returns student_uuid for a valid student token', () => {
    const req = reqWithToken(studentToken);
    expect(requireStudentId(req)).toBe(STUDENT_UUID);
  });

  it('throws 401 when no access_token cookie', () => {
    const req = new NextRequest('http://test/api/generate');
    expect(() => requireStudentId(req)).toThrow(ApiError);
    try {
      requireStudentId(req);
    } catch (err) {
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).code).toBe('UNAUTHORIZED');
    }
  });

  it('throws 403 FORBIDDEN for admin token', () => {
    const req = reqWithToken(adminToken);
    expect(() => requireStudentId(req)).toThrow(ApiError);
    try {
      requireStudentId(req);
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('FORBIDDEN');
    }
  });

  it('throws 403 FORBIDDEN for student token with empty student_uuid', () => {
    const req = reqWithToken(studentTokenNoUuid);
    expect(() => requireStudentId(req)).toThrow(ApiError);
    try {
      requireStudentId(req);
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('FORBIDDEN');
    }
  });
});

describe('requireStudentAuth', () => {
  it('returns studentId and accessToken for a valid student token', () => {
    const req = reqWithToken(studentToken);
    const result = requireStudentAuth(req);
    expect(result.studentId).toBe(STUDENT_UUID);
    expect(result.accessToken).toBe(studentToken);
  });

  it('throws 403 FORBIDDEN for admin token', () => {
    const req = reqWithToken(adminToken);
    expect(() => requireStudentAuth(req)).toThrow(ApiError);
    try {
      requireStudentAuth(req);
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('FORBIDDEN');
    }
  });

  it('throws 403 FORBIDDEN for student token with empty student_uuid', () => {
    const req = reqWithToken(studentTokenNoUuid);
    expect(() => requireStudentAuth(req)).toThrow(ApiError);
    try {
      requireStudentAuth(req);
    } catch (err) {
      expect((err as ApiError).status).toBe(403);
      expect((err as ApiError).code).toBe('FORBIDDEN');
    }
  });
});
