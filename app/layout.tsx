import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import type { CSSProperties } from 'react';
import './globals.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { AuthProvider } from '@/lib/contexts/auth-context';
import { BrandingProvider } from '@/lib/contexts/branding-context';
import { ApiErrorBoundary } from '@/components/api-error-boundary';
import { getServerBranding } from '@/lib/api/server-branding';

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getServerBranding();
  return {
    title: branding?.school_name ?? 'DV-CLASS',
    description:
      'The open-source AI interactive classroom. Upload a PDF to instantly generate an immersive, multi-agent learning experience.',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getServerBranding();

  const brandingStyle: CSSProperties = {};
  if (branding?.primary_color) {
    (brandingStyle as Record<string, string>)['--primary'] = branding.primary_color;
  }
  if (branding?.secondary_color) {
    (brandingStyle as Record<string, string>)['--secondary'] = branding.secondary_color;
  }
  if (branding?.accent_color) {
    (brandingStyle as Record<string, string>)['--accent'] = branding.accent_color;
  }

  return (
    <html
      lang="en"
      className={inter.variable}
      style={brandingStyle}
      suppressHydrationWarning
    >
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <BrandingProvider initialBranding={branding}>
                <ApiErrorBoundary>
                  <ServerProvidersInit />
                  {children}
                  <Toaster position="top-center" />
                </ApiErrorBoundary>
              </BrandingProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
