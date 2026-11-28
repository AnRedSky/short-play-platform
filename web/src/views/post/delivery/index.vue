<template>
  <section class="page">
    <PageHeader kicker="POST / DELIVERY" title="交付包" desc="交付执行：清单齐备、终审通过、校验和留存后冻结版本；交付后不可回退。">
      <HeadActions>
        <button class="btn" @click="$router.push('/post/review')">最终审核</button>
        <button class="btn danger" v-if="session.can('delivery.execute') && projectStore.current?.status === '已完成'" @click="deliver">生成并交付</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '交付记录', value: deliveries.length },
      { label: '清单就绪', value: checklist.filter(i => i.status === '已就绪').length + ' / ' + checklist.length },
      { label: '当前状态', value: projectStore.current?.status ?? '—' },
      { label: '冻结版本', value: deliveries.filter(d => d.frozen).length },
    ]" />

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); margin-top: 18px; align-items: start">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <h3 class="card-title">交付清单</h3>
            <div class="head-inline">
              <span class="card-sub">{{ readyCount }} / {{ checklist.length }} 项已就绪</span>
              <button v-if="checklist.length" class="link-btn" @click="showAllChecklist = !showAllChecklist">
                {{ showAllChecklist ? '收起明细' : '查看明细' }}
              </button>
            </div>
          </div>
          <p v-if="checklistReady && !showAllChecklist" class="checklist-note">
            {{ checklist.length }} 项交付物均已就绪；展开明细可核对交付物与必需标记。
          </p>
          <DataTable
            v-if="showAllChecklist || !checklistReady"
            :columns="checkColumns"
            :rows="checklist"
            row-key="item"
          />
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">交付记录</h3></div>
          <DataTable
            :columns="deliveryColumns"
            :rows="deliveries"
            row-key="id"
            clickable
            @row-click="open"
          />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: projectStore.current?.status === '已完成' }">{{ projectStore.current?.status === '已完成' ? '✓' : '' }}</i><span>终审通过</span></div>
            <div class="ck"><i :class="{ on: checklistReady }">{{ checklistReady ? '✓' : '' }}</i><span>必需清单齐备</span></div>
            <div class="ck"><i class="on">✓</i><span>校验和计算并留存</span></div>
            <div class="ck"><i class="on">✓</i><span>交付后冻结，不覆盖历史</span></div>
          </div>
          <div v-if="projectStore.current?.status !== '已完成'" class="notice warn" style="margin-top: 10px">当前状态为「{{ projectStore.current?.status }}」，需终审通过后才能交付。</div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付规格</h3></div>
          <dl class="kv-lite">
            <dt>画幅</dt><dd>{{ projectStore.current?.ratio }}</dd>
            <dt>时长</dt><dd>{{ projectStore.current?.duration }}</dd>
            <dt>语言</dt><dd>{{ projectStore.current?.language }}</dd>
            <dt>字幕</dt><dd>简体中文 · 内嵌 + 外挂</dd>
            <dt>命名</dt><dd>{{ projectStore.current?.id }}_EPxx_V1.mp4</dd>
          </dl>
        </div>
      </aside>
    </div>

    <AppDrawer
      :open="panel.isOpen.value"
      :title="activeDelivery ? `交付包 ${activeDelivery.id}` : '交付包详情'"
      :subtitle="activeDelivery?.status || '未找到该交付包'"
      @close="panel.close"
    >
      <div v-if="activeDelivery" style="display: grid; gap: 12px">
        <dl class="kv-lite">
          <dt>交付包</dt><dd>{{ activeDelivery.id }}</dd>
          <dt>项目</dt><dd>{{ activeDelivery.project }}</dd>
          <dt>版本</dt><dd>{{ activeDelivery.version }}</dd>
          <dt>集数 / 文件</dt><dd>{{ activeDelivery.episodes }} 集 / {{ activeDelivery.files }} 个文件</dd>
          <dt>体积</dt><dd>{{ activeDelivery.size }}</dd>
          <dt>校验和</dt><dd>{{ activeDelivery.checksum }}</dd>
          <dt>接收方</dt><dd>{{ activeDelivery.receiver }}</dd>
          <dt>审核人</dt><dd>{{ activeDelivery.reviewer }}</dd>
          <dt>交付时间</dt><dd>{{ activeDelivery.at }}</dd>
          <dt>状态</dt><dd>{{ activeDelivery.status }}</dd>
          <dt>冻结</dt><dd>{{ activeDelivery.frozen ? '已冻结，不可覆盖' : '未冻结' }}</dd>
        </dl>
        <div class="notice info">交付包生成后冻结，历史版本保留；重新交付会创建新版本号，不覆盖当前包。</div>
      </div>
      <p v-else class="muted">记录不存在：链接中的交付包可能已删除。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { postApi } from '../../../services/post'
import { useRoutePanel } from '../../../composables/useRoutePanel'
import { deliveryBlockReason } from '../../../composables/postGate'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import DataTable, { type Column } from '../../../components/ui/DataTable.vue'
import AppDrawer from '../../../components/ui/AppDrawer.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const deliveries = ref<Row[]>([])
const checklist = ref<Row[]>([])
const showAllChecklist = ref(false)
const panel = useRoutePanel('post-delivery')
const activeDelivery = computed(() => deliveries.value.find((row) => String(row.id) === panel.activeId.value) ?? null)

const checkColumns: Column[] = [
  { key: 'item', label: '交付物' },
  { key: 'required', label: '必需', width: '56px', format: (row) => (row.required ? '是' : '否') },
  { key: 'status', label: '状态', pill: true, width: '96px' },
]

const deliveryColumns: Column[] = [
  { key: 'id', label: '交付包', mono: true, nowrap: true, width: '116px' },
  { key: 'version', label: '版本', width: '64px', nowrap: true },
  { key: 'episodes', label: '集数', width: '56px', nowrap: true },
  { key: 'status', label: '状态', pill: true, width: '96px' },
  { key: 'receiver', label: '接收方', width: '96px', nowrap: true },
  { key: 'at', label: '交付时间', mono: true, nowrap: true },
]

const readyCount = computed(() => checklist.value.filter((item) => item.status === '已就绪').length)
const checklistReady = computed(() => checklist.value.every((item) => item.status === '已就绪' || !item.required))

async function load() {
  const [deliveryRows, checkRows] = await Promise.all([
    postApi.deliveries(projectStore.currentId),
    postApi.deliveryChecklist(),
  ])
  deliveries.value = deliveryRows.rows
  checklist.value = checkRows.rows
}

function open(row: Row) {
  panel.open(String(row.id ?? ''))
}

async function deliver() {
  const blocked = deliveryBlockReason(projectStore.current, checklist.value)
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  const yes = await ui.confirm(
    '生成并交付',
    `将为《${projectStore.current?.name}》生成 ${projectStore.current?.episodes} 集交付包并冻结版本 V1。交付后不可回退。`,
    true,
  )
  if (!yes) return
  await postApi.createDelivery({ project: projectStore.currentId, episodes: projectStore.current?.episodes, receiver: '企业内容库' })
  ui.toast('交付包已生成并冻结')
  await projectStore.load()
  await load()
}

watch(() => projectStore.currentId, () => {
  if (panel.isOpen.value) panel.close()
  load()
})
onMounted(load)
</script>

<style scoped>
.head-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.checklist-note {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
