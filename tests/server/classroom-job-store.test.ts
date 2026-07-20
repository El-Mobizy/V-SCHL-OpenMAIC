import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createClassroomGenerationJob,
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  readClassroomGenerationJob,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';
import type { GenerateClassroomInput } from '@/lib/server/classroom-generation';

const originalFetch = global.fetch;

function mockResponse(init: { status: number; body?: unknown }): void {
  global.fetch = vi.fn(async () =>
    new Response(init.body == null ? '' : JSON.stringify(init.body), {
      status: init.status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function recordBody(overrides: Record<string, unknown> = {}) {
  return {
    job_id: 'j1',
    status: 'queued',
    step: 'queued',
    progress: 0,
    message: 'queued',
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    scenes_generated: 0,
    input_summary: {
      requirementPreview: 'r',
      language: 'en-US',
      hasPdf: false,
      pdfTextLength: 0,
      pdfImageCount: 0,
    },
    ...overrides,
  };
}

const baseInput: GenerateClassroomInput = {
  requirement: 'r',
  language: 'en-US',
};

describe('classroom-job-store HTTP contract', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('createClassroomGenerationJob POSTs /api/classroom-jobs with student uuid', async () => {
    mockResponse({ status: 201, body: recordBody() });
    await createClassroomGenerationJob('j1', baseInput, 'tok', 'stu-1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://symfony.test/api/classroom-jobs');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ job_id: 'j1', student_uuid: 'stu-1' });
    expect(body.input_summary).toBeDefined();
  });

  it('readClassroomGenerationJob returns null on 404', async () => {
    mockResponse({ status: 404 });
    const out = await readClassroomGenerationJob('j1', 'tok');
    expect(out).toBeNull();
  });

  it('readClassroomGenerationJob maps snake_case envelope', async () => {
    mockResponse({
      status: 200,
      body: recordBody({
        status: 'succeeded',
        step: 'completed',
        progress: 100,
        result_classroom_uuid: 'stg-1',
        result_url: 'http://host/classroom/stg-1',
        result_scenes_count: 3,
        total_scenes: 3,
        scenes_generated: 3,
        completed_at: '2026-04-20T00:05:00Z',
      }),
    });
    const out = await readClassroomGenerationJob('j1', 'tok');
    expect(out?.status).toBe('succeeded');
    expect(out?.totalScenes).toBe(3);
    expect(out?.result).toEqual({
      classroomId: 'stg-1',
      url: 'http://host/classroom/stg-1',
      scenesCount: 3,
    });
    expect(out?.completedAt).toBe('2026-04-20T00:05:00Z');
  });

  it('markRunning PATCHes status=running with started_at', async () => {
    mockResponse({ status: 200, body: recordBody({ status: 'running' }) });
    await markClassroomGenerationJobRunning('j1', 'tok');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://symfony.test/api/classroom-jobs/j1');
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe('running');
    expect(body.started_at).toBeDefined();
  });

  it('updateProgress PATCHes with snake_case progress fields', async () => {
    mockResponse({ status: 200, body: recordBody({ status: 'running' }) });
    await updateClassroomGenerationJobProgress(
      'j1',
      {
        step: 'generating_scenes',
        progress: 42,
        message: 'mid',
        scenesGenerated: 2,
        totalScenes: 5,
      },
      'tok',
    );
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      status: 'running',
      step: 'generating_scenes',
      progress: 42,
      scenes_generated: 2,
      total_scenes: 5,
    });
  });

  it('markSucceeded PATCHes with result fields', async () => {
    mockResponse({ status: 200, body: recordBody({ status: 'succeeded' }) });
    await markClassroomGenerationJobSucceeded(
      'j1',
      {
        id: 'stg-1',
        url: 'http://host/classroom/stg-1',
        stage: {
          id: 'stg-1',
          name: 'n',
          createdAt: 0,
          updatedAt: 0,
        },
        scenes: [],
        scenesCount: 3,
        createdAt: '2026-04-20T00:00:00Z',
      },
      'tok',
    );
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      status: 'succeeded',
      step: 'completed',
      progress: 100,
      result_classroom_uuid: 'stg-1',
      result_url: 'http://host/classroom/stg-1',
      result_scenes_count: 3,
    });
  });

  it('markFailed PATCHes with status=failed and error', async () => {
    mockResponse({ status: 200, body: recordBody({ status: 'failed' }) });
    await markClassroomGenerationJobFailed('j1', 'boom', 'tok');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      status: 'failed',
      step: 'failed',
      error: 'boom',
    });
  });
});
