/** Shared HTTP contract types: envelope, error body, pagination and domain records. */

export interface ApiEnvelope<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown; request_id?: string }
}

export interface PageMeta {
  page: number
  page_size: number
  total: number
}

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
}

export interface Organization {
  id: string
  name: string
  slug: string
}

export interface Department {
  id: string
  organization_id: string
  name: string
  parent_id: string | null
}

export interface Role {
  id: string
  organization_id: string
  code: string
  name: string
  description: string
  permissions?: string[]
}

export interface Project {
  id: string
  organization_id: string
  code: string
  title: string
  summary: string
  status: string
}

export interface AuthSession {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  user: User
}

export interface CurrentIdentity {
  user: User
  organization_id: string | null
  permissions: string[]
}
