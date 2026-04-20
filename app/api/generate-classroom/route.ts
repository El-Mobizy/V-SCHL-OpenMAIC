import { after, type NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { apiError, apiErrorResponseFromApiError, apiSuccess } from '@/lib/server/api-response';
import { type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { requireStudentAuth } from '@/lib/server/request-auth';
import { ApiError } from '@/lib/api/errors';
import { parseModelString } from '@/lib/ai/providers';
import { resolveClassroomModelString } from '@/lib/server/admin-default-model';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let studentAuth: { studentId: string; accessToken: string };
  try {
    studentAuth = requireStudentAuth(req);
  } catch (e) {
    if (e instanceof ApiError) return apiErrorResponseFromApiError(e);
    throw e;
  }

  try {
    const rawBody = (await req.json()) as Partial<GenerateClassroomInput>;

    const modelString = await resolveClassroomModelString({
      clientOverride: rawBody.modelString,
      accessToken: studentAuth.accessToken,
    });

    const body: GenerateClassroomInput = {
      requirement: rawBody.requirement || '',
      modelString,
      ...(rawBody.pdfContent ? { pdfContent: rawBody.pdfContent } : {}),
      ...(rawBody.language ? { language: rawBody.language } : {}),
      ...(rawBody.enableWebSearch != null ? { enableWebSearch: rawBody.enableWebSearch } : {}),
      ...(rawBody.enableImageGeneration != null
        ? { enableImageGeneration: rawBody.enableImageGeneration }
        : {}),
      ...(rawBody.enableVideoGeneration != null
        ? { enableVideoGeneration: rawBody.enableVideoGeneration }
        : {}),
      ...(rawBody.enableTTS != null ? { enableTTS: rawBody.enableTTS } : {}),
      ...(rawBody.agentMode ? { agentMode: rawBody.agentMode } : {}),
    };
    const { requirement } = body;

    if (!requirement) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: requirement');
    }

    const baseUrl = buildRequestOrigin(req);
    const jobId = nanoid(10);
    const job = await createClassroomGenerationJob(jobId, body);
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    const { providerId } = parseModelString(modelString);
    const metering = {
      studentId: studentAuth.studentId,
      providerId,
      accessToken: studentAuth.accessToken,
    };

    after(() => runClassroomGenerationJob(jobId, body, baseUrl, metering));

    return apiSuccess(
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
      },
      202,
    );
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to create classroom generation job',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
