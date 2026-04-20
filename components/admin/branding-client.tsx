'use client';
import { useState } from 'react';
import { BrandingForm } from '@/components/admin/branding-form';
import { BrandingUpload } from '@/components/admin/branding-upload';
import { api, resolveBrandingAssetUrl } from '@/lib/api/symfony';
import { revalidateBranding } from '@/app/admin/settings/branding/actions';
import type { SchoolBranding } from '@/lib/types/school';

export function BrandingClient({ initial }: { initial: SchoolBranding }) {
  const [branding, setBranding] = useState<SchoolBranding>(initial);

  async function handleUploadSuccess(b: SchoolBranding) {
    setBranding(b);
    try {
      await revalidateBranding();
    } catch (err) {
      console.warn('[branding] revalidateBranding failed after upload:', err);
    }
  }

  return (
    <div className="space-y-8">
      <BrandingForm initial={branding} />

      <div className="border-t pt-6 space-y-6">
        <h2 className="text-lg font-semibold">Logo &amp; Favicon</h2>
        <div className="flex flex-wrap gap-8">
          <BrandingUpload
            label="Logo"
            currentUrl={resolveBrandingAssetUrl(branding.logo_url)}
            uploader={api.admin.branding.uploadLogo}
            maxBytes={2 * 1024 * 1024}
            acceptMime={['image/png', 'image/jpeg', 'image/webp']}
            onSuccess={handleUploadSuccess}
          />
          <BrandingUpload
            label="Favicon"
            currentUrl={resolveBrandingAssetUrl(branding.favicon_url)}
            uploader={api.admin.branding.uploadFavicon}
            maxBytes={512 * 1024}
            acceptMime={['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']}
            onSuccess={handleUploadSuccess}
          />
        </div>
      </div>
    </div>
  );
}
