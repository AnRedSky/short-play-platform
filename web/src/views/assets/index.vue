<template>
  <section class="page">
    <PageHeader kicker="ASSETS / LIBRARY" title="资产库" desc="资产是跨项目复用的最小单元：人物、场景、道具与音频都带版本、校验和与授权标记。">
      <HeadActions>
        <button class="btn" @click="load">刷新</button>
        <button class="btn primary" v-if="session.can('asset.manage')" @click="upload">登记资产</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '资产', value: assets.length },
      { label: '正式', value: assets.filter(row => row.formal).length },
      { label: '待检', value: assets.filter(row => String(row.qc).includes('待检')).length },
      { label: '需处理', value: assets.filter(row => assetRightsBlockReason(row)).length },
    ]" />

    <div class="toolbar act-bar" style="margin: 14px 0">
      <input v-model="search" class="search" placeholder="搜索资产名 / 编号 / 类型" />
      <select v-model="query.cat" class="filter">
        <option value="">分类 · 全部</option>
        <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="query.qc" class="filter">
        <option value="">质检 · 全部</option>
        <option v-for="item in qcOptions" :key="item" :value="item">{{ qcText(item) }}</option>
      </select>
      <select v-model="query.gate" class="filter">
        <option value="">放行 · 全部</option>
        <option value="ready">可进入生产</option>
        <option value="blocked">需处理授权 / 质检</option>
      </select>
      <span class="filter-count">{{ visible.length }} / {{ assets.length }} 个资产</span>
    </div>

    <div class="grid asset-grid">
      <div
        v-for="asset in visible"
        :key="asset.id"
        class="card asset-card"
        role="button"
        tabindex="0"
        :aria-label="`查看资产 ${asset.name}`"
        style="cursor: pointer"
        @click="open(asset)"
        @keydown.enter.prevent="open(asset)"
      >
        <div class="card-head">
          <div>
            <h3 class="card-title">{{ asset.name }}</h3>
            <p class="card-sub">{{ asset.cat }} · {{ asset.type }}</p>
          </div>
          <StatusPill :status="asset.status" />
        </div>
        <div class="asset-thumb">
          <span class="thumb-icon" aria-hidden="true">▧</span>
          <span class="thumb-label">暂无预览</span>
          <span class="thumb-id">{{ asset.id }} · {{ asset.version }}</span>
        </div>
        <div class="asset-meta" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px">
          <span class="tag">{{ asset.size }}</span>
          <span class="tag">引用 {{ asset.refs }}</span>
          <span class="tag">{{ qcText(asset.qc) }}</span>
        </div>
        <div class="card-sub" style="margin-top: 6px">{{ rightsText(asset.rights) }}</div>
        <p v-if="assetRightsBlockReason(asset)" class="muted text-bad" style="margin: 6px 0 0">
          需处理：{{ assetRightsBlockReason(asset) }}
        </p>
      </div>
      <EmptyState v-if="!visible.length" title="没有匹配的资产" desc="调整分类、质检或放行筛选，或重新搜索资产名与编号。" icon="▦" style="grid-column: 1/-1" />
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeAsset ? `${activeAsset.id} · ${activeAsset.name}` : '资产详情'"
      :subtitle="activeAsset ? `${activeAsset.cat} · ${activeAsset.version}` : '链接中的资产可能已被删除'"
      @close="panel.close"
    >
      <div v-if="activeAsset" style="display: grid; gap: 12px">
        <div class="act-bar">
          <button class="btn" @click="copy(activeAsset)">复制资产编号</button>
          <button class="btn" @click="$router.push('/quality/reports')">查看质检</button>
          <button class="btn" @click="panel.close">关闭</button>
        </div>

        <div v-if="activeBlock" class="notice warn">{{ activeBlock }}</div>
        <div v-else class="notice ok">授权与质检状态满足生产放行条件。</div>

        <dl class="kv-lite">
          <dt>资产</dt><dd>{{ activeAsset.id }}</dd>
          <dt>项目</dt><dd>{{ activeAsset.project || '未归属项目' }}</dd>
          <dt>分类 / 类型</dt><dd>{{ activeAsset.cat }} / {{ activeAsset.type }}</dd>
          <dt>版本</dt><dd>{{ activeAsset.version }}（共 {{ activeAsset.versions }} 版）</dd>
          <dt>来源</dt><dd>{{ activeAsset.origin }}</dd>
          <dt>创建 / 执行</dt><dd>{{ activeAsset.creator }} / {{ activeAsset.executor }}</dd>
          <dt>规格</dt><dd>{{ activeAsset.size }}</dd>
          <dt>校验和</dt><dd>{{ activeAsset.checksum }}</dd>
          <dt>质检</dt><dd>{{ qcText(activeAsset.qc) }}</dd>
          <dt>授权</dt><dd>{{ rightsText(activeAsset.rights) }}</dd>
          <dt>授权到期</dt><dd>{{ activeAsset.rightsExpiry || '未登记到期日' }}</dd>
          <dt>引用</dt><dd>{{ activeAsset.refs }} 处</dd>
          <dt>正式</dt><dd>{{ activeAsset.formal ? '是' : '否' }}</dd>
          <dt>说明</dt><dd>{{ activeAsset.note || '—' }}</dd>
        </dl>

        <div class="card" style="box-shadow: none; border: 1px solid var(--line)">
          <div class="card-head">
            <h3 class="card-title">引用关系</h3>
            <span class="pill">{{ activeAsset.refs }} 处</span>
          </div>
          <p class="card-sub" style="margin-bottom: 8px">按项目、分集、镜头与交付包回溯；引用变化需重新质检或补授权。</p>
          <p v-if="refsLoading" class="muted">正在加载引用关系…</p>
          <div v-for="ref in references" :key="`${ref.project}-${ref.object}-${ref.kind}`" class="list-row asset-ref-row">
            <span class="k">{{ ref.projectName }} · {{ ref.object }}</span>
            <span class="v"><StatusPill :status="ref.status" /></span>
            <p class="muted" style="grid-column: 1 / -1; margin: 4px 0 0">{{ ref.kind }} · {{ ref.detail }}</p>
          </div>
          <EmptyState v-if="!refsLoading && !references.length" title="暂无引用关系" desc="该资产尚未被项目、分集、镜头或交付包引用。" compact />
        </div>
      </div>
      <p v-else class="muted">资产不存在：链接中的资产可能已被删除。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { assetApi } from '../../services/assets'
import { assetRegisterBlockReason, assetRightsBlockReason } from '../../composables/assetGate'
import { useRoutePanel } from '../../composables/useRoutePanel'
import { useTableQuery } from '../../composables/useTableQuery'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatCards from '../../components/ui/StatCards.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const assets = ref<Row[]>([])
const references = ref<Row[]>([])
const refsLoading = ref(false)
const panel = useRoutePanel('asset')
const { search, filters: query, visible } = useTableQuery(assets, {
  search: (row) => `${row.name}${row.id}${row.type}`,
  filter: (row, filters) => {
    if (filters.cat && row.cat !== filters.cat) return false
    if (filters.qc && row.qc !== filters.qc) return false
    if (filters.gate === 'ready' && assetRightsBlockReason(row)) return false
    if (filters.gate === 'blocked' && !assetRightsBlockReason(row)) return false
    return true
  },
})
query.cat = ''
query.qc = ''
query.gate = ''

const categories = computed(() => {
  const list = [...new Set(assets.value.map((row) => String(row.cat ?? '')).filter(Boolean))]
  return list.length ? list : ['人物资产', '场景资产', '道具资产', '音频资产', '成片与交付资产']
})
const qcOptions = computed(() => [...new Set(assets.value.map((row) => String(row.qc ?? '')).filter(Boolean))])
const QC_TEXT: Record<string, string> = {
  PASS: '通过',
  'FAIL（合规）': '未通过（合规）',
}
function qcText(value: unknown) {
  return QC_TEXT[String(value ?? '')] ?? String(value ?? '—')
}
function rightsText(value: unknown) {
  return String(value ?? '—').replaceAll('AI 生成', '模型生成')
}
const activeAsset = computed(() => assets.value.find((row) => String(row.id) === panel.activeId.value) ?? null)
const activeBlock = computed(() => (activeAsset.value ? assetRightsBlockReason(activeAsset.value) : ''))

async function loadRefs(id: string) {
  if (!id) {
    references.value = []
    return
  }
  refsLoading.value = true
  try {
    references.value = await assetApi.references(id)
  } catch {
    references.value = []
  } finally {
    refsLoading.value = false
  }
}

async function load() {
  const [assetRows, categoryRows] = await Promise.all([
    assetApi.list(),
    assetApi.categories(),
  ])
  assets.value = assetRows.rows
  void categoryRows
  await loadRefs(panel.activeId.value)
}

function open(row: Row) {
  panel.open(String(row.id ?? ''))
}

function copy(row: Row) {
  navigator.clipboard?.writeText(String(row.id)).then(() => ui.toast('已复制资产编号'), () => ui.toast('复制失败', 'bad'))
}

function upload() {
  ui.openDialog({
    title: '登记资产',
    subtitle: '登记后进入待检队列；授权不明确、已到期或质检未通过的资产会被阻断进入生产。',
    wide: true,
    fields: [
      { key: 'name', label: '资产名', required: true },
      { key: 'cat', label: '分类', type: 'select', required: true, options: categories.value.map((value) => ({ value, label: value })) },
      { key: 'type', label: '类型', required: true, placeholder: '例如：人物参考图 / 道具参考图 / 配乐' },
      { key: 'origin', label: '来源 / 生成方式', required: true, placeholder: '例如：图像模型 I1 · 参数摘要 p-8821 / 第三方素材库' },
      { key: 'size', label: '规格', placeholder: '例如：1440×1920 · PNG' },
      { key: 'rights', label: '授权标记', required: true, type: 'textarea', rows: 2, placeholder: '例如：模型生成 · 无需真人授权 / 第三方授权 · 仅限本项目' },
      { key: 'rightsExpiry', label: '授权到期日', type: 'date', hint: '留空表示长期；已过期资产登记后仍会进入阻断状态。' },
      { key: 'note', label: '登记说明', type: 'textarea', rows: 2, placeholder: '可选：说明使用范围、授权依据或替换计划' },
    ],
    submitLabel: '登记',
    onSubmit: async (values) => {
      const reason = assetRegisterBlockReason(values)
      if (reason) throw new Error(reason)
      const created = await assetApi.create({
        ...values,
        project: projectStore.currentId,
        version: 'v1',
        versions: 1,
        qc: '待检',
        status: '待检',
        refs: 0,
        formal: false,
        creator: session.shortName,
        executor: session.shortName,
        checksum: `sha256:${Math.random().toString(16).slice(2, 10)}`,
      })
      ui.toast('资产已登记，进入待检队列')
      await load()
      panel.open(String(created.id))
    },
  })
}

watch(() => panel.activeId.value, (id) => {
  void loadRefs(id)
})
onMounted(load)
</script>

<style scoped>
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(238px, 1fr));
  gap: 14px;
}

.asset-card {
  padding: 14px;
}

.asset-ref-row.list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 8px;
}

.asset-ref-row.list-row .k {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.asset-ref-row.list-row .v {
  justify-self: end;
}

.asset-ref-row.list-row p {
  grid-column: 1 / -1;
}

.asset-thumb {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border: 1px dashed #d7e2da;
  border-radius: 8px;
  background: #f5f8f5;
  color: #7d8f83;
}

.thumb-icon {
  position: static;
  left: auto;
  bottom: auto;
  padding: 0;
  background: none;
  font-size: 18px;
  line-height: 1;
  color: #9fb1a5;
}

.thumb-label {
  position: static;
  left: auto;
  bottom: auto;
  padding: 0;
  background: none;
  color: #9aaba0;
  font-size: 10px;
}

.thumb-id {
  position: static;
  left: auto;
  bottom: auto;
  padding: 0;
  margin-left: auto;
  background: none;
  font-family: var(--mono);
  font-size: 10px;
  color: #5f7367;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
