import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, validateCsrfAndOrigin } from '@/lib/bff';

export async function POST(req: NextRequest) {
  const csrf = validateCsrfAndOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, message: csrf.reason || 'Forbidden' },
      { status: 403 }
    );
  }

  const response = NextResponse.json(
    {
      success: true,
      message: 'Logged out successfully',
      data: null,
    },
    { status: 200 }
  );

  clearAuthCookie(response);
  return response;
}
