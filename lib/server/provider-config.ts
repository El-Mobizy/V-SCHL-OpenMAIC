/**
 * Server-side Provider Configuration
 *
 * Loads provider configs from YAML (primary) + environment variables (fallback).
 * Keys never leave the server — only provider IDs and metadata are exposed via API.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { createLogger } from '@/lib/logger';
import { ApiError } from '@/lib/api/errors';

const log = createLogger('ServerProviderConfig');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerProviderEntry {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
  proxy?: string;
}

interface ServerConfig {
  providers: Record<string, ServerProviderEntry>;
  tts: Record<string, ServerProviderEntry>;
  asr: Record<string, ServerProviderEntry>;
  pdf: Record<string, ServerProviderEntry>;
  image: Record<string, ServerProviderEntry>;
  video: Record<string, ServerProviderEntry>;
  webSearch: Record<string, ServerProviderEntry>;
}

// ─── Symfony API Key Cache ───
// Fetches API keys configured by school admin in Symfony.
// Cache with 1-minute TTL to avoid hitting Symfony on every request.
let symfonyKeys: Record<string, { apiKey: string; baseUrl?: string }> | null = null;
let symfonyKeysLastFetch = 0;
const SYMFONY_KEYS_TTL = 60_000; // 1 minute cache

async function getSymfonyKeys(): Promise<Record<string, { apiKey: string; baseUrl?: string }>> {
  const now = Date.now();
  if (symfonyKeys && now - symfonyKeysLastFetch < SYMFONY_KEYS_TTL) {
    return symfonyKeys;
  }

  const SYMFONY_API_URL = process.env.SYMFONY_API_URL;
  if (!SYMFONY_API_URL) return {};

  try {
    const serviceToken = process.env.SYMFONY_SERVICE_TOKEN;
    const res = await fetch(`${SYMFONY_API_URL}/api/admin/api-keys`, {
      headers: serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {},
    });
    if (!res.ok) return symfonyKeys ?? {};
    const keys = await res.json();
    symfonyKeys = {};
    for (const entry of keys) {
      symfonyKeys[entry.provider] = { apiKey: entry.api_key, baseUrl: entry.base_url };
    }
    symfonyKeysLastFetch = now;
    return symfonyKeys;
  } catch {
    return symfonyKeys ?? {};
  }
}

// ---------------------------------------------------------------------------
// Env-var prefix mappings
// ---------------------------------------------------------------------------

const LLM_ENV_MAP: Record<string, string> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  KIMI: 'kimi',
  MINIMAX: 'minimax',
  GLM: 'glm',
  SILICONFLOW: 'siliconflow',
  DOUBAO: 'doubao',
  GROK: 'grok',
};

const TTS_ENV_MAP: Record<string, string> = {
  TTS_OPENAI: 'openai-tts',
  TTS_AZURE: 'azure-tts',
  TTS_GLM: 'glm-tts',
  TTS_QWEN: 'qwen-tts',
  TTS_DOUBAO: 'doubao-tts',
  TTS_ELEVENLABS: 'elevenlabs-tts',
  TTS_MINIMAX: 'minimax-tts',
};

const ASR_ENV_MAP: Record<string, string> = {
  ASR_OPENAI: 'openai-whisper',
  ASR_QWEN: 'qwen-asr',
};

const PDF_ENV_MAP: Record<string, string> = {
  PDF_UNPDF: 'unpdf',
  PDF_MINERU: 'mineru',
};

const IMAGE_ENV_MAP: Record<string, string> = {
  IMAGE_SEEDREAM: 'seedream',
  IMAGE_QWEN_IMAGE: 'qwen-image',
  IMAGE_NANO_BANANA: 'nano-banana',
  IMAGE_MINIMAX: 'minimax-image',
  IMAGE_GROK: 'grok-image',
};

const VIDEO_ENV_MAP: Record<string, string> = {
  VIDEO_SEEDANCE: 'seedance',
  VIDEO_KLING: 'kling',
  VIDEO_VEO: 'veo',
  VIDEO_SORA: 'sora',
  VIDEO_MINIMAX: 'minimax-video',
  VIDEO_GROK: 'grok-video',
};

const WEB_SEARCH_ENV_MAP: Record<string, string> = {
  TAVILY: 'tavily',
};

// ---------------------------------------------------------------------------
// YAML loading
// ---------------------------------------------------------------------------

type YamlData = Partial<{
  providers: Record<string, Partial<ServerProviderEntry>>;
  tts: Record<string, Partial<ServerProviderEntry>>;
  asr: Record<string, Partial<ServerProviderEntry>>;
  pdf: Record<string, Partial<ServerProviderEntry>>;
  image: Record<string, Partial<ServerProviderEntry>>;
  video: Record<string, Partial<ServerProviderEntry>>;
  'web-search': Record<string, Partial<ServerProviderEntry>>;
}>;

function loadYamlFile(filename: string): YamlData {
  try {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as YamlData;
  } catch (e) {
    log.warn(`[ServerProviderConfig] Failed to load ${filename}:`, e);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Env-var helpers
// ---------------------------------------------------------------------------

function loadEnvSection(
  envMap: Record<string, string>,
  yamlSection: Record<string, Partial<ServerProviderEntry>> | undefined,
  { requiresBaseUrl = false }: { requiresBaseUrl?: boolean } = {},
): Record<string, ServerProviderEntry> {
  const result: Record<string, ServerProviderEntry> = {};

  // First, add everything from YAML as defaults
  if (yamlSection) {
    for (const [id, entry] of Object.entries(yamlSection)) {
      const hasKey = !!entry?.apiKey;
      const hasUrl = !!entry?.baseUrl;
      if (requiresBaseUrl ? hasUrl : hasKey) {
        result[id] = {
          apiKey: entry.apiKey || '',
          baseUrl: entry.baseUrl,
          models: entry.models,
          proxy: entry.proxy,
        };
      }
    }
  }

  // Then, apply env vars (env takes priority over YAML)
  for (const [prefix, providerId] of Object.entries(envMap)) {
    const envApiKey = process.env[`${prefix}_API_KEY`] || undefined;
    const envBaseUrl = process.env[`${prefix}_BASE_URL`] || undefined;
    const envModelsStr = process.env[`${prefix}_MODELS`];
    const envModels = envModelsStr
      ? envModelsStr
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

    if (result[providerId]) {
      // YAML entry exists — env vars override individual fields
      if (envApiKey) result[providerId].apiKey = envApiKey;
      if (envBaseUrl) result[providerId].baseUrl = envBaseUrl;
      if (envModels) result[providerId].models = envModels;
      continue;
    }

    if (requiresBaseUrl ? !envBaseUrl : !envApiKey) continue;
    result[providerId] = {
      apiKey: envApiKey || '',
      baseUrl: envBaseUrl,
      models: envModels,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Module-level cache (process singleton)
// ---------------------------------------------------------------------------

const DEFAULT_FILENAME = 'server-providers.yml';

/** Cache keyed by YAML filename (empty string = default file). */
const _configs: Map<string, ServerConfig> = new Map();

function buildConfig(yamlData: YamlData): ServerConfig {
  return {
    providers: loadEnvSection(LLM_ENV_MAP, yamlData.providers),
    tts: loadEnvSection(TTS_ENV_MAP, yamlData.tts),
    asr: loadEnvSection(ASR_ENV_MAP, yamlData.asr),
    pdf: loadEnvSection(PDF_ENV_MAP, yamlData.pdf, { requiresBaseUrl: true }),
    image: loadEnvSection(IMAGE_ENV_MAP, yamlData.image),
    video: loadEnvSection(VIDEO_ENV_MAP, yamlData.video),
    webSearch: loadEnvSection(WEB_SEARCH_ENV_MAP, yamlData['web-search']),
  };
}

function logConfig(config: ServerConfig, label: string): void {
  const counts = [
    Object.keys(config.providers).length,
    Object.keys(config.tts).length,
    Object.keys(config.asr).length,
    Object.keys(config.pdf).length,
    Object.keys(config.image).length,
    Object.keys(config.video).length,
    Object.keys(config.webSearch).length,
  ];
  if (counts.some((c) => c > 0)) {
    log.info(
      `[ServerProviderConfig] Loaded (${label}): ${counts[0]} LLM, ${counts[1]} TTS, ${counts[2]} ASR, ${counts[3]} PDF, ${counts[4]} Image, ${counts[5]} Video, ${counts[6]} WebSearch providers`,
    );
  }
}

function getConfig(): ServerConfig {
  const cached = _configs.get('');
  if (cached) return cached;

  const yamlData = loadYamlFile(DEFAULT_FILENAME);
  const config = buildConfig(yamlData);
  logConfig(config, DEFAULT_FILENAME);
  _configs.set('', config);
  return config;
}

// ---------------------------------------------------------------------------
// Public API — LLM
// ---------------------------------------------------------------------------

/** Returns server-configured LLM providers (no apiKeys) */
export function getServerProviders(): Record<string, { models?: string[]; baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { models?: string[]; baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.providers)) {
    result[id] = {};
    if (entry.models && entry.models.length > 0) result[id].models = entry.models;
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

/** Resolve API key: client key > server key > empty string */
export function resolveApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().providers[providerId]?.apiKey || '';
}

/** Async version that also checks Symfony-stored keys as a fallback */
export async function resolveApiKeyAsync(providerId: string, clientKey?: string): Promise<string> {
  if (clientKey) return clientKey;
  const serverKey = getConfig().providers[providerId]?.apiKey;
  if (serverKey) return serverKey;
  const sKeys = await getSymfonyKeys();
  return sKeys[providerId]?.apiKey ?? '';
}

/** Resolve base URL: client > server > undefined */
export function resolveBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().providers[providerId]?.baseUrl;
}

/** Resolve proxy URL for a provider (server config only) */
export function resolveProxy(providerId: string): string | undefined {
  return getConfig().providers[providerId]?.proxy;
}

// ---------------------------------------------------------------------------
// Symfony key map helpers (for TTS/ASR/Image/Video — which admins configure
// in the Symfony admin UI, not in YAML/env).
// ---------------------------------------------------------------------------

/** Return Symfony-configured key entries keyed by provider id (cached). */
async function getSymfonyKeyMap(): Promise<Record<string, { apiKey: string; baseUrl?: string }>> {
  return getSymfonyKeys();
}

function mergeSymfonyProviders(
  base: Record<string, { baseUrl?: string }>,
  knownIds: Iterable<string>,
  symfony: Record<string, { apiKey: string; baseUrl?: string }>,
): Record<string, { baseUrl?: string }> {
  const result: Record<string, { baseUrl?: string }> = { ...base };
  for (const id of knownIds) {
    const entry = symfony[id];
    if (!entry?.apiKey) continue;
    if (result[id]) continue;
    result[id] = entry.baseUrl ? { baseUrl: entry.baseUrl } : {};
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API — TTS
// ---------------------------------------------------------------------------

export function getServerTTSProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.tts)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export async function getServerTTSProvidersAsync(): Promise<Record<string, { baseUrl?: string }>> {
  const { TTS_PROVIDERS } = await import('@/lib/audio/constants');
  const base = getServerTTSProviders();
  const symfony = await getSymfonyKeyMap();
  return mergeSymfonyProviders(base, Object.keys(TTS_PROVIDERS), symfony);
}

export function resolveTTSApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().tts[providerId]?.apiKey || '';
}

export async function resolveTTSApiKeyAsync(
  providerId: string,
  clientKey?: string,
): Promise<string> {
  if (clientKey) return clientKey;
  const local = getConfig().tts[providerId]?.apiKey;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.apiKey ?? '';
}

export function resolveTTSBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().tts[providerId]?.baseUrl;
}

export async function resolveTTSBaseUrlAsync(
  providerId: string,
  clientBaseUrl?: string,
): Promise<string | undefined> {
  if (clientBaseUrl) return clientBaseUrl;
  const local = getConfig().tts[providerId]?.baseUrl;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — ASR
// ---------------------------------------------------------------------------

export function getServerASRProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.asr)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export async function getServerASRProvidersAsync(): Promise<Record<string, { baseUrl?: string }>> {
  const { ASR_PROVIDERS } = await import('@/lib/audio/constants');
  const base = getServerASRProviders();
  const symfony = await getSymfonyKeyMap();
  return mergeSymfonyProviders(base, Object.keys(ASR_PROVIDERS), symfony);
}

export function resolveASRApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().asr[providerId]?.apiKey || '';
}

export async function resolveASRApiKeyAsync(
  providerId: string,
  clientKey?: string,
): Promise<string> {
  if (clientKey) return clientKey;
  const local = getConfig().asr[providerId]?.apiKey;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.apiKey ?? '';
}

export function resolveASRBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().asr[providerId]?.baseUrl;
}

export async function resolveASRBaseUrlAsync(
  providerId: string,
  clientBaseUrl?: string,
): Promise<string | undefined> {
  if (clientBaseUrl) return clientBaseUrl;
  const local = getConfig().asr[providerId]?.baseUrl;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — PDF
// ---------------------------------------------------------------------------

export function getServerPDFProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.pdf)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

export function resolvePDFApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().pdf[providerId]?.apiKey || '';
}

export function resolvePDFBaseUrl(providerId: string, clientBaseUrl?: string): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().pdf[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Image Generation
// ---------------------------------------------------------------------------

export function getServerImageProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.image)) {
    result[id] = {};
  }
  return result;
}

export async function getServerImageProvidersAsync(): Promise<
  Record<string, Record<string, never>>
> {
  const { IMAGE_PROVIDERS } = await import('@/lib/media/image-providers');
  const base = getServerImageProviders();
  const symfony = await getSymfonyKeyMap();
  const merged = { ...base };
  for (const id of Object.keys(IMAGE_PROVIDERS)) {
    if (!merged[id] && symfony[id]?.apiKey) merged[id] = {};
  }
  return merged;
}

export function resolveImageApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().image[providerId]?.apiKey || '';
}

export async function resolveImageApiKeyAsync(
  providerId: string,
  clientKey?: string,
): Promise<string> {
  if (clientKey) return clientKey;
  const local = getConfig().image[providerId]?.apiKey;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.apiKey ?? '';
}

export function resolveImageBaseUrl(
  providerId: string,
  clientBaseUrl?: string,
): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().image[providerId]?.baseUrl;
}

export async function resolveImageBaseUrlAsync(
  providerId: string,
  clientBaseUrl?: string,
): Promise<string | undefined> {
  if (clientBaseUrl) return clientBaseUrl;
  const local = getConfig().image[providerId]?.baseUrl;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Video Generation
// ---------------------------------------------------------------------------

export function getServerVideoProviders(): Record<string, Record<string, never>> {
  const cfg = getConfig();
  const result: Record<string, Record<string, never>> = {};
  for (const id of Object.keys(cfg.video)) {
    result[id] = {};
  }
  return result;
}

export async function getServerVideoProvidersAsync(): Promise<
  Record<string, Record<string, never>>
> {
  const { VIDEO_PROVIDERS } = await import('@/lib/media/video-providers');
  const base = getServerVideoProviders();
  const symfony = await getSymfonyKeyMap();
  const merged = { ...base };
  for (const id of Object.keys(VIDEO_PROVIDERS)) {
    if (!merged[id] && symfony[id]?.apiKey) merged[id] = {};
  }
  return merged;
}

export function resolveVideoApiKey(providerId: string, clientKey?: string): string {
  if (clientKey) return clientKey;
  return getConfig().video[providerId]?.apiKey || '';
}

export async function resolveVideoApiKeyAsync(
  providerId: string,
  clientKey?: string,
): Promise<string> {
  if (clientKey) return clientKey;
  const local = getConfig().video[providerId]?.apiKey;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.apiKey ?? '';
}

export function resolveVideoBaseUrl(
  providerId: string,
  clientBaseUrl?: string,
): string | undefined {
  if (clientBaseUrl) return clientBaseUrl;
  return getConfig().video[providerId]?.baseUrl;
}

export async function resolveVideoBaseUrlAsync(
  providerId: string,
  clientBaseUrl?: string,
): Promise<string | undefined> {
  if (clientBaseUrl) return clientBaseUrl;
  const local = getConfig().video[providerId]?.baseUrl;
  if (local) return local;
  const symfony = await getSymfonyKeyMap();
  return symfony[providerId]?.baseUrl;
}

// ---------------------------------------------------------------------------
// Public API — Web Search (Tavily)
// ---------------------------------------------------------------------------

/** Returns server-configured web search providers (no apiKeys exposed) */
export function getServerWebSearchProviders(): Record<string, { baseUrl?: string }> {
  const cfg = getConfig();
  const result: Record<string, { baseUrl?: string }> = {};
  for (const [id, entry] of Object.entries(cfg.webSearch)) {
    result[id] = {};
    if (entry.baseUrl) result[id].baseUrl = entry.baseUrl;
  }
  return result;
}

/** Resolve Tavily API key: client key > server key > TAVILY_API_KEY env > empty */
export function resolveWebSearchApiKey(clientKey?: string): string {
  if (clientKey) return clientKey;
  const serverKey = getConfig().webSearch.tavily?.apiKey;
  if (serverKey) return serverKey;
  return process.env.TAVILY_API_KEY || '';
}

interface ResolvedProviderConfig {
  apiKey: string;
  baseUrl?: string;
  models?: string[];
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; data: Map<string, ResolvedProviderConfig> } | null = null;
let inFlightFetch: Promise<Map<string, ResolvedProviderConfig>> | null = null;

async function fetchFromSymfony(): Promise<Map<string, ResolvedProviderConfig>> {
  const res = await fetch(`${process.env.SYMFONY_API_URL}/api/admin/api-keys`, {
    headers: { 'X-Service-Token': process.env.SYMFONY_SERVICE_TOKEN ?? '' },
  });
  if (!res.ok) return new Map();
  const keys = (await res.json()) as Array<{
    provider: string;
    api_key?: string;
    base_url?: string;
    models: Array<string | { id: string; name?: string }>;
    has_key?: boolean;
  }>;
  const m = new Map<string, ResolvedProviderConfig>();
  for (const k of keys) {
    if (!k.api_key) continue;
    const modelIds = (k.models ?? []).map((x) => (typeof x === 'string' ? x : x.id));
    m.set(k.provider, { apiKey: k.api_key, baseUrl: k.base_url, models: modelIds });
  }
  return m;
}

export async function loadProviderConfig(provider: string): Promise<ResolvedProviderConfig> {
  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    if (!inFlightFetch) {
      inFlightFetch = fetchFromSymfony().finally(() => {
        inFlightFetch = null;
      });
    }
    const data = await inFlightFetch;
    // Only write the cache if nobody else updated it while we were waiting.
    if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
      cache = { at: Date.now(), data };
    }
  }
  const fromDb = cache.data.get(provider);
  if (fromDb) return fromDb;

  const u = provider.toUpperCase();
  const envKey = process.env[`${u}_API_KEY`];
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: process.env[`${u}_BASE_URL`] || undefined,
      models: (process.env[`${u}_MODELS`] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  throw new ApiError(400, 'NOT_CONFIGURED', `No credentials configured for ${provider}`);
}

/** @internal */
export function __clearProviderConfigCache(): void {
  cache = null;
  inFlightFetch = null;
}
