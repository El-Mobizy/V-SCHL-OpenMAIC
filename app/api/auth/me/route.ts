// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtPayload, isTokenExpired } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token || isTokenExpired(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const p = decodeJwtPayload(token);
  if (!p?.sub) return NextResponse.json({ error: 'Malformed token' }, { status: 401 });

  return NextResponse.json({
    user: {
      id: Number(p.sub),
      email: String(p.email ?? ''),
      name:  String(p.name  ?? ''),
      role:  p.role as 'admin' | 'student',
      department: String(p.department ?? ''),
      program:    String(p.program    ?? ''),
      level:      String(p.level      ?? ''),
    },
  });
}
