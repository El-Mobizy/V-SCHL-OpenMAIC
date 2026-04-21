import type {
  ClassroomGenerationProgress,
  ClassroomGenerationStep,
  GenerateClassroomInput,
  GenerateClassroomResult,
} from '@/lib/server/classroom-generation';

function symfonyBaseUrl(): string {
  return process.env.SYMFONY_API_URL || '';
}

export type ClassroomGenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface ClassroomGenerationJob {
  id: string;
  status: ClassroomGenerationJobStatus;
  step: ClassroomGenerationStep | 'queued' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  inputSummary: {
    requirementPreview: string;
    language: string;
    hasPdf: boolean;
    pdfTextLength: number;
    pdfImageCount: number;
  };
  scenesGenerated: number;
  totalScenes?: number;
  result?: {
    classroomId: string;
    url: string;
    scenesCount: number;
  };
  error?: string;
}

interface SymfonyClassroomJobRecord {
  job_id: string;
  status: ClassroomGenerationJobStatus;
  step: string;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  input_summary?: ClassroomGenerationJob['inputSummary'] | null;
  scenes_generated: number;
  total_scenes?: number | null;
  result_classroom_uuid?: string | null;
  result_url?: string | null;
  result_scenes_count?: number | null;
  error?: string | null;
}

function buildInputSummary(input: GenerateClassroomInput): ClassroomGenerationJob['inputSummary'] {
  return {
    requirementPreview:
      input.requirement.length > 200 ? `${input.requirement.slice(0, 197)}...` : input.requirement,
    language: input.language || 'zh-CN',
    hasPdf: !!input.pdfContent,
    pdfTextLength: input.pdfContent?.text.length || 0,
    pdfImageCount: input.pdfContent?.images.length || 0,
  };
}

function recordToJob(r: SymfonyClassroomJobRecord): ClassroomGenerationJob {
  const job: ClassroomGenerationJob = {
    id: r.job_id,
    status: r.status,
    step: r.step as ClassroomGenerationJob['step'],
    progress: r.progress,
    message: r.message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    inputSummary:
      r.input_summary ?? {
        requirementPreview: '',
        language: 'zh-CN',
        hasPdf: false,
        pdfTextLength: 0,
        pdfImageCount: 0,
      },
    scenesGenerated: r.scenes_generated,
  };
  if (r.started_at) job.startedAt = r.started_at;
  if (r.completed_at) job.completedAt = r.completed_at;
  if (r.total_scenes != null) job.totalScenes = r.total_scenes;
  if (r.error) job.error = r.error;
  // Per §3.10 the backend only persists result_classroom_uuid on the
  // ClassroomJobEnvelope. result_url and result_scenes_count are nice-to-haves
  // we send on PATCH; the server does not echo them back, so tolerate their
  // absence and fall back to the sibling scenes_generated field.
  if (r.result_classroom_uuid) {
    job.result = {
      classroomId: r.result_classroom_uuid,
      url: r.result_url ?? '',
      scenesCount: r.result_scenes_count ?? r.scenes_generated,
    };
  }
  return job;
}

async function symfonyJobFetch(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${symfonyBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
}

export function isValidClassroomJobId(jobId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(jobId);
}

export async function createClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  accessToken: string,
  studentUuid: string,
): Promise<ClassroomGenerationJob> {
  const res = await symfonyJobFetch(`/api/classroom-jobs`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      job_id: jobId,
      student_uuid: studentUuid,
      input_summary: buildInputSummary(input),
    }),
  });
  if (!res.ok) {
    throw new Error(`Create classroom job failed: ${res.status}`);
  }
  const body = (await res.json()) as SymfonyClassroomJobRecord;
  return recordToJob(body);
}

export async function readClassroomGenerationJob(
  jobId: string,
  accessToken: string,
): Promise<ClassroomGenerationJob | null> {
  const res = await symfonyJobFetch(
    `/api/classroom-jobs/${encodeURIComponent(jobId)}`,
    accessToken,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Read classroom job failed: ${res.status}`);
  }
  const body = (await res.json()) as SymfonyClassroomJobRecord;
  return recordToJob(body);
}

async function patchJob(
  jobId: string,
  accessToken: string,
  patch: Record<string, unknown>,
): Promise<ClassroomGenerationJob> {
  const res = await symfonyJobFetch(
    `/api/classroom-jobs/${encodeURIComponent(jobId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    throw new Error(`Update classroom job failed: ${res.status}`);
  }
  const body = (await res.json()) as SymfonyClassroomJobRecord;
  return recordToJob(body);
}

export async function markClassroomGenerationJobRunning(
  jobId: string,
  accessToken: string,
): Promise<ClassroomGenerationJob> {
  return patchJob(jobId, accessToken, {
    status: 'running',
    started_at: new Date().toISOString(),
    message: 'Classroom generation started',
  });
}

export async function updateClassroomGenerationJobProgress(
  jobId: string,
  progress: ClassroomGenerationProgress,
  accessToken: string,
): Promise<ClassroomGenerationJob> {
  return patchJob(jobId, accessToken, {
    status: 'running',
    step: progress.step,
    progress: progress.progress,
    message: progress.message,
    scenes_generated: progress.scenesGenerated,
    ...(progress.totalScenes != null ? { total_scenes: progress.totalScenes } : {}),
  });
}

export async function markClassroomGenerationJobSucceeded(
  jobId: string,
  result: GenerateClassroomResult,
  accessToken: string,
): Promise<ClassroomGenerationJob> {
  return patchJob(jobId, accessToken, {
    status: 'succeeded',
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    completed_at: new Date().toISOString(),
    scenes_generated: result.scenesCount,
    result_classroom_uuid: result.id,
    result_url: result.url,
    result_scenes_count: result.scenesCount,
  });
}

export async function markClassroomGenerationJobFailed(
  jobId: string,
  error: string,
  accessToken: string,
): Promise<ClassroomGenerationJob> {
  return patchJob(jobId, accessToken, {
    status: 'failed',
    step: 'failed',
    message: 'Classroom generation failed',
    completed_at: new Date().toISOString(),
    error,
  });
}
