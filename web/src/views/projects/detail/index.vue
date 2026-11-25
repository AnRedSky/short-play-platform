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
          />
        </div>

        <div class="grid grid-2" style="gap: 14px">
          <div class="card">
            <div class="card-head"><h3 class="card-title">剧本版本</h3></div>
            <div v-for="script in summary.scripts || []" :key="script.id" class="list-row">
              <span class="k">{{ script.version }} · {{ script.id }}</span>
              <span class="v"><StatusPill :status="script.status" /> {{ script.shots }} 镜</span>
            </div>
            <div v-if="!(summary.scripts || []).length" class="empty">暂无剧本版本</div>
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">成本流水</h3></div>
            <div v-for="cost in (summary.costs || []).slice(0, 6)" :key="cost.id" class="list-row">
              <span class="k">{{ cost.cap }} · E{{ cost.ep }}</span>
              <span class="v">¥{{ cost.actual }}</span>
            </div>
            <div v-if="!(summary.costs || []).length" class="empty">暂无成本记录</div>
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
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { projectApi } from '../../../services/projects'
import { useProjectStore } from '../../../stores/project'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import StageRail from '../../../components/ui/StageRail.vue'
import DataTable from '../../../components/ui/DataTable.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const projectStore = useProjectStore()
const summary = ref<Record<string, any>>({})

async function load() {
  summary.value = await projectApi.summary(projectStore.currentId)
}

onMounted(load)
</script>
