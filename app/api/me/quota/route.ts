import { NextRequest, NextResponse } from 'next/server';
import { extractUser } from '@/lib/auth/jwt';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('Me Quota API');

const SYMFONY_API_URL = process.env.SYMFONY_API_URL;

export async function GET(req: NextRequest) {
  if (!SYMFONY_API_URL) {
    return apiError('NOT_CONFIGURED', 500, 'SYMFONY_API_URL is not configured');
  }

  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    return apiError('UNAUTHORIZED', 401, 'Authentication required');
  }

  const user = extractUser(accessToken);
  if (!user) {
    return apiError('UNAUTHORIZED', 401, 'Invalid token');
  }

  if (user.role !== 'student' || !user.student_uuid) {
    return apiError('FORBIDDEN', 403, 'Quota is only tracked for students');
  }

  try {
    const upstream = await fetch(
      `${SYMFONY_API_URL}/api/token-usage/${user.student_uuid}/quota`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
    );

    if (!upstream.ok) {
      log.warn('Upstream quota fetch failed', { status: upstream.status });
      return apiError('UPSTREAM_ERROR', upstream.status, 'Failed to fetch quota');
    }

    const body = (await upstream.json()) as {
      max_tokens: number;
      used_tokens: number;
      reset_date: string;
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    log.error('Quota proxy error', e);
    return apiError('INTERNAL_ERROR', 500, 'Quota fetch failed');
  }
}
