<template>
  <section class="page access-error-page" role="alert">
    <div class="content-card">
      <p class="eyebrow">PROJECT ACCESS</p>
      <h1>{{ title }}</h1>
      <p class="muted">{{ message }}</p>
      <p v-if="projectId" class="muted">项目 ID：{{ projectId }}</p>
      <RouterLink class="primary-button" to="/projects">返回项目列表</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const projectId = computed(() => String(route.query.projectId ?? ''))
const reason = computed(() => String(route.query.reason ?? 'unavailable'))

const title = computed(() => {
  if (reason.value === 'forbidden') return '无权访问此项目'
  if (reason.value === 'not-found') return '项目不存在'
  return '暂时无法验证项目权限'
})

const message = computed(() => {
  if (reason.value === 'forbidden') return '你不是此项目的成员，或当前角色没有读取权限。'
  if (reason.value === 'not-found') return '项目可能已被删除，或当前地址不正确。'
  return '项目权限服务暂时不可用。请稍后重试；在验证成功前不会展示项目内容。'
})
</script>
