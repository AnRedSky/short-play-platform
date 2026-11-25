<template>
  <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
    <aside class="drawer" role="dialog" aria-modal="true">
      <div class="card-head">
        <div>
          <h3 class="card-title">{{ title }}</h3>
          <p v-if="subtitle" class="card-sub">{{ subtitle }}</p>
        </div>
        <button class="btn ghost" @click="$emit('close')">关闭</button>
      </div>
      <div class="drawer-body"><slot /></div>
    </aside>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title: string; subtitle?: string }>()
defineEmits<{ (event: 'close'): void }>()
</script>

<style scoped>
.drawer-body { display: grid; gap: 12px; }
</style>
