export function modelOverrideKey(studentId: string): string {
  return `model-override:${studentId}`;
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getModelOverride(studentId: string): string | null {
  if (!studentId) return null;
  const s = safeStorage();
  if (!s) return null;
  const v = s.getItem(modelOverrideKey(studentId));
  return v && v.length > 0 ? v : null;
}

export function setModelOverride(studentId: string, modelString: string): void {
  if (!studentId) return;
  const s = safeStorage();
  if (!s) return;
  s.setItem(modelOverrideKey(studentId), modelString);
}

export function clearModelOverride(studentId: string): void {
  if (!studentId) return;
  const s = safeStorage();
  if (!s) return;
  s.removeItem(modelOverrideKey(studentId));
}
