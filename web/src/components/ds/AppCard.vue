<template>
  <section class="ds-card" :class="[`tone-${tone}`, { 'is-compact': compact }]">
    <header v-if="title || subtitle || $slots.actions" class="ds-card-head">
      <div class="ds-card-heading">
        <h3 v-if="title" class="ds-card-title">{{ title }}</h3>
        <p v-if="subtitle" class="ds-card-sub">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="ds-card-actions"><slot name="actions" /></div>
    </header>
    <div class="ds-card-body"><slot /></div>
    <footer v-if="$slots.footer" class="ds-card-foot"><slot name="footer" /></footer>
  </section>
</template>

<script setup lang="ts">
/** 卡片：所有功能模块、数据区块、表单区域的唯一承载体，间距 8px 栅格。 */
withDefaults(defineProps<{ title?: string; subtitle?: string; tone?: 'default' | 'raised' | 'quiet'; compact?: boolean }>(), {
  tone: 'default',
  compact: false,
})
</script>

<style scoped>
.ds-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--ds-surface-1);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-1);
  color: var(--ds-text-secondary);
}

.ds-card.tone-raised {
  background: var(--ds-surface-2);
  box-shadow: var(--shadow-2);
}

.ds-card.tone-quiet {
  background: var(--ds-surface-2);
  box-shadow: none;
}

.ds-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) 0;
}

.ds-card.is-compact .ds-card-head {
  padding: var(--space-2) var(--space-2) 0;
}

.ds-card-heading {
  min-width: 0;
}

.ds-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--ds-text-primary);
}

.ds-card-sub {
  margin: var(--space-half) 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ds-text-muted);
}

.ds-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
}

.ds-card-body {
  flex: 1;
  min-width: 0;
  padding: var(--space-3);
}

.ds-card.is-compact .ds-card-body {
  padding: var(--space-2);
}

.ds-card-head + .ds-card-body {
  padding-top: var(--space-2);
}

.ds-card-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--ds-border);
}

.ds-card.is-compact .ds-card-foot {
  padding: var(--space-1) var(--space-2);
}
</style>
