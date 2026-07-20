'use client';
import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined | null;
  sublabel?: string;
}) {
  const formatted = useMemo(() => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat().format(value);
  }, [value]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{label}</span>
      </div>
      <div
        className="text-2xl font-semibold"
        aria-label={
          value === undefined || value === null
            ? `${label} unavailable`
            : `${formatted} ${label.toLowerCase()}`
        }
      >
        {formatted}
      </div>
      {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
    </div>
  );
}
