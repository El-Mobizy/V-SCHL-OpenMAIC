import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/server/request-auth', () => ({
  requireStudentAuth: vi.fn(() => ({ studentId: 'stu-1', accessToken: 'tok-abc' })),
}));
vi.mock('@/lib/server/admin-default-model', () => ({
  resolveClassroomModelString: vi.fn(async () => 'openai:gpt-5.4'),
}));
vi.mock('@/lib/server/classroom-job-store', () => ({
  createClassroomGenerationJob: vi.fn(async () => ({
    id: 'job-1',
    status: 'queued',
    step: 'queued',
    message: 'queued',
  })),
}));
vi.mock('@/lib/server/classroom-job-runner', () => ({
  runClassroomGenerationJob: vi.fn(),
}));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (fn: () => void) => fn() };
});

import { POST } from '@/app/api/generate-classroom/route';
import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';

const originalFetch = global.fetch;

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/generate-classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/generate-classroom with courseUuid', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('fetches syllabus topics and attaches them to the job input', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              uuid: 't2',
              title: 'Second',
              description: '<p>Second <em>topic</em></p>',
              position: 2,
            },
            {
              uuid: 't1',
              title: 'First',
              description: '<p>First topic</p>',
              position: 1,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makePostRequest({
      requirement: 'Teach me algebra',
      courseUuid: '01HZQK0123456789COURSEABCD',
    });
    const res = await POST(req);

    expect(res.status).toBe(202);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'http://symfony.test/api/courses/01HZQK0123456789COURSEABCD/syllabus-topics',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc');

    expect(createClassroomGenerationJob).toHaveBeenCalledTimes(1);
    const callArgs = (createClassroomGenerationJob as ReturnType<typeof vi.fn>).mock.calls[0];
    const input = callArgs[1] as { syllabusTopics?: Array<{ title: string; description: string }> };
    expect(input.syllabusTopics).toEqual([
      { title: 'First', description: 'First topic' },
      { title: 'Second', description: 'Second topic' },
    ]);
  });

  it('does not fetch topics when courseUuid is missing', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makePostRequest({ requirement: 'Freeform request' });
    const res = await POST(req);

    expect(res.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();

    const callArgs = (createClassroomGenerationJob as ReturnType<typeof vi.fn>).mock.calls[0];
    const input = callArgs[1] as { syllabusTopics?: unknown };
    expect(input.syllabusTopics).toBeUndefined();
  });

  it('succeeds when the backend returns 404 (no topics attached)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const req = makePostRequest({
      requirement: 'Teach me algebra',
      courseUuid: '01HZQK0123456789COURSEABCD',
    });
    const res = await POST(req);

    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = (createClassroomGenerationJob as ReturnType<typeof vi.fn>).mock.calls[0];
    const input = callArgs[1] as { syllabusTopics?: unknown };
    expect(input.syllabusTopics).toBeUndefined();
  });
});
