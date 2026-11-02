import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_API_URL, setAuthCookie, validateCsrfAndOrigin } from '@/lib/bff';

export async function POST(req: NextRequest) {
  const csrf = validateCsrfAndOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, message: csrf.reason || 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const backendRes = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body?.email,
        password: body?.password,
      }),
      cache: 'no-store',
    });

    const data = await backendRes.json();

    if (!backendRes.ok || !data?.success || !data?.data?.token) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || 'Invalid credentials',
          errors: data?.errors,
        },
        { status: backendRes.status || 401 }
      );
    }

    // Store raw JWT exclusively in HttpOnly cookie; never return raw JWT in response payload
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        data: {
          user: data.data.user,
        },
      },
      { status: 200 }
    );

    setAuthCookie(response, data.data.token);
    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to reach authentication service',
      },
      { status: 502 }
    );
  }
}
