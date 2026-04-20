'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Cpu, Check } from 'lucide-react';
import { api } from '@/lib/api/symfony';
import { useAuth } from '@/lib/contexts/auth-context';
import type { AvailableProvider } from '@/lib/types/school';
import {
  getModelOverride,
  setModelOverride,
  clearModelOverride,
} from '@/lib/stores/model-override';
import { cn } from '@/lib/utils';

export function ModelOverridePicker() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [override, setOverride] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.student_uuid) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external system; syncing it into state on mount is the intended use-case for useEffect
    setOverride(getModelOverride(user.student_uuid));
  }, [user?.student_uuid]);

  useEffect(() => {
    if (!user) return;
    api.providers
      .list()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [user]);

  if (!user || user.role !== 'student') return null;

  const pick = (modelString: string) => {
    setModelOverride(user.student_uuid, modelString);
    setOverride(modelString);
    setOpen(false);
  };

  const reset = () => {
    clearModelOverride(user.student_uuid);
    setOverride(null);
    setOpen(false);
  };

  const label = override
    ? override.split(':').slice(-1)[0]
    : 'Default model';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs hover:border-primary/40"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={override ? `Active model: ${label}. Click to change.` : 'Choose a preferred model'}
      >
        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate max-w-[140px]">{label}</span>
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-64 max-h-80 overflow-auto rounded-md border bg-popover shadow-lg"
        >
          <button
            type="button"
            onClick={reset}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted',
              override === null && 'bg-primary/5 text-primary',
            )}
          >
            {override === null && <Check className="h-3 w-3" aria-hidden="true" />}
            <span>Use school default</span>
          </button>
          {providers.map((p) => (
            <div key={p.id} className="border-t">
              <div className="px-3 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {p.name}
              </div>
              {p.models.map((m) => {
                const modelString = `${p.id}:${m.id}`;
                const active = override === modelString;
                return (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(modelString)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted',
                      active && 'bg-primary/5 text-primary',
                    )}
                  >
                    {active && <Check className="h-3 w-3" aria-hidden="true" />}
                    <span className="truncate">{m.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
