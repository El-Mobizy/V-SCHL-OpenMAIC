import { cookies } from 'next/headers';
import { DashboardView } from '@/components/admin/dashboard-view';
import type { AdminStats } from '@/lib/types/school';

async function fetchStats(accessToken: string): Promise<AdminStats | null> {
  try {
    const res = await fetch(`${process.env.SYMFONY_API_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminStats;
  } catch {
    return null;
  }
}

export default async function AdminDashboardPage() {
  const token = (await cookies()).get('access_token')?.value ?? '';
  const initial = token ? await fetchStats(token) : null;
  return <DashboardView initial={initial} />;
}
