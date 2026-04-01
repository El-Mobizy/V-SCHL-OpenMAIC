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
