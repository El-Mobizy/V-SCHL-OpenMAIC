import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtPayload } from '@/lib/auth/jwt';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({
      active: false,
      schoolName: null,
      agentId: null,
      scope: null,
      isReadOnly: false,
      breakGlass: false,
    });
  }

  const payload = decodeJwtPayload(accessToken);
  if (!payload || !payload.support || typeof payload.support !== 'object') {
    return NextResponse.json({
      active: false,
      schoolName: null,
      agentId: null,
      scope: null,
      isReadOnly: false,
      breakGlass: false,
    });
  }

  const support = payload.support as Record<string, unknown>;

  if (
    typeof support.expires_at === 'number' &&
    support.expires_at * 1000 < Date.now()
  ) {
    return NextResponse.json({
      active: false,
      schoolName: null,
      agentId: null,
      scope: null,
      isReadOnly: false,
      breakGlass: false,
    });
  }

  return NextResponse.json({
    active: true,
    schoolName:
      typeof payload.school_name === 'string' ? payload.school_name : null,
    agentId:
      typeof support.agent_user_id === 'number' ? support.agent_user_id : null,
    scope:
      support.scope === 'read' || support.scope === 'write'
        ? support.scope
        : null,
    isReadOnly: support.scope === 'read',
    breakGlass: support.break_glass === true,
  });
}
