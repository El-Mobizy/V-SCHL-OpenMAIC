import type { SchoolUser } from '@/lib/types/school';

/** Decode JWT payload without verifying signature (verification happens server-side in Symfony) */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/** Check if a JWT token is expired */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 < Date.now();
}

/** Extract a positive integer student/user ID from a JWT's `sub` claim.
 *  Returns null if the token is malformed, expired, or has a non-integer sub. */
export function decodeStudentId(token: string): number | null {
  if (isTokenExpired(token)) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const id = Number(payload.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Extract SchoolUser from JWT payload */
export function extractUser(token: string): SchoolUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub || !payload.role) return null;
  return {
    id: Number(payload.sub),
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
    role: payload.role as 'admin' | 'student',
    department: String(payload.department ?? ''),
    program: String(payload.program ?? ''),
    level: String(payload.level ?? ''),
  };
}
