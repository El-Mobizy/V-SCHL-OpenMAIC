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

const MAX_ENTRIES = 200;

export function setStudent(entry: CachedStudent): void {
  const all = read();
  all[entry.ulid] = entry;

  const keys = Object.keys(all);
  if (keys.length > MAX_ENTRIES) {
    // Sort by inspectedAt ascending (oldest first) and evict excess
    const sorted = keys.sort(
      (a, b) => new Date(all[a].inspectedAt).getTime() - new Date(all[b].inspectedAt).getTime(),
    );
    const toEvict = sorted.slice(0, keys.length - MAX_ENTRIES);
    for (const k of toEvict) delete all[k];
  }

  write(all);
}
