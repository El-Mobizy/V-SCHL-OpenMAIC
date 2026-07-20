import type { SyllabusTopic } from '@/lib/types/school';

function symfonyBaseUrl(): string {
  return process.env.SYMFONY_API_URL || '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export async function fetchSyllabusTopicsForPrompt(
  courseUuid: string,
  accessToken: string,
): Promise<Array<{ title: string; description: string }>> {
  try {
    const res = await fetch(
      `${symfonyBaseUrl()}/api/courses/${encodeURIComponent(courseUuid)}/syllabus-topics`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { data: SyllabusTopic[] };
    return [...body.data]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ title: t.title, description: stripHtml(t.description) }));
  } catch {
    return [];
  }
}
