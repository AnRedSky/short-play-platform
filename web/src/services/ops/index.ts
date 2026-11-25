import { http } from '../../api/client'

/** 运营域：总览与平台配置 */
export const opsApi = {
  overview: () => http.get<Record<string, any>>('/ops/overview'),
  config: () => http.get<Record<string, any>>('/ops/config'),
}
