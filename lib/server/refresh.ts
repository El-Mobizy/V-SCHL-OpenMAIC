import { ApiError } from '@/lib/api/errors';

export interface TokenPair { access_token: string; refresh_token: string; }

let inFlight: Promise<TokenPair> | null = null;

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  if (inFlight) return inFlight;
  inFlight = doRefresh(refreshToken).finally(() => { inFlight = null; });
  return inFlight;
}

async function doRefresh(refresh_token: string): Promise<TokenPair> {
  const url = `${process.env.SYMFONY_API_URL}/api/token/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Refresh failed');
  }
  const body = (await res.json()) as Record<string, string>;
  return {
    access_token:  body.access_token ?? body.token,  // Lexik returns `token`
    refresh_token: body.refresh_token,
  };
}

/** @internal — testing only */
export function __resetInFlightForTest(): void { inFlight = null; }
