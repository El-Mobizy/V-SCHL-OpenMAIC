import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';
import type { ClassroomRecord } from '@/lib/types/school';

function symfonyBaseUrl(): string {
  return process.env.SYMFONY_API_URL || '';
}

/**
 * Root directory for classroom-scoped media (images, audio, video).
 * Classroom JSON itself now lives in Symfony (see persistClassroom/readClassroom).
 * Media blobs remain on the filesystem until a separate plan migrates them.
 */
export const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureClassroomsDir() {
  await ensureDir(CLASSROOMS_DIR);
}

export function buildRequestOrigin(req: NextRequest): string {
  return req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin;
}

export interface PersistedClassroomData {
  id: string;
  stage: Stage;
  scenes: Scene[];
  createdAt: string;
  /** Optional ULID of the course this classroom belongs to; null/absent = free-standing. */
  courseUuid: string | null;
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function recordToPersisted(record: ClassroomRecord): PersistedClassroomData {
  return {
    id: record.uuid,
    stage: record.stage,
    scenes: record.scenes,
    createdAt: record.created_at,
    courseUuid: record.course_uuid ?? null,
  };
}

export async function readClassroom(
  id: string,
  accessToken: string,
): Promise<PersistedClassroomData | null> {
  const res = await fetch(`${symfonyBaseUrl()}/api/classrooms/${encodeURIComponent(id)}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Read classroom failed: ${res.status}`);
  }
  const body = (await res.json()) as ClassroomRecord;
  return recordToPersisted(body);
}

export async function persistClassroom(
  data: { id: string; stage: Stage; scenes: Scene[] },
  baseUrl: string,
  opts: { studentUuid?: string; courseUuid?: string; accessToken: string },
): Promise<PersistedClassroomData & { url: string }> {
  const payload: Record<string, unknown> = {
    uuid: data.id,
    name: data.stage.name || data.id,
    stage: data.stage,
    scenes: data.scenes,
  };
  if (opts.studentUuid) payload.student_uuid = opts.studentUuid;
  if (opts.courseUuid) payload.course_uuid = opts.courseUuid;

  const res = await fetch(`${symfonyBaseUrl()}/api/classrooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Persist classroom failed: ${res.status}`);
  }

  return {
    id: data.id,
    stage: data.stage,
    scenes: data.scenes,
    createdAt: new Date().toISOString(),
    courseUuid: opts.courseUuid ?? null,
    url: `${baseUrl}/classroom/${data.id}`,
  };
}
