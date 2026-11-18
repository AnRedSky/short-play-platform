import type { AuthSession, CurrentIdentity } from '../types/api'
import { apiGet, apiPost } from './index'

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<AuthSession, { email: string; password: string }>('/auth/login', { email, password }),
  me: () => apiGet<CurrentIdentity>('/auth/me'),
  logout: (refresh_token: string) =>
    apiPost<{ revoked: boolean }, { refresh_token: string }>('/auth/logout', { refresh_token }),
}
