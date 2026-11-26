<template>
  <section class="page">
    <PageHeader kicker="VIDEO / PRODUCTION" title="视频生产队列" desc="任务队列与并发控制；提交前校验镜头契约、预算与重复任务，失败重试受 maxAttempts 约束。">
      <HeadActions>
        <button class="btn" @click="$router.push('/tasks/list')">全部任务</button>
        <button class="btn" @click="advance">推进队列</button>
        <button class="btn primary" v-if="session.can('production.write')" @click="createTask">新建生成任务</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '队列任务', value: tasks.length },
      { label: '执行中', value: count('执行中'), hint: '并发上限 3' },
      { label: '排队中', value: count('排队中') },
      { label: '失败', value: count('失败'), hint: '可重试' },
      { label: '预算占用', value: budgetPercent, hint: budgetText },
    ]" />

    <div class="kanban-lite" style="margin: 18px 0">
      <div v-for="column in columns" :key="column.status" class="kanban-col-lite">
        <h4>{{ column.status }}<span>{{ column.rows.length }}</span></h4>
        <div v-for="task in column.rows.slice(0, 8)" :key="task.id" class="kanban-item-lite" @click="open(task)">
          <b>{{ task.id }} · {{ task.kind }}</b>
          <small>{{ task.project }} · E{{ task.ep }} {{ task.shot }}</small>
          <div style="display: flex; gap: 6px; margin-top: 5px; align-items: center">
            <StatusPill :status="task.status" />
            <span class="tag">{{ task.est }}s</span>
            <span class="tag">尝试 {{ task.attempt }}/{{ task.maxAttempts }}</span>
          </div>
        </div>
        <EmptyState v-if="!column.rows.length" title="本栏暂无任务" desc="切换集数或等待任务进入该状态。" compact />
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">任务明细</h3>
          <p class="card-sub">详情走 L1；重试先做 L2 影响确认，取消为 L3；提交前校验契约、预算与重复任务。</p>
        </div>
      </div>
      <DataTable :columns="tableColumns" :rows="tasks" row-key="id" wide clickable @row-click="open">
        <template #actions="{ row }">
          <button class="link-btn" @click="retry(row)">重试</button>
          <button class="link-btn danger" @click="cancel(row)">取消</button>
          <button class="link-btn" @click="open(row)">详情</button>
        </template>
      </DataTable>
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeTask ? `${activeTask.id} · ${activeTask.kind}` : '任务详情'"
      :subtitle="activeTask?.status || '未找到该任务'"
      @close="panel.close"
    >
      <div v-if="activeTask" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn" @click="retry(activeTask)">重试</button>
          <button class="btn danger" @click="cancel(activeTask)">取消</button>
        </div>
        <dl class="kv-lite">
          <dt>项目 / 集</dt><dd>{{ activeTask.project }} · E{{ activeTask.ep }}</dd>
          <dt>场 / 镜</dt><dd>{{ activeTask.scene }} / {{ activeTask.shot }}</dd>
          <dt>输入</dt><dd>{{ activeTask.input }}</dd>
          <dt>输出</dt><dd>{{ activeTask.output }}</dd>
          <dt>模型</dt><dd>{{ activeTask.model }} · {{ activeTask.config }}</dd>
          <dt>执行人</dt><dd>{{ activeTask.executor }}</dd>
          <dt>尝试</dt><dd>{{ activeTask.attempt }} / {{ activeTask.maxAttempts }}</dd>
          <dt>预估 / 实际</dt><dd>{{ activeTask.est }}s / {{ activeTask.actual }}s</dd>
          <dt>失败原因</dt><dd>{{ activeTask.failReason }}</dd>
          <dt>质检</dt><dd>{{ activeTask.qc }}</dd>
        </dl>
        <div class="card">
          <div class="card-head"><h3 class="card-title">尝试记录</h3></div>
          <div v-for="attempt in attempts" :key="attempt.id" class="list-row">
            <span class="k">#{{ attempt.n }} · {{ attempt.at }}</span>
            <span class="v"><StatusPill :status="attempt.status" /> {{ attempt.fail }}</span>
          </div>
          <EmptyState v-if="!attempts.length" title="暂无尝试记录" desc="任务执行后，每次尝试与失败原因会记录在此。" compact />
        </div>
      </div>
      <p v-else class="muted">记录不存在：链接中的任务可能已删除，或不属于当前项目。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { directorApi } from '../../services/director'
import { videoApi } from '../../services/video'
import { useRoutePanel } from '../../composables/useRoutePanel'
import { budgetText as formatBudget, budgetUsedUp, cancelBlockReason, findActiveTask, retryBlockReason } from '../../composables/videoGate'
import { findShotContractIssues, formatShotContractIssue } from '../../composables/breakdownGate'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const tasks = ref<Row[]>([])
const panel = useRoutePanel('video-task')
const attempts = ref<Row[]>([])
const activeTask = computed(() => {
  if (!panel.activeId.value) return null
  return tasks.value.find((row) => String(row.id) === panel.activeId.value) ?? null
})

const tableColumns: Column[] = [
  { key: 'id', label: '任务', mono: true },
  { key: 'project', label: '项目' },
  { key: 'ep', label: '集' },
  { key: 'shot', label: '镜头', mono: true },
  { key: 'kind', label: '类型' },
  { key: 'status', label: '状态', pill: true },
  { key: 'priority', label: '优先级' },
  { key: 'model', label: '模型' },
  { key: 'est', label: '预估', format: (row) => `${row.est}s` },
  { key: 'attempt', label: '尝试', format: (row) => `${row.attempt}/${row.maxAttempts}` },
]

const budgetText = computed(() => formatBudget(projectStore.current))
const budgetPercent = computed(() => {
  const project = projectStore.current
  const total = Number(project?.budget ?? 0)
  if (!total) return '—'
  return `${Math.round((Number(project?.actual ?? 0) / total) * 100)}%`
})

const columns = computed(() => [
  { status: '待执行', rows: tasks.value.filter((row) => row.status === '待执行') },
  { status: '排队中', rows: tasks.value.filter((row) => row.status === '排队中') },
  { status: '执行中', rows: tasks.value.filter((row) => row.status === '执行中') },
  { status: '失败', rows: tasks.value.filter((row) => row.status === '失败') },
  { status: '已完成', rows: tasks.value.filter((row) => row.status === '成功' || row.status === '已完成') },
])

function count(status: string) {
  return tasks.value.filter((row) => row.status === status).length
}

async function load() {
  const result = await videoApi.tasks(projectStore.currentId)
  tasks.value = result.rows
}

function open(task: Row) {
  panel.open(String(task.id ?? ''))
}

async function loadAttempts(id: string) {
  attempts.value = id ? await videoApi.attempts(id) : []
}

function costNote(task: Row) {
  const cost = Number(task.failedCost ?? 0)
  return cost > 0 ? `已产生费用 ¥${cost.toLocaleString('zh-CN')} 不退` : '已产生的模型调用成本不退'
}

async function findShot(task: Row) {
  const result = await directorApi.shots(projectStore.currentId, 999)
  return result.rows.find((row) => Number(row.ep) === Number(task.ep) && String(row.no) === String(task.shot)) ?? null
}

async function checkProductionGate(task: Row): Promise<{ shot: Row | null; error: string }> {
  if (budgetUsedUp(projectStore.current)) {
    return { shot: null, error: `预算已用 100%（${budgetText.value}），不能提交生成；请追加预算或缩减范围` }
  }
  const shot = await findShot(task)
  if (!shot) {
    return { shot: null, error: `未找到第 ${task.ep} 集镜头 ${task.shot}，不能提交生成；请先在拆解中补齐该镜头` }
  }
  const issues = findShotContractIssues([shot])
  if (issues.length) {
    return { shot: null, error: formatShotContractIssue(issues[0]) }
  }
  return { shot, error: '' }
}

async function retry(task: Row) {
  const blocked = retryBlockReason(task)
  if (blocked) {
    ui.toast(`${task.id} ${blocked}`, 'bad')
    return
  }
  const gate = await checkProductionGate(task)
  if (!gate.shot) {
    ui.toast(gate.error, 'bad')
    return
  }
  const next = Number(task.attempt) + 1
  const yes = await ui.confirm(
    '重试任务',
    `将为 ${task.id} 新增第 ${next}/${task.maxAttempts} 次尝试，使用镜头 ${task.shot} 的同一组输入与模型。失败也可能产生费用；原任务与尝试记录保留。`,
  )
  if (!yes) return
  await videoApi.retry(String(task.id))
  ui.toast(`任务 ${task.id} 已重试（第 ${next} 次尝试）`)
  await load()
  await loadAttempts(String(task.id))
}

async function cancel(task: Row) {
  const blocked = cancelBlockReason(task)
  if (blocked) {
    ui.toast(`${task.id} ${blocked}`, 'bad')
    return
  }
  const yes = await ui.confirm(
    '取消任务',
    `取消 ${task.id} 后该镜头需重新提交，${costNote(task)}；已完成的尝试记录与审计保留。`,
    true,
  )
  if (!yes) return
  await videoApi.cancel(String(task.id))
  ui.toast(`任务 ${task.id} 已取消`)
  await load()
  await loadAttempts(String(task.id))
}

async function advance() {
  const queued = tasks.value.filter((row) => row.status === '排队中').slice(0, 2)
  const running = tasks.value.filter((row) => row.status === '执行中').slice(0, 2)
  for (const task of running) await videoApi.updateTask(String(task.id), { status: '已完成', actual: task.est, qc: 'PASS' })
  for (const task of queued) await videoApi.updateTask(String(task.id), { status: '执行中' })
  ui.toast(`队列已推进：完成 ${running.length}，启动 ${queued.length}（mock 模拟）`)
  await load()
}

function createTask() {
  const first = tasks.value[0]
  ui.openDialog({
    title: '新建生成任务',
    subtitle: '任务按镜头独立创建，便于单独重试与记账；提交前校验镜头契约与预算。',
    fields: [
      { key: 'ep', label: '集数', type: 'number', required: true, value: Number(first?.ep ?? 17) },
      { key: 'shot', label: '镜号', type: 'text', required: true, value: String(first?.shot ?? 'SH-04'), placeholder: '例如 SH-04' },
      { key: 'kind', label: '类型', type: 'select', options: [{ value: '视频生成', label: '视频生成' }, { value: '音频合成', label: '音频合成' }, { value: '口型校验', label: '口型校验' }] },
      { key: 'priority', label: '优先级', type: 'select', options: [{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }] },
      { key: 'est', label: '预估时长（秒）', type: 'number', required: true, value: Number(first?.est ?? 38), hint: '1–600 秒；用于并发与预算预估。' },
    ],
    submitLabel: '提交任务',
    onSubmit: async (values) => {
      const ep = Number(values.ep)
      const shotNo = String(values.shot ?? '').trim().toUpperCase()
      const est = Number(values.est)
      if (!Number.isInteger(ep) || ep < 1) throw new Error('「集数」必须是大于 0 的整数')
      if (!shotNo) throw new Error('「镜号」不能为空')
      if (!Number.isInteger(est) || est < 1 || est > 600) throw new Error('「预估时长」必须是 1–600 秒的整数')
      const active = findActiveTask(tasks.value, ep, shotNo, String(values.kind))
      if (active) throw new Error(`镜头 ${shotNo} 已有进行中的${values.kind}任务 ${active.id}，不能重复提交`)
      const gate = await checkProductionGate({ ep, shot: shotNo })
      if (!gate.shot) throw new Error(gate.error)
      const shot = gate.shot
      await videoApi.createTask({
        ...values,
        project: projectStore.currentId,
        ep,
        shot: shotNo,
        scene: shot.scene,
        input: shot.refs,
        model: shot.model,
        output: values.kind === '音频合成' ? 'WAV 48k' : values.kind === '口型校验' ? '校验报告' : `MP4 1080×1920 · ${shot.duration}`,
        est,
      })
      ui.toast(`镜头 ${shotNo} 的${values.kind}任务已提交`)
      await load()
    },
  })
}

watch(() => panel.activeId.value, (id) => { void loadAttempts(id) }, { immediate: true })

watch(() => projectStore.currentId, () => {
  if (panel.isOpen.value) panel.close()
  attempts.value = []
  load()
})

onMounted(load)
</script>
