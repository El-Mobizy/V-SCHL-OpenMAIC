import type { SchoolBranding } from '@/lib/types/school';

export async function getServerBranding(): Promise<SchoolBranding | null> {
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
