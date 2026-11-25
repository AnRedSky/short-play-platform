<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / LIFECYCLE" title="生命周期与状态机" desc="15 个状态的进入条件与出口动作；当前项目高亮，可执行动作由服务端返回。">
      <HeadActions><button class="btn" @click="$router.push('/projects/workflow')">去流水线执行</button></HeadActions>
    </PageHeader>

    <div class="card" style="margin-bottom: 16px">
      <div class="card-head">
        <div>
          <h3 class="card-title">当前项目</h3>
          <p class="card-sub">{{ current?.name }} · {{ current?.status }}</p>
        </div>
        <div class="act-bar">
          <button v-for="action in allowed" :key="action.key" class="btn" :class="{ primary: action.tone === 'primary' }" @click="run(action)">{{ action.label }}</button>
        </div>
      </div>
      <StageRail :stages="stages" />
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr)">
      <div class="card">
        <div class="card-head"><h3 class="card-title">状态定义（15）</h3><span class="card-sub">状态是唯一事实，文案不参与判定</span></div>
        <DataTable :columns="columns" :rows="states" row-key="name" clickable @row-click="pick">
          <template #actions="{ row }">
            <span v-if="row.name === current?.status" class="pill accent">当前</span>
            <button v-else class="link-btn" @click="preview(row)">查看出口</button>
          </template>
        </DataTable>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">{{ selectedState?.name || current?.status }} · 出口</h3></div>
          <div class="checklist">
            <div v-for="action in actionsOf(selectedState?.name || current?.status)" :key="action.key" class="ck">
              <i class="on">→</i><span>{{ action.label }} → {{ action.next === '__prev__' ? '暂停前状态' : action.next }}<em class="muted"> · {{ action.permission }}</em></span>
            </div>
            <div v-if="!actionsOf(selectedState?.name || current?.status).length" class="empty">该状态为终态或需要系统自动迁移</div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">阶段与关口</h3></div>
          <div v-for="stage in pipeline" :key="stage.key" class="list-row">
            <span class="k">{{ stage.name }}</span>
            <span class="v">{{ stage.gate }}</span>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { projectApi } from '../../../services/projects'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import { GATE_ACTIONS } from '../../../mock/state'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StageRail from '../../../components/ui/StageRail.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'

const projectStore = useProjectStore()
const ui = useUiStore()
const states = ref<Row[]>([])
const pipeline = ref<Row[]>([])
const stages = ref<any[]>([])
const allowed = ref<any[]>([])
const selectedState = ref<Row | null>(null)

const current = computed(() => projectStore.current)

const columns: Column[] = [
  { key: 'name', label: '状态' },
  { key: 'mean', label: '含义' },
  { key: 'enter', label: '进入条件' },
  { key: 'end', label: '出口' },
]

function actionsOf(name?: string) {
  return name ? GATE_ACTIONS[name] ?? [] : []
}

function pick(row: Row) {
  selectedState.value = row
}

function preview(row: Row) {
  selectedState.value = row
  ui.toast(`「${row.name}」出口 ${actionsOf(String(row.name)).length} 个`, 'info')
}

async function run(action: any) {
  if (action.needReason) {
    ui.openDialog({
      title: action.label,
      subtitle: `当前状态「${current.value?.status}」→「${action.next === '__prev__' ? '暂停前状态' : action.next}」；必须填写原因。`,
      fields: [{ key: 'reason', label: '原因', type: 'textarea', required: true, placeholder: '说明为什么执行该动作' }],
      submitLabel: '确认执行',
      onSubmit: async (values) => {
        await projectApi.transition(projectStore.currentId, action.key, String(values.reason))
        ui.toast(`${action.label} 已完成`)
        await projectStore.load()
        await load()
      },
    })
    return
  }
  await projectApi.transition(projectStore.currentId, action.key)
  ui.toast(`${action.label} 已完成`)
  await projectStore.load()
  await load()
}

async function load() {
  const [stateRows, pipelineRows, workflow] = await Promise.all([
    projectApi.states(),
    projectApi.pipeline(),
    projectApi.workflow(projectStore.currentId),
  ])
  states.value = stateRows.rows
  pipeline.value = pipelineRows.rows
  stages.value = workflow.stages
  allowed.value = workflow.allowed_actions
  selectedState.value = stateRows.rows.find((row) => row.name === workflow.project?.status) ?? null
}

onMounted(load)
</script>
