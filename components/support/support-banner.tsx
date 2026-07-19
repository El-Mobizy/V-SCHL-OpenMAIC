'use client';

import { useSupportSession } from '@/lib/support/useSupportSession';

export function SupportBanner() {
  const { active, schoolName, scope, isReadOnly, breakGlass, exit } =
    useSupportSession();

  if (!active) return null;

  const scopeLabel = scope === 'write' ? 'Read-write' : 'Read-only';

  return (
    <div
      className={`sticky top-0 z-[299] flex items-center justify-center gap-3 px-5 py-2 min-h-[36px] text-sm font-medium text-white text-center leading-relaxed shadow-md ${
        breakGlass
          ? 'bg-gradient-to-r from-red-600 to-red-800 font-semibold animate-pulse'
          : 'bg-gradient-to-r from-amber-700 to-amber-800'
      }`}
      role="alert"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 flex-wrap justify-center">
        <span aria-hidden="true">{'\u26A0'}</span>
        <span>Support session</span>
        <span className="opacity-50">&middot;</span>
        <span>
          viewing <strong>{schoolName ?? 'unknown school'}</strong>
        </span>
        <span className="opacity-50">&middot;</span>
        <span className="uppercase text-[0.7rem] font-semibold tracking-wider px-1.5 py-0.5 rounded bg-white/20">
          {scopeLabel}
        </span>
        {breakGlass && (
          <>
            <span className="opacity-50">&middot;</span>
            <span className="uppercase text-[0.7rem] font-bold tracking-widest px-2 py-0.5 rounded bg-black/35 text-red-300">
              Break-glass
            </span>
          </>
        )}
      </span>

      <button
        onClick={exit}
        type="button"
        aria-label="Exit support session"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-white/35 text-xs font-semibold cursor-pointer whitespace-nowrap bg-white/12 hover:bg-white/22 focus-visible:outline-2 focus-visible:outline-white transition-colors"
      >
        Exit
      </button>
    </div>
  );
}
