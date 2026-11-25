import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface FieldOption { value: string; label: string }
export interface DialogField {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date'
  options?: FieldOption[]
  value?: string | number | boolean
  required?: boolean
  hint?: string
  placeholder?: string
  rows?: number
  full?: boolean
}

export interface DialogConfig {
  title: string
  subtitle?: string
  fields?: DialogField[]
  submitLabel?: string
  wide?: boolean
  values?: Record<string, unknown>
  onSubmit?: (values: Record<string, unknown>) => Promise<void> | void
}

export interface Toast { id: number; text: string; tone: 'ok' | 'bad' | 'info' }

let toastSeq = 0

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const dialog = ref<(DialogConfig & { open: boolean }) | null>(null)
  const confirmState = ref<{ open: boolean; title: string; message: string; danger?: boolean; resolve?: (value: boolean) => void } | null>(null)

  function toast(text: string, tone: Toast['tone'] = 'ok') {
    const id = ++toastSeq
    toasts.value.push({ id, text, tone })
    window.setTimeout(() => {
      toasts.value = toasts.value.filter((item) => item.id !== id)
    }, 2600)
  }

  function openDialog(config: DialogConfig) {
    dialog.value = { ...config, open: true }
  }

  function closeDialog() {
    dialog.value = null
  }

  function confirm(title: string, message: string, danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = { open: true, title, message, danger, resolve }
    })
  }

  function settleConfirm(value: boolean) {
    confirmState.value?.resolve?.(value)
    confirmState.value = null
  }

  return { toasts, dialog, confirmState, toast, openDialog, closeDialog, confirm, settleConfirm }
})
