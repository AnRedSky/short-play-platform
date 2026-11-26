<template>
  <div class="empty" :class="{ compact }">
    <div v-if="icon" class="empty-icon">{{ icon }}</div>
    <b>{{ title }}</b>
    <p v-if="desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    desc?: string
    icon?: string
    compact?: boolean
  }>(),
  { desc: '', icon: '', compact: false },
)
</script>
