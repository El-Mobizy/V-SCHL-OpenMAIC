import { toApiError } from '@/lib/api/errors';
import type {
  SchoolUser, Course, CourseProgress, SchoolBranding,
  TokenQuota, AvailableProvider, ApiKey, UsageEntry,
} from '@/lib/types/school';

async function bff<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith('/api/') ? path : `/api/symfony${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      bff<{ user: SchoolUser }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      }),
    logout: () => bff<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    me:     () => bff<{ user: SchoolUser }>('/api/auth/me'),
  },
  courses: {
    list: (studentId: number) => bff<Course[]>(`/courses?student=${studentId}`),
    get:  (courseId: number)  => bff<Course>(`/courses/${courseId}`),
    syllabus: {
      get:  (courseId: number, studentId: number) =>
        bff<unknown>(`/courses/${courseId}/syllabus?student=${studentId}`),
      save: (courseId: number, studentId: number, content: unknown) =>
        bff<{ ok: true }>(`/courses/${courseId}/syllabus`, {
          method: 'POST', body: JSON.stringify({ student_id: studentId, content }),
        }),
    },
    progress: {
      get: (studentId: number, courseId: number) =>
        bff<CourseProgress>(`/progress?student=${studentId}&course=${courseId}`),
      update: (studentId: number, courseId: number, sceneIndex: number) =>
        bff<{ ok: true }>(`/progress`, {
          method: 'POST',
          body: JSON.stringify({ student_id: studentId, course_id: courseId, scene_index: sceneIndex }),
        }),
    },
  },
  usage: {
    quota:  (studentId: number) => bff<TokenQuota>(`/token-usage/${studentId}/quota`),
    report: (studentId: number, entries: UsageEntry[]) =>
      bff<{ ok: true }>(`/token-usage`, {
        method: 'POST', body: JSON.stringify({ student_id: studentId, entries }),
      }),
  },
  admin: {
    keys: {
      list:   () => bff<ApiKey[]>(`/admin/api-keys`),
      upsert: (k: ApiKey) =>
        bff<{ ok: true }>(`/admin/api-keys`, { method: 'POST', body: JSON.stringify(k) }),
      remove: (provider: string) =>
        bff<{ ok: true }>(`/admin/api-keys/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
    },
  },
  providers: {
    list: () => bff<AvailableProvider[]>(`/providers`),
  },
  school: {
    branding: () => bff<SchoolBranding>(`/school/branding`),
  },
};

export type Api = typeof api;
