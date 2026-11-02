import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'azatech_session';

const PROTECTED_PREFIXES = ['/dashboard', '/products', '/customers', '/orders'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(AUTH_COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (pathname === '/') {
    const dest = hasSession ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/products/:path*', '/customers/:path*', '/orders/:path*'],
};
