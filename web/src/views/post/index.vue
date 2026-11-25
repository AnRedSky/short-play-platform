<template>
  <section class="page">
    <PageHeader kicker="POST / TIMELINE" title="时间线与剪辑" desc="时间线是分集成片的唯一合成口径：轨道、片段与时基必须可复现。">
      <HeadActions>
        <button class="btn" @click="$router.push('/post/episodes')">分集成片</button>
        <button class="btn primary" v-if="session.can('post.write')" @click="toQc">提交质量检测</button>
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
        <button class="btn" @click="regen">重建片段索引</button>
        <button class="btn" @click="staleCheck">检查过期片段</button>
      </div>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr)">
      <div class="card">
        <div class="card-head"><h3 class="card-title">分集时间线</h3></div>
        <DataTable :columns="columns" :rows="timelines" row-key="version" clickable @row-click="pick">
          <template #actions="{ row }">
            <button class="link-btn" @click="pick(row)">查看轨道</button>
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
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { postApi } from '../../services/post'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const timelines = ref<Row[]>([])
const tracks = ref<Row[]>([])
const episodes = ref<Row[]>([])
const ep = ref<number | ''>('')
const timeline = ref<Row | null>(null)

const columns: Column[] = [
  { key: 'ep', label: '集' },
  { key: 'version', label: '版本', mono: true },
  { key: 'tracks', label: '轨道' },
  { key: 'clips', label: '片段' },
  { key: 'duration', label: '时长' },
  { key: 'status', label: '状态', pill: true },
  { key: 'stale', label: '过期片段' },
]

async function load() {
  const [timelineRows, trackRows, episodeRows] = await Promise.all([
    postApi.timelines(projectStore.currentId),
    postApi.tracks(),
    postApi.episodes(projectStore.currentId),
  ])
  timelines.value = timelineRows.rows
  tracks.value = trackRows.rows
  episodes.value = episodeRows.rows
  timeline.value = timelineRows.rows[0] ?? null
  ep.value = Number(timelineRows.rows[0]?.ep ?? '')
}

async function loadTimeline() {
  timeline.value = timelines.value.find((row) => Number(row.ep) === Number(ep.value)) ?? timeline.value
}

function pick(row: Row) {
  timeline.value = row
  ep.value = Number(row.ep)
}

async function toQc() {
  const yes = await ui.confirm('提交质量检测', '质检将按单集级与整剧级规则执行；存在阻断项时会退回后期。')
  if (!yes) return
  await postApi.runQuality({ project: projectStore.currentId, ep: ep.value, level: '单集级' })
  ui.toast('质检任务已提交，报告可在质量报告页查看')
}

function regen() {
  ui.toast('片段索引已重建（mock）')
}

function staleCheck() {
  ui.toast(timeline.value?.stale ? '存在过期片段，请重生成对应镜头' : '无过期片段', timeline.value?.stale ? 'bad' : 'ok')
}

watch(() => projectStore.currentId, load)
onMounted(load)
</script>
