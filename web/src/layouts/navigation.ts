import type { IconName } from '../components/ds/icons'

/** 一级导航唯一数据源：侧栏高亮、顶栏面包屑、移动端抽屉都读这一份。 */
export interface PrimaryNavItem {
  key: string
  label: string
  path: string
  icon: IconName
  /** 命中前缀：包含下属业务页，保证进入子页面时一级入口仍高亮。 */
  prefixes: string[]
}

export const primaryNav: PrimaryNavItem[] = [
  { key: 'home', label: '首页', path: '/home', icon: 'home', prefixes: ['/home'] },
  {
    key: 'workbench',
    label: '工作台',
    path: '/workspace/home',
    icon: 'workbench',
    prefixes: ['/workspace', '/studio', '/projects', '/creation', '/director', '/video', '/audio', '/post', '/quality', '/tasks'],
  },
  { key: 'assets', label: '素材库', path: '/assets/library', icon: 'assets', prefixes: ['/assets'] },
  { key: 'plugins', label: '插件市场', path: '/plugins', icon: 'plugins', prefixes: ['/plugins'] },
]

export const settingsNav = { key: 'settings', label: '设置', path: '/settings', icon: 'settings' as IconName }

export function activeNavKey(path: string): string {
  const hit = primaryNav.find((item) => item.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))
  if (hit) return hit.key
  if (path === settingsNav.path) return settingsNav.key
  return ''
}

export function navLabel(key: string): string {
  if (!key) return '功能索引'
  if (key === settingsNav.key) return settingsNav.label
  return primaryNav.find((item) => item.key === key)?.label ?? '功能索引'
}
