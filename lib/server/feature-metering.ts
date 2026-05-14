/**
 * Token-equivalent weights for non-LLM features.
 *
 * These features bill in different units (characters, seconds, per-image). We
 * normalize them into the same "token" quota used for LLMs so a single
 * `tokenCounter.recordUsage` path tracks everything. Weights are a first-pass
 * approximation — replace with per-feature schema in Symfony if fidelity is
 * needed later.
 */
export const TTS_TOKENS_PER_CHAR = 1;
export const ASR_TOKENS_PER_SECOND = 100;
export const IMAGE_TOKENS_PER_GENERATION = 1000;
export const VIDEO_TOKENS_PER_SECOND = 500;

/** Estimated video duration when a provider doesn't return one. */
export const VIDEO_FALLBACK_SECONDS = 5;

/** Feature identifier used in FEATURE_NOT_CONFIGURED errors and UI toasts. */
export type Feature = 'tts' | 'asr' | 'image' | 'video';

export const FEATURE_LABEL: Record<Feature, string> = {
  tts: 'Text-to-Speech',
  asr: 'Speech Recognition',
  image: 'Image Generation',
  video: 'Video Generation',
};
