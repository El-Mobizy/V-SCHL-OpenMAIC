import { describe, it, expect } from 'vitest';
import { buildQuery } from '@/lib/api/symfony';

describe('buildQuery', () => {
  it('encodes reserved characters in values', () => {
    expect(buildQuery({ matric: 'CS/2024/001' })).toBe('matric=CS%2F2024%2F001');
  });
  it('drops undefined values', () => {
    expect(buildQuery({ page: 2, matric: undefined })).toBe('page=2');
  });
  it('coerces numbers to strings', () => {
    expect(buildQuery({ page: 1, limit: 30 })).toBe('page=1&limit=30');
  });
  it('returns empty string for empty object', () => {
    expect(buildQuery({})).toBe('');
  });
});
