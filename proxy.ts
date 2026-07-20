import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/avatars', '/logos', '/logo'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets and public paths
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for access token
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode role from JWT for header injection (no signature verification — Symfony is authoritative)
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based redirects
    const role = String(payload.role ?? '');

    if (role === 'admin' && (pathname === '/' || pathname === '/dashboard')) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // Inject role into request header for server components
    const response = NextResponse.next();
    response.headers.set('x-user-role', payload.role ?? '');
    response.headers.set('x-user-id', String(payload.sub ?? ''));
    return response;
  } catch {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
