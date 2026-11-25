import { apiRequest } from './index'
import type { ApiEnvelope } from '../types/api'

export interface ListResult<T> {
  rows: T[]
  total: number
  page: number
  page_size: number
}

function query(params?: Record<string, unknown>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const http = {
  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const envelope = await apiRequest<ApiEnvelope<T>>(`${path}${query(params)}`)
    return envelope.data
  },
  async list<T>(path: string, params?: Record<string, unknown>): Promise<ListResult<T>> {
    const envelope = await apiRequest<ApiEnvelope<T[]>>(`${path}${query(params)}`)
    const meta = (envelope.meta ?? {}) as Record<string, number>
    return {
      rows: envelope.data ?? [],
      total: Number(meta.total ?? envelope.data?.length ?? 0),
      page: Number(meta.page ?? 1),
      page_size: Number(meta.page_size ?? envelope.data?.length ?? 0),
    }
  },
  async post<T>(path: string, body: unknown = {}): Promise<T> {
    const envelope = await apiRequest<ApiEnvelope<T>>(path, { method: 'POST', body: JSON.stringify(body) })
    return envelope.data
  },
  async patch<T>(path: string, body: unknown = {}): Promise<T> {
    const envelope = await apiRequest<ApiEnvelope<T>>(path, { method: 'PATCH', body: JSON.stringify(body) })
    return envelope.data
  },
  async del<T>(path: string): Promise<T> {
    const envelope = await apiRequest<ApiEnvelope<T>>(path, { method: 'DELETE' })
    return envelope.data
  },
}
