import { ApiResponse } from '@/types';

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errors = errors;
  }
}

export async function bffFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'Azatech-BFF');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  let payload: ApiResponse<T>;
  try {
    payload = await res.json();
  } catch {
    throw new ApiClientError('Unexpected server response', res.status);
  }

  if (!res.ok || !payload.success) {
    if (res.status === 401 && typeof window !== 'undefined' && !endpoint.includes('/api/auth/')) {
      window.location.href = '/login';
    }
    throw new ApiClientError(
      payload.message || 'Request failed',
      res.status,
      payload.errors
    );
  }

  return payload;
}
