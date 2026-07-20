'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { BulkQuotaRequest, BulkQuotaResult } from '@/lib/types/school';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const numFmt = new Intl.NumberFormat('en-GB');

export function BulkQuotaForm() {
  const [maxTokens, setMaxTokens] = useState('');
  const [resetDate, setResetDate] = useState('');
  const [resetUsed, setResetUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkQuotaResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedMax = maxTokens === '' ? null : Number(maxTokens);
  const validationError: string | null = (() => {
    if (parsedMax === null) return null;
    if (!Number.isInteger(parsedMax) || parsedMax < 1) return 'Max tokens must be a positive integer.';
    if (resetDate !== '' && !DATE_RE.test(resetDate)) return 'Reset date must be in YYYY-MM-DD format.';
    return null;
  })();

  const canSubmit = parsedMax !== null && !validationError && !submitting;

  async function submit() {
    if (!canSubmit || parsedMax === null) return;
    setSubmitting(true);
    setError(null);
    const body: BulkQuotaRequest = { max_tokens: parsedMax };
    if (resetDate !== '') body.reset_date = resetDate;
    if (resetUsed) body.reset_used_tokens = true;
    try {
      const res = await api.admin.quota.setDefault(body);
      setResult(res);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 403) setError('You no longer have admin access.');
        else if (e.status === 400) setError(e.detail || 'Invalid input.');
        else setError('Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setResult(null);
    if (resetUsed) {
      setConfirmOpen(true);
      return;
    }
    void submit();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-max">Max tokens (required)</Label>
          <Input
            id="bulk-max"
            type="number"
            min={1}
            step={1}
            placeholder="e.g. 250000"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">Positive integer. Applied to every row.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bulk-reset-date">Reset date (optional)</Label>
          <Input
            id="bulk-reset-date"
            type="date"
            value={resetDate}
            onChange={(e) => setResetDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to keep each row&apos;s existing reset date.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <Checkbox
            id="bulk-reset-used"
            checked={resetUsed}
            onCheckedChange={(v) => setResetUsed(v === true)}
          />
          <div className="space-y-1">
            <Label htmlFor="bulk-reset-used" className="cursor-pointer">
              Zero the <code>used_tokens</code> counter on every row
            </Label>
            <p className="text-xs text-muted-foreground">
              Destructive. You&apos;ll be asked to confirm before this is sent.
            </p>
          </div>
        </div>

        {validationError && <p className="text-sm text-destructive">{validationError}</p>}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            Updated <strong>{numFmt.format(result.updated_rows)}</strong> row
            {result.updated_rows === 1 ? '' : 's'}. Max tokens:{' '}
            <strong>{numFmt.format(result.max_tokens)}</strong>
            {result.reset_date ? ` · Reset date: ${result.reset_date}` : ''}
            {result.reset_used_tokens ? ' · Counters zeroed' : ''}.
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {submitting ? 'Applying…' : 'Apply to all rows'}
          </Button>
        </div>
      </form>

      <aside className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
        <h2 className="font-medium">Scope</h2>
        <p className="text-muted-foreground">
          This updates rows that already exist in <code>token_quota</code>. Students who have never
          reported usage have no row yet — their first usage report will create one using the entity
          default (<strong>900,000</strong>). Rerun this bulk update after new students start using
          the platform, or edit those students individually from their detail page.
        </p>
      </aside>

      {confirmOpen && (
        <ConfirmResetDialog
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submit}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function ConfirmResetDialog({
  onCancel,
  onConfirm,
  submitting,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-reset-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border bg-background p-4 shadow-lg space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-reset-title" className="text-lg font-semibold">
          Zero everyone&apos;s counter?
        </h2>
        <p className="text-sm text-muted-foreground">
          This will set <code>used_tokens = 0</code> on every existing student quota row. The total
          number of rows affected will be shown after the update completes.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={submitting}>
            {submitting ? 'Applying…' : 'Yes, reset counters'}
          </Button>
        </div>
      </div>
    </div>
  );
}
