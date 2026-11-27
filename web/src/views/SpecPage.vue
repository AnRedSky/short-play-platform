<template>
  <section class="page">
    <PageHeader :kicker="spec.kicker" :title="title" :desc="spec.desc">
      <HeadActions>
        <button v-for="action in visibleActions" :key="action.label" class="btn" :class="{ primary: action.tone === 'primary', danger: action.danger }" @click="run(action)">
          {{ action.label }}
        </button>
        <button class="btn" @click="reload">刷新</button>
      </HeadActions>
    </PageHeader>

    <div v-if="groupInfo && groupInfo.group.tabs.length > 1" class="tabs">
      <RouterLink
        v-for="tab in groupInfo.group.tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab"
        :class="{ active: tab.path === route.path }"
      >
        {{ tab.label }}
      </RouterLink>
    </div>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <input v-if="spec.table.search" v-model="search" class="search" placeholder="搜索…" />
      <select v-for="filter in spec.table.filters || []" :key="filter.key" v-model="filterValues[filter.key]" class="filter">
        <option value="">{{ filter.label }} · 全部</option>
        <option v-for="option in filter.options" :key="option" :value="option">{{ option }}</option>
      </select>
      <span class="filter-count">{{ rows.length }} / {{ total }} 条</span>
      <span class="grow"></span>
      <span v-if="error" class="pill bad">加载失败 · {{ error }}</span>
    </div>

    <StatCards v-if="stats.length" :items="stats" />

    <div class="spec-grid split-wide" :style="{ marginTop: stats.length ? '18px' : '0' }">
      <div class="spec-main">
        <DataTable
          :columns="spec.table.columns"
          :rows="rows"
          :row-key="spec.table.rowKey || 'id'"
          :loading="loading"
          :clickable="!!spec.rowPanel || !!spec.rowClick"
          wide
          :empty-title="spec.emptyTitle || '暂无数据'"
          :empty-hint="spec.emptyHint || '调整筛选条件或先创建一条记录。'"
          @row-click="openRow"
        >
          <template v-if="spec.rowActions || rowPanel" #actions="{ row }">
            <button v-if="rowPanel" type="button" class="link-btn" @click="openRow(row)">详情</button>
            <button v-for="action in visibleRowActions(row)" :key="action.label" class="link-btn" :class="{ danger: action.danger }" @click="run(action)">
              {{ action.label }}
            </button>
          </template>
        </DataTable>
      </div>
      <aside class="spec-side">
        <div v-for="panel in panels" :key="panel.title" class="card">
          <div class="card-head">
            <h3 class="card-title">{{ panel.title }}</h3>
          </div>
          <dl v-if="panel.type === 'kv'" class="kv-lite">
            <template v-for="item in panel.items" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </template>
          </dl>
          <div v-else-if="panel.type === 'checklist'" class="checklist">
            <div v-for="item in panel.items" :key="item.label" class="ck">
              <i :class="{ on: item.on }">{{ item.on ? '✓' : '' }}</i>
              <span>{{ item.label }}<em v-if="item.value" class="muted"> · {{ item.value }}</em></span>
            </div>
          </div>
          <div v-else class="ctx-list">
            <div v-for="item in panel.items" :key="item.label" class="list-row">
              <span class="k">{{ item.label }}</span>
              <span class="v">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <AppDrawer
      v-if="rowPanel"
      :open="panelOpen"
      :title="rowPanel.title"
      :subtitle="activeRow ? String(activeRow[rowKey] ?? '') : '未找到该记录'"
      @close="panel.close"
    >
      <p v-if="rowPanel.hint" class="muted">{{ rowPanel.hint }}</p>
      <dl v-if="activeRow" class="kv-lite">
        <template v-for="field in rowPanel.fields" :key="field.key">
          <dt>{{ field.label }}</dt>
          <dd>{{ displayField(activeRow, field.key) }}</dd>
        </template>
      </dl>
      <p v-else class="muted">记录不存在：链接中的记录可能已删除，或当前筛选下不可见。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { specApi } from '../services/spec'
import type { Row } from '../mock/db'
import { useSessionStore } from '../stores/session'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import PageHeader from '../components/ui/PageHeader.vue'
import HeadActions from '../components/ui/HeadActions.vue'
import StatCards from '../components/ui/StatCards.vue'
import DataTable from '../components/ui/DataTable.vue'
import AppDrawer from '../components/ui/AppDrawer.vue'
import { useRoutePanel } from '../composables/useRoutePanel'
import { SPECS, type PageAction } from './specs'
import { groupFor } from './spec-groups'

const route = useRoute()
const session = useSessionStore()
const project = useProjectStore()
const ui = useUiStore()

const spec = computed(() => SPECS[route.path] ?? SPECS['/fallback'])
const groupInfo = computed(() => groupFor(route.path))
const title = computed(() => spec.value.title)
const rows = ref<Row[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const search = ref('')
const filterValues = reactive<Record<string, string>>({})
const panel = useRoutePanel('spec-row')
const panelOpen = panel.isOpen
const rowPanel = computed(() => spec.value.rowPanel)
const rowKey = computed(() => spec.value.table.rowKey || 'id')
const activeRow = computed(() => {
  if (!panel.activeId.value) return null
  return rows.value.find((row) => String(row[rowKey.value] ?? '') === panel.activeId.value) ?? null
})

function openRow(row: Row) {
  if (rowPanel.value) {
    panel.open(String(row[rowKey.value] ?? ''))
    return
  }
  spec.value.rowClick?.(row, ctx)
}

function visibleRowActions(row: Row) {
  return (spec.value.rowActions?.(row) ?? []).filter((action) => !action.permission || session.can(action.permission))
}

function displayField(row: Row, key: string) {
  if (key === 'chosen') return row.chosen ? '已选' : '未选'
  const value = row[key]
  if (typeof value === 'boolean') return value ? '是' : '否'
  return value === undefined || value === null || value === '' ? '—' : String(value)
}

const ctx = {
  get rows() { return rows.value },
  project,
  reload,
  ui,
  session,
  locate: (rowId: string) => {
    for (const key of Object.keys(filterValues)) delete filterValues[key]
    search.value = rowId
  },
}

const visibleActions = computed(() => (spec.value.actions ?? []).filter((action) => session.can(action.permission)))
const stats = computed(() => spec.value.stats?.(rows.value, ctx) ?? [])
const panels = computed(() => spec.value.side?.(rows.value, ctx) ?? [])

async function reload() {
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, unknown> = { ...(spec.value.table.params ?? {}), limit: spec.value.table.limit ?? 200 }
    if (spec.value.scoped && project.currentId) params.project = project.currentId
    if (search.value) params.q = search.value
    for (const [key, value] of Object.entries(filterValues)) if (value) params[key] = value
    const result = await specApi.list(spec.value.table.endpoint, params)
    rows.value = result.rows
    total.value = result.total
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function run(action: PageAction) {
  if (action.run) {
    action.run(ctx)
    return
  }
  if (action.confirm) {
    ui.confirm(action.confirm.title, action.confirm.message, action.confirm.danger).then(async (yes) => {
      if (!yes) return
      await action.post?.({}, ctx)
      ui.toast(action.toast || '操作完成')
      await reload()
    })
    return
  }
  if (action.dialog) {
    ui.openDialog({
      ...action.dialog,
      onSubmit: async (values: Record<string, unknown>) => {
        await action.post?.(values, ctx)
        ui.toast(action.toast || '已提交')
        await reload()
      },
    })
  }
}

let timer: number | undefined
watch([search, () => ({ ...filterValues })], () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(reload, 260)
}, { deep: true })

watch(() => route.path, () => {
  search.value = ''
  for (const key of Object.keys(filterValues)) delete filterValues[key]
  if (panel.isOpen.value) panel.close()
  reload()
})

watch(() => project.currentId, () => {
  search.value = ''
  for (const key of Object.keys(filterValues)) delete filterValues[key]
  if (panel.isOpen.value) panel.close()
  reload()
})

onMounted(reload)
defineExpose({ reload })
</script>
