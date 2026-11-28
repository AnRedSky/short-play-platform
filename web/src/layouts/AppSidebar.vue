<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': showCollapsed, 'is-open': open }" aria-label="主导航">
    <div class="nav-head">
      <RouterLink class="nav-brand" to="/home" :aria-label="'短剧智能生产 · 首页'" @click="emit('navigate')">
        <span class="brand-mark" aria-hidden="true">短</span>
        <span class="brand-text">
          <strong>短剧智能生产</strong>
          <small>创作与交付平台</small>
        </span>
      </RouterLink>
      <button
        type="button"
        class="nav-toggle"
        :aria-expanded="compact ? open : !collapsed"
        :aria-label="compact ? '关闭主导航' : collapsed ? '展开主导航' : '折叠主导航'"
        :title="compact ? '关闭导航' : collapsed ? '展开导航' : '折叠导航'"
        @click="emit('toggle')"
      >
        <AppIcon :name="compact ? 'close' : collapsed ? 'expand' : 'collapse'" :size="18" />
      </button>
    </div>

    <nav class="nav-list" aria-label="一级菜单">
      <RouterLink
        v-for="item in primaryNav"
        :key="item.key"
        :to="item.path"
        class="nav-item"
        :class="{ 'is-active': activeKey === item.key }"
        :aria-current="activeKey === item.key ? 'page' : undefined"
        :title="showCollapsed ? item.label : undefined"
        @click="emit('navigate')"
      >
        <span class="nav-ico"><AppIcon :name="item.icon" :size="18" /></span>
        <span class="nav-label">{{ item.label }}</span>
        <span class="nav-marker" aria-hidden="true"></span>
      </RouterLink>
    </nav>

    <div class="nav-bottom">
      <RouterLink
        :to="settingsNav.path"
        class="nav-item"
        :class="{ 'is-active': activeKey === settingsNav.key }"
        :aria-current="activeKey === settingsNav.key ? 'page' : undefined"
        :title="showCollapsed ? settingsNav.label : undefined"
        @click="emit('navigate')"
      >
        <span class="nav-ico"><AppIcon :name="settingsNav.icon" :size="18" /></span>
        <span class="nav-label">{{ settingsNav.label }}</span>
        <span class="nav-marker" aria-hidden="true"></span>
      </RouterLink>

      <div class="nav-user" :title="`${session.name} · ${session.roleName}`">
        <span class="user-avatar">{{ session.identity?.avatar || session.shortName.slice(0, 1) }}</span>
        <span class="user-text">
          <b>{{ session.name }}</b>
          <small>{{ session.roleName }} · {{ session.identity?.dept || '未分配部门' }}</small>
        </span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from '../components/ds/AppIcon.vue'
import { useSessionStore } from '../stores/session'
import { activeNavKey, primaryNav, settingsNav } from './navigation'

const props = withDefaults(defineProps<{ collapsed: boolean; open: boolean; compact: boolean }>(), {
  collapsed: false,
  open: false,
  compact: false,
})
const emit = defineEmits<{ (event: 'toggle'): void; (event: 'navigate'): void }>()

const route = useRoute()
const session = useSessionStore()

/** 抽屉形态一律展开文字，折叠只在桌面端的图标栏生效。 */
const showCollapsed = computed(() => props.collapsed && !props.compact)
const activeKey = computed(() => activeNavKey(route.path))
</script>

<style scoped>
.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: var(--nav-width);
  background: var(--ds-sidebar);
  border-right: 1px solid var(--ds-border);
  color: var(--sidebar-ink);
  overflow: hidden;
  transition:
    width var(--motion-nav) var(--ease-out),
    transform var(--motion-nav) var(--ease-out),
    box-shadow var(--motion-nav) var(--ease-out);
}

.app-sidebar::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(240, 163, 94, 0.28), transparent);
}

.app-sidebar.is-collapsed {
  width: var(--nav-width-collapsed);
}

/* ---------- 品牌区 ---------- */
.nav-head {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--ds-border);
  min-height: var(--topbar-h);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  color: var(--sidebar-active);
  text-decoration: none;
  border-radius: var(--radius-m);
}

.nav-brand:focus-visible {
  outline-offset: 4px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-m);
  background: linear-gradient(145deg, #f4b46c, #d9773a);
  color: #1b1206;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  transition: opacity var(--motion-nav) var(--ease-out);
}

.brand-text strong {
  font-size: 13px;
  font-weight: 680;
  letter-spacing: 0.4px;
}

.brand-text small {
  margin-top: 2px;
  font-size: 10.5px;
  letter-spacing: 0.6px;
  color: var(--sidebar-dim);
}

.nav-toggle {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--sidebar-dim);
  cursor: pointer;
  transition:
    color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}

.nav-toggle:hover {
  border-color: var(--ds-border-strong);
  background: var(--ds-surface-3);
  color: var(--ds-text-primary);
}

/* ---------- 一级菜单 ---------- */
.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-1);
  overflow-y: auto;
  scrollbar-width: thin;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-m);
  color: var(--sidebar-dim);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}

.nav-item:hover {
  background: var(--ds-surface-2);
  color: var(--ds-text-secondary);
}

.nav-item.is-active {
  background: var(--ds-interactive-soft);
  color: var(--accent-ink);
}

.nav-item.is-active .nav-ico {
  color: var(--ds-interactive);
}

.nav-ico {
  display: grid;
  place-items: center;
  width: 18px;
  flex: none;
  opacity: 0.9;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 620;
  letter-spacing: 0.2px;
  text-overflow: ellipsis;
  transition: opacity var(--motion-nav) var(--ease-out);
}

.nav-marker {
  width: 3px;
  height: 3px;
  flex: none;
  border-radius: var(--radius-pill);
  background: transparent;
}

.nav-item.is-active .nav-marker {
  background: var(--ds-interactive);
}

/* ---------- 底部固定功能区 ---------- */
.nav-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1);
  border-top: 1px solid var(--ds-border);
  background: var(--ds-sidebar);
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-1);
  border-radius: var(--radius-m);
  min-width: 0;
}

.user-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: var(--radius-pill);
  background: var(--ds-interactive-soft);
  border: 1px solid var(--ds-interactive-line);
  color: var(--accent-ink);
  font-size: 12px;
  font-weight: 700;
}

.user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  transition: opacity var(--motion-nav) var(--ease-out);
}

.user-text b {
  font-size: 12px;
  font-weight: 640;
  color: var(--ds-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-text small {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--sidebar-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 折叠态：只留 72px 图标栏 ---------- */
.app-sidebar.is-collapsed .nav-head {
  flex-direction: column;
  gap: var(--space-1);
  justify-content: center;
  padding: var(--space-2) 0;
}

.app-sidebar.is-collapsed .nav-brand {
  flex: none;
}

.app-sidebar.is-collapsed .brand-text,
.app-sidebar.is-collapsed .user-text {
  opacity: 0;
  width: 0;
  pointer-events: none;
}

.app-sidebar.is-collapsed .nav-list,
.app-sidebar.is-collapsed .nav-bottom {
  padding-left: var(--space-1);
  padding-right: var(--space-1);
  align-items: center;
}

.app-sidebar.is-collapsed .nav-item {
  justify-content: center;
  padding: 0;
  width: 40px;
}

.app-sidebar.is-collapsed .nav-label {
  opacity: 0;
  width: 0;
  pointer-events: none;
}

.app-sidebar.is-collapsed .nav-marker {
  position: absolute;
  left: 4px;
}

.app-sidebar.is-collapsed .nav-user {
  justify-content: center;
  padding: 0;
}

/* ---------- 小屏：悬浮抽屉 ---------- */
.app-sidebar.is-open {
  transform: translateX(0);
  box-shadow: var(--shadow-3);
}

@media (max-width: 1024px) {
.app-sidebar {
    width: min(280px, 82vw);
    transform: translateX(-102%);
  }

  .app-sidebar.is-open {
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar,
  .nav-label,
  .brand-text,
  .user-text,
  .nav-toggle,
  .nav-item {
    transition: none;
  }
}
</style>
