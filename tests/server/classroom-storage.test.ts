import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistClassroom,
  readClassroom,
} from '@/lib/server/classroom-storage';
import type { Scene, Stage } from '@/lib/types/stage';

const originalFetch = global.fetch;

function mockResponse(init: { status: number; body?: unknown }): void {
  global.fetch = vi.fn(async () =>
    new Response(init.body == null ? '' : JSON.stringify(init.body), {
      status: init.status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

const stage: Stage = {
  id: 'stg-1',
  name: 'Intro to Rust',
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
  language: 'en-US',
  style: 'interactive',
};

const scenes: Scene[] = [];

describe('persistClassroom', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('POSTs the classroom to Symfony with the bearer token', async () => {
    mockResponse({ status: 201, body: { ok: true, uuid: 'stg-1' } });

    const out = await persistClassroom(
      { id: 'stg-1', stage, scenes },
      'http://host',
      { accessToken: 'tok', studentUuid: 'stu-1', courseUuid: 'crs-1' },
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://symfony.test/api/classrooms');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      uuid: 'stg-1',
      name: 'Intro to Rust',
      student_uuid: 'stu-1',
      course_uuid: 'crs-1',
    });

    expect(out.id).toBe('stg-1');
    expect(out.url).toBe('http://host/classroom/stg-1');
  });

  it('throws when Symfony responds non-ok', async () => {
    mockResponse({ status: 500 });
    await expect(
      persistClassroom({ id: 'stg-1', stage, scenes }, 'http://host', {
        accessToken: 'tok',
      }),
    ).rejects.toThrow(/500/);
  });

  it('omits student_uuid and course_uuid when not provided', async () => {
    mockResponse({ status: 201, body: { ok: true, uuid: 'stg-1' } });
    await persistClassroom({ id: 'stg-1', stage, scenes }, 'http://host', {
      accessToken: 'tok',
    });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(init.body as string);
    expect(body.student_uuid).toBeUndefined();
    expect(body.course_uuid).toBeUndefined();
  });
});

describe('readClassroom', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null on 404', async () => {
    mockResponse({ status: 404 });
    const out = await readClassroom('stg-1', 'tok');
    expect(out).toBeNull();
  });

  it('maps the Symfony envelope to PersistedClassroomData', async () => {
    mockResponse({
      status: 200,
      body: {
        uuid: 'stg-1',
        name: 'Intro to Rust',
        student_uuid: 'stu-1',
        course_uuid: 'crs-1',
        stage,
        scenes,
        scene_count: 0,
        created_at: '2026-04-20T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
      },
    });
    const out = await readClassroom('stg-1', 'tok');
    expect(out).toEqual({
      id: 'stg-1',
      stage,
      scenes,
      createdAt: '2026-04-20T00:00:00Z',
      courseUuid: 'crs-1',
    });
  });

  it('propagates the bearer token', async () => {
    mockResponse({
      status: 200,
      body: {
        uuid: 'stg-1',
        name: 'Intro',
        student_uuid: 'stu-1',
        course_uuid: null,
        stage,
        scenes,
        scene_count: 0,
        created_at: '2026-04-20T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
      },
    });
    await readClassroom('stg-1', 'tok-abc');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-abc');
  });

  it('throws on other error codes', async () => {
    mockResponse({ status: 500 });
    await expect(readClassroom('stg-1', 'tok')).rejects.toThrow(/500/);
  });
});
