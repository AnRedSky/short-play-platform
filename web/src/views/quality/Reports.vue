<template>
  <section class="page">
    <PageHeader kicker="QUALITY / REPORTS" title="质量报告" desc="质检是独立检测能力，不由生成模型自评；阻断项未清零不得进入终审。">
      <HeadActions>
        <button class="btn" @click="$router.push('/quality/rework')">返工台账</button>
        <button class="btn primary" v-if="session.can('quality.operate')" @click="runCheck">执行质检</button>
      </HeadActions>
    </PageHeader>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <select v-model="level" class="filter">
        <option value="">全部级别</option>
        <option v-for="item in levels" :key="item" :value="item">{{ item }}</option>
      </select>
      <span class="filter-count">{{ visible.length }} 份报告</span>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr)">
      <div class="card">
        <div class="card-head"><h3 class="card-title">报告</h3><span class="card-sub">点击行查看问题项</span></div>
        <DataTable :columns="columns" :rows="visible" row-key="id" clickable @row-click="pick">
          <template #actions="{ row }">
            <button class="link-btn" @click="pick(row)">问题项</button>
          </template>
        </DataTable>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">问题项</h3><span class="pill warn">{{ issues.length }}</span></div>
          <div v-for="issue in issues" :key="issue.report + issue.where" class="list-row">
            <span class="k">{{ issue.dim }} · {{ issue.where }}</span>
            <span class="v"><StatusPill :status="issue.level" /> {{ issue.action }}</span>
          </div>
          <div v-if="!issues.length" class="empty">该报告无问题项</div>
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
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { http } from '../../api/client'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const reports = ref<Row[]>([])
const issues = ref<Row[]>([])
const levelRows = ref<Row[]>([])
const level = ref('')

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

async function load() {
  const [reportRows, issueRows, levelList] = await Promise.all([
    http.list<Row>('/quality-reports', { limit: 60 }),
    http.list<Row>('/quality-issues'),
    http.list<Row>('/quality-levels'),
  ])
  reports.value = reportRows.rows
  levelRows.value = levelList.rows
  issues.value = issueRows.rows.filter((row) => row.report === reportRows.rows[0]?.id)
}

function pick(row: Row) {
  http.list<Row>('/quality-issues').then((result) => {
    issues.value = result.rows.filter((issue) => issue.report === row.id)
    ui.toast(`已载入 ${row.id} 的问题项`)
  })
}

async function runCheck() {
  const yes = await ui.confirm('执行质检', '按单集级规则检测当前项目最新成片；阻断项会退回后期。')
  if (!yes) return
  await http.post('/quality/run', { project: projectStore.currentId, level: '单集级', version: 'EP17 v1' })
  ui.toast('质检已执行，报告已写入')
  await load()
}

watch(level, () => undefined)
onMounted(load)
</script>
