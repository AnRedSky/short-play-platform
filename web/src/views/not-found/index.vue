<template>
  <section class="page">
    <PageHeader kicker="404 / NOT FOUND" title="页面不存在" :desc="`路径 ${route.fullPath} 不在 52 条业务路由内；旧版入口已随壳层清理移除。`">
      <HeadActions>
        <button class="btn primary" @click="$router.push('/workspace/home')">返回工作台</button>
        <button class="btn" @click="$router.push('/workspace/assistant')">生产助手</button>
      </HeadActions>
    </PageHeader>
  </section>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'

const route = useRoute()
</script>
