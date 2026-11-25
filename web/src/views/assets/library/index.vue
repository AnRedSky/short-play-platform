<template>
  <section class="page">
    <PageHeader kicker="ASSETS / LIBRARY" title="资产库" desc="资产是跨项目复用的最小单元：人物、场景、道具与音频都带版本、校验和与授权标记。">
      <HeadActions>
        <button class="btn" @click="load">刷新</button>
        <button class="btn primary" v-if="session.can('asset.manage')" @click="upload">登记资产</button>
      </HeadActions>
    </PageHeader>

    <div class="toolbar act-bar" style="margin-bottom: 14px">
      <input v-model="search" class="search" placeholder="搜索资产名 / 编号 / 类型" />
      <select v-model="cat" class="filter">
        <option value="">分类 · 全部</option>
        <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="qc" class="filter">
        <option value="">质检 · 全部</option>
        <option value="已确认">已确认</option>
        <option value="待检">待检</option>
      </select>
      <span class="filter-count">{{ visible.length }} / {{ assets.length }} 个资产</span>
    </div>

    <div class="grid grid-3">
      <div v-for="asset in visible" :key="asset.id" class="card asset-card" style="cursor: pointer" @click="open(asset)">
        <div class="card-head">
          <div>
            <h3 class="card-title">{{ asset.name }}</h3>
            <p class="card-sub">{{ asset.cat }} · {{ asset.type }}</p>
          </div>
          <StatusPill :status="asset.status" />
        </div>
        <div class="asset-thumb" style="height: 96px; border-radius: 8px; background: linear-gradient(135deg, #1b222c, #141a22); display: grid; place-items: center; color: var(--faint); font-family: var(--mono); font-size: 10px">
          {{ asset.id }} · {{ asset.version }}
        </div>
        <div class="asset-meta" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px">
          <span class="tag">{{ asset.size }}</span>
          <span class="tag">引用 {{ asset.refs }}</span>
          <span class="tag">{{ asset.qc }}</span>
        </div>
        <div class="card-sub" style="margin-top: 6px">{{ asset.rights }}</div>
      </div>
      <div v-if="!visible.length" class="empty" style="grid-column: 1/-1">没有符合条件的资产</div>
    </div>

    <AppDrawer :open="!!selected" :title="selected?.name || ''" :subtitle="selected ? `${selected.id} · ${selected.cat}` : ''" @close="selected = null">
      <div v-if="selected" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn" @click="copy(selected)">复制资产 ID</button>
          <button class="btn" @click="selected = null">关闭</button>
        </div>
        <dl class="kv-lite">
          <dt>类型</dt><dd>{{ selected.type }}</dd>
          <dt>版本</dt><dd>{{ selected.version }}（共 {{ selected.versions }} 版）</dd>
          <dt>来源</dt><dd>{{ selected.origin }}</dd>
          <dt>创建 / 执行</dt><dd>{{ selected.creator }} / {{ selected.executor }}</dd>
          <dt>规格</dt><dd>{{ selected.size }}</dd>
          <dt>校验和</dt><dd>{{ selected.checksum }}</dd>
          <dt>质检</dt><dd>{{ selected.qc }}</dd>
          <dt>授权</dt><dd>{{ selected.rights }}</dd>
          <dt>引用</dt><dd>{{ selected.refs }} 处</dd>
          <dt>正式</dt><dd>{{ selected.formal ? '是' : '否' }}</dd>
        </dl>
      </div>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { http } from '../../../api/client'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const assets = ref<Row[]>([])
const search = ref('')
const cat = ref('')
const qc = ref('')
const selected = ref<Row | null>(null)

const categories = computed(() => [...new Set(assets.value.map((row) => String(row.cat)))])
const visible = computed(() => assets.value.filter((row) => {
  if (search.value && !`${row.name}${row.id}${row.type}`.includes(search.value)) return false
  if (cat.value && row.cat !== cat.value) return false
  if (qc.value && row.qc !== qc.value) return false
  return true
}))

async function load() {
  const [assetRows, categoryRows] = await Promise.all([
    http.list<Row>('/assets', { limit: 100 }),
    http.list<Row>('/asset-categories'),
  ])
  assets.value = assetRows.rows
  void categoryRows
}

function open(row: Row) {
  selected.value = row
}

function copy(row: Row) {
  navigator.clipboard?.writeText(String(row.id)).then(() => ui.toast('已复制资产 ID'), () => ui.toast('复制失败', 'bad'))
}

function upload() {
  ui.openDialog({
    title: '登记资产',
    subtitle: '登记后进入待检队列；正式版本需质检确认。',
    fields: [
      { key: 'name', label: '资产名', required: true },
      { key: 'cat', label: '分类', type: 'select', options: [{ value: '人物资产', label: '人物资产' }, { value: '场景资产', label: '场景资产' }, { value: '道具资产', label: '道具资产' }, { value: '音频资产', label: '音频资产' }] },
      { key: 'type', label: '类型', required: true },
      { key: 'size', label: '规格', placeholder: '1440×1920 · PNG' },
      { key: 'rights', label: '授权标记', required: true, type: 'textarea' },
    ],
    submitLabel: '登记',
    onSubmit: async (values) => {
      await http.post('/assets', {
        ...values,
        project: projectStore.currentId,
        version: 'v1',
        versions: 1,
        qc: '待检',
        status: '待检',
        refs: 0,
        formal: false,
        creator: session.shortName,
        checksum: `sha256:${Math.random().toString(16).slice(2, 10)}`,
      })
      ui.toast('资产已登记')
      await load()
    },
  })
}

onMounted(load)
</script>
