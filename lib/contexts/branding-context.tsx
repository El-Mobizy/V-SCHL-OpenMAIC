'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SchoolBranding } from '@/lib/types/school';
import { fetchBranding } from '@/lib/api/symfony-client';

interface BrandingContextValue {
  branding: SchoolBranding | null;
  isLoaded: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: null,
  isLoaded: false,
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<SchoolBranding | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetchBranding()
      .then((data) => {
        setBranding(data);
        // Apply CSS variable overrides
        const root = document.documentElement;
        if (data.primary_color) root.style.setProperty('--primary', data.primary_color);
        if (data.secondary_color) root.style.setProperty('--secondary', data.secondary_color);
        if (data.accent_color) root.style.setProperty('--accent', data.accent_color);
        // Update page title
        if (data.school_name) document.title = data.school_name;
      })
      .catch(() => {
        // Fallback to default branding
      })
      .finally(() => setIsLoaded(true));
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoaded }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBrandingContext() {
  return useContext(BrandingContext);
}
