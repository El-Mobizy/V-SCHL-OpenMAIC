import { beforeEach, describe, expect, it } from 'vitest';
import {
  getModelOverride,
  setModelOverride,
  clearModelOverride,
  modelOverrideKey,
} from '@/lib/stores/model-override';

describe('model-override store', () => {
  const studentId = '01HSTUDENT00000000000000AB';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no override is stored', () => {
    expect(getModelOverride(studentId)).toBeNull();
  });

  it('persists and reads an override', () => {
    setModelOverride(studentId, 'anthropic:claude-opus-4-7');
    expect(getModelOverride(studentId)).toBe('anthropic:claude-opus-4-7');
  });

  it('is scoped per student', () => {
    setModelOverride(studentId, 'openai:gpt-4o-mini');
    setModelOverride('01HSTUDENTXX1111111111111X', 'anthropic:claude-sonnet-4-6');
    expect(getModelOverride(studentId)).toBe('openai:gpt-4o-mini');
  });

  it('clears an override', () => {
    setModelOverride(studentId, 'openai:gpt-4o-mini');
    clearModelOverride(studentId);
    expect(getModelOverride(studentId)).toBeNull();
  });

  it('uses a stable namespaced key', () => {
    expect(modelOverrideKey('abc')).toBe('model-override:abc');
  });

  it('is a no-op without a studentId', () => {
    setModelOverride('', 'openai:gpt-4o-mini');
    expect(getModelOverride('')).toBeNull();
  });
});
