// lib/server/llm.ts
import { generateText, streamText, type ModelMessage, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ApiError } from '@/lib/api/errors';
import { loadProviderConfig } from '@/lib/server/provider-config';
import { tokenCounter } from '@/lib/server/token-counter';

export interface CallOpts {
  studentId: number;
  provider: string;
  model: string;
  messages: ModelMessage[];
  accessToken: string;
  signal?: AbortSignal;
}

function buildModel(
  provider: string,
  model: string,
  cfg: { apiKey: string; baseUrl?: string },
): LanguageModel {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl })(model);
    case 'anthropic':
      return createAnthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl })(model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl })(model);
    // Extend as needed — new providers add one case here.
    // NOTE: Task 15 (Admin UI) lists 11 providers. Only the three cased above will work end-to-end
    // right now — the others will surface as NOT_CONFIGURED at call time.
    default:
      throw new ApiError(400, 'NOT_CONFIGURED', `Unsupported provider: ${provider}`);
  }
}

async function preflight(opts: CallOpts): Promise<LanguageModel> {
  const quota = tokenCounter.checkQuota(opts.studentId);
  if (!quota.allowed) {
    throw new ApiError(
      429,
      'RATE_LIMITED',
      `Token quota exceeded (resets ${quota.resetDate})`,
    );
  }
  const cfg = await loadProviderConfig(opts.provider);
  return buildModel(opts.provider, opts.model, cfg);
}

export async function callLLM(opts: CallOpts) {
  const model = await preflight(opts);
  try {
    const result = await generateText({
      model,
      messages: opts.messages,
      abortSignal: opts.signal,
    });
    tokenCounter.recordUsage(
      opts.studentId,
      opts.provider,
      opts.model,
      result.usage.inputTokens ?? 0,
      result.usage.outputTokens ?? 0,
    );
    return result;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(500, 'SERVER', e instanceof Error ? e.message : 'LLM call failed');
  }
}

export async function streamLLM(opts: CallOpts) {
  const model = await preflight(opts);
  return streamText({
    model,
    messages: opts.messages,
    abortSignal: opts.signal,
    onFinish: ({ usage }) => {
      tokenCounter.recordUsage(
        opts.studentId,
        opts.provider,
        opts.model,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
      );
    },
  });
}
