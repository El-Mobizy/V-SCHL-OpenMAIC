'use client';
import { useCallback, useEffect, useState } from 'react';

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
  const [list, setList] = useState<RecentStudent[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is an external system; syncing it into state on mount is the intended use-case for useEffect
    setList(read());
  }, []);
  const push = useCallback((s: RecentStudent) => {
    setList((prev) => {
      const next = [s, ...prev.filter((p) => p.ulid !== s.ulid)].slice(0, 10);
      write(next);
      return next;
    });
  }, []);
  return { list, push };
}
