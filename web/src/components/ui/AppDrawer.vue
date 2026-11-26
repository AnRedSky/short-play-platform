<template>
  <div v-if="open" class="modal-backdrop drawer-backdrop" @click.self="emitClose">
    <aside
      ref="drawerRef"
      class="drawer"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <div class="card-head">
        <div>
          <h3 :id="titleId" class="card-title">{{ title }}</h3>
          <p v-if="subtitle" class="card-sub">{{ subtitle }}</p>
        </div>
        <button ref="closeButton" type="button" class="btn ghost" aria-label="关闭抽屉" @click="emitClose">关闭</button>
      </div>
      <div class="drawer-body"><slot /></div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string; subtitle?: string }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const titleId = `drawer-title-${useId()}`
const drawerRef = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let previousBodyOverflow = ''

function emitClose() {
  emit('close')
}

/** 抽屉上层已有 L2 弹窗时，Esc 先交给弹窗处理，避免一次按键连关两层。 */
function hasHigherOverlay() {
  return Boolean(document.querySelector('.modal-backdrop:not(.drawer-backdrop)'))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || hasHigherOverlay()) return
  event.preventDefault()
  emitClose()
}

function release() {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = previousBodyOverflow
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      closeButton.value?.focus()
      return
    }
    release()
  },
  { immediate: true },
)

onBeforeUnmount(release)
</script>

<style scoped>
.drawer-body { display: grid; gap: 12px; }
</style>
