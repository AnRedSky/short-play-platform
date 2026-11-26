<template>
  <div class="table-wrap" :class="{ 'has-x': wide }">
    <table class="table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :style="col.width ? { width: col.width } : undefined">{{ col.label }}</th>
          <th v-if="$slots.actions" style="width: 1%"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td :colspan="columns.length + 1"><EmptyState title="正在读取数据…" desc="接口返回后本表自动刷新。" icon="…" /></td>
        </tr>
        <tr v-else-if="!rows.length">
          <td :colspan="columns.length + 1">
            <EmptyState :title="emptyTitle" :desc="emptyHint" icon="∅" />
          </td>
        </tr>
        <template v-else>
          <tr v-for="(row, index) in rows" :key="rowKey ? String(row[rowKey]) : index" :class="{ 'row-click': clickable }" @click="clickable && $emit('row-click', row)">
            <td v-for="col in columns" :key="col.key" :class="{ 'mono-cell': col.mono, 'nowrap-cell': col.nowrap }">
              <StatusPill v-if="col.pill" :status="value(row, col)" />
              <span v-else>{{ value(row, col) }}</span>
            </td>
            <td v-if="$slots.actions" @click.stop>
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import StatusPill from './StatusPill.vue'
import EmptyState from './EmptyState.vue'
import type { Row } from '../../mock/db'

export interface Column {
  key: string
  label: string
  width?: string
  mono?: boolean
  pill?: boolean
  nowrap?: boolean
  format?: (row: Row) => string | number
}

const props = withDefaults(defineProps<{
  columns: Column[]
  rows: Row[]
  rowKey?: string
  loading?: boolean
  clickable?: boolean
  wide?: boolean
  emptyTitle?: string
  emptyHint?: string
}>(), {
  loading: false,
  clickable: false,
  wide: false,
  emptyTitle: '暂无记录',
  emptyHint: '调整筛选条件或稍后重试。',
})
void props

defineEmits<{ (event: 'row-click', row: Row): void }>()

function value(row: Row, col: Column): string | number {
  if (col.format) return col.format(row)
  const raw = row[col.key]
  if (raw === undefined || raw === null || raw === '') return '—'
  if (Array.isArray(raw)) return raw.length ? raw.map((item) => (typeof item === 'object' ? item.label ?? item.name ?? '' : item)).join(' / ') : '—'
  if (typeof raw === 'object') return JSON.stringify(raw)
  return raw as string | number
}
</script>
