<template>
  <div class="grid grid-4">
    <div v-for="item in items" :key="item.label" class="card stat-card">
      <div class="metric-label">{{ item.label }}</div>
      <div class="v">{{ item.value }}<small v-if="item.unit">{{ item.unit }}</small></div>
      <div class="h">{{ item.hint || '' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ items: Array<{ label: string; value: string | number; unit?: string; hint?: string }> }>()
</script>
