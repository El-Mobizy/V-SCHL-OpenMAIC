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
  private cache = new Map<number, CachedQuota>();

  async initQuota(studentId: number, accessToken: string): Promise<void> {
    const res = await fetch(`${SYMFONY_API_URL}/api/token-usage/${studentId}/quota`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error('Failed to fetch quota');
    const { max_tokens, used_tokens, reset_date } = await res.json();

    this.cache.set(studentId, {
      maxTokens: max_tokens,
      usedTokens: used_tokens,
      resetDate: reset_date,
      accessToken,
      pendingUsage: [],
      callsSinceSync: 0,
    });
  }

  checkQuota(studentId: number): { allowed: boolean; remaining: number; resetDate?: string } {
    const cached = this.cache.get(studentId);
    if (!cached) return { allowed: false, remaining: 0 };

    const remaining = Math.max(0, cached.maxTokens - cached.usedTokens);
    return {
      allowed: remaining > 0,
      remaining,
      resetDate: cached.resetDate,
    };
  }

  recordUsage(
    studentId: number,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const cached = this.cache.get(studentId);
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
      this.flushUsage(studentId).catch(() => {});
    }
  }

  async flushUsage(studentId: number): Promise<void> {
    const cached = this.cache.get(studentId);
    if (!cached || cached.pendingUsage.length === 0) return;

    const usage = [...cached.pendingUsage];
    cached.pendingUsage = [];
    cached.callsSinceSync = 0;

    try {
      await fetch(`${SYMFONY_API_URL}/api/token-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cached.accessToken}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          entries: usage,
        }),
      });
    } catch {
      cached.pendingUsage.unshift(...usage);
    }
  }

  clearCache(studentId: number): void {
    this.flushUsage(studentId).catch(() => {});
    this.cache.delete(studentId);
  }

  clearAll(): void {
    this.cache.clear();
  }
}

export const tokenCounter = new TokenCounter();
