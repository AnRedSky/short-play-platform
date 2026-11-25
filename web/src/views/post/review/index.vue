<template>
  <section class="page">
    <PageHeader kicker="POST / FINAL REVIEW" title="最终成片审核" desc="节点 B：终审结论直接决定交付；通过后状态进入「已完成」，退回则回到后期返工。">
      <HeadActions>
        <button class="btn" @click="$router.push('/quality/reports')">质量报告</button>
        <button class="btn" v-if="session.can('final.review') && projectStore.current?.status === '待最终审核'" @click="decide('通过')">终审通过</button>
        <button class="btn" v-if="session.can('final.review') && projectStore.current?.status === '待最终审核'" @click="decide('退回')">退回返工</button>
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
          <div v-if="!reviews.length" class="empty">暂无审核记录</div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">终审意见</h3></div>
          <div class="field-wrap">
            <label class="field-label">结论说明</label>
            <textarea v-model="note" class="field" rows="4" placeholder="通过需说明依据；退回需写清问题与返工范围"></textarea>
          </div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: epComplete }">{{ epComplete ? '✓' : '' }}</i><span>集数完整</span></div>
            <div class="ck"><i :class="{ on: qcPass }">{{ qcPass ? '✓' : '' }}</i><span>质检无阻断项</span></div>
            <div class="ck"><i :class="{ on: checklistReady }">{{ checklistReady ? '✓' : '' }}</i><span>交付清单齐备</span></div>
          </div>
          <div v-if="projectStore.current?.status !== '待最终审核'" class="notice warn" style="margin-top: 10px">项目当前不在「待最终审核」，终审动作会被服务端拒绝。</div>
        </div>
      </aside>
    </div>
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
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const checklist = ref<Row[]>([])
const reviews = ref<Row[]>([])
const note = ref('')

const epComplete = computed(() => Number(projectStore.current?.done ?? 0) >= Number(projectStore.current?.episodes ?? 1))
const qcPass = computed(() => String(projectStore.current?.quality ?? '').includes('良好') || String(projectStore.current?.quality ?? '').includes('通过'))
const checklistReady = computed(() => checklist.value.every((item) => item.status === '已就绪' || !item.required))

async function load() {
  const [checkRows, reviewRows] = await Promise.all([
    http.list<Row>('/delivery-checklist'),
    http.list<Row>('/reviews', { project: projectStore.currentId }),
  ])
  checklist.value = checkRows.rows
  reviews.value = reviewRows.rows
}

async function decide(result: '通过' | '退回') {
  if (!note.value.trim()) {
    ui.toast('请先填写终审意见', 'bad')
    return
  }
  const yes = await ui.confirm(`确认${result}`, result === '通过' ? '通过后进入「已完成」，可生成交付包。' : '退回后回到后期返工。', result === '退回')
  if (!yes) return
  await http.post('/reviews', { project: projectStore.currentId, result, note: note.value })
  ui.toast(`终审已${result}`)
  await projectStore.load()
  await load()
}

onMounted(load)
</script>
