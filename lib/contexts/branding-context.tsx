'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SchoolBranding } from '@/lib/types/school';
import { api } from '@/lib/api/symfony';

interface BrandingContextValue {
  branding: SchoolBranding | null;
  isLoaded: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isLoaded: false,
});

function applyBrandingSideEffects(data: SchoolBranding) {
  const root = document.documentElement;
  if (data.primary_color) root.style.setProperty('--primary', data.primary_color);
  if (data.secondary_color) root.style.setProperty('--secondary', data.secondary_color);
  if (data.accent_color) root.style.setProperty('--accent', data.accent_color);
  if (data.school_name) document.title = data.school_name;
}

export function BrandingProvider({
  children,
  initialBranding = null,
}: {
  children: ReactNode;
  initialBranding?: SchoolBranding | null;
}) {
  const [branding, setBranding] = useState<SchoolBranding | null>(initialBranding);
  const [isLoaded, setIsLoaded] = useState(initialBranding !== null);

  useEffect(() => {
    // Server already resolved branding and the root layout inlined the CSS
    // variables and <title>. No client refetch needed.
    if (initialBranding) return;

    api.school
      .branding()
      .then((data) => {
        setBranding(data);
        applyBrandingSideEffects(data);
      })
      .catch(() => {
        // Fallback to default branding
      })
      .finally(() => setIsLoaded(true));
  }, [initialBranding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoaded }}>{children}</BrandingContext.Provider>
  );
}

export function useBrandingContext() {
  return useContext(BrandingContext);
}
