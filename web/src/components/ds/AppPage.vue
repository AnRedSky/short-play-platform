<template>
  <section class="ds-page">
    <header class="ds-page-head">
      <div class="ds-page-main">
        <p v-if="context" class="ds-page-context">{{ context }}</p>
        <div class="ds-page-title">
          <h1>{{ title }}</h1>
          <slot name="status" />
        </div>
        <p v-if="description" class="ds-page-desc">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ds-page-actions"><slot name="actions" /></div>
    </header>
    <div class="ds-page-body"><slot /></div>
  </section>
</template>

<script setup lang="ts">
/** 页面容器：统一标题区、正文区与卡片栅格间距，保证每个一级页面同构。 */
defineProps<{ title: string; description?: string; context?: string }>()
</script>

<style scoped>
.ds-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-3) var(--page-gutter) var(--space-5);
}

.ds-page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--ds-border);
}

.ds-page-main {
  min-width: 0;
}

.ds-page-context {
  margin: 0 0 var(--space-half);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ds-text-muted);
}

.ds-page-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.ds-page-title h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 680;
  letter-spacing: -0.01em;
  color: var(--ds-text-primary);
}

.ds-page-desc {
  margin: var(--space-1) 0 0;
  max-width: 72ch;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ds-text-muted);
}

.ds-page-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  padding-bottom: var(--space-half);
}

.ds-page-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

@media (max-width: 720px) {
.ds-page {
    padding: var(--space-2) var(--space-2) var(--space-4);
  }

  .ds-page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .ds-page-title h1 {
    font-size: 22px;
  }
}
</style>
