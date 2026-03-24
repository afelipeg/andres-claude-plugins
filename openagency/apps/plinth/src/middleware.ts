import { NextRequest, NextResponse } from 'next/server';

// Auth middleware for Next.js — wraps existing JWT verification from packages/auth
// Protects /chat, /settings, /admin, and /api/chat routes

const PUBLIC_PATHS = ['/api/auth', '/login', '/api/health', '/_next', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Hono bridge routes (they have their own auth)
  if (pathname.startsWith('/api/v1')) {
    return NextResponse.next();
  }

  // For protected routes, check JWT
  const token = request.cookies.get('plinth_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // For page routes, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token using jose (same as packages/auth/jwt.ts)
  try {
    const jose = await import('jose');
    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      return NextResponse.json({ error: 'server_error', message: 'JWT_SECRET not configured' }, { status: 500 });
    }
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key, { issuer: 'openagency' });

    // Admin-only routes
    if (pathname.startsWith('/admin') && (payload as Record<string, unknown>)['role'] !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Forward auth info via headers for server components
    const response = NextResponse.next();
    response.headers.set('x-auth-sub', payload.sub ?? '');
    response.headers.set('x-auth-role', String((payload as Record<string, unknown>)['role'] ?? 'user'));
    response.headers.set('x-auth-agency', String((payload as Record<string, unknown>)['agency_id'] ?? ''));
    return response;
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized', message: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/chat/:path*', '/settings/:path*', '/admin/:path*', '/api/chat/:path*'],
};
