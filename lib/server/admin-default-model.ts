import { createLogger } from '@/lib/logger';

const log = createLogger('AdminDefaultModel');

interface AdminKeyRow {
  provider: string;
  is_default?: boolean;
  models?: Array<{ id: string }>;
}

const FINAL_FALLBACK = 'openai/gpt-4o-mini';

async function fetchAdminKeys(accessToken: string): Promise<AdminKeyRow[]> {
  const base = process.env.SYMFONY_API_URL;
  if (!base) return [];
  try {
    const res = await fetch(`${base}/api/admin/api-keys`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as AdminKeyRow[];
    return Array.isArray(json) ? json : [];
  } catch (e) {
    log.warn('Failed to fetch admin keys for default-model resolution:', e);
    return [];
  }
}

function modelStringFor(row: AdminKeyRow): string | null {
  const firstModelId = row.models?.[0]?.id;
  if (!firstModelId) return null;
  return `${row.provider}/${firstModelId}`;
}

function pickAdminDefault(rows: AdminKeyRow[]): string | null {
  const flagged = rows.find((r) => r.is_default === true);
  if (flagged) {
    const s = modelStringFor(flagged);
    if (s) return s;
  }
  const firstWithModel = rows.find((r) => r.models && r.models.length > 0);
  if (firstWithModel) return modelStringFor(firstWithModel);
  return null;
}

export async function resolveClassroomModelString({
  clientOverride,
  accessToken,
}: {
  clientOverride?: string;
  accessToken: string;
}): Promise<string> {
  if (clientOverride && clientOverride.includes('/')) {
    return clientOverride;
  }
  const rows = await fetchAdminKeys(accessToken);
  const adminDefault = pickAdminDefault(rows);
  if (adminDefault) return adminDefault;
  const envDefault = process.env.DEFAULT_MODEL?.trim();
  if (envDefault) return envDefault;
  return FINAL_FALLBACK;
}
