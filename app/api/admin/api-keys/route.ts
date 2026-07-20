import { NextRequest, NextResponse } from 'next/server';
import { extractUser } from '@/lib/auth/jwt';

const SYMFONY_API_URL = process.env.SYMFONY_API_URL!;

function requireAdmin(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) return { error: 'Unauthorized', status: 401 };
  const user = extractUser(accessToken);
  if (!user || user.role !== 'admin') return { error: 'Forbidden', status: 403 };
  return { accessToken, user };
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const res = await fetch(`${SYMFONY_API_URL}/api/admin/api-keys`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const res = await fetch(`${SYMFONY_API_URL}/api/admin/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(req);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { provider } = await req.json();
  const res = await fetch(`${SYMFONY_API_URL}/api/admin/api-keys/${provider}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  return NextResponse.json({ ok: res.ok }, { status: res.status });
}
