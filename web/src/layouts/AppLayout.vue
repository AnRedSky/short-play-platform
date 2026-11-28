<template>
  <div
    class="app-layout"
    :class="{ 'is-collapsed': collapsed, 'is-compact': compact, 'is-motion-off': prefs.reduceMotion }"
  >
    <a class="skip-link" href="#app-main">跳到主内容</a>

    <AppSidebar
      :collapsed="prefs.navCollapsed"
      :open="drawerOpen"
      :compact="compact"
      @toggle="toggleNav"
      @navigate="closeDrawer"
    />

    <div class="app-main">
      <AppTopbar :compact="compact" @open-nav="openDrawer" @open-index="indexOpen = true" />
      <main
        id="app-main"
        tabindex="-1"
        class="app-content"
        :class="{ 'content-cockpit': isCockpit }"
      >
        <RouterView />
      </main>
    </div>

    <Transition name="nav-fade">
      <div v-if="drawerOpen" class="nav-backdrop" @click="closeDrawer" />
    </Transition>

    <AppIndexDrawer :open="indexOpen" @close="indexOpen = false" />
    <DialogHost />
    <InboxDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
import AppIndexDrawer from './AppIndexDrawer.vue'
import DialogHost from '../components/ui/DialogHost.vue'
import InboxDialog from '../components/shell/InboxDialog.vue'
import { useInboxStore } from '../stores/inbox'
import { useProjectStore } from '../stores/project'
import { useSessionStore } from '../stores/session'
import { usePreferencesStore } from '../stores/preferences'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const session = useSessionStore()
const project = useProjectStore()
const inbox = useInboxStore()
const prefs = usePreferencesStore()
const ui = useUiStore()

const drawerOpen = ref(false)
const indexOpen = ref(false)
const compact = ref(false)
const collapsed = computed(() => prefs.navCollapsed && !compact.value)
const isCockpit = computed(() => route.path === '/projects/workflow')

const mediaQuery = window.matchMedia('(max-width: 1024px)')

function syncCompact(event: MediaQueryListEvent | MediaQueryList) {
  compact.value = event.matches
  // 回到桌面宽度时抽屉必须收起，否则会与固定侧栏叠在一起。
  if (!event.matches) drawerOpen.value = false
}

function closeDrawer() {
  drawerOpen.value = false
}

function openDrawer() {
  drawerOpen.value = true
}

/** 同一个固定按钮在小屏开抽屉、在桌面折叠图标栏，避免两套入口互相打架。 */
function toggleNav() {
  if (compact.value) {
    drawerOpen.value = !drawerOpen.value
    return
  }
  prefs.toggleNav()
}

function onDrawerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDrawer()
}

watch(drawerOpen, (open) => {
  document.body.style.overflow = open && compact.value ? 'hidden' : ''
  if (open) window.addEventListener('keydown', onDrawerKeydown)
  else window.removeEventListener('keydown', onDrawerKeydown)
})

watch(
  () => route.fullPath,
  () => {
    closeDrawer()
    indexOpen.value = false
  },
)

function onUnhandledRejection(event: PromiseRejectionEvent) {
  const reason = event.reason
  const message = reason instanceof Error ? reason.message : String(reason ?? '未知错误')
  ui.toast(`操作失败 · ${message}`, 'bad')
}

let unreadTimer: number | undefined

onMounted(async () => {
  syncCompact(mediaQuery)
  mediaQuery.addEventListener('change', syncCompact)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  if (!session.ready) await session.login()
  await Promise.all([session.loadIdentities(), project.load(), inbox.load()])
  unreadTimer = window.setInterval(() => inbox.load(), 20000)
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', syncCompact)
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
  window.removeEventListener('keydown', onDrawerKeydown)
  document.body.style.overflow = ''
  if (unreadTimer) window.clearInterval(unreadTimer)
})
</script>

<style scoped>
.app-layout {
  --nav-current: var(--nav-width);
  min-height: 100vh;
}

.app-layout.is-collapsed {
  --nav-current: var(--nav-width-collapsed);
}

.app-layout.is-compact {
  --nav-current: 0px;
}

/* 动效降级：只把外壳的时长变量归零，组件仍保留同一套过渡定义。 */
.app-layout.is-motion-off {
  --motion-nav: 0ms;
  --motion-fast: 0ms;
}

.app-main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  margin-left: var(--nav-current);
  transition: margin-left var(--motion-nav) var(--ease-out);
}

.app-content {
  flex: 1;
  min-width: 0;
}

.app-content:not(.content-cockpit) {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-3) var(--page-gutter) var(--space-6);
}

.app-content:focus {
  outline: none;
}

.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: var(--ds-overlay);
  backdrop-filter: blur(2px);
}

.nav-fade-enter-active,
.nav-fade-leave-active {
  transition: opacity var(--motion-nav) var(--ease-out);
}

.nav-fade-enter-from,
.nav-fade-leave-to {
  opacity: 0;
}

.skip-link {
  position: fixed;
  top: var(--space-1);
  left: var(--space-2);
  z-index: 60;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-m);
  background: var(--ds-interactive);
  color: var(--ds-on-interactive);
  font-size: 13px;
  font-weight: 650;
  text-decoration: none;
  transform: translateY(-200%);
  transition: transform var(--motion-fast) var(--ease-out);
}

.skip-link:focus-visible {
  transform: translateY(0);
}

@media (max-width: 1024px) {
.app-main {
    margin-left: 0;
  }

  .app-content:not(.content-cockpit) {
    padding: var(--space-2) var(--space-2) var(--space-5);
  }
}
</style>
