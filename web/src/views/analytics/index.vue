<template>
  <section class="page">
    <PageHeader :kicker="scope === 'me' ? 'ANALYTICS / ME' : 'ANALYTICS / ENTERPRISE'" :title="scope === 'me' ? '我的产能' : '企业产能与成本'" desc="只展示聚合指标与来源说明；明细表默认脱敏。">
      <HeadActions>
        <button class="btn" :class="{ primary: scope === 'enterprise' }" @click="go('enterprise')">企业视角</button>
        <button class="btn" :class="{ primary: scope === 'me' }" @click="go('me')">个人视角</button>
      </HeadActions>
    </PageHeader>

    <div class="grid grid-4">
      <div v-for="(value, key) in kpis" :key="key" class="card stat-card">
        <small>{{ key }}</small>
        <b>{{ value }}</b>
      </div>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr); margin-top: 18px">
      <div class="card">
        <div class="card-head"><h3 class="card-title">项目产能</h3><span class="card-sub">按项目聚合 · 含成本</span></div>
        <DataTable :columns="projectColumns" :rows="byProject" row-key="project" wide />
      </div>
      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">阶段分布</h3></div>
          <div v-for="row in byStage" :key="row.stage" class="bar-row">
            <span>{{ row.stage }}</span>
            <div class="bar" style="flex: 1"><i :style="{ width: row.ratio }"></i></div>
            <b>{{ row.count }}</b>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">任务构成</h3></div>
          <div v-for="row in taskMix" :key="row.kind" class="list-row">
            <span class="k">{{ row.kind }}</span>
            <span class="v">{{ row.count }} 次 · 失败 {{ row.failed }}</span>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { analyticsApi } from '../../services/analytics'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable, { type Column } from '../../components/ui/DataTable.vue'

const route = useRoute()
const router = useRouter()

const scope = computed(() => (String(route.path).endsWith('/me') ? 'me' : 'enterprise'))
const payload = ref<Row>({})

const kpis = computed<Record<string, string>>(() => {
  const raw = payload.value.kpis || {}
  const map: Record<string, string> = {}
  const labels: Record<string, string> = { projects: '在制项目', episodes: '成片集数', onTime: '准时率', cost: '成本合计', reuse: '资产复用率' }
  Object.entries(raw).forEach(([key, value]) => {
    const label = labels[key] || key
    map[label] = typeof value === 'number' && key === 'cost' ? `¥${value.toLocaleString('zh-CN')}` : String(value)
  })
  return map
})

const projectColumns: Column[] = [
  { key: 'project', label: '项目' },
  { key: 'episodes', label: '集数' },
  { key: 'done', label: '完成' },
  { key: 'stage', label: '阶段', pill: true },
  { key: 'cost', label: '成本', format: (row) => `¥${Number(row.cost || 0).toLocaleString('zh-CN')}` },
  { key: 'quality', label: '质量' },
]

const byProject = computed<Row[]>(() => payload.value.by_project || [])
const byStage = computed<Row[]>(() => payload.value.by_stage || [])
const taskMix = computed<Row[]>(() => payload.value.task_mix || [])

function go(target: 'enterprise' | 'me') {
  router.push(`/analytics/${target}`)
}

async function load() {
  payload.value = await analyticsApi.get(scope.value)
}

watch(scope, load)
onMounted(load)
</script>
