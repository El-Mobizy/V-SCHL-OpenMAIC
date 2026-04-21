'use client';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, X } from 'lucide-react';
import { api } from '@/lib/api/symfony';
import { Pagination } from '@/components/admin/pagination';
import { EditQuotaDialog } from '@/components/admin/edit-quota-dialog';
import type { AdminTokenUsageRow, PaginatedMeta } from '@/lib/types/school';

function joinMeta(
  department: string | null,
  program: string | null,
  level: string | null,
): string {
  const parts = [department, program, level].filter(
    (p): p is string => p !== null && p !== undefined && p !== '',
  );
  return parts.length === 0 ? '—' : parts.join(' / ');
}

function formatName(firstname: string, lastname: string): string {
  return `${lastname}, ${firstname}`;
}

export function TokenUsageTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<AdminTokenUsageRow[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AdminTokenUsageRow | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Debounce the search input, skipping the initial-mount firing so we don't
  // duplicate the page-1 load.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the Symfony API is an external system; gating loading/error state around the fetch is the intended pattern
    setLoading(true);
    setError(null);
    api.admin.tokenUsage
      .list({ page, limit: 30, ...(debouncedSearch ? { search: debouncedSearch } : {}) })
      .then((resp) => {
        if (cancelled) return;
        setRows(resp.data);
        setMeta(resp.meta);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load token usage');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <Input
          type="search"
          placeholder="Search by name, email, or matric…"
          aria-label="Search token usage"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm text-destructive border border-destructive/40 rounded-md px-3 py-2"
        >
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No token usage yet — this list only lists students who have interacted with the AI
          integration.
        </p>
      ) : (
        rows.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th scope="col" className="px-4 py-2">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Dept / Program / Level
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Tokens
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Reset date
                  </th>
                  <th scope="col" className="px-4 py-2">
                    This month
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Last activity
                  </th>
                  <th scope="col" className="px-4 py-2 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student_uuid} className="border-t">
                    <td className="px-4 py-3">{formatName(r.firstname, r.lastname)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {joinMeta(r.department, r.program, r.level)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {r.tokens_used.toLocaleString()} / {r.tokens_max.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.tokens_reset_date}</td>
                    <td className="px-4 py-3 font-mono">
                      {r.tokens_this_month.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground"
                      title={r.last_activity_at ?? undefined}
                    >
                      {r.last_activity_at ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRow(r)}
                        aria-label={`Edit quota for ${formatName(r.firstname, r.lastname)}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {meta && meta.total_pages > 1 && (
        <Pagination meta={meta} onPageChange={(p) => setPage(p)} />
      )}

      {selectedRow !== null && (
        <EditQuotaDialog
          studentUuid={selectedRow.student_uuid}
          open={selectedRow !== null}
          onOpenChange={(next) => {
            if (!next) setSelectedRow(null);
          }}
          current={{
            max_tokens: selectedRow.tokens_max,
            used_tokens: selectedRow.tokens_used,
            reset_date: selectedRow.tokens_reset_date,
          }}
          onSaved={() => {
            setSelectedRow(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
