'use client';
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCoursesList } from '@/lib/hooks/use-courses-list';
import { CoursesTable } from '@/components/admin/courses-table';
import { CoursesFilter } from '@/components/admin/courses-filter';
import { Pagination } from '@/components/admin/pagination';

export default function CoursesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? undefined;
  const page = Number(params.get('page') ?? 1);
  const limit = Number(params.get('limit') ?? 30);

  const { data, error, isLoading } = useCoursesList({ q, page, limit });

  const update = useCallback(
    (next: Partial<{ q: string; page: number; limit: number }>) => {
      const sp = new URLSearchParams(params.toString());
      if ('q' in next) {
        if (next.q) sp.set('q', next.q);
        else sp.delete('q');
        sp.set('page', '1');
      }
      if (next.page != null) sp.set('page', String(next.page));
      if (next.limit != null) sp.set('limit', String(next.limit));
      router.replace(`/admin/courses?${sp.toString()}`);
    },
    [router, params],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="border-l-4 border-primary pl-3">
          <h1 className="text-2xl font-semibold">Courses</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              Total: {data.meta.total.toLocaleString()}
            </p>
          )}
        </div>
      </header>
      <CoursesFilter initial={q ?? ''} onDebouncedChange={(v) => update({ q: v })} />
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.detail}
        </div>
      )}
      {isLoading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && (
        <>
          <CoursesTable courses={data.data} />
          <Pagination meta={data.meta} onPageChange={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
