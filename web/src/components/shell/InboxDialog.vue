<template>
  <div v-if="inbox.open" class="modal-backdrop" @click.self="inbox.closeInbox()">
    <div class="modal inbox-modal" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1">
      <div class="modal-head">
        <div>
          <h3 :id="titleId">待办与通知</h3>
          <p>未读 {{ inbox.unread }} 条 · 阻塞类待办优先，逐条可跳到处理页面并留审计。</p>
        </div>
        <button type="button" class="btn ghost" aria-label="关闭通知弹窗" @click="inbox.closeInbox()">✕</button>
      </div>

      <div class="modal-body">
        <div class="toolbar act-bar">
          <input v-model="search" class="search" placeholder="搜索标题 / 项目 / 类型" aria-label="搜索通知" />
          <select v-model="stateFilter" class="filter" aria-label="按状态筛选通知">
            <option value="">状态 · 全部</option>
            <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
          </select>
          <button v-if="inbox.unread" type="button" class="link-btn" @click="unreadOnly = !unreadOnly">
            {{ unreadOnly ? '显示全部' : '只看未读' }}
          </button>
          <span class="grow"></span>
          <span class="filter-count">{{ visible.length }} / {{ inbox.rows.length }} 条</span>
        </div>

        <p v-if="inbox.error" class="pill bad">加载失败 · {{ inbox.error }}</p>
        <EmptyState v-else-if="inbox.loading" title="正在读取通知…" desc="接口返回后列表自动刷新。" compact />
        <EmptyState v-else-if="!visible.length" title="暂无待处理事项" desc="调整筛选条件，或等待新的审批、异常与交付提醒。" compact />
        <div v-else class="inbox-list">
          <article v-for="item in visible" :key="item.id" class="inbox-item" :class="{ unread: item.unread }">
            <div class="inbox-head">
              <span class="pill info">{{ item.type }}</span>
              <b class="inbox-title">{{ item.title }}</b>
              <span v-if="item.unread" class="unread-dot" title="未读" />
              <span class="inbox-time">{{ item.at }}</span>
            </div>
            <p class="inbox-line"><span class="muted">{{ item.project }}</span> · {{ item.reason }}</p>
            <p class="inbox-line impact">影响：{{ item.impact }}</p>
            <div class="inbox-foot">
              <StatusPill :status="item.state" />
              <span class="muted">应做：{{ item.action }}</span>
              <span class="grow" />
              <button v-if="item.unread && session.can('notify.handle')" type="button" class="link-btn" @click="markRead(item)">标记已读</button>
              <button type="button" class="link-btn" @click="handle(item)">去处理</button>
            </div>
          </article>
        </div>
      </div>

      <div class="modal-foot">
        <button v-if="session.can('notify.handle')" type="button" class="btn" :disabled="!inbox.unread" @click="markAllRead">全部已读</button>
        <button type="button" class="btn primary" @click="inbox.closeInbox()">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Row } from '../../mock/db'
import { useInboxStore } from '../../stores/inbox'
import { useSessionStore } from '../../stores/session'
import { useUiStore } from '../../stores/ui'
import EmptyState from '../ui/EmptyState.vue'
import StatusPill from '../ui/StatusPill.vue'

const inbox = useInboxStore()
const session = useSessionStore()
const ui = useUiStore()
const router = useRouter()
const titleId = `inbox-title-${useId()}`
const search = ref('')
const stateFilter = ref('')
const unreadOnly = ref(false)

const states = computed(() => [...new Set(inbox.rows.map((row) => String(row.state)).filter(Boolean))])
const visible = computed(() => inbox.rows
  .filter((row) => (unreadOnly.value ? row.unread : true))
  .filter((row) => (stateFilter.value ? row.state === stateFilter.value : true))
  .filter((row) => {
    const keyword = search.value.trim()
    if (!keyword) return true
    return `${row.title}${row.project}${row.type}${row.reason}`.includes(keyword)
  })
  .sort((a, b) => Number(Boolean(b.unread)) - Number(Boolean(a.unread)) || String(b.at).localeCompare(String(a.at))))

let previousFocus: HTMLElement | null = null
let previousBodyOverflow = ''
let ownsScrollLock = false

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  inbox.closeInbox()
}

function release() {
  window.removeEventListener('keydown', onKeydown)
  if (ownsScrollLock) {
    document.body.style.overflow = previousBodyOverflow
    ownsScrollLock = false
  }
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
  search.value = ''
  stateFilter.value = ''
  unreadOnly.value = false
}

watch(
  () => inbox.open,
  async (open) => {
    if (open) {
      if (!ownsScrollLock) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        ownsScrollLock = true
      }
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      return
    }
    release()
  },
  { immediate: true },
)

onBeforeUnmount(release)

async function markRead(row: Row) {
  try {
    await inbox.markRead(String(row.id))
    ui.toast('已标记为已读')
  } catch (err) {
    ui.toast(`标记失败 · ${(err as Error).message}`, 'bad')
  }
}

async function markAllRead() {
  try {
    await inbox.markAllRead()
    ui.toast('全部通知已标记已读', 'ok')
  } catch (err) {
    ui.toast(`操作失败 · ${(err as Error).message}`, 'bad')
  }
}

async function handle(row: Row) {
  try {
    if (row.unread && session.can('notify.handle')) await inbox.markRead(String(row.id))
  } catch {
    // 已读失败不阻断跳转，处理页面本身会写审计。
  }
  inbox.closeInbox()
  router.push(`/${row.link || 'workspace/home'}`)
}
</script>

<style scoped>
.inbox-modal { width: min(780px, 100%); }
.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: #39434f transparent;
}
.modal-body::-webkit-scrollbar { width: 8px; }
.modal-body::-webkit-scrollbar-thumb { background: #39434f; border-radius: 8px; }
.inbox-list { display: grid; gap: 10px; }
.inbox-item { border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px; display: grid; gap: 6px; background: var(--surface); }
.inbox-item.unread { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.inbox-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inbox-head .pill { flex: none; }
.inbox-title { font-size: var(--fs-note); color: var(--ink); font-weight: 680; }
.unread-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex: none; }
.inbox-time { margin-left: auto; font-family: var(--mono); font-size: var(--fs-label); color: var(--faint); }
.inbox-line { margin: 0; font-size: var(--fs-note); color: var(--ink-2); line-height: 1.5; }
.inbox-line.impact { color: var(--muted); }
.inbox-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 6px; border-top: 1px dashed var(--line); font-size: var(--fs-label); }
.inbox-foot .muted { font-size: var(--fs-label); }
.grow { flex: 1; }
.link-btn { border: 0; background: transparent; color: var(--accent-ink); font-size: var(--fs-note); cursor: pointer; padding: 0; }
.link-btn:hover { text-decoration: underline; }
</style>
