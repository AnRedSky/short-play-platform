<template>
  <AppDrawer
    :open="open"
    title="全部功能"
    :subtitle="`共 ${totalCount} 个入口，当前身份可用 ${visibleCount} 个`"
    @close="emit('close')"
  >
    <div class="index-tools">
      <label class="search-wrap">
        <AppIcon name="search" :size="15" />
        <input v-model="query" class="search" placeholder="搜索功能名称" aria-label="搜索功能名称" />
      </label>
      <span class="filter-count">{{ visibleCount }} / {{ totalCount }}</span>
    </div>

    <div v-if="!visibleCount" class="empty compact">
      <b>没有匹配的功能</b>
      <p>换一个名称再试，或清空搜索查看全部入口。</p>
    </div>

    <section v-for="group in filteredGroups" :key="group.id" class="index-group">
      <div class="index-group-head">{{ group.label }}</div>
      <div v-for="sub in group.children" :key="sub.id" class="index-section">
        <div class="index-section-title">{{ sub.label }}</div>
        <div class="index-items">
          <button
            v-for="item in sub.items"
            :key="item.id"
            type="button"
            class="index-item"
            @click="go(item)"
          >
            <span class="index-item-label">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </section>
  </AppDrawer>
</template>

<script setup lang="ts">
/** 功能索引：四个一级菜单只是主入口，全部业务页仍从这里按权限进入，避免收敛导航后断链。 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppDrawer from '../components/ui/AppDrawer.vue'
import AppIcon from '../components/ds/AppIcon.vue'
import menuData from '../mock/menu.json'
import { useSessionStore } from '../stores/session'
import { useUiStore } from '../stores/ui'

interface MenuEntry { id?: string; path: string; label?: string; hidden?: boolean; perm?: string | string[] }
interface MenuSection { id?: string; label?: string; items: MenuEntry[] }
interface MenuGroup { id?: string; label?: string; children: MenuSection[] }

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const router = useRouter()
const session = useSessionStore()
const ui = useUiStore()

const menu = (menuData as { menu: MenuGroup[] }).menu
const query = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) query.value = ''
  },
)

const totalCount = computed(() =>
  menu.reduce((sum, group) => sum + group.children.reduce((s, sub) => s + sub.items.filter((item) => !item.hidden).length, 0), 0),
)

const filteredGroups = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return menu
    .map((group) => ({
      ...group,
      children: group.children
        .map((sub) => ({
          ...sub,
          items: sub.items
            .filter((item) => !item.hidden && session.can(item.perm))
            .filter((item) => (keyword ? `${item.label ?? ''}${item.path}`.toLowerCase().includes(keyword) : true)),
        }))
        .filter((sub) => sub.items.length),
    }))
    .filter((group) => group.children.length)
})

const visibleCount = computed(() =>
  filteredGroups.value.reduce((sum, group) => sum + group.children.reduce((s, sub) => s + sub.items.length, 0), 0),
)

function go(item: MenuEntry) {
  if (!session.can(item.perm)) {
    ui.toast('当前身份无权访问该功能', 'bad')
    return
  }
  emit('close')
  router.push(item.path.startsWith('/') ? item.path : `/${item.path}`)
}
</script>

<style scoped>
.index-tools {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-muted);
}

.search-wrap:focus-within {
  border-color: var(--ds-interactive);
  box-shadow: 0 0 0 3px var(--ds-focus-ring);
}

.search-wrap .search {
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  flex: 1;
}

.search-wrap .search:focus {
  outline: none;
  box-shadow: none;
}

.index-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-1);
}

.index-group-head {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--ds-interactive);
}

.index-section {
  padding: var(--space-1) 0;
  border-top: 1px solid var(--ds-border);
}

.index-section-title {
  margin-bottom: var(--space-1);
  font-size: 12px;
  font-weight: 650;
  color: var(--ds-text-secondary);
}

.index-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.index-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-half);
  min-height: 30px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-secondary);
  font-size: 12.5px;
  cursor: pointer;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}

.index-item:hover {
  border-color: var(--ds-border-strong);
  background: var(--ds-surface-3);
  color: var(--ds-text-primary);
}

.index-item-label {
  white-space: nowrap;
}
</style>
