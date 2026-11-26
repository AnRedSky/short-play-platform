<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / LIST" title="项目列表" desc="项目是资产、任务、成本与交付的唯一归属单元。列表字段直接来自接口，不由前端文案伪造。">
      <HeadActions>
        <button class="btn" @click="load">刷新</button>
        <button class="btn primary" v-if="session.can('project.create')" @click="$router.push('/projects/new')">新建项目</button>
      </HeadActions>
    </PageHeader>

    <div class="tabs">
      <button v-for="tab in relationTabs" :key="tab.key" class="tab" :class="{ active: query.relation === tab.key }" @click="query.relation = tab.key">
        {{ tab.label }}<span class="count-badge">{{ tab.count }}</span>
      </button>
    </div>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <input v-model="search" class="search" placeholder="搜索项目名 / 编号 / 题材" />
      <select v-model="query.status" class="filter">
        <option value="">状态 · 全部</option>
        <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="query.dept" class="filter">
        <option value="">部门 · 全部</option>
        <option v-for="item in depts" :key="item" :value="item">{{ item }}</option>
      </select>
      <span class="filter-count">{{ visible.length }} / {{ projects.length }} 个项目</span>
    </div>

    <StatCards :items="[
      { label: '项目总数', value: projects.length },
      { label: '在制', value: projects.filter(p => !['已交付', '已归档', '已终止', '草稿'].includes(p.status)).length },
      { label: '待我处理', value: projects.filter(p => p.status.includes('待') && related(p)).length },
      { label: '预算占用', value: '¥' + projects.reduce((s, p) => s + Number(p.actual || 0), 0).toLocaleString('zh-CN') },
    ]" />

    <div style="margin-top: 18px">
      <DataTable :columns="columns" :rows="visible" row-key="id" :loading="loading" clickable wide @row-click="openRow">
        <template #actions="{ row }">
          <button class="link-btn" @click="goto(row, 'projects/workflow')">流水线</button>
          <button class="link-btn" @click="openRow(row)">详情</button>
        </template>
      </DataTable>
    </div>

    <AppDrawer
      :open="isOpen"
      :title="selected?.name || '项目详情'"
      :subtitle="selected ? `${selected.id} · ${selected.status}` : '正在读取项目…'"
      @close="closePanel"
    >
      <div v-if="selected">
        <div class="act-bar">
          <button class="btn primary" @click="goto(selected, 'projects/workflow')">进入制作流水线</button>
          <button class="btn" @click="goto(selected, 'projects/detail')">项目详情</button>
          <button class="btn" @click="goto(selected, 'creation/script')">剧本版本</button>
        </div>
        <dl class="kv-lite">
          <dt>题材</dt><dd>{{ selected.genre }}</dd>
          <dt>受众</dt><dd>{{ selected.audience }}</dd>
          <dt>集数与时长</dt><dd>{{ selected.episodes }} 集 · {{ selected.duration }}</dd>
          <dt>画幅</dt><dd>{{ selected.ratio }}</dd>
          <dt>负责人</dt><dd>{{ selected.owner }} / {{ selected.dept }}</dd>
          <dt>脚本基准</dt><dd>{{ selected.scriptVersion || '—' }}</dd>
          <dt>时间线</dt><dd>{{ selected.timelineVersion || '—' }}</dd>
          <dt>预算</dt><dd>¥{{ Number(selected.actual || 0).toLocaleString('zh-CN') }} / ¥{{ Number(selected.budget || 0).toLocaleString('zh-CN') }}（{{ selected.budgetState }}）</dd>
          <dt>约束</dt><dd>{{ selected.constraints }}</dd>
        </dl>
        <div class="card">
          <div class="card-head"><h3 class="card-title">成员</h3></div>
          <div v-for="member in selected.members || []" :key="member.userId" class="list-row">
            <span class="k">{{ member.userId }}</span><span class="v">{{ member.role }}</span>
          </div>
        </div>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { projectApi } from '../../services/projects'
import { useRoutePanel } from '../../composables/useRoutePanel'
import { useTableQuery } from '../../composables/useTableQuery'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const router = useRouter()
const projects = ref<Row[]>([])
const loading = ref(false)
const { activeId, isOpen, open: openPanel, close: closePanel } = useRoutePanel('project')
const selected = computed(() => projects.value.find((row) => String(row.id) === activeId.value) ?? null)
const { search, filters: query, visible } = useTableQuery(projects, {
  search: (row) => `${row.name}${row.id}${row.genre}`,
  filter: (row, filters) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.dept && row.dept !== filters.dept) return false
    if (filters.relation === 'own') return row.ownerId === session.identity?.userId
    if (filters.relation === 'join') return row.ownerId !== session.identity?.userId && related(row)
    if (filters.relation === 'review') return String(row.status).includes('待') && related(row)
    return true
  },
})
query.relation = 'all'

const columns: Column[] = [
  { key: 'name', label: '项目', width: '180px' },
  { key: 'id', label: '编号', mono: true },
  { key: 'genre', label: '题材' },
  { key: 'status', label: '状态', pill: true },
  { key: 'phase', label: '阶段' },
  { key: 'done', label: '集数', format: (row) => `${row.done ?? 0} / ${row.episodes ?? 0}` },
  { key: 'owner', label: '负责人' },
  { key: 'dept', label: '部门' },
  { key: 'budgetState', label: '预算', pill: true },
  { key: 'quality', label: '质量', pill: true },
  { key: 'updated', label: '最近更新', mono: true },
]

const statuses = computed(() => [...new Set(projects.value.map((row) => String(row.status)))].filter(Boolean))
const depts = computed(() => [...new Set(projects.value.map((row) => String(row.dept)))].filter(Boolean))

function related(row: Row) {
  const me = session.identity?.userId
  return row.ownerId === me || (row.members || []).some((member: Row) => member.userId === me)
}

const relationTabs = computed(() => [
  { key: 'all', label: '全部', count: projects.value.length },
  { key: 'own', label: '我负责', count: projects.value.filter((row) => row.ownerId === session.identity?.userId).length },
  { key: 'join', label: '我参与', count: projects.value.filter((row) => row.ownerId !== session.identity?.userId && related(row)).length },
  { key: 'review', label: '待我审核', count: projects.value.filter((row) => String(row.status).includes('待') && related(row)).length },
])

async function load() {
  loading.value = true
  try {
    const result = await projectApi.list()
    projects.value = result.rows
  } finally {
    loading.value = false
  }
}

function goto(row: Row, path: string) {
  projectStore.select(String(row.id))
  router.push(`/${path}`)
}

function openRow(row: Row) {
  openPanel(String(row.id))
}

onMounted(load)
</script>
