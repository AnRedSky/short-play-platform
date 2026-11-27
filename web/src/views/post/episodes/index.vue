<template>
  <section class="page">
    <PageHeader kicker="POST / EPISODES" title="分集成片" desc="每集成片独立质检与输出；分集状态汇总为整剧交付条件。">
      <HeadActions>
        <button class="btn" @click="$router.push('/post/timeline')">时间线</button>
        <button class="btn primary" v-if="session.can('post.write')" @click="outputAll">批量输出</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '分集数', value: episodes.length },
      { label: '已通过质检', value: episodes.filter(e => e.qc === 'PASS').length },
      { label: '待输出', value: episodes.filter(e => e.status !== '已输出').length },
      { label: '时长合计', value: Math.round(episodes.length * 1.5) + ' 分钟' },
    ]" />

    <div style="margin-top: 18px">
      <DataTable :columns="columns" :rows="episodes" row-key="id" wide clickable @row-click="open">
        <template #actions="{ row }">
          <button class="link-btn" @click="output(row)">输出</button>
          <button class="link-btn" @click="qc(row)">质检</button>
          <button class="link-btn" @click="openTimeline(row)">时间线</button>
          <button class="link-btn" @click="open(row)">详情</button>
        </template>
      </DataTable>
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeEpisode ? `第 ${activeEpisode.no} 集 · ${activeEpisode.title}` : '分集成片详情'"
      :subtitle="activeEpisode?.status || '未找到该分集'"
      @close="panel.close"
    >
      <div v-if="activeEpisode" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn primary" @click="output(activeEpisode)">输出成片</button>
          <button class="btn" @click="qc(activeEpisode)">提交质检</button>
          <button class="btn" @click="openTimeline(activeEpisode)">查看时间线</button>
        </div>
        <dl class="kv-lite">
          <dt>项目 / 集</dt><dd>{{ projectStore.currentId }} · 第 {{ activeEpisode.no }} 集</dd>
          <dt>标题</dt><dd>{{ activeEpisode.title }}</dd>
          <dt>场次 / 镜头</dt><dd>{{ activeEpisode.scenes }} 场 / {{ activeEpisode.shots }} 镜</dd>
          <dt>时长</dt><dd>{{ activeEpisode.duration }}</dd>
          <dt>时间线</dt><dd>{{ timelineFor(activeEpisode)?.version || activeEpisode.timeline || '未关联' }}</dd>
          <dt>质检</dt><dd>{{ activeEpisode.qc }}</dd>
          <dt>状态</dt><dd>{{ activeEpisode.status }}</dd>
        </dl>
        <div class="notice">
          输出前要求质检通过、时间线无过期片段且项目预算未用尽；已输出分集不会被重复覆盖。
        </div>
      </div>
      <p v-else class="muted">记录不存在：链接中的分集可能已删除，或不属于当前项目。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { postApi } from '../../../services/post'
import { useProjectScope } from '../../../composables/useProjectScope'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import {
  batchOutputBlockReason,
  episodeOutputBlockReason,
  findEpisodeTimeline,
  timelineQcBlockReason,
} from '../../../composables/postGate'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import { useRouter } from 'vue-router'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const { projectId } = useProjectScope(load)
const ui = useUiStore()
const router = useRouter()

const episodes = ref<Row[]>([])
const timelines = ref<Row[]>([])
const panel = useRoutePanel('post-episode')
const activeEpisode = computed(() => episodes.value.find((row) => String(row.id) === panel.activeId.value) ?? null)

const columns: Column[] = [
  { key: 'no', label: '集' },
  { key: 'title', label: '标题' },
  { key: 'scenes', label: '场次' },
  { key: 'shots', label: '镜头' },
  { key: 'duration', label: '时长' },
  { key: 'timeline', label: '时间线', mono: true, format: (row) => timelineFor(row)?.version || row.timeline || '—' },
  { key: 'qc', label: '质检', pill: true },
  { key: 'status', label: '状态', pill: true },
]

async function load() {
  const [episodeRows, timelineRows] = await Promise.all([
    postApi.episodes(projectId.value),
    postApi.timelines(projectId.value),
  ])
  episodes.value = episodeRows.rows.map((row, index) => ({ ...row, no: row.no ?? index + 1 }))
  timelines.value = timelineRows.rows
}

function open(row: Row) {
  panel.open(String(row.id ?? ''))
}

function timelineFor(row: Row) {
  return findEpisodeTimeline(row, timelines.value)
}

async function output(row: Row) {
  const blocked = episodeOutputBlockReason(row, timelineFor(row), projectStore.current)
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  const yes = await ui.confirm(
    '输出第 ' + row.no + ' 集成片',
    `将按 ${timelineFor(row)?.version || row.timeline || '当前时间线'} 生成第 ${row.no} 集成片，已有输出不会被覆盖；失败可回到时间线重新合成。`,
  )
  if (!yes) return
  await postApi.outputEpisode(projectId.value, String(row.no))
  ui.toast(`第 ${row.no} 集已输出`)
  await load()
}

async function qc(row: Row) {
  const timeline = timelineFor(row)
  const blocked = timelineQcBlockReason(timeline)
  if (blocked) {
    ui.toast(`第 ${row.no} 集${blocked}`, 'bad')
    return
  }
  const yes = await ui.confirm(
    '提交第 ' + row.no + ' 集质检',
    `将按 ${timeline?.version} 执行单集质检，检查画质、音画同步与字幕时基；存在阻断项时会退回后期。`,
  )
  if (!yes) return
  await postApi.runQuality({ project: projectId.value, ep: row.no, version: timeline?.version, level: '单集级' })
  ui.toast(`第 ${row.no} 集质检已提交`)
  await load()
}

async function outputAll() {
  const blocked = batchOutputBlockReason(episodes.value, timelines.value, projectStore.current)
  if (blocked) {
    ui.toast(`批量输出被阻断：${blocked}`, 'bad')
    return
  }
  const pending = episodes.value.filter((row) => row.status !== '已输出')
  const yes = await ui.confirm(
    '批量输出',
    `将输出当前项目 ${pending.length} 个未输出分集，共 ${projectStore.current?.episodes ?? pending.length} 集项目口径；成片生成后不可回退，失败可逐集重新输出。`,
    true,
  )
  if (!yes) return
  for (const row of pending) await postApi.outputEpisode(projectId.value, String(row.no))
  ui.toast(`已输出 ${pending.length} 集，未输出分集已清零`)
  await load()
}

function openTimeline(row: Row) {
  router.push({ path: '/post/timeline', query: { ep: String(row.no) } })
}

onMounted(load)
</script>
