'use client';
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentsList } from '@/lib/hooks/use-students-list';
import { MatricFilter } from '@/components/admin/matric-filter';
import { StudentsTable } from '@/components/admin/students-table';
import { Pagination } from '@/components/admin/pagination';

export default function StudentsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const matric = params.get('matric') ?? undefined;
  const page = Number(params.get('page') ?? 1);
  const limit = Number(params.get('limit') ?? 30);

  const { data, error, isLoading } = useStudentsList({ matric, page, limit });

  const update = useCallback(
    (next: Partial<{ matric: string; page: number; limit: number }>) => {
      const sp = new URLSearchParams(params.toString());
      if ('matric' in next) {
        if (next.matric) sp.set('matric', next.matric);
        else sp.delete('matric');
        sp.set('page', '1');
      }
      if (next.page != null) sp.set('page', String(next.page));
      if (next.limit != null) sp.set('limit', String(next.limit));
      router.replace(`/admin/students?${sp.toString()}`);
    },
    [router, params],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="border-l-4 border-primary pl-3">
          <h1 className="text-2xl font-semibold">Students</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              Total: {data.meta.total.toLocaleString()}
            </p>
          )}
        </div>
      </header>
      <MatricFilter initial={matric ?? ''} onDebouncedChange={(v) => update({ matric: v })} />
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.detail}
        </div>
      )}
      {isLoading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && (
        <>
          <StudentsTable students={data.data} />
          <Pagination meta={data.meta} onPageChange={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
