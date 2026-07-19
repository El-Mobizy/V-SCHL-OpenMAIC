export interface SupportClaim {
  session_id: string;
  agent_user_id: number;
  scope: 'read' | 'write';
  expires_at: number;
  break_glass: boolean;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
  } catch {
    return atob(padded);
  }
}

export function parseSupportClaim(
  jwt: string | null | undefined,
): SupportClaim | null {
  if (!jwt) return null;

  const parts = jwt.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload || !payload.support) return null;

    const { support } = payload;
    if (
      typeof support.session_id !== 'string' ||
      typeof support.agent_user_id !== 'number' ||
      (support.scope !== 'read' && support.scope !== 'write') ||
      typeof support.expires_at !== 'number'
    ) {
      return null;
    }

    if (support.expires_at * 1000 < Date.now()) {
      return null;
    }

    return {
      session_id: support.session_id,
      agent_user_id: support.agent_user_id,
      scope: support.scope,
      expires_at: support.expires_at,
      break_glass: support.break_glass === true,
    };
  } catch {
    return null;
  }
}

export function parseSchoolNameFromJwt(
  jwt: string | null | undefined,
): string | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload.school_name || null;
  } catch {
    return null;
  }
}
