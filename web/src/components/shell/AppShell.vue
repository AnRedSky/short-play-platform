<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="sb-brand">
        <span class="mark">短</span>
        <div>
          <b>短剧智能生产</b>
          <small>项目制作与交付</small>
        </div>
      </div>

      <nav class="primary-nav" aria-label="主导航">
        <button
          v-for="item in primaryNav"
          :key="item.key"
          class="primary-item"
          :class="{ active: item.active }"
          :aria-current="item.active ? 'page' : undefined"
          :title="item.hint"
          @click="go(item.path)"
        >
          <span class="primary-icon">{{ item.mark }}</span>
          <span class="primary-text">
            <b>{{ item.label }}</b>
            <small>{{ item.hint }}</small>
          </span>
        </button>
      </nav>

      <div class="nav-divider"></div>

      <button class="all-menu-btn" @click="allMenuOpen = true">
        <span class="primary-icon">全</span>
        <span class="all-menu-text">
          <b>全部功能</b>
          <small>{{ visibleMenuCount }} 个可用入口</small>
        </span>
      </button>

      <div class="sb-foot">
        <div class="sb-me">
          <span class="av">{{ session.identity?.avatar || session.shortName.slice(0, 1) }}</span>
          <div>
            <b>{{ session.name }}</b>
            <small>{{ session.roleName }} · {{ session.identity?.dept }}</small>
          </div>
        </div>
        <button class="foot-link" @click="settingsOpen = true">环境设置</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="tb-left">
          <div class="crumb">
            <span>{{ currentGroup }}</span><span>/</span><b>{{ currentTitle }}</b>
          </div>
          <label class="tb-project">
            <span>当前项目</span>
            <select :value="project.currentId" @change="selectProject">
              <option v-for="option in project.options" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </div>
        <div class="tb-right">
          <span class="mode-hint" :title="isMock ? '模拟数据：接口契约与真实后端一致，切换数据模式即接真实后端' : '真实后端数据'">
            {{ isMock ? '模拟数据' : '真实数据' }}
          </span>
          <button class="btn tb-bell" @click="inbox.openInbox()">
            通知
            <span v-if="inbox.unread" class="dot-badge">{{ inbox.unread }}</span>
          </button>
          <select class="tb-identity" :value="session.identity?.id" aria-label="切换身份" @change="switchIdentity">
            <option v-for="identity in session.identities" :key="identity.id" :value="identity.id">{{ identity.name }}</option>
          </select>
        </div>
      </header>

      <main class="content" :class="{ 'content-cockpit': isCockpit }">
        <router-view />
      </main>
    </div>

    <AppDrawer
      :open="allMenuOpen"
      title="全部功能"
      :subtitle="`共 ${totalMenuCount} 个入口，当前身份可用 ${visibleMenuCount} 个`"
      @close="allMenuOpen = false"
    >
      <div class="all-menu-tools">
        <input v-model="menuQuery" class="search" placeholder="搜索功能名称" aria-label="搜索功能名称" />
        <span class="filter-count">{{ visibleMenuCount }} / {{ totalMenuCount }}</span>
      </div>
      <div v-if="!filteredMenu.length" class="empty compact">
        <b>没有匹配的功能</b>
        <p>换一个名称再试，或清空搜索查看全部入口。</p>
      </div>
      <section v-for="group in filteredMenu" :key="group.id" class="all-menu-group">
        <div class="all-menu-group-head">{{ group.label }}</div>
        <div v-for="sub in group.children" :key="sub.id" class="all-menu-sub">
          <div class="all-menu-sub-title">{{ sub.label }}</div>
          <button
            v-for="item in sub.items"
            :key="item.id"
            class="all-menu-item"
            :class="{ locked: !session.can(item.perm) }"
            @click="openMenuItem(item)"
          >
            <span>{{ item.label }}</span>
            <span v-if="!session.can(item.perm)" class="lock">受限</span>
          </button>
        </div>
      </section>
    </AppDrawer>

    <AppDrawer
      :open="settingsOpen"
      title="环境设置"
      subtitle="验证数据、数据模式与当前身份"
      @close="settingsOpen = false"
    >
      <div class="settings-panel">
        <dl class="settings-list">
          <dt>当前身份</dt>
          <dd>{{ session.name }}</dd>
          <dt>角色</dt>
          <dd>{{ session.roleName }}</dd>
          <dt>所属部门</dt>
          <dd>{{ session.identity?.dept || '—' }}</dd>
          <dt>数据模式</dt>
          <dd>{{ isMock ? '模拟数据' : '真实数据' }}</dd>
          <dt>数据说明</dt>
          <dd>{{ isMock ? '当前使用可替换的模拟适配层，页面流程与真实接口契约保持一致。' : '当前读取真实后端数据。' }}</dd>
        </dl>
        <div class="settings-actions">
          <button class="btn danger" @click="resetMock">重置验证数据</button>
        </div>
      </div>
    </AppDrawer>

    <DialogHost />
    <InboxDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import AppDrawer from '../ui/AppDrawer.vue'
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

const allMenuOpen = ref(false)
const settingsOpen = ref(false)
const menuQuery = ref('')

const primarySections = [
  { key: 'project', label: '项目', mark: '项', hint: '工作台与项目推进', path: '/workspace/home', prefixes: ['/workspace', '/projects', '/studio'] },
  { key: 'script', label: '剧本', mark: '剧', hint: '创作、版本与审核', path: '/creation/script', prefixes: ['/creation'] },
  { key: 'production', label: '制作', mark: '制', hint: '镜头、视频与后期', path: '/director/shots', prefixes: ['/director', '/video', '/audio', '/post'] },
  { key: 'assets', label: '资产与质检', mark: '资', hint: '素材、任务与质量', path: '/assets/library', prefixes: ['/assets', '/quality', '/tasks'] },
  { key: 'enterprise', label: '企业与系统', mark: '企', hint: '组织、成本与运维', path: '/orgs/enterprise', prefixes: ['/orgs', '/compliance', '/analytics', '/models', '/cost', '/ops'] },
]

const activeSection = computed(() => {
  const path = route.path
  return primarySections.find((section) => section.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)))?.key ?? 'project'
})

const primaryNav = computed(() =>
  primarySections.map((section) => ({ ...section, active: section.key === activeSection.value })),
)

const workflowViewTitle = computed(() => {
  if (route.path !== '/projects/workflow') return ''
  const view = String(route.query.view ?? '')
  if (view === 'batch') return '批次看板'
  if (view === 'episode') return '单集工作区'
  return '项目详情'
})

const currentTitle = computed(
  () => workflowViewTitle.value || (meta.find((item) => `/${item.path}` === route.path)?.title ?? '').split(' · ')[0],
)

const currentGroup = computed(() => primarySections.find((item) => item.key === activeSection.value)?.label ?? '项目')
const isCockpit = computed(() => route.path === '/projects/workflow')

const totalMenuCount = computed(() =>
  menu.reduce((sum, group) => sum + group.children.reduce((s, sub) => s + sub.items.filter((item) => !item.hidden).length, 0), 0),
)

const visibleMenuCount = computed(() =>
  menu.reduce(
    (sum, group) =>
      sum +
      group.children.reduce(
        (s, sub) =>
          s +
          sub.items.filter(
            (item) =>
              !item.hidden &&
              session.can(item.perm) &&
              (menuQuery.value.trim() ? `${item.label ?? ''}${item.path}`.toLowerCase().includes(menuQuery.value.trim().toLowerCase()) : true),
          ).length,
        0,
      ),
    0,
  ),
)

const filteredMenu = computed(() => {
  const query = menuQuery.value.trim().toLowerCase()
  return menu
    .map((group) => ({
      ...group,
      children: group.children
        .map((sub) => ({
          ...sub,
          items: sub.items.filter((item) => {
            if (item.hidden) return false
            if (!query) return true
            return `${item.label ?? ''}${item.path}`.toLowerCase().includes(query)
          }),
        }))
        .filter((sub) => sub.items.length),
    }))
    .filter((group) => group.children.length)
})

function go(path: string) {
  router.push(path.startsWith('/') ? path : `/${path}`)
}

function openMenuItem(item: MenuEntry) {
  if (!session.can(item.perm)) {
    ui.toast('当前身份无权访问该功能', 'bad')
    return
  }
  allMenuOpen.value = false
  router.push(item.path.startsWith('/') ? item.path : `/${item.path}`)
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
  const yes = await ui.confirm('重置验证数据', '将把全部模拟数据恢复到初始验证状态，当前操作记录会丢失。', true)
  if (!yes) return
  await http.post('/mock/reset')
  await session.login('i-owner')
  await project.load()
  await inbox.load()
  settingsOpen.value = false
  ui.toast('模拟数据已重置')
  router.push('/workspace/home')
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason ?? '未知错误')
  ui.toast(`操作失败 · ${message}`, 'bad')
}

watch(
  () => route.fullPath,
  () => {
    allMenuOpen.value = false
    settingsOpen.value = false
  },
)

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
