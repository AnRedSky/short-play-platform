<template>
  <section class="page">
    <PageHeader kicker="CREATION / REVIEW A" title="剧本审核" desc="节点 A：审核结论决定项目能否进入生产准备；通过即锁定正式版本，退回必须写明原因。">
      <HeadActions>
        <button class="btn" @click="$router.push('/creation/script')">查看剧本版本</button>
        <button class="btn primary" v-if="session.can('script.review') && reviewing" @click="decide('通过')">通过并锁定</button>
        <button class="btn danger" v-if="session.can('script.review') && reviewing" @click="decide('退回')">退回修订</button>
      </HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr)">
      <div class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">审核对象</h3>
            <p class="card-sub">{{ script?.id }} · {{ script?.version }} · {{ script?.status }}</p>
          </div>
          <StatusPill :status="script?.status" />
        </div>
        <div class="grid grid-4" style="margin-bottom: 12px">
          <div class="mini-kpi"><small>集数</small><b>{{ script?.episodes ?? '—' }}</b></div>
          <div class="mini-kpi"><small>场次</small><b>{{ script?.scenes ?? '—' }}</b></div>
          <div class="mini-kpi"><small>镜头</small><b>{{ script?.shots ?? '—' }}</b></div>
          <div class="mini-kpi"><small>台词行</small><b>{{ script?.lines ?? '—' }}</b></div>
        </div>

        <div class="section-title">审核清单（7 项）</div>
        <div class="checklist">
          <div v-for="item in checklist" :key="item" class="ck">
            <i :class="{ on: checked[item] }" role="button" @click="checked[item] = !checked[item]">{{ checked[item] ? '✓' : '' }}</i>
            <span>{{ item }}</span>
          </div>
        </div>
        <p class="field-hint" style="margin-top: 8px">勾选仅表示本轮人工确认过的项目；结论与原因会写进审核记录。</p>

        <div class="field-wrap" style="margin-top: 12px">
          <label class="field-label">审核意见</label>
          <textarea v-model="note" class="field" rows="3" placeholder="说明依据；退回时必须写清要改什么"></textarea>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">审核前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: projectStore.current?.status === '待剧本审核' }">{{ projectStore.current?.status === '待剧本审核' ? '✓' : '' }}</i><span>项目处于「待剧本审核」</span></div>
            <div class="ck"><i class="on">✓</i><span>候选剧本生成完成且自检通过</span></div>
            <div class="ck"><i :class="{ on: session.can('script.review') }">{{ session.can('script.review') ? '✓' : '' }}</i><span>当前身份具备 script.review</span></div>
          </div>
          <div v-if="!reviewing" class="notice warn" style="margin-top: 10px">当前项目不在「待剧本审核」状态，本页只读。</div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">历史审核</h3></div>
          <div v-for="review in history" :key="review.id" class="list-row">
            <span class="k">{{ review.at }} · {{ review.auditor }}</span>
            <span class="v"><StatusPill :status="review.result" /> {{ review.note }}</span>
          </div>
          <EmptyState v-if="!history.length" title="暂无审核记录" desc="提交剧本审核后，结论与意见会在这里留痕。" compact />
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { creationApi } from '../../../services/creation'
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

const script = ref<Row | null>(null)
const history = ref<Row[]>([])
const checklist = ref<string[]>([])
const checked = reactive<Record<string, boolean>>({})
const note = ref('')

const reviewing = computed(() => projectStore.current?.status === '待剧本审核')

async function load() {
  const [scripts, reviews, groups] = await Promise.all([
    creationApi.scripts(projectStore.currentId),
    creationApi.reviews(projectStore.currentId),
    creationApi.reviewChecklist(),
  ])
  script.value = scripts.rows[0] ?? null
  history.value = reviews.rows
  checklist.value = (groups.rows[0]?.items ?? []) as string[]
}

async function decide(result: '通过' | '退回') {
  if (!script.value) return
  if (result === '退回' && !note.value.trim()) {
    ui.toast('退回必须填写审核意见', 'bad')
    return
  }
  const yes = await ui.confirm(`确认${result}`, result === '通过' ? '通过后剧本锁定，项目进入生产准备中。' : '退回后项目回到剧本创作中。', result === '退回')
  if (!yes) return
  await creationApi.reviewScript(String(script.value.id), { result, note: note.value, checklist: Object.keys(checked).filter((key) => checked[key]) })
  ui.toast(`已${result}`)
  await projectStore.load()
  await load()
}

onMounted(load)
</script>
