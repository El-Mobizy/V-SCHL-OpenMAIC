import { describe, it, expect, beforeEach } from 'vitest';
import { getStudent, setStudent } from '@/lib/storage/students-cache';
import type { CachedStudent } from '@/lib/storage/students-cache';

// Helper to read all entries from sessionStorage directly for the eviction test
function readAll(): Record<string, CachedStudent> {
  try {
    return JSON.parse(sessionStorage.getItem('admin:students-cache') ?? '{}');
  } catch {
    return {};
  }
}

const SAMPLE: CachedStudent = {
  ulid: '01HZQK1234567890ABCDEFGHIJ',
  matric_no: 'CS/2021/001',
  firstname: 'Alice',
  lastname: 'Obi',
  inspectedAt: '2026-04-20T10:00:00.000Z',
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('students-cache', () => {
  it('returns null on cache miss', () => {
    expect(getStudent('01HZQK1234567890ABCDEFGHIJ')).toBeNull();
  });

  it('setStudent + getStudent round-trip', () => {
    setStudent(SAMPLE);
    const result = getStudent(SAMPLE.ulid);
    expect(result).toEqual(SAMPLE);
  });

  it('does not throw when called (SSR safety — window is present in jsdom but guard is exercised)', () => {
    expect(() => {
      getStudent('nonexistent');
      setStudent(SAMPLE);
      getStudent(SAMPLE.ulid);
    }).not.toThrow();
  });

  it('caps cache at 200 entries and evicts the oldest by inspectedAt', () => {
    // Insert 205 entries with ascending inspectedAt timestamps
    for (let i = 0; i < 205; i++) {
      const padded = String(i).padStart(3, '0');
      const entry: CachedStudent = {
        ulid: `ULID${padded}AAAAAAAAAAAAAAAAAAA`,
        matric_no: `CS/2021/${padded}`,
        firstname: `First${padded}`,
        lastname: `Last${padded}`,
        // Oldest entries have lower i → lower timestamp
        inspectedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      };
      setStudent(entry);
    }

    const all = readAll();
    expect(Object.keys(all).length).toBe(200);

    // The 5 oldest entries (i = 0..4) must have been evicted
    for (let i = 0; i < 5; i++) {
      const padded = String(i).padStart(3, '0');
      expect(all[`ULID${padded}AAAAAAAAAAAAAAAAAAA`]).toBeUndefined();
    }

    // The 200 newest entries (i = 5..204) must still be present
    for (let i = 5; i < 205; i++) {
      const padded = String(i).padStart(3, '0');
      expect(all[`ULID${padded}AAAAAAAAAAAAAAAAAAA`]).toBeDefined();
    }
  });
});
