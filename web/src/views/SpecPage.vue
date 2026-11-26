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
          :clickable="!!spec.rowClick"
          wide
          :empty-title="spec.emptyTitle || '暂无数据'"
          :empty-hint="spec.emptyHint || '调整筛选条件或先创建一条记录。'"
          @row-click="spec.rowClick?.($event, ctx)"
        >
          <template v-if="spec.rowActions" #actions="{ row }">
            <button v-for="action in spec.rowActions(row)" :key="action.label" class="link-btn" :class="{ danger: action.danger }" @click="run(action)">
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

const ctx = {
  get rows() { return rows.value },
  project,
  reload,
  ui,
  session,
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
  reload()
})

onMounted(reload)
defineExpose({ reload })
</script>
