<template>
  <section class="page">
    <PageHeader kicker="POST / FINAL REVIEW" title="最终成片审核" desc="节点 B：终审结论直接决定交付；通过后状态进入「已完成」，退回则回到后期返工。">
      <HeadActions>
        <button class="btn" @click="$router.push('/quality/reports')">质量报告</button>
        <button class="btn primary" v-if="session.can('final.review') && projectStore.current?.status === '待最终审核'" @click="openReview('通过')">终审通过</button>
        <button class="btn danger" v-if="session.can('final.review') && projectStore.current?.status === '待最终审核'" @click="openReview('退回')">退回返工</button>
      </HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr)">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">待审成片</h3>
              <p class="card-sub">{{ projectStore.current?.name }} · {{ projectStore.current?.status }} · {{ projectStore.current?.done }}/{{ projectStore.current?.episodes }} 集</p>
            </div>
            <StatusPill :status="projectStore.current?.status" />
          </div>
          <div class="grid grid-4">
            <div class="mini-kpi"><small>集数完整</small><b>{{ projectStore.current?.done }} / {{ projectStore.current?.episodes }}</b></div>
            <div class="mini-kpi"><small>质检结论</small><b>{{ projectStore.current?.quality }}</b></div>
            <div class="mini-kpi"><small>交付清单</small><b>{{ checklist.filter(i => i.status === '已就绪').length }} / {{ checklist.length }}</b></div>
            <div class="mini-kpi"><small>预算</small><b>¥{{ Number(projectStore.current?.actual || 0).toLocaleString('zh-CN') }}</b></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">交付清单</h3><span class="card-sub">9 项，缺一不可交付</span></div>
          <div class="checklist">
            <div v-for="item in checklist" :key="item.item" class="ck">
              <i :class="{ on: item.status === '已就绪' }">{{ item.status === '已就绪' ? '✓' : '' }}</i>
              <span>{{ item.item }}<em class="muted"> · {{ item.status }}</em><em v-if="item.required" class="muted"> · 必需</em></span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">审核记录</h3></div>
          <div v-for="review in reviews" :key="review.id" class="timeline-item">
            <time>{{ review.at }}</time>
            <b>{{ review.node }} · {{ review.result }}</b>
            <p>{{ review.auditor }} · {{ review.note }}</p>
          </div>
          <EmptyState v-if="!reviews.length" title="暂无审核记录" desc="终审通过或退回后，结论与操作人会在这里留痕。" compact />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">终审前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: projectStore.current?.status === '待最终审核' }">{{ projectStore.current?.status === '待最终审核' ? '✓' : '' }}</i><span>项目处于待最终审核</span></div>
            <div class="ck"><i :class="{ on: epComplete }">{{ epComplete ? '✓' : '' }}</i><span>集数完整</span></div>
            <div class="ck"><i :class="{ on: qcPass }">{{ qcPass ? '✓' : '' }}</i><span>质检无阻断项</span></div>
            <div class="ck"><i :class="{ on: checklistReady }">{{ checklistReady ? '✓' : '' }}</i><span>必需清单齐备</span></div>
          </div>
          <div v-if="projectStore.current?.status !== '待最终审核'" class="notice warn" style="margin-top: 10px">当前项目不在「待最终审核」，终审动作会被阻断。</div>
          <div v-else class="notice" style="margin-top: 10px">通过会锁定版本并进入「已完成」；退回会回到后期返工，必须在意见中写清问题与范围。</div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">审核口径</h3></div>
          <dl class="kv-lite">
            <dt>节点</dt><dd>B · 最终成片</dd>
            <dt>范围</dt><dd>全 {{ projectStore.current?.episodes }} 集</dd>
            <dt>质检</dt><dd>{{ projectStore.current?.quality }}</dd>
            <dt>清单</dt><dd>{{ checklist.filter(i => i.status === '已就绪').length }} / {{ checklist.length }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { postApi } from '../../../services/post'
import { checklistReady as checklistIsReady, reviewBlockReason } from '../../../composables/postGate'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import type { Row } from '../../../mock/db'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const checklist = ref<Row[]>([])
const reviews = ref<Row[]>([])

const epComplete = computed(() => Number(projectStore.current?.done ?? 0) >= Number(projectStore.current?.episodes ?? 1))
const qcPass = computed(() => {
  const quality = String(projectStore.current?.quality ?? '')
  return quality.includes('良好') || quality.includes('通过')
})
const checklistReady = computed(() => checklistIsReady(checklist.value))

async function load() {
  const [checkRows, reviewRows] = await Promise.all([
    postApi.deliveryChecklist(),
    postApi.reviews(projectStore.currentId),
  ])
  checklist.value = checkRows.rows
  reviews.value = reviewRows.rows
}

function openReview(result: '通过' | '退回') {
  const blocked = reviewBlockReason(projectStore.current, result, checklist.value)
  if (blocked) {
    ui.toast(blocked, 'bad')
    return
  }
  ui.openDialog({
    title: result === '通过' ? '终审通过' : '退回返工',
    subtitle: result === '通过'
      ? `将锁定《${projectStore.current?.name}》当前版本并进入「已完成」，随后可生成交付包。`
      : `将把《${projectStore.current?.name}》退回后期返工；问题与返工范围会写入审核记录。`,
    danger: result === '退回',
    submitLabel: result === '通过' ? '确认通过' : '确认退回',
    fields: [
      {
        key: 'note',
        label: '终审意见',
        type: 'textarea',
        required: true,
        rows: 4,
        placeholder: result === '通过' ? '说明通过依据，例如集数、字幕与授权核对结果' : '写清问题、涉及集数与返工范围',
      },
      {
        key: 'checked',
        label: '核对确认',
        type: 'select',
        required: true,
        value: '未核对',
        options: [{ value: '未核对', label: '未核对' }, { value: '已核对', label: '已核对全集体检、字幕与授权' }],
      },
    ],
    onSubmit: async (values) => {
      const current = reviewBlockReason(projectStore.current, result, checklist.value)
      if (current) throw new Error(current)
      if (String(values.checked) !== '已核对') throw new Error('请先确认已核对全集体检、字幕与授权材料')
      await postApi.createReview({
        project: projectStore.currentId,
        result,
        note: String(values.note ?? '').trim(),
      })
      ui.toast(`终审已${result}`)
      await projectStore.load()
      await load()
    },
  })
}

onMounted(load)
watch(() => projectStore.currentId, load)
</script>
