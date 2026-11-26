import { computed, type ComputedRef } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'

/**
 * 路由驱动的 L1 抽屉：刷新、复制链接、浏览器返回都能恢复同一对象，
 * 且抽屉开关不会丢掉列表页已输入的搜索与筛选参数。
 */
export const PANEL_QUERY = 'panel'
export const PANEL_ID_QUERY = 'id'

function copyQuery(query: LocationQuery): LocationQueryRaw {
  const next: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(query)) {
    if (value !== null) next[key] = value
  }
  return next
}

export function withPanelQuery(query: LocationQuery, panel: string, id: string): LocationQueryRaw {
  const next = copyQuery(query)
  delete next[PANEL_QUERY]
  delete next[PANEL_ID_QUERY]
  next[PANEL_QUERY] = panel
  next[PANEL_ID_QUERY] = id
  return next
}

export function withoutPanelQuery(query: LocationQuery, panel: string): LocationQueryRaw {
  const next = copyQuery(query)
  if (next[PANEL_QUERY] === panel) {
    delete next[PANEL_QUERY]
    delete next[PANEL_ID_QUERY]
  }
  return next
}

/** 读取单值 query；数组或空值一律视为未打开，避免脏 URL 触发错误对象。 */
export function queryValue(query: LocationQuery, key: string): string {
  const value = query[key]
  return typeof value === 'string' ? value : ''
}

export interface RoutePanel {
  activeId: ComputedRef<string>
  isOpen: ComputedRef<boolean>
  open: (id: string) => void
  close: () => void
}

export function useRoutePanel(panel: string): RoutePanel {
  const route = useRoute()
  const router = useRouter()

  const activeId = computed(() =>
    route.query[PANEL_QUERY] === panel ? queryValue(route.query, PANEL_ID_QUERY) : '',
  )
  const isOpen = computed(() => Boolean(activeId.value))

  function open(id: string) {
    const nextId = String(id || '').trim()
    if (!nextId) return
    const query = withPanelQuery(route.query, panel, nextId)
    if (route.query[PANEL_QUERY] === panel) {
      void router.replace({ query })
      return
    }
    void router.push({ query })
  }

  function close() {
    if (!isOpen.value) return
    // 用 replace 关闭：深链进入时也能回到本页干净地址，不把用户带离当前页面。
    void router.replace({ query: withoutPanelQuery(route.query, panel) })
  }

  return { activeId, isOpen, open, close }
}
