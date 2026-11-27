<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Row } from '../../../mock/db'
import type { BatchGroup, EpisodeCard, EpisodeEvent, EpisodeState, EpisodeStepKey } from './episodeFlow'
import { EPISODE_STEPS, episodeStateOf, padEpisode } from './episodeFlow'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import { projectApi } from '../../../services/projects'
import { useUiStore } from '../../../stores/ui'

const props = defineProps<{
  project: Row | null
  summary: Row
  batch: BatchGroup
  episode: EpisodeCard
  step: EpisodeStepKey
  revision?: number
}>()

const emit = defineEmits<{
  (event: 'select-step', step: EpisodeStepKey): void
  (event: 'open-episode', item: EpisodeCard): void
  (event: 'refresh'): void
  (event: 'back'): void
}>()

const ui = useUiStore()
const projectId = computed(() => String(props.project?.id ?? props.summary.project?.id ?? ''))
const no = computed(() => props.episode.no)
const epRow = computed(() => props.episode.row)
const flow = computed(() => props.episode.flow)
const epState = computed<EpisodeState | null>(() => {
  void props.revision
  return episodeStateOf(props.summary, no.value)
})
const epEvents = computed<EpisodeEvent[]>(() => {
  void props.revision
  return ((props.summary.episodeEvents as EpisodeEvent[] | undefined) ?? [])
    .filter((item) => Number(item.ep) === no.value)
    .slice(0, 8)
})
const stepMeta = computed(() => EPISODE_STEPS.find((step) => step.key === props.step) ?? EPISODE_STEPS[0])
const model = computed(() => {
  void props.revision
  return String(epState.value?.modelBaseline ?? epShots.value[0]?.model ?? '未接入')
})
const owner = computed(() => String(props.project?.owner ?? '未分配'))

function list(key: string): Row[] {
  void props.revision
  return (props.summary[key] as Row[] | undefined) ?? []
}

const epShots = computed(() => list('shots').filter((row) => Number(row.ep) === no.value))
const epTasks = computed(() => list('tasks').filter((row) => Number(row.ep) === no.value))
const epTimelines = computed(() => list('timelines').filter((row) => Number(row.ep) === no.value))
const hasTimeline = computed(() => {
  void props.revision
  return epTimelines.value.length > 0
})
const epDialogues = computed(() => list('dialogues').filter((row) => Number(row.ep) === no.value))
const epSubtitles = computed(() => list('subtitles').filter((row) => Number(row.ep) === no.value))
const allScripts = computed(() => list('scripts'))
const allReports = computed(() => list('qualityReports'))
const allIssues = computed(() => list('qualityIssues'))
const allDeliveries = computed(() => list('deliveries'))
const allReviews = computed(() => list('reviews'))
const projectAssets = computed(() => list('assets'))

const episodePattern = computed(() => new RegExp(`第\\s*${no.value}\\s*集|E${padEpisode(no.value)}`, 'i'))
const epQualityReports = computed(() =>
  allReports.value.filter(
    (row) => !row.archived && episodePattern.value.test(`${row.object ?? ''} ${row.id ?? ''}`),
  ),
)
const epQualityIssues = computed(() => {
  const ids = new Set(epQualityReports.value.map((row) => String(row.id)))
  return allIssues.value.filter((row) => ids.has(String(row.report)))
})
const epReviews = computed(() =>
  allReviews.value.filter((row) => episodePattern.value.test(`${row.object ?? ''} ${row.ep ?? ''}`)),
)
const epDeliveries = computed(() => allDeliveries.value.filter((row) => String(row.project ?? '') === String(props.project?.id ?? '')))
const epPackages = computed(() =>
  epDeliveries.value.filter(
    (row) => String(row.kind ?? '') === '单集包' && Number(row.ep) === no.value,
  ),
)

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
const latestQcReport = computed(() => epQualityReports.value[0] ?? null)
const latestQcFail = computed(() => String(latestQcReport.value?.result ?? '') === 'FAIL')
const latestQcPass = computed(() => String(latestQcReport.value?.result ?? '') === 'PASS')
const lockedScript = computed(() => allScripts.value.find((row) => Boolean(row.locked)) ?? null)
const actionBusy = ref(false)
const currentStateStep = computed(() => {
  void props.revision
  return String(epState.value?.currentStep ?? flow.value.currentStep)
})
const modelOptions = computed(() => {
  const names = new Set([
    String(epState.value?.modelBaseline ?? '').trim(),
    ...epShots.value.map((row) => String(row.model ?? '').trim()),
    '视频模型 A',
    '视频模型 B',
    '视频模型 A（图生视频）',
  ])
  return [...names].filter(Boolean).map((value) => ({ value, label: value }))
})

async function submitEpisodeAction(action: string, payload: Record<string, unknown>, label: string) {
  const id = projectId.value
  if (!id) throw new Error('缺少项目编号')
  actionBusy.value = true
  try {
    await projectApi.episodeAction(id, no.value, { action, ...payload })
    ui.toast(`${label} 已完成`)
    emit('refresh')
  } catch (error) {
    ui.toast((error as Error).message || `${label} 失败`, 'bad')
    throw error
  } finally {
    actionBusy.value = false
  }
}

function actionFields(notePlaceholder: string) {
  return [
    {
      key: 'note',
      label: '执行说明',
      type: 'textarea' as const,
      rows: 3,
      placeholder: notePlaceholder,
      hint: '会写入单集变更记录，并出现在项目动作历史中。',
    },
  ]
}

function confirmInput() {
  ui.openDialog({
    title: `确认第 ${no.value} 集输入`,
    subtitle: '核对分集任务单、前后集衔接、镜头需求与阻塞项。',
    fields: actionFields('例：E18 结尾钩子已对齐，E20 开场无需补拍。'),
    submitLabel: '确认输入',
    onSubmit: (values) => submitEpisodeAction('confirmInput', { note: values.note }, 'E0 输入确认'),
  })
}

function lockScript() {
  ui.openDialog({
    title: `锁定第 ${no.value} 集剧本`,
    subtitle: '单集剧本定稿后锁定；后续修改必须新建版本。',
    fields: actionFields('例：按审核意见调整第 3 场对白，锁定 V4。'),
    submitLabel: '锁定剧本',
    onSubmit: (values) => submitEpisodeAction('lockScript', { note: values.note }, 'E1 剧本锁定'),
  })
}

function lockAssets() {
  ui.openDialog({
    title: `锁定第 ${no.value} 集镜头与资产`,
    subtitle: '锁定镜头契约、关键资产与模型基线，作为 E3 生产的输入。',
    fields: [
      {
        key: 'model',
        label: '模型基线',
        type: 'select' as const,
        required: true,
        options: modelOptions.value,
        hint: '本集所有镜头默认使用该模型；单镜头可在 E3 换模型生成新 take。',
      },
      { key: 'note', label: '执行说明', type: 'textarea' as const, rows: 3, placeholder: '例：顾沉造型以 v3 锁定，雨夜街口场景不再改。' },
    ],
    submitLabel: '锁定并进入 E3',
    onSubmit: (values) => submitEpisodeAction('lockAssets', { model: values.model, note: values.note }, 'E2 资产与模型锁定'),
  })
}

function startProduction() {
  ui.openDialog({
    title: `启动第 ${no.value} 集素材生产`,
    subtitle: '按本集镜头契约批量派发任务；已有活动任务不会重复创建。',
    fields: actionFields('例：先跑 6 个关键镜头，其余镜头按队列并发。'),
    submitLabel: '生成镜头任务',
    onSubmit: (values) => submitEpisodeAction('startProduction', { note: values.note }, 'E3 素材生产启动'),
  })
}

function stageActionDialog(
  title: string,
  subtitle: string,
  action: string,
  submitLabel: string,
  placeholder: string,
) {
  ui.openDialog({
    title,
    subtitle,
    fields: actionFields(placeholder),
    submitLabel,
    onSubmit: (values) => submitEpisodeAction(action, { note: values.note }, submitLabel),
  })
}

async function advanceQueue() {
  const ok = await ui.confirm(
    '推进本集队列',
    'Mock 环境会把本集排队/执行中的镜头任务置为已通过，并推进到 E4。真实环境请由生成回调驱动。',
  )
  if (!ok) return
  try {
    await submitEpisodeAction('advanceQueue', { note: 'Mock 队列推进：本集镜头任务全部通过' }, 'E3 队列推进')
  } catch {
    // 错误已通过 toast 显示。
  }
}

function buildTimeline() {
  stageActionDialog(
    `建立第 ${no.value} 集时间线`,
    '按已接受的镜头素材建立 6 轨时间线；建立后仍需单独锁定。',
    'buildTimeline',
    '建立时间线',
    '例：按 18 镜建立 V1，保留原素材版本。',
  )
}

function lockTimeline() {
  stageActionDialog(
    `锁定第 ${no.value} 集时间线`,
    '锁定后片段替换必须新建版本；锁定即进入 E5 声音字幕。',
    'lockTimeline',
    '锁定时间线',
    '例：精剪完成，画面和时长不再调整。',
  )
}

function generateAudio() {
  stageActionDialog(
    `生成第 ${no.value} 集对白与字幕`,
    '按本集台词生成对白音频、字幕初稿，并为后续口型同步准备对白行。',
    'generateAudio',
    '生成对白与字幕',
    '例：按角色声音档案生成，字幕按安全区版本排版。',
  )
}

function approveSubtitle() {
  stageActionDialog(
    `确认第 ${no.value} 集字幕`,
    '字幕校对通过后锁定当前字幕版本；后续修改必须新建版本。',
    'approveSubtitle',
    '确认字幕',
    '例：错字 0，时间轴整数毫秒，安全区通过。',
  )
}

function runLipSync() {
  stageActionDialog(
    `执行第 ${no.value} 集口型同步`,
    '按对白行与镜头绑定关系执行口型校验；通过后才允许混音。',
    'runLipSync',
    '执行口型同步',
    '例：18 条对白全部绑定对应镜头，帧对齐阈值 95%。',
  )
}

function checkMix() {
  stageActionDialog(
    `第 ${no.value} 集混音检查`,
    '确认对白、音乐、音效与字幕全部就绪；通过后进入 E6 单集 QC。',
    'checkMix',
    '混音检查并进入 QC',
    '例：对白 −16 LUFS，音乐 −18 LUFS，无削波。',
  )
}

function runEpisodeQc() {
  stageActionDialog(
    `执行第 ${no.value} 集 QC`,
    '检查音画同步、字幕、时长、安全区与播放完整性。',
    'runEpisodeQc',
    '执行单集 QC',
    '例：按单集 QC 模板执行 42 项检查。',
  )
}

function acceptEpisodeQc() {
  stageActionDialog(
    `确认第 ${no.value} 集 QC 通过`,
    '只有无阻断项的 QC 报告才能确认；确认后进入 E7 终审入库。',
    'acceptEpisodeQc',
    '确认 QC 通过',
    '例：阻断项 0，问题项已闭环。',
  )
}

function reworkEpisode() {
  ui.openDialog({
    title: `第 ${no.value} 集退回返工`,
    subtitle: '选择返工目标；旧版本保留，返工完成后重新执行 QC。',
    fields: [
      {
        key: 'target',
        label: '返工目标',
        type: 'select' as const,
        required: true,
        options: [
          { value: 'E5', label: 'E5 声音字幕' },
          { value: 'E4', label: 'E4 剪辑 / 时间线' },
        ],
      },
      ...actionFields('例：字幕第 3 行与口型偏移 80ms，退回 E5。'),
    ],
    submitLabel: '创建返工',
    onSubmit: (values) => submitEpisodeAction('reworkEpisode', { target: values.target, note: values.note }, 'E6 退回返工'),
  })
}

function approveEpisode() {
  stageActionDialog(
    `第 ${no.value} 集终审`,
    '确认 QC 通过、版本冻结与权利资料完整；终审通过后生成单集包。',
    'approveEpisode',
    '终审通过',
    '例：成片、字幕、QC 报告与授权资料齐备。',
  )
}

function packageEpisode() {
  ui.openDialog({
    title: `生成第 ${no.value} 集交付包`,
    subtitle: '冻结当前成片、字幕、QC 报告与元数据，写入单集交付记录。',
    fields: [
      { key: 'receiver', label: '接收方', type: 'text' as const, required: true, value: '企业内容库' },
      ...actionFields('例：单集包交付企业内容库，保留 30 天。'),
    ],
    submitLabel: '生成并入库',
    onSubmit: (values) =>
      submitEpisodeAction('packageEpisode', { receiver: values.receiver, note: values.note }, 'E7 单集交付包'),
  })
}

async function retryTask(task: Row) {
  const ok = await ui.confirm('重试生成任务', `任务 ${task.id} 将重新排队，旧尝试记录保留。`)
  if (!ok) return
  try {
    await submitEpisodeAction('retryTask', { taskId: task.id }, `任务 ${task.id} 重试`)
  } catch {
    // 错误已通过 toast 显示，保持当前状态。
  }
}

function changeModel(task: Row) {
  ui.openDialog({
    title: `换模型生成新 take · ${task.shot}`,
    subtitle: `任务 ${task.id} 会标记为已替代，新模型生成独立 take，旧版本不覆盖。`,
    fields: [
      {
        key: 'model',
        label: '新模型',
        type: 'select' as const,
        required: true,
        options: modelOptions.value,
      },
      { key: 'note', label: '换模原因', type: 'textarea' as const, rows: 3, required: true, placeholder: '例：人物连续性不足，换参考视频模型重跑。' },
    ],
    submitLabel: '生成新 take',
    onSubmit: (values) => submitEpisodeAction('changeModel', { taskId: task.id, model: values.model, note: values.note }, '换模型生成新 take'),
  })
}

async function acceptTake(task: Row) {
  const ok = await ui.confirm('接受这个 take', `接受镜头 ${task.shot} 的 take ${task.take ?? 1} 作为当前版本；旧 take 仍保留在版本链中。`)
  if (!ok) return
  try {
    await submitEpisodeAction('acceptTake', { taskId: task.id }, `接受 ${task.shot} take ${task.take ?? 1}`)
  } catch {
    // 错误已通过 toast 显示，保持当前状态。
  }
}

const actionHint = computed(() => {
  void props.revision
  if (!epState.value) return '正在读取单集状态…'
  if (!epState.value.inputConfirmed) return '先完成 E0 输入确认'
  if (!epState.value.scriptLocked) return 'E1 剧本锁定后进入镜头与资产'
  if (!epState.value.assetsLocked) return 'E2 锁定镜头与资产后进入素材生产'
  if (!epState.value.productionStarted) return 'E3 已就绪，可批量生成镜头任务'
  const failed = epTasks.value.filter((row) => String(row.status ?? '') === '失败').length
  if (currentStateStep.value !== 'E3') {
    const stage = EPISODE_STEPS.find((item) => item.key === currentStateStep.value)
    return `当前停在 ${currentStateStep.value} ${stage?.name ?? ''}，上游阶段已完成，后续门禁需逐项确认`
  }
  return `E3 生产中 · ${epTasks.value.length} 个任务${failed ? ` · ${failed} 个失败待处理` : ''}`
})

const checks = computed(() => {
  void props.revision
  if (props.step === 'E0') {
    return [
      { label: '本集纲要已建立', ok: Boolean(epRow.value.title) },
      { label: '输入已确认', ok: Boolean(epState.value?.inputConfirmed) },
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
      { label: '单集脚本已锁定', ok: Boolean(epState.value?.scriptLocked) },
      { label: '审核结论已回写', ok: epReviews.value.length > 0 },
    ]
  }
  if (props.step === 'E2') {
    return [
      { label: '镜头契约已生成', ok: epShots.value.length > 0 },
      { label: '契约缺项已清零', ok: missingShots.value.length === 0 },
      { label: '模型配置可读', ok: model.value !== '未接入' },
      { label: '资产与模型已锁定', ok: Boolean(epState.value?.assetsLocked) },
      { label: '关键资产可引用', ok: projectAssets.value.length > 0 },
    ]
  }
  if (props.step === 'E3') {
    return [
      { label: '本集已有生成任务', ok: epTasks.value.length > 0 },
      { label: '模型基线已锁定', ok: Boolean(epState.value?.assetsLocked) },
      { label: '无失败任务', ok: failedTasks.value.length === 0 },
      { label: '失败任务可重试', ok: true },
      { label: '单集素材包已生成', ok: false },
    ]
  }
  if (props.step === 'E4') {
    return [
      { label: '时间线已建立', ok: epTimelines.value.length > 0 },
      { label: '无过期片段', ok: staleTimelines.value.length === 0 },
      { label: '时间线已锁定', ok: Boolean(epState.value?.timelineLocked) },
      { label: '镜头素材已接受', ok: epShots.value.length > 0 && epShots.value.every((row) => String(row.status) === '已通过') },
    ]
  }
  if (props.step === 'E5') {
    return [
      { label: '对白音频已生成', ok: Boolean(epState.value?.audioGenerated) },
      { label: '字幕已校对', ok: Boolean(epState.value?.subtitleApproved) },
      { label: '口型同步已通过', ok: Boolean(epState.value?.lipSyncPassed) },
      { label: '混音检查通过', ok: Boolean(epState.value?.mixPassed) },
    ]
  }
  if (props.step === 'E6') {
    return [
      { label: '单集 QC 报告已出', ok: epQualityReports.value.length > 0 },
      { label: '无阻断项', ok: qcFails.value.length === 0 && !latestQcFail.value },
      { label: 'QC 已确认', ok: Boolean(epState.value?.qcPassed) },
    ]
  }
  return [
    { label: '单集 QC 已通过', ok: Boolean(epState.value?.qcPassed) },
    { label: '单集终审已通过', ok: Boolean(epState.value?.finalApproved) },
    { label: '单集交付包已生成', ok: Boolean(epState.value?.delivered) },
    { label: '平台入库记录已生成', ok: Boolean(epState.value?.delivered) },
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
  { key: 'take', label: 'Take', format: (row) => `T${row.take ?? 1}` },
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
  { key: 'locked', label: '锁定', format: (row) => (row.locked ? '是' : '否') },
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
        <div><span>数据口径</span><b>{{ epState ? '单集状态 + 现有数据' : '按现有状态推断' }}</b></div>
      </div>

      <div v-if="epState" class="ep-action-bar">
        <span class="ep-action-label">本集动作</span>
        <button
          v-if="!epState.inputConfirmed"
          class="btn"
          :disabled="actionBusy || currentStateStep !== 'E0'"
          @click="confirmInput"
        >
          确认输入
        </button>
        <button
          v-if="epState.inputConfirmed && !epState.scriptLocked"
          class="btn"
          :disabled="actionBusy || currentStateStep !== 'E1'"
          @click="lockScript"
        >
          锁定剧本
        </button>
        <button
          v-if="epState.scriptLocked && !epState.assetsLocked"
          class="btn primary"
          :disabled="actionBusy || currentStateStep !== 'E2'"
          @click="lockAssets"
        >
          锁定资产与模型
        </button>
        <button
          v-if="epState.assetsLocked && !epState.productionStarted"
          class="btn primary"
          :disabled="actionBusy || currentStateStep !== 'E3'"
          @click="startProduction"
        >
          生成镜头任务
        </button>
        <button
          v-if="currentStateStep === 'E3' && epState.productionStarted && !epState.timelineLocked"
          class="btn"
          :disabled="actionBusy"
          @click="advanceQueue"
        >
          推进本集队列
        </button>
        <button
          v-if="currentStateStep === 'E4' && !hasTimeline"
          class="btn primary"
          :disabled="actionBusy"
          @click="buildTimeline"
        >
          建立时间线
        </button>
        <button
          v-if="currentStateStep === 'E4' && hasTimeline && !epState.timelineLocked"
          class="btn primary"
          :disabled="actionBusy"
          @click="lockTimeline"
        >
          锁定时间线
        </button>
        <button
          v-if="currentStateStep === 'E5' && !epState.audioGenerated"
          class="btn primary"
          :disabled="actionBusy"
          @click="generateAudio"
        >
          生成对白与字幕
        </button>
        <button
          v-if="currentStateStep === 'E5' && epState.audioGenerated && !epState.subtitleApproved"
          class="btn"
          :disabled="actionBusy"
          @click="approveSubtitle"
        >
          确认字幕
        </button>
        <button
          v-if="currentStateStep === 'E5' && epState.audioGenerated && !epState.lipSyncPassed"
          class="btn"
          :disabled="actionBusy"
          @click="runLipSync"
        >
          执行口型同步
        </button>
        <button
          v-if="
            currentStateStep === 'E5' &&
            epState.audioGenerated &&
            epState.subtitleApproved &&
            epState.lipSyncPassed &&
            !epState.mixPassed
          "
          class="btn primary"
          :disabled="actionBusy"
          @click="checkMix"
        >
          混音检查并进入 QC
        </button>
        <button
          v-if="currentStateStep === 'E6' && !epState.qcPassed && epQualityReports.length === 0"
          class="btn primary"
          :disabled="actionBusy"
          @click="runEpisodeQc"
        >
          执行单集 QC
        </button>
        <button
          v-if="currentStateStep === 'E6' && !epState.qcPassed && latestQcPass"
          class="btn primary"
          :disabled="actionBusy"
          @click="acceptEpisodeQc"
        >
          确认 QC 通过
        </button>
        <button
          v-if="currentStateStep === 'E6' && !epState.qcPassed"
          class="btn"
          :disabled="actionBusy"
          @click="reworkEpisode"
        >
          退回返工
        </button>
        <button
          v-if="currentStateStep === 'E7' && !epState.finalApproved"
          class="btn primary"
          :disabled="actionBusy"
          @click="approveEpisode"
        >
          单集终审通过
        </button>
        <button
          v-if="currentStateStep === 'E7' && epState.finalApproved && !epState.delivered"
          class="btn primary"
          :disabled="actionBusy"
          @click="packageEpisode"
        >
          生成单集交付包
        </button>
        <span class="ep-action-hint">{{ actionHint }}</span>
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
                <dt>模型基线</dt><dd>{{ epState?.modelBaseline || model }}</dd>
                <dt>试跑</dt><dd>{{ epState?.assetsLocked ? '基线已锁定' : '待锁定' }}</dd>
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
            <DataTable :columns="taskColumns" :rows="epTasks" row-key="id" wide empty-title="本集暂无生成任务">
              <template #actions="{ row }">
                <div class="table-actions">
                  <button
                    v-if="['失败', '待人工处理'].includes(String(row.status))"
                    class="link-btn"
                    :disabled="actionBusy"
                    @click="retryTask(row)"
                  >
                    重试
                  </button>
                  <button
                    v-if="!['已替代', '已取消', '已通过'].includes(String(row.status))"
                    class="link-btn"
                    :disabled="actionBusy"
                    @click="changeModel(row)"
                  >
                    换模型
                  </button>
                  <button
                    v-if="String(row.status) === '已通过'"
                    class="link-btn"
                    :disabled="actionBusy"
                    @click="acceptTake(row)"
                  >
                    接受 take
                  </button>
                </div>
              </template>
            </DataTable>
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
            <div class="card-head"><h3 class="card-title">单集交付包</h3><span class="pill">{{ epPackages.length }} 个</span></div>
            <DataTable :columns="deliveryColumns" :rows="epPackages" row-key="id" wide empty-title="尚未生成单集交付包" />
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
              <div class="card-head"><h3 class="card-title">项目级交付</h3><span class="pill">{{ epDeliveries.length }} 条</span></div>
              <div v-for="row in epDeliveries" :key="String(row.id)" class="list-row">
                <span class="k">{{ row.id }}</span>
                <span class="v">{{ row.episodes }} 集 · {{ row.status }}</span>
              </div>
              <EmptyState v-if="!epDeliveries.length" title="暂无项目级交付记录" desc="批次或整季交付完成后会在此显示。" compact />
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
            <dt>模型基线</dt><dd>{{ epState?.modelBaseline || model }}</dd>
            <dt>质检报告</dt><dd>{{ epQualityReports.length }} 份</dd>
            <dt>评论/变更</dt><dd>{{ epEvents.length }} 条</dd>
          </dl>
          <div v-if="epEvents.length" class="ep-event-list">
            <div v-for="event in epEvents" :key="event.id" class="ep-event">
              <div>
                <b>{{ event.action }}</b>
                <span>{{ event.at }}</span>
              </div>
              <p>{{ event.note }}</p>
            </div>
          </div>
          <EmptyState v-else title="暂无动作" desc="E0–E7 的确认与生产动作会在此留痕。" compact />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">阶段说明</h3></div>
          <p class="ep-note">E0–E7 已形成可操作闭环：输入确认、剧本锁定、资产与模型锁定、镜头任务、剪辑时间线、声音字幕、单集 QC、终审与单集交付包均可执行；素材完成由 Mock 队列推进。</p>
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
.ep-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
}
.ep-action-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ep-action-hint {
  color: var(--faint);
  font-size: 10px;
  line-height: 1.4;
}
.table-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}
.table-actions .link-btn {
  font-size: 10px;
}
.ep-event-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.ep-event {
  display: grid;
  gap: 3px;
  padding: 7px 8px;
  border-radius: 7px;
  background: var(--surface-2);
}
.ep-event > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.ep-event b {
  color: var(--ink);
  font-size: 10px;
}
.ep-event span {
  color: var(--faint);
  font-size: 9px;
}
.ep-event p {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
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
