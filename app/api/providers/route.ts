import { NextRequest, NextResponse } from 'next/server';

const SYMFONY_API_URL = process.env.SYMFONY_API_URL!;

/** Returns available providers (with models, no API keys) for student model selection */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${SYMFONY_API_URL}/api/providers`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: res.status });
  }

  const providers = await res.json();
  return NextResponse.json(providers);
}
