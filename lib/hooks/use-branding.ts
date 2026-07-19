'use client';

import { useBrandingContext } from '@/lib/contexts/branding-context';
import { resolveBrandingAssetUrl } from '@/lib/api/symfony';

export function useBranding() {
  const { branding, isLoaded } = useBrandingContext();
  return {
    logoUrl: resolveBrandingAssetUrl(branding?.logo_url) || '/logo.svg',
    schoolName: branding?.school_name ?? 'DV-CLASS',
    primaryColor: branding?.primary_color ?? '#00B2C2',
    secondaryColor: branding?.secondary_color,
    accentColor: branding?.accent_color,
    isLoaded,
  };
}
