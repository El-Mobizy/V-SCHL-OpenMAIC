'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { ApiKey, ProviderCatalogEntry, SuggestedModel } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Eye, EyeOff } from 'lucide-react';

// Fallback list. If the catalog endpoint returns a superset we still render those;
// otherwise this ensures the known providers appear even if the catalog fetch fails.
const FALLBACK_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'qwen',
  'kimi',
  'minimax',
  'glm',
  'siliconflow',
  'doubao',
  'grok',
] as const;

type Draft = {
  provider: string;
  api_key: string;
  base_url: string;
  models: SuggestedModel[];
  modelsInput: string;
};

function modelsToInput(models: SuggestedModel[] | undefined): string {
  if (!models || models.length === 0) return '';
  return models.map((m) => (m.id === m.name ? m.id : `${m.id}|${m.name}`)).join(', ');
}

function parseModelsInput(input: string): SuggestedModel[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const [id, name] = token.split('|').map((s) => s.trim());
      return { id, name: name || id };
    });
}

function sameModelList(a: SuggestedModel[] | undefined, b: SuggestedModel[] | undefined): boolean {
  const xa = a ?? [];
  const xb = b ?? [];
  if (xa.length !== xb.length) return false;
  return xa.every((m, i) => m.id === xb[i].id);
}

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Keep the latest catalog in memory for the session. Refetched on focus and after
  // each POST/DELETE. Never persisted — backend controls staleness.
  const catalogFetched = useRef(false);

  const handleApiError = useCallback(
    (e: unknown, fallback?: string) => {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          router.replace('/login');
          return;
        }
        toast.error(e.detail || fallback || 'Request failed');
        return;
      }
      toast.error(fallback ?? (e as Error)?.message ?? 'Request failed');
    },
    [router],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([
        api.admin.keys.list(),
        catalogFetched.current
          ? Promise.resolve(catalog)
          : api.admin.catalog.list().then((r) => {
              catalogFetched.current = true;
              return r;
            }),
      ]);
      setKeys(k);
      setCatalog(c);
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
    // `catalog` intentionally excluded — it's a cached snapshot we only read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleApiError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refetch on tab focus.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const rows = useMemo(() => {
    const byConfigured = new Map(keys.map((k) => [k.provider, k]));
    const byCatalog = new Map(catalog.map((c) => [c.provider, c]));
    const providers = new Set<string>([
      ...FALLBACK_PROVIDERS,
      ...byConfigured.keys(),
      ...byCatalog.keys(),
    ]);
    return Array.from(providers).map((provider) => {
      const configured = byConfigured.get(provider);
      const cat = byCatalog.get(provider);
      const suggestedBaseUrl = configured?.suggested_base_url ?? cat?.default_base_url ?? null;
      const suggestedModels = configured?.suggested_models ?? cat?.suggested_models ?? [];
      return { provider, configured, suggestedBaseUrl, suggestedModels };
    });
  }, [keys, catalog]);

  function startEdit(provider: string) {
    const existing = keys.find((k) => k.provider === provider);
    setEditing(provider);
    setShowKey(false);
    setDraft({
      provider,
      api_key: '',
      base_url: existing?.base_url ?? '',
      models: existing?.models ?? [],
      modelsInput: modelsToInput(existing?.models),
    });
  }

  // Merge a suggestion (Use button) into the current draft without resetting
  // other fields. If the row isn't already being edited, open the editor first.
  function applySuggestion(
    provider: string,
    seed: Partial<Pick<Draft, 'base_url' | 'models'>>,
  ) {
    const existing = keys.find((k) => k.provider === provider);
    setEditing(provider);
    setDraft((prev) => {
      const base: Draft =
        prev && prev.provider === provider
          ? prev
          : {
              provider,
              api_key: '',
              base_url: existing?.base_url ?? '',
              models: existing?.models ?? [],
              modelsInput: modelsToInput(existing?.models),
            };
      const next: Draft = { ...base };
      if (seed.base_url !== undefined) next.base_url = seed.base_url;
      if (seed.models !== undefined) {
        next.models = seed.models;
        next.modelsInput = modelsToInput(seed.models);
      }
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    const existing = keys.find((k) => k.provider === draft.provider);
    const trimmedKey = draft.api_key.trim();
    if (!existing?.has_key && !trimmedKey) {
      toast.error(`${draft.provider}: enter an API key`);
      return;
    }
    try {
      const models = parseModelsInput(draft.modelsInput);
      await api.admin.keys.upsert({
        provider: draft.provider,
        api_key: trimmedKey || undefined,
        base_url: draft.base_url.trim() || undefined,
        models,
      });
      toast.success(
        trimmedKey ? `${draft.provider}: key saved` : `${draft.provider}: updated`,
      );
      setEditing(null);
      setDraft(null);
      setShowKey(false);
      catalogFetched.current = false; // refetch catalog too in case backend enriched suggestions
      refresh();
    } catch (e) {
      handleApiError(e, `${draft.provider}: save failed`);
    }
  }

  async function remove(provider: string) {
    if (!confirm(`Delete API key for ${provider}?`)) return;
    try {
      await api.admin.keys.remove(provider);
      toast.success(`${provider}: deleted`);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.error(`${provider}: not found`);
        refresh();
        return;
      }
      handleApiError(e, `${provider}: delete failed`);
    }
  }

  async function test(provider: string) {
    setTesting(provider);
    try {
      const existing = keys.find((k) => k.provider === provider);
      const model = existing?.models?.[0]?.id;
      if (!model) {
        toast.error(`${provider}: set a model first`);
        return;
      }
      const res = await fetch('/api/verify-model', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `${provider}:${model}`,
          requiresApiKey: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) toast.success(`${provider}: works`);
      else toast.error(`${provider}: ${(data as { error?: string }).error ?? 'test failed'}`);
    } catch (e) {
      toast.error(`${provider}: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  }

  if (loading && keys.length === 0 && catalog.length === 0) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-primary pl-3">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Configure LLM provider credentials. Saved keys override environment variables. Suggested
          values come from the backend catalog.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th scope="col" className="px-4 py-2">
                Provider
              </th>
              <th scope="col" className="px-4 py-2">
                Key
              </th>
              <th scope="col" className="px-4 py-2">
                Base URL
              </th>
              <th scope="col" className="px-4 py-2">
                Models
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ provider, configured, suggestedBaseUrl, suggestedModels }) => {
              const isEditing = editing === provider;
              const savedBaseUrl = configured?.base_url ?? '';
              const savedModels = configured?.models ?? [];
              const baseUrlMatches =
                !!suggestedBaseUrl && savedBaseUrl === suggestedBaseUrl;
              const modelsMatch = sameModelList(savedModels, suggestedModels);
              const canSuggestBaseUrl =
                !!suggestedBaseUrl && suggestedBaseUrl !== savedBaseUrl;
              const canSuggestModels =
                suggestedModels.length > 0 && !modelsMatch;

              return (
                <tr key={provider} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{provider}</td>
                  <td className="px-4 py-3 font-mono">
                    {configured?.has_key ? (
                      'sk-••••••••'
                    ) : (
                      <span className="text-muted-foreground">— not set —</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-muted-foreground">{savedBaseUrl || '—'}</div>
                    {suggestedBaseUrl && (
                      <div className="mt-1 text-xs flex items-center gap-2">
                        {baseUrlMatches ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" /> up to date
                          </span>
                        ) : (
                          <>
                            <span className="text-muted-foreground">
                              Suggested: <span className="font-mono">{suggestedBaseUrl}</span>
                            </span>
                            {canSuggestBaseUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  applySuggestion(provider, { base_url: suggestedBaseUrl })
                                }
                              >
                                Use
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-muted-foreground">
                      {savedModels.length > 0
                        ? savedModels.map((m) => m.name).join(', ')
                        : '—'}
                    </div>
                    {suggestedModels.length > 0 && (
                      <div className="mt-1 text-xs flex items-start gap-2 flex-wrap">
                        {modelsMatch ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" /> up to date
                          </span>
                        ) : (
                          <>
                            <span className="text-muted-foreground">
                              Suggested:{' '}
                              <span className="font-mono">
                                {suggestedModels.map((m) => m.name).join(', ')}
                              </span>
                            </span>
                            {canSuggestModels && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  applySuggestion(provider, { models: suggestedModels })
                                }
                              >
                                Use
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {configured?.has_key && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => test(provider)}
                        disabled={testing === provider}
                      >
                        {testing === provider ? 'Testing…' : 'Test'}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => startEdit(provider)}>
                      {configured?.has_key ? 'Edit' : 'Add'}
                    </Button>
                    {configured?.has_key && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(provider)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>

                  {isEditing && draft && (
                    <td colSpan={5} className="px-4 pb-4 bg-muted/30">
                      <div className="grid gap-2 pt-3 max-w-xl">
                        <label className="text-xs font-medium">
                          API key{' '}
                          {configured?.has_key && (
                            <span className="text-muted-foreground">
                              (leave blank to keep existing)
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <Input
                            type={showKey ? 'text' : 'password'}
                            autoComplete="new-password"
                            placeholder="sk-..."
                            value={draft.api_key}
                            onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
                            className="pr-9 font-mono"
                          />
                          <button
                            type="button"
                            aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            aria-pressed={showKey}
                            onClick={() => setShowKey((v) => !v)}
                            className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground hover:text-foreground"
                          >
                            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <label className="text-xs font-medium">Base URL (optional)</label>
                        <Input
                          placeholder="https://..."
                          value={draft.base_url}
                          onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
                        />
                        <label className="text-xs font-medium">
                          Models{' '}
                          <span className="text-muted-foreground">
                            (comma-separated; use <code>id|Name</code> to override display name)
                          </span>
                        </label>
                        <Input
                          placeholder="gpt-4o, gpt-4o-mini"
                          value={draft.modelsInput}
                          onChange={(e) =>
                            setDraft({ ...draft, modelsInput: e.target.value })
                          }
                        />
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={save}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(null);
                              setDraft(null);
                              setShowKey(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
