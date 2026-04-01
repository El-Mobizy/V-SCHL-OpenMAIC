// lib/api/symfony-client.ts
import type {
  Course,
  CourseProgress,
  SchoolBranding,
  TokenQuota,
} from '@/lib/types/school';

const SYMFONY_URL = process.env.NEXT_PUBLIC_SYMFONY_API_URL ?? '';

/** Get access token from auth store for direct Symfony calls */
function getAccessToken(): string {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return '';
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken ?? '';
  } catch {
    return '';
  }
}

async function symfonyFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${SYMFONY_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Symfony API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/** Fetch courses assigned to a student */
export function fetchCourses(studentId: number): Promise<Course[]> {
  return symfonyFetch(`/api/courses?student=${studentId}`);
}

/** Fetch a single course detail */
export function fetchCourse(courseId: number): Promise<Course> {
  return symfonyFetch(`/api/courses/${courseId}`);
}

/** Fetch saved syllabus for a student's course (null if not yet generated) */
export async function fetchSyllabus(courseId: number, studentId: number): Promise<unknown | null> {
  try {
    return await symfonyFetch(`/api/courses/${courseId}/syllabus?student=${studentId}`);
  } catch {
    return null;
  }
}

/** Save AI-generated syllabus to Symfony */
export function saveSyllabus(
  courseId: number,
  studentId: number,
  content: unknown,
): Promise<void> {
  return symfonyFetch(`/api/courses/${courseId}/syllabus`, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, content }),
  });
}

/** Fetch student progress for a course */
export function fetchProgress(studentId: number, courseId: number): Promise<CourseProgress> {
  return symfonyFetch(`/api/progress?student=${studentId}&course=${courseId}`);
}

/** Update student progress */
export function updateProgress(
  studentId: number,
  courseId: number,
  sceneIndex: number,
): Promise<void> {
  return symfonyFetch('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, course_id: courseId, scene_index: sceneIndex }),
  });
}

/** Fetch school branding */
export function fetchBranding(): Promise<SchoolBranding> {
  return symfonyFetch('/api/school/branding');
}

/** Fetch token quota (called once on login, cached by token-counter) */
export function fetchTokenQuota(studentId: number): Promise<TokenQuota> {
  return symfonyFetch(`/api/token-usage/${studentId}/quota`);
}
