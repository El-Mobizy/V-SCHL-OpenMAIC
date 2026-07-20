const SYMFONY_API_URL = process.env.SYMFONY_API_URL!;
const SYNC_INTERVAL_CALLS = 10;

interface CachedQuota {
  maxTokens: number;
  usedTokens: number;
  resetDate: string;
  accessToken: string;
  pendingUsage: UsageEntry[];
  callsSinceSync: number;
}

interface UsageEntry {
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
}

class TokenCounter {
  private cache = new Map<string, CachedQuota>();

  async initQuota(studentUuid: string, accessToken: string): Promise<void> {
    const res = await fetch(`${SYMFONY_API_URL}/api/token-usage/${studentUuid}/quota`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error('Failed to fetch quota');
    const { max_tokens, used_tokens, reset_date } = await res.json();

    this.cache.set(studentUuid, {
      maxTokens: max_tokens,
      usedTokens: used_tokens,
      resetDate: reset_date,
      accessToken,
      pendingUsage: [],
      callsSinceSync: 0,
    });
  }

  checkQuota(studentUuid: string): { allowed: boolean; remaining: number; resetDate?: string } {
    const cached = this.cache.get(studentUuid);
    if (!cached) return { allowed: false, remaining: 0 };

    const remaining = Math.max(0, cached.maxTokens - cached.usedTokens);
    return {
      allowed: remaining > 0,
      remaining,
      resetDate: cached.resetDate,
    };
  }

  recordUsage(
    studentUuid: string,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const cached = this.cache.get(studentUuid);
    if (!cached) return;

    cached.usedTokens += inputTokens + outputTokens;
    cached.pendingUsage.push({
      provider,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      timestamp: new Date().toISOString(),
    });
    cached.callsSinceSync += 1;

    if (cached.callsSinceSync >= SYNC_INTERVAL_CALLS) {
      this.flushUsage(studentUuid).catch(() => {});
    }
  }

  async flushUsage(studentUuid: string): Promise<void> {
    const cached = this.cache.get(studentUuid);
    if (!cached || cached.pendingUsage.length === 0) return;

    const usage = [...cached.pendingUsage];
    cached.pendingUsage = [];
    cached.callsSinceSync = 0;

    try {
      const res = await fetch(`${SYMFONY_API_URL}/api/token-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cached.accessToken}`,
        },
        body: JSON.stringify({
          student_uuid: studentUuid,
          entries: usage,
        }),
      });
      if (!res.ok) {
        throw new Error(`Symfony token-usage returned ${res.status}`);
      }
    } catch {
      // Requeue at the front so order is preserved.
      cached.pendingUsage.unshift(...usage);
    }
  }

  clearCache(studentUuid: string): void {
    this.flushUsage(studentUuid).catch(() => {});
    this.cache.delete(studentUuid);
  }

  clearAll(): void {
    this.cache.clear();
  }
}

export const tokenCounter = new TokenCounter();
