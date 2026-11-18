<template>
  <section class="page production-page">
    <div class="breadcrumb">
      <RouterLink to="/">工作台</RouterLink>
      <span>/</span>
      <RouterLink to="/projects">项目</RouterLink>
      <span>/</span>
      <span>{{ config.title }}</span>
    </div>
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ config.eyebrow }}</p>
        <h1>{{ config.title }}</h1>
        <p class="muted">{{ config.description }}</p>
      </div>
    </div>
    <nav class="module-tabs" aria-label="项目生产模块">
      <RouterLink :to="path('stories')">故事圣经</RouterLink>
      <RouterLink :to="path('episodes')">剧集与剧本</RouterLink>
      <RouterLink :to="path('assets')">资产库</RouterLink>
      <RouterLink :to="path('storyboards')">分镜镜头</RouterLink>
      <RouterLink :to="path('tasks')">AI 任务</RouterLink>
      <RouterLink :to="path('reviews')">审核质量</RouterLink>
      <RouterLink :to="path('editor')">时间线</RouterLink>
      <RouterLink :to="path('exports')">导出交付</RouterLink>
    </nav>
    <div class="content-card">
      <p class="eyebrow">REAL API REQUIRED</p>
      <h2>{{ config.title }}尚未接入真实业务数据</h2>
      <p class="muted">
        当前页面不再展示本地演示记录或模拟操作。待对应业务 API 和权限联调完成后，
        此处将展示当前项目的真实数据。
      </p>
      <p class="muted">项目 ID：{{ projectId }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type ModuleKey = 'episodes' | 'stories' | 'assets' | 'storyboards' | 'tasks' | 'reviews' | 'editor' | 'exports'

const props = defineProps<{ module: ModuleKey }>()
const route = useRoute()

const configs: Record<ModuleKey, { eyebrow: string; title: string; description: string }> = {
  episodes: {
    eyebrow: 'SCRIPT & EPISODES',
    title: '剧集与剧本',
    description: '管理分集结构、剧本版本、场次与对白。',
  },
  stories: {
    eyebrow: 'STORY DEVELOPMENT',
    title: '故事圣经',
    description: '沉淀故事设定、人物关系、世界观与版本历史。',
  },
  assets: {
    eyebrow: 'ASSET LIBRARY',
    title: '角色 / 场景 / 道具资产',
    description: '管理视觉参考、资产版本与镜头引用关系。',
  },
  storyboards: {
    eyebrow: 'STORYBOARD & SHOTS',
    title: '分镜与镜头',
    description: '按场次组织镜头，维护 Shot Contract 与生成状态。',
  },
  tasks: {
    eyebrow: 'AI GENERATION',
    title: 'AI 生成任务',
    description: '追踪 Provider、任务状态、执行尝试与生成产物。',
  },
  reviews: {
    eyebrow: 'QUALITY & REVIEW',
    title: '审核与质量门禁',
    description: '检查技术、内容、连续性与审核记录。',
  },
  editor: {
    eyebrow: 'TIMELINE EDITOR',
    title: '时间线剪辑',
    description: '以非破坏方式组织视频、音频和字幕轨道。',
  },
  exports: {
    eyebrow: 'EXPORT & DELIVERY',
    title: '成片导出',
    description: '配置 MP4 画幅、帧率、字幕与交付参数。',
  },
}

const config = computed(() => configs[props.module])
const projectId = computed(() => String(route.params.projectId ?? ''))

function path(section: string) {
  return projectId.value
    ? `/projects/${encodeURIComponent(projectId.value)}/${section}`
    : '/projects'
}
</script>
