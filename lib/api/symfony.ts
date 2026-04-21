import { toApiError } from '@/lib/api/errors';
import type {
  SchoolUser,
  Course,
  CourseProgress,
  SchoolBranding,
  TokenQuota,
  AvailableProvider,
  ApiKey,
  ProviderCatalogEntry,
  UsageEntry,
  PaginatedResponse,
  Student,
  AdminStats,
  StudentStats,
  ClassroomRecord,
  ClassroomSummary,
  BulkQuotaRequest,
  BulkQuotaResult,
  AdminTokenUsageRow,
  SyllabusTopic,
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

export async function bffUpload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  const target = path.startsWith('/api/') ? path : `/api/symfony${path}`;
  const res = await fetch(target, { method: 'POST', credentials: 'include', body: fd });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

// Branding assets (logo, favicon) are served by Symfony's public/uploads/, not Next.
// Prepend the Symfony origin when the path is backend-hosted; pass through Next-local
// assets (e.g. /logo-horizontal.png) and already-absolute URLs untouched.
export function resolveBrandingAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith('/uploads/')) {
    return `${process.env.NEXT_PUBLIC_SYMFONY_API_URL ?? ''}${path}`;
  }
  return path;
}

export function buildQuery(opts: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined) continue;
    p.set(k, String(v));
  }
  return p.toString();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      bff<{ user: SchoolUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => bff<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    me: () => bff<{ user: SchoolUser }>('/api/auth/me'),
  },

  courses: {
    list: (
      opts: { studentUuid?: string; q?: string; page?: number; limit?: number } = {},
    ) => {
      const qs = buildQuery({
        student: opts.studentUuid,
        q: opts.q,
        page: opts.page,
        limit: opts.limit,
      });
      return bff<PaginatedResponse<Course>>(`/courses${qs ? `?${qs}` : ''}`);
    },
    get: (courseUuid: string, studentUuid?: string) => {
      const qs = studentUuid ? `?student=${studentUuid}` : '';
      return bff<Course>(`/courses/${courseUuid}${qs}`);
    },
    syllabus: {
      get: (courseUuid: string, studentUuid: string) =>
        bff<unknown>(`/courses/${courseUuid}/syllabus?student=${studentUuid}`),
      save: (courseUuid: string, studentUuid: string, content: unknown) =>
        bff<{ ok: true }>(`/courses/${courseUuid}/syllabus`, {
          method: 'POST',
          body: JSON.stringify({ student_uuid: studentUuid, content }),
        }),
    },
    syllabusTopics: {
      list: (courseUuid: string, studentUuid?: string) => {
        const qs = studentUuid ? `?student=${studentUuid}` : '';
        return bff<{ data: SyllabusTopic[] }>(
          `/courses/${courseUuid}/syllabus-topics${qs}`,
        );
      },
    },
    progress: {
      get: (studentUuid: string, courseUuid: string) =>
        bff<CourseProgress>(`/progress?student=${studentUuid}&course=${courseUuid}`),
      update: (studentUuid: string, courseUuid: string, sceneIndex: number) =>
        bff<{ ok: true }>(`/progress`, {
          method: 'POST',
          body: JSON.stringify({
            student_uuid: studentUuid,
            course_uuid: courseUuid,
            scene_index: sceneIndex,
          }),
        }),
    },
  },

  usage: {
    quota: (studentUuid: string) => bff<TokenQuota>(`/token-usage/${studentUuid}/quota`),
    report: (studentUuid: string, entries: UsageEntry[]) =>
      bff<{ ok: true }>(`/token-usage`, {
        method: 'POST',
        body: JSON.stringify({ student_uuid: studentUuid, entries }),
      }),
  },

  admin: {
    keys: {
      list: () => bff<ApiKey[]>(`/admin/api-keys`),
      upsert: (k: Partial<ApiKey> & { provider: string }) =>
        bff<{ ok: true }>(`/admin/api-keys`, {
          method: 'POST',
          body: JSON.stringify(k),
        }),
      setDefault: (args: { provider: string; schoolUuid?: string }) =>
        bff<{ ok: true }>(`/admin/api-keys/default`, {
          method: 'PUT',
          body: JSON.stringify({
            provider: args.provider,
            ...(args.schoolUuid ? { school_uuid: args.schoolUuid } : {}),
          }),
        }),
      remove: (provider: string, opts: { schoolUuid?: string } = {}) => {
        const qs = opts.schoolUuid ? `?school_uuid=${encodeURIComponent(opts.schoolUuid)}` : '';
        return bff<{ ok: true }>(
          `/admin/api-keys/${encodeURIComponent(provider)}${qs}`,
          { method: 'DELETE' },
        );
      },
    },
    catalog: {
      list: () => bff<ProviderCatalogEntry[]>(`/admin/provider-catalog`),
    },
    stats: () => bff<AdminStats>(`/admin/stats`),
    tokenUsage: {
      list: (opts: { page?: number; limit?: number; search?: string } = {}) => {
        const qs = buildQuery({
          page: opts.page,
          limit: opts.limit,
          search: opts.search,
        });
        return bff<PaginatedResponse<AdminTokenUsageRow>>(
          `/admin/token-usage${qs ? `?${qs}` : ''}`,
        );
      },
    },
    quota: {
      upsert: (studentUuid: string, patch: Partial<TokenQuota>) =>
        bff<TokenQuota>(`/token-usage/${studentUuid}/quota`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        }),
      setDefault: (body: BulkQuotaRequest) =>
        bff<BulkQuotaResult>(`/admin/quota/default`, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
    branding: {
      update: (
        patch: Partial<
          Pick<SchoolBranding, 'school_name' | 'primary_color' | 'secondary_color' | 'accent_color'>
        >,
      ) =>
        bff<SchoolBranding>(`/admin/school/branding`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        }),
      uploadLogo: (file: File) => bffUpload<SchoolBranding>(`/admin/school/branding/logo`, file),
      uploadFavicon: (file: File) =>
        bffUpload<SchoolBranding>(`/admin/school/branding/favicon`, file),
    },
  },

  students: {
    list: (opts: { matric?: string; page?: number; limit?: number } = {}) => {
      const qs = buildQuery({ matric: opts.matric, page: opts.page, limit: opts.limit });
      return bff<PaginatedResponse<Student>>(`/students${qs ? `?${qs}` : ''}`);
    },
    stats: (ulid: string) => bff<StudentStats>(`/students/${ulid}/stats`),
  },

  providers: { list: () => bff<AvailableProvider[]>(`/providers`) },
  school: { branding: () => bff<SchoolBranding>(`/school/branding`) },

  classrooms: {
    get: (uuid: string) => bff<ClassroomRecord>(`/classrooms/${uuid}`),
    upsert: (payload: Partial<ClassroomRecord> & { uuid: string }) =>
      bff<{ ok: true; uuid: string }>(`/classrooms`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    remove: (uuid: string) =>
      bff<{ ok: true }>(`/classrooms/${uuid}`, { method: 'DELETE' }),
    list: (
      opts: {
        studentUuid?: string;
        courseUuid?: string;
        page?: number;
        limit?: number;
      } = {},
    ) => {
      const qs = buildQuery({
        student: opts.studentUuid,
        course: opts.courseUuid,
        page: opts.page,
        limit: opts.limit,
      });
      return bff<PaginatedResponse<ClassroomSummary>>(
        `/classrooms${qs ? `?${qs}` : ''}`,
      );
    },
  },
};

export type Api = typeof api;
