<template>
  <div class="stage-rail">
    <div
      v-for="stage in stages"
      :key="stage.key"
      class="stage-card"
      :class="[stage.state, { clickable: interactive, active: stage.key === activeKey }]"
      :role="interactive ? 'button' : undefined"
      :tabindex="interactive ? 0 : undefined"
      :aria-current="stage.key === activeKey ? 'step' : undefined"
      @click="interactive && emit('select', stage)"
      @keydown.enter="interactive && emit('select', stage)"
      @keydown.space.prevent="interactive && emit('select', stage)"
    >
      <div class="k">{{ stage.state === 'done' ? 'DONE' : stage.state === 'now' ? 'NOW' : stage.state === 'blocked' ? 'BLOCKED' : 'TODO' }}</div>
      <div class="n">{{ stage.name }}</div>
      <div class="g">关口 · {{ stage.gate }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StageRow } from '../../mock/state'

withDefaults(defineProps<{ stages: StageRow[]; activeKey?: string; interactive?: boolean }>(), {
  activeKey: '',
  interactive: false,
})
const emit = defineEmits<{ (event: 'select', stage: StageRow): void }>()
</script>

<style scoped>
.stage-card.clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.stage-card.clickable:hover {
  border-color: var(--accent-line);
  background: #1a2029;
}
.stage-card.clickable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.stage-card.active {
  opacity: 1;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
  background: var(--accent-soft);
}
.stage-card.active .k {
  color: var(--accent);
}
</style>
