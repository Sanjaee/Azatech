import { NextRequest, NextResponse } from 'next/server';
import {
  BACKEND_API_URL,
  clearAuthCookie,
  getSessionToken,
  validateCsrfAndOrigin,
} from '@/lib/bff';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPermittedProxyRoute(method: string, pathSegments: string[]): boolean {
  const upperMethod = method.toUpperCase();

  if (pathSegments.length === 1) {
    const [resource] = pathSegments;
    if (resource === 'products') {
      return upperMethod === 'GET' || upperMethod === 'POST';
    }
    if (resource === 'customers') {
      return upperMethod === 'GET' || upperMethod === 'POST';
    }
    if (resource === 'orders') {
      return upperMethod === 'GET' || upperMethod === 'POST';
    }
    return false;
  }

  if (pathSegments.length === 2) {
    const [resource, id] = pathSegments;
    if (!UUID_REGEX.test(id)) return false;

    if (resource === 'products') {
      return upperMethod === 'PUT';
    }
    if (resource === 'orders') {
      return upperMethod === 'GET';
    }
    return false;
  }

  if (pathSegments.length === 3) {
    const [resource, id, action] = pathSegments;
    if (resource === 'orders' && UUID_REGEX.test(id)) {
      return upperMethod === 'PATCH' && (action === 'pay' || action === 'cancel');
    }
    return false;
  }

  return false;
}

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const csrf = validateCsrfAndOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, message: csrf.reason || 'Forbidden' },
      { status: 403 }
    );
  }

  const { path: pathSegments } = await context.params;

  if (!isPermittedProxyRoute(req.method, pathSegments)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Forbidden: API path or HTTP method is not permitted by BFF proxy allowlist',
      },
      { status: 403 }
    );
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        message: 'Authentication required',
      },
      { status: 401 }
    );
  }

  const searchParams = req.nextUrl.searchParams.toString();
  const targetPath = `/api/${pathSegments.join('/')}${searchParams ? `?${searchParams}` : ''}`;
  const targetUrl = `${BACKEND_API_URL}${targetPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  let bodyText: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    try {
      bodyText = await req.text();
    } catch {
      bodyText = undefined;
    }
  }

  try {
    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyText && bodyText.length > 0 ? bodyText : undefined,
      cache: 'no-store',
    });

    const data = await backendRes.json();

    if (backendRes.status === 401) {
      const unauthRes = NextResponse.json(data, { status: 401 });
      clearAuthCookie(unauthRes);
      return unauthRes;
    }

    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to communicate with backend API server',
      },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, context);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(req, context);
}
