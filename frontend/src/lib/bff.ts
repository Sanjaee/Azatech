import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'azatech_session';
export const BACKEND_API_URL = (process.env.BACKEND_API_URL || 'http://localhost:4000').replace(
  /\/+$/,
  ''
);

const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

export function setAuthCookie(response: NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: EIGHT_HOURS_SECONDS,
    expires: new Date(Date.now() + EIGHT_HOURS_SECONDS * 1000),
  });
}

export function clearAuthCookie(response: NextResponse): void {
  const isProd = process.env.NODE_ENV === 'production';

  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}

/**
 * Validates Origin and custom CSRF header for state-changing BFF requests
 * (POST, PUT, PATCH, DELETE) to protect cookie-authenticated mutations.
 */
export function validateCsrfAndOrigin(req: NextRequest): { valid: boolean; reason?: string } {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { valid: true };
  }

  // Require custom header X-Requested-With on BFF state-changing requests
  // Simple cross-site form submissions cannot set custom headers without triggering CORS preflight
  const requestedWith = req.headers.get('x-requested-with');
  if (requestedWith !== 'Azatech-BFF') {
    return {
      valid: false,
      reason: 'Missing or invalid CSRF protection header (X-Requested-With)',
    };
  }

  // Validate Origin header matches Host when Origin is present
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return {
          valid: false,
          reason: `Origin mismatch: ${originUrl.host} !== ${host}`,
        };
      }
    } catch {
      return { valid: false, reason: 'Malformed Origin header' };
    }
  }

  return { valid: true };
}
