import { cookies } from 'next/headers';
import { DashboardView } from '@/components/admin/dashboard-view';
import type { AdminStats } from '@/lib/types/school';

async function fetchStats(accessToken: string): Promise<AdminStats | null> {
  try {
    // /api/admin/stats returns platform-wide counters identical across admins,
    // so Next's server-shared data cache is safe here. Revalidate every 60s to
    // match the backend's own 60s cache window.
    const res = await fetch(`${process.env.SYMFONY_API_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 60 },
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
