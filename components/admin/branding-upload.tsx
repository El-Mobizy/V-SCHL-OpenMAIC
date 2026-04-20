'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import type { SchoolBranding } from '@/lib/types/school';

interface BrandingUploadProps {
  label: string;
  currentUrl: string;
  uploader: (file: File) => Promise<SchoolBranding>;
  maxBytes: number;
  acceptMime: string[];
  onSuccess?: (b: SchoolBranding) => void;
}

export function BrandingUpload({
  label,
  currentUrl,
  uploader,
  maxBytes,
  acceptMime,
  onSuccess,
}: BrandingUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);

    if (file.size > maxBytes) {
      const mb = (maxBytes / (1024 * 1024)).toFixed(1);
      setUploadError(`File too large (max ${mb} MB)`);
      return;
    }

    if (!acceptMime.includes(file.type)) {
      setUploadError('File format not supported');
      return;
    }

    setUploading(true);
    try {
      const result = await uploader(file);
      setUploadError(null);
      toast.success(`${label} updated`);
      onSuccess?.(result);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'PAYLOAD_TOO_LARGE') {
          const mb = (maxBytes / (1024 * 1024)).toFixed(1);
          setUploadError(`File too large (max ${mb} MB)`);
        } else if (e.code === 'UNSUPPORTED_MEDIA_TYPE') {
          setUploadError('File format not supported');
        } else {
          setUploadError(e.detail);
        }
      } else {
        setUploadError(String(e));
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {currentUrl && (
        <img
          src={currentUrl}
          alt={label}
          width={96}
          height={96}
          loading="lazy"
          className="rounded border object-contain bg-muted"
          style={{ width: 96, height: 96 }}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept={acceptMime.join(',')}
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          // reset input so same file can be re-selected
          e.target.value = '';
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </Button>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}
