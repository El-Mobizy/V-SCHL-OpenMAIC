'use client';
import { useEffect, useState } from 'react';
import { getStudent } from '@/lib/storage/students-cache';
import { useRecentStudents } from '@/lib/hooks/use-recent-students';
import type { StudentStats } from '@/lib/types/school';

interface Props {
  ulid: string;
  stats: StudentStats | null;
}

function truncateUlid(ulid: string): string {
  if (ulid.length <= 10) return ulid;
  return `${ulid.slice(0, 6)}…${ulid.slice(-4)}`;
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StudentStatsView({ ulid, stats }: Props) {
  const { push } = useRecentStudents();
  const [label, setLabel] = useState<{ primary: string; secondary?: string }>({
    primary: `Student ${truncateUlid(ulid)}`,
  });

  useEffect(() => {
    const cached = getStudent(ulid);
    if (cached) {
      const primary = cached.matric_no ?? truncateUlid(ulid);
      const secondary = `${cached.firstname} ${cached.lastname}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is an external system; syncing label from cache on mount is the intended pattern
      setLabel({ primary, secondary });
      push({
        ulid,
        matric_no: cached.matric_no,
        name: `${cached.firstname} ${cached.lastname}`,
        inspectedAt: new Date().toISOString(),
      });
    }
  }, [ulid, push]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{label.primary}</h1>
        {label.secondary && <p className="text-sm text-muted-foreground">{label.secondary}</p>}
      </div>

      {!stats && (
        <p className="text-sm text-muted-foreground">No stats available for this student.</p>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card
            title="Token quota"
            value={stats.tokens_used.toLocaleString()}
            sub={`of ${stats.tokens_max.toLocaleString()} (resets ${stats.tokens_reset_date})`}
          />
          <Card
            title="Course activity"
            value={`${stats.courses_in_progress} in progress`}
            sub={`${stats.courses_completed} completed`}
          />
          <Card
            title="This month"
            value={stats.tokens_this_month.toLocaleString()}
            sub="tokens used"
          />
          <Card
            title="Last activity"
            value={
              stats.last_activity_at
                ? new Date(stats.last_activity_at).toLocaleDateString()
                : 'No activity yet'
            }
          />
        </div>
      )}
    </div>
  );
}
