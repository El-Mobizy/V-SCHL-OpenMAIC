const KEY = 'admin:students-cache';
export type CachedStudent = {
  ulid: string;
  matric_no: string | null;
  firstname: string;
  lastname: string;
  inspectedAt: string;
};

function read(): Record<string, CachedStudent> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function write(v: Record<string, CachedStudent>) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(v));
}

export function getStudent(ulid: string): CachedStudent | null {
  return read()[ulid] ?? null;
}

export function setStudent(entry: CachedStudent): void {
  const all = read();
  all[entry.ulid] = entry;
  write(all);
}
