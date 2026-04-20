import { describe, it, expect } from 'vitest';
import { ApiError, toApiError } from '@/lib/api/errors';

function mockRes(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('toApiError', () => {
  it('maps 401 → UNAUTHORIZED', async () => {
    const e = await toApiError(mockRes(401, { message: 'Invalid credentials' }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('UNAUTHORIZED');
    expect(e.detail).toBe('Invalid credentials');
  });

  it('maps 403 with "suspended" → SUSPENDED', async () => {
    const e = await toApiError(mockRes(403, { message: 'Account suspended, contact admin' }));
    expect(e.code).toBe('SUSPENDED');
  });

  it('maps 403 without "suspended" → FORBIDDEN', async () => {
    const e = await toApiError(mockRes(403, { message: 'forbidden' }));
    expect(e.code).toBe('FORBIDDEN');
  });

  it('maps 404 → NOT_FOUND with body.error', async () => {
    const e = await toApiError(mockRes(404, { error: 'Student not found' }));
    expect(e.code).toBe('NOT_FOUND');
    expect(e.detail).toBe('Student not found');
  });

  it('maps 413 → PAYLOAD_TOO_LARGE', async () => {
    const e = await toApiError(mockRes(413, { error: 'Content too large' }));
    expect(e.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps 429 → RATE_LIMITED with retryAfter', async () => {
    const e = await toApiError(mockRes(429, {}, { 'retry-after': '42' }));
    expect(e.code).toBe('RATE_LIMITED');
    expect(e.retryAfter).toBe(42);
  });

  it('maps 400 → VALIDATION', async () => {
    const e = await toApiError(mockRes(400, { error: 'bad' }));
    expect(e.code).toBe('VALIDATION');
    expect(e.detail).toBe('bad');
  });

  it('maps 500 → SERVER', async () => {
    const e = await toApiError(mockRes(500, { error: 'oops' }));
    expect(e.code).toBe('SERVER');
  });

  it('handles non-JSON body gracefully', async () => {
    const res = new Response('<html>fail</html>', { status: 500 });
    const e = await toApiError(res);
    expect(e.code).toBe('SERVER');
  });

  it('maps 415 to UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = new Response(JSON.stringify({ error: 'bad MIME' }), { status: 415 });
    const err = await toApiError(res);
    expect(err.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(err.status).toBe(415);
  });
});
