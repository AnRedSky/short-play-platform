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
          <div class="card-head"><h3 class="card-title">版本链</h3><span class="card-sub">点击查看版本详情</span></div>
          <DataTable :columns="columns" :rows="versions" row-key="id" clickable @row-click="openVersion">
            <template #actions="{ row }">
              <button class="link-btn" @click="openVersion(row)">详情</button>
            </template>
          </DataTable>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">版本差异</h3></div>
          <div v-for="diff in diffs" :key="diff.version" class="diff-row">
            <b>{{ diff.version }} · {{ diff.change }}</b>
            <p>{{ diff.detail }}（{{ diff.scenes }} 场 / {{ diff.lines }} 行）</p>
          </div>
          <EmptyState v-if="!diffs.length" title="暂无版本差异" desc="创建新版本后，逐场与逐行差异会显示在这里。" compact />
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

    <AppDrawer
      :open="panel.isOpen.value"
      title="剧本版本详情"
      :subtitle="activeVersion ? `${activeVersion.id} · ${activeVersion.version}` : '未找到该版本'"
      @close="panel.close"
    >
      <template v-if="activeVersion">
        <div class="grid grid-4">
          <div class="mini-kpi"><small>集数</small><b>{{ activeVersion.episodes ?? '—' }}</b></div>
          <div class="mini-kpi"><small>场次</small><b>{{ activeVersion.scenes ?? '—' }}</b></div>
          <div class="mini-kpi"><small>镜头</small><b>{{ activeVersion.shots ?? '—' }}</b></div>
          <div class="mini-kpi"><small>台词</small><b>{{ activeVersion.lines ?? '—' }}</b></div>
        </div>
        <dl class="kv-lite">
          <dt>状态</dt><dd><StatusPill :status="activeVersion.status" /></dd>
          <dt>创建人</dt><dd>{{ activeVersion.by || '—' }}</dd>
          <dt>创建时间</dt><dd>{{ activeVersion.at || '—' }}</dd>
          <dt>锁定</dt><dd>{{ activeVersion.locked ? '已锁定 · 下游唯一基准' : '未锁定' }}</dd>
          <dt>修改说明</dt><dd>{{ activeVersion.note || '—' }}</dd>
        </dl>
      </template>
      <p v-else class="muted">记录不存在：链接中的版本可能已删除，或不属于当前项目。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { creationApi } from '../../../services/creation'
import { projectApi } from '../../../services/projects'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const versions = ref<Row[]>([])
const diffs = ref<Row[]>([])
const selected = ref<Row | null>(null)
const panel = useRoutePanel('creation-script-version')
const activeVersion = computed(() => {
  if (!panel.activeId.value) return null
  return versions.value.find((row) => String(row.id) === panel.activeId.value) ?? null
})

const columns: Column[] = [
  { key: 'id', label: '版本编号', mono: true },
  { key: 'version', label: '版本' },
  { key: 'status', label: '状态', pill: true },
  { key: 'by', label: '创建人' },
  { key: 'at', label: '时间', mono: true },
]

const canSubmit = computed(() => session.can('creation.write') && projectStore.current?.status === '剧本创作中')

function openVersion(row: Row) {
  panel.open(String(row.id ?? ''))
}

async function load() {
  const [scriptRows, diffRows] = await Promise.all([
    creationApi.scripts(projectStore.currentId),
    creationApi.scriptDiffs(),
  ])
  versions.value = scriptRows.rows
  selected.value = scriptRows.rows.find((row) => row.locked) ?? scriptRows.rows[0] ?? null
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
      await creationApi.createScript({
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
  await projectApi.transition(projectStore.currentId, 'submitScript')
  ui.toast('已提交剧本审核')
  await projectStore.load()
}

watch(() => projectStore.currentId, () => {
  if (panel.isOpen.value) panel.close()
  load()
})

onMounted(load)
</script>
