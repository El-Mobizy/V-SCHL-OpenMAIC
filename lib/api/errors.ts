export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SUSPENDED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION'
  | 'NOT_CONFIGURED'
  | 'SERVER'
  | 'NETWORK'
  | 'UNSUPPORTED_MEDIA_TYPE';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly detail: string,
    public readonly retryAfter?: number,
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    const text = await res.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }

  const msg = (body.error ?? body.message ?? '') as string;

  if (res.status === 401) return new ApiError(401, 'UNAUTHORIZED', msg || 'Unauthorized');
  if (res.status === 403) {
    const suspended = msg.toLowerCase().includes('suspended');
    return new ApiError(403, suspended ? 'SUSPENDED' : 'FORBIDDEN', msg || 'Forbidden');
  }
  if (res.status === 404) return new ApiError(404, 'NOT_FOUND', msg || 'Not found');
  if (res.status === 413) return new ApiError(413, 'PAYLOAD_TOO_LARGE', msg || 'Too large');
  if (res.status === 415)
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', msg || 'Unsupported media type');
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') ?? 0) || undefined;
    return new ApiError(429, 'RATE_LIMITED', msg || 'Rate limited', retryAfter);
  }
  if (res.status >= 400 && res.status < 500) {
    return new ApiError(res.status, 'VALIDATION', msg || 'Bad request');
  }
  return new ApiError(res.status, 'SERVER', msg || 'Server error');
}
