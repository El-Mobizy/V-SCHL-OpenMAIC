const SYMFONY_API_URL = process.env.SYMFONY_API_URL!;

/** Server-side Symfony fetch — forwards JWT from the original request */
export async function symfonyServerFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${SYMFONY_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Symfony server error: ${res.status}`);
  }

  return res.json();
}

/** Save syllabus from server-side (after generation) */
export function saveSyllabusServer(
  courseId: number,
  studentId: number,
  content: unknown,
  accessToken: string,
): Promise<void> {
  return symfonyServerFetch(`/api/courses/${courseId}/syllabus`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, content }),
  });
}
