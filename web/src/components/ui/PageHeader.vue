<template>
  <header class="page-head">
    <div class="page-head-main">
      <div class="page-context">{{ contextLabel }}</div>
      <div class="page-title-row">
        <h1>{{ title }}</h1>
        <div v-if="$slots.status" class="page-status"><slot name="status" /></div>
      </div>
      <p v-if="desc">{{ desc }}</p>
    </div>
    <div class="head-actions">
      <slot name="actions"><slot /></slot>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import routesMeta from '../../mock/routes.json'

defineProps<{ kicker?: string; title: string; desc?: string }>()

const route = useRoute()
const meta = routesMeta as Array<{ group: string; path: string; title: string }>
const groupLabels: Record<string, string> = {
  workspace: '创作工作台',
  projects: '项目',
  creation: '剧本',
  director: '导演与视觉',
  video: '视频生产',
  audio: '音频与字幕',
  post: '后期与交付',
  quality: '质量与返工',
  assets: '资产',
  models: '模型资源',
  tasks: '生产任务',
  cost: '成本与预算',
  analytics: '经营分析',
  orgs: '企业与组织',
  compliance: '合规与审计',
  ops: '平台运维',
}

const contextLabel = computed(() => {
  const group = meta.find((item) => `/${item.path}` === route.path)?.group
  return group ? groupLabels[group] ?? '短剧智能生产' : '短剧智能生产'
})
</script>
