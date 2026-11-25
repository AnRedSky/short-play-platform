import { http } from '../../api/client'

export const analyticsApi = {
  get: (scope: 'enterprise' | 'me') => http.get<Record<string, any>>(`/analytics/${scope}`),
}
