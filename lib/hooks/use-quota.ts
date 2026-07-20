'use client';

import { useState, useCallback } from 'react';

interface QuotaState {
  exceeded: boolean;
  remaining: number;
  resetDate: string | null;
}

export function useQuota() {
  const [quota, setQuota] = useState<QuotaState>({
    exceeded: false,
    remaining: Infinity,
    resetDate: null,
  });

  const handleQuotaExceeded = useCallback((resetDate: string) => {
    setQuota({ exceeded: true, remaining: 0, resetDate });
  }, []);

  const dismissQuota = useCallback(() => {
    setQuota((prev) => ({ ...prev, exceeded: false }));
  }, []);

  return { ...quota, handleQuotaExceeded, dismissQuota };
}
