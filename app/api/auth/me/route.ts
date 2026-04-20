// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractUser } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = extractUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { user },
    {
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
