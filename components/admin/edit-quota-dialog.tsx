'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api/symfony';
import { ApiError } from '@/lib/api/errors';
import type { TokenQuota } from '@/lib/types/school';

interface Props {
  studentUuid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: Pick<TokenQuota, 'max_tokens' | 'used_tokens' | 'reset_date'>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function EditQuotaDialog({ studentUuid, open, onOpenChange, current }: Props) {
  const router = useRouter();
  const [maxTokens, setMaxTokens] = useState('');
  const [usedTokens, setUsedTokens] = useState('');
  const [resetDate, setResetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const patch = useMemo<Partial<TokenQuota>>(() => {
    const p: Partial<TokenQuota> = {};
    if (maxTokens !== '') p.max_tokens = Number(maxTokens);
    if (usedTokens !== '') p.used_tokens = Number(usedTokens);
    if (resetDate !== '') p.reset_date = resetDate;
    return p;
  }, [maxTokens, usedTokens, resetDate]);

  const validationError: string | null = (() => {
    if (Object.keys(patch).length === 0) return null;
    if (patch.max_tokens !== undefined && (!Number.isInteger(patch.max_tokens) || patch.max_tokens < 1)) {
      return 'Max tokens must be a positive integer.';
    }
    if (patch.used_tokens !== undefined && (!Number.isInteger(patch.used_tokens) || patch.used_tokens < 0)) {
      return 'Used tokens must be a non-negative integer.';
    }
    if (patch.reset_date !== undefined && !DATE_RE.test(patch.reset_date)) {
      return 'Reset date must be in YYYY-MM-DD format.';
    }
    return null;
  })();

  const canSave = Object.keys(patch).length > 0 && !validationError && !submitting;

  function reset() {
    setMaxTokens('');
    setUsedTokens('');
    setResetDate('');
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSave() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.admin.quota.upsert(studentUuid, patch);
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) setError('Student not found.');
        else if (e.status === 403) setError('You no longer have admin access.');
        else if (e.status === 400) setError(e.detail || 'Invalid input.');
        else setError('Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Edit token quota</DialogTitle>
        <DialogDescription>
          Leave a field blank to keep its current value. At least one field must be set.
        </DialogDescription>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="quota-max">
              Max tokens
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                current: {current.max_tokens.toLocaleString('en-GB')}
              </span>
            </Label>
            <Input
              id="quota-max"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 250000"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota-used">
              Used tokens
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                current: {current.used_tokens.toLocaleString('en-GB')}
              </span>
            </Label>
            <Input
              id="quota-used"
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 0 to reset the counter"
              value={usedTokens}
              onChange={(e) => setUsedTokens(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota-reset-date">
              Reset date
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                current: {current.reset_date}
              </span>
            </Label>
            <Input
              id="quota-reset-date"
              type="date"
              value={resetDate}
              onChange={(e) => setResetDate(e.target.value)}
            />
          </div>

          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
