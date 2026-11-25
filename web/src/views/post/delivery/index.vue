<template>
  <section class="page">
    <PageHeader kicker="POST / DELIVERY" title="交付包" desc="交付执行：清单齐备、终审通过、校验和留存后冻结版本；交付后不可回退。">
      <HeadActions>
        <button class="btn" @click="$router.push('/post/review')">最终审核</button>
        <button class="btn primary" v-if="session.can('delivery.execute') && projectStore.current?.status === '已完成'" @click="deliver">生成并交付</button>
      </HeadActions>
    </PageHeader>

    <StatCards :items="[
      { label: '交付记录', value: deliveries.length },
      { label: '清单就绪', value: checklist.filter(i => i.status === '已就绪').length + ' / ' + checklist.length },
      { label: '当前状态', value: projectStore.current?.status ?? '—' },
      { label: '冻结版本', value: deliveries.filter(d => d.frozen).length },
    ]" />

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); margin-top: 18px">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付清单</h3><span class="card-sub">缺项会阻断交付动作</span></div>
          <DataTable :columns="[{ key: 'item', label: '交付物' }, { key: 'required', label: '必需', format: (row) => (row.required ? '是' : '否') }, { key: 'status', label: '状态', pill: true }]" :rows="checklist" row-key="item" />
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">交付记录</h3></div>
          <DataTable
            :columns="[
              { key: 'id', label: '交付包', mono: true },
              { key: 'project', label: '项目' },
              { key: 'version', label: '版本' },
              { key: 'episodes', label: '集数' },
              { key: 'size', label: '体积' },
              { key: 'checksum', label: '校验和', mono: true },
              { key: 'status', label: '状态', pill: true },
              { key: 'receiver', label: '接收方' },
            ]"
            :rows="deliveries"
            row-key="id"
            wide
          />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: projectStore.current?.status === '已完成' }">{{ projectStore.current?.status === '已完成' ? '✓' : '' }}</i><span>终审通过（已完成）</span></div>
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
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { postApi } from '../../../services/post'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import StatCards from '../../../components/ui/StatCards.vue'
import DataTable from '../../../components/ui/DataTable.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const deliveries = ref<Row[]>([])
const checklist = ref<Row[]>([])

const checklistReady = computed(() => checklist.value.every((item) => item.status === '已就绪' || !item.required))

async function load() {
  const [deliveryRows, checkRows] = await Promise.all([
    postApi.deliveries(),
    postApi.deliveryChecklist(),
  ])
  deliveries.value = deliveryRows.rows
  checklist.value = checkRows.rows
}

async function deliver() {
  if (!checklistReady.value) {
    ui.toast('交付清单存在缺项，无法交付', 'bad')
    return
  }
  const yes = await ui.confirm('生成并交付', `将为《${projectStore.current?.name}》生成 ${projectStore.current?.episodes} 集交付包并冻结版本 V1。交付后不可回退。`)
  if (!yes) return
  await postApi.createDelivery({ project: projectStore.currentId, episodes: projectStore.current?.episodes, receiver: '企业内容库' })
  ui.toast('交付包已生成并冻结')
  await projectStore.load()
  await load()
}

onMounted(load)
</script>
