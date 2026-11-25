<template>
  <section class="page">
    <PageHeader kicker="VIDEO / PRODUCTION" title="视频生产队列" desc="任务队列与并发控制；失败可重试，重试次数受 maxAttempts 约束，成本按尝试分别记账。">
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
        <div v-if="!column.rows.length" class="empty" style="padding: 10px">空</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">任务明细</h3>
          <p class="card-sub">行操作直接调用 mock API：重试 / 取消 / 查看尝试记录。</p>
        </div>
      </div>
      <DataTable :columns="tableColumns" :rows="tasks" row-key="id" wide>
        <template #actions="{ row }">
          <button class="link-btn" @click="retry(row)">重试</button>
          <button class="link-btn" @click="cancel(row)">取消</button>
          <button class="link-btn" @click="open(row)">详情</button>
        </template>
      </DataTable>
    </div>

    <AppDrawer :open="!!selected" :title="selected ? `${selected.id} · ${selected.kind}` : ''" :subtitle="selected?.status" @close="selected = null">
      <div v-if="selected" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn" @click="retry(selected)">重试</button>
          <button class="btn" @click="cancel(selected)">取消</button>
        </div>
        <dl class="kv-lite">
          <dt>项目 / 集</dt><dd>{{ selected.project }} · E{{ selected.ep }}</dd>
          <dt>场 / 镜</dt><dd>{{ selected.scene }} / {{ selected.shot }}</dd>
          <dt>输入</dt><dd>{{ selected.input }}</dd>
          <dt>输出</dt><dd>{{ selected.output }}</dd>
          <dt>模型</dt><dd>{{ selected.model }} · {{ selected.config }}</dd>
          <dt>执行人</dt><dd>{{ selected.executor }}</dd>
          <dt>尝试</dt><dd>{{ selected.attempt }} / {{ selected.maxAttempts }}</dd>
          <dt>预估 / 实际</dt><dd>{{ selected.est }}s / {{ selected.actual }}s</dd>
          <dt>失败原因</dt><dd>{{ selected.failReason }}</dd>
          <dt>质检</dt><dd>{{ selected.qc }}</dd>
        </dl>
        <div class="card">
          <div class="card-head"><h3 class="card-title">尝试记录</h3></div>
          <div v-for="attempt in attempts" :key="attempt.id" class="list-row">
            <span class="k">#{{ attempt.n }} · {{ attempt.at }}</span>
            <span class="v"><StatusPill :status="attempt.status" /> {{ attempt.fail }}</span>
          </div>
          <div v-if="!attempts.length" class="empty">暂无尝试记录</div>
        </div>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { videoApi } from '../../services/video'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const tasks = ref<Row[]>([])
const selected = ref<Row | null>(null)
const attempts = ref<Row[]>([])

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

const statuses = ['排队中', '执行中', '失败', '已完成']
const columns = computed(() => statuses.map((status) => ({ status, rows: tasks.value.filter((row) => row.status === status) })))

function count(status: string) {
  return tasks.value.filter((row) => row.status === status).length
}

async function load() {
  const result = await videoApi.tasks(projectStore.currentId)
  tasks.value = result.rows
}

async function open(task: Row) {
  selected.value = task
  attempts.value = await videoApi.attempts(String(task.id))
}

async function retry(task: Row) {
  await videoApi.retry(String(task.id))
  ui.toast(`任务 ${task.id} 已重试`)
  await load()
}

async function cancel(task: Row) {
  const yes = await ui.confirm('取消任务', `取消 ${task.id} 后该镜头需重新提交，已产生的成本不退回。`, true)
  if (!yes) return
  await videoApi.cancel(String(task.id))
  ui.toast(`任务 ${task.id} 已取消`)
  await load()
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
  ui.openDialog({
    title: '新建生成任务',
    subtitle: '任务按镜头独立创建，便于单独重试与记账。',
    fields: [
      { key: 'ep', label: '集数', type: 'number', value: 17 },
      { key: 'shot', label: '镜号', value: 'SH-04' },
      { key: 'kind', label: '类型', type: 'select', options: [{ value: '视频生成', label: '视频生成' }, { value: '音频合成', label: '音频合成' }, { value: '口型校验', label: '口型校验' }] },
      { key: 'priority', label: '优先级', type: 'select', options: [{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }] },
      { key: 'est', label: '预估时长（秒）', type: 'number', value: 38 },
    ],
    submitLabel: '提交任务',
    onSubmit: async (values) => {
      await videoApi.createTask({ ...values, project: projectStore.currentId, ep: Number(values.ep), est: Number(values.est) })
      ui.toast('任务已提交')
      await load()
    },
  })
}

onMounted(load)
</script>
