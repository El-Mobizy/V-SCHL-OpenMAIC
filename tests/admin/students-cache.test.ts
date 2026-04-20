import { describe, it, expect, beforeEach } from 'vitest';
import { getStudent, setStudent } from '@/lib/storage/students-cache';
import type { CachedStudent } from '@/lib/storage/students-cache';

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
});
