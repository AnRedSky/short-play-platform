export interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown; request_id?: string }
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown
  readonly requestId?: string

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.error?.message ?? `API request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.error?.code
    this.details = body?.error?.details
    this.requestId = body?.error?.request_id
  }
}

export interface ApiRequestOptions extends RequestInit {
  /** Explicitly opt in to the local mock adapter for this request. */
  mock?: boolean
}

type MockHandler = (path: string, init: RequestInit) => Promise<unknown>

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
let mockHandler: MockHandler | undefined

/** Install a mock adapter from app bootstrap or tests; production defaults to real fetch. */
export function configureApiMock(handler?: MockHandler): void {
  mockHandler = handler
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')
  return headers
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Non-JSON proxy/network errors still become a typed ApiError.
  }
  return new ApiError(response.status, body)
}

/** Centralized request pipeline: base URL, headers, mock adapter and normalized errors. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { mock = false, ...init } = options
  if (mock) {
    if (!mockHandler) throw new Error('Mock mode was requested but no mock adapter is configured.')
    return (await mockHandler(path, init)) as T
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers: buildHeaders(init),
  })
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
