import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { decodeJwtPayload, isTokenExpired } from '@/lib/auth/jwt';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get('access_token')?.value;
  if (!token || isTokenExpired(token)) notFound();
  const payload = decodeJwtPayload(token);
  if (payload?.role !== 'admin') notFound();
  return <AdminShell>{children}</AdminShell>;
}
