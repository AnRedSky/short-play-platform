/**
 * 二级页面规格：以数据契约驱动，一页一表 + 右侧洞察卡，动作统一走 mock API。
 * 核心闭环页面（项目/剧本/镜头/生产/后期/质检/交付）另有专用组件，见 views/core。
 */
import { http } from '../api/client'
import { findBreakdownIssues, findShotContractIssues, formatBreakdownIssue, formatShotContractIssue } from '../composables/breakdownGate'
import { budgetText, budgetUsedUp, findActiveTask } from '../composables/videoGate'
import {
  audioAssetBlockReason,
  dialogueBatchBlockReason,
  dialogueScopeRows,
  expiringSoon,
  extractVoiceProfileId,
  lipSyncBlockReason,
  voiceBlockReason,
} from '../composables/audioGate'
import type { Row } from '../mock/db'
import type { DialogField } from '../stores/ui'
import type { Column } from '../components/ui/DataTable.vue'
import type { DialogConfig } from '../stores/ui'

export interface SpecStat { label: string; value: string | number; unit?: string; hint?: string }

export interface SpecDialog {
  title: string
  subtitle?: string
  fields?: DialogField[]
  submitLabel?: string
  wide?: boolean
}

export interface PageAction {
  label: string
  tone?: 'primary' | 'default'
  permission?: string
  danger?: boolean
  dialog?: SpecDialog
  confirm?: { title: string; message: string; danger?: boolean }
  post?: (values: Record<string, unknown>, ctx: SpecContext) => Promise<unknown>
  run?: (ctx: SpecContext) => void
  toast?: string
}

export interface SpecPanel {
  title: string
  type?: 'kv' | 'list' | 'checklist'
  items: Array<{ label: string; value?: string | number; on?: boolean }>
}

export interface SpecRowPanel {
  title: string
  hint?: string
  fields: Array<{ key: string; label: string }>
}

export interface SpecContext {
  rows: Row[]
  project: { currentId: string; current?: Row }
  reload: () => Promise<void>
  /** 把列表收敛到指定行，用于阻断项定位；由规格页实现，未实现时安全跳过。 */
  locate?: (rowId: string) => void
  ui: { toast: (text: string, tone?: 'ok' | 'bad' | 'info') => void; openDialog: (config: DialogConfig) => void; confirm: (title: string, message: string, danger?: boolean) => Promise<boolean> }
  session: { can: (permission?: string | null) => boolean }
}

export interface PageSpec {
  kicker: string
  title: string
  desc?: string
  scoped?: boolean
  emptyTitle?: string
  emptyHint?: string
  stats?: (rows: Row[], ctx: SpecContext) => SpecStat[]
  table: {
    endpoint: string
    columns: Column[]
    rowKey?: string
    search?: boolean
    limit?: number
    filters?: Array<{ key: string; label: string; options: string[] }>
    params?: Record<string, string>
  }
  side?: (rows: Row[], ctx: SpecContext) => SpecPanel[]
  actions?: PageAction[]
  rowActions?: (row: Row) => Array<{ label: string; danger?: boolean; permission?: string; run?: (ctx: SpecContext) => void }>
  rowClick?: (row: Row, ctx: SpecContext) => void
  rowPanel?: SpecRowPanel
}

const col = (key: string, label: string, extra: Partial<Column> = {}): Column => ({ key, label, ...extra })
const countOf = (rows: Row[], key: string, value: string) => rows.filter((row) => String(row[key] ?? '').includes(value)).length

function nextVersion(version: unknown): string {
  const match = String(version ?? '').match(/(\d+)/)
  return match ? `v${Number(match[1]) + 1}` : 'v1'
}

function versionedId(row: Row, version: string): string {
  const base = String(row.id ?? '').replace(/-(v\d+)$/i, '')
  return `${base}-${version}`
}

function nowStamp(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function characterSnapshot(row: Row): Record<string, unknown> {
  return {
    project: row.project,
    name: row.name,
    age: row.age,
    look: row.look,
    build: row.build,
    hair: row.hair,
    forbid: row.forbid,
    rights: row.rights,
    reuse: row.reuse,
  }
}

function openCostumeDialog(row: Row, ctx: SpecContext) {
  const version = nextVersion(row.version)
  ctx.ui.openDialog({
    title: `换装 · ${row.name}`,
    subtitle: `为 ${row.id} 新建 ${version} 服装版本；旧版本与跨集引用保持不变。`,
    submitLabel: '创建服装版本',
    fields: [
      { key: 'costume', label: '新服装', type: 'text', required: true, value: String(row.costume ?? ''), placeholder: '例如：深灰风衣 v3 + 旧围巾' },
      { key: 'scope', label: '适用集数', type: 'text', value: String(row.reuse ?? ''), hint: '默认沿用当前引用范围。' },
      { key: 'note', label: '换装原因', type: 'textarea', required: true, rows: 3, placeholder: '写清剧情节点与换装依据' },
    ],
    onSubmit: async (values) => {
      await http.post('/characters', {
        ...characterSnapshot(row),
        id: versionedId(row, version),
        parent: row.id,
        costume: String(values.costume ?? ''),
        reuse: String(values.scope ?? ''),
        note: String(values.note ?? ''),
        version,
        refs: 0,
        status: '待确认',
      })
      ctx.ui.toast(`已为 ${row.name} 创建服装版本 ${version}`)
      await ctx.reload()
    },
  })
}

function openCharacterVersionDialog(row: Row, ctx: SpecContext) {
  const version = nextVersion(row.version)
  ctx.ui.openDialog({
    title: `新增版本 · ${row.name}`,
    subtitle: `生成 ${version} 外观版本；旧版本保留，下游按版本引用。`,
    submitLabel: '创建外观版本',
    wide: true,
    fields: [
      { key: 'look', label: '外观要点', type: 'textarea', required: true, rows: 2, value: String(row.look ?? ''), full: true },
      { key: 'build', label: '体态', type: 'text', required: true, value: String(row.build ?? '') },
      { key: 'hair', label: '发型', type: 'text', required: true, value: String(row.hair ?? '') },
      { key: 'forbid', label: '禁止项', type: 'textarea', required: true, rows: 2, value: String(row.forbid ?? ''), full: true },
      { key: 'note', label: '版本原因', type: 'textarea', required: true, rows: 2, placeholder: '写清为何需要新版本，以及适用集数' },
    ],
    onSubmit: async (values) => {
      await http.post('/characters', {
        ...characterSnapshot(row),
        id: versionedId(row, version),
        parent: row.id,
        look: String(values.look ?? ''),
        build: String(values.build ?? ''),
        hair: String(values.hair ?? ''),
        forbid: String(values.forbid ?? ''),
        note: String(values.note ?? ''),
        version,
        refs: 0,
        status: '待确认',
      })
      ctx.ui.toast(`已为 ${row.name} 创建版本 ${version}`)
      await ctx.reload()
    },
  })
}

let planFreezeBusy = false

async function freezePlan(ctx: SpecContext) {
  if (planFreezeBusy) return
  planFreezeBusy = true
  try {
    const latest = ctx.rows[0]
    const version = nextVersion(latest?.version)
    const scope = String(latest?.scope ?? '全片')
    const yes = await ctx.ui.confirm(
      '固化镜头计划',
      `将基于当前拆解结果新建 ${version} 固化计划（${scope}）。固化后下游任务可派发，已有计划保留。`,
    )
    if (!yes) return
    const all = await http.list<Row>('/shots', { project: ctx.project.currentId, limit: 999 })
    const issues = findShotContractIssues(all.rows)
    if (issues.length) {
      ctx.ui.toast(`固化被阻断：${formatShotContractIssue(issues[0])}；全量共 ${issues.length} 条`, 'bad')
      return
    }
    const planPrefix = String(latest?.id ?? '').replace(/-v\d+$/i, '') || ctx.project.currentId
    await http.post('/storyboard-plans', {
      id: `${planPrefix}-${version.toUpperCase()}`,
      project: ctx.project.currentId,
      version,
      scope,
      shots: Number(latest?.shots) || all.rows.length,
      tasks: Number(latest?.tasks) || 0,
      frozen: nowStamp(),
      status: '已固化',
      note: `由 ${latest?.version ?? '当前拆解'} 派生；固化后下游可派发。`,
    })
    ctx.ui.toast(`${version} 镜头计划已固化，下游任务可派发`)
    await ctx.reload()
  } catch {
    ctx.ui.toast('固化前校验或写入失败，请稍后重试', 'bad')
  } finally {
    planFreezeBusy = false
  }
}

async function regenerateShot(row: Row, ctx: SpecContext) {
  const project = ctx.project.current
  if (budgetUsedUp(project)) {
    ctx.ui.toast(`预算已用 100%（${budgetText(project)}），不能重新生成`, 'bad')
    return
  }
  const issues = findShotContractIssues([row])
  if (issues.length) {
    ctx.ui.toast(formatShotContractIssue(issues[0]), 'bad')
    return
  }
  const tasks = await http.list<Row>('/generation-tasks', { project: ctx.project.currentId, limit: 100 })
  const active = findActiveTask(tasks.rows, row.ep, row.no)
  if (active) {
    ctx.ui.toast(`镜头 ${row.no} 已有进行中的视频生成任务 ${active.id}，不能重复提交`, 'bad')
    return
  }
  const est = parseInt(String(row.duration ?? ''), 10) * 6 || 30
  const yes = await ctx.ui.confirm(
    '重新生成镜头',
    `将为第 ${row.ep} 集 ${row.no} 新建一次视频生成任务，预估 ${est} 秒；当前预算占用 ${budgetText(project)}。旧版本保留，可对比后再选定。`,
  )
  if (!yes) return
  await http.post('/generation/tasks', {
    project: ctx.project.currentId,
    ep: row.ep,
    scene: row.scene,
    shot: row.no,
    kind: '视频生成',
    model: row.model,
    input: row.refs,
    output: `MP4 1080×1920 · ${row.duration}`,
    est,
  })
  ctx.ui.toast(`镜头 ${row.no} 已提交重新生成`)
  await ctx.reload()
}

async function audioRows(endpoint: string, project: string, limit = 200): Promise<Row[]> {
  const result = await http.list<Row>(endpoint, { project, limit })
  return result.rows
}

function todayIso(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

async function openDialogueBatch(ctx: SpecContext) {
  const project = ctx.project.currentId
  const [profiles, tasks, shots] = await Promise.all([
    audioRows('/voice-profiles', project),
    audioRows('/generation-tasks', project, 200),
    audioRows('/shots', project, 999),
  ])
  const pending = dialogueScopeRows(shots, 'pending')
  ctx.ui.openDialog({
    title: '批量生成对白',
    subtitle: pending.length
      ? `将为全项目 ${pending.length} 个待生成镜头提交配音任务；提交前校验音色授权、预算与同集进行中任务。`
      : '全项目当前没有待生成镜头，默认按全部镜头提交；会重新生成已有音频并产生费用。',
    fields: [
      { key: 'scope', label: '范围', type: 'select', value: pending.length ? 'pending' : 'all', options: [{ value: 'pending', label: '仅未生成镜头' }, { value: 'all', label: '全部镜头' }] },
      { key: 'profile', label: '音色档案', type: 'select', options: profiles.map((profile) => ({ value: String(profile.id), label: `${profile.id} · ${profile.char}（${profile.status}）` })) },
      { key: 'note', label: '备注', type: 'textarea', hint: '会写入批量任务的输入说明，不影响单镜头台词。' },
    ],
    submitLabel: '提交批量配音',
    onSubmit: async (values) => {
      const profile = profiles.find((item) => String(item.id) === String(values.profile))
      if (!profile) throw new Error('请选择有效的音色档案')
      const blocked = dialogueBatchBlockReason(shots, profile, ctx.project.current, tasks, values.scope)
      if (blocked) throw new Error(blocked)
      const targets = dialogueScopeRows(shots, values.scope)
      const byEpisode = new Map<number, Row[]>()
      for (const row of targets) {
        const ep = Number(row.ep)
        byEpisode.set(ep, [...(byEpisode.get(ep) ?? []), row])
      }
      for (const [ep, list] of byEpisode) {
        await http.post('/generation/tasks', {
          project,
          ep,
          scene: list[0]?.scene,
          kind: '音频合成',
          stage: '音频生产',
          config: profile.id,
          input: `批量对白 · ${list.length} 个镜头${values.note ? ` · ${values.note}` : ''}`,
          output: 'WAV 48kHz · 单轨',
          status: '排队中',
          priority: '中',
          attempt: 1,
          maxAttempts: 3,
          est: Math.max(8, list.length * 8),
        })
      }
      ctx.ui.toast(`已提交 ${byEpisode.size} 个批量配音任务，覆盖 ${targets.length} 个镜头`)
      await ctx.reload()
    },
  })
}

async function submitDialogueForShot(row: Row, ctx: SpecContext) {
  const project = ctx.project.currentId
  const profiles = await audioRows('/voice-profiles', project)
  const tasks = await audioRows('/generation-tasks', project, 100)
  const profileId = extractVoiceProfileId(row.voice)
  const matches = profileId
    ? profiles.filter((item) => String(item.id) === profileId)
    : profiles.filter((item) => String(row.chars ?? '').split('、').map((char) => char.trim()).includes(String(item.char)))
  if (matches.length !== 1) {
    ctx.ui.toast(`镜头 ${row.no} 未匹配到唯一音色档案，不能直接配音；请在声音档案中补充或改用批量配音`, 'bad')
    return
  }
  const profile = matches[0]
  const blocked = voiceBlockReason(profile)
  if (blocked) {
    ctx.ui.toast(blocked, 'bad')
    return
  }
  const active = findActiveTask(tasks, row.ep, row.no, '音频合成')
  if (active) {
    ctx.ui.toast(`镜头 ${row.no} 已有进行中的配音任务 ${active.id}，不能重复提交`, 'bad')
    return
  }
  if (budgetUsedUp(ctx.project.current)) {
    ctx.ui.toast(`预算已用 100%（${budgetText(ctx.project.current)}），不能提交配音`, 'bad')
    return
  }
  const yes = await ctx.ui.confirm(
    '提交单镜头配音',
    `将为第 ${row.ep} 集 ${row.no} 使用音色 ${profile.id} 生成对白，预估 8 秒；当前预算占用 ${budgetText(ctx.project.current)}。已有音频版本保留。`,
  )
  if (!yes) return
  await http.post('/generation/tasks', {
    project,
    ep: row.ep,
    scene: row.scene,
    shot: row.no,
    kind: '音频合成',
    stage: '音频生产',
    config: profile.id,
    input: String(row.line ?? ''),
    output: 'WAV 48kHz · 单轨',
    status: '排队中',
    priority: '中',
    attempt: 1,
    maxAttempts: 3,
    est: 8,
  })
  ctx.ui.toast(`镜头 ${row.no} 的配音任务已提交`)
  await ctx.reload()
}

function openVoiceRenewal(row: Row, ctx: SpecContext) {
  ctx.ui.openDialog({
    title: `更新音色授权 · ${row.id}`,
    subtitle: '授权到期日与依据会立即影响后续对白生成；已生成的音频不受影响。',
    fields: [
      { key: 'validUntil', label: '授权到期日', type: 'date', required: true, value: String(row.validUntil ?? '') },
      { key: 'rights', label: '授权依据', type: 'textarea', required: true, value: String(row.rights ?? ''), hint: '需写明商用范围与授权书编号，模糊表述会被阻断。' },
      { key: 'status', label: '状态', type: 'select', value: String(row.status ?? '启用'), options: [{ value: '启用', label: '启用' }, { value: '停用', label: '停用' }] },
    ],
    submitLabel: '保存授权',
    onSubmit: async (values) => {
      if (String(values.validUntil) <= todayIso()) throw new Error('授权到期日必须晚于今天')
      const blocked = voiceBlockReason({ ...row, ...values })
      if (blocked) throw new Error(blocked)
      await http.patch(`/voice-profiles/${encodeURIComponent(String(row.id))}`, values)
      ctx.ui.toast(`音色 ${row.id} 的授权已更新`)
      await ctx.reload()
    },
  })
}

function openAssetRenewal(row: Row, ctx: SpecContext) {
  ctx.ui.openDialog({
    title: `登记音频资产授权 · ${row.id}`,
    subtitle: '补全授权依据与到期日后，资产才可进入混音与交付。',
    fields: [
      { key: 'validUntil', label: '授权到期日', type: 'date', required: true, value: String(row.validUntil ?? '') },
      { key: 'rights', label: '授权依据', type: 'textarea', required: true, value: String(row.rights ?? ''), hint: '需写明来源、渠道与授权编号。' },
      { key: 'status', label: '状态', type: 'select', value: '待审核', options: [{ value: '待审核', label: '待审核' }, { value: '已通过', label: '已通过' }] },
    ],
    submitLabel: '保存授权',
    onSubmit: async (values) => {
      if (String(values.validUntil) <= todayIso()) throw new Error('授权到期日必须晚于今天')
      const blocked = audioAssetBlockReason({ ...row, ...values, status: String(values.status) })
      if (blocked) throw new Error(blocked)
      await http.patch(`/audio-assets/${encodeURIComponent(String(row.id))}`, values)
      ctx.ui.toast(`音频资产 ${row.id} 的授权已更新`)
      await ctx.reload()
    },
  })
}

async function submitLipSync(ep: unknown, ctx: SpecContext) {
  const project = ctx.project.currentId
  const subtitles = await audioRows('/subtitles', project, 40)
  const tasks = await audioRows('/generation-tasks', project, 100)
  const blocked = lipSyncBlockReason(subtitles, tasks, ep, ctx.project.current)
  if (blocked) {
    ctx.ui.toast(blocked, 'bad')
    return
  }
  const yes = await ctx.ui.confirm(
    '提交口型校验',
    `将为第 ${ep} 集提交口型校验，预估 60 秒；当前预算占用 ${budgetText(ctx.project.current)}。校验失败会阻断该镜头交付。`,
  )
  if (!yes) return
  await http.post('/generation/tasks', {
    project,
    ep,
    kind: '口型校验',
    stage: '音频生产',
    input: `第 ${ep} 集字幕与口型`,
    output: '口型校验报告',
    status: '排队中',
    priority: '中',
    attempt: 1,
    maxAttempts: 3,
    est: 60,
  })
  ctx.ui.toast(`第 ${ep} 集口型校验任务已提交`)
  await ctx.reload()
}

async function openLipSyncPicker(ctx: SpecContext) {
  const project = ctx.project.currentId
  const subtitles = await audioRows('/subtitles', project, 80)
  const episodes = [...new Set(subtitles.filter((row) => Number(row.ep) > 0).map((row) => Number(row.ep)))].sort((a, b) => a - b)
  ctx.ui.openDialog({
    title: '提交口型校验',
    subtitle: '按集提交；字幕缺失、需重做或同集已有进行中任务时会被阻断。',
    fields: [
      { key: 'ep', label: '集数', type: 'select', options: episodes.map((ep) => ({ value: String(ep), label: `第 ${ep} 集` })) },
    ],
    submitLabel: '提交校验',
    onSubmit: async (values) => {
      const subtitlesNow = await audioRows('/subtitles', project, 40)
      const tasksNow = await audioRows('/generation-tasks', project, 100)
      const blocked = lipSyncBlockReason(subtitlesNow, tasksNow, values.ep, ctx.project.current)
      if (blocked) throw new Error(blocked)
      await http.post('/generation/tasks', {
        project,
        ep: values.ep,
        kind: '口型校验',
        stage: '音频生产',
        input: `第 ${values.ep} 集字幕与口型`,
        output: '口型校验报告',
        status: '排队中',
        priority: '中',
        attempt: 1,
        maxAttempts: 3,
        est: 60,
      })
      ctx.ui.toast(`第 ${values.ep} 集口型校验任务已提交`)
      await ctx.reload()
    },
  })
}

const projectOptions = ['SP-26031', 'SP-26028', 'SP-26019', 'SP-26015', 'SP-26011', 'SP-26007', 'SP-26004']

export const SPECS: Record<string, PageSpec> = {
  /* ---------------- 音频 ---------------- */
  '/audio/dialogue': {
    kicker: 'AUDIO / DIALOGUE',
    title: '对白配音',
    desc: '按镜头台词生成对白；单镜头详情走 L1，配音走 L2；提交前校验音色授权、预算与进行中任务。',
    scoped: true,
    stats: (rows) => [
      { label: '台词镜头', value: rows.length },
      { label: '已通过', value: countOf(rows, 'status', '已通过') },
      { label: '执行中', value: countOf(rows, 'status', '执行中') },
      { label: '待处理', value: countOf(rows, 'status', '待生成') },
    ],
    table: {
      endpoint: '/shots',
      search: true,
      limit: 60,
      columns: [
        col('id', '镜头', { mono: true }),
        col('ep', '集'),
        col('no', '镜号', { mono: true }),
        col('line', '台词'),
        col('voice', '声音设计'),
        col('status', '状态', { pill: true }),
      ],
      filters: [{ key: 'status', label: '状态', options: ['待生成', '执行中', '已通过', '已退回'] }],
    },
    rowPanel: {
      title: '配音镜头详情',
      hint: '单镜头配音会新建任务并保留已有音频；提交前校验音色授权、预算与进行中任务。',
      fields: [
        { key: 'id', label: '镜头 ID' },
        { key: 'ep', label: '集号' },
        { key: 'scene', label: '场号' },
        { key: 'no', label: '镜号' },
        { key: 'desc', label: '画面描述' },
        { key: 'line', label: '台词' },
        { key: 'voice', label: '声音设计' },
        { key: 'emotion', label: '情绪' },
        { key: 'duration', label: '时长' },
        { key: 'status', label: '状态' },
        { key: 'version', label: '版本' },
      ],
    },
    rowActions: (row) => (String(row.line ?? '').trim() && String(row.line) !== '—'
      ? [{ label: '配音', permission: 'production.write', run: (ctx) => { void submitDialogueForShot(row, ctx) } }]
      : []),
    side: (rows, ctx) => [
      {
        title: '配音准入',
        type: 'kv',
        items: [
          { label: '预算占用', value: budgetText(ctx.project.current) },
          { label: '待生成', value: `${dialogueScopeRows(rows, 'pending').length} 个镜头` },
          { label: '音色来源', value: '声音档案 VO-01…VO-09' },
          { label: '输出格式', value: 'WAV 48kHz · 单轨' },
        ],
      },
      {
        title: '状态分布',
        type: 'list',
        items: ['已通过', '执行中', '待生成'].map((status) => ({ label: status, value: countOf(rows, 'status', status) })),
      },
    ],
    actions: [
      {
        label: '批量生成对白',
        tone: 'primary',
        permission: 'production.write',
        run: (ctx) => { void openDialogueBatch(ctx) },
      },
    ],
  },

  '/audio/voice': {
    kicker: 'AUDIO / VOICE',
    title: '声音档案',
    desc: '角色音色、语速、情绪区间与授权条款；详情走 L1，授权变更走 L2，到期或待复核的音色不能用于生成。',
    scoped: true,
    table: {
      endpoint: '/voice-profiles',
      search: true,
      columns: [
        col('id', '档案', { mono: true }),
        col('char', '角色'),
        col('lang', '语言'),
        col('timbre', '音色'),
        col('rate', '语速'),
        col('emotion', '情绪区间'),
        col('validUntil', '授权到期', { mono: true }),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '音色档案详情',
      hint: '授权到期日与依据决定该音色能否进入生成；授权变更立即影响后续任务。',
      fields: [
        { key: 'id', label: '档案 ID' },
        { key: 'char', label: '角色' },
        { key: 'lang', label: '语言' },
        { key: 'timbre', label: '音色' },
        { key: 'rate', label: '语速' },
        { key: 'emotion', label: '情绪区间' },
        { key: 'coverage', label: '覆盖范围' },
        { key: 'rights', label: '授权依据' },
        { key: 'validUntil', label: '授权到期日' },
        { key: 'status', label: '状态' },
      ],
    },
    rowActions: (row) => [
      { label: '授权变更', permission: 'production.write', run: (ctx) => openVoiceRenewal(row, ctx) },
    ],
    side: (rows) => [
      {
        title: '授权口径',
        type: 'kv',
        items: [
          { label: '可复用档案', value: `${rows.filter((row) => !voiceBlockReason(row)).length} 个` },
          { label: '授权阻断', value: `${rows.filter((row) => voiceBlockReason(row)).length} 个` },
          { label: '7 天内到期', value: `${rows.filter((row) => expiringSoon(row)).length} 个` },
          { label: '留档要求', value: '逐音色留档' },
        ],
      },
    ],
    actions: [
      {
        label: '新建音色档案',
        tone: 'primary',
        permission: 'production.write',
        dialog: {
          title: '新建音色档案',
          subtitle: '新音色必须登记授权依据与到期日，否则不能进入对白生成。',
          fields: [
            { key: 'char', label: '角色', required: true },
            { key: 'lang', label: '语言', type: 'select', options: [{ value: '普通话', label: '普通话' }] },
            { key: 'timbre', label: '音色描述', required: true },
            { key: 'rate', label: '语速', placeholder: '0.92' },
            { key: 'validUntil', label: '授权到期日', type: 'date', required: true, hint: '必须晚于今天。' },
            { key: 'rights', label: '授权依据', type: 'textarea', required: true },
          ],
        },
        post: async (values, ctx) => {
          if (String(values.validUntil) <= todayIso()) throw new Error('授权到期日必须晚于今天')
          const blocked = voiceBlockReason({ id: '新音色', status: '启用', rights: values.rights, validUntil: values.validUntil })
          if (blocked) throw new Error(blocked)
          return http.post('/voice-profiles', { ...values, project: ctx.project.currentId, status: '启用' })
        },
        toast: '音色档案已创建',
      },
    ],
  },

  '/audio/bgm': {
    kicker: 'AUDIO / MUSIC',
    title: '配乐与音效',
    desc: '配乐、音效与底噪的来源、授权到期与混音口径；详情走 L1，补授权走 L2，授权不完整的资产不能进入混音。',
    scoped: true,
    table: {
      endpoint: '/audio-assets',
      search: true,
      columns: [
        col('id', '资产', { mono: true }),
        col('type', '类型'),
        col('name', '名称'),
        col('source', '来源'),
        col('rights', '授权'),
        col('validUntil', '授权到期', { mono: true }),
        col('used', '使用位置'),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '音频资产详情',
      hint: '授权依据与到期日决定资产能否用于混音与交付；补授权后会进入待审核状态。',
      fields: [
        { key: 'id', label: '资产 ID' },
        { key: 'type', label: '类型' },
        { key: 'name', label: '名称' },
        { key: 'source', label: '来源' },
        { key: 'rights', label: '授权依据' },
        { key: 'validUntil', label: '授权到期日' },
        { key: 'used', label: '使用位置' },
        { key: 'mix', label: '混音口径' },
        { key: 'status', label: '状态' },
      ],
    },
    rowActions: (row) => {
      const blocked = audioAssetBlockReason(row)
      if (!blocked && !expiringSoon(row)) return []
      return [{ label: blocked ? '补授权' : '授权续期', permission: 'production.write', run: (ctx) => openAssetRenewal(row, ctx) }]
    },
    side: (rows) => [
      {
        title: '授权与混音',
        type: 'kv',
        items: [
          { label: '阻断资产', value: `${rows.filter((row) => audioAssetBlockReason(row)).length} 条` },
          { label: '7 天内到期', value: `${rows.filter((row) => expiringSoon(row)).length} 条` },
          { label: '响度', value: '−18 LUFS' },
          { label: '对白回避', value: '侧链回避已开启' },
        ],
      },
    ],
    actions: [
      {
        label: '登记音频资产',
        tone: 'primary',
        permission: 'production.write',
        dialog: {
          title: '登记音频资产',
          subtitle: '登记来源、授权依据与到期日；授权不完整的资产会被阻断。',
          fields: [
            { key: 'type', label: '类型', type: 'select', options: [{ value: '配乐', label: '配乐' }, { value: '音效', label: '音效' }] },
            { key: 'name', label: '名称', required: true },
            { key: 'source', label: '来源', required: true },
            { key: 'validUntil', label: '授权到期日', type: 'date', required: true, hint: '必须晚于今天。' },
            { key: 'rights', label: '授权依据', type: 'textarea', required: true },
          ],
        },
        post: async (values, ctx) => {
          if (String(values.validUntil) <= todayIso()) throw new Error('授权到期日必须晚于今天')
          const blocked = audioAssetBlockReason({ id: '新资产', status: '待审核', rights: values.rights, validUntil: values.validUntil })
          if (blocked) throw new Error(blocked)
          return http.post('/audio-assets', { ...values, project: ctx.project.currentId, status: '待审核', mix: '待混音' })
        },
        toast: '音频资产已登记',
      },
    ],
  },

  '/audio/subtitle': {
    kicker: 'AUDIO / SUBTITLE',
    title: '字幕与口型',
    desc: '字幕时基、错字校对、样式与口型对齐校验；详情走 L1，口型校验走 L2；字幕缺失或需重做时阻断提交。',
    scoped: true,
    stats: (rows) => [
      { label: '字幕版本', value: rows.length },
      { label: '已通过', value: countOf(rows, 'status', '已通过') },
      { label: '待校对', value: countOf(rows, 'status', '处理中') },
      { label: '需重做', value: countOf(rows, 'status', '需重做') },
    ],
    table: {
      endpoint: '/subtitles',
      limit: 40,
      columns: [
        col('ep', '集'),
        col('version', '版本', { mono: true }),
        col('lines', '行数'),
        col('timeline', '时基'),
        col('asr', '校对'),
        col('style', '样式'),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '字幕版本详情',
      hint: '口型校验按集提交；字幕需重做、缺失或同集已有进行中任务时会被阻断。',
      fields: [
        { key: 'id', label: '记录 ID' },
        { key: 'ep', label: '集号' },
        { key: 'version', label: '版本' },
        { key: 'lines', label: '行数' },
        { key: 'timeline', label: '时基' },
        { key: 'asr', label: '校对结果' },
        { key: 'style', label: '样式规范' },
        { key: 'status', label: '状态' },
      ],
    },
    rowActions: (row) => [
      { label: '口型校验', permission: 'production.write', run: (ctx) => { void submitLipSync(row.ep, ctx) } },
    ],
    side: (rows, ctx) => [
      {
        title: '字幕与口型准入',
        type: 'kv',
        items: [
          { label: '预算占用', value: budgetText(ctx.project.current) },
          { label: '已通过字幕', value: `${rows.filter((row) => String(row.status) === '已通过').length} 集` },
          { label: '需重做', value: `${rows.filter((row) => String(row.status) === '需重做').length} 集` },
          { label: '时基', value: '整数毫秒，无累计漂移' },
        ],
      },
    ],
    actions: [
      {
        label: '提交口型校验',
        tone: 'primary',
        permission: 'production.write',
        run: (ctx) => { void openLipSyncPicker(ctx) },
      },
    ],
  },

  /* ---------------- 合规 / 成本 ---------------- */
  '/compliance/rights': {
    kicker: 'COMPLIANCE / RIGHTS',
    title: '权利与授权台账',
    desc: '生成内容、素材、音色与改编权的授权依据；缺失授权的项目不得进入交付。',
    table: {
      endpoint: '/rights',
      search: true,
      columns: [
        col('id', '编号', { mono: true }),
        col('project', '项目'),
        col('subject', '对象'),
        col('type', '类型'),
        col('owner', '权利人'),
        col('term', '期限'),
        col('commercial', '商用'),
        col('status', '状态', { pill: true }),
      ],
      filters: [{ key: 'status', label: '状态', options: ['有效', '待补', '已过期'] }],
    },
    side: (rows) => [
      { title: '台账覆盖', type: 'kv', items: [{ label: '授权记录', value: rows.length }, { label: '有效期口径', value: '随项目 / 固定期限' }, { label: '缺失处理', value: '阻断交付' }] },
    ],
    actions: [
      {
        label: '登记授权',
        tone: 'primary',
        permission: 'compliance.write',
        dialog: {
          title: '登记授权',
          fields: [
            { key: 'project', label: '项目', type: 'select', options: projectOptions.map((id) => ({ value: id, label: id })) },
            { key: 'subject', label: '对象', required: true },
            { key: 'type', label: '类型', type: 'select', options: [{ value: '生成内容', label: '生成内容' }, { value: '真人肖像', label: '真人肖像' }, { value: '音色克隆', label: '音色克隆' }, { value: '改编权', label: '改编权' }] },
            { key: 'owner', label: '权利人', required: true },
            { key: 'proof', label: '授权依据', type: 'textarea', required: true },
          ],
        },
        post: async (values) => http.post('/rights', { ...values, region: '中国大陆', term: '随项目', commercial: '可商用', status: '有效' }),
        toast: '授权已登记',
      },
    ],
  },

  '/compliance/risks': {
    kicker: 'COMPLIANCE / RISK',
    title: '风险与异常',
    desc: '内容合规、授权、预算与资源风险统一登记；高风险必须阻断下游并升级。',
    stats: (rows) => [
      { label: '风险总数', value: rows.length },
      { label: '高风险', value: countOf(rows, 'level', '高') },
      { label: '处理中', value: countOf(rows, 'status', '处理中') },
    ],
    table: {
      endpoint: '/risks',
      columns: [
        col('id', '编号', { mono: true }),
        col('project', '项目'),
        col('type', '类型'),
        col('where', '位置'),
        col('level', '等级', { pill: true }),
        col('owner', '责任人'),
        col('status', '状态', { pill: true }),
      ],
    },
    side: () => [{ title: '处置规则', type: 'checklist', items: [{ label: '高风险阻断下游', on: true }, { label: '升级企业管理员', on: true }, { label: '补授权后重生成', on: true }, { label: '闭环留审计', on: true }] }],
  },

  '/compliance/audit': {
    kicker: 'COMPLIANCE / AUDIT',
    title: '审计日志',
    desc: '所有关卡动作、授权变更与交付执行均留痕；日志不可编辑、不可删除。',
    table: {
      endpoint: '/audit-logs',
      search: true,
      columns: [
        col('time', '时间', { mono: true }),
        col('actor', '操作人'),
        col('object', '对象'),
        col('action', '动作'),
        col('result', '结果', { pill: true }),
        col('src', '来源'),
      ],
    },
    side: () => [{ title: '留痕口径', type: 'kv', items: [{ label: '写入方式', value: '服务端同步写入' }, { label: '可编辑', value: '否' }, { label: '保留期', value: '按企业策略' }, { label: '导出', value: '需 cost.export / audit.export' }] }],
  },

  '/cost/ledger': {
    kicker: 'COST / LEDGER',
    title: '成本台账',
    desc: '按镜头与任务记账；重试与失败成本单独列示，禁止合并掩盖。',
    scoped: false,
    stats: (rows) => [
      { label: '记录数', value: rows.length },
      { label: '实际成本', value: `¥${rows.reduce((sum, row) => sum + Number(row.actual ?? 0), 0).toLocaleString('zh-CN')}` },
      { label: '失败成本', value: `¥${rows.reduce((sum, row) => sum + Number(row.failed ?? 0), 0).toLocaleString('zh-CN')}` },
      { label: '已确认', value: countOf(rows, 'status', '已确认') },
    ],
    table: {
      endpoint: '/costs',
      search: true,
      columns: [
        col('id', '流水', { mono: true }),
        col('project', '项目'),
        col('ep', '集'),
        col('task', '任务', { mono: true }),
        col('cap', '能力'),
        col('est', '预估'),
        col('actual', '实际'),
        col('failed', '失败成本'),
        col('provider', '供应商'),
        col('status', '状态', { pill: true }),
      ],
      filters: [{ key: 'status', label: '状态', options: ['已确认', '待对账', '争议'] }],
    },
    side: (rows) => [
      { title: '按能力分摊', type: 'list', items: ['视频生成', '音频合成', '质检'].map((cap) => ({ label: cap, value: rows.filter((row) => String(row.cap ?? '').includes(cap.slice(0, 2))).reduce((sum, row) => sum + Number(row.actual ?? 0), 0) })) },
      { title: '记账口径', type: 'kv', items: [{ label: '幂等键', value: 'project + shot + attempt' }, { label: '重试计费', value: '单独记账' }, { label: '对账依据', value: '供应商回执' }] },
    ],
  },

  '/cost/budget': {
    kicker: 'COST / BUDGET',
    title: '预算与阈值',
    desc: '企业、部门与项目的预算与告警阈值；超限策略必须显式声明。',
    stats: (rows) => [
      { label: '预算总额', value: `¥${rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0).toLocaleString('zh-CN')}` },
      { label: '已使用', value: `¥${rows.reduce((sum, row) => sum + Number(row.used ?? 0), 0).toLocaleString('zh-CN')}` },
      { label: '预留', value: `¥${rows.reduce((sum, row) => sum + Number(row.reserve ?? 0), 0).toLocaleString('zh-CN')}` },
    ],
    table: {
      endpoint: '/budgets',
      rowKey: 'scope',
      columns: [
        col('scope', '层级'),
        col('name', '名称'),
        col('total', '总额'),
        col('used', '已使用'),
        col('reserve', '预留'),
        col('state', '状态', { pill: true }),
        col('owner', '责任人'),
      ],
    },
    side: () => [{ title: '超限策略', type: 'checklist', items: [{ label: '80% 告警通知', on: true }, { label: '100% 阻断新任务', on: false }, { label: '追加需管理员审批', on: true }, { label: '失败成本计入实际', on: true }] }],
    actions: [
      {
        label: '调整预算',
        tone: 'primary',
        permission: 'cost.manage',
        dialog: {
          title: '调整预算',
          fields: [
            { key: 'scope', label: '层级', type: 'select', options: [{ value: '企业', label: '企业' }, { value: '部门', label: '部门' }, { value: '项目', label: '项目' }] },
            { key: 'total', label: '总额（元）', type: 'number', required: true },
            { key: 'reason', label: '调整原因', type: 'textarea', required: true },
          ],
        },
        post: async (values) => http.patch(`/budgets/${values.scope}`, { total: Number(values.total) }),
        toast: '预算已调整',
      },
    ],
  },

  /* ---------------- 创意补充 ---------------- */
  '/creation/plan': {
    kicker: 'CREATION / PLAN',
    title: '创意方案',
    desc: '多方案对比：卖点、主题、钩子与风险；确认后进入剧本创作。',
    scoped: true,
    table: {
      endpoint: '/creative-plans',
      columns: [
        col('id', '方案', { mono: true }),
        col('title', '标题'),
        col('selling', '卖点'),
        col('theme', '主题'),
        col('hook', '开场钩子'),
        col('score', '评分'),
        col('chosen', '已选', { format: (row: Row) => (row.chosen ? '是' : '—') }),
      ],
    },
    rowPanel: {
      title: '创意方案详情',
      hint: '多方案对比保留在本页；详情只读单个方案，确认动作在创意设定页完成。',
      fields: [
        { key: 'id', label: '方案 ID' },
        { key: 'title', label: '标题' },
        { key: 'selling', label: '卖点' },
        { key: 'theme', label: '主题' },
        { key: 'hook', label: '开场钩子' },
        { key: 'score', label: '评分' },
        { key: 'chosen', label: '选择状态' },
        { key: 'risk', label: '已知风险' },
      ],
    },
    side: () => [{ title: '确认口径', type: 'kv', items: [{ label: '可确认方案数', value: '1' }, { label: '确认后状态', value: '剧本创作中' }, { label: '重生成', value: '保留历史方案' }] }],
  },

  '/creation/breakdown': {
    kicker: 'CREATION / BREAKDOWN',
    title: '剧本拆解',
    desc: '由锁定剧本拆出场景、镜头与要素；拆解结果直接决定镜头契约与成本估算。',
    scoped: true,
    stats: (rows) => [
      { label: '镜头数', value: rows.length },
      { label: '已进入生产', value: countOf(rows, 'status', '执行中') },
      { label: '待生成', value: countOf(rows, 'status', '待生成') },
      { label: '本页阻断项', value: findBreakdownIssues(rows).length },
    ],
    table: {
      endpoint: '/shots',
      search: true,
      limit: 60,
      columns: [
        col('ep', '集'),
        col('scene', '场'),
        col('no', '镜号', { mono: true }),
        col('desc', '画面描述'),
        col('chars', '人物'),
        col('duration', '时长'),
        col('status', '状态', { pill: true }),
      ],
    },
    actions: [
      {
        label: '校验拆解',
        permission: 'creation.write',
        run: (ctx) => {
          void (async () => {
            try {
              const all = await http.list<Row>('/shots', { project: ctx.project.currentId, limit: 999 })
              const issues = findBreakdownIssues(all.rows)
              if (!issues.length) {
                ctx.ui.toast(`拆解校验通过：${all.rows.length} 个镜头字段完整`)
                return
              }
              ctx.ui.toast(`${formatBreakdownIssue(issues[0])}；全量共 ${issues.length} 条阻断`, 'bad')
              ctx.locate?.(issues[0].rowId)
            } catch {
              ctx.ui.toast('拆解校验失败，请稍后重试', 'bad')
            }
          })()
        },
      },
    ],
    side: (rows) => {
      const issues = findBreakdownIssues(rows)
      return [
        { title: '拆解质量', type: 'kv', items: [{ label: '场景覆盖', value: `${new Set(rows.map((row) => row.scene)).size} 场` }, { label: '人物覆盖', value: `${new Set(rows.map((row) => row.chars)).size} 组` }, { label: '口径', value: '以锁定剧本为唯一基准' }] },
        {
          title: '本页准入',
          type: 'list',
          items: issues.length
            ? [
                ...issues.slice(0, 6).map((issue) => ({ label: `${issue.no || issue.rowId} · 缺${issue.label}`, value: `第 ${issue.ep || '—'} 集 / 场 ${issue.scene || '—'}` })),
                ...(issues.length > 6 ? [{ label: '其余阻断', value: `${issues.length - 6} 条，校验时会定位首个` }] : []),
              ]
            : [{ label: '本页无阻断', value: '校验时按全量镜头执行' }],
        },
      ]
    },
  },

  /* ---------------- 导演 ---------------- */
  '/director/plan': {
    kicker: 'DIRECTOR / PLAN',
    title: '镜头生产计划',
    desc: '按集与并行组编排生产顺序；固化后下游任务才可派发。',
    scoped: true,
    table: {
      endpoint: '/storyboard-plans',
      columns: [
        col('id', '计划', { mono: true }),
        col('version', '版本'),
        col('scope', '范围'),
        col('shots', '镜头数'),
        col('tasks', '任务数'),
        col('frozen', '固化时间'),
        col('status', '状态', { pill: true }),
      ],
    },
    side: (rows) => [
      {
        title: '固化口径',
        type: 'kv',
        items: [
          { label: '已固化计划', value: rows.filter((row) => String(row.status).includes('已固化')).length },
          { label: '当前版本', value: String(rows[0]?.version ?? '—') },
          { label: '准入校验', value: '全量镜头契约' },
        ],
      },
    ],
    actions: [
      { label: '固化计划', tone: 'primary', permission: 'director.write', run: (ctx) => { void freezePlan(ctx) } },
    ],
  },

  '/director/cast': {
    kicker: 'DIRECTOR / CAST',
    title: '人物视觉档案',
    desc: '角色外观与禁区；版本化引用，跨集一致性由引用链保证。',
    scoped: true,
    table: {
      endpoint: '/characters',
      search: true,
      columns: [
        col('id', '档案', { mono: true }),
        col('name', '角色'),
        col('age', '年龄'),
        col('look', '外观要点'),
        col('costume', '服装版本'),
        col('version', '版本'),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '人物档案详情',
      hint: '跨集引用固定版本；换装或外观变更需新建版本，旧版本继续可追溯。',
      fields: [
        { key: 'name', label: '角色' },
        { key: 'age', label: '年龄' },
        { key: 'look', label: '外观要点' },
        { key: 'build', label: '体态' },
        { key: 'hair', label: '发型' },
        { key: 'costume', label: '服装' },
        { key: 'forbid', label: '禁止项' },
        { key: 'version', label: '版本' },
        { key: 'status', label: '状态' },
        { key: 'refs', label: '参考图' },
        { key: 'rights', label: '授权' },
        { key: 'reuse', label: '复用范围' },
        { key: 'parent', label: '派生自' },
        { key: 'note', label: '版本说明' },
      ],
    },
    rowActions: (row) => [
      { label: '换装', run: (ctx) => openCostumeDialog(row, ctx) },
      { label: '新增版本', run: (ctx) => openCharacterVersionDialog(row, ctx) },
    ],
    side: () => [{ title: '一致性规则', type: 'checklist', items: [{ label: '禁用项必须显式声明', on: true }, { label: '跨集引用固定版本', on: true }, { label: '换装需新建版本', on: true }] }],
  },

  '/director/world': {
    kicker: 'DIRECTOR / WORLD',
    title: '场景与道具',
    desc: '场景光线、色彩与道具连续性；道具状态变化必须逐集记录。',
    scoped: true,
    table: {
      endpoint: '/locations',
      search: true,
      columns: [
        col('id', '编号', { mono: true }),
        col('name', '场景'),
        col('type', '内外景'),
        col('light', '光线'),
        col('color', '色彩'),
        col('refs', '参考图'),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '场景详情',
      hint: '场景的空间、光线、色彩与道具连续性共同构成下游生成的视觉约束。',
      fields: [
        { key: 'name', label: '场景' },
        { key: 'type', label: '内外景' },
        { key: 'layout', label: '空间布局' },
        { key: 'light', label: '光线' },
        { key: 'color', label: '色彩' },
        { key: 'props', label: '道具' },
        { key: 'refs', label: '参考图' },
        { key: 'version', label: '版本' },
        { key: 'rights', label: '授权' },
        { key: 'status', label: '状态' },
      ],
    },
    side: (rows) => [{ title: '场景盘点', type: 'list', items: ['内景', '外景'].map((type) => ({ label: type, value: rows.filter((row) => row.type === type).length })) }],
  },

  /* ---------------- 模型 ---------------- */
  '/models/config': {
    kicker: 'MODELS / CONFIG',
    title: '资源配置',
    desc: '模型档案：能力、输入输出、限制与商用条款；配置变更需留审计。',
    table: {
      endpoint: '/model-profiles',
      search: true,
      columns: [
        col('id', '档案', { mono: true }),
        col('provider', '供应商'),
        col('model', '模型', { mono: true }),
        col('cap', '能力'),
        col('limits', '限制'),
        col('price', '单价'),
        col('license', '许可'),
      ],
    },
    side: () => [{ title: '配置口径', type: 'kv', items: [{ label: '白名单', value: '按企业策略' }, { label: '默认路由', value: '能力 → 模型' }, { label: '降级', value: '主 → 备 → 降档 → 挂起' }] }],
  },

  '/models/providers': {
    kicker: 'MODELS / PROVIDERS',
    title: '供应商与模型',
    desc: '供应来源、凭据掩码、额度与连通性；个人自持与企业托管分离记账。',
    table: {
      endpoint: '/providers',
      search: true,
      columns: [
        col('id', '编号', { mono: true }),
        col('name', '供应商'),
        col('mode', '归属'),
        col('kind', '适配器'),
        col('region', '区域'),
        col('quota', '额度'),
        col('test', '连通性'),
        col('status', '状态', { pill: true }),
      ],
    },
    side: () => [{ title: '凭据规则', type: 'checklist', items: [{ label: '前端只显示掩码', on: true }, { label: '轮换需审计', on: true }, { label: '个人凭据不跨项目复用', on: true }] }],
    actions: [
      { label: '测试连通性', permission: 'models.manage', run: (ctx) => { ctx.ui.toast('连通性测试完成：8/8 可用', 'ok') } },
    ],
  },

  '/models/routing': {
    kicker: 'MODELS / ROUTING',
    title: '能力与路由',
    desc: '能力族到模型的映射、优先级与降级链；路由变更不影响执行中任务。',
    table: {
      endpoint: '/capabilities',
      rowKey: 'cap',
      columns: [
        col('cap', '能力族'),
        col('use', '用途'),
        col('io', '输入 → 输出'),
        col('unit', '计费单位'),
        col('models', '可用模型'),
      ],
    },
    side: () => [{ title: '降级链', type: 'list', items: [{ label: 'L1 主模型', value: '视频模型 A' }, { label: 'L2 备选', value: '视频模型 B' }, { label: 'L3 降档', value: '降低分辨率' }, { label: 'L4 挂起', value: '通知并保留任务' }] }],
  },

  /* ---------------- 通知 ---------------- */
  '/notify/inbox': {
    kicker: 'NOTIFY / INBOX',
    title: '待办与通知',
    desc: '阻塞类待办优先；每条通知必须能跳到处理页面，处理动作留审计。',
    stats: (rows) => [
      { label: '未读', value: rows.filter((row) => row.unread).length },
      { label: '待处理', value: countOf(rows, 'state', '待处理') },
      { label: '已处理', value: countOf(rows, 'state', '已处理') },
    ],
    table: {
      endpoint: '/notifications',
      search: true,
      columns: [
        col('id', '编号', { mono: true }),
        col('type', '类型'),
        col('project', '项目'),
        col('title', '标题'),
        col('impact', '影响'),
        col('state', '状态', { pill: true }),
        col('at', '时间', { mono: true }),
      ],
    },
    rowActions: (row) => [
      { label: '标记已读', run: async (ctx) => { await http.post(`/notifications/${row.id}/read`); ctx.ui.toast('已标记为已读'); ctx.reload() } },
    ],
    actions: [
      { label: '全部已读', permission: 'notify.handle', run: async (ctx) => { await http.post('/notifications/read-all'); ctx.ui.toast('全部通知已标记已读'); ctx.reload() } },
    ],
    side: (rows) => [{ title: '通知口径', type: 'kv', items: [{ label: '通知总数', value: rows.length }, { label: '跳转', value: '每条带 link 字段' }, { label: '去重', value: '同对象合并' }] }],
  },

  /* ---------------- 运维 ---------------- */
  '/ops/capabilities': {
    kicker: 'OPS / CAPABILITY',
    title: '能力字典与适配器',
    desc: '能力族接入状态与适配器覆盖；未接入能力不得出现在项目可选配置中。',
    table: {
      endpoint: '/video-capabilities',
      rowKey: 'item',
      columns: [col('item', '能力项'), col('status', '接入状态', { pill: true }), col('note', '说明')],
    },
    side: () => [{ title: '适配器口径', type: 'kv', items: [{ label: '接入方式', value: '内置适配器 / 自定义' }, { label: '测试要求', value: '上线前连通性验证' }, { label: '变更', value: '需审计' }] }],
  },

  '/ops/queue': {
    kicker: 'OPS / QUEUE',
    title: '队列、存储与备份',
    desc: '队列深度、并发、失败与存储用量；备份失败必须告警。',
    table: {
      endpoint: '/generation-tasks',
      limit: 80,
      columns: [
        col('id', '任务', { mono: true }),
        col('project', '项目'),
        col('kind', '类型'),
        col('status', '状态', { pill: true }),
        col('priority', '优先级'),
        col('est', '预估时长'),
      ],
    },
    actions: [
      { label: '立即备份', permission: 'platform.config', run: (ctx) => { ctx.ui.toast('备份任务已触发（mock）', 'ok') } },
    ],
    side: () => [{ title: '存储', type: 'kv', items: [{ label: '总容量', value: '486 GB' }, { label: '已用', value: '312 GB（64%）' }, { label: '最近备份', value: '2026-11-25 03:10' }] }],
  },

  '/ops/logs': {
    kicker: 'OPS / LOGS',
    title: '系统日志',
    desc: '错误、告警与供应商回执；日志用于排障，不承载业务事实。',
    table: {
      endpoint: '/audit-logs',
      search: true,
      columns: [col('time', '时间', { mono: true }), col('actor', '操作人'), col('action', '动作'), col('result', '结果', { pill: true }), col('src', '来源')],
    },
    side: () => [{ title: '日志级别', type: 'kv', items: [{ label: 'ERROR', value: '立即告警' }, { label: 'WARN', value: '聚合观察' }, { label: 'INFO', value: '保留 30 天' }] }],
  },

  /* ---------------- 组织 ---------------- */
  '/orgs/departments': {
    kicker: 'ORGS / DEPARTMENTS',
    title: '部门与组织单元',
    desc: '部门、负责人、成员与预算占用；部门决定项目可见范围。',
    table: {
      endpoint: '/departments',
      columns: [
        col('id', '编号', { mono: true }),
        col('name', '部门'),
        col('code', '编码', { mono: true }),
        col('leader', '负责人'),
        col('members', '成员'),
        col('projects', '项目'),
        col('status', '状态', { pill: true }),
      ],
    },
    actions: [
      {
        label: '新建部门',
        tone: 'primary',
        permission: 'org.manage',
        dialog: {
          title: '新建部门',
          fields: [
            { key: 'name', label: '部门名称', required: true },
            { key: 'code', label: '编码', required: true },
            { key: 'leader', label: '负责人', required: true },
          ],
        },
        post: async (values) => http.post('/departments', { ...values, members: 0, projects: 0, status: '启用' }),
        toast: '部门已创建',
      },
    ],
    side: () => [{ title: '组织口径', type: 'checklist', items: [{ label: '一员工一主部门', on: true }, { label: '跨部门授权走项目成员', on: true }, { label: '部门预算独立记账', on: true }] }],
  },

  '/orgs/members': {
    kicker: 'ORGS / MEMBERS',
    title: '员工账号',
    desc: '账号、部门、角色与产出；停用账号必须同步回收项目授权。',
    table: {
      endpoint: '/users',
      search: true,
      columns: [
        col('id', '账号', { mono: true }),
        col('name', '姓名'),
        col('email', '邮箱'),
        col('dept', '部门'),
        col('role', '角色'),
        col('status', '状态', { pill: true }),
        col('joined', '入职'),
      ],
    },
    side: (rows) => [{ title: '账号分布', type: 'list', items: ['在职', '停用'].map((status) => ({ label: status, value: rows.filter((row) => row.status === status).length })) }],
  },

  '/orgs/member': {
    kicker: 'ORGS / MEMBER',
    title: '员工档案',
    desc: '员工产出、成本与质量；档案只读，变更走账号管理。',
    table: {
      endpoint: '/users',
      search: true,
      rowKey: 'id',
      columns: [
        col('name', '姓名'),
        col('dept', '部门'),
        col('role', '角色'),
        col('projects', '项目'),
        col('delivered', '已交付'),
        col('episodes', '集数'),
        col('cost', '成本'),
        col('quality', '质量分'),
      ],
    },
    rowClick: (row, ctx) => {
      ctx.ui.openDialog({
        title: `${row.name} · 员工档案`,
        subtitle: `${row.dept} / ${row.role}`,
        fields: [
          { key: 'k1', label: '账号', value: row.id, type: 'text' },
          { key: 'k2', label: '邮箱', value: row.email },
          { key: 'k3', label: '资源', value: row.resources },
        ],
        submitLabel: '关闭',
      })
    },
    side: () => [{ title: '档案口径', type: 'kv', items: [{ label: '可编辑', value: '否' }, { label: '产出统计', value: '按交付集数' }, { label: '成本', value: '按归属任务' }] }],
  },

  '/orgs/roles': {
    kicker: 'ORGS / ROLES',
    title: '角色与权限',
    desc: '角色到权限码的映射；权限码是唯一鉴权单位，前端只做显隐。',
    table: {
      endpoint: '/roles',
      rowKey: 'code',
      columns: [
        col('code', '角色', { mono: true }),
        col('name', '名称'),
        col('scope', '作用域'),
        col('permCount', '权限数', { format: (row: Row) => (row.perms ? row.perms.length : 0) }),
        col('duty', '职责'),
      ],
    },
    side: (rows) => [{ title: '权限码覆盖', type: 'kv', items: [{ label: '角色数', value: rows.length }, { label: '权限码', value: 36 }, { label: '鉴权位置', value: '服务端 guard' }] }],
  },

  '/orgs/grants': {
    kicker: 'ORGS / GRANTS',
    title: '项目成员授权',
    desc: '项目级成员与角色；授权与回收必须立即可见，不允许延迟生效。',
    table: {
      endpoint: '/orgs/grants',
      rowKey: 'project',
      columns: [col('project', '项目', { mono: true }), col('projectName', '项目名'), col('userId', '成员', { mono: true }), col('role', '项目角色')],
    },
    side: () => [{ title: '授权口径', type: 'checklist', items: [{ label: '项目 owner 不可移除', on: true }, { label: '回收即时生效', on: true }, { label: '跨部门授权留审计', on: true }] }],
  },

  '/orgs/handover': {
    kicker: 'ORGS / HANDOVER',
    title: '离职与移交',
    desc: '离职前必须完成项目、资产与待办移交；未闭环的账号不得停用。',
    emptyTitle: '暂无待移交记录',
    emptyHint: '当有员工离职流程时，这里会列出项目、资产与待办清单。',
    table: {
      endpoint: '/orgs/handovers',
      columns: [col('user', '员工'), col('projects', '项目'), col('assets', '资产'), col('tasks', '待办'), col('status', '状态', { pill: true })],
    },
    side: () => [{ title: '移交清单', type: 'checklist', items: [{ label: '项目负责人变更', on: true }, { label: '资产归属转移', on: true }, { label: '待办重新指派', on: true }, { label: '凭据回收', on: true }] }],
  },

  /* ---------------- 后期 / 质量 / 任务补充 ---------------- */
  '/post/versions': {
    kicker: 'POST / VERSIONS',
    title: '版本链',
    desc: '交付版本冻结，不允许覆盖历史；新建版本必须基于已冻结版本。',
    scoped: true,
    stats: (rows) => [
      { label: '交付版本', value: rows.length },
      { label: '已冻结', value: rows.filter((row) => row.frozen).length },
      { label: '校验和留存', value: rows.filter((row) => row.checksum).length },
      { label: '最近交付', value: rows[0]?.at ?? '—' },
    ],
    table: {
      endpoint: '/deliveries',
      columns: [
        col('id', '版本', { mono: true }),
        col('project', '项目'),
        col('version', '交付版本'),
        col('episodes', '集数'),
        col('size', '体积'),
        col('checksum', '校验和', { mono: true }),
        col('status', '状态', { pill: true }),
        col('at', '交付时间', { mono: true }),
      ],
    },
    rowPanel: {
      title: '交付版本详情',
      hint: '版本链只读：交付后冻结、不可覆盖；重新交付会生成新的版本号。',
      fields: [
        { key: 'id', label: '版本号' },
        { key: 'project', label: '项目' },
        { key: 'version', label: '交付版本' },
        { key: 'episodes', label: '集数' },
        { key: 'files', label: '文件数' },
        { key: 'size', label: '体积' },
        { key: 'checksum', label: '校验和' },
        { key: 'reviewer', label: '审核人' },
        { key: 'receiver', label: '接收方' },
        { key: 'at', label: '交付时间' },
        { key: 'status', label: '状态' },
        { key: 'frozen', label: '冻结' },
      ],
    },
    side: () => [{ title: '版本规则', type: 'checklist', items: [{ label: '交付后冻结', on: true }, { label: 'V2 新建不覆盖', on: true }, { label: '校验和随包留存', on: true }] }],
  },

  '/quality/rework': {
    kicker: 'QUALITY / REWORK',
    title: '返工与返工台账',
    desc: '返工必须记录原因、轮次与成本；超轮次升级人工决策。',
    scoped: true,
    stats: (rows) => [
      { label: '返工单', value: rows.length },
      { label: '进行中', value: countOf(rows, 'status', '进行中') },
      { label: '返工成本', value: `¥${rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0).toLocaleString('zh-CN')}` },
    ],
    table: {
      endpoint: '/rework',
      columns: [
        col('id', '返工单', { mono: true }),
        col('target', '对象', { mono: true }),
        col('type', '原因'),
        col('round', '轮次'),
        col('cost', '成本'),
        col('status', '状态', { pill: true }),
        col('at', '时间', { mono: true }),
      ],
    },
    side: () => [{ title: '返工规则', type: 'kv', items: [{ label: '单镜上限', value: '3 轮' }, { label: '超限', value: '转人工决策' }, { label: '旧版本', value: '保留，不覆盖' }] }],
  },

  '/tasks/queue': {
    kicker: 'TASKS / QUEUE',
    title: '资源池与队列',
    desc: '按能力族查看积压、并发与失败；调度只认队列，不认页面。',
    table: {
      endpoint: '/generation-tasks',
      limit: 80,
      columns: [
        col('id', '任务', { mono: true }),
        col('project', '项目'),
        col('kind', '能力族'),
        col('status', '状态', { pill: true }),
        col('priority', '优先级'),
        col('executor', '执行人'),
        col('attempt', '尝试'),
        col('est', '预估'),
      ],
      filters: [{ key: 'status', label: '队列', options: ['排队中', '执行中', '失败'] }],
    },
    stats: (rows) => [
      { label: '积压', value: countOf(rows, 'status', '排队中') },
      { label: '执行中', value: countOf(rows, 'status', '执行中') },
      { label: '失败', value: countOf(rows, 'status', '失败') },
      { label: '并发上限', value: '6' },
    ],
    side: () => [
      { title: '队列口径', type: 'kv', items: [{ label: '调度粒度', value: '能力族 + 供应商配额' }, { label: '退避', value: '30s / 120s / 480s' }, { label: '超时回收', value: '30 分钟' }, { label: '人工介入', value: '重试达上限后' }] },
    ],
  },

  '/tasks/list': {
    kicker: 'TASKS / LIST',
    title: '生产任务',
    desc: '任务队列与依赖；同一镜头并发重试必须受 maxAttempts 约束。',
    scoped: false,
    stats: (rows) => [
      { label: '任务数', value: rows.length },
      { label: '执行中', value: countOf(rows, 'status', '执行中') },
      { label: '排队中', value: countOf(rows, 'status', '排队中') },
      { label: '失败', value: countOf(rows, 'status', '失败') },
    ],
    table: {
      endpoint: '/generation-tasks',
      search: true,
      limit: 80,
      columns: [
        col('id', '任务', { mono: true }),
        col('project', '项目'),
        col('kind', '类型'),
        col('status', '状态', { pill: true }),
        col('priority', '优先级'),
        col('executor', '执行人'),
        col('attempt', '尝试'),
        col('est', '预估'),
      ],
      filters: [{ key: 'status', label: '状态', options: ['排队中', '执行中', '失败', '已完成'] }],
    },
    rowActions: (row) => [
      { label: '重试', run: async (ctx) => { await http.post(`/generation/tasks/${row.id}/retry`); ctx.ui.toast(`任务 ${row.id} 已重试`); ctx.reload() } },
      { label: '取消', danger: true, run: async (ctx) => { await http.post(`/generation/tasks/${row.id}/cancel`); ctx.ui.toast(`任务 ${row.id} 已取消`); ctx.reload() } },
    ],
    side: () => [{ title: '调度口径', type: 'kv', items: [{ label: '幂等键', value: 'project + shot + attempt' }, { label: '超时回收', value: '30 分钟' }, { label: '失败重试', value: '≤ maxAttempts' }] }],
  },

  '/tasks/attempt': {
    kicker: 'TASKS / ATTEMPT',
    title: '尝试与调用记录',
    desc: '每次调用都记账；失败原因与供应商回执必须可追溯。',
    table: {
      endpoint: '/invocations',
      columns: [
        col('id', '调用', { mono: true }),
        col('provider', '供应商'),
        col('model', '模型', { mono: true }),
        col('cap', '能力'),
        col('usage', '用量'),
        col('cost', '成本'),
        col('status', '状态', { pill: true }),
        col('at', '时间', { mono: true }),
      ],
    },
    side: () => [{ title: '对账口径', type: 'kv', items: [{ label: '用量来源', value: '供应商回执' }, { label: '失败计费', value: '按合同' }, { label: '差异', value: '进争议队列' }] }],
  },

  '/video/preview': {
    kicker: 'VIDEO / PREVIEW',
    title: '预览与校验',
    desc: '镜头预览、版本切换与抽检；抽检不合格退回重生成。',
    scoped: true,
    table: {
      endpoint: '/shots',
      limit: 40,
      columns: [
        col('id', '镜头', { mono: true }),
        col('ep', '集'),
        col('no', '镜号', { mono: true }),
        col('duration', '时长'),
        col('model', '模型'),
        col('quality', '质检项'),
        col('status', '状态', { pill: true }),
      ],
    },
    rowPanel: {
      title: '镜头预览详情',
      hint: '重新生成会新建任务并保留旧版本；提交前校验镜头契约、预算与进行中任务。',
      fields: [
        { key: 'id', label: '镜头 ID' },
        { key: 'ep', label: '集号' },
        { key: 'scene', label: '场号' },
        { key: 'no', label: '镜号' },
        { key: 'desc', label: '画面描述' },
        { key: 'frame', label: '景别' },
        { key: 'angle', label: '机位' },
        { key: 'move', label: '运镜' },
        { key: 'duration', label: '时长' },
        { key: 'chars', label: '人物' },
        { key: 'model', label: '模型' },
        { key: 'refs', label: '引用资产' },
        { key: 'quality', label: '质检项' },
        { key: 'version', label: '版本' },
        { key: 'status', label: '状态' },
      ],
    },
    rowActions: (row) => [
      { label: '重生成', permission: 'production.write', run: (ctx) => { void regenerateShot(row, ctx) } },
    ],
    side: (rows, ctx) => {
      const issues = findShotContractIssues(rows)
      return [
        {
          title: '预算与准入',
          type: 'kv',
          items: [
            { label: '预算占用', value: budgetText(ctx.project.current) },
            { label: '本页契约', value: `${rows.length - issues.length} / ${rows.length} 通过` },
            { label: '阻断镜头', value: issues.length ? `${issues.length} 条` : '无' },
          ],
        },
        { title: '抽检口径', type: 'checklist', items: [{ label: '人物一致性', on: true }, { label: '画面异常', on: true }, { label: '时长合规', on: true }, { label: '抽检比例', value: '每集 ≥ 10%' }] },
      ]
    },
  },
}

export const FALLBACK: PageSpec = {
  kicker: 'STUDIO / PAGE',
  title: '页面',
  desc: '该路由尚未配置规格。',
  table: { endpoint: '/projects', columns: [col('id', '项目', { mono: true }), col('name', '名称'), col('status', '状态', { pill: true })] },
}

SPECS['/fallback'] = FALLBACK
