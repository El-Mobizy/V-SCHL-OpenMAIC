import { create } from 'zustand';

export interface TokenQuota {
  maxTokens: number;
  usedTokens: number;
  resetDate: string;
}

interface TokenQuotaState {
  quota: TokenQuota | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

async function fetchQuota(): Promise<TokenQuota> {
  const res = await fetch('/api/me/quota', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Quota fetch failed: ${res.status}`);
  const body = (await res.json()) as {
    max_tokens: number;
    used_tokens: number;
    reset_date: string;
  };
  return {
    maxTokens: body.max_tokens,
    usedTokens: body.used_tokens,
    resetDate: body.reset_date,
  };
}

export const useTokenQuotaStore = create<TokenQuotaState>()((set, get) => ({
  quota: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetch: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const quota = await fetchQuota();
      set({ quota, isLoading: false, lastFetchedAt: Date.now() });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  },

  refresh: async () => {
    try {
      const quota = await fetchQuota();
      set({ quota, lastFetchedAt: Date.now(), error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' });
    }
  },

  reset: () => set({ quota: null, isLoading: false, error: null, lastFetchedAt: null }),
}));

export function selectQuotaPercentage(state: TokenQuotaState): number {
  if (!state.quota || state.quota.maxTokens <= 0) return 0;
  return Math.min(100, Math.round((state.quota.usedTokens / state.quota.maxTokens) * 100));
}
