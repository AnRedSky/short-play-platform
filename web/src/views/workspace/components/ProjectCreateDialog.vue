<template>
  <div v-if="open" class="modal-backdrop" @click.self="requestClose">
    <form class="modal create-modal" role="dialog" aria-modal="true" :aria-labelledby="titleId" novalidate @submit.prevent="submit">
      <div class="modal-head">
        <div>
          <h3 :id="titleId">新建项目</h3>
          <p>基础信息、制作设定与预算团队同页填写，提交后项目进入「草稿」，由流水线启动创作。</p>
        </div>
        <button type="button" class="btn ghost" aria-label="关闭新建项目弹窗" @click="requestClose">✕</button>
      </div>

      <div class="modal-body">
        <p v-if="optionsError" class="pill bad">选项加载失败 · {{ optionsError }}</p>

        <section class="form-section">
          <div class="section-head">
            <h4>基础信息</h4>
            <span class="muted">名称、题材与集数会写入通知、审计与交付包</span>
          </div>
          <div class="fields">
            <div class="field-wrap">
              <label class="field-label" for="np-name">项目名称 <span class="text-bad">*</span></label>
              <input
                id="np-name"
                ref="nameInput"
                v-model="form.name"
                class="field"
                :class="{ invalid: errors.name }"
                placeholder="例：雾城来信"
                :aria-invalid="!!errors.name"
                :aria-describedby="errors.name ? 'np-name-error' : undefined"
              />
              <small v-if="errors.name" id="np-name-error" class="field-error">{{ errors.name }}</small>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-genre">题材 <span class="text-bad">*</span></label>
              <input
                id="np-genre"
                v-model="form.genre"
                class="field"
                :class="{ invalid: errors.genre }"
                placeholder="悬疑 / 都市"
                :aria-invalid="!!errors.genre"
                :aria-describedby="errors.genre ? 'np-genre-error' : undefined"
              />
              <small v-if="errors.genre" id="np-genre-error" class="field-error">{{ errors.genre }}</small>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-audience">目标受众</label>
              <input id="np-audience" v-model="form.audience" class="field" placeholder="18–30 岁都市女性" />
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-episodes">集数 <span class="text-bad">*</span></label>
              <input
                id="np-episodes"
                v-model.number="form.episodes"
                class="field"
                :class="{ invalid: errors.episodes }"
                type="number"
                min="1"
                max="60"
                :aria-invalid="!!errors.episodes"
                :aria-describedby="errors.episodes ? 'np-episodes-error' : undefined"
              />
              <small v-if="errors.episodes" id="np-episodes-error" class="field-error">{{ errors.episodes }}</small>
              <small v-else class="field-hint">单项目上限 60 集，超出需管理员审批。</small>
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-head">
            <h4>制作设定</h4>
            <span class="muted">约束会随剧本、镜头与质检口径一起流转</span>
          </div>
          <div class="fields">
            <div class="field-wrap">
              <label class="field-label" for="np-duration">单集时长</label>
              <input id="np-duration" v-model="form.duration" class="field" placeholder="90 秒 / 集" />
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-ratio">画幅与分辨率</label>
              <input id="np-ratio" v-model="form.ratio" class="field" placeholder="9:16 · 1080×1920" />
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-language">语言</label>
              <input id="np-language" v-model="form.language" class="field" placeholder="普通话" />
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-style">影像风格</label>
              <input id="np-style" v-model="form.style" class="field" placeholder="冷灰低饱和 · 手持近景" />
            </div>
            <div class="field-wrap full">
              <label class="field-label" for="np-constraints">内容约束与禁区</label>
              <textarea id="np-constraints" v-model="form.constraints" class="field" rows="2" placeholder="例：禁止血腥正面镜头；不得出现真实品牌标识"></textarea>
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-head">
            <h4>预算与团队</h4>
            <span class="muted">超 80% 触发告警，超 100% 阻断新任务</span>
          </div>
          <div class="fields">
            <div class="field-wrap">
              <label class="field-label" for="np-budget">总预算（元） <span class="text-bad">*</span></label>
              <input
                id="np-budget"
                v-model.number="form.budget"
                class="field"
                :class="{ invalid: errors.budget }"
                type="number"
                min="1000"
                step="100"
                :aria-invalid="!!errors.budget"
                :aria-describedby="errors.budget ? 'np-budget-error' : undefined"
              />
              <small v-if="errors.budget" id="np-budget-error" class="field-error">{{ errors.budget }}</small>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-dept">归属部门</label>
              <select id="np-dept" v-model="form.dept" class="field">
                <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
              </select>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-owner">项目负责人 <span class="text-bad">*</span></label>
              <select
                id="np-owner"
                v-model="form.ownerId"
                class="field"
                :class="{ invalid: errors.ownerId }"
                :aria-invalid="!!errors.ownerId"
                :aria-describedby="errors.ownerId ? 'np-owner-error' : undefined"
              >
                <option v-for="user in owners" :key="user.id" :value="user.id">{{ user.name }}</option>
              </select>
              <small v-if="errors.ownerId" id="np-owner-error" class="field-error">{{ errors.ownerId }}</small>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="np-start-mode">启动方式</label>
              <select id="np-start-mode" v-model="form.startMode" class="field">
                <option value="draft">先存草稿，稍后启动</option>
                <option value="start">创建后立即启动创意策划</option>
              </select>
            </div>
          </div>
        </section>

        <p v-if="error" class="form-error text-bad" role="alert">{{ error }}</p>
        <p class="muted footnote">* 为必填项。提交后由服务端校验必填与集数上限，前端不替代服务端校验。</p>
      </div>

      <div class="modal-foot">
        <span class="foot-note muted">3 段 · 13 项字段同页填写，窗口较矮时在弹窗内滚动查看</span>
        <div class="foot-actions">
          <button type="button" class="btn" :disabled="saving" @click="requestClose">取消</button>
          <button type="submit" class="btn primary" :disabled="saving">{{ saving ? '提交中…' : '创建项目' }}</button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { projectApi } from '../../../services/projects'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import type { Row } from '../../../mock/db'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()

const projectStore = useProjectStore()
const ui = useUiStore()
const router = useRouter()
const titleId = `create-project-title-${useId()}`
const nameInput = ref<HTMLInputElement | null>(null)
const saving = ref(false)
const error = ref('')
const optionsError = ref('')
const errors = reactive<Record<string, string>>({})
const departments = ref<string[]>([])
const owners = ref<Row[]>([])
let loadedOptions = false

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
const dirty = computed(() => JSON.stringify(form) !== initialSnapshot)

let previousFocus: HTMLElement | null = null
let previousBodyOverflow = ''
let ownsScrollLock = false

function reset() {
  Object.assign(form, {
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
  saving.value = false
  error.value = ''
  clearErrors()
}

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  // 上层还有确认弹窗时，Esc 只交给确认弹窗处理。
  if (document.querySelector('[role="alertdialog"]')) return
  event.preventDefault()
  requestClose()
}

function release() {
  window.removeEventListener('keydown', onKeydown)
  if (ownsScrollLock) {
    document.body.style.overflow = previousBodyOverflow
    ownsScrollLock = false
  }
  if (previousFocus?.isConnected) previousFocus.focus()
  previousFocus = null
}

async function loadOptions() {
  if (loadedOptions) return
  optionsError.value = ''
  try {
    const [depts, users] = await Promise.all([projectApi.departments(), projectApi.users()])
    departments.value = depts.rows.map((row) => String(row.name))
    owners.value = users.rows.filter((row) => ['项目负责人', '制作员工'].includes(String(row.role)))
    loadedOptions = true
  } catch (err) {
    optionsError.value = (err as Error).message || '部门与成员读取失败'
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      reset()
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      ownsScrollLock = true
      window.addEventListener('keydown', onKeydown)
      await loadOptions()
      await nextTick()
      nameInput.value?.focus()
      return
    }
    release()
  },
  { immediate: true },
)

onBeforeUnmount(release)

function requestClose() {
  if (saving.value) return
  if (!dirty.value) {
    emit('close')
    return
  }
  void ui.confirm('放弃未保存的项目？', '当前填写的基础信息、制作设定与预算尚未提交，关闭后这些内容会丢失。', true).then((yes) => {
    if (yes) emit('close')
  })
}

function validateAll() {
  clearErrors()
  error.value = ''
  if (!form.name.trim()) errors.name = '请填写项目名称'
  if (!form.genre.trim()) errors.genre = '请填写题材'
  const episodes = Number(form.episodes)
  if (!Number.isInteger(episodes) || episodes < 1 || episodes > 60) errors.episodes = '集数需为 1–60 的整数'
  if (!Number.isFinite(Number(form.budget)) || Number(form.budget) < 1000) errors.budget = '总预算不低于 1000 元'
  if (!form.ownerId) errors.ownerId = '请选择项目负责人'
  else if (!owners.value.some((row) => row.id === form.ownerId)) errors.ownerId = '负责人选项未加载，请稍后重试'
  const first = ['name', 'genre', 'episodes', 'budget', 'ownerId'].find((key) => errors[key])
  if (first) {
    error.value = '请修正标记字段后再提交'
    void nextTick(() => document.getElementById(`np-${first}`)?.focus())
    return false
  }
  return true
}

async function submit() {
  if (saving.value || !validateAll()) return
  saving.value = true
  error.value = ''
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
    if (form.startMode === 'start') await projectApi.transition(String(created.id), 'start')
    await projectStore.load()
    ui.toast(`项目《${created.name}》已创建（${created.id}）`)
    emit('close')
    router.push('/projects/workflow')
  } catch (err) {
    error.value = (err as Error).message || '创建失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.create-modal { width: min(1000px, 100%); }
.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: #2a323d transparent;
}
.modal-body::-webkit-scrollbar { width: 8px; }
.modal-body::-webkit-scrollbar-thumb { background: #39434f; border-radius: 8px; }
.create-modal .modal-foot { justify-content: space-between; align-items: center; }
.foot-note { font-size: var(--fs-label); }
.foot-actions { display: flex; gap: 8px; }
@media (max-width: 640px) { .foot-note { display: none; } }
.form-section + .form-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.section-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.section-head h4 { font-size: var(--fs-card); font-weight: 700; color: var(--ink); margin: 0; }
.section-head .muted { font-size: var(--fs-label); }
.fields { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 12px; }
.field-wrap.full { grid-column: 1 / -1; }
.footnote { font-size: var(--fs-label); margin-top: 10px; }
@media (max-width: 900px) {
  .fields { grid-template-columns: 1fr 1fr; }
}
</style>
