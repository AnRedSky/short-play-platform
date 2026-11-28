<template>
  <section class="page">
    <PageHeader
      title="工作台"
      desc="先看项目状态，再处理待办与运行任务；项目行可直接打开详情。"
    >
      <HeadActions>
        <button class="btn" @click="inbox.openInbox()">
          待办与通知
          <span v-if="inbox.unread" class="count-badge">{{ inbox.unread }}</span>
        </button>
        <button v-if="session.can('project.create')" class="btn primary" @click="createOpen = true">新建项目</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="metrics" />

    <div class="ws-grid">
      <div class="card ws-projects">
        <div class="card-head">
          <div>
            <h3 class="card-title">项目</h3>
            <p class="card-sub">按关联关系、状态与部门筛选；点击行查看详情，右侧动作直接进入制作流水线。</p>
          </div>
          <span class="filter-count">{{ visible.length }} / {{ projects.length }} 个</span>
        </div>

        <div class="tabs ws-tabs">
          <button v-for="tab in relationTabs" :key="tab.key" class="tab" :class="{ active: query.relation === tab.key }" @click="query.relation = tab.key">
            {{ tab.label }}<span class="count-badge">{{ tab.count }}</span>
          </button>
        </div>

        <div class="toolbar">
          <input v-model="search" class="search" placeholder="搜索项目名 / 编号 / 题材" />
          <select v-model="query.status" class="filter">
            <option value="">状态 · 全部</option>
            <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
          </select>
          <select v-model="query.dept" class="filter">
            <option value="">部门 · 全部</option>
            <option v-for="item in depts" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>

        <DataTable :columns="columns" :rows="visible" row-key="id" :loading="loading" clickable @row-click="openRow" />
      </div>

      <aside class="ws-side">
        <div class="card ws-modules">
          <div class="card-head">
            <h3 class="card-title">工作台模块</h3>
            <span class="card-sub">三个核心入口</span>
          </div>
          <div class="module-list">
            <button class="module-item" @click="go('projects/workflow')">
              <b>项目管理</b>
              <small>项目详情与流水线推进</small>
            </button>
            <button class="module-item" @click="go('post/delivery')">
              <b>项目文件管理</b>
              <small>交付包、版本与项目文件</small>
            </button>
            <button class="module-item" @click="go('tasks/list')">
              <b>创作任务管理</b>
              <small>生产任务、重试与排队</small>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">当前项目流水线</h3>
            <button class="btn ghost" @click="go('projects/workflow')">进入</button>
          </div>
          <div v-if="project.current" style="display: grid; gap: 8px">
            <div class="card-sub">{{ project.current.name }} · {{ project.current.status }}</div>
            <StageRail :stages="home.pipeline || []" />
          </div>
          <EmptyState v-else title="尚未选择项目" desc="在左侧列表选择项目后查看流水线。" compact />
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">运行中的任务</h3>
            <button class="btn ghost" @click="go('tasks/list')">任务台</button>
          </div>
          <EmptyState v-if="!taskGroups.length" title="暂无运行任务" desc="从创意或视频页发起生成任务后，这里会跟踪执行状态。" compact />
          <div v-for="group in taskGroups" :key="group.key" class="list-row">
            <span class="k">{{ group.kind }} · {{ group.project }}</span>
            <span class="v">{{ group.count }} 个 · 预计 {{ group.est }} 秒 <StatusPill :status="group.status" /></span>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">最近动作</h3>
            <button class="btn ghost" @click="showAudits = !showAudits">{{ showAudits ? '收起' : '展开' }}</button>
          </div>
          <p v-if="!showAudits" class="card-sub">默认收起；展开后查看最近操作留痕。</p>
          <div v-else>
            <div v-for="audit in home.audits || []" :key="audit.time + audit.action" class="list-row">
              <span class="k">{{ audit.time }}</span>
              <span class="v">{{ audit.action }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <AppDrawer
      :open="isOpen"
      :title="selected?.name || '项目详情'"
      :subtitle="selected ? `${selected.id} · ${selected.status}` : '正在读取项目…'"
      @close="closePanel"
    >
      <div v-if="selected">
        <div class="act-bar">
          <button class="btn primary" @click="go('projects/workflow', selected.id)">进入制作流水线</button>
          <button class="btn" @click="go('projects/workflow', selected.id)">项目详情</button>
          <button class="btn" @click="go('creation/script', selected.id)">剧本版本</button>
        </div>
        <dl class="kv-lite">
          <dt>题材</dt><dd>{{ selected.genre }}</dd>
          <dt>受众</dt><dd>{{ selected.audience }}</dd>
          <dt>集数与时长</dt><dd>{{ selected.episodes }} 集 · {{ selected.duration }}</dd>
          <dt>画幅</dt><dd>{{ selected.ratio }}</dd>
          <dt>负责人</dt><dd>{{ selected.owner }} / {{ selected.dept }}</dd>
          <dt>脚本基准</dt><dd>{{ selected.scriptVersion || '—' }}</dd>
          <dt>时间线</dt><dd>{{ selected.timelineVersion || '—' }}</dd>
          <dt>预算</dt><dd>¥{{ money(selected.actual) }} / ¥{{ money(selected.budget) }}（{{ selected.budgetState }}）</dd>
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

    <ProjectCreateDialog :open="createOpen" @close="createOpen = false" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { workspaceApi } from '../../services/workspace'
import { projectApi } from '../../services/projects'
import { useRoutePanel } from '../../composables/useRoutePanel'
import { useTableQuery } from '../../composables/useTableQuery'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useInboxStore } from '../../stores/inbox'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StageRail from '../../components/ui/StageRail.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import ProjectCreateDialog from './components/ProjectCreateDialog.vue'

const session = useSessionStore()
const project = useProjectStore()
const inbox = useInboxStore()
const router = useRouter()
const home = ref<Row>({})
const projects = ref<Row[]>([])
const loading = ref(false)
const createOpen = ref(false)
const showAudits = ref(false)
const { activeId, isOpen, open: openPanel, close: closePanel } = useRoutePanel('project')
const selected = computed(() => projects.value.find((row) => String(row.id) === activeId.value) ?? null)

const activeProjects = computed(() => projects.value.filter((row) => !['已交付', '已归档', '已终止', '草稿'].includes(String(row.status))))

const metrics = computed(() => [
  { label: '在制项目', value: activeProjects.value.length, hint: `共 ${projects.value.length} 个项目` },
  { label: '运行任务', value: runningTasks.value, hint: '排队与执行中' },
  { label: '待处理', value: inbox.unread, hint: inbox.unread ? '从通知弹窗逐条处理' : '暂无阻塞待办' },
  { label: '预算占用', value: `¥${totalCost.value.toLocaleString('zh-CN')}`, hint: '全部项目实际发生' },
])

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
query.status = ''
query.dept = ''

const columns: Column[] = [
  { key: 'name', label: '项目', width: '184px' },
  { key: 'status', label: '状态', pill: true, width: '94px', nowrap: true },
  { key: 'phase', label: '阶段', width: '100px', nowrap: true },
  { key: 'done', label: '集数', width: '52px', nowrap: true, format: (row) => `${row.done ?? 0} / ${row.episodes ?? 0}` },
  { key: 'quality', label: '质量', pill: true, width: '58px', nowrap: true },
  { key: 'updated', label: '最近更新', width: '104px', nowrap: true },
]

const runningTasks = computed(() => Number((home.value.metrics || []).find((item: Row) => item.label === '运行任务')?.value ?? 0))
const taskGroups = computed(() => {
  const groups = new Map<string, { key: string; kind: string; project: string; count: number; est: number; status: string }>()
  for (const task of (home.value.tasks as Row[] | undefined) ?? []) {
    const kind = String(task.kind ?? '生成任务')
    const project = String(task.project ?? '未关联项目')
    const key = `${kind}|${project}`
    const current = groups.get(key) ?? { key, kind, project, count: 0, est: 0, status: String(task.status ?? '排队中') }
    current.count += 1
    current.est += Number(task.est ?? 0)
    groups.set(key, current)
  }
  return [...groups.values()]
})
const totalCost = computed(() => projects.value.reduce((sum, row) => sum + Number(row.actual || 0), 0))
const statuses = computed(() => [...new Set(projects.value.map((row) => String(row.status)))].filter(Boolean))
const depts = computed(() => [...new Set(projects.value.map((row) => String(row.dept)))].filter(Boolean))

const relationTabs = computed(() => [
  { key: 'all', label: '全部', count: projects.value.length },
  { key: 'own', label: '我负责', count: projects.value.filter((row) => row.ownerId === session.identity?.userId).length },
  { key: 'join', label: '我参与', count: projects.value.filter((row) => row.ownerId !== session.identity?.userId && related(row)).length },
  { key: 'review', label: '待我审核', count: projects.value.filter((row) => String(row.status).includes('待') && related(row)).length },
])

function related(row: Row) {
  const me = session.identity?.userId
  return row.ownerId === me || (row.members || []).some((member: Row) => member.userId === me)
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString('zh-CN')
}

function go(path: string, id?: unknown) {
  if (id) project.select(String(id))
  router.push(`/${path}`)
}

function openRow(row: Row) {
  openPanel(String(row.id))
}

async function load() {
  loading.value = true
  try {
    const [summary, list] = await Promise.all([workspaceApi.home(), projectApi.list()])
    home.value = summary
    projects.value = list.rows
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ws-grid { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(320px, 1fr); gap: 16px; margin-top: 16px; align-items: start; }
.ws-projects { display: grid; gap: 12px; min-width: 0; }
.ws-tabs { margin-bottom: 0; }
.ws-side { display: grid; gap: 14px; }
.module-list { display: grid; gap: 6px; }
.module-item { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-ctl, 8px); background: var(--surface-2); color: var(--muted); text-align: left; cursor: pointer; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.module-item:hover { border-color: var(--line-strong); background: var(--surface-3); color: var(--ink); }
.module-item b { font-size: 12.5px; font-weight: 640; color: var(--ink); }
.module-item small { font-size: 11px; color: var(--muted); }
@media (max-width: 1280px) {
  .ws-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
