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
          <button v-for="version in versions" :key="version.id" class="list-row row-click" style="width: 100%; text-align: left; background: transparent; border: 0" @click="pick(version)">
            <span class="k">{{ version.version }}</span>
            <span class="v"><StatusPill :status="version.status" /> {{ version.at }}</span>
          </button>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">确认前置</h3></div>
          <div class="checklist">
            <div class="ck"><i :class="{ on: !!form.note }">{{ form.note ? '✓' : '' }}</i><span>创意说明完整</span></div>
            <div class="ck"><i :class="{ on: !!form.constraints }">{{ form.constraints ? '✓' : '' }}</i><span>约束与禁区已声明</span></div>
            <div class="ck"><i class="on">✓</i><span>受众与风格已确定</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { http } from '../../api/client'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()

const versions = ref<Row[]>([])
const modes = ref<Row[]>([])
const current = ref<Row | null>(null)
const message = ref('')

const form = reactive({ genre: '', audience: '', style: '', episodes: '', constraints: '', note: '' })

const canConfirm = computed(() => session.can('creation.write') && projectStore.current?.status === '创意策划中')

function pick(row: Row) {
  current.value = row
  form.note = String(row.note ?? '')
}

async function load() {
  const [briefs, modeRows] = await Promise.all([
    http.list<Row>('/briefs', { project: projectStore.currentId }),
    http.list<Row>('/brief-modes'),
  ])
  versions.value = briefs.rows
  modes.value = modeRows.rows
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
  await http.patch(`/briefs/${current.value?.id}`, { note: form.note, status: '已确认', at: new Date().toISOString().slice(0, 16).replace('T', ' ') })
  await http.patch(`/projects/${projectStore.currentId}`, { genre: form.genre, audience: form.audience, style: form.style, constraints: form.constraints })
  message.value = '设定已保存：题材、受众、风格与约束已同步到项目。'
  ui.toast('创意设定已保存')
  await load()
  await projectStore.load()
}

async function confirmBrief() {
  const yes = await ui.confirm('确认创意方案', '确认后项目进入「剧本创作中」，创意设定成为下游唯一基准。')
  if (!yes) return
  await http.post(`/projects/${projectStore.currentId}/transitions`, { action: 'confirmBrief' })
  ui.toast('创意方案已确认，项目进入剧本创作')
  await projectStore.load()
}

onMounted(load)
</script>
