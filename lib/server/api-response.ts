import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errors';

export const API_ERROR_CODES = {
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_URL: 'INVALID_URL',
  REDIRECT_NOT_ALLOWED: 'REDIRECT_NOT_ALLOWED',
  CONTENT_SENSITIVE: 'CONTENT_SENSITIVE',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  GENERATION_FAILED: 'GENERATION_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  VALIDATION: 'VALIDATION',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorBody {
  success: false;
  errorCode: ApiErrorCode;
  error: string;
  details?: string;
}

export function apiError(
  code: ApiErrorCode,
  status: number,
  error: string,
  details?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false as const,
      errorCode: code,
      error,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Map an ApiError (from lib/ai/llm.ts, request-auth, or any other
 * boundary) into the standard route-layer `{ success, errorCode, error }`
 * envelope. Adds a `Retry-After` header when the wrapper signals rate-limit.
 *
 * Consolidates the per-route copies that accumulated during Task 14.
 */
export function apiErrorResponseFromApiError(e: ApiError): NextResponse<ApiErrorBody> {
  const errorCode = mapApiErrorCodeToEnvelope(e.code);
  return NextResponse.json(
    { success: false as const, errorCode, error: e.detail },
    {
      status: e.status,
      ...(e.retryAfter ? { headers: { 'Retry-After': String(e.retryAfter) } } : {}),
    },
  );
}

function mapApiErrorCodeToEnvelope(code: ApiError['code']): ApiErrorCode {
  switch (code) {
    case 'UNAUTHORIZED':
      return API_ERROR_CODES.UNAUTHORIZED;
    case 'FORBIDDEN':
    case 'SUSPENDED':
      return API_ERROR_CODES.FORBIDDEN;
    case 'NOT_FOUND':
      return API_ERROR_CODES.NOT_FOUND;
    case 'RATE_LIMITED':
      return API_ERROR_CODES.QUOTA_EXCEEDED;
    case 'PAYLOAD_TOO_LARGE':
      return API_ERROR_CODES.PAYLOAD_TOO_LARGE;
    case 'VALIDATION':
      return API_ERROR_CODES.VALIDATION;
    case 'NOT_CONFIGURED':
      return API_ERROR_CODES.NOT_CONFIGURED;
    case 'SERVER':
    case 'NETWORK':
    default:
      return API_ERROR_CODES.INTERNAL_ERROR;
  }
}
