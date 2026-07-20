import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRecentStudents, type RecentStudent } from '@/lib/hooks/use-recent-students';

function makeStudent(ulid: string, overrides: Partial<RecentStudent> = {}): RecentStudent {
  return {
    ulid,
    matric_no: `MAT-${ulid.slice(-4)}`,
    name: `Student ${ulid.slice(-4)}`,
    inspectedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useRecentStudents', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('push adds entry to list', () => {
    const { result } = renderHook(() => useRecentStudents());
    const s = makeStudent('01H1A2B3C4D5E6F7G8H9J0K1L1');
    act(() => {
      result.current.push(s);
    });
    expect(result.current.list).toHaveLength(1);
    expect(result.current.list[0].ulid).toBe(s.ulid);
  });

  it('push with existing ULID moves it to front (LRU dedupe)', () => {
    const { result } = renderHook(() => useRecentStudents());
    const a = makeStudent('01AAAAAAAAAAAAAAAAAAAAAAAAA');
    const b = makeStudent('01BBBBBBBBBBBBBBBBBBBBBBBBB');
    act(() => {
      result.current.push(a);
    });
    act(() => {
      result.current.push(b);
    });
    act(() => {
      result.current.push(a);
    });
    expect(result.current.list[0].ulid).toBe(a.ulid);
    expect(result.current.list).toHaveLength(2);
  });

  it('list caps at 10 entries', () => {
    const { result } = renderHook(() => useRecentStudents());
    for (let i = 0; i < 12; i++) {
      const ulid = `01${String(i).padStart(25, '0')}`;
      act(() => {
        result.current.push(makeStudent(ulid));
      });
    }
    expect(result.current.list.length).toBe(10);
  });

  it('sessionStorage survives simulated reload (second hook reads same storage)', async () => {
    const { result: r1 } = renderHook(() => useRecentStudents());
    const s = makeStudent('01PERSISTULID000000000000AA');
    act(() => {
      r1.current.push(s);
    });

    // Simulate a new hook instance reading the same sessionStorage
    const { result: r2 } = renderHook(() => useRecentStudents());
    // Wait for the useEffect to fire and load from sessionStorage
    await waitFor(() => {
      expect(r2.current.list.some((e) => e.ulid === s.ulid)).toBe(true);
    });
  });
});
