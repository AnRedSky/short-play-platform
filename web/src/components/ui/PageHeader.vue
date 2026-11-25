<template>
  <header class="page-head">
    <div>
      <div class="kicker">{{ kicker }}</div>
      <h1>{{ title }}</h1>
      <p v-if="desc">{{ desc }}</p>
    </div>
    <div class="head-actions">
      <slot name="actions"><slot /></slot>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ kicker: string; title: string; desc?: string }>()
</script>
