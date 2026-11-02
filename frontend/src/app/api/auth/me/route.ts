import { NextResponse } from 'next/server';
import { BACKEND_API_URL, clearAuthCookie, getSessionToken } from '@/lib/bff';

export async function GET() {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        message: 'Not authenticated',
      },
      { status: 401 }
    );
  }

  try {
    const backendRes = await fetch(`${BACKEND_API_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data?.success) {
      const response = NextResponse.json(
        {
          success: false,
          message: data?.message || 'Session expired',
        },
        { status: 401 }
      );
      clearAuthCookie(response);
      return response;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'OK',
        data: data.data,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to verify authentication session',
      },
      { status: 502 }
    );
  }
}
