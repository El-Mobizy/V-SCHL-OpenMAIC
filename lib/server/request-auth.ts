import type { NextRequest } from 'next/server';
import { decodeStudentId } from '@/lib/auth/jwt';
import { ApiError } from '@/lib/api/errors';

/**
 * Extract a positive integer studentId from the access_token cookie on a BFF/LLM route.
 * Throws ApiError(401, 'UNAUTHORIZED', ...) if the cookie is missing or the JWT is malformed/expired.
 *
 * Routes that need quota-metered LLM access use this to derive the student identity
 * that `callLLM` / `streamLLM` will pass to `tokenCounter`.
 */
export function requireStudentId(req: NextRequest): number {
  const token = req.cookies.get('access_token')?.value;
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'No session');
  const id = decodeStudentId(token);
  if (id === null) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid session');
  return id;
}
