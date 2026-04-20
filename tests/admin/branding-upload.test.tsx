import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrandingUpload } from '@/components/admin/branding-upload';
import type { SchoolBranding } from '@/lib/types/school';

const BRANDING: SchoolBranding = {
  school_name: 'Test',
  primary_color: '#000',
  secondary_color: '#fff',
  accent_color: '#00f',
  logo_url: '',
};

function triggerFileInput(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe('BrandingUpload', () => {
  it('uploading a file larger than maxBytes surfaces size error without calling uploader', async () => {
    const uploader = vi.fn<(file: File) => Promise<SchoolBranding>>();
    render(
      <BrandingUpload
        label="Logo"
        currentUrl=""
        uploader={uploader}
        maxBytes={1024}
        acceptMime={['image/png', 'image/jpeg', 'image/webp']}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['x'.repeat(2048)], 'logo.png', { type: 'image/png' });
    triggerFileInput(input, bigFile);
    await waitFor(() => expect(screen.getByText(/file too large/i)).toBeInTheDocument());
    expect(uploader).not.toHaveBeenCalled();
  });

  it('uploading wrong MIME surfaces format error without calling uploader', async () => {
    const uploader = vi.fn<(file: File) => Promise<SchoolBranding>>();
    render(
      <BrandingUpload
        label="Logo"
        currentUrl=""
        uploader={uploader}
        maxBytes={2 * 1024 * 1024}
        acceptMime={['image/png', 'image/jpeg', 'image/webp']}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['hello'], 'doc.txt', { type: 'text/plain' });
    triggerFileInput(input, badFile);
    await waitFor(() => expect(screen.getByText(/file format not supported/i)).toBeInTheDocument());
    expect(uploader).not.toHaveBeenCalled();
  });

  it('valid file invokes uploader exactly once', async () => {
    const uploader = vi.fn<(file: File) => Promise<SchoolBranding>>().mockResolvedValue(BRANDING);
    render(
      <BrandingUpload
        label="Logo"
        currentUrl=""
        uploader={uploader}
        maxBytes={2 * 1024 * 1024}
        acceptMime={['image/png', 'image/jpeg', 'image/webp']}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['imgdata'], 'logo.png', { type: 'image/png' });
    triggerFileInput(input, validFile);
    await waitFor(() => expect(uploader).toHaveBeenCalledTimes(1));
    expect(uploader).toHaveBeenCalledWith(validFile);
  });
});
