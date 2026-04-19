'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { ApiKey } from '@/lib/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Fixed provider list — only providers the LLM wrapper's buildModel switch supports
// will actually work at call time. The rest (deepseek, qwen, kimi, minimax, glm,
// siliconflow, doubao, grok) will surface NOT_CONFIGURED. Admins can still save keys
// for them in anticipation of future provider-switch cases.
const PROVIDERS = [
  'openai', 'anthropic', 'google',
  'deepseek', 'qwen', 'kimi', 'minimax', 'glm', 'siliconflow', 'doubao', 'grok',
] as const;

type Draft = {
  provider: string;
  api_key: string;
  base_url: string;
  models: string; // comma-separated in the form
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setKeys(await api.admin.keys.list());
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.detail);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const byProvider = new Map(keys.map((k) => [k.provider, k]));

  function startEdit(provider: string) {
    const existing = byProvider.get(provider);
    setEditing(provider);
    setDraft({
      provider,
      api_key: '', // always blank; cannot retrieve existing keys
      base_url: existing?.base_url ?? '',
      models: existing?.models?.join(', ') ?? '',
    });
  }

  async function save() {
    if (!draft) return;
    try {
      await api.admin.keys.upsert({
        provider: draft.provider,
        api_key: draft.api_key || undefined,
        base_url: draft.base_url || undefined,
        models: draft.models.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success(`${draft.provider}: saved`);
      setEditing(null);
      setDraft(null);
      refresh();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.detail);
    }
  }

  async function remove(provider: string) {
    if (!confirm(`Delete API key for ${provider}?`)) return;
    try {
      await api.admin.keys.remove(provider);
      toast.success(`${provider}: deleted`);
      refresh();
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.detail);
    }
  }

  async function test(provider: string) {
    setTesting(provider);
    try {
      const existing = byProvider.get(provider);
      const model = existing?.models?.[0];
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
      else toast.error(`${provider}: ${data.error ?? 'test failed'}`);
    } catch (e) {
      toast.error(`${provider}: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Configure LLM provider credentials. Saved keys override environment variables.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Key</th>
              <th className="px-4 py-2">Base URL</th>
              <th className="px-4 py-2">Models</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((p) => {
              const k = byProvider.get(p);
              const isEditing = editing === p;

              return (
                <tr key={p} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{p}</td>
                  <td className="px-4 py-3 font-mono">
                    {k?.has_key ? 'sk-••••••••' : <span className="text-muted-foreground">— not set —</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{k?.base_url || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{k?.models?.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {k?.has_key && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => test(p)}
                        disabled={testing === p}
                      >
                        {testing === p ? 'Testing…' : 'Test'}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => startEdit(p)}>
                      {k?.has_key ? 'Edit' : 'Add'}
                    </Button>
                    {k?.has_key && (
                      <Button size="sm" variant="destructive" onClick={() => remove(p)}>
                        Delete
                      </Button>
                    )}
                  </td>

                  {isEditing && draft && (
                    <td colSpan={5} className="px-4 pb-4 bg-muted/30">
                      <div className="grid gap-2 pt-3 max-w-xl">
                        <label className="text-xs font-medium">
                          API key {k?.has_key && <span className="text-muted-foreground">(leave blank to keep existing)</span>}
                        </label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="sk-..."
                          value={draft.api_key}
                          onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
                        />
                        <label className="text-xs font-medium">Base URL (optional)</label>
                        <Input
                          placeholder="https://..."
                          value={draft.base_url}
                          onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
                        />
                        <label className="text-xs font-medium">Models (comma-separated)</label>
                        <Input
                          placeholder="gpt-4o, gpt-4o-mini"
                          value={draft.models}
                          onChange={(e) => setDraft({ ...draft, models: e.target.value })}
                        />
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={save}>Save</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditing(null); setDraft(null); }}
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
