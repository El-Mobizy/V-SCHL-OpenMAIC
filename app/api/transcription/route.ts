import { NextRequest } from 'next/server';
import { transcribeAudio } from '@/lib/audio/asr-providers';
import {
  resolveASRApiKeyAsync,
  resolveASRBaseUrlAsync,
} from '@/lib/server/provider-config';
import type { ASRProviderId } from '@/lib/audio/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { extractUser } from '@/lib/auth/jwt';
import { tokenCounter } from '@/lib/server/token-counter';
import { ASR_TOKENS_PER_SECOND } from '@/lib/server/feature-metering';
const log = createLogger('Transcription');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const providerId = formData.get('providerId') as ASRProviderId | null;
    const modelId = formData.get('modelId') as string | null;
    const language = formData.get('language') as string | null;
    const apiKey = formData.get('apiKey') as string | null;
    const baseUrl = formData.get('baseUrl') as string | null;

    if (!audioFile) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Audio file is required');
    }

    // providerId is required from the client — no server-side store to fall back to
    const effectiveProviderId = providerId || ('openai-whisper' as ASRProviderId);

    const clientBaseUrl = baseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const resolvedApiKey = clientBaseUrl
      ? apiKey || ''
      : await resolveASRApiKeyAsync(effectiveProviderId, apiKey || undefined);
    const resolvedBaseUrl = clientBaseUrl
      ? clientBaseUrl
      : await resolveASRBaseUrlAsync(effectiveProviderId, baseUrl || undefined);

    if (!resolvedApiKey && !clientBaseUrl) {
      return apiError(
        'FEATURE_NOT_CONFIGURED',
        400,
        'Speech Recognition is not activated by your school yet.',
      );
    }

    const config = {
      providerId: effectiveProviderId,
      modelId: modelId || undefined,
      language: language || 'auto',
      apiKey: resolvedApiKey,
      baseUrl: resolvedBaseUrl,
    };

    // Convert audio file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Transcribe using the provider system
    const result = await transcribeAudio(config, buffer);

    // Record token-equivalent usage based on audio byte size as a proxy for
    // duration. Webm/opus around 20kbps → ~2500 bytes/sec; use 2000 to be
    // conservative. See lib/server/feature-metering for weights.
    const accessToken = req.cookies.get('access_token')?.value;
    const user = accessToken ? extractUser(accessToken) : null;
    if (user?.student_uuid) {
      const estimatedSeconds = Math.max(1, Math.round(buffer.byteLength / 2000));
      tokenCounter.recordUsage(
        user.student_uuid,
        effectiveProviderId,
        modelId || '',
        estimatedSeconds * ASR_TOKENS_PER_SECOND,
        0,
      );
      tokenCounter.flushUsage(user.student_uuid).catch(() => {});
    }

    return apiSuccess({ text: result.text });
  } catch (error) {
    log.error('Transcription error:', error);
    return apiError(
      'TRANSCRIPTION_FAILED',
      500,
      'Transcription failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
