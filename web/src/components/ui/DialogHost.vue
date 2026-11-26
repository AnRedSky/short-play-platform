<template>
  <div>
    <div v-if="ui.dialog?.open" class="modal-backdrop" @click.self="ui.closeDialog()">
      <form
        ref="dialogRef"
        class="modal"
        :class="{ wide: ui.dialog.wide }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="dialogTitleId"
        @submit.prevent="submit"
      >
        <div class="modal-head">
          <div>
            <h3 :id="dialogTitleId">{{ ui.dialog.title }}</h3>
            <p v-if="ui.dialog.subtitle">{{ ui.dialog.subtitle }}</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭弹窗" @click="ui.closeDialog()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div v-for="field in ui.dialog.fields || []" :key="field.key" class="field-wrap" :class="{ full: field.full || field.type === 'textarea' }">
              <label class="field-label" :for="`dlg-${field.key}`">{{ field.label }}<span v-if="field.required" class="text-bad">*</span></label>
              <select v-if="field.type === 'select'" :id="`dlg-${field.key}`" v-model="values[field.key]" class="field" :aria-invalid="invalidKey === field.key">
                <option v-for="option in field.options || []" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <textarea v-else-if="field.type === 'textarea'" :id="`dlg-${field.key}`" v-model="values[field.key]" :rows="field.rows || 3" class="field" :placeholder="field.placeholder" :aria-invalid="invalidKey === field.key"></textarea>
              <input v-else-if="field.type === 'checkbox'" :id="`dlg-${field.key}`" v-model="values[field.key]" type="checkbox" />
              <input v-else :id="`dlg-${field.key}`" v-model="values[field.key]" :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'" class="field" :placeholder="field.placeholder" :aria-invalid="invalidKey === field.key" />
              <small v-if="field.hint" class="field-hint">{{ field.hint }}</small>
            </div>
          </div>
          <p v-if="error" class="form-error text-bad" role="alert">{{ error }}</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="ui.closeDialog()">取消</button>
          <button type="submit" class="btn" :class="ui.dialog.danger ? 'danger' : 'primary'" :disabled="submitting">{{ submitting ? '提交中…' : ui.dialog.submitLabel || '确认提交' }}</button>
        </div>
      </form>
    </div>

    <div v-if="ui.confirmState?.open" class="modal-backdrop" @click.self="ui.settleConfirm(false)">
      <div class="modal" role="alertdialog" aria-modal="true" :aria-labelledby="confirmTitleId" style="width: min(460px, 100%)">
        <div class="modal-head">
          <div>
            <h3 :id="confirmTitleId">{{ ui.confirmState.title }}</h3>
            <p>{{ ui.confirmState.message }}</p>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" @click="ui.settleConfirm(false)">取消</button>
          <button class="btn" :class="ui.confirmState.danger ? 'danger' : 'primary'" @click="ui.settleConfirm(true)">确认</button>
        </div>
      </div>
    </div>

    <div class="toast-root">
      <div v-for="toast in ui.toasts" :key="toast.id" class="toast" :class="{ bad: toast.tone === 'bad' }">{{ toast.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import { useUiStore } from '../../stores/ui'

const ui = useUiStore()
const dialogRef = ref<HTMLFormElement | null>(null)
const dialogTitleId = `dialog-title-${useId()}`
const confirmTitleId = `confirm-title-${useId()}`
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 动态表单字段值类型由 DialogField 决定
const values = reactive<Record<string, any>>({})
const error = ref('')
const invalidKey = ref('')
const submitting = ref(false)
let previousFocus: HTMLElement | null = null
let previousBodyOverflow = ''
let ownsScrollLock = false

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  if (ui.confirmState?.open) {
    ui.settleConfirm(false)
    return
  }
  if (ui.dialog?.open) ui.closeDialog()
}

function release() {
  window.removeEventListener('keydown', onKeydown)
  if (ownsScrollLock) {
    document.body.style.overflow = previousBodyOverflow
    ownsScrollLock = false
  }
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

watch(
  () => Boolean(ui.dialog?.open || ui.confirmState?.open),
  async (open) => {
    if (open) {
      if (!ownsScrollLock) {
        previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
        previousBodyOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        ownsScrollLock = true
      }
      window.removeEventListener('keydown', onKeydown)
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      if (ui.confirmState?.open) {
        document.querySelector<HTMLElement>('[role="alertdialog"] .btn.primary, [role="alertdialog"] .btn.danger, [role="alertdialog"] .btn')?.focus()
      } else {
        dialogRef.value?.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea, input[type="checkbox"]')?.focus()
      }
      return
    }
    release()
  },
  { immediate: true },
)

onBeforeUnmount(release)

watch(
  () => ui.dialog,
  async (dialog) => {
    error.value = ''
    invalidKey.value = ''
    for (const key of Object.keys(values)) delete values[key]
    if (!dialog) return
    for (const field of dialog.fields || []) {
      values[field.key] = field.value ?? (field.type === 'checkbox' ? false : field.type === 'select' ? field.options?.[0]?.value ?? '' : '')
    }
    Object.assign(values, dialog.values ?? {})
  },
  { deep: true },
)

async function submit() {
  if (!ui.dialog) return
  for (const field of ui.dialog.fields || []) {
    if (field.required && !String(values[field.key] ?? '').trim()) {
      invalidKey.value = field.key
      error.value = `「${field.label}」为必填项`
      await nextTick()
      document.getElementById(`dlg-${field.key}`)?.focus()
      return
    }
  }
  invalidKey.value = ''
  submitting.value = true
  error.value = ''
  try {
    await ui.dialog.onSubmit?.(values)
    ui.closeDialog()
  } catch (err) {
    error.value = (err as Error).message || '提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.modal-body { overflow-y: auto; min-height: 0; }
</style>
