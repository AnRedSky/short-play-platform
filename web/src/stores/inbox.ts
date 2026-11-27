import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Row } from '../mock/db'
import { workspaceApi } from '../services/workspace'

/**
 * 通知中心：顶栏角标与居中弹窗共用同一份数据。
 * 待办与通知不再是独立页面，打开弹窗即拉取；已读动作直接落接口并刷新，避免两处各算一次未读。
 */
export const useInboxStore = defineStore('inbox', () => {
  const rows = ref<Row[]>([])
  const loading = ref(false)
  const error = ref('')
  const open = ref(false)
  const unread = computed(() => rows.value.filter((row) => row.unread).length)

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const result = await workspaceApi.notifications(100)
      rows.value = result.rows
    } catch (err) {
      error.value = (err as Error).message || '通知读取失败'
    } finally {
      loading.value = false
    }
  }

  function openInbox() {
    open.value = true
    void load()
  }

  function closeInbox() {
    open.value = false
  }

  async function markRead(id: string) {
    await workspaceApi.markNotificationRead(id)
    await load()
  }

  async function markAllRead() {
    await workspaceApi.markAllNotificationsRead()
    await load()
  }

  return { rows, loading, error, open, unread, load, openInbox, closeInbox, markRead, markAllRead }
})
