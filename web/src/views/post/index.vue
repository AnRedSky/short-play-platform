<template>
  <section class="page">
    <PageHeader kicker="POST / TIMELINE" title="时间线与剪辑" desc="时间线是分集成片的唯一合成口径：轨道、片段与时基必须可复现。">
      <HeadActions>
        <button class="btn" @click="$router.push('/post/episodes')">分集成片</button>
        <button class="btn primary" v-if="session.can('post.write')" @click="submitQc()">提交质量检测</button>
      </HeadActions>
    </PageHeader>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <select v-model="ep" class="filter" @change="loadTimeline">
        <option v-for="item in episodes" :key="item.ep" :value="item.ep">第 {{ item.ep }} 集 · {{ item.version }}</option>
      </select>
      <span class="filter-count">{{ timeline?.status }} · {{ timeline?.duration }} · 轨 {{ timeline?.tracks }}</span>
    </div>

    <div class="card" style="margin-bottom: 14px">
      <div class="card-head">
        <div>
          <h3 class="card-title">轨道视图</h3>
          <p class="card-sub">片段宽度按镜头时长比例渲染；白色片段表示待重生成。</p>
        </div>
        <span class="pill" :class="timeline?.stale ? 'warn' : 'ok'">{{ timeline?.stale ? '存在过期片段' : '全部最新' }}</span>
      </div>
      <div class="timeline-lanes">
        <div v-for="track in tracks" :key="track.name" class="lane">
          <span class="name">{{ track.name }}</span>
          <div class="track">
            <div v-for="clip in track.items || []" :key="clip.label" class="clip" :style="{ width: `${(clip.w || 20) * 2.2}px`, borderColor: clip.label ? 'var(--line-strong)' : 'var(--line)' }">
              {{ clip.label }}
            </div>
          </div>
        </div>
      </div>
      <div class="act-bar" style="margin-top: 12px">
        <button class="btn" @click="rebuild()">重建片段索引</button>
        <button class="btn" @click="staleCheck">检查过期片段</button>
      </div>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr)">
      <div class="card">
        <div class="card-head"><h3 class="card-title">分集时间线</h3></div>
        <DataTable :columns="columns" :rows="timelines" row-key="id" clickable @row-click="open">
          <template #actions="{ row }">
            <button class="link-btn" @click="pick(row)">查看轨道</button>
            <button class="link-btn" @click="open(row)">详情</button>
          </template>
        </DataTable>
      </div>
      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">合成口径</h3></div>
          <dl class="kv-lite">
            <dt>时基</dt><dd>{{ timeline?.timebase }}</dd>
            <dt>时长</dt><dd>{{ timeline?.duration }}</dd>
            <dt>片段</dt><dd>{{ timeline?.clips }} 个</dd>
            <dt>状态</dt><dd>{{ timeline?.status }}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">输出前置</h3></div>
          <div class="checklist">
            <div class="ck"><i class="on">✓</i><span>视频轨无缺口</span></div>
            <div class="ck"><i class="on">✓</i><span>音频轨已混音</span></div>
            <div class="ck"><i class="on">✓</i><span>字幕轨时基对齐</span></div>
            <div class="ck"><i :class="{ on: !timeline?.stale }">{{ timeline?.stale ? '' : '✓' }}</i><span>无过期片段</span></div>
          </div>
        </div>
      </aside>
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeTimeline ? `第 ${activeTimeline.ep} 集 · ${activeTimeline.version}` : '时间线详情'"
      :subtitle="activeTimeline?.status || '未找到该时间线'"
      @close="panel.close"
    >
      <div v-if="activeTimeline" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn primary" @click="submitQc(activeTimeline)">提交质检</button>
          <button class="btn" @click="rebuild(activeTimeline)">重建片段索引</button>
        </div>
        <dl class="kv-lite">
          <dt>项目 / 集</dt><dd>{{ activeTimeline.project }} · 第 {{ activeTimeline.ep }} 集</dd>
          <dt>时间线版本</dt><dd>{{ activeTimeline.version }}</dd>
          <dt>轨道 / 片段</dt><dd>{{ activeTimeline.tracks }} 轨 / {{ activeTimeline.clips }} 个片段</dd>
          <dt>时长</dt><dd>{{ activeTimeline.duration }}</dd>
          <dt>时基</dt><dd>{{ activeTimeline.timebase }}</dd>
          <dt>状态</dt><dd>{{ activeTimeline.status }}</dd>
          <dt>过期片段</dt><dd>{{ activeTimeline.stale ? `${activeTimeline.stale} 个` : '无' }}</dd>
        </dl>
        <div class="notice" :class="activeTimeline.stale ? 'warn' : ''">
          过期片段不为 0 时，质检与分集输出都会被阻断；重建索引只刷新片段引用，不覆盖已输出成片。
        </div>
      </div>
      <p v-else class="muted">记录不存在：链接中的时间线可能已删除，或不属于当前项目。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { postApi } from '../../services/post'
import { useRoutePanel } from '../../composables/useRoutePanel'
import { timelineQcBlockReason } from '../../composables/postGate'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()
const route = useRoute()

const timelines = ref<Row[]>([])
const tracks = ref<Row[]>([])
const episodes = ref<Row[]>([])
const ep = ref<number | ''>('')
const timeline = ref<Row | null>(null)
const panel = useRoutePanel('post-timeline')
const activeTimeline = computed(() => timelines.value.find((row) => String(row.id) === panel.activeId.value) ?? null)

const columns: Column[] = [
  { key: 'ep', label: '集' },
  { key: 'version', label: '版本', mono: true },
  { key: 'tracks', label: '轨道' },
  { key: 'clips', label: '片段' },
  { key: 'duration', label: '时长' },
  { key: 'status', label: '状态', pill: true },
  { key: 'stale', label: '过期片段' },
]

function routeEpisode() {
  const value = route.query.ep
  return typeof value === 'string' ? Number(value) : 0
}

async function load() {
  const [timelineRows, trackRows, episodeRows] = await Promise.all([
    postApi.timelines(projectStore.currentId),
    postApi.tracks(),
    postApi.episodes(projectStore.currentId),
  ])
  timelines.value = timelineRows.rows
  tracks.value = trackRows.rows
  episodes.value = episodeRows.rows
  const wanted = routeEpisode()
  const target = timelines.value.find((row) => Number(row.ep) === wanted) ?? timelines.value[0] ?? null
  timeline.value = target
  ep.value = Number(target?.ep ?? '')
}

async function loadTimeline() {
  timeline.value = timelines.value.find((row) => Number(row.ep) === Number(ep.value)) ?? timeline.value
}

function open(row: Row) {
  panel.open(String(row.id ?? ''))
}

function pick(row: Row) {
  timeline.value = row
  ep.value = Number(row.ep)
  if (panel.isOpen.value) panel.close()
}

async function submitQc(row: Row | null = timeline.value) {
  const blocked = timelineQcBlockReason(row)
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  const target = row as Row
  const yes = await ui.confirm(
    '提交质量检测',
    `将按 ${target.version}（第 ${target.ep} 集）执行单集质检，覆盖画质、音画同步与字幕时基；存在阻断项时会退回后期。`,
  )
  if (!yes) return
  await postApi.runQuality({
    project: projectStore.currentId,
    ep: target.ep,
    version: target.version,
    level: '单集级',
  })
  ui.toast(`第 ${target.ep} 集质检任务已提交，报告可在质量报告页查看`)
}

async function rebuild(row: Row | null = timeline.value) {
  if (!row) {
    ui.toast('未选择时间线，不能重建片段索引', 'bad')
    return
  }
  if (!Number(row.stale ?? 0)) {
    ui.toast('当前没有过期片段，无需重建', 'ok')
    return
  }
  const yes = await ui.confirm(
    '重建片段索引',
    `将重新扫描第 ${row.ep} 集 ${row.version} 的 ${row.clips} 个片段并清除 ${row.stale} 个过期引用；已输出成片不会被覆盖。`,
  )
  if (!yes) return
  await postApi.rebuildTimeline(String(row.version), projectStore.currentId)
  ui.toast(`第 ${row.ep} 集片段索引已重建，过期片段已清零`)
  await load()
}

function staleCheck() {
  ui.toast(timeline.value?.stale ? '存在过期片段，请重建片段索引' : '无过期片段', timeline.value?.stale ? 'bad' : 'ok')
}

watch(() => route.query.ep, () => { if (routeEpisode()) loadTimeline() })
watch(() => projectStore.currentId, () => {
  if (panel.isOpen.value) panel.close()
  load()
})
onMounted(load)
</script>
