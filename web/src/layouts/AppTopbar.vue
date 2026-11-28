<template>
  <header class="app-topbar">
    <div class="tb-left">
      <button
        v-if="compact"
        type="button"
        class="tb-toggle"
        aria-label="打开主导航"
        title="打开主导航"
        @click="emit('open-nav')"
      >
        <AppIcon name="menu" :size="20" />
      </button>

      <div class="crumb">
        <template v-if="groupLabel !== pageTitle">
          <span>{{ groupLabel }}</span>
          <span class="sep" aria-hidden="true">/</span>
        </template>
        <b>{{ pageTitle }}</b>
      </div>

      <label class="tb-project">
        <span>当前项目</span>
        <select :value="project.currentId" @change="selectProject">
          <option v-for="option in project.options" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
    </div>

    <div class="tb-right">
      <button type="button" class="tb-index" title="全部功能入口" @click="emit('open-index')">
        <AppIcon name="index" :size="16" />
        <span>功能索引</span>
      </button>

      <span class="mode-hint" :title="modeTitle">{{ isMock ? '模拟数据' : '真实数据' }}</span>

      <button type="button" class="btn tb-bell" @click="inbox.openInbox()">
        通知
        <span v-if="inbox.unread" class="dot-badge">{{ inbox.unread }}</span>
      </button>

      <select class="tb-identity" :value="session.identity?.id" aria-label="切换身份" @change="switchIdentity">
        <option v-for="identity in session.identities" :key="identity.id" :value="identity.id">{{ identity.name }}</option>
      </select>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/ds/AppIcon.vue'
import routesMeta from '../mock/routes.json'
import { isMockMode } from '../api'
import { useInboxStore } from '../stores/inbox'
import { useProjectStore } from '../stores/project'
import { useSessionStore } from '../stores/session'
import { useUiStore } from '../stores/ui'
import { activeNavKey, navLabel } from './navigation'

defineProps<{ compact: boolean }>()
const emit = defineEmits<{ (event: 'open-nav'): void; (event: 'open-index'): void }>()

const route = useRoute()
const session = useSessionStore()
const project = useProjectStore()
const inbox = useInboxStore()
const ui = useUiStore()
const isMock = isMockMode

const meta = routesMeta as Array<{ group: string; path: string; title: string }>

/** 外壳自有页面不在业务路由表里，标题在这里补；业务页沿用路由表标题。 */
const shellTitles: Record<string, string> = {
  '/home': '首页',
  '/plugins': '插件市场',
  '/settings': '设置',
}

const workflowViewTitle = computed(() => {
  if (route.path !== '/projects/workflow') return ''
  const view = String(route.query.view ?? '')
  if (view === 'batch') return '批次看板'
  if (view === 'episode') return '单集工作区'
  return '项目详情'
})

const pageTitle = computed(
  () =>
    workflowViewTitle.value ||
    shellTitles[route.path] ||
    (meta.find((item) => `/${item.path}` === route.path)?.title ?? '短剧智能生产').split(' · ')[0],
)

const groupLabel = computed(() => navLabel(activeNavKey(route.path)))

const modeTitle = computed(() =>
  isMock ? '模拟数据：接口契约与真实后端一致，切换数据模式即接真实后端' : '真实后端数据',
)

function selectProject(event: Event) {
  project.select((event.target as HTMLSelectElement).value)
}

async function switchIdentity(event: Event) {
  await session.switchIdentity((event.target as HTMLSelectElement).value)
  ui.toast(`已切换为 ${session.name}`, 'ok')
  await project.load()
}
</script>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  height: var(--topbar-h);
  padding: 0 var(--page-gutter);
  background: rgba(11, 14, 19, 0.86);
  backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid var(--ds-border);
}

.tb-left,
.tb-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.tb-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-m);
  background: var(--ds-surface-2);
  color: var(--ds-text-secondary);
  cursor: pointer;
}

.tb-toggle:hover {
  background: var(--ds-surface-3);
  color: var(--ds-text-primary);
}

.crumb {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  font-size: 12.5px;
  color: var(--ds-text-muted);
  white-space: nowrap;
}

.crumb .sep {
  color: var(--ds-text-disabled);
}

.crumb b {
  color: var(--ds-text-primary);
  font-weight: 640;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-project {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 12px;
  color: var(--ds-text-muted);
  white-space: nowrap;
}

.tb-project select {
  height: 32px;
  max-width: 220px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-primary);
  font-size: 12.5px;
}

.tb-right {
  flex: none;
}

.tb-index {
  display: inline-flex;
  align-items: center;
  gap: var(--space-half);
  height: 32px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-m);
  background: transparent;
  color: var(--ds-text-muted);
  font-size: 12.5px;
  cursor: pointer;
  transition:
    color var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

.tb-index:hover {
  border-color: var(--ds-border-strong);
  background: var(--ds-surface-2);
  color: var(--ds-text-primary);
}

.mode-hint {
  padding: 3px var(--space-1);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--ds-text-muted);
}

.tb-bell {
  position: relative;
  height: 32px;
}

.dot-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--ds-interactive);
  color: var(--ds-on-interactive);
  font-size: 10px;
  font-weight: 700;
  line-height: 17px;
  text-align: center;
}

.tb-identity {
  height: 32px;
  max-width: 170px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-secondary);
  font-size: 12.5px;
}

@media (max-width: 1024px) {
.app-topbar {
    padding: 0 var(--space-2);
    gap: var(--space-2);
  }

  .tb-project,
  .mode-hint,
  .tb-index span {
    display: none;
  }

  .tb-index {
    padding: 0 6px;
  }
}

@media (max-width: 720px) {
.crumb span {
    display: none;
  }

  .tb-identity {
    max-width: 120px;
  }
}
</style>
