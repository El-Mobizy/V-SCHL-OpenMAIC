'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { PaginatedResponse, Student } from '@/lib/types/school';

export function useStudentsList(opts: { matric?: string; page?: number; limit?: number }) {
  const [data, setData] = useState<PaginatedResponse<Student> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setLoad] = useState(false);

  const { matric, page, limit } = opts;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad(true);
    setError(null);
    (async () => {
      try {
        const res = await api.students.list({ matric, page, limit });
        if (active && !controller.signal.aborted) setData(res);
      } catch (e) {
        if (!active || controller.signal.aborted) return;
        setError(e instanceof ApiError ? e : new ApiError(0, 'NETWORK', String(e)));
      } finally {
        if (active) setLoad(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [matric, page, limit]);

  return { data, error, isLoading };
}
