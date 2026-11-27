<template>
  <section class="page cockpit-page">
    <div class="cockpit-head">
      <div class="cockpit-frame">
        <PageHeader
          kicker="PROJECTS / COCKPIT"
          :title="pageTitle"
          :desc="pageDesc"
        >
          <HeadActions>
            <button v-if="viewMode !== 'project'" class="btn" @click="backToProject">项目概览</button>
            <button v-else class="btn" @click="openBatch(activeBatch?.index ?? 1)">批次看板</button>
            <button class="btn" @click="$router.push('/workspace/home')">返回工作台</button>
            <button class="btn" @click="$router.push('/projects/lifecycle')">生命周期</button>
            <button class="btn" @click="reload">刷新</button>
          </HeadActions>
        </PageHeader>

        <div class="card stage-dock">
          <div class="stage-dock-head">
            <div class="stage-dock-title">
              阶段管线
              <span class="card-sub">项目概览汇总档案与进度；创意、剧本、规划为项目级，生产到交付按单集顺序直达</span>
            </div>
            <div class="stage-dock-meta">
              <span class="pill accent">当前 {{ (viewMode === 'episode' && selectedStage?.name) || currentStage?.name || '—' }}</span>
              <span class="pill">进度 {{ data.progress ?? 0 }}%</span>
            </div>
          </div>
          <StageRail :stages="railStages" interactive :active-key="stageKey" @select="selectStage" />
        </div>
      </div>
    </div>

    <div ref="scrollRef" class="cockpit-scroll">
      <div class="cockpit-frame cockpit-body">
        <template v-if="viewMode === 'project'">
        <div class="spec-grid cockpit-grid">
          <div class="cockpit-main">
            <template v-if="stageKey === 'overview'">
              <StatCards :items="kpis" />

              <div class="card">
                <div class="card-head">
                  <div>
                    <h3 class="card-title">项目概览</h3>
                    <p class="card-sub">项目档案、制作设定、预算与产出统一在此查看</p>
                  </div>
                  <span class="pill accent">进度 {{ data.progress ?? 0 }}%</span>
                </div>
                <div class="overview-progress">
                  <div class="bar"><i :style="{ width: `${data.progress ?? 0}%` }" /></div>
                  <span>{{ projectRow?.done ?? 0 }} / {{ projectRow?.episodes ?? 0 }} 集已完成</span>
                </div>

                <div v-if="batches.length" class="batch-overview">
                  <div class="batch-overview-head">
                    <div>
                      <b>批次交付视图</b>
                      <p>按每 {{ BATCH_SIZE }} 集一批查看资产、模型与交付门禁；单集仍是执行单位。</p>
                    </div>
                    <button class="btn" @click="openBatch(activeBatch?.index ?? 1)">进入批次看板 →</button>
                  </div>
                  <div class="batch-overview-grid">
                    <button
                      v-for="batch in batches"
                      :key="batch.index"
                      class="batch-overview-item"
                      @click="openBatch(batch.index)"
                    >
                      <span class="batch-overview-title">{{ batch.label }} <i>{{ batch.range }}</i></span>
                      <span class="batch-overview-progress">
                        <span class="bar"><i :style="{ width: `${batch.progress}%` }" /></span>
                        <em>{{ batch.doneCount }} / {{ batch.episodes.length }}</em>
                      </span>
                      <span class="batch-overview-meta">{{ batch.status }} · 质检 {{ batch.qcCount }} 集</span>
                    </button>
                  </div>
                </div>

                <div class="overview-grid">
                  <section class="overview-block">
                    <div class="stage-block-title">基本档案</div>
                    <dl class="kv-lite">
                      <dt>项目编号</dt><dd>{{ projectRow?.id }}</dd>
                      <dt>状态</dt><dd>{{ projectRow?.status }}</dd>
                      <dt>当前阶段</dt><dd>{{ projectRow?.phase }}</dd>
                      <dt>题材</dt><dd>{{ projectRow?.genre }}</dd>
                      <dt>集数</dt><dd>{{ projectRow?.done ?? 0 }} / {{ projectRow?.episodes ?? 0 }}</dd>
                      <dt>负责人</dt><dd>{{ projectRow?.owner }}</dd>
                      <dt>所属部门</dt><dd>{{ projectRow?.dept }}</dd>
                    </dl>
                  </section>

                  <section class="overview-block">
                    <div class="stage-block-title">制作设定</div>
                    <dl class="kv-lite">
                      <dt>目标受众</dt><dd>{{ projectRow?.audience || '不限定' }}</dd>
                      <dt>单集时长</dt><dd>{{ projectRow?.duration }}</dd>
                      <dt>画幅</dt><dd>{{ projectRow?.ratio }}</dd>
                      <dt>语言</dt><dd>{{ projectRow?.language }}</dd>
                      <dt>影像风格</dt><dd>{{ projectRow?.style || '不限定' }}</dd>
                      <dt>内容约束</dt><dd>{{ projectRow?.constraints }}</dd>
                    </dl>
                  </section>

                  <section class="overview-block">
                    <div class="stage-block-title">预算与产出</div>
                    <dl class="kv-lite">
                      <dt>预算总额</dt><dd>¥{{ Number(projectRow?.budget || 0).toLocaleString('zh-CN') }}</dd>
                      <dt>已用预算</dt><dd>¥{{ Number(projectRow?.actual || 0).toLocaleString('zh-CN') }}</dd>
                      <dt>剩余预算</dt><dd>¥{{ Math.max(0, Number(projectRow?.budget || 0) - Number(projectRow?.actual || 0)).toLocaleString('zh-CN') }}</dd>
                      <dt>项目质量</dt><dd>{{ projectRow?.quality || '未检测' }}</dd>
                      <dt>资产</dt><dd>{{ assets.length }} 个</dd>
                      <dt>审核</dt><dd>{{ reviews.length }} 次</dd>
                      <dt>任务</dt><dd>{{ allTasks.length }} 个</dd>
                    </dl>
                  </section>
                </div>
              </div>

              <div class="overview-split">
                <div class="card">
                  <div class="card-head">
                    <h3 class="card-title">待处理</h3>
                    <span class="pill warn">{{ blockers.length }}</span>
                  </div>
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
            </template>

            <div v-else-if="selectedStage" class="card">
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

              <StageWorkspace
                :stage-key="stageKey"
                :project="projectRow"
                :summary="summary"
                @open-script="openScript"
                @open-episode="openEpisodeDrawer"
                @navigate="go"
                @refresh="reload"
              />

              <div v-if="stageLinks.length" class="stage-links">
                <button v-for="link in stageLinks" :key="link.path" class="btn" @click="go(link.path)">
                  {{ link.label }} →
                </button>
              </div>
            </div>

            <div v-if="projectActions.length" class="card project-action-strip">
              <div class="project-action-head">
                <div>
                  <h3 class="card-title">项目级操作</h3>
                  <p class="card-sub">仅项目状态与权限可执行的动作；单集制作在 E0–E7 工作区完成</p>
                </div>
                <span class="pill">{{ projectActions.length }} 个可用</span>
              </div>
              <div class="project-action-buttons">
                <button
                  v-for="action in projectActions"
                  :key="action.key"
                  class="btn"
                  :class="{ primary: action.tone === 'primary' && !isDanger(action.key), danger: isDanger(action.key) }"
                  :title="actionImpact(action)"
                  @click="runAction(action)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
      </div>
        </div>
        </template>

        <BatchBoard
          v-if="viewMode === 'batch'"
          :project="projectRow"
          :batches="batches"
          :active-index="activeBatch?.index ?? 1"
          :trials="batchTrials"
          :packages="batchPackages"
          @select-batch="openBatch"
          @open-episode="openEpisodeWorkspace"
          @trial-started="reload"
          @package-created="reload"
          @back="backToProject"
        />

        <EpisodeWorkspace
          v-else-if="viewMode === 'episode' && activeBatch && activeEpisode"
          :project="projectRow"
          :summary="summary"
          :batch="activeBatch"
          :episode="activeEpisode"
          :step="activeStep"
          :revision="dataRevision"
          @select-step="selectEpisodeStep"
          @open-episode="openEpisodeWorkspace"
          @refresh="reload"
          @back="openBatch(activeBatch.index)"
        />

        <EmptyState
          v-else-if="viewMode === 'episode'"
          title="未找到单集"
          desc="当前批次里没有匹配的集号，请返回批次看板重新选择。"
        />
      </div>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import type { BatchPackageDto, BatchTrialDto } from '../../../services/projects/contract'
import { workspaceApi } from '../../../services/workspace'
import type { Row } from '../../../mock/db'
import type { GateAction, StageRow } from '../../../mock/state'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import { useProjectStore } from '../../../stores/project'
import { actionImpact, isDangerAction as isDanger, useGateActionRunner } from '../../../composables/useGateActionRunner'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StageWorkspace from './StageWorkspace.vue'
import BatchBoard from './BatchBoard.vue'
import EpisodeWorkspace from './EpisodeWorkspace.vue'
import { BATCH_SIZE, EPISODE_STEPS, buildBatchGroups, isEpisodeStep, type EpisodeCard, type EpisodeStepKey } from './episodeFlow'
import StageRail from '../../../components/ui/StageRail.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'

const projectStore = useProjectStore()
const router = useRouter()
const route = useRoute()

const data = ref<Row>({})
const summary = ref<Row>({})
const timeline = ref<Row[]>([])
const blockers = ref<Row[]>([])
const dataRevision = ref(0)
const scrollRef = ref<HTMLElement | null>(null)

const stageLinksMap: Record<string, Array<{ label: string; path: string }>> = {
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
}

const projectRow = computed(() => (data.value.project as Row | undefined) ?? (summary.value.project as Row | undefined) ?? null)
const stages = computed<StageRow[]>(() => (data.value.stages as StageRow[] | undefined) ?? [])
const overviewStage = computed<StageRow>(() => ({
  key: 'overview',
  name: '项目概览',
  owner: '项目管理',
  gate: '项目档案与基线',
  out: '进度 / 预算 / 质量 / 成本',
  state: 'overview',
}))
const railStages = computed<StageRow[]>(() => [overviewStage.value, ...stages.value])
const currentStage = computed(() => stages.value.find((stage) => stage.state === 'now') ?? null)
const defaultStageKey = computed(() => 'overview')
const EPISODE_STEP_STAGE: Record<EpisodeStepKey, string> = {
  E0: 'script',
  E1: 'script',
  E2: 'plan',
  E3: 'video',
  E4: 'post',
  E5: 'audio',
  E6: 'qc',
  E7: 'delivery',
}
const stageKey = computed({
  get() {
    const query = String(route.query.stage ?? '')
    if (route.query.view === 'episode') {
      const mapped = EPISODE_STEP_STAGE[activeStep.value]
      if (railStages.value.some((stage) => stage.key === mapped)) return mapped
    }
    return railStages.value.some((stage) => stage.key === query) ? query : defaultStageKey.value
  },
  set(key: string) {
    void router.replace({ query: { ...route.query, stage: key } })
  },
})
const selectedStage = computed(() => railStages.value.find((stage) => stage.key === stageKey.value) ?? null)

const viewMode = computed(() => {
  const value = String(route.query.view ?? 'project')
  return value === 'batch' || value === 'episode' ? value : 'project'
})
const batches = computed(() => buildBatchGroups(summary.value))
const batchTrials = computed<BatchTrialDto[]>(
  () => (summary.value.batchTrials as BatchTrialDto[] | undefined) ?? [],
)
const batchPackages = computed<BatchPackageDto[]>(
  () =>
    ((summary.value.deliveries as BatchPackageDto[] | undefined) ?? []).filter(
      (row) => row.kind === '批次包',
    ),
)
const activeBatch = computed(() => {
  const requested = Number(route.query.batch ?? 0)
  return batches.value.find((batch) => batch.index === requested) ?? batches.value[0] ?? null
})
const activeEpisode = computed(() => {
  if (!activeBatch.value) return null
  const requested = Number(route.query.episode ?? 0)
  return activeBatch.value.episodes.find((item) => item.no === requested) ?? activeBatch.value.episodes[0] ?? null
})
const activeStep = computed<EpisodeStepKey>(() => {
  const value = String(route.query.step ?? '')
  return isEpisodeStep(value) ? value : (activeEpisode.value?.flow.currentStep ?? 'E0')
})
const activeStepMeta = computed(
  () => EPISODE_STEPS.find((step) => step.key === activeStep.value) ?? EPISODE_STEPS[0],
)
const pageTitle = computed(() => {
  const name = projectRow.value?.name ?? '项目详情'
  if (viewMode.value === 'batch' && activeBatch.value) return `${name} · ${activeBatch.value.label} 批次`
  if (viewMode.value === 'episode' && activeEpisode.value) return `${name} · 第 ${activeEpisode.value.no} 集`
  return `${name} · 项目详情`
})
const pageDesc = computed(() => {
  void dataRevision.value
  const row = projectRow.value
  if (!row) return '读取项目详情…'
  if (viewMode.value === 'batch' && activeBatch.value) {
    return `${row.id} · ${activeBatch.value.range} · ${activeBatch.value.status} · ${activeBatch.value.doneCount}/${activeBatch.value.episodes.length} 集已交付`
  }
  if (viewMode.value === 'episode' && activeEpisode.value) {
    return `${row.id} · ${activeStepMeta.value.key} ${activeStepMeta.value.name} · 完成度 ${activeEpisode.value.flow.progress}% · ${activeEpisode.value.flow.note}`
  }
  return `${row.id} · ${row.status} · 当前阶段 ${row.phase}`
})

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

const stageLinks = computed(() => stageLinksMap[stageKey.value] ?? [])

function stageStateText(state?: StageRow['state']) {
  if (state === 'overview') return '项目汇总'
  if (state === 'done') return '已完成'
  if (state === 'now') return '进行中'
  if (state === 'blocked') return '阻塞'
  return '待开始'
}

function navigateQuery(updates: Record<string, string | undefined>, clear: string[] = []) {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && !clear.includes(key)) query[key] = value
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete query[key]
    else query[key] = value
  }
  void router.replace({ query })
}

const LEGACY_STAGE_STEP: Record<string, EpisodeStepKey> = {
  video: 'E3',
  audio: 'E5',
  post: 'E4',
  qc: 'E6',
  delivery: 'E7',
}

function redirectLegacyStage(stage: string, force = false): boolean {
  const step = LEGACY_STAGE_STEP[stage]
  if (!step || (!force && route.query.view) || !batches.value.length) return false
  const requestedBatch = Number(route.query.batch ?? 0)
  const targetBatch =
    batches.value.find((batch) => batch.index === requestedBatch) ??
    batches.value.find((batch) => batch.activeCount > 0) ??
    batches.value.find((batch) => batch.doneCount < batch.episodes.length) ??
    batches.value[0]
  const targetEpisode =
    targetBatch.episodes.find((item) => !item.flow.done && item.flow.currentStep === step) ??
    targetBatch.episodes.find((item) => !item.flow.done) ??
    targetBatch.episodes[0]
  if (!targetEpisode) return false
  openEpisodeWorkspace(targetEpisode, step)
  return true
}

function selectStage(stage: StageRow) {
  if (redirectLegacyStage(stage.key, true)) return
  navigateQuery(
    { stage: stage.key, view: undefined, batch: undefined, episode: undefined, step: undefined },
    ['view', 'batch', 'episode', 'step'],
  )
}

function backToProject() {
  navigateQuery(
    { view: undefined, batch: undefined, episode: undefined, step: undefined },
    ['view', 'batch', 'episode', 'step'],
  )
}

function openBatch(index: number) {
  navigateQuery(
    { view: 'batch', batch: String(index), episode: undefined, step: undefined },
    ['stage', 'view', 'batch', 'episode', 'step'],
  )
}

function openEpisodeWorkspace(item: EpisodeCard, step?: EpisodeStepKey) {
  const batchIndex = Math.ceil(item.no / BATCH_SIZE)
  navigateQuery(
    {
      view: 'episode',
      batch: String(batchIndex),
      episode: String(item.no),
      step: step ?? item.flow.currentStep,
    },
    ['stage', 'view', 'batch', 'episode', 'step'],
  )
}

function selectEpisodeStep(step: EpisodeStepKey) {
  navigateQuery({ step })
}

watch([stageKey, viewMode, activeStep], async () => {
  await nextTick()
  scrollRef.value?.scrollTo({ top: 0 })
})

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

function openEpisodeDrawer(row: Row) {
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
  dataRevision.value += 1
}

const projectActions = computed<GateAction[]>(() =>
  ((data.value.allowed_actions as GateAction[] | undefined) ?? []).filter(
    (action) => action.key !== 'confirmBrief',
  ),
)

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
watch(
  () => [String(route.query.stage ?? ''), batches.value.length] as const,
  ([stage]) => {
    if (stage) redirectLegacyStage(stage)
  },
  { immediate: true },
)
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
.cockpit-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cockpit-head {
  flex: none;
  position: relative;
  z-index: 15;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}
.cockpit-frame {
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: 0 var(--sp-6);
}
.cockpit-head .cockpit-frame {
  padding-top: 20px;
  padding-bottom: 14px;
}
.cockpit-head .page-head {
  margin-bottom: 12px;
  padding-bottom: 12px;
}
.stage-dock {
  margin: 0;
  padding: 12px 14px;
  background: var(--surface);
  box-shadow: none;
}
.stage-dock :deep(.stage-rail) {
  grid-template-columns: repeat(9, minmax(0, 1fr));
  overflow-x: hidden;
}
.stage-dock :deep(.stage-card) {
  min-width: 0;
}
.cockpit-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}
.cockpit-body {
  padding-top: 16px;
  padding-bottom: 56px;
}
.cockpit-grid {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
.cockpit-main {
  display: grid;
  gap: 14px;
  align-content: start;
  min-width: 0;
}
.overview-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.overview-progress .bar {
  flex: 1;
}
.overview-progress span {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.batch-overview {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}
.batch-overview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.batch-overview-head b {
  font-size: 12px;
  color: var(--ink);
}
.batch-overview-head p {
  margin: 4px 0 0;
  max-width: 680px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.batch-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.batch-overview-item {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.batch-overview-item:hover {
  border-color: var(--accent);
}
.batch-overview-title {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
}
.batch-overview-title i {
  color: var(--faint);
  font-style: normal;
  font-weight: 400;
}
.batch-overview-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.batch-overview-progress .bar {
  flex: 1;
  height: 5px;
}
.batch-overview-progress em {
  min-width: 34px;
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
  text-align: right;
}
.batch-overview-meta {
  color: var(--faint);
  font-size: 10px;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.overview-block {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  padding: 10px 12px;
}
.overview-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
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
.project-action-strip {
  padding: 12px 14px;
}
.project-action-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.project-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
@media (max-width: 1100px) {
  .stage-dock :deep(.stage-rail) {
    grid-template-columns: repeat(9, 112px);
    overflow-x: auto;
  }
}
@media (max-width: 1180px) {
  .batch-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cockpit-head .cockpit-frame {
    padding-top: 14px;
    padding-bottom: 10px;
  }
}
@media (max-width: 900px) {
  .stage-meta,
  .stage-facts,
  .overview-split,
  .batch-overview-grid {
    grid-template-columns: 1fr;
  }
  .cockpit-frame {
    padding: 0 var(--sp-4);
  }
}
</style>
