<template>
  <div class="script-workspace">
    <div class="stage-kpis">
      <div v-for="item in kpis" :key="item.label" class="stage-kpi">
        <span>{{ item.label }}</span>
        <b>{{ item.value }}</b>
        <small>{{ item.hint }}</small>
      </div>
    </div>

    <div class="card script-flow-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">剧本创作流程</h3>
          <p class="card-sub">创意交棒后先用模型出稿，再逐集修订、补齐全剧，最后提交审核；每一步都留在当前工作区。</p>
        </div>
        <div class="script-flow-actions">
          <button
            type="button"
            class="btn primary"
            :disabled="!canGenerate"
            :title="canGenerate ? '' : '先完成创意策划的确认交棒'"
            @click="openGenerate(false)"
          >{{ generateLabel }}</button>
          <button
            v-if="activeDraft"
            type="button"
            class="btn"
            :disabled="!canGenerate"
            @click="newVersion"
          >另起一版</button>
          <button
            v-if="projectStatus === '剧本创作中'"
            type="button"
            class="btn"
            :class="{ primary: canSubmit }"
            :disabled="!canSubmit || submitting"
            :title="submitHint"
            @click="submitReview"
          >{{ submitting ? '提交中…' : '提交剧本审核' }}</button>
        </div>
      </div>

      <div class="script-flow">
        <div
          v-for="step in flowSteps"
          :key="step.title"
          class="script-flow-step"
          :class="{ done: step.ok, now: !step.ok && step.no === firstUndone }"
        >
          <i>{{ step.ok ? '✓' : step.no }}</i>
          <div><b>{{ step.title }}</b><small>{{ step.desc }}</small></div>
        </div>
      </div>

      <p v-if="!handoff" class="notice warn script-gate-note">
        创意方案尚未确认，剧本创作台已锁定。请先在「创意策划」完成生成候选、选定方案与确认交棒。
      </p>
      <p v-else-if="lockedScript" class="notice script-gate-note">
        正式版本 {{ lockedScript.version }} 已锁定并供下游引用。如需修改，请另起一版，审核通过后才替换基线。
      </p>
    </div>

    <div class="script-split">
      <div class="card script-canvas">
        <div class="card-head">
          <div>
            <h3 class="card-title">剧本工作区</h3>
            <p class="card-sub">
              {{ activeScript ? `${activeScript.id} · ${activeScript.version} · ${activeScript.status}` : '尚未建立剧本版本' }}
              <span v-if="activeDraft">· 已写 {{ draftEpisodes.length }} / {{ totalEpisodes }} 集</span>
            </p>
          </div>
          <div class="script-head-tools">
            <select v-if="versions.length" v-model="selectedId" class="field script-version-select" aria-label="切换剧本版本">
              <option v-for="version in versions" :key="version.id" :value="version.id">
                {{ version.version }} · {{ version.status }}
              </option>
            </select>
            <button v-if="activeDraft && activeEpisode" type="button" class="btn" @click="openEditor">编辑本集</button>
          </div>
        </div>

        <div v-if="!activeScript" class="script-empty">
          <b>还没有剧本版本</b>
          <p>确认创意方案后，用模型生成第一版分集稿。建议先出前 3 集样章，确认口径后再补齐全剧。</p>
          <button type="button" class="btn primary" :disabled="!canGenerate" @click="openGenerate(false)">用模型生成第一版</button>
        </div>

        <div v-else-if="!draftEpisodes.length" class="script-empty">
          <b>{{ activeScript.locked ? `${activeScript.version} 已锁定` : '这个版本还没有分集稿' }}</b>
          <p>
            {{ activeScript.locked
              ? '正式版本只保存统计与审核记录，分集正文已冻结供下游引用。要改内容必须另起一版。'
              : '当前版本只登记了集数与统计，没有可编辑的分集正文。可以继续用模型补齐。' }}
          </p>
          <button type="button" class="btn primary" :disabled="!canGenerate" @click="openGenerate(false)">
            {{ activeScript.locked ? '生成修订版' : '用模型补齐分集稿' }}
          </button>
        </div>

        <div v-else class="script-body">
          <div class="script-episode-list" role="list" aria-label="分集稿">
            <button
              v-for="episode in draftEpisodes"
              :key="episode.no"
              type="button"
              class="script-episode-item"
              :class="{ active: episode.no === activeEpisode?.no }"
              @click="selectedEpisodeNo = episode.no"
            >
              <span class="no">E{{ String(episode.no).padStart(2, '0') }}</span>
              <span class="title">{{ episode.title }}</span>
              <small>{{ episode.scenes.length }} 场 · {{ episodeLineCount(episode) }} 行{{ episode.edited ? ' · 已修订' : '' }}</small>
            </button>
          </div>

          <div v-if="activeEpisode" class="script-episode-detail">
            <div class="script-episode-head">
              <div>
                <div class="script-episode-title">
                  <b>E{{ String(activeEpisode.no).padStart(2, '0') }} · {{ activeEpisode.title }}</b>
                  <span class="pill">{{ activeEpisode.scenes.length }} 场</span>
                  <span v-if="activeEpisode.edited" class="pill accent">人工修订</span>
                </div>
                <p>{{ activeEpisode.logline }}</p>
              </div>
              <div class="script-episode-actions">
                <button type="button" class="btn" :disabled="!canGenerate" @click="openRewrite(activeEpisode)">模型重写本集</button>
                <button type="button" class="btn" @click="openEditor">编辑内容</button>
              </div>
            </div>

            <div class="script-hook"><span class="metric-label">结尾钩子</span><b>{{ activeEpisode.hook }}</b></div>

            <article v-for="scene in activeEpisode.scenes" :key="`${activeEpisode.no}-${scene.no}`" class="script-scene">
              <header>
                <b>S{{ scene.no }}</b>
                <span>{{ scene.location }}</span>
                <small>{{ scene.time }} · {{ scene.chars }}</small>
              </header>
              <p>{{ scene.action }}</p>
              <div class="script-lines">
                <div v-for="(line, index) in scene.lines" :key="index" class="script-line">
                  <b>{{ line.char }}</b><span>{{ line.text }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="script-side">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">创作输入</h3>
              <p class="card-sub">模型只读取已交棒的创意方案与项目基线。</p>
            </div>
            <span class="pill" :class="{ accent: handoff }">{{ handoff ? '已交棒' : '未交棒' }}</span>
          </div>
          <blockquote class="script-source">{{ creativeSource }}</blockquote>
          <div class="script-input-grid">
            <div><span class="metric-label">题材</span><b>{{ project?.genre || '—' }}</b></div>
            <div><span class="metric-label">受众</span><b>{{ project?.audience || '—' }}</b></div>
            <div><span class="metric-label">单集时长</span><b>{{ project?.duration || '—' }}</b></div>
            <div><span class="metric-label">语言</span><b>{{ project?.language || '—' }}</b></div>
            <div class="wide"><span class="metric-label">影像风格</span><b>{{ project?.style || '—' }}</b></div>
            <div class="wide"><span class="metric-label">内容约束</span><b>{{ project?.constraints || '—' }}</b></div>
          </div>
          <div v-if="generation" class="script-generation">
            <span class="metric-label">最近一次模型生成</span>
            <b>{{ generation.model }} · {{ generation.elapsed }} · 约 {{ generation.tokens }} tokens · ¥{{ generation.cost }}</b>
            <small>{{ generation.strength }} · {{ generation.scope === 'full' ? '整剧' : `第 ${generation.from}–${generation.from + generation.count - 1} 集` }} · {{ generation.at }}</small>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">提交门禁</h3>
            <span class="pill" :class="{ accent: gatePass }">{{ gateDone }} / 5</span>
          </div>
          <ul class="script-checks">
            <li v-for="check in gateChecks" :key="check.label" :class="{ ok: check.ok }">
              <i>{{ check.ok ? '✓' : '!' }}</i>
              <div><b>{{ check.label }}</b><small>{{ check.detail }}</small></div>
            </li>
          </ul>
          <p class="script-gate-hint">{{ submitHint }}</p>
        </div>
      </div>
    </div>

    <div class="script-records">
      <div class="card">
        <div class="card-head"><h3 class="card-title">版本链</h3><span class="card-sub">点击切换查看</span></div>
        <div class="script-version-list">
          <button
            v-for="version in versions"
            :key="version.id"
            type="button"
            class="script-version-row"
            :class="{ active: version.id === activeScript?.id }"
            @click="selectedId = version.id"
          >
            <span class="k">{{ version.version }} · {{ version.id }}</span>
            <StatusPill :status="String(version.status)" />
            <span class="v">{{ version.writtenEpisodes ?? version.episodes ?? 0 }} / {{ totalEpisodes }} 集 · {{ version.scenes ?? 0 }} 场</span>
            <small>{{ version.by || '—' }} · {{ version.at || '—' }} · {{ version.note || '—' }}</small>
          </button>
          <EmptyState v-if="!versions.length" title="暂无剧本版本" desc="模型生成后，版本链会在这里留档。" compact />
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3 class="card-title">审核记录</h3></div>
        <div v-for="review in scriptReviews" :key="String(review.id)" class="script-review-row">
          <span class="k">{{ review.version }} · {{ review.node }}</span>
          <StatusPill :status="String(review.result)" />
          <p>{{ review.note || '—' }} · {{ review.auditor }} · {{ review.at }}</p>
        </div>
        <EmptyState v-if="!scriptReviews.length" title="暂无审核记录" desc="提交审核后，结论与意见会在这里留痕。" compact />
      </div>
    </div>

    <div v-if="editorOpen && editDraft" class="modal-backdrop script-editor-backdrop" @click.self="closeEditor">
      <div class="modal wide script-editor-modal" role="dialog" aria-modal="true" aria-label="编辑分集稿">
        <div class="modal-head">
          <div>
            <h3>编辑 E{{ String(editDraft.no).padStart(2, '0') }}《{{ editDraft.title }}》</h3>
            <p>{{ activeScript?.version }} · 人工修订会留痕，不覆盖旧版本</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭编辑" @click="closeEditor">✕</button>
        </div>
        <div class="modal-body script-editor-body">
          <div class="script-editor-fields">
            <label><span class="metric-label">集标题</span><input v-model="editDraft.title" class="field" /></label>
            <label class="wide"><span class="metric-label">本集梗概</span><textarea v-model="editDraft.logline" class="field" rows="2" /></label>
            <label class="wide"><span class="metric-label">结尾钩子</span><textarea v-model="editDraft.hook" class="field" rows="2" /></label>
          </div>

          <div v-for="(scene, index) in editDraft.scenes" :key="index" class="script-scene-editor">
            <div class="script-editor-fields">
              <label><span class="metric-label">场次</span><input v-model="scene.no" class="field" /></label>
              <label><span class="metric-label">场景</span><input v-model="scene.location" class="field" /></label>
              <label><span class="metric-label">时间</span><input v-model="scene.time" class="field" /></label>
              <label class="wide"><span class="metric-label">人物</span><input v-model="scene.chars" class="field" /></label>
              <label class="wide"><span class="metric-label">动作与画面</span><textarea v-model="scene.action" class="field" rows="2" /></label>
              <label class="wide">
                <span class="metric-label">台词</span>
                <textarea v-model="sceneLineTexts[index]" class="field" rows="4" placeholder="每行一句，格式：角色：台词" />
              </label>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="closeEditor">取消</button>
          <button type="button" class="btn primary" :disabled="saving" @click="saveEditor">{{ saving ? '保存中…' : '保存修订' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { creationApi } from '../../../services/creation'
import { projectApi } from '../../../services/projects'
import { useSessionStore } from '../../../stores/session'
import { useUiStore } from '../../../stores/ui'
import StatusPill from '../../../components/ui/StatusPill.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import type { Row } from '../../../mock/db'

interface ScriptLine {
  char: string
  text: string
}

interface ScriptScene {
  no: string
  location: string
  time: string
  chars: string
  action: string
  lines: ScriptLine[]
}

interface EpisodeDraft {
  [key: string]: unknown
  no: number
  title: string
  logline: string
  hook: string
  scenes: ScriptScene[]
  edited?: boolean
  editedAt?: string
}

interface ScriptRow extends Row {
  version: string
  status: string
  locked?: boolean
  episodes?: number
  writtenEpisodes?: number
  scenes?: number
  lines?: number
  note?: string
  by?: string
  at?: string
  episodeDrafts?: EpisodeDraft[]
  revision?: number
  updatedAt?: string
  generation?: {
    model: string
    prompt: string
    strength: string
    scope: string
    from: number
    count: number
    elapsed: string
    tokens: number
    cost: number
    at: string
  }
}

const props = defineProps<{
  project: Record<string, unknown> | null
  summary: Record<string, unknown> | null
}>()
const emit = defineEmits<{
  (event: 'refresh'): void
  (event: 'navigate', path: string): void
}>()

const session = useSessionStore()
const ui = useUiStore()
const canWrite = computed(() => session.can('creation.write'))
const projectId = computed(() => String(props.project?.id ?? ''))
const projectStatus = computed(() => {
  const scripts = (props.summary?.scripts as Row[] | undefined) ?? []
  void scripts.map((row) => `${row.id}:${row.status}:${row.revision ?? 0}`).join('|')
  return String(props.project?.status ?? '')
})
const totalEpisodes = computed(() => Math.max(1, Number(props.project?.episodes ?? 1)))
const handoff = computed(() => !['草稿', '创意策划中', '已终止'].includes(projectStatus.value))
const canGenerate = computed(
  () =>
    canWrite.value &&
    handoff.value &&
    !['待剧本审核', '已完成', '已交付', '已归档', '已终止'].includes(projectStatus.value),
)

const versions = computed<ScriptRow[]>(() => {
  const value = props.summary?.scripts
  const list = Array.isArray(value) ? value as ScriptRow[] : []
  return [...list].sort((left, right) => {
    const leftNo = Number(String(left.version ?? '').replace(/[^0-9]/g, '')) || 0
    const rightNo = Number(String(right.version ?? '').replace(/[^0-9]/g, '')) || 0
    return rightNo - leftNo
  })
})
const selectedId = ref('')
watch(versions, (list) => {
  if (!list.length) {
    selectedId.value = ''
    return
  }
  if (!list.some((row) => row.id === selectedId.value)) selectedId.value = list[0].id
}, { immediate: true })
const activeScript = computed(() => versions.value.find((row) => row.id === selectedId.value) ?? versions.value[0] ?? null)
const lockedScript = computed(() => versions.value.find((row) => row.locked) ?? null)

const draftEpisodes = ref<EpisodeDraft[]>([])
const scriptTick = ref(0)
watch(
  [
    selectedId,
    () => activeScript.value?.id,
    () => activeScript.value?.revision,
    () => activeScript.value?.updatedAt,
    () => activeScript.value?.status,
    () => versions.value.length,
    () => versions.value.map((row) => `${row.id}:${row.status}:${row.revision ?? 0}:${row.updatedAt ?? ''}`).join('|'),
  ],
  () => {
    const value = activeScript.value?.episodeDrafts
    draftEpisodes.value = Array.isArray(value) ? [...value as EpisodeDraft[]] : []
    scriptTick.value += 1
  },
  { immediate: true },
)
const activeDraft = computed(() => Boolean(activeScript.value && !activeScript.value.locked && draftEpisodes.value.length))
const isLatestVersion = computed(() => Boolean(activeScript.value && versions.value[0]?.id === activeScript.value.id))
const selectedEpisodeNo = ref<number | null>(null)
watch([() => activeScript.value?.id, () => draftEpisodes.value.length], () => {
  const current = draftEpisodes.value.find((episode) => episode.no === selectedEpisodeNo.value)
  if (!current) selectedEpisodeNo.value = draftEpisodes.value[0]?.no ?? null
}, { immediate: true })
const activeEpisode = computed(() =>
  draftEpisodes.value.find((episode) => episode.no === selectedEpisodeNo.value) ?? draftEpisodes.value[0] ?? null,
)

const currentBrief = computed(() => {
  const value = props.summary?.briefs
  return (Array.isArray(value) ? value as Row[] : [])[0] ?? null
})
const chosenPlan = computed(() => {
  const value = props.summary?.creativePlans
  return (Array.isArray(value) ? value as Row[] : []).find((row) => row.chosen) ?? null
})
const creativeSource = computed(() => {
  if (chosenPlan.value) return `已确认方向「${String(chosenPlan.value.title)}」：${String(chosenPlan.value.selling ?? '')}`
  if (currentBrief.value?.note) return String(currentBrief.value.note)
  return '尚未找到已交棒的创意说明；模型不会在缺少创意输入时生成正文。'
})

const scriptReviews = computed(() => {
  const value = props.summary?.reviews
  return (Array.isArray(value) ? value as Row[] : []).filter((row) => String(row.node ?? '').includes('剧本'))
})

function episodeLineCount(episode: EpisodeDraft): number {
  return episode.scenes.reduce((sum, scene) => sum + (scene.lines?.length ?? 0), 0)
}

const gateChecks = computed(() => {
  const allScenes = draftEpisodes.value.every((episode) => episode.scenes?.length >= 3)
  const allLines = draftEpisodes.value.every(
    (episode) => episode.scenes?.length && episode.scenes.every((scene) => scene.lines?.length),
  )
  return [
    { label: '创意输入已交棒', ok: handoff.value, detail: handoff.value ? '创意方案已冻结为唯一输入' : '先完成创意策划确认交棒' },
    { label: '分集稿覆盖全剧', ok: draftEpisodes.value.length >= totalEpisodes.value, detail: `${draftEpisodes.value.length} / ${totalEpisodes.value} 集` },
    { label: '每集至少 3 场', ok: Boolean(draftEpisodes.value.length) && allScenes, detail: allScenes ? '场次结构完整' : '存在场次不足的集' },
    { label: '每场均有台词', ok: Boolean(draftEpisodes.value.length) && allLines, detail: allLines ? '台词与人物已就位' : '存在空场或空台词' },
    { label: '版本可追溯', ok: Boolean(activeScript.value), detail: activeScript.value ? `${activeScript.value.version} · ${activeScript.value.status}` : '尚未建立版本' },
  ]
})
const gateDone = computed(() => gateChecks.value.filter((check) => check.ok).length)
const gatePass = computed(() => gateDone.value === 5)
const canSubmit = computed(() =>
  canWrite.value
  && projectStatus.value === '剧本创作中'
  && gatePass.value
  && Boolean(activeScript.value)
  && !activeScript.value?.locked
  && isLatestVersion.value,
)
const submitHint = computed(() => {
  if (!canWrite.value) return '当前身份没有脚本写入权限。'
  if (projectStatus.value !== '剧本创作中') {
    return `项目当前为「${projectStatus.value || '未知'}」，不在剧本创作中；只有剧本创作中才可提交审核。`
  }
  if (!isLatestVersion.value) return '当前查看的是历史版本；切换到最新草稿后再提交。'
  if (!draftEpisodes.value.length) return '先用模型生成分集稿。'
  if (draftEpisodes.value.length < totalEpisodes.value) return `还差 ${totalEpisodes.value - draftEpisodes.value.length} 集，补齐全剧后可提交。`
  if (!gatePass.value) return `仍有 ${5 - gateDone.value} 项门禁未通过。`
  return '分集稿完整，可提交审核；审核通过后锁定正式版本。'
})
const generation = computed(() => {
  void scriptTick.value
  return activeScript.value?.generation ?? null
})

const flowSteps = computed(() => {
  const submitted = String(activeScript.value?.status ?? '').includes('待审核')
    || projectStatus.value === '待剧本审核'
    || Boolean(scriptReviews.value.length)
  const locked = Boolean(activeScript.value?.locked)
  return [
    { no: 1, title: '创意交棒', desc: '确认方案成为唯一输入', ok: handoff.value },
    { no: 2, title: '模型出稿', desc: '按模型与范围生成分集稿', ok: draftEpisodes.value.length > 0 },
    { no: 3, title: '补齐全剧', desc: `${draftEpisodes.value.length} / ${totalEpisodes.value} 集`, ok: draftEpisodes.value.length >= totalEpisodes.value },
    { no: 4, title: '提交审核', desc: '剧本审核节点 A', ok: submitted },
    { no: 5, title: '审核锁定', desc: '正式版本供下游引用', ok: locked },
  ]
})
const firstUndone = computed(() => flowSteps.value.find((step) => !step.ok)?.no ?? 0)

const draftSceneCount = computed(() =>
  draftEpisodes.value.reduce((sum, episode) => sum + (episode.scenes?.length ?? 0), 0),
)
const draftLineCount = computed(() =>
  draftEpisodes.value.reduce((sum, episode) => sum + episodeLineCount(episode), 0),
)

const kpis = computed(() => [
  { label: '当前版本', value: activeScript.value?.version ?? '未创建', hint: activeScript.value?.status ?? '等待生成' },
  { label: '分集稿', value: `${draftEpisodes.value.length} / ${totalEpisodes.value}`, hint: '已生成 / 全剧' },
  { label: '场次', value: String(draftSceneCount.value), hint: '当前分集稿合计' },
  { label: '台词行', value: String(draftLineCount.value), hint: '当前分集稿合计' },
  { label: '提交门禁', value: `${gateDone.value} / 5`, hint: canSubmit.value ? '可提交审核' : '未就绪' },
])

const generateLabel = computed(() => {
  if (!handoff.value) return '先完成创意策划'
  if (activeScript.value?.locked) return '生成修订版'
  if (activeDraft.value) return '继续用模型生成'
  return '用模型生成剧本'
})

const submitting = ref(false)

function firstMissingEpisode(): number {
  for (let no = 1; no <= totalEpisodes.value; no += 1) {
    if (!draftEpisodes.value.some((episode) => episode.no === no)) return no
  }
  return 1
}

function openGenerate(forceNew = false) {
  if (!canGenerate.value) {
    const reason = projectStatus.value === '待剧本审核' ? '剧本正在审核，暂不能继续生成' : '先完成创意策划的确认交棒，再生成剧本'
    ui.toast(reason, 'bad')
    return
  }
  const scriptId = forceNew || activeScript.value?.locked ? '' : String(activeScript.value?.id ?? '')
  const missing = totalEpisodes.value - draftEpisodes.value.length
  const scope = missing > 0 && draftEpisodes.value.length > 0 ? 'full' : 'pilot'
  const from = firstMissingEpisode()
  ui.openDialog({
    title: forceNew ? '另起一版剧本' : '用模型生成剧本',
    subtitle: scriptId
      ? `生成结果并入 ${activeScript.value?.version}；人工修订过的集不会被自动覆盖。`
      : '会新建一个草稿版本，不覆盖已锁定的正式版本。',
    wide: true,
    fields: [
      {
        key: 'model',
        label: '生成模型',
        type: 'select',
        value: '剧本模型 A · 长篇结构',
        required: true,
        options: [
          { value: '剧本模型 A · 长篇结构', label: '剧本模型 A · 长篇结构（适合悬疑、连续追更）' },
          { value: '剧本模型 B · 快节奏短剧', label: '剧本模型 B · 快节奏短剧（前 3 秒强钩子）' },
          { value: '剧本模型 C · 对话打磨', label: '剧本模型 C · 对话打磨（关系与潜台词）' },
        ],
        hint: '模型只读取已交棒的创意方案、项目基线与下方生成要求。',
      },
      {
        key: 'scope',
        label: '生成范围',
        type: 'select',
        value: scope,
        required: true,
        options: [
          { value: 'pilot', label: `前 ${Math.min(3, totalEpisodes.value)} 集 · 先出样章` },
          { value: 'full', label: `整剧 ${totalEpisodes.value} 集 · 补齐并保留人工修订` },
          { value: 'custom', label: '指定起始集与集数' },
        ],
      },
      { key: 'from', label: '起始集', type: 'number', value: from, required: true, hint: '仅「指定集数」时生效。' },
      { key: 'count', label: '生成集数', type: 'number', value: Math.max(1, Math.min(3, missing || 3)), required: true, hint: '仅「指定集数」时生效。' },
      {
        key: 'strength',
        label: '改编强度',
        type: 'select',
        value: '标准改编',
        required: true,
        options: [
          { value: '贴稿改编', label: '贴稿改编 · 尽量保留现有设定' },
          { value: '标准改编', label: '标准改编 · 强化冲突与钩子' },
          { value: '大胆重构', label: '大胆重构 · 允许重排人物关系' },
        ],
      },
      {
        key: 'prompt',
        label: '生成要求',
        type: 'textarea',
        rows: 5,
        value: `${creativeSource.value.replace(/[。；;，,\s]+$/, '')}。按 ${String(props.project?.genre ?? '短剧')} 节奏写，单集 ${String(props.project?.duration ?? '')}，每集结尾留一个可追更的钩子。`,
        required: true,
        full: true,
        hint: '写明人物关系、每集冲突和结尾钩子；这段要求会记入生成记录。',
      },
    ],
    submitLabel: '开始生成',
    onSubmit: async (values) => {
      const created = await creationApi.generateScript({
        project: projectId.value,
        scriptId,
        model: values.model,
        scope: values.scope,
        from: Number(values.from),
        count: Number(values.count),
        strength: values.strength,
        prompt: values.prompt,
      })
      selectedId.value = String(created.id)
      ui.toast(`已生成 ${String(created.version)} · ${String(created.writtenEpisodes ?? 0)} / ${totalEpisodes.value} 集`)
      emit('refresh')
    },
  })
}

async function newVersion() {
  const confirmed = await ui.confirm(
    '另起一版剧本？',
    '新版本会从草稿开始，不覆盖当前版本；审核通过前不会影响下游正式基准。',
  )
  if (confirmed) openGenerate(true)
}

function openRewrite(episode: EpisodeDraft) {
  if (!canGenerate.value || !activeScript.value) return
  ui.openDialog({
    title: `模型重写 E${String(episode.no).padStart(2, '0')}`,
    subtitle: '只替换这一集；其他集与人工修订保持不变。',
    wide: true,
    fields: [
      {
        key: 'model',
        label: '生成模型',
        type: 'select',
        value: '剧本模型 C · 对话打磨',
        required: true,
        options: [
          { value: '剧本模型 A · 长篇结构', label: '剧本模型 A · 长篇结构' },
          { value: '剧本模型 B · 快节奏短剧', label: '剧本模型 B · 快节奏短剧' },
          { value: '剧本模型 C · 对话打磨', label: '剧本模型 C · 对话打磨' },
        ],
      },
      {
        key: 'strength',
        label: '重写强度',
        type: 'select',
        value: '标准改编',
        required: true,
        options: [
          { value: '只改台词', label: '只改台词 · 保留场次结构' },
          { value: '标准改编', label: '标准改编 · 场次与台词一起重排' },
          { value: '大胆重构', label: '大胆重构 · 允许换场景与冲突' },
        ],
      },
      {
        key: 'prompt',
        label: '重写要求',
        type: 'textarea',
        rows: 5,
        value: `保留 E${episode.no} 的核心冲突「${episode.hook}」，让人物关系更紧，结尾钩子更明确。`,
        required: true,
        full: true,
      },
    ],
    submitLabel: '重写本集',
    onSubmit: async (values) => {
      const created = await creationApi.generateScript({
        project: projectId.value,
        scriptId: activeScript.value?.id,
        model: values.model,
        scope: 'custom',
        from: episode.no,
        count: 1,
        strength: values.strength,
        prompt: values.prompt,
        overwrite: true,
      })
      selectedId.value = String(created.id)
      ui.toast(`E${String(episode.no).padStart(2, '0')} 已用模型重写`)
      emit('refresh')
    },
  })
}

async function submitReview() {
  if (!canSubmit.value || !activeScript.value || submitting.value) return
  const confirmed = await ui.confirm(
    '提交剧本审核？',
    `${activeScript.value.version} 共 ${draftEpisodes.value.length} 集将送审；项目进入「待剧本审核」，审核通过后锁定正式版本。`,
  )
  if (!confirmed) return
  submitting.value = true
  try {
    await projectApi.transition(projectId.value, 'submitScript')
    ui.toast('剧本已提交审核，等待审核人裁决')
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '提交剧本审核失败', 'bad')
  } finally {
    submitting.value = false
  }
}

const editorOpen = ref(false)
const editDraft = ref<EpisodeDraft | null>(null)
const sceneLineTexts = ref<string[]>([])
const saving = ref(false)

function cloneEpisode(episode: EpisodeDraft): EpisodeDraft {
  return JSON.parse(JSON.stringify(episode)) as EpisodeDraft
}

function openEditor() {
  if (!activeEpisode.value) return
  editDraft.value = cloneEpisode(activeEpisode.value)
  sceneLineTexts.value = editDraft.value.scenes.map((scene) =>
    scene.lines.map((line) => `${line.char}：${line.text}`).join('\n'),
  )
  editorOpen.value = true
}
function closeEditor() {
  editorOpen.value = false
  editDraft.value = null
  sceneLineTexts.value = []
}
function parseLines(text: string): ScriptLine[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const split = line.search(/[：:]/)
    if (split < 0) return { char: '旁白', text: line }
    return { char: line.slice(0, split).trim() || '旁白', text: line.slice(split + 1).trim() }
  }).filter((line) => line.text)
}

async function saveEditor() {
  if (!editDraft.value || !activeScript.value || saving.value) return
  saving.value = true
  try {
    const episode: EpisodeDraft = {
      ...editDraft.value,
      scenes: editDraft.value.scenes.map((scene, index) => ({
        ...scene,
        lines: parseLines(sceneLineTexts.value[index] ?? ''),
      })),
      edited: true,
      editedAt: new Date().toISOString(),
    }
    const drafts = draftEpisodes.value.map((item) => (item.no === episode.no ? episode : item))
    const counts = {
      scenes: drafts.reduce((sum, item) => sum + item.scenes.length, 0),
      lines: drafts.reduce((sum, item) => sum + episodeLineCount(item), 0),
    }
    await creationApi.updateScript(activeScript.value.id, {
      episodeDrafts: drafts,
      scenes: counts.scenes,
      lines: counts.lines,
      status: '草稿',
      revision: Number(activeScript.value.revision ?? 0) + 1,
      note: `人工修订 E${String(episode.no).padStart(2, '0')} · ${activeScript.value.note ?? ''}`,
    })
    ui.toast(`E${String(episode.no).padStart(2, '0')} 已保存修订`)
    closeEditor()
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '保存剧本修订失败', 'bad')
  } finally {
    saving.value = false
  }
}
</script>

<script lang="ts">
export default { name: 'ScriptWorkspace' }
</script>

<style scoped>
.script-workspace { display: grid; gap: 14px; }
.stage-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(126px, 1fr)); gap: 8px; }
.stage-kpi { min-width: 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); }
.stage-kpi span { display: block; color: var(--muted); font-size: 10px; }
.stage-kpi b { display: block; margin-top: 3px; color: var(--ink); font-size: 18px; line-height: 1.3; }
.stage-kpi small { display: block; margin-top: 2px; overflow: hidden; color: var(--faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }

.script-flow-card { padding-bottom: 12px; }
.script-flow-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.script-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.script-flow-step { display: flex; align-items: flex-start; gap: 8px; min-width: 0; padding: 9px; border: 1px solid var(--line); border-radius: 8px; background: color-mix(in srgb, var(--surface) 70%, transparent); }
.script-flow-step i { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--line-strong); border-radius: 50%; background: var(--surface); color: var(--text-3); font-size: 11px; font-style: normal; }
.script-flow-step b { display: block; font-size: 12px; line-height: 1.3; }
.script-flow-step small { display: block; margin-top: 3px; color: var(--text-3); font-size: 10px; line-height: 1.35; }
.script-flow-step.done { border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
.script-flow-step.done i { border-color: var(--ok); color: var(--ok); }
.script-flow-step.now { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.script-flow-step.now i { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.script-gate-note { margin: 10px 0 0; }

.script-split { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr); gap: 14px; align-items: start; }
.script-canvas { min-width: 0; }
.script-head-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.script-version-select { width: auto; min-width: 164px; }
.script-empty { display: grid; justify-items: center; gap: 8px; padding: 34px 16px; border: 1px dashed var(--line); border-radius: 9px; text-align: center; }
.script-empty b { font-size: 14px; }
.script-empty p { max-width: 520px; margin: 0; color: var(--text-3); font-size: 11px; line-height: 1.6; }

.script-body { display: grid; grid-template-columns: minmax(0, 218px) minmax(0, 1fr); gap: 12px; margin-top: 12px; min-width: 0; }
.script-episode-list { display: flex; flex-direction: column; gap: 5px; max-height: 560px; overflow: auto; padding-right: 4px; }
.script-episode-item { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 2px 6px; width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); color: var(--text-2); text-align: left; cursor: pointer; }
.script-episode-item:hover { border-color: var(--line-strong); }
.script-episode-item.active { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.script-episode-item .no { color: var(--accent); font-size: 10px; font-weight: 700; }
.script-episode-item .title { overflow: hidden; color: var(--ink); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.script-episode-item small { grid-column: 2; color: var(--faint); font-size: 9px; }

.script-episode-detail { min-width: 0; }
.script-episode-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.script-episode-title { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.script-episode-title b { font-size: 15px; }
.script-episode-head p { margin: 5px 0 0; color: var(--text-3); font-size: 11px; line-height: 1.55; }
.script-episode-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.script-episode-actions .btn { padding: 4px 8px; font-size: 10px; }
.script-hook { display: flex; align-items: baseline; gap: 8px; margin: 10px 0; padding: 8px 10px; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.script-hook .metric-label { flex: none; }
.script-hook b { color: var(--text-2); font-size: 11px; line-height: 1.5; }
.script-scene { margin-top: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: color-mix(in srgb, var(--surface) 82%, transparent); }
.script-scene header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
.script-scene header b { color: var(--accent); font-size: 11px; }
.script-scene header span { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-scene header small { color: var(--faint); font-size: 9px; }
.script-scene > p { margin: 6px 0 8px; color: var(--text-2); font-size: 11px; line-height: 1.6; }
.script-lines { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line); }
.script-line { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 8px; font-size: 11px; line-height: 1.55; }
.script-line b { color: var(--ink); font-weight: 600; }
.script-line span { color: var(--text-2); }

.script-side { display: grid; gap: 12px; align-content: start; }
.script-source { margin: 0 0 10px; padding: 9px 10px; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--text-2); font-size: 11px; line-height: 1.6; }
.script-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.script-input-grid > div { min-width: 0; padding: 7px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); }
.script-input-grid .wide { grid-column: 1 / -1; }
.script-input-grid b { display: block; margin-top: 3px; color: var(--ink); font-size: 11px; line-height: 1.45; font-weight: 600; overflow-wrap: anywhere; }
.script-generation { display: grid; gap: 3px; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); }
.script-generation b { color: var(--ink); font-size: 11px; line-height: 1.45; }
.script-generation small { color: var(--faint); font-size: 9px; line-height: 1.45; }

.script-checks { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.script-checks li { display: flex; align-items: flex-start; gap: 7px; padding: 7px 8px; border: 1px solid var(--line); border-radius: 7px; }
.script-checks li.ok { border-color: color-mix(in srgb, var(--ok) 28%, var(--line)); background: color-mix(in srgb, var(--ok) 5%, transparent); }
.script-checks i { flex: none; display: grid; place-items: center; width: 17px; height: 17px; margin-top: 1px; border: 1px solid color-mix(in srgb, var(--bad) 55%, var(--line)); border-radius: 50%; color: var(--bad); font-size: 10px; font-style: normal; }
.script-checks li.ok i { border-color: color-mix(in srgb, var(--ok) 55%, var(--line)); color: var(--ok); }
.script-checks b { display: block; font-size: 11px; line-height: 1.35; }
.script-checks small { display: block; margin-top: 2px; color: var(--text-3); font-size: 9px; line-height: 1.4; }
.script-gate-hint { margin: 9px 0 0; padding: 8px 9px; border-radius: 7px; background: color-mix(in srgb, var(--warn) 9%, transparent); color: var(--text-2); font-size: 10px; line-height: 1.5; }

.script-records { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 12px; }
.script-version-list, .script-review-row { display: grid; gap: 6px; }
.script-version-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 8px; width: 100%; padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); text-align: left; cursor: pointer; }
.script-version-row.active { border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.script-version-row .k { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-version-row .v { color: var(--text-2); font-size: 10px; }
.script-version-row small { grid-column: 1 / -1; overflow: hidden; color: var(--faint); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.script-review-row { padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; }
.script-review-row .k { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-review-row p { margin: 4px 0 0; color: var(--text-3); font-size: 10px; line-height: 1.5; }

.script-editor-backdrop { z-index: 96; }
.script-editor-modal { max-width: 900px; }
.script-editor-body { display: grid; gap: 12px; max-height: 68vh; overflow: auto; }
.script-editor-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; }
.script-editor-fields label { display: grid; gap: 4px; min-width: 0; }
.script-editor-fields .wide { grid-column: 1 / -1; }
.script-scene-editor { padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }

@media (max-width: 1380px) {
  .script-split { grid-template-columns: minmax(0, 1fr); }
  .script-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .script-side { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1120px) {
  .script-flow, .script-records, .script-side { grid-template-columns: minmax(0, 1fr); }
  .script-body { grid-template-columns: minmax(0, 1fr); }
  .script-episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 260px; }
  .script-editor-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
