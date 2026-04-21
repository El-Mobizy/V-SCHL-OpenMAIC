import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTokenUsageRow, PaginatedResponse } from '@/lib/types/school';

vi.mock('@/lib/api/symfony', () => ({
  api: {
    admin: {
      tokenUsage: {
        list: vi.fn(),
      },
    },
  },
}));

import { api } from '@/lib/api/symfony';
import { TokenUsageTable } from '@/components/admin/token-usage-table';

function makeRow(overrides: Partial<AdminTokenUsageRow> = {}): AdminTokenUsageRow {
  return {
    student_uuid: '01JXYZABCDEF0123456789ABCD',
    firstname: 'Ada',
    lastname: 'Lovelace',
    email: 'ada@example.edu',
    department: 'Computer Science',
    program: 'BSc',
    level: '300',
    tokens_used: 12345,
    tokens_max: 100000,
    tokens_reset_date: '2026-05-01',
    tokens_this_month: 12345,
    last_activity_at: '2026-04-21T10:15:00Z',
    ...overrides,
  };
}

function makeResponse(
  rows: AdminTokenUsageRow[],
  page = 1,
  total_pages = 1,
): PaginatedResponse<AdminTokenUsageRow> {
  return {
    data: rows,
    meta: { page, limit: 30, total: rows.length, total_pages },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('TokenUsageTable', () => {
  beforeEach(() => {
    vi.mocked(api.admin.tokenUsage.list).mockResolvedValue(makeResponse([makeRow()]));
  });

  it('fetches page 1 with limit 30 on mount (no search)', async () => {
    render(<TokenUsageTable />);
    await waitFor(() => {
      expect(vi.mocked(api.admin.tokenUsage.list)).toHaveBeenCalledWith({
        page: 1,
        limit: 30,
      });
    });
  });

  it('renders row data (lastname) after fetch resolves', async () => {
    render(<TokenUsageTable />);
    expect(await screen.findByText(/Lovelace/)).toBeInTheDocument();
  });

  it('debounces the search input to a single fetch with search param', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TokenUsageTable />);

    // Wait for the initial mount fetch to resolve.
    await waitFor(() => {
      expect(vi.mocked(api.admin.tokenUsage.list)).toHaveBeenCalledTimes(1);
    });
    vi.mocked(api.admin.tokenUsage.list).mockClear();

    const searchbox = screen.getByRole('searchbox');
    await user.type(searchbox, 'ada');

    // Give the debounce a chance to fire (default 250ms in the component; we wait longer).
    await act(() => new Promise((r) => setTimeout(r, 400)));

    const calls = vi.mocked(api.admin.tokenUsage.list).mock.calls;
    // Exactly one debounced call after typing.
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toEqual({ page: 1, limit: 30, search: 'ada' });
  }, 10000);

  it('renders empty-state mirror-only message when data is empty', async () => {
    vi.mocked(api.admin.tokenUsage.list).mockResolvedValueOnce(makeResponse([]));
    render(<TokenUsageTable />);
    await waitFor(() => {
      expect(
        screen.getByText(/only lists students who have interacted with the AI integration/i),
      ).toBeInTheDocument();
    });
  });
});
