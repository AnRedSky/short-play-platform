<template>
  <section class="status-strip" aria-label="关键状态">
    <div v-for="(item, index) in items" :key="item.label" class="status-cell" :class="{ primary: index === 0 }">
      <span class="status-label">{{ item.label }}</span>
      <div class="status-value">{{ item.value }}<small v-if="item.unit">{{ item.unit }}</small></div>
      <div class="status-hint">{{ item.hint || '' }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ items: Array<{ label: string; value: string | number; unit?: string; hint?: string }> }>()
</script>
