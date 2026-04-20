import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { StudentStats } from '@/lib/types/school';
import { StudentStatsView } from '@/components/admin/student-stats-view';

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

async function fetchStats(ulid: string, accessToken: string): Promise<StudentStats | null> {
  try {
    const res = await fetch(`${process.env.SYMFONY_API_URL}/api/students/${ulid}/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as StudentStats;
  } catch {
    return null;
  }
}

export default async function StudentDetailPage({ params }: { params: Promise<{ ulid: string }> }) {
  const { ulid } = await params;
  if (!ULID_RE.test(ulid)) notFound();

  const token = (await cookies()).get('access_token')?.value ?? '';
  const stats = token ? await fetchStats(ulid, token) : null;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/students"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ChevronLeft className="h-4 w-4" /> Back to students
      </Link>
      <StudentStatsView ulid={ulid} stats={stats} />
    </div>
  );
}
