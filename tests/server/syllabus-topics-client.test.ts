import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSyllabusTopicsForPrompt } from '@/lib/server/syllabus-topics-client';

const originalFetch = global.fetch;

function mockJson(status: number, body: unknown) {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('fetchSyllabusTopicsForPrompt', () => {
  beforeEach(() => {
    process.env.SYMFONY_API_URL = 'http://symfony.test';
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches topics, strips HTML, sorts by position', async () => {
    mockJson(200, {
      data: [
        { uuid: 't2', title: 'B', description: '<p>Two</p>', position: 2 },
        {
          uuid: 't1',
          title: 'A',
          description: '<p>One <strong>bold</strong></p>',
          position: 1,
        },
      ],
    });
    const result = await fetchSyllabusTopicsForPrompt(
      '01HZQK0123456789COURSEABCD',
      'tok',
    );
    expect(result).toEqual([
      { title: 'A', description: 'One bold' },
      { title: 'B', description: 'Two' },
    ]);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'http://symfony.test/api/courses/01HZQK0123456789COURSEABCD/syllabus-topics',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('returns [] on 404', async () => {
    mockJson(404, { error: 'Course not found' });
    expect(
      await fetchSyllabusTopicsForPrompt('01HZQK0123456789COURSEABCD', 'tok'),
    ).toEqual([]);
  });

  it('returns [] on non-2xx without throwing', async () => {
    mockJson(500, { error: 'boom' });
    expect(
      await fetchSyllabusTopicsForPrompt('01HZQK0123456789COURSEABCD', 'tok'),
    ).toEqual([]);
  });

  it('returns [] when fetch itself rejects', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(
      await fetchSyllabusTopicsForPrompt('01HZQK0123456789COURSEABCD', 'tok'),
    ).toEqual([]);
  });
});
