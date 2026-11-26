<template>
  <section class="page">
    <PageHeader kicker="CREATION / BRIEF" title="创意设定" desc="题材、受众、风格与内容约束在这里固化；确认后进入剧本创作，后续所有生成都以这份设定为准。">
      <HeadActions>
        <button class="btn" v-if="session.can('creation.write')" @click="save">保存设定</button>
        <button class="btn primary" v-if="canConfirm" @click="confirmBrief">确认创意方案</button>
      </HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr)">
      <div class="card">
        <div class="card-head">
          <div>
            <h3 class="card-title">当前设定</h3>
            <p class="card-sub">{{ current?.version }} · {{ current?.mode }} · 由 {{ current?.by }} 维护</p>
          </div>
          <StatusPill :status="current?.status" />
        </div>

        <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
          <div class="field-wrap">
            <label class="field-label">项目题材</label>
            <input v-model="form.genre" class="field" />
          </div>
          <div class="field-wrap">
            <label class="field-label">目标受众</label>
            <input v-model="form.audience" class="field" />
          </div>
          <div class="field-wrap">
            <label class="field-label">影像风格</label>
            <input v-model="form.style" class="field" />
          </div>
          <div class="field-wrap">
            <label class="field-label">集数与时长</label>
            <input v-model="form.episodes" class="field" />
          </div>
          <div class="field-wrap" style="grid-column: 1 / -1">
            <label class="field-label">内容约束与禁区</label>
            <textarea v-model="form.constraints" class="field" rows="2"></textarea>
          </div>
          <div class="field-wrap" style="grid-column: 1 / -1">
            <label class="field-label">创意说明</label>
            <textarea v-model="form.note" class="field" rows="4"></textarea>
            <small class="field-hint">写清主线、情绪与每集钩子；这段说明会进入创意方案与剧本生成的输入。</small>
          </div>
        </div>

        <div v-if="message" class="notice" style="margin-top: 10px">{{ message }}</div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">可用输入方式</h3></div>
          <div v-for="mode in modes" :key="mode.mode" class="list-row">
            <span class="k">{{ mode.mode }}</span>
            <span class="v">{{ mode.input }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">历史版本</h3></div>
          <button v-for="version in versions" :key="version.id" class="list-row row-click" style="width: 100%; text-align: left; background: transparent; border: 0" @click="briefPanel.open(String(version.id))">
            <span class="k">{{ version.version }}</span>
            <span class="v"><StatusPill :status="version.status" /> {{ version.at }}</span>
          </button>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">确认前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: !!form.note.trim() }">{{ form.note.trim() ? '✓' : '' }}</i><span>创意说明完整</span></div>
            <div class="ck"><i :class="{ on: !!form.constraints.trim() }">{{ form.constraints.trim() ? '✓' : '' }}</i><span>约束与禁区已声明</span></div>
            <div class="ck"><i :class="{ on: !!form.audience.trim() && !!form.style.trim() }">{{ form.audience.trim() && form.style.trim() ? '✓' : '' }}</i><span>受众与风格已确定</span></div>
          </div>
          <p v-if="missingInputs.length" class="muted" style="margin-top: 8px">确认前需补全：{{ missingInputs.join('、') }}</p>
        </div>
      </aside>
    </div>

    <AppDrawer
      :open="briefPanelOpen"
      :title="activeBrief ? `${activeBrief.version} 版本详情` : '版本详情'"
      :subtitle="activeBrief ? `${activeBrief.mode} · 由 ${activeBrief.by} 维护` : '未找到该版本'"
      @close="briefPanel.close"
    >
      <template v-if="activeBrief">
        <dl class="kv-lite">
          <dt>版本</dt><dd>{{ activeBrief.version }}</dd>
          <dt>状态</dt><dd><StatusPill :status="activeBrief.status" /></dd>
          <dt>输入方式</dt><dd>{{ activeBrief.mode }}</dd>
          <dt>维护人</dt><dd>{{ activeBrief.by }}</dd>
          <dt>维护时间</dt><dd>{{ activeBrief.at }}</dd>
          <dt>创意说明</dt><dd>{{ activeBrief.note || '未填写' }}</dd>
        </dl>
        <div class="modal-foot" style="gap: 8px">
          <button type="button" class="btn" @click="briefPanel.close">关闭</button>
          <button type="button" class="btn primary" @click="applyActiveBrief">载入到编辑区</button>
        </div>
      </template>
      <p v-else class="muted">记录不存在：链接中的版本可能已删除，或当前项目下不可见。</p>
    </AppDrawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { creationApi } from '../../services/creation'
import { projectApi } from '../../services/projects'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatusPill from '../../components/ui/StatusPill.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import { useRoutePanel } from '../../composables/useRoutePanel'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const versions = ref<Row[]>([])
const modes = ref<Row[]>([])
const plans = ref<Row[]>([])
const current = ref<Row | null>(null)
const message = ref('')
const briefPanel = useRoutePanel('creation-brief')
const briefPanelOpen = briefPanel.isOpen

const form = reactive({ genre: '', audience: '', style: '', episodes: '', constraints: '', note: '' })

const activeBrief = computed(() => versions.value.find((row) => String(row.id) === briefPanel.activeId.value) ?? null)
const chosenPlans = computed(() => plans.value.filter((row) => Boolean(row.chosen)))
const missingInputs = computed(() => {
  const missing: string[] = []
  if (!form.note.trim()) missing.push('创意说明')
  if (!form.constraints.trim()) missing.push('内容约束')
  if (!form.audience.trim() || !form.style.trim()) missing.push('受众与风格')
  if (chosenPlans.value.length !== 1) missing.push('唯一已选方案')
  return missing
})
const canConfirm = computed(() => session.can('creation.write') && projectStore.current?.status === '创意策划中')

watch(
  () => [form.note, form.constraints, form.audience, form.style].join('|'),
  () => {
    if (message.value.startsWith('确认前需补全')) message.value = ''
  },
)

function applyActiveBrief() {
  if (!activeBrief.value) return
  form.note = String(activeBrief.value.note ?? '')
  message.value = `已将 ${activeBrief.value.version} 的创意说明载入编辑区；保存后写入当前版本。`
  briefPanel.close()
}

async function load() {
  const [briefs, modeRows, planRows] = await Promise.all([
    creationApi.briefs(projectStore.currentId),
    creationApi.briefModes(),
    creationApi.creativePlans(projectStore.currentId),
  ])
  versions.value = briefs.rows
  modes.value = modeRows.rows
  plans.value = planRows.rows
  current.value = briefs.rows[0] ?? null
  form.note = String(briefs.rows[0]?.note ?? '')
  const project = projectStore.current
  form.genre = String(project?.genre ?? '')
  form.audience = String(project?.audience ?? '')
  form.style = String(project?.style ?? '')
  form.episodes = `${project?.episodes ?? ''} 集 · ${project?.duration ?? ''}`
  form.constraints = String(project?.constraints ?? '')
}

async function save() {
  await creationApi.updateBrief(String(current.value?.id), { note: form.note, status: '已确认', at: new Date().toISOString().slice(0, 16).replace('T', ' ') })
  await projectApi.update(projectStore.currentId, { genre: form.genre, audience: form.audience, style: form.style, constraints: form.constraints })
  message.value = '设定已保存：题材、受众、风格与约束已同步到项目。'
  ui.toast('创意设定已保存')
  await load()
  await projectStore.load()
}

async function confirmBrief() {
  if (!canConfirm.value) return
  if (missingInputs.value.length) {
    message.value = `确认前需补全：${missingInputs.value.join('、')}。`
    return
  }
  const yes = await ui.confirm('确认创意方案', '确认后项目进入「剧本创作中」，当前方案成为下游唯一基准；后续修改需新建版本。', true)
  if (!yes) return
  await projectApi.transition(projectStore.currentId, 'confirmBrief')
  message.value = '创意方案已确认，项目进入剧本创作。'
  ui.toast('创意方案已确认，项目进入剧本创作')
  await projectStore.load()
  await load()
}

onMounted(load)
</script>
