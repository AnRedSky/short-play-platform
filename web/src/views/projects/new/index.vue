<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / NEW" title="新建项目" desc="三步完成立项：基础信息 → 制作设定 → 预算与团队。提交后项目进入「草稿」，由流水线启动创作。">
      <HeadActions><button class="btn" @click="$router.push('/workspace/home')">返回工作台</button></HeadActions>
    </PageHeader>

    <div class="card" style="margin-bottom: 16px">
      <div class="four-steps" style="display: flex; gap: 10px">
        <div v-for="(step, index) in steps" :key="step" class="four-step" style="flex: 1; opacity: index + 1 > stepIndex ? 0.55 : 1">
          <em class="fs-no">{{ index + 1 }}</em>
          <b>{{ step }}</b>
          <small>{{ index + 1 === stepIndex ? '正在填写' : index + 1 < stepIndex ? '已完成' : '待填写' }}</small>
        </div>
      </div>
    </div>

    <form class="card" novalidate @submit.prevent="submit">
      <div class="card-head">
        <h3 class="card-title">{{ steps[stepIndex - 1] }}</h3>
        <span v-if="dirty" class="pill warn">有未保存修改</span>
        <span class="pill">{{ Object.keys(form).length }} 个字段</span>
      </div>

      <div v-if="stepIndex === 1" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div class="field-wrap">
          <label class="field-label" for="project-name">项目名称 <span class="text-bad">*</span></label>
          <input id="project-name" v-model="form.name" class="field" :class="{ invalid: errors.name }" placeholder="例：雾城来信" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'project-name-error' : undefined" />
          <small v-if="errors.name" id="project-name-error" class="field-error">{{ errors.name }}</small>
          <small v-else class="field-hint">名称会进入通知、审计与交付包，后续可改但会留痕。</small>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-genre">题材 <span class="text-bad">*</span></label>
          <input id="project-genre" v-model="form.genre" class="field" :class="{ invalid: errors.genre }" placeholder="悬疑 / 都市" :aria-invalid="!!errors.genre" :aria-describedby="errors.genre ? 'project-genre-error' : undefined" />
          <small v-if="errors.genre" id="project-genre-error" class="field-error">{{ errors.genre }}</small>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-audience">目标受众</label>
          <input id="project-audience" v-model="form.audience" class="field" placeholder="18–30 岁都市女性" />
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-episodes">集数 <span class="text-bad">*</span></label>
          <input id="project-episodes" v-model.number="form.episodes" class="field" :class="{ invalid: errors.episodes }" type="number" min="1" max="60" :aria-invalid="!!errors.episodes" :aria-describedby="errors.episodes ? 'project-episodes-error' : undefined" />
          <small v-if="errors.episodes" id="project-episodes-error" class="field-error">{{ errors.episodes }}</small>
          <small v-else class="field-hint">企业策略：单项目上限 60 集，超出需管理员审批。</small>
        </div>
      </div>

      <div v-if="stepIndex === 2" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div class="field-wrap">
          <label class="field-label">单集时长</label>
          <input v-model="form.duration" class="field" placeholder="90 秒 / 集" />
        </div>
        <div class="field-wrap">
          <label class="field-label">画幅与分辨率</label>
          <input v-model="form.ratio" class="field" placeholder="9:16 · 1080×1920" />
        </div>
        <div class="field-wrap">
          <label class="field-label">语言</label>
          <input v-model="form.language" class="field" placeholder="普通话" />
        </div>
        <div class="field-wrap">
          <label class="field-label">影像风格</label>
          <input v-model="form.style" class="field" placeholder="冷灰低饱和 · 手持近景" />
        </div>
        <div class="field-wrap" style="grid-column: 1 / -1">
          <label class="field-label">内容约束与禁区</label>
          <textarea v-model="form.constraints" class="field" rows="3" placeholder="例：禁止血腥正面镜头；不得出现真实品牌标识"></textarea>
          <small class="field-hint">约束会随剧本、镜头与质检口径一起流转，缺失时下游无法判定合规。</small>
        </div>
      </div>

      <div v-if="stepIndex === 3" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div class="field-wrap">
          <label class="field-label" for="project-budget">总预算（元） <span class="text-bad">*</span></label>
          <input id="project-budget" v-model.number="form.budget" class="field" :class="{ invalid: errors.budget }" type="number" min="1000" step="100" :aria-invalid="!!errors.budget" :aria-describedby="errors.budget ? 'project-budget-error' : undefined" />
          <small v-if="errors.budget" id="project-budget-error" class="field-error">{{ errors.budget }}</small>
          <small v-else class="field-hint">按单集预算推导，超 80% 触发告警，超 100% 阻断新任务。</small>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-dept">归属部门</label>
          <select id="project-dept" v-model="form.dept" class="field">
            <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-owner">项目负责人</label>
          <select id="project-owner" v-model="form.ownerId" class="field" :class="{ invalid: errors.ownerId }" :aria-invalid="!!errors.ownerId" :aria-describedby="errors.ownerId ? 'project-owner-error' : undefined">
            <option v-for="user in owners" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
          <small v-if="errors.ownerId" id="project-owner-error" class="field-error">{{ errors.ownerId }}</small>
        </div>
        <div class="field-wrap">
          <label class="field-label" for="project-start-mode">启动方式</label>
          <select id="project-start-mode" v-model="form.startMode" class="field">
            <option value="draft">先存草稿，稍后启动</option>
            <option value="start">创建后立即启动创意策划</option>
          </select>
        </div>
      </div>

      <p v-if="error" class="form-error text-bad" role="alert">{{ error }}</p>
      <p class="muted" style="font-size: 11px; margin-top: 6px">* 为必填项。提交后由服务端校验必填与集数上限，前端不替代服务端校验。</p>

      <div class="modal-foot" style="gap: 8px">
        <button v-if="stepIndex > 1" type="button" class="btn" @click="stepIndex -= 1">上一步</button>
        <button v-if="stepIndex < 3" type="button" class="btn primary" @click="next">下一步</button>
        <button v-else type="submit" class="btn primary" :disabled="saving">{{ saving ? '提交中…' : '创建项目' }}</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import type { Row } from '../../../mock/db'

const projectStore = useProjectStore()
const ui = useUiStore()
const router = useRouter()

const steps = ['基础信息', '制作设定', '预算与团队']
const stepIndex = ref(1)
const saving = ref(false)
const error = ref('')
const errors = reactive<Record<string, string>>({})
const saved = ref(false)
const departments = ref<string[]>([])
const owners = ref<Row[]>([])

const form = reactive({
  name: '',
  genre: '',
  audience: '',
  episodes: 24,
  duration: '90 秒 / 集',
  ratio: '9:16 · 1080×1920',
  language: '普通话',
  style: '',
  constraints: '',
  budget: 18000,
  dept: '内容创新部',
  ownerId: 'u-01',
  startMode: 'draft',
})
const initialSnapshot = JSON.stringify(form)
const dirty = computed(() => !saved.value && JSON.stringify(form) !== initialSnapshot)

const STEP_FIELDS: Record<number, string[]> = {
  1: ['name', 'genre', 'episodes'],
  2: [],
  3: ['budget', 'ownerId'],
}

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

function validateStep(step: number) {
  clearErrors()
  error.value = ''
  if (step === 1) {
    if (!form.name.trim()) errors.name = '请填写项目名称'
    if (!form.genre.trim()) errors.genre = '请填写题材'
    const episodes = Number(form.episodes)
    if (!Number.isInteger(episodes) || episodes < 1 || episodes > 60) errors.episodes = '集数需为 1–60 的整数'
  }
  if (step === 3) {
    if (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 1000) errors.budget = '总预算不低于 1000 元'
    if (!form.ownerId) errors.ownerId = '请选择项目负责人'
  }
  const first = STEP_FIELDS[step].find((key) => errors[key])
  if (first) {
    error.value = '请修正标记字段后再继续'
    void nextTick(() => document.getElementById(`project-${first}`)?.focus())
    return false
  }
  return true
}

function validateAll() {
  for (const step of [1, 2, 3]) {
    if (!validateStep(step)) {
      stepIndex.value = step
      return false
    }
  }
  return true
}

function next() {
  if (!validateStep(stepIndex.value)) return
  stepIndex.value += 1
}

async function bootstrap() {
  const [depts, users] = await Promise.all([projectApi.departments(), projectApi.users()])
  departments.value = depts.rows.map((row) => String(row.name))
  owners.value = users.rows.filter((row) => ['项目负责人', '制作员工'].includes(String(row.role)))
}

async function submit() {
  error.value = ''
  if (!validateAll()) return
  saving.value = true
  try {
    const created = await projectApi.create({
      name: form.name,
      genre: form.genre,
      audience: form.audience,
      episodes: Number(form.episodes),
      duration: form.duration,
      ratio: form.ratio,
      language: form.language,
      style: form.style,
      constraints: form.constraints,
      budget: Number(form.budget),
      actual: 0,
      estimated: 0,
      status: '草稿',
      phase: '创意策划',
      done: 0,
      delivered: 0,
      quality: '未检测',
      ownerId: form.ownerId,
      owner: owners.value.find((row) => row.id === form.ownerId)?.name,
      dept: form.dept,
      budgetState: '正常',
      created: new Date().toISOString().slice(0, 10),
      updated: new Date().toISOString().slice(0, 16).replace('T', ' '),
      members: [{ userId: form.ownerId, role: '管理' }],
    })
    projectStore.select(String(created.id))
    if (form.startMode === 'start') {
      await projectApi.transition(String(created.id), 'start')
    }
    await projectStore.load()
    saved.value = true
    ui.toast(`项目《${created.name}》已创建（${created.id}）`)
    router.push('/projects/workflow')
  } catch (err) {
    error.value = (err as Error).message || '创建失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return ui.confirm('放弃未保存的项目？', '当前填写的名称、设定与预算尚未提交，离开后这些内容会丢失。', true)
})

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await bootstrap()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
