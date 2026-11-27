<template>
  <section class="page">
    <PageHeader
      kicker="PROJECTS / COCKPIT"
      :title="projectRow ? `${projectRow.name} · 项目详情` : '项目详情'"
      :desc="projectRow ? `${projectRow.id} · ${projectRow.status} · 当前阶段 ${projectRow.phase}` : '读取项目详情…'"
    >
      <HeadActions>
        <button class="btn" @click="$router.push('/workspace/home')">返回工作台</button>
        <button class="btn" @click="$router.push('/projects/lifecycle')">生命周期</button>
        <button class="btn" @click="reload">刷新</button>
      </HeadActions>
    </PageHeader>

    <div class="card stage-dock">
      <div class="stage-dock-head">
        <div class="stage-dock-title">
          阶段管线
          <span class="card-sub">点击阶段切换下方工作区，关卡动作按当前状态开放</span>
        </div>
        <div class="stage-dock-meta">
          <span class="pill accent">当前 {{ currentStage?.name || '—' }}</span>
          <span class="pill">进度 {{ data.progress ?? 0 }}%</span>
        </div>
      </div>
      <StageRail :stages="stages" interactive :active-key="stageKey" @select="selectStage" />
    </div>

    <StatCards :items="kpis" />

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.6fr) minmax(330px, 1fr); margin-top: 16px">
      <div style="display: grid; gap: 14px; align-content: start">
        <div v-if="selectedStage" class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">{{ selectedStage.name }} · 阶段工作区</h3>
              <p class="card-sub">{{ stageStateText(selectedStage.state) }} · 由阶段管线切换，迁移仍以服务端状态为准</p>
            </div>
            <span class="pill" :class="{ accent: selectedStage.state === 'now' }">{{ stageStateText(selectedStage.state) }}</span>
          </div>

          <div class="stage-meta">
            <div><span class="metric-label">责任方</span><b>{{ selectedStage.owner }}</b></div>
            <div><span class="metric-label">准入关口</span><b>{{ selectedStage.gate }}</b></div>
            <div><span class="metric-label">阶段产出</span><b>{{ selectedStage.out }}</b></div>
          </div>

          <div v-if="stageKey === 'brief'" class="stage-body">
            <div class="stage-block-title">创意基线</div>
            <dl class="kv-lite">
              <dt>题材</dt><dd>{{ projectRow?.genre || '—' }}</dd>
              <dt>目标受众</dt><dd>{{ projectRow?.audience || '不限定' }}</dd>
              <dt>单集时长</dt><dd>{{ projectRow?.duration || '—' }}</dd>
              <dt>画幅</dt><dd>{{ projectRow?.ratio || '—' }}</dd>
              <dt>语言</dt><dd>{{ projectRow?.language || '—' }}</dd>
              <dt>影像风格</dt><dd>{{ projectRow?.style || '不限定' }}</dd>
              <dt>约束</dt><dd>{{ projectRow?.constraints || '—' }}</dd>
            </dl>
            <div v-if="briefs.length" class="stage-list">
              <div class="stage-block-title">创意简报</div>
              <div v-for="brief in briefs" :key="brief.id" class="list-row">
                <span class="k">{{ brief.version }} · {{ brief.mode }} · {{ brief.id }}</span>
                <span class="v">{{ brief.status }} · {{ brief.by }}</span>
                <p class="stage-note">{{ brief.note }}</p>
              </div>
            </div>
            <EmptyState v-else title="暂无创意简报" desc="在创意设定页生成并确认简报后，这里会显示版本与结论。" compact />
          </div>

          <div v-else-if="stageKey === 'script'" class="stage-body">
            <div class="stage-block-title">剧本版本</div>
            <div v-if="scripts.length" class="stage-list">
              <button
                v-for="script in scripts"
                :key="script.id"
                class="list-row row-click stage-row-btn"
                @click="openScript(script)"
              >
                <span class="k">{{ script.version }} · {{ script.id }}</span>
                <span class="v"><StatusPill :status="script.status" /> {{ script.shots }} 镜</span>
              </button>
            </div>
            <EmptyState v-else title="暂无剧本版本" desc="进入剧本版本页创建首个版本，审核通过后锁定基准。" compact />
          </div>

          <div v-else-if="stageKey === 'plan'" class="stage-body">
            <div class="stage-block-title">镜头生产计划</div>
            <div v-if="plans.length" class="stage-list">
              <div v-for="plan in plans" :key="plan.id" class="list-row">
                <span class="k">{{ plan.id }} · {{ plan.scope }}</span>
                <span class="v">{{ plan.shots }} 镜 / {{ plan.tasks }} 任务</span>
                <p class="stage-note">{{ plan.status }} · 固化 {{ plan.frozen }} · {{ plan.note }}</p>
              </div>
            </div>
            <EmptyState v-else title="暂无固化计划" desc="在镜头生产计划页完成契约校验并固化后，这里会显示计划版本。" compact />
            <div class="stage-facts">
              <div><span class="metric-label">视觉资产</span><b>{{ assets.length }} 个</b></div>
              <div><span class="metric-label">正式资产</span><b>{{ formalAssets }} 个</b></div>
              <div><span class="metric-label">计划任务</span><b>{{ stageTasks.length }} 个</b></div>
            </div>
          </div>

          <div v-else-if="stageKey === 'post'" class="stage-body">
            <div class="stage-block-title">分集状态 <span class="card-sub">{{ episodes.length }} 集</span></div>
            <DataTable
              :columns="[
                { key: 'no', label: '集' },
                { key: 'title', label: '标题' },
                { key: 'duration', label: '时长' },
                { key: 'qc', label: '质检', pill: true },
                { key: 'status', label: '状态', pill: true },
              ]"
              :rows="episodes"
              row-key="no"
              clickable
              @row-click="openEpisode"
            />
          </div>

          <div v-else-if="stageKey === 'qc'" class="stage-body">
            <div class="stage-facts">
              <div><span class="metric-label">项目质量</span><b>{{ projectRow?.quality || '未检测' }}</b></div>
              <div><span class="metric-label">质检任务</span><b>{{ stageTasks.length }} 个</b></div>
              <div><span class="metric-label">质量报告</span><b>{{ qualityReports.length }} 份</b></div>
            </div>
            <p class="stage-note">质检结论与返工单在质量域处理；高风险未关闭时不能人工通过。</p>
          </div>

          <div v-else-if="stageKey === 'delivery'" class="stage-body">
            <div class="stage-block-title">交付记录</div>
            <div v-if="deliveries.length" class="stage-list">
              <div v-for="item in deliveries" :key="item.id" class="list-row">
                <span class="k">{{ item.id }} · {{ item.version }}</span>
                <span class="v">{{ item.status }} · {{ item.episodes }} 集 / {{ item.files }} 文件</span>
                <p class="stage-note">接收方 {{ item.receiver }} · {{ item.at }} · 冻结 {{ item.frozen ? '是' : '否' }}</p>
              </div>
            </div>
            <EmptyState v-else title="暂无交付记录" desc="终审通过且集数完整后，在交付包页生成并冻结交付版本。" compact />
          </div>

          <div v-if="showStageTasks" class="stage-body">
            <div class="stage-block-title">
              阶段任务
              <span class="card-sub">{{ stageTasks.length }} 个</span>
            </div>
            <DataTable
              :columns="[
                { key: 'id', label: '任务' },
                { key: 'kind', label: '类型' },
                { key: 'ep', label: '集' },
                { key: 'status', label: '状态', pill: true },
                { key: 'est', label: '预估' },
              ]"
              :rows="stageTasks"
              row-key="id"
            />
          </div>
          <EmptyState
            v-else-if="stageKey === 'video' || stageKey === 'audio'"
            title="本阶段暂无任务"
            desc="进入对应作业页提交生成任务后，这里会按阶段汇总执行状态与成本。"
            compact
          />

          <div class="stage-links">
            <button v-for="link in stageLinks" :key="link.path" class="btn" @click="go(link.path)">
              {{ link.label }} →
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
          <div class="card-head">
            <div>
              <h3 class="card-title">关卡动作</h3>
              <p class="card-sub">服务端按「状态 × 权限」返回 allowed_actions</p>
            </div>
            <span class="pill">{{ (data.allowed_actions || []).length }} 个可用</span>
          </div>
          <div v-if="!(data.allowed_actions || []).length" class="notice warn">
            当前身份（{{ session.name }}）在「{{ projectRow?.status }}」状态下没有可执行动作。
          </div>
          <div
            v-for="action in data.allowed_actions || []"
            :key="action.key"
            class="wf-gate-row"
          >
            <div style="flex: 1; min-width: 0">
              <b style="font-size: 12px">{{ action.label }}</b>
              <div class="card-sub">{{ action.next === '__prev__' ? '回到暂停前状态' : `进入「${action.next}」` }} · 需要{{ permissionLabel(action.permission) }}权限</div>
              <p class="gate-impact">{{ actionImpact(action) }}</p>
            </div>
            <button
              class="btn"
              :class="{ primary: action.tone === 'primary' && !isDanger(action.key), danger: isDanger(action.key) }"
              @click="runAction(action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">项目信息</h3></div>
          <dl class="kv-lite">
            <dt>项目编号</dt><dd>{{ projectRow?.id }}</dd>
            <dt>状态</dt><dd>{{ projectRow?.status }}</dd>
            <dt>当前阶段</dt><dd>{{ projectRow?.phase }}</dd>
            <dt>题材</dt><dd>{{ projectRow?.genre }}</dd>
            <dt>集数</dt><dd>{{ projectRow?.done ?? 0 }} / {{ projectRow?.episodes ?? 0 }}</dd>
            <dt>负责人</dt><dd>{{ projectRow?.owner }} / {{ projectRow?.dept }}</dd>
            <dt>预算</dt><dd>¥{{ Number(projectRow?.actual || 0).toLocaleString('zh-CN') }} / ¥{{ Number(projectRow?.budget || 0).toLocaleString('zh-CN') }}</dd>
            <dt>质量</dt><dd>{{ projectRow?.quality }}</dd>
            <dt>受众</dt><dd>{{ projectRow?.audience || '不限定' }}</dd>
            <dt>单集时长</dt><dd>{{ projectRow?.duration }}</dd>
            <dt>画幅</dt><dd>{{ projectRow?.ratio }}</dd>
            <dt>语言</dt><dd>{{ projectRow?.language }}</dd>
            <dt>风格</dt><dd>{{ projectRow?.style || '不限定' }}</dd>
            <dt>约束</dt><dd>{{ projectRow?.constraints }}</dd>
            <dt>资产 / 审核 / 任务</dt><dd>{{ assets.length }} / {{ reviews.length }} / {{ allTasks.length }}</dd>
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
          <div class="card-head"><h3 class="card-title">最近成本</h3><span class="card-sub">{{ costs.length }} 笔</span></div>
          <button
            v-for="cost in costs.slice(0, 5)"
            :key="cost.id"
            class="list-row row-click stage-row-btn"
            @click="openCost(cost)"
          >
            <span class="k">{{ cost.cap }} · E{{ cost.ep }}</span>
            <span class="v">¥{{ cost.actual }}</span>
          </button>
          <EmptyState v-if="!costs.length" title="暂无成本记录" desc="生成任务产生调用后，成本会自动记账。" compact />
          <div class="act-bar"><button class="btn" @click="go('/cost/ledger')">成本台账</button></div>
        </div>
      </aside>
    </div>

    <AppDrawer :open="drawerOpen" :title="drawerTitle" :subtitle="drawerSubtitle" @close="closeDrawer">
      <dl class="kv-lite">
        <template v-for="item in drawerItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value || '—' }}</dd>
        </template>
      </dl>
      <div class="act-bar">
        <button v-for="link in drawerLinks" :key="link.path" class="btn" @click="go(link.path)">{{ link.label }}</button>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import { workspaceApi } from '../../../services/workspace'
import type { Row } from '../../../mock/db'
import type { GateAction, StageRow } from '../../../mock/state'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import {
  actionImpact,
  isDangerAction as isDanger,
  permissionLabel,
  useGateActionRunner,
} from '../../../composables/useGateActionRunner'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StageRail from '../../../components/ui/StageRail.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import DataTable from '../../../components/ui/DataTable.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const router = useRouter()
const route = useRoute()

const data = ref<Row>({})
const summary = ref<Row>({})
const timeline = ref<Row[]>([])
const blockers = ref<Row[]>([])

const stageLinksMap: Record<string, Array<{ label: string; path: string }>> = {
  brief: [
    { label: '创意设定', path: '/creation/brief' },
    { label: '创意方案', path: '/creation/plan' },
  ],
  script: [
    { label: '剧本版本', path: '/creation/script' },
    { label: '剧本审核', path: '/creation/review' },
    { label: '剧本拆解', path: '/creation/breakdown' },
  ],
  plan: [
    { label: '镜头生产计划', path: '/director/plan' },
    { label: '人物视觉档案', path: '/director/cast' },
    { label: '场景与道具', path: '/director/world' },
    { label: '镜头契约', path: '/director/shots' },
  ],
  video: [
    { label: '视频生产队列', path: '/video/production' },
    { label: '预览与校验', path: '/video/preview' },
  ],
  audio: [
    { label: '对白配音', path: '/audio/dialogue' },
    { label: '声音档案', path: '/audio/voice' },
    { label: '配乐与音效', path: '/audio/bgm' },
    { label: '字幕与口型', path: '/audio/subtitle' },
  ],
  post: [
    { label: '时间线与剪辑', path: '/post/timeline' },
    { label: '分集成片', path: '/post/episodes' },
    { label: '版本链', path: '/post/versions' },
  ],
  qc: [
    { label: '质量报告', path: '/quality/reports' },
    { label: '返工台账', path: '/quality/rework' },
  ],
  delivery: [
    { label: '交付包', path: '/post/delivery' },
    { label: '版本链', path: '/post/versions' },
  ],
}

const stageTaskLabels: Record<string, string[]> = {
  brief: ['创意与剧本'],
  script: ['创意与剧本'],
  plan: ['视觉资产'],
  video: ['视频生产'],
  audio: ['音频'],
  post: ['后期'],
  qc: ['质量检测'],
  delivery: [],
}

const projectRow = computed(() => (data.value.project as Row | undefined) ?? (summary.value.project as Row | undefined) ?? null)
const stages = computed<StageRow[]>(() => (data.value.stages as StageRow[] | undefined) ?? [])
const currentStage = computed(() => stages.value.find((stage) => stage.state === 'now') ?? null)
const defaultStageKey = computed(() => {
  const current = stages.value.find((stage) => stage.state === 'now')
  const blocked = stages.value.find((stage) => stage.state === 'blocked')
  const done = [...stages.value].reverse().find((stage) => stage.state === 'done')
  return (current ?? blocked ?? done ?? stages.value[0])?.key ?? ''
})
const stageKey = computed({
  get() {
    const query = String(route.query.stage ?? '')
    return stages.value.some((stage) => stage.key === query) ? query : defaultStageKey.value
  },
  set(key: string) {
    void router.replace({ query: { ...route.query, stage: key } })
  },
})
const selectedStage = computed(() => stages.value.find((stage) => stage.key === stageKey.value) ?? null)

const kpis = computed(() =>
  ((data.value.kpis as Array<{ label: string; value: string }> | undefined) ?? []).map((item) => ({
    label: item.label,
    value: item.value,
  })),
)

const scripts = computed<Row[]>(() => (summary.value.scripts as Row[] | undefined) ?? [])
const episodes = computed<Row[]>(() => (summary.value.episodes as Row[] | undefined) ?? [])
const costs = computed<Row[]>(() => (summary.value.costs as Row[] | undefined) ?? [])
const assets = computed<Row[]>(() => (summary.value.assets as Row[] | undefined) ?? [])
const reviews = computed<Row[]>(() => (summary.value.reviews as Row[] | undefined) ?? [])
const allTasks = computed<Row[]>(() => (summary.value.tasks as Row[] | undefined) ?? [])
const briefs = computed<Row[]>(() => (summary.value.briefs as Row[] | undefined) ?? [])
const plans = computed<Row[]>(() => (summary.value.plans as Row[] | undefined) ?? [])
const deliveries = computed<Row[]>(() => (summary.value.deliveries as Row[] | undefined) ?? [])
const qualityReports = computed<Row[]>(() => (summary.value.qualityReports as Row[] | undefined) ?? [])

const formalAssets = computed(() => assets.value.filter((row) => row.formal).length)
const stageTasks = computed(() => {
  const labels = stageTaskLabels[stageKey.value] ?? []
  return allTasks.value.filter((row) => labels.includes(String(row.stage)))
})
const showStageTasks = computed(() => stageTasks.value.length > 0 && stageKey.value !== 'post')
const stageLinks = computed(() => stageLinksMap[stageKey.value] ?? [])

function stageStateText(state?: StageRow['state']) {
  if (state === 'done') return '已完成'
  if (state === 'now') return '进行中'
  if (state === 'blocked') return '阻塞'
  return '待开始'
}

function selectStage(stage: StageRow) {
  stageKey.value = stage.key
}

const episodePanel = useRoutePanel('project-episode')
const scriptPanel = useRoutePanel('project-script')
const costPanel = useRoutePanel('project-cost')

const episode = computed(() => episodes.value.find((row) => String(row.no) === episodePanel.activeId.value) ?? null)
const script = computed(() => scripts.value.find((row) => String(row.id) === scriptPanel.activeId.value) ?? null)
const cost = computed(() => costs.value.find((row) => String(row.id) === costPanel.activeId.value) ?? null)

const drawerOpen = computed(() => episodePanel.isOpen.value || scriptPanel.isOpen.value || costPanel.isOpen.value)
const drawerTitle = computed(() => {
  if (episode.value) return `第 ${episode.value.no} 集 · ${episode.value.title}`
  if (script.value) return `剧本 ${script.value.version}`
  if (cost.value) return `${cost.value.cap} · ${cost.value.id}`
  return '项目对象'
})
const drawerSubtitle = computed(() => {
  if (episode.value) return `${episode.value.status} · ${episode.value.duration}`
  if (script.value) return `${script.value.id} · ${script.value.status}`
  if (cost.value) return `${cost.value.task} · ${cost.value.status}`
  return ''
})
const drawerItems = computed<Array<{ label: string; value: string }>>(() => {
  if (episode.value) {
    return [
      { label: '集数', value: `第 ${episode.value.no} 集` },
      { label: '标题', value: String(episode.value.title ?? '') },
      { label: '场次', value: `${episode.value.scenes ?? '—'} 场` },
      { label: '镜头', value: `${episode.value.shots ?? '—'} 镜` },
      { label: '时长', value: String(episode.value.duration ?? '') },
      { label: '质检', value: String(episode.value.qc ?? '') },
      { label: '状态', value: String(episode.value.status ?? '') },
      { label: '时间线', value: String(episode.value.timeline ?? '') },
    ]
  }
  if (script.value) {
    return [
      { label: '版本', value: String(script.value.version ?? '') },
      { label: '状态', value: String(script.value.status ?? '') },
      { label: '集数', value: `${script.value.episodes ?? '—'} 集` },
      { label: '场次', value: `${script.value.scenes ?? '—'} 场` },
      { label: '镜头', value: `${script.value.shots ?? '—'} 镜` },
      { label: '台词行', value: `${script.value.lines ?? '—'} 行` },
      { label: '维护人', value: String(script.value.by ?? '') },
      { label: '更新时间', value: String(script.value.at ?? '') },
      { label: '说明', value: String(script.value.note ?? '') },
    ]
  }
  if (cost.value) {
    return [
      { label: '成本编号', value: String(cost.value.id ?? '') },
      { label: '任务', value: String(cost.value.task ?? '') },
      { label: '集 / 镜头', value: `E${cost.value.ep ?? '—'} / ${cost.value.shot ?? '—'}` },
      { label: '能力', value: String(cost.value.cap ?? '') },
      { label: '预估', value: `¥${cost.value.est ?? '—'}` },
      { label: '实际', value: `¥${cost.value.actual ?? '—'}` },
      { label: '供应商', value: String(cost.value.provider ?? '') },
      { label: '状态', value: String(cost.value.status ?? '') },
      { label: '账单', value: String(cost.value.bill ?? '') },
    ]
  }
  return []
})
const drawerLinks = computed<Array<{ label: string; path: string }>>(() => {
  if (episode.value) return [{ label: '分集输出', path: '/post/episodes' }, { label: '时间线', path: '/post/timeline' }]
  if (script.value) return [{ label: '剧本版本', path: '/creation/script' }, { label: '剧本审核', path: '/creation/review' }]
  if (cost.value) return [{ label: '成本台账', path: '/cost/ledger' }]
  return []
})

function openEpisode(row: Row) {
  episodePanel.open(String(row.no ?? ''))
}
function openScript(row: Row) {
  scriptPanel.open(String(row.id ?? ''))
}
function openCost(row: Row) {
  costPanel.open(String(row.id ?? ''))
}
function closeDrawer() {
  if (episodePanel.isOpen.value) return episodePanel.close()
  if (scriptPanel.isOpen.value) return scriptPanel.close()
  if (costPanel.isOpen.value) return costPanel.close()
}

function go(path: string) {
  router.push(path)
}

async function reload() {
  const id = projectStore.currentId
  if (!id) return
  const [flow, detail, logs, notifications] = await Promise.all([
    projectApi.workflow(id),
    projectApi.summary(id),
    projectApi.timeline(id),
    workspaceApi.notifications(50, id),
  ])
  data.value = flow
  summary.value = detail
  timeline.value = logs
  blockers.value = notifications.rows.filter((row) => row.unread)
}

const { run: runGateAction } = useGateActionRunner({
  projectId: () => projectStore.currentId,
  status: () => projectRow.value?.status,
  reload,
})

function runAction(action: GateAction) {
  return runGateAction(action)
}

const panelStageMap: Record<string, string> = {
  'project-script': 'script',
  'project-episode': 'post',
}

watch(() => projectStore.currentId, reload)
onMounted(async () => {
  const queryId = String(route.query.id ?? '')
  if (queryId) projectStore.select(queryId)
  await reload()
  const panel = String(route.query.panel ?? '')
  const mapped = panelStageMap[panel]
  if (mapped && !route.query.stage) stageKey.value = mapped
})
</script>

<style scoped>
.stage-dock {
  position: sticky;
  top: calc(var(--topbar-h) + 10px);
  z-index: 14;
  margin-bottom: 16px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
  background: var(--surface);
}
.stage-dock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.stage-dock-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  font-size: var(--fs-card);
  font-weight: 700;
  color: var(--ink);
}
.stage-dock-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.stage-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--line);
}
.stage-meta b {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink);
  font-weight: 650;
}
.stage-body {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.stage-block-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.stage-list {
  display: grid;
  gap: 4px;
}
.stage-row-btn {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
}
.stage-note {
  grid-column: 1 / -1;
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.55;
}
.stage-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.stage-facts b {
  display: block;
  margin-top: 3px;
  font-size: 13px;
  color: var(--ink);
}
.stage-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.gate-impact {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}
.wf-gate-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
@media (max-width: 1180px) {
  .stage-dock {
    top: calc(var(--topbar-h) + 6px);
  }
}
@media (max-width: 900px) {
  .stage-meta,
  .stage-facts {
    grid-template-columns: 1fr;
  }
}
</style>
