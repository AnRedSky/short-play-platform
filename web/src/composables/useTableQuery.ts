import { computed, reactive, ref, type Ref } from 'vue'
import type { Row } from '../mock/db'

interface TableQueryOptions<T extends Row> {
  search?: (row: T) => string
  filter?: (row: T, filters: Record<string, string>) => boolean
}

/** 列表查询统一入口：搜索、筛选、可见结果与重置，替代各页复制的 computed 过滤链。 */
export function useTableQuery<T extends Row>(source: Ref<T[]>, options: TableQueryOptions<T> = {}) {
  const search = ref('')
  const filters = reactive<Record<string, string>>({})

  const visible = computed(() => source.value.filter((row) => {
    if (search.value && !(options.search?.(row) ?? '').includes(search.value)) return false
    if (options.filter && !options.filter(row, filters)) return false
    return true
  }))

  function reset() {
    search.value = ''
    for (const key of Object.keys(filters)) delete filters[key]
  }

  return { search, filters, visible, reset }
}
