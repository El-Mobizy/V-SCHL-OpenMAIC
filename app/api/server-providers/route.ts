import {
  getServerProviders,
  getServerTTSProvidersAsync,
  getServerASRProvidersAsync,
  getServerPDFProviders,
  getServerImageProvidersAsync,
  getServerVideoProvidersAsync,
  getServerWebSearchProviders,
} from '@/lib/server/provider-config';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('ServerProviders');

export async function GET() {
  try {
    const [tts, asr, image, video] = await Promise.all([
      getServerTTSProvidersAsync(),
      getServerASRProvidersAsync(),
      getServerImageProvidersAsync(),
      getServerVideoProvidersAsync(),
    ]);
    return apiSuccess({
      providers: getServerProviders(),
      tts,
      asr,
      pdf: getServerPDFProviders(),
      image,
      video,
      webSearch: getServerWebSearchProviders(),
    });
  } catch (error) {
    log.error('Error fetching server providers:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
