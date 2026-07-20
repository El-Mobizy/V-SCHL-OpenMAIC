/**
 * Server-side media and TTS generation for classrooms.
 *
 * Generates image/video files and TTS audio for a classroom,
 * writes them to disk, and returns serving URL mappings.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import { generateImage } from '@/lib/media/image-providers';
import { generateVideo, normalizeVideoOptions } from '@/lib/media/video-providers';
import { generateTTS } from '@/lib/audio/tts-providers';
import { DEFAULT_TTS_VOICES, DEFAULT_TTS_MODELS, TTS_PROVIDERS } from '@/lib/audio/constants';
import { IMAGE_PROVIDERS } from '@/lib/media/image-providers';
import { VIDEO_PROVIDERS } from '@/lib/media/video-providers';
import { isMediaPlaceholder } from '@/lib/store/media-generation';
import {
  getServerImageProvidersAsync,
  getServerVideoProvidersAsync,
  getServerTTSProvidersAsync,
  resolveImageApiKeyAsync,
  resolveImageBaseUrlAsync,
  resolveVideoApiKeyAsync,
  resolveVideoBaseUrlAsync,
  resolveTTSApiKeyAsync,
  resolveTTSBaseUrlAsync,
} from '@/lib/server/provider-config';
import { tokenCounter } from '@/lib/server/token-counter';
import {
  TTS_TOKENS_PER_CHAR,
  IMAGE_TOKENS_PER_GENERATION,
  VIDEO_TOKENS_PER_SECOND,
  VIDEO_FALLBACK_SECONDS,
  type Feature,
} from '@/lib/server/feature-metering';
import type { SceneOutline } from '@/lib/types/generation';
import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';
import type { ImageProviderId } from '@/lib/media/types';
import type { VideoProviderId } from '@/lib/media/types';
import type { TTSProviderId } from '@/lib/audio/types';
import { splitLongSpeechActions } from '@/lib/audio/tts-utils';

export interface MediaGenerationReport {
  mediaMap: Record<string, string>;
  notConfigured: Feature[];
  generated: { images: number; videos: number };
}

export interface TTSGenerationReport {
  notConfigured: boolean;
  actionsSynthesized: number;
  charactersSynthesized: number;
}

interface MeteringOpts {
  studentId?: string;
}

const log = createLogger('ClassroomMedia');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

const DOWNLOAD_TIMEOUT_MS = 120_000; // 2 minutes
const DOWNLOAD_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

async function downloadToBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const contentLength = Number(resp.headers.get('content-length') || 0);
  if (contentLength > DOWNLOAD_MAX_SIZE) {
    throw new Error(`File too large: ${contentLength} bytes (max ${DOWNLOAD_MAX_SIZE})`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

function mediaServingUrl(baseUrl: string, classroomId: string, subPath: string): string {
  return `${baseUrl}/api/classroom-media/${classroomId}/${subPath}`;
}

// ---------------------------------------------------------------------------
// Image / Video generation
// ---------------------------------------------------------------------------

export async function generateMediaForClassroom(
  outlines: SceneOutline[],
  classroomId: string,
  baseUrl: string,
  metering: MeteringOpts = {},
): Promise<MediaGenerationReport> {
  const mediaDir = path.join(CLASSROOMS_DIR, classroomId, 'media');
  await ensureDir(mediaDir);

  // Collect all media generation requests from outlines
  const requests = outlines.flatMap((o) => o.mediaGenerations ?? []);
  const report: MediaGenerationReport = {
    mediaMap: {},
    notConfigured: [],
    generated: { images: 0, videos: 0 },
  };
  if (requests.length === 0) return report;

  // Resolve providers (Symfony-aware: consults admin-configured keys)
  const imageProviderIds = Object.keys(await getServerImageProvidersAsync());
  const videoProviderIds = Object.keys(await getServerVideoProvidersAsync());

  const imageRequests = requests.filter((r) => r.type === 'image');
  const videoRequests = requests.filter((r) => r.type === 'video');

  if (imageRequests.length > 0 && imageProviderIds.length === 0) {
    report.notConfigured.push('image');
  }
  if (videoRequests.length > 0 && videoProviderIds.length === 0) {
    report.notConfigured.push('video');
  }

  const generateImages = async () => {
    if (imageProviderIds.length === 0) return;
    for (const req of imageRequests) {
      try {
        const providerId = imageProviderIds[0] as ImageProviderId;
        const apiKey = await resolveImageApiKeyAsync(providerId);
        if (!apiKey) {
          log.warn(`No API key for image provider "${providerId}", skipping ${req.elementId}`);
          continue;
        }
        const providerConfig = IMAGE_PROVIDERS[providerId];
        const model = providerConfig?.models?.[0]?.id;

        const result = await generateImage(
          {
            providerId,
            apiKey,
            baseUrl: await resolveImageBaseUrlAsync(providerId),
            model,
          },
          { prompt: req.prompt, aspectRatio: req.aspectRatio || '16:9' },
        );

        let buf: Buffer;
        let ext: string;
        if (result.base64) {
          buf = Buffer.from(result.base64, 'base64');
          ext = 'png';
        } else if (result.url) {
          buf = await downloadToBuffer(result.url);
          const urlExt = path.extname(new URL(result.url).pathname).replace('.', '');
          ext = ['png', 'jpg', 'jpeg', 'webp'].includes(urlExt) ? urlExt : 'png';
        } else {
          log.warn(`Image generation returned no data for ${req.elementId}`);
          continue;
        }

        const filename = `${req.elementId}.${ext}`;
        await fs.writeFile(path.join(mediaDir, filename), buf);
        report.mediaMap[req.elementId] = mediaServingUrl(
          baseUrl,
          classroomId,
          `media/${filename}`,
        );
        report.generated.images += 1;
        if (metering.studentId) {
          tokenCounter.recordUsage(
            metering.studentId,
            providerId,
            model || '',
            IMAGE_TOKENS_PER_GENERATION,
            0,
          );
        }
        log.info(`Generated image: ${filename}`);
      } catch (err) {
        log.warn(`Image generation failed for ${req.elementId}:`, err);
      }
    }
  };

  const generateVideos = async () => {
    if (videoProviderIds.length === 0) return;
    for (const req of videoRequests) {
      try {
        const providerId = videoProviderIds[0] as VideoProviderId;
        const apiKey = await resolveVideoApiKeyAsync(providerId);
        if (!apiKey) {
          log.warn(`No API key for video provider "${providerId}", skipping ${req.elementId}`);
          continue;
        }
        const providerConfig = VIDEO_PROVIDERS[providerId];
        const model = providerConfig?.models?.[0]?.id;

        const normalized = normalizeVideoOptions(providerId, {
          prompt: req.prompt,
          aspectRatio: (req.aspectRatio as '16:9' | '4:3' | '1:1' | '9:16') || '16:9',
        });

        const result = await generateVideo(
          {
            providerId,
            apiKey,
            baseUrl: await resolveVideoBaseUrlAsync(providerId),
            model,
          },
          normalized,
        );

        const buf = await downloadToBuffer(result.url);
        const filename = `${req.elementId}.mp4`;
        await fs.writeFile(path.join(mediaDir, filename), buf);
        report.mediaMap[req.elementId] = mediaServingUrl(
          baseUrl,
          classroomId,
          `media/${filename}`,
        );
        report.generated.videos += 1;
        if (metering.studentId) {
          const seconds =
            (normalized as { duration?: number }).duration || VIDEO_FALLBACK_SECONDS;
          tokenCounter.recordUsage(
            metering.studentId,
            providerId,
            model || '',
            Math.round(seconds * VIDEO_TOKENS_PER_SECOND),
            0,
          );
        }
        log.info(`Generated video: ${filename}`);
      } catch (err) {
        log.warn(`Video generation failed for ${req.elementId}:`, err);
      }
    }
  };

  await Promise.all([generateImages(), generateVideos()]);

  return report;
}

// ---------------------------------------------------------------------------
// Placeholder replacement in scene content
// ---------------------------------------------------------------------------

export function replaceMediaPlaceholders(scenes: Scene[], mediaMap: Record<string, string>): void {
  if (Object.keys(mediaMap).length === 0) return;

  for (const scene of scenes) {
    if (scene.type !== 'slide') continue;
    const canvas = (
      scene.content as {
        canvas?: { elements?: Array<{ id: string; src?: string; type?: string }> };
      }
    )?.canvas;
    if (!canvas?.elements) continue;

    for (const el of canvas.elements) {
      if (
        (el.type === 'image' || el.type === 'video') &&
        typeof el.src === 'string' &&
        isMediaPlaceholder(el.src) &&
        mediaMap[el.src]
      ) {
        el.src = mediaMap[el.src];
      }
    }
  }
}

// ---------------------------------------------------------------------------
// TTS generation
// ---------------------------------------------------------------------------

export async function generateTTSForClassroom(
  scenes: Scene[],
  classroomId: string,
  baseUrl: string,
  metering: MeteringOpts = {},
): Promise<TTSGenerationReport> {
  const report: TTSGenerationReport = {
    notConfigured: false,
    actionsSynthesized: 0,
    charactersSynthesized: 0,
  };
  const audioDir = path.join(CLASSROOMS_DIR, classroomId, 'audio');
  await ensureDir(audioDir);

  // Resolve TTS provider (Symfony-aware, exclude browser-native-tts)
  const ttsProviderIds = Object.keys(await getServerTTSProvidersAsync()).filter(
    (id) => id !== 'browser-native-tts',
  );
  if (ttsProviderIds.length === 0) {
    log.warn('No server TTS provider configured, skipping TTS generation');
    report.notConfigured = true;
    return report;
  }

  const providerId = ttsProviderIds[0] as TTSProviderId;
  const apiKey = await resolveTTSApiKeyAsync(providerId);
  if (!apiKey) {
    log.warn(`No API key for TTS provider "${providerId}", skipping TTS generation`);
    report.notConfigured = true;
    return report;
  }
  const ttsBaseUrl =
    (await resolveTTSBaseUrlAsync(providerId)) || TTS_PROVIDERS[providerId]?.defaultBaseUrl;
  const voice = DEFAULT_TTS_VOICES[providerId] || 'default';
  const format = TTS_PROVIDERS[providerId]?.supportedFormats?.[0] || 'mp3';

  for (const scene of scenes) {
    if (!scene.actions) continue;

    // Split long speech actions into multiple shorter ones before TTS generation,
    // mirroring the client-side approach. Each sub-action gets its own audio file.
    scene.actions = splitLongSpeechActions(scene.actions, providerId);

    for (const action of scene.actions) {
      if (action.type !== 'speech' || !(action as SpeechAction).text) continue;
      const speechAction = action as SpeechAction;
      const audioId = `tts_${action.id}`;

      try {
        const result = await generateTTS(
          {
            providerId,
            modelId: DEFAULT_TTS_MODELS[providerId] || '',
            apiKey,
            baseUrl: ttsBaseUrl,
            voice,
            speed: speechAction.speed,
          },
          speechAction.text,
        );

        const filename = `${audioId}.${format}`;
        await fs.writeFile(path.join(audioDir, filename), result.audio);

        speechAction.audioId = audioId;
        speechAction.audioUrl = mediaServingUrl(baseUrl, classroomId, `audio/${filename}`);
        report.actionsSynthesized += 1;
        report.charactersSynthesized += speechAction.text.length;
        if (metering.studentId) {
          tokenCounter.recordUsage(
            metering.studentId,
            providerId,
            DEFAULT_TTS_MODELS[providerId] || '',
            speechAction.text.length * TTS_TOKENS_PER_CHAR,
            0,
          );
        }
        log.info(`Generated TTS: ${filename} (${result.audio.length} bytes)`);
      } catch (err) {
        log.warn(`TTS generation failed for action ${action.id}:`, err);
      }
    }
  }
  return report;
}
