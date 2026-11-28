<template>
  <svg
    class="ds-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="markup"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS, type IconName } from './icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 20,
  strokeWidth: 1.6,
})

const markup = computed(() => ICON_PATHS[props.name] ?? '')
</script>

<style scoped>
.ds-icon {
  display: inline-block;
  flex: none;
  vertical-align: middle;
}
</style>
