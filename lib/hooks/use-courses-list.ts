'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { PaginatedResponse, Course } from '@/lib/types/school';

export function useCoursesList(opts: { studentUuid?: string; page?: number; limit?: number }) {
  const [data, setData] = useState<PaginatedResponse<Course> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setLoad] = useState(false);

  const { studentUuid, page, limit } = opts;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoad(true);
    setError(null);
    (async () => {
      try {
        const res = await api.courses.list({ studentUuid, page, limit });
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
  }, [studentUuid, page, limit]);

  return { data, error, isLoading };
}
