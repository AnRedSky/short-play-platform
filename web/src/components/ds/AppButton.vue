<template>
  <button
    class="ds-btn"
    :class="[`is-${variant}`, `size-${size}`, { 'is-block': block }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="ds-btn-spinner" aria-hidden="true"></span>
    <AppIcon v-else-if="icon" :name="icon" :size="size === 'sm' ? 15 : 17" />
    <slot />
  </button>
</template>

<script setup lang="ts">
/** 按钮：常规 / 主操作 / 次级 / 危险 四档，含 hover、激活、禁用与加载态。 */
import AppIcon from './AppIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    icon?: IconName
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', disabled: false, loading: false, block: false },
)
</script>

<style scoped>
.ds-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  height: 36px;
  padding: 0 var(--space-2);
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-m);
  background: var(--ds-surface-2);
  color: var(--ds-text-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out),
    transform var(--motion-fast) var(--ease-out);
}

.ds-btn.size-sm {
  height: 30px;
  padding: 0 var(--space-1);
  font-size: 12.5px;
}

.ds-btn.is-block {
  width: 100%;
}

.ds-btn:hover:not(:disabled) {
  background: var(--ds-surface-3);
  color: var(--ds-text-primary);
}

.ds-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.ds-btn.is-primary {
  border-color: var(--ds-interactive);
  background: var(--ds-interactive);
  color: var(--ds-on-interactive);
  box-shadow: 0 4px 14px rgba(240, 163, 94, 0.18);
}

.ds-btn.is-primary:hover:not(:disabled) {
  border-color: var(--ds-interactive-hover);
  background: var(--ds-interactive-hover);
  color: var(--ds-on-interactive);
}

.ds-btn.is-primary:active:not(:disabled) {
  border-color: var(--ds-interactive-active);
  background: var(--ds-interactive-active);
}

.ds-btn.is-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--ds-text-muted);
}

.ds-btn.is-ghost:hover:not(:disabled) {
  background: var(--ds-surface-2);
  color: var(--ds-text-primary);
}

.ds-btn.is-danger {
  border-color: #5a2a2e;
  background: var(--ds-danger-soft);
  color: var(--ds-danger);
}

.ds-btn.is-danger:hover:not(:disabled) {
  border-color: var(--ds-danger);
  background: #35191c;
}

.ds-btn:disabled {
  border-color: var(--ds-border);
  background: var(--ds-surface-2);
  color: var(--ds-text-disabled);
  box-shadow: none;
  cursor: not-allowed;
  transform: none;
}

.ds-btn-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: var(--radius-pill);
  animation: ds-spin 720ms linear infinite;
}

@keyframes ds-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ds-btn,
  .ds-btn-spinner {
    transition: none;
    animation: none;
  }
}
</style>
