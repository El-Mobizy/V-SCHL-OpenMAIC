'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { SchoolBranding } from '@/lib/types/school';

type BrandingPatch = Partial<
  Pick<SchoolBranding, 'school_name' | 'primary_color' | 'secondary_color' | 'accent_color'>
>;

export function useBrandingEditor(initial: SchoolBranding) {
  const [current, setCurrent] = useState<SchoolBranding>(initial);
  const [draft, setDraft] = useState<BrandingPatch>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [isSaving, setSaving] = useState(false);

  const dirty = useMemo(() => {
    return Object.entries(draft).some(
      ([k, v]) => v !== undefined && current[k as keyof SchoolBranding] !== v,
    );
  }, [draft, current]);

  const patch: BrandingPatch = useMemo(() => {
    const out: BrandingPatch = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v === undefined) continue;
      if (current[k as keyof SchoolBranding] === v) continue;
      (out as Record<string, string>)[k] = v as string;
    }
    return out;
  }, [draft, current]);

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.admin.branding.update(patch);
      setCurrent(result);
      setDraft({});
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, 'NETWORK', String(e)));
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof BrandingPatch>(key: K, value: BrandingPatch[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return { current, draft, setField, dirty, save, error, isSaving, patch };
}
