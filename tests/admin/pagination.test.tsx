import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '@/components/admin/pagination';
import type { PaginatedMeta } from '@/lib/types/school';

function makeMeta(page: number, total_pages: number): PaginatedMeta {
  return { page, total_pages, limit: 30, total: total_pages * 30 };
}

afterEach(() => cleanup());

describe('Pagination', () => {
  it('disables prev at page 1', () => {
    render(<Pagination meta={makeMeta(1, 5)} onPageChange={() => {}} />);
    const [prev] = screen.getAllByRole('button');
    expect(prev).toBeDisabled();
  });

  it('disables next at last page', () => {
    render(<Pagination meta={makeMeta(5, 5)} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    const next = buttons[buttons.length - 1];
    expect(next).toBeDisabled();
  });

  it('renders Page X of Y', () => {
    render(<Pagination meta={makeMeta(3, 7)} onPageChange={() => {}} />);
    expect(screen.getByText('Page 3 of 7')).toBeInTheDocument();
  });

  it('emits onPageChange(n-1) on prev click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination meta={makeMeta(3, 5)} onPageChange={onChange} />);
    const [prev] = screen.getAllByRole('button');
    await user.click(prev);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('emits onPageChange(n+1) on next click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination meta={makeMeta(3, 5)} onPageChange={onChange} />);
    const buttons = screen.getAllByRole('button');
    const next = buttons[buttons.length - 1];
    await user.click(next);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
