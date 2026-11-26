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
        <p class="field-hint" style="margin-top: 8px">已勾选 {{ checkedCount }} / {{ checklist.length }} 项。结论与意见在确认弹窗中填写，退回原因必填；提交后结论与原因写入审核记录。</p>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
const checkedCount = computed(() => Object.values(checked).filter(Boolean).length)

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

function decide(result: '通过' | '退回') {
  const target = script.value
  if (!target || !reviewing.value) return
  if (result === '通过' && target.locked) {
    ui.toast('该剧本版本已锁定，请刷新后核对审核对象', 'bad')
    return
  }
  const isReject = result === '退回'
  ui.openDialog({
    title: isReject ? '确认退回修订' : '确认通过并锁定',
    subtitle: isReject
      ? `退回 ${target.id}（${target.version}），项目回到剧本创作中。`
      : `通过后 ${target.id}（${target.version}）锁定为下游唯一基准，项目进入生产准备中。`,
    danger: isReject,
    submitLabel: isReject ? '确认退回' : '通过并锁定',
    fields: [
      {
        key: 'note',
        label: isReject ? '退回原因' : '审核意见',
        type: 'textarea',
        required: isReject,
        rows: 4,
        placeholder: isReject ? '写清需修改的集/场/镜头与期望结果' : '可补充审核依据；留空也可提交',
        hint: isReject ? '退回原因必填；缺失时会在字段下方提示并将焦点移回本字段。' : '',
      },
    ],
    onSubmit: async (values) => {
      const note = String(values.note ?? '').trim()
      if (isReject && !note) throw new Error('「退回原因」为必填项')
      await creationApi.reviewScript(String(target.id), {
        result,
        note,
        checklist: Object.keys(checked).filter((key) => checked[key]),
      })
      for (const key of Object.keys(checked)) checked[key] = false
      ui.toast(isReject ? '已退回修订' : '已通过并锁定剧本')
      await projectStore.load()
      await load()
    },
  })
}

watch(() => projectStore.currentId, load)

onMounted(load)
</script>
