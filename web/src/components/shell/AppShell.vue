<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="sb-brand">
        <span class="mark">SP</span>
        <div>
          <b>短剧智能生产</b>
          <small>STUDIO · MOCK API</small>
        </div>
      </div>

      <div class="sb-scroll">
        <div v-for="group in menu" :key="group.id" class="sb-group">
          <div class="sb-group-head">{{ group.label }}</div>
          <div v-for="sub in group.children" :key="sub.id" class="sb-sub">
            <div class="sb-sub-title">{{ sub.label }}</div>
            <button
              v-for="item in sub.items"
              :key="item.id"
              v-show="!item.hidden"
              class="sb-item"
              :class="{ active: activePath(item.path) }"
              @click="go(item.path)"
            >
              <span>{{ item.label }}</span>
              <span v-if="!session.can(item.perm)" class="lock">无权限</span>
            </button>
          </div>
        </div>
      </div>

      <div class="sb-foot">
        <div class="sb-me">
          <span class="av">{{ session.identity?.avatar || session.shortName.slice(0, 1) }}</span>
          <div>
            <b>{{ session.name }}</b>
            <small>{{ session.roleName }} · {{ session.identity?.dept }}</small>
          </div>
        </div>
        <button class="btn ghost" style="justify-content: center" @click="resetMock">重置演示数据</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="tb-left">
          <div class="crumb">
            <span>{{ currentGroup }}</span><span>/</span><b>{{ currentTitle }}</b>
          </div>
          <select class="tb-proj" :value="project.currentId" @change="selectProject">
            <option v-for="option in project.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
        <div class="tb-right">
          <span class="mode-chip" :class="{ mock: isMock }" :title="isMock ? 'mock API：接口契约与真实后端一致，切换 VITE_DATA_MODE=real 即接真实后端' : '真实后端 API'">
            {{ isMock ? 'MOCK API' : 'REAL API' }}
          </span>
          <button class="btn tb-bell" @click="inbox.openInbox()">
            通知
            <span v-if="inbox.unread" class="dot-badge">{{ inbox.unread }}</span>
          </button>
          <select class="tb-identity" :value="session.identity?.id" @change="switchIdentity">
            <option v-for="identity in session.identities" :key="identity.id" :value="identity.id">{{ identity.name }}</option>
          </select>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>

    <DialogHost />
    <InboxDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import menuData from '../../mock/menu.json'
import routesMeta from '../../mock/routes.json'
import { isMockMode } from '../../api'
import { http } from '../../api/client'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useInboxStore } from '../../stores/inbox'
import { useUiStore } from '../../stores/ui'
import DialogHost from '../ui/DialogHost.vue'
import InboxDialog from './InboxDialog.vue'

const session = useSessionStore()
const project = useProjectStore()
const inbox = useInboxStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const isMock = isMockMode

interface MenuEntry { id?: string; path: string; label?: string; hidden?: boolean; perm?: string | string[] }
interface MenuSection { id?: string; label?: string; items: MenuEntry[] }
interface MenuGroup { id?: string; label?: string; children: MenuSection[] }

const menu = (menuData as { menu: MenuGroup[] }).menu
const meta = routesMeta as Array<{ group: string; path: string; title: string }>

const currentTitle = computed(() => meta.find((item) => `/${item.path}` === route.path)?.title ?? '')
const currentGroup = computed(() => {
  const group = menu.find((item) => item.children.some((sub) => sub.items.some((entry) => `/${entry.path}` === route.path)))
  return group?.label ?? '短剧制作'
})

function activePath(path: string) {
  return route.path === `/${path}`
}

function go(path: string) {
  router.push(`/${path}`)
}

function selectProject(event: Event) {
  project.select((event.target as HTMLSelectElement).value)
}

async function switchIdentity(event: Event) {
  await session.switchIdentity((event.target as HTMLSelectElement).value)
  ui.toast(`已切换为 ${session.name}`, 'ok')
  await project.load()
}

async function resetMock() {
  const yes = await ui.confirm('重置演示数据', '将把全部 mock 数据恢复到原型 9.7.8 的初始状态，当前操作记录会丢失。', true)
  if (!yes) return
  await http.post('/mock/reset')
  await session.login('i-owner')
  await project.load()
  await inbox.load()
  ui.toast('mock 数据已重置')
  router.push('/workspace/home')
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason ?? '未知错误')
  ui.toast(`操作失败 · ${message}`, 'bad')
}

let unreadTimer: number | undefined

onMounted(async () => {
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  if (!session.ready) await session.login()
  await Promise.all([session.loadIdentities(), project.load(), inbox.load()])
  unreadTimer = window.setInterval(() => inbox.load(), 20000)
})

onUnmounted(() => {
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
  if (unreadTimer) window.clearInterval(unreadTimer)
})
</script>
