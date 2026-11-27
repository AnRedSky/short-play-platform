<script setup lang="ts">
import { computed } from 'vue'
import type { Row } from '../../../mock/db'
import type { BatchGroup, EpisodeCard, EpisodeStepKey } from './episodeFlow'
import { EPISODE_STEPS, padEpisode } from './episodeFlow'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'

const props = defineProps<{
  project: Row | null
  summary: Row
  batch: BatchGroup
  episode: EpisodeCard
  step: EpisodeStepKey
}>()

const emit = defineEmits<{
  (event: 'select-step', step: EpisodeStepKey): void
  (event: 'open-episode', item: EpisodeCard): void
  (event: 'back'): void
}>()

const no = computed(() => props.episode.no)
const epRow = computed(() => props.episode.row)
const flow = computed(() => props.episode.flow)
const stepMeta = computed(() => EPISODE_STEPS.find((step) => step.key === props.step) ?? EPISODE_STEPS[0])
const model = computed(() => String(epShots.value[0]?.model ?? '未接入'))
const owner = computed(() => String(props.project?.owner ?? '未分配'))

function list(key: string): Row[] {
  return (props.summary[key] as Row[] | undefined) ?? []
}

const epShots = computed(() => list('shots').filter((row) => Number(row.ep) === no.value))
const epTasks = computed(() => list('tasks').filter((row) => Number(row.ep) === no.value))
const epTimelines = computed(() => list('timelines').filter((row) => Number(row.ep) === no.value))
const epDialogues = computed(() => list('dialogues').filter((row) => Number(row.ep) === no.value))
const epSubtitles = computed(() => list('subtitles').filter((row) => Number(row.ep) === no.value))
const epLipSync = computed(() => list('lipSync').filter((row) => Number(row.ep) === no.value))
const allScripts = computed(() => list('scripts'))
const allReports = computed(() => list('qualityReports'))
const allIssues = computed(() => list('qualityIssues'))
const allDeliveries = computed(() => list('deliveries'))
const allReviews = computed(() => list('reviews'))
const projectAssets = computed(() => list('assets'))

const episodePattern = computed(() => new RegExp(`第\\s*${no.value}\\s*集|E${padEpisode(no.value)}`, 'i'))
const epQualityReports = computed(() =>
  allReports.value.filter((row) => episodePattern.value.test(`${row.object ?? ''} ${row.id ?? ''}`)),
)
const epQualityIssues = computed(() => {
  const ids = new Set(epQualityReports.value.map((row) => String(row.id)))
  return allIssues.value.filter((row) => ids.has(String(row.report)))
})
const epReviews = computed(() =>
  allReviews.value.filter((row) => episodePattern.value.test(`${row.object ?? ''} ${row.ep ?? ''}`)),
)
const epDeliveries = computed(() => allDeliveries.value.filter((row) => String(row.project ?? '') === String(props.project?.id ?? '')))

const prevEpisode = computed(() => {
  const index = props.batch.episodes.findIndex((item) => item.no === no.value)
  return index > 0 ? props.batch.episodes[index - 1] : null
})
const nextEpisode = computed(() => {
  const index = props.batch.episodes.findIndex((item) => item.no === no.value)
  return index >= 0 && index < props.batch.episodes.length - 1 ? props.batch.episodes[index + 1] : null
})

const missingShots = computed(() =>
  epShots.value.filter(
    (row) => !String(row.desc ?? '').trim() || !String(row.chars ?? '').trim() || !String(row.duration ?? '').trim(),
  ),
)
const failedTasks = computed(() => epTasks.value.filter((row) => String(row.status ?? '') === '失败'))
const staleTimelines = computed(() => epTimelines.value.filter((row) => Number(row.stale ?? 0) > 0))
const qcFails = computed(() => epQualityReports.value.filter((row) => String(row.result ?? '') === 'FAIL'))
const lockedScript = computed(() => allScripts.value.find((row) => Boolean(row.locked)) ?? null)
const projectDone = computed(() => Number(props.project?.done ?? 0))
const projectEpisodes = computed(() => Number(props.project?.episodes ?? props.batch.episodes.length))

const checks = computed(() => {
  if (props.step === 'E0') {
    return [
      { label: '本集纲要已建立', ok: Boolean(epRow.value.title) },
      { label: '时长目标已确定', ok: Boolean(epRow.value.duration) },
      { label: '前集衔接可查', ok: Boolean(prevEpisode.value) },
      { label: '后集钩子可查', ok: Boolean(nextEpisode.value) },
      { label: '镜头需求已生成', ok: epShots.value.length > 0 },
    ]
  }
  if (props.step === 'E1') {
    return [
      { label: '项目剧本版本可用', ok: allScripts.value.length > 0 },
      { label: '正式版本已锁定', ok: Boolean(lockedScript.value) },
      { label: '单集剧本已拆分', ok: false },
      { label: '审核结论已回写', ok: epReviews.value.length > 0 },
    ]
  }
  if (props.step === 'E2') {
    return [
      { label: '镜头契约已生成', ok: epShots.value.length > 0 },
      { label: '契约缺项已清零', ok: missingShots.value.length === 0 },
      { label: '模型配置可读', ok: model.value !== '未接入' },
      { label: '关键资产可引用', ok: projectAssets.value.length > 0 },
    ]
  }
  if (props.step === 'E3') {
    return [
      { label: '本集已有生成任务', ok: epTasks.value.length > 0 },
      { label: '无失败任务', ok: failedTasks.value.length === 0 },
      { label: '失败任务可重试', ok: true },
      { label: '单集素材包已生成', ok: false },
    ]
  }
  if (props.step === 'E4') {
    return [
      { label: '时间线已建立', ok: epTimelines.value.length > 0 },
      { label: '无过期片段', ok: staleTimelines.value.length === 0 },
      { label: '画面已锁定', ok: epTimelines.value.some((row) => String(row.status ?? '').includes('已输出')) },
    ]
  }
  if (props.step === 'E5') {
    return [
      { label: '对白已生成', ok: epDialogues.value.some((row) => String(row.audio ?? '').startsWith('已生成')) },
      { label: '字幕已校对', ok: epSubtitles.value.some((row) => String(row.status ?? '').includes('已通过')) },
      { label: '口型任务可查', ok: epLipSync.value.length > 0 },
      { label: '混音检查可执行', ok: false },
    ]
  }
  if (props.step === 'E6') {
    return [
      { label: '单集 QC 报告已出', ok: epQualityReports.value.length > 0 },
      { label: '无阻断项', ok: qcFails.value.length === 0 },
      { label: '问题项已闭环', ok: epQualityIssues.value.every((row) => String(row.auto ?? '') === '是') },
    ]
  }
  return [
    { label: '项目集数已完整', ok: projectDone.value >= projectEpisodes.value },
    { label: '单集 QC 已通过', ok: flow.value.steps[6]?.state === 'done' },
    { label: '单集交付包已生成', ok: false },
    { label: '平台入库记录已生成', ok: false },
  ]
})

const risks = computed(() => {
  const items: Array<{ label: string; tone: string; detail: string }> = []
  if (failedTasks.value.length) {
    items.push({ label: '失败任务', tone: 'bad', detail: `${failedTasks.value.length} 个生成任务失败，需重试或换模型` })
  }
  if (staleTimelines.value.length) {
    items.push({ label: '过期片段', tone: 'warn', detail: `${staleTimelines.value.length} 个时间线存在过期片段` })
  }
  if (qcFails.value.length) {
    items.push({ label: 'QC 阻断', tone: 'bad', detail: `${qcFails.value.length} 份单集 QC 报告 FAIL` })
  }
  if (missingShots.value.length) {
    items.push({ label: '镜头缺项', tone: 'warn', detail: `${missingShots.value.length} 个镜头契约字段缺失` })
  }
  return items
})

const shotColumns: Column[] = [
  { key: 'no', label: '镜号' },
  { key: 'scene', label: '场' },
  { key: 'frame', label: '景别' },
  { key: 'duration', label: '时长' },
  { key: 'status', label: '状态', pill: true },
  { key: 'model', label: '模型' },
  { key: 'desc', label: '画面' },
]
const taskColumns: Column[] = [
  { key: 'id', label: '任务' },
  { key: 'shot', label: '镜号' },
  { key: 'kind', label: '类型' },
  { key: 'status', label: '状态', pill: true },
  { key: 'attempt', label: '尝试' },
  { key: 'model', label: '模型' },
  { key: 'failReason', label: '失败原因' },
]
const timelineColumns: Column[] = [
  { key: 'version', label: '版本' },
  { key: 'tracks', label: '轨道' },
  { key: 'clips', label: '片段' },
  { key: 'duration', label: '时长' },
  { key: 'stale', label: '过期' },
  { key: 'status', label: '状态', pill: true },
]
const dialogueColumns: Column[] = [
  { key: 'char', label: '角色' },
  { key: 'text', label: '台词' },
  { key: 'voice', label: '音色' },
  { key: 'audio', label: '音频' },
  { key: 'status', label: '状态', pill: true },
]
const subtitleColumns: Column[] = [
  { key: 'version', label: '版本' },
  { key: 'lines', label: '行' },
  { key: 'asr', label: '校对' },
  { key: 'style', label: '样式' },
  { key: 'status', label: '状态', pill: true },
]
const reportColumns: Column[] = [
  { key: 'id', label: '报告' },
  { key: 'level', label: '级别' },
  { key: 'result', label: '结论', pill: true },
  { key: 'items', label: '检查项' },
  { key: 'issues', label: '问题' },
  { key: 'engine', label: '引擎' },
]
const issueColumns: Column[] = [
  { key: 'dim', label: '维度' },
  { key: 'where', label: '位置' },
  { key: 'level', label: '风险' },
  { key: 'action', label: '建议' },
  { key: 'auto', label: '自动' },
]
const deliveryColumns: Column[] = [
  { key: 'id', label: '交付包' },
  { key: 'version', label: '版本' },
  { key: 'episodes', label: '集数' },
  { key: 'status', label: '状态', pill: true },
  { key: 'receiver', label: '接收方' },
]
const scriptColumns: Column[] = [
  { key: 'version', label: '版本' },
  { key: 'status', label: '状态', pill: true },
  { key: 'episodes', label: '集' },
  { key: 'scenes', label: '场' },
  { key: 'shots', label: '镜' },
  { key: 'locked', label: '锁定', format: (row) => (row.locked ? '是' : '否') },
]

function stateLabel(state: string): string {
  if (state === 'done') return '已完成'
  if (state === 'current') return '进行中'
  if (state === 'blocked') return '阻塞'
  return '待开始'
}

function openSibling(item: EpisodeCard | null) {
  if (item) emit('open-episode', item)
}
</script>

<template>
  <section class="episode-workspace">
    <div class="ep-top">
      <div class="ep-breadcrumb">
        <button class="link-btn" @click="emit('back')">← 返回 {{ batch.label }}</button>
        <span>/</span>
        <span>第 {{ episode.no }} 集</span>
      </div>

      <div class="ep-title-row">
        <div>
          <h2 class="ep-title">第 {{ episode.no }} 集 · {{ epRow.title || '未命名单集' }}</h2>
          <p class="ep-sub">{{ project?.id }} · {{ batch.label }} {{ batch.range }} · {{ epRow.duration || '时长待接入' }} · {{ epRow.status || '状态待接入' }}</p>
        </div>
        <div class="ep-nav">
          <button class="btn" :disabled="!prevEpisode" @click="openSibling(prevEpisode)">上一集</button>
          <button class="btn" :disabled="!nextEpisode" @click="openSibling(nextEpisode)">下一集</button>
          <button class="btn" @click="emit('back')">返回批次</button>
        </div>
      </div>

      <div class="ep-meta-grid">
        <div><span>负责人</span><b>{{ owner }}</b></div>
        <div><span>当前阶段</span><b>{{ flow.currentStep }} · {{ flow.steps.find((item) => item.key === flow.currentStep)?.name }}</b></div>
        <div><span>参考模型</span><b>{{ model }}</b></div>
        <div><span>数据口径</span><b>按现有状态推断</b></div>
      </div>

      <div class="ep-steps" role="tablist" aria-label="单集阶段切换">
        <button
          v-for="item in EPISODE_STEPS"
          :key="item.key"
          class="ep-step"
          :class="[flow.steps.find((step) => step.key === item.key)?.state, { active: props.step === item.key }]"
          role="tab"
          :aria-selected="props.step === item.key"
          @click="emit('select-step', item.key)"
        >
          <span>{{ item.key }}</span>
          <b>{{ item.name }}</b>
          <small>{{ stateLabel(flow.steps.find((step) => step.key === item.key)?.state || 'pending') }}</small>
        </button>
      </div>
    </div>

    <div class="ep-grid">
      <div class="ep-main">
        <div class="ep-stage-head">
          <div>
            <h3 class="card-title">{{ stepMeta.key }} · {{ stepMeta.name }}</h3>
            <p class="card-sub">{{ stepMeta.hint }} · {{ flow.note }}</p>
          </div>
          <span class="pill" :class="{ accent: flow.tone === 'active', ok: flow.tone === 'done', bad: flow.tone === 'blocked' }">
            {{ flow.note }}
          </span>
        </div>

        <template v-if="props.step === 'E0'">
          <div class="card">
            <div class="card-head"><h3 class="card-title">输入清单</h3><span class="pill">E0 门禁</span></div>
            <div class="check-grid">
              <div v-for="item in checks" :key="item.label" class="check-item">
                <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
          <div class="ep-split">
            <div class="card">
              <div class="card-head"><h3 class="card-title">前后集衔接</h3></div>
              <dl class="kv-lite">
                <dt>上一集</dt><dd>{{ prevEpisode ? `E${padEpisode(prevEpisode.no)} · ${prevEpisode.row.title}` : '本批首集' }}</dd>
                <dt>下一集</dt><dd>{{ nextEpisode ? `E${padEpisode(nextEpisode.no)} · ${nextEpisode.row.title}` : '本批末集' }}</dd>
                <dt>本集场次</dt><dd>{{ epRow.scenes ?? '—' }} 场</dd>
                <dt>本集镜头</dt><dd>{{ epRow.shots ?? epShots.length }} 镜</dd>
              </dl>
            </div>
            <div class="card">
              <div class="card-head"><h3 class="card-title">输入来源</h3></div>
              <p class="ep-note">当前展示来自现有分集、镜头与任务数据；单集任务单、前后集摘要与阻塞项将在后续写接口接入。</p>
              <div class="ep-tags">
                <span>分集数据</span><span>镜头数据</span><span>批次推断</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="props.step === 'E1'">
          <div class="card">
            <div class="card-head">
              <div><h3 class="card-title">项目级剧本版本</h3><p class="card-sub">当前数据尚未按集拆分；以下为项目层已有版本。</p></div>
              <span class="pill">{{ allScripts.length }} 个版本</span>
            </div>
            <DataTable :columns="scriptColumns" :rows="allScripts" row-key="id" wide empty-title="暂无剧本版本" />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">剧本检查</h3><span class="pill warn">单集脚本待接入</span></div>
            <div class="check-grid">
              <div v-for="item in checks" :key="item.label" class="check-item">
                <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="props.step === 'E2'">
          <div class="card">
            <div class="card-head">
              <div><h3 class="card-title">镜头契约</h3><p class="card-sub">本集 {{ epShots.length }} 镜；缺画面、人物或时长的镜头无法进入生产。</p></div>
              <span class="pill" :class="{ warn: missingShots.length }">{{ missingShots.length }} 个缺项</span>
            </div>
            <DataTable :columns="shotColumns" :rows="epShots" row-key="id" wide empty-title="暂无镜头契约" />
          </div>
          <div class="ep-split">
            <div class="card">
              <div class="card-head"><h3 class="card-title">资产与模型</h3></div>
              <dl class="kv-lite">
                <dt>项目资产</dt><dd>{{ projectAssets.length }} 个</dd>
                <dt>参考模型</dt><dd>{{ model }}</dd>
                <dt>模型基线</dt><dd>未接入</dd>
                <dt>试跑</dt><dd>待接入</dd>
              </dl>
            </div>
            <div class="card">
              <div class="card-head"><h3 class="card-title">锁定检查</h3></div>
              <div class="check-grid">
                <div v-for="item in checks" :key="item.label" class="check-item">
                  <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                  <span>{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="props.step === 'E3'">
          <div class="card">
            <div class="card-head">
              <div><h3 class="card-title">本集任务队列</h3><p class="card-sub">按镜头独立任务；失败可重试，换模型将创建新的 take。</p></div>
              <span class="pill" :class="{ warn: failedTasks.length }">{{ failedTasks.length }} 个失败</span>
            </div>
            <DataTable :columns="taskColumns" :rows="epTasks" row-key="id" wide empty-title="本集暂无生成任务" />
          </div>
          <div class="ep-kpis">
            <div class="ep-kpi"><span>任务</span><b>{{ epTasks.length }}</b><small>本集镜头任务</small></div>
            <div class="ep-kpi"><span>执行中</span><b>{{ epTasks.filter((row) => row.status === '执行中').length }}</b><small>受并发约束</small></div>
            <div class="ep-kpi"><span>已通过</span><b>{{ epShots.filter((row) => row.status === '已通过').length }}</b><small>镜头级</small></div>
            <div class="ep-kpi"><span>Take</span><b>未接入</b><small>版本树待补</small></div>
          </div>
        </template>

        <template v-else-if="props.step === 'E4'">
          <div class="card">
            <div class="card-head"><h3 class="card-title">本集时间线</h3><span class="pill" :class="{ warn: staleTimelines.length }">{{ staleTimelines.length }} 个过期片段</span></div>
            <DataTable :columns="timelineColumns" :rows="epTimelines" row-key="version" wide empty-title="暂无本集时间线" />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">剪辑检查</h3></div>
            <div class="check-grid">
              <div v-for="item in checks" :key="item.label" class="check-item">
                <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="props.step === 'E5'">
          <div class="card">
            <div class="card-head"><h3 class="card-title">对白与声音</h3><span class="pill">{{ epDialogues.length }} 条</span></div>
            <DataTable :columns="dialogueColumns" :rows="epDialogues" row-key="id" wide empty-title="暂无本集对白" />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">字幕</h3><span class="pill">{{ epSubtitles.length }} 个版本</span></div>
            <DataTable :columns="subtitleColumns" :rows="epSubtitles" row-key="version" wide empty-title="暂无本集字幕" />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">音字检查</h3></div>
            <div class="check-grid">
              <div v-for="item in checks" :key="item.label" class="check-item">
                <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="props.step === 'E6'">
          <div class="card">
            <div class="card-head"><h3 class="card-title">单集质检报告</h3><span class="pill" :class="{ warn: qcFails.length }">{{ qcFails.length }} 个 FAIL</span></div>
            <DataTable :columns="reportColumns" :rows="epQualityReports" row-key="id" wide empty-title="暂无本集质检报告" />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">问题项</h3><span class="pill">{{ epQualityIssues.length }} 项</span></div>
            <DataTable :columns="issueColumns" :rows="epQualityIssues" row-key="where" wide empty-title="本集暂无问题项" />
          </div>
        </template>

        <template v-else>
          <div class="card">
            <div class="card-head"><h3 class="card-title">终审与入库</h3><span class="pill">项目级交付记录</span></div>
            <DataTable :columns="deliveryColumns" :rows="epDeliveries" row-key="id" wide empty-title="暂无项目级交付记录" />
          </div>
          <div class="ep-split">
            <div class="card">
              <div class="card-head"><h3 class="card-title">交付检查</h3></div>
              <div class="check-grid">
                <div v-for="item in checks" :key="item.label" class="check-item">
                  <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
                  <span>{{ item.label }}</span>
                </div>
              </div>
            </div>
            <div class="card">
              <div class="card-head"><h3 class="card-title">单集包</h3></div>
              <p class="ep-note">单集交付包尚未接入；当前仅有项目级交付记录。后续将按集生成独立入库包。</p>
            </div>
          </div>
        </template>
      </div>

      <aside class="ep-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">当前门禁</h3><span class="pill">{{ checks.filter((item) => item.ok).length }} / {{ checks.length }}</span></div>
          <div class="check-grid">
            <div v-for="item in checks" :key="item.label" class="check-item">
              <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">当前风险</h3><span class="pill" :class="{ warn: risks.length }">{{ risks.length }} 项</span></div>
          <div v-for="risk in risks" :key="risk.label" class="list-row">
            <span class="k">{{ risk.label }}</span>
            <span class="v">{{ risk.detail }}</span>
          </div>
          <EmptyState v-if="!risks.length" title="暂无阻断" desc="当前本集没有失败任务、过期片段或 QC 阻断。" compact />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">版本与记录</h3></div>
          <dl class="kv-lite">
            <dt>集状态</dt><dd>{{ epRow.status || '—' }}</dd>
            <dt>QC</dt><dd>{{ epRow.qc || '—' }}</dd>
            <dt>时间线</dt><dd>{{ epRow.timeline || '—' }}</dd>
            <dt>剧本锁定</dt><dd>{{ lockedScript ? '已锁定' : '未锁定/未拆分' }}</dd>
            <dt>质检报告</dt><dd>{{ epQualityReports.length }} 份</dd>
            <dt>评论/变更</dt><dd>待接入</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">阶段说明</h3></div>
          <p class="ep-note">阶段 1 只读壳：E0–E7 的数据来自现有分集、镜头、任务、时间线与质检记录；写入动作将在阶段 2/3 接入。</p>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.episode-workspace {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.ep-top {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.ep-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}
.ep-breadcrumb .link-btn {
  padding: 0;
}
.ep-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.ep-title {
  margin: 0;
  color: var(--ink);
  font-size: 18px;
  line-height: 1.35;
}
.ep-sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.ep-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ep-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.ep-meta-grid > div {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
}
.ep-meta-grid span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.ep-meta-grid b {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ep-steps {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
.ep-step {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  color: var(--ink);
  padding: 8px;
  text-align: left;
  cursor: pointer;
}
.ep-step:hover,
.ep-step.active {
  border-color: var(--accent);
  background: var(--surface);
}
.ep-step.done {
  border-color: color-mix(in srgb, var(--ok) 45%, var(--line));
}
.ep-step.current {
  box-shadow: inset 0 0 0 1px var(--accent);
}
.ep-step.blocked {
  border-color: color-mix(in srgb, var(--bad) 55%, var(--line));
}
.ep-step span {
  display: inline-block;
  margin-right: 4px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
}
.ep-step b {
  display: inline;
  color: var(--ink);
  font-size: 10px;
  font-weight: 650;
}
.ep-step small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: var(--faint);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ep-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px;
  gap: 14px;
  align-items: start;
}
.ep-main {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.ep-stage-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}
.ep-side {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.ep-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.ep-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.ep-kpi {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 9px 10px;
}
.ep-kpi span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.ep-kpi b {
  display: block;
  margin-top: 3px;
  color: var(--ink);
  font-size: 18px;
  line-height: 1.3;
}
.ep-kpi small {
  display: block;
  margin-top: 2px;
  color: var(--faint);
  font-size: 10px;
}
.ep-note {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.65;
}
.ep-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.ep-tags span {
  border: 1px solid var(--line);
  border-radius: 99px;
  padding: 2px 7px;
  color: var(--muted);
  font-size: 10px;
}
@media (max-width: 1180px) {
  .ep-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .ep-side {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 1000px) {
  .ep-steps {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .ep-meta-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ep-side {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .ep-steps,
  .ep-kpis,
  .ep-split,
  .ep-side {
    grid-template-columns: 1fr;
  }
}
</style>
