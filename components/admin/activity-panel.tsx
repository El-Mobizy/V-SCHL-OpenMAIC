'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRecentStudents } from '@/lib/hooks/use-recent-students';

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return '';
  }
}

export function ActivityPanel() {
  const { list } = useRecentStudents();
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(
      (s) => (s.matric_no ?? '').toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [list, filter]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Recently inspected students</h2>
        <input
          type="search"
          placeholder="Filter by matric or name"
          className="h-7 rounded-md border bg-background px-2 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-ring"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter students"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {list.length === 0 ? (
            <>
              No students inspected yet. Find one in the <strong>Students</strong> section.
            </>
          ) : (
            'No matches for the current filter.'
          )}
        </p>
      ) : (
        <ul className="divide-y">
          {filtered.map((item) => (
            <li key={item.ulid}>
              <Link
                href={`/admin/students/${item.ulid}`}
                className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary transition-colors"
              >
                <span className="truncate">
                  <span className="font-medium">{item.matric_no ?? '—'}</span>
                  {' · '}
                  <span>{item.name}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                  <span>tokens: —</span>
                  <span>{relativeTime(item.inspectedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
