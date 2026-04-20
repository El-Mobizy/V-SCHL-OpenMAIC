'use client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginatedMeta } from '@/lib/types/school';

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginatedMeta;
  onPageChange: (page: number) => void;
}) {
  const { page, total_pages } = meta;
  return (
    <div className="flex items-center gap-2 justify-end py-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {Math.max(total_pages, 1)}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= total_pages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
