// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtPayload, decodeStudentId } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = decodeStudentId(token);
  if (id === null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = payload.role;
  if (role !== 'admin' && role !== 'student') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id,
      email: String(payload.email ?? ''),
      name:  String(payload.name  ?? ''),
      role,
      department: String(payload.department ?? ''),
      program:    String(payload.program    ?? ''),
      level:      String(payload.level      ?? ''),
    },
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
