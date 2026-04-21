'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';
import {
  useTokenQuotaStore,
  selectQuotaPercentage,
  type TokenQuota,
} from '@/lib/store/token-quota';

const EDGE_PADDING = 16;
const DRAG_THRESHOLD_PX = 5;
const LS_KEY = 'token-orb-y';
const POLL_MS = 60_000;

function clampY(y: number, orbSize: number): number {
  if (typeof window === 'undefined') return y;
  const min = EDGE_PADDING;
  const max = Math.max(min, window.innerHeight - orbSize - EDGE_PADDING);
  return Math.min(max, Math.max(min, y));
}

function readStoredY(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function colorForPct(pct: number): { fill: string; wave: string } {
  if (pct >= 90) return { fill: '#ef4444', wave: '#dc2626' };
  if (pct >= 70) return { fill: '#f59e0b', wave: '#d97706' };
  return { fill: 'var(--primary, #0ea5e9)', wave: 'color-mix(in oklch, var(--primary, #0ea5e9), black 20%)' };
}

function LiquidFill({ pct }: { pct: number }) {
  const { fill, wave } = colorForPct(pct);
  // Always render the fill even at 0% so the wave peeks at the bottom. At 100%,
  // the waves sit above the orb and the body fully fills — handled by inset.
  const fillHeightPct = Math.max(2, pct);
  // Prefers-reduced-motion: pause waves and bob via CSS.
  return (
    <span
      aria-hidden
      className="absolute inset-0 rounded-full overflow-hidden"
      style={{ animation: 'orb-bob 3.2s ease-in-out 1 both' }}
    >
      <span
        className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{ height: `${fillHeightPct}%`, backgroundColor: fill, opacity: 0.85 }}
      >
        {/* Wave layer: SVG is 200% wide so translateX(-50%) loops seamlessly. */}
        <svg
          className="absolute left-0 h-[14px] w-[200%]"
          style={{
            top: -7,
            animation: 'orb-wave 3.6s linear 1 both',
          }}
          viewBox="0 0 240 14"
          preserveAspectRatio="none"
          role="presentation"
        >
          <path
            d="M0 7 Q 15 0, 30 7 T 60 7 T 90 7 T 120 7 T 150 7 T 180 7 T 210 7 T 240 7 V14 H0 Z"
            fill={fill}
            opacity={0.85}
          />
        </svg>
        {/* Second wave: opposite direction, slower, deeper shade — adds parallax depth. */}
        <svg
          className="absolute left-0 h-[10px] w-[200%]"
          style={{
            top: -3,
            animation: 'orb-wave 5.4s linear 1 reverse both',
          }}
          viewBox="0 0 240 10"
          preserveAspectRatio="none"
          role="presentation"
        >
          <path
            d="M0 5 Q 20 1, 40 5 T 80 5 T 120 5 T 160 5 T 200 5 T 240 5 V10 H0 Z"
            fill={wave}
            opacity={0.55}
          />
        </svg>
      </span>
    </span>
  );
}

function formatResetDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function TokenUsageOrb() {
  const quota = useTokenQuotaStore((s) => s.quota);
  const error = useTokenQuotaStore((s) => s.error);
  const fetchQuota = useTokenQuotaStore((s) => s.fetch);
  const refresh = useTokenQuotaStore((s) => s.refresh);
  const pct = useTokenQuotaStore(selectQuotaPercentage);

  const [orbSize, setOrbSize] = useState(56);
  const [y, setY] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Bumping this remounts the LiquidFill so its one-shot wave + bob animations replay.
  const [replayKey, setReplayKey] = useState(0);
  const replayAnimation = useCallback(() => setReplayKey((n) => n + 1), []);
  const [open, setOpen] = useState(false);

  const dragStateRef = useRef<{
    startY: number;
    startPointerY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initial mount: compute size + initial Y from window (SSR-safe: window only
  // exists client-side, so we can't initialise these via useState initialisers).
  // The setState calls are intentional one-time mount work.
  useEffect(() => {
    const size = window.innerWidth < 640 ? 48 : 56;
    const stored = readStoredY();
    const defaultY = window.innerHeight - size - EDGE_PADDING - 8;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrbSize(size);
    setY(clampY(stored ?? defaultY, size));
    fetchQuota();
  }, [fetchQuota]);

  // Responsive size + reclamp on resize.
  useEffect(() => {
    const onResize = () => {
      const size = window.innerWidth < 640 ? 48 : 56;
      setOrbSize(size);
      setY((prev) => (prev == null ? prev : clampY(prev, size)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Poll every 60s, only when the tab is visible.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          refresh();
        }
      }, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (y == null) return;
      (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      dragStateRef.current = {
        startY: y,
        startPointerY: e.clientY,
        moved: false,
        pointerId: e.pointerId,
      };
    },
    [y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      const delta = e.clientY - state.startPointerY;
      if (!state.moved && Math.abs(delta) >= DRAG_THRESHOLD_PX) {
        state.moved = true;
        setIsDragging(true);
      }
      if (!state.moved) return;

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const next = clampY(state.startY + delta, orbSize);
        setY(next);
      });
    },
    [orbSize],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== e.pointerId) return;
      try {
        (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }

      const moved = state.moved;
      dragStateRef.current = null;

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (moved) {
        setIsDragging(false);
        if (y != null) {
          try {
            window.localStorage.setItem(LS_KEY, String(Math.round(y)));
          } catch {
            /* ignore quota errors */
          }
        }
        // Prevent the synthetic click-from-pointerup from toggling the popover.
        e.preventDefault();
      } else {
        // Treated as a click: toggle the popover.
        setOpen((prev) => !prev);
      }
    },
    [y],
  );

  // Wait only for the client-side layout to be ready (SSR safe). The orb is
  // always visible for students regardless of whether the quota has loaded yet
  // — we show a placeholder state while loading or after a fetch error.
  if (y == null) return null;

  const hasQuota = quota != null;
  const displayPct = hasQuota ? pct : 0;
  const label = hasQuota
    ? `Token usage: ${pct}% used. Click to view details.`
    : error
      ? 'Token usage unavailable. Click to retry.'
      : 'Loading token usage…';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerEnter={replayAnimation}
          onPointerDown={(e) => {
            // Touch devices don't reliably fire pointerenter before pointerdown
            // — replay here too so a tap always retriggers the liquid animation.
            if (e.pointerType !== 'mouse') replayAnimation();
            onPointerDown(e);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={(e) => {
            // Popover trigger fires onClick; we manage open state ourselves above.
            e.preventDefault();
          }}
          className={cn(
            'fixed right-4 z-40 select-none touch-none',
            'flex items-center justify-center rounded-full',
            'border border-border bg-background/90 backdrop-blur',
            'shadow-lg ring-1 ring-black/5',
            'transition-transform',
            isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-105',
          )}
          style={{
            top: y,
            width: orbSize,
            height: orbSize,
          }}
        >
          <span className="sr-only">Token usage orb</span>
          <LiquidFill key={replayKey} pct={displayPct} />
          <span className="relative font-semibold text-xs text-foreground mix-blend-difference">
            {hasQuota ? `${pct}%` : '…'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="center"
        sideOffset={12}
        collisionPadding={16}
        className="w-72 max-w-[calc(100vw-32px)]"
      >
        {hasQuota ? (
          <OrbDetails quota={quota} pct={pct} />
        ) : (
          <OrbPlaceholder error={error} onRetry={() => refresh()} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function OrbPlaceholder({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Token usage</div>
      {error ? (
        <>
          <p className="text-xs text-muted-foreground">
            Could not load your quota right now.
          </p>
          <Button type="button" variant="secondary" className="w-full" onClick={onRetry}>
            Retry
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Loading your token usage…</p>
      )}
    </div>
  );
}

function OrbDetails({ quota, pct }: { quota: TokenQuota; pct: number }) {
  const remaining = Math.max(0, quota.maxTokens - quota.usedTokens);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-muted-foreground">Token usage</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
          <span className="text-xs text-muted-foreground">used this period</span>
        </div>
      </div>
      <Progress value={pct} className="h-2" />
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Used</dt>
          <dd className="font-medium tabular-nums">{quota.usedTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Remaining</dt>
          <dd className="font-medium tabular-nums">{remaining.toLocaleString()}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Resets on</dt>
          <dd className="font-medium">{formatResetDate(quota.resetDate)}</dd>
        </div>
      </dl>
      <Button
        type="button"
        disabled
        variant="secondary"
        className="w-full"
        title="Coming soon"
      >
        Get more tokens
      </Button>
    </div>
  );
}
