<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / WORKFLOW" :title="projectRow ? `${projectRow.name} · 制作流水线` : '制作流水线'"
      :desc="projectRow ? `${projectRow.id} · ${projectRow.status} · 当前阶段 ${projectRow.phase}` : '读取项目流水线…'">
      <HeadActions>
        <button class="btn" @click="go('projects/detail')">项目详情</button>
        <button class="btn" @click="reload">刷新</button>
      </HeadActions>
    </PageHeader>

    <div class="grid grid-4" style="margin-bottom: 16px">
      <div v-for="kpi in data.kpis || []" :key="kpi.label" class="card stat-card">
        <div class="metric-label">{{ kpi.label }}</div>
        <div class="v">{{ kpi.value }}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 16px">
      <div class="card-head">
        <div>
          <h3 class="card-title">阶段管线</h3>
          <p class="card-sub">阶段由状态推导；关卡动作只能由具备权限的身份在当前状态执行。</p>
        </div>
        <span class="pill accent">进度 {{ data.progress ?? 0 }}%</span>
      </div>
      <StageRail :stages="data.stages || []" />
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr)">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">关卡动作</h3>
              <p class="card-sub">服务端按「状态 × 权限」返回 allowed_actions；前端不自行判断。</p>
            </div>
            <span class="pill">{{ (data.allowed_actions || []).length }} 个可用</span>
          </div>

          <div v-if="!(data.allowed_actions || []).length" class="notice warn">
            当前身份（{{ session.name }}）在「{{ projectRow?.status }}」状态下没有可执行动作。切换身份或等待其他关口责任人处理。
          </div>

          <div v-for="action in data.allowed_actions || []" :key="action.key" class="wf-gate-row" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--line)">
            <div style="flex: 1; min-width: 0">
              <b style="font-size: 12px">{{ action.label }}</b>
              <div class="card-sub">{{ action.next === '__prev__' ? '回到暂停前状态' : `进入「${action.next}」` }} · 需要{{ permissionLabel(action.permission) }}权限</div>
              <p class="gate-impact">{{ actionImpact(action) }}</p>
            </div>
            <button class="btn" :class="{ primary: action.tone === 'primary' && !isDanger(action.key), danger: isDanger(action.key) }" @click="runAction(action)">{{ action.label }}</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">下游节点</h3><span class="card-sub">按阶段顺序；点开即在对应页面继续作业</span></div>
          <div class="grid grid-3" style="gap: 10px">
            <button v-for="node in nodes" :key="node.path" class="card flat" style="text-align: left; cursor: pointer" @click="go(node.path)">
              <div class="metric-label">{{ node.kicker }}</div>
              <div class="card-title" style="margin-top: 4px">{{ node.label }}</div>
              <div class="card-sub">{{ node.hint }}</div>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">动作与审核历史</h3></div>
          <EmptyState v-if="!timeline.length" title="尚无动作记录" desc="执行关卡动作后，操作人、时间与结果会在此留痕。" compact />
          <div v-for="item in timeline" :key="item.at + item.title" class="timeline-item">
            <time>{{ item.at }}</time>
            <b>{{ item.title }}</b>
            <p>{{ item.by }} · {{ item.kind }} · {{ item.note }}</p>
          </div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">项目事实</h3></div>
          <dl class="kv-lite">
            <dt>项目编号</dt><dd>{{ projectRow?.id }}</dd>
            <dt>题材</dt><dd>{{ projectRow?.genre }}</dd>
            <dt>集数</dt><dd>{{ projectRow?.done ?? 0 }} / {{ projectRow?.episodes ?? 0 }}</dd>
            <dt>负责人</dt><dd>{{ projectRow?.owner }}</dd>
            <dt>预算</dt><dd>¥{{ Number(projectRow?.actual || 0).toLocaleString('zh-CN') }} / ¥{{ Number(projectRow?.budget || 0).toLocaleString('zh-CN') }}</dd>
            <dt>脚本基准</dt><dd>{{ projectRow?.scriptVersion }}</dd>
            <dt>时间线</dt><dd>{{ projectRow?.timelineVersion }}</dd>
            <dt>约束</dt><dd>{{ projectRow?.constraints }}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">待处理</h3><span class="pill warn">{{ blockers.length }}</span></div>
          <EmptyState v-if="!blockers.length" title="当前无阻塞项" desc="项目可继续推进；异常与待办会在此列出。" compact />
          <div v-for="item in blockers" :key="item.id" class="list-row">
            <span class="k">{{ item.title }}</span>
            <span class="v">{{ item.impact }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">状态机口径</h3></div>
          <div class="checklist">
            <div class="ck"><i class="on">✓</i><span>终态：已交付 / 已归档 / 已终止，不可回退</span></div>
            <div class="ck"><i class="on">✓</i><span>退回动作必须填写原因并留审计</span></div>
            <div class="ck"><i class="on">✓</i><span>暂停可恢复，异常可恢复或终止</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import { workspaceApi } from '../../../services/workspace'
import type { Row } from '../../../mock/db'
import type { GateAction } from '../../../mock/state'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StageRail from '../../../components/ui/StageRail.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()
const router = useRouter()

const data = ref<Row>({})
const DANGER_ACTIONS = ['terminate', 'archive', 'deliver']
function isDanger(key: unknown) {
  return DANGER_ACTIONS.includes(String(key))
}

const PERMISSION_LABELS: Record<string, string> = {
  'creation.write': '创作编辑',
  'script.review': '剧本审核',
  'director.write': '导演编辑',
  'production.write': '生产执行',
  'post.write': '后期制作',
  'quality.operate': '质量处置',
  'final.review': '终审',
  'delivery.execute': '交付执行',
  'project.manage': '项目管理',
}

const ACTION_IMPACTS: Record<string, string> = {
  start: '项目从草稿进入创意策划，负责人和成员会收到启动通知。',
  confirmBrief: '创意方案被确认后进入剧本创作，后续修改需新建版本。',
  submitScript: '剧本进入待审核，审核人将收到待办；此时不再接受正文修改。',
  approveScript: '剧本锁定并进入生产准备，下游镜头与资产按该版本引用。',
  rejectScript: '剧本退回创作，必须写清退回原因，返工记录会写入审计。',
  confirmPlan: '镜头计划固化，下游生成任务开始按计划派发。',
  toPost: '生产阶段结束并转入后期，未完成任务会保留为阻塞项。',
  pause: '暂停后不再派发新任务，执行中的任务按服务端状态继续或回收。',
  submitQc: '进入质量检测，检测完成前不能进入终审。',
  passQc: '质量检测通过后进入待最终审核，阻断项必须全部关闭。',
  failQc: '存在阻断项时退回后期，返工原因与轮次会记账。',
  finalApprove: '终审通过后进入已完成，可生成交付包。',
  finalReject: '终审退回后期，已交付版本不会自动覆盖。',
  deliver: '生成交付包并冻结当前版本，交付后不可覆盖历史。',
  archive: '归档后项目进入只读终态，资产与审计记录保留。',
  resume: '恢复暂停前的生产状态，未完成任务重新进入调度。',
  terminate: '终止是不可逆终态，未完成任务停止，原因必须留审计。',
}

function permissionLabel(code: unknown) {
  const key = String(code ?? '')
  return PERMISSION_LABELS[key] ? `「${PERMISSION_LABELS[key]}」` : `「${key}」`
}

function actionImpact(action: GateAction) {
  return action.hint || ACTION_IMPACTS[action.key] || '该动作会推进项目状态并写入审计日志。'
}

function actionTarget(action: GateAction) {
  return action.next === '__prev__' ? '暂停前状态' : `「${action.next}」`
}
const timeline = ref<Row[]>([])
const blockers = ref<Row[]>([])

const projectRow = computed(() => data.value.project)
const nodes = [
  { kicker: 'CREATION', label: '创意设定', hint: '题材 / 受众 / 约束', path: 'creation/brief' },
  { kicker: 'PLAN', label: '创意方案', hint: '多方案对比与确认', path: 'creation/plan' },
  { kicker: 'SCRIPT', label: '剧本版本', hint: '版本链与锁定', path: 'creation/script' },
  { kicker: 'REVIEW A', label: '剧本审核', hint: '通过 / 退回 / 终止', path: 'creation/review' },
  { kicker: 'DIRECTOR', label: '镜头契约', hint: '分镜与镜头要素', path: 'director/shots' },
  { kicker: 'VIDEO', label: '视频生产', hint: '队列与重试', path: 'video/production' },
  { kicker: 'AUDIO', label: '音频字幕', hint: '配音 / 字幕 / 口型', path: 'audio/subtitle' },
  { kicker: 'POST', label: '后期合成', hint: '时间线与分集输出', path: 'post/timeline' },
  { kicker: 'QC', label: '质量检测', hint: '报告与返工', path: 'quality/reports' },
  { kicker: 'FINAL', label: '最终审核', hint: '终审结论与留痕', path: 'post/review' },
  { kicker: 'DELIVERY', label: '交付包', hint: '交付清单与冻结', path: 'post/delivery' },
]

function go(path: string) {
  router.push(`/${path}`)
}

async function reload() {
  if (!projectStore.currentId) return
  data.value = await projectApi.workflow(projectStore.currentId)
  timeline.value = await projectApi.timeline(projectStore.currentId)
  const notifications = await workspaceApi.notifications(50, projectStore.currentId)
  blockers.value = notifications.rows.filter((row) => row.unread)
}

async function runAction(action: GateAction) {
  if (action.needReason) {
    ui.openDialog({
      title: action.label,
      subtitle: `当前状态「${projectRow.value?.status}」→ ${actionTarget(action)}。${actionImpact(action)}`,
      danger: action.key === 'terminate',
      fields: [{ key: 'reason', label: '原因', type: 'textarea', required: true, placeholder: '说明为什么执行该动作，原因会写入审计日志' }],
      submitLabel: '确认执行',
      onSubmit: async (values) => {
        await projectApi.transition(projectStore.currentId, action.key, String(values.reason))
        ui.toast(`${action.label} 已完成`)
        await projectStore.load()
        await reload()
      },
    })
    return
  }
  const danger = isDanger(action.key)
  const yes = await ui.confirm(
    action.label,
    `当前状态「${projectRow.value?.status}」→ ${actionTarget(action)}。${actionImpact(action)}该动作会写入审计日志。`,
    danger,
  )
  if (!yes) return
  await projectApi.transition(projectStore.currentId, action.key)
  ui.toast(`${action.label} 已完成`)
  await projectStore.load()
  await reload()
}

watch(() => projectStore.currentId, reload)
onMounted(reload)
</script>

<style scoped>
.gate-impact {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}
</style>
