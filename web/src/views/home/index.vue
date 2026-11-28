<template>
  <AppPage
    context="OVERVIEW / 概览"
    title="首页"
    description="在制项目、运行任务与待办通知汇总在这里：先看整体数据，再进工作台处理具体项目。"
  >
    <template #actions>
      <AppButton :loading="loading" icon="arrow" @click="load">刷新数据</AppButton>
      <AppButton variant="primary" icon="workbench" @click="router.push('/workspace/home')">进入工作台</AppButton>
    </template>

    <div class="stat-grid">
      <AppCard v-for="metric in metrics" :key="metric.label" compact class="stat-card">
        <p class="stat-label">{{ metric.label }}</p>
        <p class="stat-value">{{ metric.value }}</p>
        <p class="stat-hint">{{ metric.hint }}</p>
      </AppCard>
    </div>

    <p v-if="error" class="notice bad">{{ error }}</p>
    <p v-if="loading && !metrics.length" class="loading-hint">正在汇总项目数据…</p>

    <div class="home-grid">
      <AppCard title="项目概览" subtitle="在建项目的阶段与集数进度" class="overview-card">
        <template #actions>
          <AppButton size="sm" variant="ghost" @click="router.push('/workspace/home')">全部项目</AppButton>
        </template>
        <ul v-if="projects.length" class="row-list">
          <li v-for="project in projects" :key="project.id" class="row">
            <button type="button" class="row-main" @click="openProject(project.id)">
              <span class="row-title">{{ project.name }}</span>
              <span class="row-sub">{{ project.id }} · {{ project.genre || '未标注类型' }} · {{ project.owner || '未指定负责人' }}</span>
            </button>
            <span class="row-progress">
              <span class="progress-track"><span class="progress-fill" :style="{ width: `${progressOf(project)}%` }"></span></span>
              <span class="progress-text">{{ project.done ?? 0 }}/{{ project.episodes ?? 0 }} 集</span>
            </span>
            <span class="pill" :class="toneOf(project.status)">{{ project.status }}</span>
          </li>
        </ul>
        <p v-else-if="!loading" class="muted">暂无在制项目。</p>
      </AppCard>

      <div class="side-stack">
        <AppCard title="运行任务" subtitle="执行中与排队中的任务">
          <ul v-if="tasks.length" class="row-list compact-list">
            <li v-for="task in tasks" :key="task.id" class="task-row">
              <span class="task-kind">{{ task.kind }}</span>
              <span class="task-meta">{{ task.project }} · 第 {{ task.ep }} 集 · {{ task.status }}</span>
            </li>
          </ul>
          <p v-else-if="!loading" class="muted">当前没有运行中的任务。</p>
        </AppCard>

        <AppCard title="待办与通知" subtitle="未读项优先处理">
          <template #actions>
            <AppButton size="sm" variant="ghost" @click="inbox.openInbox()">打开通知</AppButton>
          </template>
          <ul v-if="notices.length" class="row-list compact-list">
            <li v-for="notice in notices" :key="notice.id" class="notice-row">
              <span class="notice-dot" :class="{ 'is-unread': notice.unread }" aria-hidden="true"></span>
              <span class="notice-text">
                <b>{{ notice.title }}</b>
                <small>{{ notice.type }} · {{ notice.at }}</small>
              </span>
            </li>
          </ul>
          <p v-else-if="!loading" class="muted">没有待处理事项。</p>
        </AppCard>

        <AppCard title="快捷入口" subtitle="四个一级入口直达">
          <div class="quick-grid">
            <button v-for="entry in quickEntries" :key="entry.key" type="button" class="quick-item" @click="router.push(entry.path)">
              <AppIcon :name="entry.icon" :size="20" />
              <span>
                <b>{{ entry.label }}</b>
                <small>{{ entry.hint }}</small>
              </span>
            </button>
          </div>
        </AppCard>
      </div>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppPage from '../../components/ds/AppPage.vue'
import AppCard from '../../components/ds/AppCard.vue'
import AppButton from '../../components/ds/AppButton.vue'
import AppIcon from '../../components/ds/AppIcon.vue'
import type { Row } from '../../mock/db'
import { workspaceApi } from '../../services/workspace'
import { primaryNav } from '../../layouts/navigation'
import { useInboxStore } from '../../stores/inbox'
import { useProjectStore } from '../../stores/project'

const router = useRouter()
const inbox = useInboxStore()
const project = useProjectStore()

const loading = ref(false)
const error = ref('')
const home = ref<Record<string, unknown>>({})

interface Metric { label: string; value: string | number; hint: string }

const metrics = computed<Metric[]>(() => (Array.isArray(home.value.metrics) ? (home.value.metrics as Metric[]) : []))
const projects = computed<Row[]>(() => (Array.isArray(home.value.projects) ? (home.value.projects as Row[]) : []))
const tasks = computed<Row[]>(() => (Array.isArray(home.value.tasks) ? (home.value.tasks as Row[]) : []))
const notices = computed<Row[]>(() =>
  Array.isArray(home.value.notifications) ? (home.value.notifications as Row[]) : [],
)

const quickEntries = primaryNav.map((item) => ({
  key: item.key,
  label: item.label,
  icon: item.icon,
  path: item.path,
  hint:
    item.key === 'home'
      ? '数据总览'
      : item.key === 'workbench'
        ? '项目与创作任务'
        : item.key === 'assets'
          ? '图片 · 视频 · 音频'
          : '受控安装与配置',
}))

const statusTones: Record<string, string> = {
  生产中: 'ok',
  已交付: 'info',
  待审核: 'warn',
  待启动: 'outline',
  已暂停: 'bad',
  已终止: 'bad',
}

function toneOf(status?: string) {
  return statusTones[String(status ?? '')] ?? 'outline'
}

function progressOf(project: Row) {
  const done = Number(project.done ?? 0)
  const episodes = Number(project.episodes ?? 0)
  if (!episodes) return 0
  return Math.min(100, Math.round((done / episodes) * 100))
}

function openProject(id: string) {
  project.select(id)
  router.push('/projects/workflow')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    home.value = await workspaceApi.home()
  } catch (err) {
    error.value = (err as Error).message || '首页数据读取失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  if (!inbox.rows.length) void inbox.load()
})
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.stat-card {
  padding: var(--space-1) 0;
}

.stat-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ds-text-muted);
}

.stat-value {
  margin: var(--space-1) 0 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ds-text-primary);
}

.stat-hint {
  margin: var(--space-half) 0 0;
  font-size: 11.5px;
  color: var(--ds-text-disabled);
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.side-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.row-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--ds-border);
}

.row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-half);
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.row-title {
  font-size: 13.5px;
  font-weight: 640;
  color: var(--ds-text-primary);
}

.row-main:hover .row-title {
  color: var(--ds-interactive);
}

.row-sub {
  font-size: 11.5px;
  color: var(--ds-text-muted);
}

.row-progress {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
  width: 150px;
}

.progress-track {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--ds-surface-3);
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--ds-interactive);
  border-radius: var(--radius-pill);
}

.progress-text {
  font-size: 11px;
  color: var(--ds-text-muted);
  white-space: nowrap;
}

.compact-list .task-row,
.compact-list .notice-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--ds-border);
}

.compact-list .task-row:last-child,
.compact-list .notice-row:last-child {
  border-bottom: 0;
}

.task-kind {
  font-size: 12px;
  font-weight: 620;
  color: var(--ds-text-secondary);
}

.task-meta {
  font-size: 11.5px;
  color: var(--ds-text-muted);
}

.notice-row {
  align-items: flex-start;
}

.notice-dot {
  width: 6px;
  height: 6px;
  margin-top: 5px;
  flex: none;
  border-radius: var(--radius-pill);
  background: var(--ds-border-strong);
}

.notice-dot.is-unread {
  background: var(--ds-interactive);
}

.notice-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.notice-text b {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ds-text-primary);
  line-height: 1.5;
}

.notice-text small {
  font-size: 11px;
  color: var(--ds-text-muted);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1);
}

.quick-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-muted);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

.quick-item:hover {
  border-color: var(--ds-border-strong);
  background: var(--ds-surface-3);
  color: var(--ds-text-primary);
}

.quick-item b {
  display: block;
  font-size: 12.5px;
  font-weight: 640;
  color: var(--ds-text-primary);
}

.quick-item small {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--ds-text-muted);
}

.loading-hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--ds-text-muted);
}

@media (max-width: 1180px) {
.stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
.stat-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .row {
    flex-wrap: wrap;
  }

  .row-progress {
    width: 100%;
  }
}
</style>
