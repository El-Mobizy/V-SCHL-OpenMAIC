import type { SchoolBranding } from '@/lib/types/school';
import { BrandingClient } from '@/components/admin/branding-client';

async function fetchBranding(): Promise<SchoolBranding | null> {
  try {
    const res = await fetch(`${process.env.SYMFONY_API_URL}/api/school/branding`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as SchoolBranding;
  } catch {
    return null;
  }
}

export default async function BrandingPage() {
  const branding = await fetchBranding();
  if (!branding) {
    return <div className="p-6 text-sm text-muted-foreground">Couldn&apos;t load branding.</div>;
  }
  return <BrandingClient initial={branding} />;
}
