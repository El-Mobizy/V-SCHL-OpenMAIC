'use client';

import { useBrandingContext } from '@/lib/contexts/branding-context';
import { resolveBrandingAssetUrl } from '@/lib/api/symfony';

export function useBranding() {
  const { branding, isLoaded } = useBrandingContext();
  return {
    logoUrl: resolveBrandingAssetUrl(branding?.logo_url) || '/logo-horizontal.png',
    schoolName: branding?.school_name ?? 'OpenMAIC',
    primaryColor: branding?.primary_color ?? '#722ed1',
    secondaryColor: branding?.secondary_color,
    accentColor: branding?.accent_color,
    isLoaded,
  };
}
