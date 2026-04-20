'use client';
import { useCallback, useState } from 'react';

const KEY = 'admin:recent-students';
export type RecentStudent = {
  ulid: string;
  matric_no: string | null;
  name: string;
  inspectedAt: string;
};

function read(): RecentStudent[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
function write(v: RecentStudent[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(v));
}

export function useRecentStudents() {
  // Lazy initializer reads sessionStorage on first client render (no re-render cascade).
  const [list, setList] = useState<RecentStudent[]>(read);
  const push = useCallback((s: RecentStudent) => {
    setList((prev) => {
      const next = [s, ...prev.filter((p) => p.ulid !== s.ulid)].slice(0, 10);
      write(next);
      return next;
    });
  }, []);
  return { list, push };
}
