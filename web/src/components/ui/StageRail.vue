<template>
  <div class="stage-rail">
    <div v-for="stage in stages" :key="stage.key" class="stage-card" :class="stage.state">
      <div class="k">{{ stage.state === 'done' ? 'DONE' : stage.state === 'now' ? 'NOW' : stage.state === 'blocked' ? 'BLOCKED' : 'TODO' }}</div>
      <div class="n">{{ stage.name }}</div>
      <div class="g">关口 · {{ stage.gate }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StageRow } from '../../mock/state'
defineProps<{ stages: StageRow[] }>()
</script>
