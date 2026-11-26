<template>
  <section class="page">
    <PageHeader kicker="DIRECTOR / SHOTS" title="镜头契约" desc="镜头是下游生产的最小契约单元：画面、人物引用、台词、时长与质检项必须齐全才能派发。">
      <HeadActions>
        <button class="btn" @click="$router.push('/director/plan')">镜头计划</button>
        <button class="btn" @click="$router.push('/video/production')">视频生产队列</button>
        <button class="btn primary" v-if="session.can('production.write')" @click="batchSubmit">批量提交生成</button>
      </HeadActions>
    </PageHeader>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <select v-model="query.ep" class="filter">
        <option value="">全部集</option>
        <option v-for="item in episodes" :key="item" :value="item">第 {{ item }} 集</option>
      </select>
      <input v-model="search" class="search" placeholder="搜索镜号 / 画面 / 台词" />
      <span class="filter-count">{{ visible.length }} / {{ shots.length }} 个镜头</span>
      <span class="grow"></span>
      <span class="card-sub">宽表默认只取 60 条；筛选后按需加载</span>
    </div>

    <div class="shot-grid-lite">
      <div v-for="shot in visible" :key="shot.id" class="shot-card-lite" @click="open(shot)" style="cursor: pointer">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span class="no">E{{ shot.ep }} · {{ shot.no }}</span>
          <StatusPill :status="shot.status" />
        </div>
        <div class="desc">{{ shot.desc }}</div>
        <div v-if="shot.line" class="card-sub" style="font-size: 11px">{{ shot.line }}</div>
        <div class="meta">
          <span class="tag">{{ shot.frame }}</span>
          <span class="tag">{{ shot.duration }}</span>
          <span class="tag">{{ shot.chars }}</span>
        </div>
      </div>
      <EmptyState
        v-if="!visible.length"
        title="没有符合条件的镜头"
        desc="调整集数或搜索条件；若项目尚未拆解，请先完成剧本拆解。"
        icon="▤"
        style="grid-column: 1/-1"
      />
    </div>

    <AppDrawer :open="!!selected" :title="selected ? `E${selected.ep} · ${selected.no}` : ''" :subtitle="selected?.id" @close="selected = null">
      <div v-if="selected" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn primary" v-if="session.can('production.write')" @click="submitOne(selected)">提交生成</button>
          <button class="btn" @click="copyId(selected)">复制镜头 ID</button>
        </div>
        <dl class="kv-lite">
          <dt>画面</dt><dd>{{ selected.desc }}</dd>
          <dt>景别 / 机位 / 运镜</dt><dd>{{ selected.frame }} / {{ selected.angle }} / {{ selected.move }}</dd>
          <dt>镜头语言</dt><dd>{{ selected.lens }}</dd>
          <dt>人物</dt><dd>{{ selected.chars }}</dd>
          <dt>情绪</dt><dd>{{ selected.emotion }}</dd>
          <dt>台词</dt><dd>{{ selected.line || '—' }}</dd>
          <dt>声音</dt><dd>{{ selected.voice }}</dd>
          <dt>时长</dt><dd>{{ selected.duration }}</dd>
          <dt>引用资产</dt><dd>{{ selected.refs }}</dd>
          <dt>模型</dt><dd>{{ selected.model }}</dd>
          <dt>质检项</dt><dd>{{ selected.quality }}</dd>
          <dt>版本</dt><dd>{{ selected.version }}</dd>
        </dl>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { directorApi } from '../../services/director'
import { useTableQuery } from '../../composables/useTableQuery'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const shots = ref<Row[]>([])
const selected = ref<Row | null>(null)
const { search, filters: query, visible } = useTableQuery(shots, {
  search: (row) => `${row.no}${row.desc}${row.line}${row.id}`,
  filter: (row, filters) => !filters.ep || String(row.ep) === filters.ep,
})

const episodes = computed(() => [...new Set(shots.value.map((row) => Number(row.ep)))].sort((a, b) => a - b))

async function load() {
  const result = await directorApi.shots(projectStore.currentId)
  shots.value = result.rows
}

function open(row: Row) {
  selected.value = row
}

async function submitOne(row: Row) {
  await directorApi.createTask({
    project: projectStore.currentId,
    ep: row.ep,
    scene: row.scene,
    shot: row.no,
    kind: '视频生成',
    model: row.model,
    input: row.refs,
    output: 'MP4 1080×1920',
    est: parseInt(String(row.duration), 10) * 6 || 30,
  })
  ui.toast(`镜头 ${row.no} 已提交生成`)
  selected.value = null
}

async function batchSubmit() {
  const yes = await ui.confirm('批量提交生成', `将为当前筛选出的 ${visible.value.length} 个镜头创建生成任务（每个镜头独立任务，可单独重试）。`)
  if (!yes) return
  for (const row of visible.value.slice(0, 10)) {
    await directorApi.createTask({ project: projectStore.currentId, ep: row.ep, scene: row.scene, shot: row.no, kind: '视频生成', model: row.model, input: row.refs })
  }
  ui.toast(`已提交 ${Math.min(10, visible.value.length)} 个镜头任务（mock 限额 10）`)
}

function copyId(row: Row) {
  navigator.clipboard?.writeText(String(row.id)).then(() => ui.toast('已复制镜头 ID'), () => ui.toast('复制失败', 'bad'))
}

watch(() => projectStore.currentId, load)
onMounted(load)
</script>
