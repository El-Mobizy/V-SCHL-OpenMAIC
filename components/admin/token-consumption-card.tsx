'use client';
import { useMemo } from 'react';

interface Props {
  today: number | undefined | null;
  week: number | undefined | null;
  month: number | undefined | null;
}

function formatNum(v: number | undefined | null): string {
  if (v === undefined || v === null) return '—';
  return new Intl.NumberFormat().format(v);
}

function barWidth(v: number | undefined | null, max: number): number {
  if (v === undefined || v === null || max === 0) return 0;
  return (v / max) * 100;
}

const ROWS: { key: keyof Props; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

export function TokenConsumptionCard({ today, week, month }: Props) {
  const max = useMemo(() => {
    const values = [today, week, month].filter((v): v is number => typeof v === 'number');
    return Math.max(...values, 0) || 1;
  }, [today, week, month]);

  const props = { today, week, month };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="text-sm font-medium">Token Consumption</div>
      <div className="space-y-3" role="presentation">
        {ROWS.map(({ key, label }) => {
          const val = props[key];
          const width = barWidth(val, max);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono text-xs">{formatNum(val)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Screen-reader accessible table fallback */}
      <table className="sr-only">
        <caption>Token Consumption</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Tokens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Today</td>
            <td>{formatNum(today)}</td>
          </tr>
          <tr>
            <td>This week</td>
            <td>{formatNum(week)}</td>
          </tr>
          <tr>
            <td>This month</td>
            <td>{formatNum(month)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
