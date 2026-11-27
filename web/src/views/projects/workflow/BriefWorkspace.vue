<template>
  <div class="brief-workspace">
    <div class="stage-kpis">
      <div v-for="item in kpis" :key="item.label" class="stage-kpi">
        <span>{{ item.label }}</span>
        <b>{{ item.value }}</b>
        <small>{{ item.hint }}</small>
      </div>
    </div>

    <div class="card brief-flow-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">创意流程</h3>
          <p class="card-sub">从输入固化到确认交棒共 5 步；每一步都能在当前工作区回溯，不在页面之间跳转。</p>
        </div>
        <span class="pill" :class="{ accent: gatePass && canConfirm }">{{ flowStatus }}</span>
      </div>
      <div class="brief-flow">
        <div
          v-for="step in flowSteps"
          :key="step.no"
          class="brief-flow-step"
          :class="{ done: step.ok, now: !step.ok && step.no === firstUndone }"
        >
          <i>{{ step.ok ? '✓' : step.no }}</i>
          <div>
            <b>{{ step.title }}</b>
            <small>{{ step.desc }}</small>
          </div>
        </div>
      </div>
    </div>

    <div class="brief-split">
      <div class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">创意输入基线</h3>
            <p class="card-sub">
              {{ currentBrief?.version || '未建立版本' }} · {{ currentBrief?.mode || '未选择输入方式' }} · 由 {{ currentBrief?.by || '—' }} 维护
            </p>
          </div>
          <div class="head-actions">
            <StatusPill :status="currentBrief?.status || '未建立'" />
            <button class="btn" :disabled="!canWrite" @click="editBrief()">编辑为新版本</button>
          </div>
        </div>

        <blockquote v-if="currentBrief?.note" class="brief-note">{{ currentBrief.note }}</blockquote>
        <p v-else class="brief-empty-note">还没有创意说明。先写清主线、情绪和每集钩子，再生成候选方向。</p>

        <div class="kv-grid brief-kv">
          <div><span class="metric-label">题材</span><b>{{ project?.genre || '—' }}</b></div>
          <div><span class="metric-label">目标受众</span><b>{{ project?.audience || '不限定' }}</b></div>
          <div><span class="metric-label">单集时长</span><b>{{ project?.duration || '—' }}</b></div>
          <div><span class="metric-label">画幅与分辨率</span><b>{{ project?.ratio || '—' }}</b></div>
          <div><span class="metric-label">语言</span><b>{{ project?.language || '—' }}</b></div>
          <div><span class="metric-label">影像风格</span><b>{{ project?.style || '不限定' }}</b></div>
          <div class="wide"><span class="metric-label">内容约束与禁区</span><b>{{ project?.constraints || '—' }}</b></div>
        </div>

        <div class="brief-mode-row">
          <span class="metric-label">输入方式</span>
          <span
            v-for="mode in modes"
            :key="mode.id"
            class="pill"
            :class="{ accent: mode.mode === currentBrief?.mode }"
            :title="text(mode.input)"
          >{{ mode.mode }}</span>
        </div>
      </div>

      <div class="card brief-gate">
        <div class="card-head">
          <div>
            <h3 class="card-title">确认门禁</h3>
            <p class="card-sub">全部通过后，当前方案成为剧本与下游生成的唯一基准。</p>
          </div>
          <span class="pill" :class="{ accent: gatePass }">{{ gateDone }}/5</span>
        </div>
        <ul class="brief-checks">
          <li v-for="check in gateChecks" :key="check.label" :class="{ ok: check.ok }">
            <i>{{ check.ok ? '✓' : '!' }}</i>
            <div><b>{{ check.label }}</b><small>{{ check.detail }}</small></div>
          </li>
        </ul>
        <div class="brief-gate-note" :class="{ bad: !canConfirm }">
          {{ canConfirm ? '项目处于创意策划中，可执行确认交棒。' : lockReason }}
        </div>
        <div class="brief-gate-actions">
          <button class="btn" :disabled="!canWrite" @click="openGenerate">生成候选</button>
          <button class="btn primary" @click="openGate">确认创意方案</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">创意方向对比</h3>
          <p class="card-sub">{{ plans.length }} 个方向 · {{ chosenPlan ? `已选定「${chosenPlan.title}」` : '尚未选定唯一方案' }}；评分、卖点、主题与风险同一口径。</p>
        </div>
        <button class="btn" :disabled="!canWrite" @click="openGenerate">生成候选方向</button>
      </div>

      <div v-if="sortedPlans.length" class="brief-plan-grid">
        <article
          v-for="plan in sortedPlans"
          :key="plan.id"
          class="brief-plan-card"
          :class="{ chosen: plan.chosen }"
          role="button"
          tabindex="0"
          @click="openPlan(plan)"
          @keydown.enter.prevent="openPlan(plan)"
        >
          <div class="brief-plan-head">
            <b>{{ plan.title }}</b>
            <span class="pill" :class="{ accent: plan.chosen }">{{ plan.chosen ? '已选定' : `${plan.score} 分` }}</span>
          </div>
          <p class="brief-plan-selling">{{ plan.selling }}</p>
          <dl class="kv-lite">
            <dt>主题</dt><dd>{{ plan.theme }}</dd>
            <dt>开场钩子</dt><dd>{{ plan.hook }}</dd>
            <dt>已知风险</dt><dd>{{ plan.risk }}</dd>
          </dl>
          <div class="brief-plan-foot">
            <button class="btn ghost" @click.stop="openPlan(plan)">查看详情</button>
            <button
              class="btn"
              :class="{ primary: !plan.chosen }"
              :disabled="Boolean(plan.chosen) || !canWrite"
              @click.stop="choosePlan(plan)"
            >{{ plan.chosen ? '当前选定' : '设为选定' }}</button>
          </div>
        </article>
      </div>
      <div v-else class="brief-empty">
        <b>还没有候选方向</b>
        <p>当前基线与创意说明已可生成；系统会一次给出 2–4 个方向，不会自动替你选定。</p>
        <button class="btn primary" :disabled="!canWrite" @click="openGenerate">生成第一组方向</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h3 class="card-title">简报版本记录</h3>
          <p class="card-sub">每次编辑都生成新版本，旧版本只读保留；点击版本查看当时的完整输入。</p>
        </div>
        <button class="btn" :disabled="!canWrite" @click="editBrief()">新建版本</button>
      </div>
      <DataTable
        :columns="[
          { key: 'version', label: '版本' },
          { key: 'status', label: '状态', pill: true },
          { key: 'mode', label: '输入方式' },
          { key: 'by', label: '维护人' },
          { key: 'at', label: '更新时间' },
          { key: 'note', label: '创意说明' },
        ]"
        :rows="sortedBriefs"
        row-key="id"
        clickable
        empty-title="暂无创意简报"
        @row-click="openVersion"
      />
    </div>

    <div v-if="dialog" class="modal-backdrop brief-modal-backdrop" @click.self="closeDialog">
      <div ref="modalRef" class="modal wide" role="dialog" aria-modal="true" :aria-label="dialogTitle">
        <div class="modal-head">
          <div>
            <h3>{{ dialogTitle }}</h3>
            <p>{{ dialogSubtitle }}</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭弹窗" @click="closeDialog">✕</button>
        </div>

        <div class="modal-body brief-modal-body">
          <template v-if="dialog === 'plan' && activePlan">
            <div class="brief-plan-detail-head">
              <span class="pill" :class="{ accent: activePlan.chosen }">{{ activePlan.chosen ? '当前选定' : '候选方案' }}</span>
              <b>{{ activePlan.score }} / 100</b>
              <small>{{ activePlan.id }}</small>
            </div>
            <div class="detail-grid">
              <div class="wide"><span class="metric-label">方案标题</span><b>{{ activePlan.title }}</b></div>
              <div class="wide"><span class="metric-label">核心卖点</span><b>{{ activePlan.selling }}</b></div>
              <div><span class="metric-label">主题</span><b>{{ activePlan.theme }}</b></div>
              <div><span class="metric-label">开场钩子</span><b>{{ activePlan.hook }}</b></div>
              <div class="wide"><span class="metric-label">已知风险</span><b>{{ activePlan.risk }}</b></div>
              <div><span class="metric-label">生成方式</span><b>{{ activePlan.mode || '—' }}</b></div>
              <div><span class="metric-label">生成人 / 时间</span><b>{{ activePlan.by || '—' }} · {{ activePlan.at || '—' }}</b></div>
            </div>
          </template>

          <template v-else-if="dialog === 'version' && activeVersion">
            <div class="brief-plan-detail-head">
              <span class="pill" :class="{ accent: activeVersion.status === '已确认' }">{{ activeVersion.status }}</span>
              <b>{{ activeVersion.version }}</b>
              <small>{{ activeVersion.id }}</small>
            </div>
            <blockquote class="brief-note">{{ activeVersion.note || '该版本没有填写创意说明。' }}</blockquote>
            <p v-if="activeVersion.snapshotFallback" class="brief-fallback">该旧版本未保存完整字段快照，缺失项按项目当前基线补齐展示。</p>
            <div class="detail-grid">
              <div><span class="metric-label">题材</span><b>{{ activeVersion.genre || '—' }}</b></div>
              <div><span class="metric-label">目标受众</span><b>{{ activeVersion.audience || '—' }}</b></div>
              <div><span class="metric-label">单集时长</span><b>{{ activeVersion.duration || '—' }}</b></div>
              <div><span class="metric-label">画幅与分辨率</span><b>{{ activeVersion.ratio || '—' }}</b></div>
              <div><span class="metric-label">语言</span><b>{{ activeVersion.language || '—' }}</b></div>
              <div><span class="metric-label">影像风格</span><b>{{ activeVersion.style || '—' }}</b></div>
              <div class="wide"><span class="metric-label">内容约束与禁区</span><b>{{ activeVersion.constraints || '—' }}</b></div>
              <div><span class="metric-label">输入方式</span><b>{{ activeVersion.mode || '—' }}</b></div>
              <div><span class="metric-label">维护人 / 时间</span><b>{{ activeVersion.by || '—' }} · {{ activeVersion.at || '—' }}</b></div>
            </div>
          </template>

          <template v-else-if="dialog === 'gate'">
            <div class="brief-gate-summary">
              <div><span class="metric-label">当前版本</span><b>{{ currentBrief?.version || '未建立' }} · {{ currentBrief?.status || '—' }}</b></div>
              <div><span class="metric-label">选定方案</span><b>{{ chosenPlan?.title || '未选定' }}</b></div>
              <div><span class="metric-label">项目状态</span><b>{{ project?.status || '—' }} / {{ project?.phase || '—' }}</b></div>
            </div>
            <ul class="brief-checks modal-checks">
              <li v-for="check in gateChecks" :key="check.label" :class="{ ok: check.ok }">
                <i>{{ check.ok ? '✓' : '!' }}</i>
                <div><b>{{ check.label }}</b><small>{{ check.detail }}</small></div>
              </li>
            </ul>
            <div class="brief-gate-note" :class="{ bad: !canConfirm || !gatePass }">
              {{ canConfirm && gatePass ? '确认后将冻结本版创意，并进入剧本创作；下游以这一版为唯一输入。' : (!gatePass ? `仍有 ${5 - gateDone} 项未通过，补齐后再交棒。` : lockReason) }}
            </div>
          </template>
        </div>

        <div class="modal-foot">
          <button type="button" class="btn" @click="closeDialog">关闭</button>
          <button
            v-if="dialog === 'plan'"
            type="button"
            class="btn primary"
            :disabled="Boolean(activePlan?.chosen) || !canWrite"
            @click="activePlan && choosePlan(activePlan)"
          >{{ activePlan?.chosen ? '当前选定' : '设为选定' }}</button>
          <button
            v-else-if="dialog === 'version'"
            type="button"
            class="btn primary"
            :disabled="!canWrite"
            @click="activeVersion && editBrief(activeVersion)"
          >复制为新版本</button>
          <button
            v-else-if="dialog === 'gate'"
            type="button"
            class="btn"
            :class="{ primary: canConfirm }"
            :disabled="!gatePass || !canConfirm || submitting"
            @click="confirmBrief"
          >{{ submitting ? '交棒中…' : (canConfirm ? '确认并交棒' : '创意已冻结') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import DataTable from '../../../components/ui/DataTable.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'
import { creationApi } from '../../../services/creation'
import { projectApi } from '../../../services/projects'
import { useSessionStore } from '../../../stores/session'
import { useUiStore } from '../../../stores/ui'
import type { DialogField } from '../../../stores/ui'
import {
  audienceOptions,
  durationOptions,
  genreOptions,
  languageOptions,
  ratioOptions,
  styleOptions,
} from '../../workspace/components/projectOptions'

interface BriefRow {
  [key: string]: unknown
  id: string
  project: string
  version: string
  status: string
  note: string
  mode: string
  genre: string
  audience: string
  duration: string
  ratio: string
  language: string
  style: string
  constraints: string
  by: string
  at: string
  snapshotFallback?: boolean
}

interface PlanRow {
  [key: string]: unknown
  id: string
  project: string
  title: string
  selling: string
  theme: string
  hook: string
  risk: string
  score: number
  chosen: boolean
  mode?: string
  by?: string
  at?: string
}

interface ModeRow {
  [key: string]: unknown
  id: string
  mode: string
  input?: string
}

const props = defineProps<{
  project: Record<string, unknown> | null
  summary: Record<string, unknown> | null
}>()
const emit = defineEmits<{ (event: 'refresh'): void }>()

const session = useSessionStore()
const ui = useUiStore()
const canWrite = computed(() => session.can('creation.write'))
const projectId = computed(() => String(props.project?.id ?? ''))

const briefs = computed<BriefRow[]>(() => {
  const value = props.summary?.briefs
  return Array.isArray(value) ? value as BriefRow[] : []
})
const sortedBriefs = computed(() =>
  [...briefs.value].sort((a, b) => Number(String(b.version).replace(/\D/g, '')) - Number(String(a.version).replace(/\D/g, ''))),
)
const currentBrief = computed(() => sortedBriefs.value[0] ?? null)
const plans = computed<PlanRow[]>(() => {
  const value = props.summary?.creativePlans
  return Array.isArray(value) ? value as PlanRow[] : []
})
const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => Number(Boolean(b.chosen)) - Number(Boolean(a.chosen)) || Number(b.score) - Number(a.score)),
)
const chosenPlan = computed(() => plans.value.find((plan) => plan.chosen) ?? null)
const modes = computed<ModeRow[]>(() => {
  const value = props.summary?.briefModes
  return Array.isArray(value) ? value as ModeRow[] : []
})

function text(value: unknown): string {
  return String(value ?? '')
}
function projectField(key: string, fallback = '—'): string {
  return text(props.project?.[key] || fallback)
}

const baselineReady = computed(() => {
  const brief = currentBrief.value
  const project = props.project
  return ['genre', 'audience', 'duration', 'ratio', 'language', 'style', 'constraints']
    .every((key) => Boolean(brief?.[key] || project?.[key]))
})
const noteReady = computed(() => Boolean(currentBrief.value?.note?.trim()))
const candidatesReady = computed(() => plans.value.length >= 2)
const chosenReady = computed(() => Boolean(chosenPlan.value))
const versionReady = computed(() => Boolean(currentBrief.value && currentBrief.value.status !== '已作废'))

const gateChecks = computed(() => [
  { label: '输入基线完整', ok: baselineReady.value, detail: '题材、受众、时长、画幅、语言、风格与约束已固化' },
  { label: '创意说明已填写', ok: noteReady.value, detail: '主线、情绪与每集钩子可直接进入生成' },
  { label: '候选方向 ≥ 2', ok: candidatesReady.value, detail: `当前 ${plans.value.length} 个可对比方向` },
  { label: '恰好选定 1 个方案', ok: chosenReady.value, detail: chosenPlan.value?.title || '尚未选定，无法形成唯一基准' },
  { label: '当前版本可追溯', ok: versionReady.value, detail: currentBrief.value ? `${currentBrief.value.version} · ${currentBrief.value.status}` : '尚未保存简报版本' },
])
const gateDone = computed(() => gateChecks.value.filter((check) => check.ok).length)
const gatePass = computed(() => gateDone.value === 5)

const canConfirm = computed(() =>
  canWrite.value && String(props.project?.status ?? '').includes('创意策划中'),
)
const lockReason = computed(() => {
  if (!canWrite.value) return '当前身份没有创意写入权限，只能查看与追溯。'
  return `项目当前为「${projectField('status', '未知状态')}」，创意已冻结，不能再次交棒；如需重开，请先走项目状态回退。`
})

const flowSteps = computed(() => [
  { no: 1, title: '输入基线', desc: '题材 / 受众 / 画幅 / 语言 / 风格 / 约束', ok: baselineReady.value && noteReady.value },
  { no: 2, title: '生成方向', desc: '一次生成 2–4 个可对比方案', ok: candidatesReady.value },
  { no: 3, title: '选定方案', desc: '只保留 1 个下游基准', ok: chosenReady.value },
  { no: 4, title: '保存版本', desc: '每次编辑形成可追溯快照', ok: versionReady.value },
  { no: 5, title: '确认交棒', desc: '冻结创意并进入剧本创作', ok: briefs.value.some((brief) => brief.status === '已确认') },
])
const firstUndone = computed(() => flowSteps.value.find((step) => !step.ok)?.no ?? 0)
const flowStatus = computed(() => {
  if (canConfirm.value && gatePass.value) return '可交棒'
  if (briefs.value.some((brief) => brief.status === '已确认')) return '已完成'
  return `${gateDone.value}/5 已完成`
})

const kpis = computed(() => [
  { label: '候选方向', value: String(plans.value.length), hint: `${plans.value.length} 个可比方案` },
  { label: '选定方案', value: chosenPlan.value ? '1 / 1' : '0 / 1', hint: chosenPlan.value?.title || '尚未选定' },
  { label: '简报版本', value: String(briefs.value.length), hint: currentBrief.value ? `${currentBrief.value.version} · ${currentBrief.value.status}` : '未建立' },
  { label: '确认门禁', value: `${gateDone.value} / 5`, hint: gatePass.value ? (canConfirm.value ? '可交棒' : '已冻结') : `缺 ${5 - gateDone.value} 项` },
  { label: '项目状态', value: projectField('status', '—'), hint: canConfirm.value ? '创意策划中' : '只读 / 冻结' },
])

/* ------------------------------------------------------------------ *
 * 动态表单：编辑基线、生成候选
 * ------------------------------------------------------------------ */

function selectOptions(values: string[]) {
  return values.map((value) => ({ value, label: value }))
}

function briefFields(source?: BriefRow | null): DialogField[] {
  const proj = props.project ?? {}
  const brief = source ?? currentBrief.value
  return [
    { key: 'genre', label: '题材', type: 'select', options: selectOptions(genreOptions), value: text(brief?.genre || proj.genre), required: true },
    { key: 'audience', label: '目标受众', type: 'select', options: selectOptions(audienceOptions), value: text(brief?.audience || proj.audience), required: true },
    { key: 'duration', label: '单集时长', type: 'select', options: selectOptions(durationOptions), value: text(brief?.duration || proj.duration), required: true },
    { key: 'ratio', label: '画幅与分辨率', type: 'select', options: ratioOptions, value: text(brief?.ratio || proj.ratio), required: true },
    { key: 'language', label: '语言', type: 'select', options: selectOptions(languageOptions), value: text(brief?.language || proj.language), required: true },
    { key: 'style', label: '影像风格', type: 'select', options: selectOptions(styleOptions), value: text(brief?.style || proj.style), required: true },
    {
      key: 'mode',
      label: '输入方式',
      type: 'select',
      options: modes.value.map((row) => ({ value: row.mode, label: row.mode })),
      value: text(brief?.mode || modes.value[0]?.mode || '自由描述'),
      required: true,
      hint: '记录这份基线是自由描述、提纲扩写还是参考样片反推。',
    },
    {
      key: 'constraints',
      label: '内容约束与禁区',
      type: 'textarea',
      rows: 2,
      value: text(brief?.constraints || proj.constraints),
      required: true,
      full: true,
      hint: '写清不能出现的表达、必须保留的设定，以及平台审核红线。',
    },
    {
      key: 'note',
      label: '创意说明',
      type: 'textarea',
      rows: 4,
      value: text(brief?.note),
      required: true,
      full: true,
      placeholder: '主线、情绪、人物关系与每集钩子；这段说明会直接进入候选方向与剧本生成。',
    },
  ]
}

function editBrief(source?: BriefRow | null) {
  if (!canWrite.value || !props.project) return
  closeDialog()
  const isCopy = Boolean(source)
  ui.openDialog({
    title: isCopy ? `复制 ${source?.version} 为新版本` : '编辑创意输入',
    subtitle: canConfirm.value
      ? '保存会形成新的草稿版本，并同步项目基线；旧版本只读保留。'
      : '项目已离开创意阶段：保存会形成新版本并同步项目基线，但不会回滚已生成素材，也不会自动重新交棒。',
    wide: true,
    fields: briefFields(source),
    submitLabel: '保存为新版本',
    onSubmit: async (values) => {
      await creationApi.createBrief({
        project: projectId.value,
        ...values,
        status: '草稿',
      })
      ui.toast(isCopy ? `已从 ${source?.version} 复制新版本` : '已保存新的创意版本')
      emit('refresh')
    },
  })
}

function openGenerate() {
  if (!canWrite.value || !props.project) return
  ui.openDialog({
    title: '生成创意方向',
    subtitle: canConfirm.value
      ? '在现有基线上生成 2–4 个候选，不自动替换已选方案。'
      : '项目已进入生产：新增候选只用于复盘与后续重制，不会自动替换已选方案。',
    wide: true,
    fields: [
      {
        key: 'mode',
        label: '生成方式',
        type: 'select',
        options: modes.value.map((row) => ({ value: row.mode, label: row.mode })),
        value: currentBrief.value?.mode || modes.value[0]?.mode || '自由描述',
        required: true,
      },
      {
        key: 'count',
        label: '候选数量',
        type: 'select',
        options: [
          { value: '2', label: '2 个 · 快速对比' },
          { value: '3', label: '3 个 · 常规' },
          { value: '4', label: '4 个 · 充分发散' },
        ],
        value: '3',
        required: true,
      },
      {
        key: 'idea',
        label: '生成输入',
        type: 'textarea',
        rows: 5,
        value: currentBrief.value?.note || '',
        required: true,
        full: true,
        hint: '默认沿用当前创意说明；可临时改写做一次发散，不会覆盖基线文本。',
      },
    ],
    submitLabel: '生成候选',
    onSubmit: async (values) => {
      const created = await creationApi.generateCreativePlans({
        project: projectId.value,
        ...values,
        count: Number(values.count),
      })
      ui.toast(`已生成 ${created.length} 个候选方向，未自动选定`)
      emit('refresh')
    },
  })
}

/* ------------------------------------------------------------------ *
 * 方案详情 / 选定 / 版本详情 / 确认门禁
 * ------------------------------------------------------------------ */

const dialog = ref<'' | 'plan' | 'version' | 'gate'>('')
const activePlan = ref<PlanRow | null>(null)
const activeVersion = ref<BriefRow | null>(null)
const submitting = ref(false)
const modalRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let scrollLocked = false

const dialogTitle = computed(() => {
  if (dialog.value === 'plan') return '创意方向详情'
  if (dialog.value === 'version') return `简报版本 ${activeVersion.value?.version ?? ''}`
  return '确认创意方案'
})
const dialogSubtitle = computed(() => {
  if (dialog.value === 'plan') return activePlan.value?.id ?? ''
  if (dialog.value === 'version') return `${activeVersion.value?.by ?? '—'} · ${activeVersion.value?.at ?? '—'}`
  return '交棒前最后一次核对；确认后当前版本冻结，下游只读。'
})

function openPlan(plan: PlanRow) {
  activePlan.value = plan
  dialog.value = 'plan'
}
function openVersion(version: Record<string, unknown>) {
  const base = version as unknown as BriefRow
  const fallback: Array<keyof BriefRow> = ['genre', 'audience', 'duration', 'ratio', 'language', 'style', 'constraints']
  const filled = { ...base }
  let usedFallback = false
  for (const key of fallback) {
    if (!filled[key]) {
      ;(filled as unknown as Record<string, unknown>)[key] = String(props.project?.[key] ?? '')
      usedFallback = true
    }
  }
  filled.snapshotFallback = usedFallback
  activeVersion.value = filled
  dialog.value = 'version'
}
function openGate() {
  dialog.value = 'gate'
}
function closeDialog() {
  dialog.value = ''
  activePlan.value = null
  activeVersion.value = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !dialog.value) return
  event.preventDefault()
  closeDialog()
}
function releaseDialog() {
  window.removeEventListener('keydown', onKeydown)
  if (scrollLocked) {
    document.body.style.overflow = previousOverflow
    scrollLocked = false
  }
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

watch(dialog, async (value) => {
  if (!value) {
    releaseDialog()
    return
  }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  scrollLocked = true
  window.removeEventListener('keydown', onKeydown)
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  modalRef.value?.querySelector<HTMLElement>('.modal-foot .btn.primary, .modal-head .btn')?.focus()
})
onBeforeUnmount(releaseDialog)

async function choosePlan(plan: PlanRow) {
  if (!canWrite.value) {
    ui.toast('当前身份没有创意写入权限', 'bad')
    return
  }
  if (plan.chosen) return
  closeDialog()
  const confirmed = await ui.confirm(
    '选定这个创意方向？',
    canConfirm.value
      ? `「${plan.title}」将成为唯一选定方案；其他候选保留，确认创意方案时一并交棒。`
      : `项目已进入生产：改选只影响后续重制任务，不会改动已经生成的素材。确认将「${plan.title}」设为当前基准？`,
  )
  if (!confirmed) return
  try {
    await creationApi.selectCreativePlan(plan.id, projectId.value)
    ui.toast(`已选定「${plan.title}」`)
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '选定方案失败', 'bad')
  }
}

defineExpose({ openGate })

async function confirmBrief() {  if (!canConfirm.value || !gatePass.value || !currentBrief.value || submitting.value) return
  submitting.value = true
  const previousStatus = currentBrief.value.status
  try {
    await creationApi.updateBrief(currentBrief.value.id, { status: '已确认' })
    try {
      await projectApi.transition(projectId.value, 'confirmBrief')
    } catch (err) {
      await creationApi.updateBrief(currentBrief.value.id, { status: previousStatus })
      throw err
    }
    ui.toast('创意方案已确认，项目进入剧本创作')
    closeDialog()
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '确认创意方案失败', 'bad')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.brief-workspace { display: grid; gap: 14px; }
.stage-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px; margin: 0; }
.stage-kpi { min-width: 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); }
.stage-kpi span { display: block; color: var(--muted); font-size: 10px; }
.stage-kpi b { display: block; margin-top: 3px; color: var(--ink); font-size: 18px; line-height: 1.3; }
.stage-kpi small { display: block; margin-top: 2px; overflow: hidden; color: var(--faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.brief-flow-card { padding-bottom: 12px; }
.brief-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.brief-flow-step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 10px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  min-width: 0;
}
.brief-flow-step i {
  flex: none;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  font-style: normal;
  font-size: 11px;
  color: var(--text-3);
  background: var(--surface);
}
.brief-flow-step b { display: block; font-size: 12px; line-height: 1.3; }
.brief-flow-step small { display: block; margin-top: 3px; font-size: 10px; line-height: 1.35; color: var(--text-3); }
.brief-flow-step.done { border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
.brief-flow-step.done i { border-color: var(--ok); color: var(--ok); }
.brief-flow-step.now { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.brief-flow-step.now i { border-color: var(--accent); color: var(--accent); font-weight: 700; }

.brief-split { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.9fr); gap: 14px; align-items: start; }
.brief-note {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-left: 2px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.65;
}
.brief-empty-note { margin: 0 0 12px; padding: 12px; border: 1px dashed var(--line); border-radius: 8px; color: var(--text-3); font-size: 12px; }
.brief-kv :deep(b) { font-weight: 600; }
.brief-mode-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); }
.brief-mode-row .metric-label { margin-right: 2px; }

.brief-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.brief-checks li { display: flex; gap: 8px; align-items: flex-start; padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; }
.brief-checks li.ok { border-color: color-mix(in srgb, var(--ok) 28%, var(--line)); background: color-mix(in srgb, var(--ok) 5%, transparent); }
.brief-checks i { flex: none; display: grid; place-items: center; width: 17px; height: 17px; margin-top: 1px; border-radius: 50%; font-style: normal; font-size: 10px; color: var(--bad); border: 1px solid color-mix(in srgb, var(--bad) 55%, var(--line)); }
.brief-checks li.ok i { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 55%, var(--line)); }
.brief-checks b { display: block; font-size: 11px; line-height: 1.35; }
.brief-checks small { display: block; margin-top: 2px; font-size: 10px; line-height: 1.4; color: var(--text-3); }
.brief-gate-note { margin-top: 10px; padding: 8px 10px; border-radius: 7px; background: color-mix(in srgb, var(--ok) 7%, transparent); color: var(--text-2); font-size: 11px; line-height: 1.5; }
.brief-gate-note.bad { background: color-mix(in srgb, var(--warn) 9%, transparent); color: var(--text-2); }
.brief-gate-actions { display: flex; gap: 8px; margin-top: 10px; }
.brief-gate-actions .btn { flex: 1; justify-content: center; }

.brief-plan-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.brief-plan-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  min-width: 0;
}
.brief-plan-card:hover, .brief-plan-card:focus-visible { border-color: var(--line-strong); outline: none; }
.brief-plan-card.chosen { border-color: color-mix(in srgb, var(--accent) 58%, var(--line)); box-shadow: inset 2px 0 0 var(--accent); }
.brief-plan-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.brief-plan-head b { font-size: 13px; line-height: 1.35; }
.brief-plan-selling { margin: 0; color: var(--text-2); font-size: 11px; line-height: 1.55; }
.brief-plan-card .kv-lite { margin: 0; }
.brief-plan-card .kv-lite dd { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.brief-plan-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line); }
.brief-plan-foot .btn { padding: 4px 9px; font-size: 11px; }
.brief-empty { padding: 26px 16px; text-align: center; border: 1px dashed var(--line); border-radius: 8px; }
.brief-empty b { font-size: 13px; }
.brief-empty p { margin: 6px auto 12px; max-width: 480px; color: var(--text-3); font-size: 11px; line-height: 1.6; }

.brief-modal-body { max-height: 66vh; }
.brief-fallback { margin: -4px 0 12px; color: var(--warn); font-size: 10px; line-height: 1.5; }
.brief-plan-detail-head { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--line); }
.brief-plan-detail-head b { font-size: 20px; }
.brief-plan-detail-head small { color: var(--text-3); font-size: 11px; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.detail-grid > div { min-width: 0; }
.detail-grid .wide { grid-column: 1 / -1; }
.detail-grid b { display: block; margin-top: 3px; font-size: 12px; line-height: 1.55; font-weight: 600; }
.brief-gate-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 10px 12px; margin-bottom: 12px; border: 1px solid var(--line); border-radius: 8px; background: color-mix(in srgb, var(--surface) 60%, transparent); }
.brief-gate-summary b { display: block; margin-top: 3px; font-size: 12px; line-height: 1.4; }
.modal-checks { margin-bottom: 2px; }
.brief-modal-backdrop { z-index: 95; }
.brief-modal-backdrop .modal-foot .btn:disabled { opacity: 0.42; cursor: not-allowed; }

@media (max-width: 1380px) {
  .brief-split { grid-template-columns: minmax(0, 1fr); }
  .brief-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .brief-gate-actions .btn { flex: 0 1 auto; }
}
@media (max-width: 1120px) {
  .brief-flow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .brief-plan-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
