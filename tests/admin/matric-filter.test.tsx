import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatricFilter } from '@/components/admin/matric-filter';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MatricFilter', () => {
  it('rapid keystrokes produce only ONE debounced call with the final value', async () => {
    const onChange = vi.fn();
    // Use a very short delay so the real timer test is fast
    render(<MatricFilter onDebouncedChange={onChange} delayMs={20} />);
    const input = screen.getByRole('textbox');
    // Type quickly (within 20ms window) - typing is synchronous in user-event
    const user = userEvent.setup({ delay: null });
    await user.type(input, 'CS');
    // Wait for the debounce to fire
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('CS');
  }, 10000);

  it('clear button empties input and fires onDebouncedChange("")', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<MatricFilter initial="CS101" onDebouncedChange={onChange} delayMs={20} />);
    // Wait for initial mount debounce
    await act(() => new Promise((r) => setTimeout(r, 50)));
    onChange.mockClear();

    const clearBtn = screen.getAllByRole('button', { name: /clear filter/i })[0];
    await user.click(clearBtn);
    await act(() => new Promise((r) => setTimeout(r, 50)));
    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith('');
  }, 10000);
});
