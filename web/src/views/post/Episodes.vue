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
      <DataTable :columns="columns" :rows="episodes" row-key="no" wide>
        <template #actions="{ row }">
          <button class="link-btn" @click="output(row)">输出</button>
          <button class="link-btn" @click="qc(row)">质检</button>
          <button class="link-btn" @click="openTimeline(row)">时间线</button>
        </template>
      </DataTable>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '../../api/client'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import { useRouter } from 'vue-router'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()
const router = useRouter()

const episodes = ref<Row[]>([])

const columns: Column[] = [
  { key: 'no', label: '集' },
  { key: 'title', label: '标题' },
  { key: 'scenes', label: '场次' },
  { key: 'shots', label: '镜头' },
  { key: 'duration', label: '时长' },
  { key: 'timeline', label: '时间线', mono: true },
  { key: 'qc', label: '质检', pill: true },
  { key: 'status', label: '状态', pill: true },
]

async function load() {
  const result = await http.list<Row>('/episodes', { project: projectStore.currentId, limit: 40 })
  episodes.value = result.rows.map((row, index) => ({ ...row, no: row.no ?? index + 1 }))
}

async function output(row: Row) {
  await http.patch(`/episodes/${row.no}`, { status: '已输出' })
  ui.toast(`第 ${row.no} 集已输出`)
  await load()
}

async function qc(row: Row) {
  await http.post('/quality/run', { project: projectStore.currentId, ep: row.no, version: row.timeline })
  ui.toast(`第 ${row.no} 集质检已提交`)
  await load()
}

async function outputAll() {
  const yes = await ui.confirm('批量输出', `将输出当前项目的 ${episodes.value.length} 个分集（mock 逐集执行）。`)
  if (!yes) return
  for (const row of episodes.value.slice(0, 12)) await http.patch(`/episodes/${row.no}`, { status: '已输出' })
  ui.toast('批量输出完成（mock 上限 12 集）')
  await load()
}

function openTimeline(row: Row) {
  router.push('/post/timeline')
  ui.toast(`已定位第 ${row.no} 集 · ${row.timeline}`, 'info')
}

onMounted(load)
</script>
