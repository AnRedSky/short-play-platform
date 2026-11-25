<template>
  <section class="page">
    <PageHeader kicker="CREATION / SCRIPT" title="剧本版本" desc="正式版本锁定后为下游唯一基准；修改必须新建版本，历史版本不可覆盖。">
      <HeadActions>
        <button class="btn" v-if="session.can('creation.write')" @click="createVersion">新建版本</button>
        <button class="btn" @click="$router.push('/creation/review')">去剧本审核</button>
        <button class="btn primary" v-if="canSubmit" @click="submitReview">提交剧本审核</button>
      </HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr)">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">{{ selected?.id || '未选择版本' }}</h3>
              <p class="card-sub">{{ selected?.version }} · {{ selected?.status }}</p>
            </div>
            <StatusPill :status="selected?.status" />
          </div>
          <div class="grid grid-4">
            <div class="mini-kpi"><small>集数</small><b>{{ selected?.episodes ?? '—' }}</b></div>
            <div class="mini-kpi"><small>场次</small><b>{{ selected?.scenes ?? '—' }}</b></div>
            <div class="mini-kpi"><small>镜头</small><b>{{ selected?.shots ?? '—' }}</b></div>
            <div class="mini-kpi"><small>台词</small><b>{{ selected?.lines ?? '—' }}</b></div>
          </div>
          <p class="muted" style="margin-top: 10px; font-size: 12px">{{ selected?.note }}</p>
          <div class="btn-group" style="margin-top: 10px">
            <button class="btn" @click="$router.push('/creation/breakdown')">查看拆解</button>
            <button class="btn" @click="$router.push('/director/shots')">镜头契约</button>
            <button class="btn" v-if="session.can('script.review')" @click="$router.push('/creation/review')">审核</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">版本链</h3><span class="card-sub">点击切换查看</span></div>
          <DataTable :columns="columns" :rows="versions" row-key="id" clickable @row-click="select">
            <template #actions="{ row }">
              <button class="link-btn" @click="select(row)">查看</button>
            </template>
          </DataTable>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">版本差异</h3></div>
          <div v-for="diff in diffs" :key="diff.version" class="diff-row">
            <b>{{ diff.version }} · {{ diff.change }}</b>
            <p>{{ diff.detail }}（{{ diff.scenes }} 场 / {{ diff.lines }} 行）</p>
          </div>
          <div v-if="!diffs.length" class="empty">暂无版本差异记录</div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">锁定规则</h3></div>
          <div class="checklist">
            <div class="ck"><i class="on">✓</i><span>审核通过即锁定，成为下游唯一基准</span></div>
            <div class="ck"><i class="on">✓</i><span>修改必须新建版本</span></div>
            <div class="ck"><i class="on">✓</i><span>拆解与镜头引用锁定版本</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">创作口径</h3></div>
          <dl class="kv-lite">
            <dt>素材来源</dt><dd>{{ projectStore.current?.scriptVersion || '—' }}</dd>
            <dt>风格</dt><dd>{{ projectStore.current?.style }}</dd>
            <dt>约束</dt><dd>{{ projectStore.current?.constraints }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const versions = ref<Row[]>([])
const diffs = ref<Row[]>([])
const selected = ref<Row | null>(null)

const columns: Column[] = [
  { key: 'id', label: '版本编号', mono: true },
  { key: 'version', label: '版本' },
  { key: 'status', label: '状态', pill: true },
  { key: 'by', label: '创建人' },
  { key: 'at', label: '时间', mono: true },
]

const canSubmit = computed(() => session.can('creation.write') && projectStore.current?.status === '剧本创作中')

function select(row: Row) {
  selected.value = row
}

async function load() {
  const [scriptRows, diffRows] = await Promise.all([
    http.list<Row>('/scripts', { project: projectStore.currentId }),
    http.list<Row>('/script-diffs'),
  ])
  versions.value = scriptRows.rows
  selected.value = scriptRows.rows[0] ?? null
  diffs.value = diffRows.rows
}

function createVersion() {
  ui.openDialog({
    title: '新建剧本版本',
    subtitle: '新版本从当前锁定版本派生，不覆盖历史。',
    fields: [
      { key: 'version', label: '版本号', required: true, placeholder: 'v5' },
      { key: 'note', label: '修改说明', type: 'textarea', required: true },
    ],
    submitLabel: '创建版本',
    onSubmit: async (values) => {
      const base = selected.value
      await http.post('/scripts', {
        project: projectStore.currentId,
        version: values.version,
        status: '创作中',
        episodes: base?.episodes,
        scenes: base?.scenes,
        shots: base?.shots,
        lines: base?.lines,
        by: session.shortName,
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        note: values.note,
        locked: false,
      })
      ui.toast('新版本已创建')
      await load()
    },
  })
}

async function submitReview() {
  const yes = await ui.confirm('提交剧本审核', '项目将进入「待剧本审核」，由具备 script.review 权限的审核人裁决。')
  if (!yes) return
  await http.post(`/projects/${projectStore.currentId}/transitions`, { action: 'submitScript' })
  ui.toast('已提交剧本审核')
  await projectStore.load()
}

onMounted(load)
</script>
