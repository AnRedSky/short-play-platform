<template>
  <div class="stage-rail">
    <div
      v-for="(stage, index) in stages"
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
      <div class="k">{{ marker(stage, index) }}</div>
      <div class="n">{{ stage.name }}</div>
      <div class="g">关口 · {{ readable(stage.gate) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StageRow } from '../../mock/state'

const props = withDefaults(defineProps<{ stages: StageRow[]; activeKey?: string; interactive?: boolean }>(), {
  activeKey: '',
  interactive: false,
})
const emit = defineEmits<{ (event: 'select', stage: StageRow): void }>()

const STATE_LABEL: Record<StageRow['state'], string> = {
  overview: '项目汇总',
  done: '已完成',
  now: '进行中',
  blocked: '受阻',
  todo: '待开始',
}

function marker(stage: StageRow, index: number): string {
  if (stage.state === 'overview') return STATE_LABEL.overview
  const step = props.stages.slice(0, index).filter((item) => item.state !== 'overview').length + 1
  return `第 ${step} 步 · ${STATE_LABEL[stage.state]}`
}

function readable(value: unknown): string {
  return String(value ?? '').replace(/\bPASS\b/g, '通过').replace(/\bFAIL\b/g, '未通过')
}
</script>

<style scoped>
.stage-card.clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.stage-card.clickable:hover {
  border-color: var(--accent-line);
  background: var(--surface-2);
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
.stage-card.overview {
  border-color: var(--line-strong);
  background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
}
.stage-card.overview .k {
  color: var(--accent-ink);
}
</style>
