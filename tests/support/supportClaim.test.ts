import { describe, it, expect } from 'vitest';
import { parseSupportClaim } from '@/lib/support/supportClaim';
import type { SupportClaim } from '@/lib/support/supportClaim';

function makeJwt(payload: Record<string, unknown>): string {
  const base64Url = (s: string) =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `header.${base64Url(JSON.stringify(payload))}.signature`;
}

describe('parseSupportClaim', () => {
  it('returns SupportClaim when JWT contains valid support claim', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const support: SupportClaim = {
      session_id: 'uuid-123',
      agent_user_id: 42,
      scope: 'read',
      expires_at: futureExp,
      break_glass: false,
    };
    const jwt = makeJwt({ support });

    const result = parseSupportClaim(jwt);
    expect(result).toEqual(support);
  });

  it('returns null for a normal JWT without support claim', () => {
    const jwt = makeJwt({ userId: 1, role: 'student' });
    expect(parseSupportClaim(jwt)).toBeNull();
  });

  it('returns null for null or undefined input', () => {
    expect(parseSupportClaim(null)).toBeNull();
    expect(parseSupportClaim(undefined)).toBeNull();
    expect(parseSupportClaim('')).toBeNull();
  });

  it('returns null when expires_at is in the past', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const jwt = makeJwt({
      support: {
        session_id: 'expired-session',
        agent_user_id: 1,
        scope: 'write',
        expires_at: pastExp,
        break_glass: false,
      },
    });
    expect(parseSupportClaim(jwt)).toBeNull();
  });

  it('returns null for malformed JWT', () => {
    expect(parseSupportClaim('not.valid')).toBeNull();
  });

  it('handles break_glass as true', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const jwt = makeJwt({
      support: {
        session_id: 'bg-session',
        agent_user_id: 99,
        scope: 'write',
        expires_at: futureExp,
        break_glass: true,
      },
    });
    const result = parseSupportClaim(jwt);
    expect(result).not.toBeNull();
    expect(result!.break_glass).toBe(true);
  });
});
