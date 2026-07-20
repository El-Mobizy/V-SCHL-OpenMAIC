import type { SchoolUser } from '@/lib/types/school';

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 < Date.now();
}

export function extractUser(token: string): SchoolUser | null {
  if (isTokenExpired(token)) return null;
  const p = decodeJwtPayload(token);
  if (!p || !p.role) return null;
  if (p.role !== 'admin' && p.role !== 'student') return null;
  return {
    email: String(p.email ?? ''),
    name: String(p.name ?? ''),
    role: p.role,
    department: String(p.department ?? ''),
    program: String(p.program ?? ''),
    level: String(p.level ?? ''),
    student_uuid: String(p.student_uuid ?? ''),
    school_uuid: String(p.school_uuid ?? ''),
    school_name: String(p.school_name ?? ''),
  };
}
