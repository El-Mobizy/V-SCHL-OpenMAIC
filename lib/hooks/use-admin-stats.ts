'use client';
import { useCallback, useState } from 'react';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { AdminStats } from '@/lib/types/school';

export function useAdminStats(initial: AdminStats | null) {
  const [data, setData] = useState<AdminStats | null>(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setLoad] = useState(false);

  const refresh = useCallback(async () => {
    setLoad(true);
    setError(null);
    try {
      setData(await api.admin.stats());
    } catch (e) {
      if (e instanceof ApiError) setError(e);
      else throw e;
    } finally {
      setLoad(false);
    }
  }, []);

  return { data, error, isLoading, refresh };
}
