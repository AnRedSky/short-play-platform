<template>
  <section class="page">
    <PageHeader kicker="QUALITY / REPORTS" title="质量报告" desc="质检是独立检测能力，不由生成模型自评；阻断项未清零不得进入终审。">
      <HeadActions>
        <button class="btn" @click="$router.push('/quality/rework')">返工台账</button>
        <button class="btn primary" v-if="session.can('quality.operate')" @click="runCheck">执行质检</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '报告', value: reports.length },
      { label: '通过', value: reports.filter(row => row.result === 'PASS').length },
      { label: '待复核', value: reports.filter(row => row.result === 'REVIEW_REQUIRED').length },
      { label: '阻断', value: reports.filter(row => row.result === 'FAIL').length },
    ]" />

    <div class="toolbar act-bar" style="margin: 14px 0">
      <select v-model="level" class="filter">
        <option value="">全部级别</option>
        <option v-for="item in levels" :key="item" :value="item">{{ item }}</option>
      </select>
      <span class="filter-count">{{ visible.length }} 份报告</span>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr)">
      <div class="card">
        <div class="card-head"><h3 class="card-title">报告</h3><span class="card-sub">点击行查看报告详情与问题项</span></div>
        <DataTable :columns="columns" :rows="visible" row-key="id" clickable @row-click="open">
          <template #actions="{ row }">
            <button class="link-btn" @click="open(row)">详情</button>
          </template>
        </DataTable>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">问题项</h3>
            <span class="pill warn">{{ focusIssues.length }}</span>
          </div>
          <p class="card-sub" style="margin-bottom: 8px">{{ focusReport?.id || '未选择报告' }} · 高风险 {{ focusHigh.length }} 项</p>
          <div v-for="issue in focusIssues" :key="issue.report + issue.dim + issue.where" class="list-row">
            <span class="k">{{ issue.dim }} · {{ issue.where }}</span>
            <span class="v"><StatusPill :status="issueRiskLabel(issue)" /> {{ issueStatus(issue) }}</span>
            <p class="muted" style="grid-column: 1 / -1; margin: 4px 0 0">{{ issue.action }}</p>
          </div>
          <EmptyState v-if="!focusIssues.length" title="本报告无问题项" desc="全部阻断项检查通过，可进入终审。" compact />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">检测层级</h3></div>
          <div v-for="row in levelRows" :key="row.level" class="list-row">
            <span class="k">{{ row.level }}</span>
            <span class="v">{{ row.object }}</span>
          </div>
        </div>
      </aside>
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeReport ? `${activeReport.id} · ${activeReport.object}` : '质检报告详情'"
      :subtitle="activeReport ? `${activeReport.level} · ${activeReport.version}` : '未找到该报告'"
      @close="panel.close"
    >
      <div v-if="activeReport" style="display: grid; gap: 12px">
        <dl class="kv-lite">
          <dt>报告</dt><dd>{{ activeReport.id }}</dd>
          <dt>检测对象</dt><dd>{{ activeReport.object }}</dd>
          <dt>检测层级</dt><dd>{{ activeReport.level }}</dd>
          <dt>版本</dt><dd>{{ activeReport.version }}</dd>
          <dt>结论</dt><dd><StatusPill :status="activeReport.result" /></dd>
          <dt>检查项</dt><dd>{{ activeReport.items }}</dd>
          <dt>问题 / 待复核 / 阻断</dt><dd>{{ activeReport.issues }} / {{ activeReport.review }} / {{ activeReport.fail }}</dd>
          <dt>检测能力</dt><dd>{{ activeReport.engine }}</dd>
          <dt>执行时间</dt><dd>{{ activeReport.at }}</dd>
          <dt v-if="activeReport.acceptedBy">确认人</dt><dd v-if="activeReport.acceptedBy">{{ activeReport.acceptedBy }}</dd>
          <dt v-if="activeReport.acceptedAt">确认时间</dt><dd v-if="activeReport.acceptedAt">{{ activeReport.acceptedAt }}</dd>
          <dt>说明</dt><dd>{{ activeReport.note || '—' }}</dd>
        </dl>

        <div class="card" style="box-shadow: none; border: 1px solid var(--line)">
          <div class="card-head">
            <h3 class="card-title">问题项</h3>
            <span class="pill" :class="activeHigh.length ? 'bad' : 'ok'">高风险 {{ activeHigh.length }}</span>
          </div>
          <div v-for="issue in activeIssues" :key="issue.report + issue.dim + issue.where" class="list-row">
            <span class="k">{{ issue.dim }} · {{ issue.where }}</span>
            <span class="v"><StatusPill :status="issueRiskLabel(issue)" /> {{ issueStatus(issue) }}</span>
            <p class="muted" style="grid-column: 1 / -1; margin: 4px 0 0">建议：{{ issue.action }}；自动处理：{{ issue.auto === '是' ? '是' : '否' }}</p>
          </div>
          <EmptyState v-if="!activeIssues.length" title="无问题项" desc="质检未记录阻断或待复核项。" compact />
        </div>

        <div v-if="activeReport.result !== 'PASS'" class="notice" :class="activePassBlock ? 'warn' : ''">
          {{ activePassBlock || '高风险项已清零，可填写确认说明后人工通过。' }}
        </div>
        <div v-else class="notice">该报告已通过，高风险项与阻断项均已闭环。</div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <button
            v-if="session.can('quality.operate') && activeReport.result !== 'PASS'"
            class="btn primary"
            @click="accept(activeReport)"
          >确认通过</button>
          <button class="btn" @click="$router.push('/quality/rework')">去返工台账</button>
        </div>
      </div>
      <p v-else class="muted">报告不存在：链接中的报告可能已被删除。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { qualityApi } from '../../services/quality'
import { useRoutePanel } from '../../composables/useRoutePanel'
import {
  highRiskIssues,
  issueStatus,
  qualityRunBlockReason,
  reportPassBlockReason,
} from '../../composables/qualityGate'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const reports = ref<Row[]>([])
const allIssues = ref<Row[]>([])
const levelRows = ref<Row[]>([])
const level = ref('')
const selectedId = ref('')
const panel = useRoutePanel('quality-report')

const columns: Column[] = [
  { key: 'id', label: '报告', mono: true },
  { key: 'object', label: '对象' },
  { key: 'level', label: '级别' },
  { key: 'version', label: '版本' },
  { key: 'result', label: '结论', pill: true },
  { key: 'items', label: '检查项' },
  { key: 'issues', label: '问题' },
  { key: 'at', label: '时间', mono: true },
]

const levels = computed(() => [...new Set(reports.value.map((row) => String(row.level)))])
const visible = computed(() => reports.value.filter((row) => !level.value || row.level === level.value))
const activeReport = computed(() => reports.value.find((row) => String(row.id) === panel.activeId.value) ?? null)
const activeIssues = computed(() => allIssues.value.filter((row) => row.report === panel.activeId.value))
const activeHigh = computed(() => highRiskIssues(activeIssues.value))
const activePassBlock = computed(() => (
  activeReport.value ? reportPassBlockReason(activeReport.value, activeIssues.value) : ''
))
const focusId = computed(() => panel.activeId.value || selectedId.value || String(reports.value[0]?.id ?? ''))
const focusReport = computed(() => reports.value.find((row) => String(row.id) === focusId.value) ?? null)
const focusIssues = computed(() => allIssues.value.filter((row) => row.report === focusId.value))
const focusHigh = computed(() => highRiskIssues(focusIssues.value))

function issueRiskLabel(issue: Row): string {
  const risk = String(issue.level ?? '')
  return risk ? `${risk}风险` : '风险'
}

async function load() {
  const [reportRows, issueRows, levelList] = await Promise.all([
    qualityApi.reports(),
    qualityApi.issues(),
    qualityApi.levels(),
  ])
  reports.value = reportRows.rows
  allIssues.value = issueRows.rows
  levelRows.value = levelList.rows
  if (!reports.value.some((row) => String(row.id) === selectedId.value)) {
    selectedId.value = String(reports.value[0]?.id ?? '')
  }
}

function open(row: Row) {
  selectedId.value = String(row.id ?? '')
  panel.open(selectedId.value)
}

function accept(report: Row) {
  const blocked = reportPassBlockReason(report, allIssues.value.filter((row) => row.report === report.id))
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  ui.openDialog({
    title: '确认报告通过',
    subtitle: `${report.id} · ${report.object}`,
    fields: [
      {
        key: 'note',
        label: '确认说明',
        type: 'textarea',
        required: true,
        rows: 3,
        placeholder: '说明已核对的问题项、放行依据与后续观察点',
      },
    ],
    submitLabel: '确认通过',
    onSubmit: async (values) => {
      const current = reports.value.find((row) => row.id === report.id)
      const reason = reportPassBlockReason(current, allIssues.value.filter((row) => row.report === report.id))
      if (reason) throw new Error(reason)
      await qualityApi.acceptReport(String(report.id), { note: values.note })
      ui.toast('报告已确认通过')
      await load()
    },
  })
}

function runCheck() {
  const project = projectStore.current
  const blocked = qualityRunBlockReason(project)
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  const nextEp = Number(project?.done ?? 0) + 1
  ui.openDialog({
    title: '执行质检',
    subtitle: `${project?.id} · ${project?.name}；质检独立于生成模型，阻断项会退回后期。`,
    wide: true,
    fields: [
      { key: 'level', label: '检测层级', type: 'select', options: ['镜头级', '单集级', '整剧级', '资产级'].map((value) => ({ value, label: value })), value: '单集级' },
      { key: 'object', label: '检测对象', required: true, value: `${project?.id} / 第 ${nextEp} 集成片` },
      { key: 'version', label: '版本', required: true, value: `EP${nextEp} v1` },
      { key: 'note', label: '执行说明', type: 'textarea', rows: 3, placeholder: '可选：说明抽检范围或重点复核项' },
    ],
    submitLabel: '执行质检',
    onSubmit: async (values) => {
      const reason = qualityRunBlockReason(projectStore.current)
      if (reason) throw new Error(reason)
      await qualityApi.run({
        project: projectStore.currentId,
        level: values.level,
        object: values.object,
        version: values.version,
        note: values.note,
      })
      ui.toast('质检已执行，报告已写入')
      await load()
    },
  })
}

watch(() => projectStore.currentId, () => {
  if (panel.isOpen.value) panel.close()
  load()
})
onMounted(load)
</script>
