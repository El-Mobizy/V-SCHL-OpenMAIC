'use client';
import { useState } from 'react';
import { BrandingForm } from '@/components/admin/branding-form';
import { BrandingUpload } from '@/components/admin/branding-upload';
import { api } from '@/lib/api/symfony';
import type { SchoolBranding } from '@/lib/types/school';

export function BrandingClient({ initial }: { initial: SchoolBranding }) {
  const [branding, setBranding] = useState<SchoolBranding>(initial);

  return (
    <div className="space-y-8">
      <BrandingForm initial={branding} />

      <div className="border-t pt-6 space-y-6">
        <h2 className="text-lg font-semibold">Logo &amp; Favicon</h2>
        <div className="flex flex-wrap gap-8">
          <BrandingUpload
            label="School logo"
            currentUrl={branding.logo_url}
            uploader={api.admin.branding.uploadLogo}
            maxBytes={2 * 1024 * 1024}
            acceptMime={['image/png', 'image/jpeg', 'image/webp']}
            onSuccess={setBranding}
          />
          <BrandingUpload
            label="Favicon"
            currentUrl={branding.favicon_url ?? ''}
            uploader={api.admin.branding.uploadFavicon}
            maxBytes={512 * 1024}
            acceptMime={['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']}
            onSuccess={setBranding}
          />
        </div>
      </div>
    </div>
  );
}
