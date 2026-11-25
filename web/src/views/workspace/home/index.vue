<template>
  <section class="page">
    <PageHeader kicker="WORKSPACE / TODAY" :title="`${session.shortName}，今天有 ${blocking} 件阻塞待处理`" :desc="`当前身份：${session.name}（${session.roleName}）。本页只回答一个问题：现在该做什么。`">
      <HeadActions>
        <button class="btn" @click="go('projects/list')">全部项目</button>
        <button class="btn primary" @click="go('projects/new')">新建项目</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="metrics" />

    <div class="grid" style="grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); margin-top: 18px">
      <div class="stack" style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">在制项目</h3>
              <p class="card-sub">按流水线阶段排序；点击进入制作流水线执行关卡动作。</p>
            </div>
            <button class="btn ghost" @click="go('projects/list')">查看全部</button>
          </div>
          <DataTable :columns="projectColumns" :rows="data.projects || []" :loading="loading" clickable @row-click="openProject">
            <template #actions="{ row }">
              <button class="link-btn" @click="go('projects/workflow', row.id)">流水线</button>
            </template>
          </DataTable>
        </div>

        <div class="grid grid-2" style="gap: 14px">
          <div class="card">
            <div class="card-head"><h3 class="card-title">运行中的任务</h3><button class="btn ghost" @click="go('tasks/list')">任务台</button></div>
            <div v-if="!(data.tasks || []).length" class="empty">暂无运行任务</div>
            <div v-for="task in data.tasks || []" :key="task.id" class="list-row">
              <span class="k">{{ task.kind }} · {{ task.project }}</span>
              <span class="v"><StatusPill :status="task.status" /> {{ task.est }}s</span>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><h3 class="card-title">待办与通知</h3><button class="btn ghost" @click="go('notify/inbox')">全部</button></div>
            <div v-if="!(data.notifications || []).length" class="empty">没有待处理事项</div>
            <div v-for="item in data.notifications || []" :key="item.id" class="list-row">
              <span class="k">{{ item.title }}</span>
              <span class="v"><StatusPill :status="item.state" /></span>
            </div>
          </div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">当前项目流水线</h3></div>
          <div v-if="project.current" style="display: grid; gap: 8px">
            <div class="card-sub">{{ project.current.name }} · {{ project.current.status }}</div>
            <StageRail :stages="data.pipeline || []" />
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">最近动作</h3></div>
          <div v-for="audit in data.audits || []" :key="audit.time + audit.action" class="list-row">
            <span class="k">{{ audit.time }}</span>
            <span class="v">{{ audit.action }}</span>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { http } from '../../../api/client'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import StageRail from '../../../components/ui/StageRail.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const project = useProjectStore()
const router = useRouter()
const data = ref<Record<string, any>>({})
const loading = ref(false)

const metrics = computed(() => data.value.metrics ?? [])
const blocking = computed(() => (data.value.notifications || []).filter((item: any) => item.unread).length)

const projectColumns: Column[] = [
  { key: 'name', label: '项目' },
  { key: 'status', label: '状态', pill: true },
  { key: 'phase', label: '阶段' },
  { key: 'done', label: '已完成集' },
  { key: 'quality', label: '质量', pill: true },
]

function go(path: string, id?: string) {
  if (id) project.select(id)
  router.push(`/${path}`)
}

function openProject(row: Record<string, any>) {
  project.select(String(row.id))
  router.push('/projects/workflow')
}

async function load() {
  loading.value = true
  try {
    data.value = await http.get<Record<string, any>>('/workspace/home')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
