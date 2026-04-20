import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandingForm } from '@/components/admin/branding-form';
import { api } from '@/lib/api/symfony';
import type { SchoolBranding } from '@/lib/types/school';

const INITIAL: SchoolBranding = {
  school_name: 'Test School',
  primary_color: '#123456',
  secondary_color: '#abcdef',
  accent_color: '#ffffff',
  logo_url: '',
};

vi.mock('@/lib/api/symfony', () => ({
  api: {
    admin: {
      branding: {
        update: vi.fn(),
      },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe('BrandingForm', () => {
  it('invalid hex (#abc) shows error, save disabled', async () => {
    const user = userEvent.setup();
    render(<BrandingForm initial={INITIAL} />);
    // Get the hex text input for primary color (not the color picker)
    const primaryInput = screen.getByRole('textbox', { name: /primary color/i });
    await user.clear(primaryInput);
    await user.type(primaryInput, '#abc');
    fireEvent.blur(primaryInput);
    expect(screen.getByText(/invalid hex/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /save/i });
    // Save should be disabled — no valid dirty fields
    expect(saveBtn).toBeDisabled();
  });

  it('valid hex (#aabbcc) enables save', async () => {
    const user = userEvent.setup();
    render(<BrandingForm initial={INITIAL} />);
    const primaryInput = screen.getByRole('textbox', { name: /primary color/i });
    await user.clear(primaryInput);
    await user.type(primaryInput, '#aabbcc');
    fireEvent.blur(primaryInput);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).not.toBeDisabled();
  });

  it('typing only school_name produces patch with ONLY school_name', async () => {
    const mockUpdate = vi.mocked(api.admin.branding.update);
    mockUpdate.mockResolvedValue({ ...INITIAL, school_name: 'New Name' });
    const user = userEvent.setup();
    render(<BrandingForm initial={INITIAL} />);
    const nameInput = screen.getByRole('textbox', { name: /school name/i });
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await user.click(saveBtn);
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const calledWith = mockUpdate.mock.calls[0][0];
    expect(Object.keys(calledWith)).toEqual(['school_name']);
    expect(calledWith.school_name).toBe('New Name');
  });
});
