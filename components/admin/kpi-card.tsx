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
        <Icon className="h-4 w-4" />
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
