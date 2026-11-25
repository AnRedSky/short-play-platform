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
          <button class="btn tb-bell" @click="go('notify/inbox')">
            通知
            <span v-if="unread" class="dot-badge">{{ unread }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import menuData from '../../mock/menu.json'
import routesMeta from '../../mock/routes.json'
import { http } from '../../api/client'
import { isMockMode } from '../../api'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import DialogHost from '../ui/DialogHost.vue'

const session = useSessionStore()
const project = useProjectStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const unread = ref(0)
const isMock = isMockMode

const menu = (menuData as { menu: any[] }).menu
const meta = routesMeta as Array<{ group: string; path: string; title: string }>

const currentTitle = computed(() => meta.find((item) => `/${item.path}` === route.path)?.title ?? '')
const currentGroup = computed(() => {
  const group = menu.find((item: any) => item.children.some((sub: any) => sub.items.some((entry: any) => `/${entry.path}` === route.path)))
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
  ui.toast('mock 数据已重置')
  router.push('/workspace/home')
}

async function loadUnread() {
  const result = await http.list('/notifications', { limit: 100 })
  unread.value = result.rows.filter((row: any) => row.unread).length
}

onMounted(async () => {
  if (!session.ready) await session.login()
  await Promise.all([session.loadIdentities(), project.load(), loadUnread()])
  window.setInterval(loadUnread, 20000)
})
</script>
