<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / DETAIL" :title="summary.project ? summary.project.name : '项目详情'" :desc="summary.project ? `${summary.project.id} · ${summary.project.status} · ${summary.project.genre}` : ''">
      <HeadActions>
        <button class="btn" @click="$router.push('/projects/list')">项目列表</button>
        <button class="btn primary" @click="$router.push('/projects/workflow')">制作流水线</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '集数', value: summary.project?.episodes ?? 0, unit: '集' },
      { label: '已完成', value: summary.project?.done ?? 0, unit: '集' },
      { label: '预算占用', value: '¥' + Number(summary.project?.actual || 0).toLocaleString('zh-CN'), hint: '总额 ¥' + Number(summary.project?.budget || 0).toLocaleString('zh-CN') },
      { label: '质量', value: summary.project?.quality ?? '—', hint: '最近一次检测结论' },
    ]" />

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); margin-top: 18px">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">阶段管线</h3></div>
          <StageRail :stages="summary.stages || []" />
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">分集状态</h3><span class="card-sub">{{ (summary.episodes || []).length }} 集</span></div>
          <DataTable
            :columns="[{ key: 'no', label: '集' }, { key: 'title', label: '标题' }, { key: 'duration', label: '时长' }, { key: 'qc', label: '质检', pill: true }, { key: 'status', label: '状态', pill: true }]"
            :rows="summary.episodes || []"
            row-key="no"
            clickable
            @row-click="openEpisode"
          />
        </div>

        <div class="grid grid-2" style="gap: 14px">
          <div class="card">
            <div class="card-head"><h3 class="card-title">剧本版本</h3></div>
            <button v-for="script in summary.scripts || []" :key="script.id" class="list-row row-click" style="width: 100%; text-align: left; background: transparent; border: 0" @click="openScript(script)">
              <span class="k">{{ script.version }} · {{ script.id }}</span>
              <span class="v"><StatusPill :status="script.status" /> {{ script.shots }} 镜</span>
            </button>
            <EmptyState v-if="!(summary.scripts || []).length" title="暂无剧本版本" desc="进入剧本页创建首个版本后，这里会显示版本链。" compact />
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">成本流水</h3></div>
            <button v-for="cost in (summary.costs || []).slice(0, 6)" :key="cost.id" class="list-row row-click" style="width: 100%; text-align: left; background: transparent; border: 0" @click="openCost(cost)">
              <span class="k">{{ cost.cap }} · E{{ cost.ep }}</span>
              <span class="v">¥{{ cost.actual }}</span>
            </button>
            <EmptyState v-if="!(summary.costs || []).length" title="暂无成本记录" desc="生成任务产生调用后，成本会自动记账。" compact />
          </div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">项目设定</h3></div>
          <dl class="kv-lite">
            <dt>受众</dt><dd>{{ summary.project?.audience }}</dd>
            <dt>时长</dt><dd>{{ summary.project?.duration }}</dd>
            <dt>画幅</dt><dd>{{ summary.project?.ratio }}</dd>
            <dt>风格</dt><dd>{{ summary.project?.style }}</dd>
            <dt>约束</dt><dd>{{ summary.project?.constraints }}</dd>
            <dt>负责人</dt><dd>{{ summary.project?.owner }} / {{ summary.project?.dept }}</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">资产与审核</h3></div>
          <div class="list-row"><span class="k">资产</span><span class="v">{{ (summary.assets || []).length }} 个</span></div>
          <div class="list-row"><span class="k">审核记录</span><span class="v">{{ (summary.reviews || []).length }} 条</span></div>
          <div class="list-row"><span class="k">任务</span><span class="v">{{ (summary.tasks || []).length }} 个</span></div>
        </div>
      </aside>
    </div>

    <AppDrawer :open="drawerOpen" :title="drawerTitle" :subtitle="drawerSubtitle" @close="closeDrawer">
      <dl class="kv-lite">
        <template v-for="item in drawerItems" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value || '—' }}</dd>
        </template>
      </dl>
      <div class="act-bar">
        <button v-for="link in drawerLinks" :key="link.path" class="btn" @click="go(link.path)">{{ link.label }}</button>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import type { Row } from '../../../mock/db'
import { useProjectStore } from '../../../stores/project'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import StageRail from '../../../components/ui/StageRail.vue'
import DataTable from '../../../components/ui/DataTable.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const projectStore = useProjectStore()
const router = useRouter()
const summary = ref<Row>({})
const episodePanel = useRoutePanel('project-episode')
const scriptPanel = useRoutePanel('project-script')
const costPanel = useRoutePanel('project-cost')

const episodes = computed(() => (summary.value.episodes as Row[] | undefined) ?? [])
const scripts = computed(() => (summary.value.scripts as Row[] | undefined) ?? [])
const costs = computed(() => (summary.value.costs as Row[] | undefined) ?? [])

const episode = computed(() => episodes.value.find((row) => String(row.no) === episodePanel.activeId.value) ?? null)
const script = computed(() => scripts.value.find((row) => String(row.id) === scriptPanel.activeId.value) ?? null)
const cost = computed(() => costs.value.find((row) => String(row.id) === costPanel.activeId.value) ?? null)

const drawerOpen = computed(() => episodePanel.isOpen.value || scriptPanel.isOpen.value || costPanel.isOpen.value)
const drawerTitle = computed(() => {
  if (episode.value) return `第 ${episode.value.no} 集 · ${episode.value.title}`
  if (script.value) return `剧本 ${script.value.version}`
  if (cost.value) return `${cost.value.cap} · ${cost.value.id}`
  return '项目对象'
})
const drawerSubtitle = computed(() => {
  if (episode.value) return `${episode.value.status} · ${episode.value.duration}`
  if (script.value) return `${script.value.id} · ${script.value.status}`
  if (cost.value) return `${cost.value.task} · ${cost.value.status}`
  return ''
})

const drawerItems = computed<Array<{ label: string; value: string }>>(() => {
  if (episode.value) {
    return [
      { label: '集数', value: `第 ${episode.value.no} 集` },
      { label: '标题', value: String(episode.value.title ?? '') },
      { label: '场次', value: `${episode.value.scenes ?? '—'} 场` },
      { label: '镜头', value: `${episode.value.shots ?? '—'} 镜` },
      { label: '时长', value: String(episode.value.duration ?? '') },
      { label: '质检', value: String(episode.value.qc ?? '') },
      { label: '状态', value: String(episode.value.status ?? '') },
      { label: '时间线', value: String(episode.value.timeline ?? '') },
    ]
  }
  if (script.value) {
    return [
      { label: '版本', value: String(script.value.version ?? '') },
      { label: '状态', value: String(script.value.status ?? '') },
      { label: '集数', value: `${script.value.episodes ?? '—'} 集` },
      { label: '场次', value: `${script.value.scenes ?? '—'} 场` },
      { label: '镜头', value: `${script.value.shots ?? '—'} 镜` },
      { label: '台词行', value: `${script.value.lines ?? '—'} 行` },
      { label: '维护人', value: String(script.value.by ?? '') },
      { label: '更新时间', value: String(script.value.at ?? '') },
      { label: '说明', value: String(script.value.note ?? '') },
    ]
  }
  if (cost.value) {
    return [
      { label: '成本编号', value: String(cost.value.id ?? '') },
      { label: '任务', value: String(cost.value.task ?? '') },
      { label: '集 / 镜头', value: `E${cost.value.ep ?? '—'} / ${cost.value.shot ?? '—'}` },
      { label: '能力', value: String(cost.value.cap ?? '') },
      { label: '预估', value: `¥${cost.value.est ?? '—'}` },
      { label: '实际', value: `¥${cost.value.actual ?? '—'}` },
      { label: '供应商', value: String(cost.value.provider ?? '') },
      { label: '状态', value: String(cost.value.status ?? '') },
      { label: '账单', value: String(cost.value.bill ?? '') },
    ]
  }
  return []
})

const drawerLinks = computed<Array<{ label: string; path: string }>>(() => {
  if (episode.value) return [{ label: '分集输出', path: '/post/episodes' }, { label: '时间线', path: '/post/timeline' }]
  if (script.value) return [{ label: '剧本版本', path: '/creation/script' }, { label: '剧本审核', path: '/creation/review' }]
  if (cost.value) return [{ label: '成本台账', path: '/cost/ledger' }]
  return []
})

function openEpisode(row: Row) {
  episodePanel.open(String(row.no ?? ''))
}

function openScript(row: Row) {
  scriptPanel.open(String(row.id ?? ''))
}

function openCost(row: Row) {
  costPanel.open(String(row.id ?? ''))
}

function closeDrawer() {
  if (episodePanel.isOpen.value) return episodePanel.close()
  if (scriptPanel.isOpen.value) return scriptPanel.close()
  if (costPanel.isOpen.value) return costPanel.close()
}

function go(path: string) {
  router.push(path)
}

async function load() {
  summary.value = await projectApi.summary(projectStore.currentId)
}

onMounted(load)
</script>
