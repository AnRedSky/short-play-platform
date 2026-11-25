<template>
  <span class="pill" :class="tone">{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status?: string | number | null }>()

const text = computed(() => (props.status === undefined || props.status === null || props.status === '' ? '—' : String(props.status)))

const tone = computed(() => {
  const value = text.value
  if (/已交付|已通过|通过$|^PASS$|已完成|有效|正常|已确认|启用|成功|已归档|正式|良好$/.test(value)) return 'ok'
  if (/异常|失败|阻断|高风险|已终止|驳回|退回|超限|逾期|未闭环/.test(value)) return 'bad'
  if (/待|审核|执行中|排队中|处理中|进行中|生成中|升级|警告|暂停|中断|待检|未/.test(value)) return 'warn'
  if (/已暂停|已归档|草稿/.test(value)) return ''
  return 'info'
})
</script>
