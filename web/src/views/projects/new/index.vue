<template>
  <section class="page">
    <PageHeader kicker="PROJECTS / NEW" title="新建项目" desc="三步完成立项：基础信息 → 制作设定 → 预算与团队。提交后项目进入「草稿」，由流水线启动创作。">
      <HeadActions><button class="btn" @click="$router.push('/projects/list')">返回列表</button></HeadActions>
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

    <form class="card" @submit.prevent="submit">
      <div class="card-head">
        <h3 class="card-title">{{ steps[stepIndex - 1] }}</h3>
        <span class="pill">{{ Object.keys(form).length }} 个字段</span>
      </div>

      <div v-if="stepIndex === 1" class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
        <div class="field-wrap">
          <label class="field-label">项目名称 <span class="text-bad">*</span></label>
          <input v-model="form.name" class="field" placeholder="例：雾城来信" />
          <small class="field-hint">名称会进入通知、审计与交付包，后续可改但会留痕。</small>
        </div>
        <div class="field-wrap">
          <label class="field-label">题材 <span class="text-bad">*</span></label>
          <input v-model="form.genre" class="field" placeholder="悬疑 / 都市" />
        </div>
        <div class="field-wrap">
          <label class="field-label">目标受众</label>
          <input v-model="form.audience" class="field" placeholder="18–30 岁都市女性" />
        </div>
        <div class="field-wrap">
          <label class="field-label">集数 <span class="text-bad">*</span></label>
          <input v-model.number="form.episodes" class="field" type="number" min="1" max="60" />
          <small class="field-hint">企业策略：单项目上限 60 集，超出需管理员审批。</small>
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
          <label class="field-label">总预算（元） <span class="text-bad">*</span></label>
          <input v-model.number="form.budget" class="field" type="number" min="1000" step="100" />
          <small class="field-hint">按单集预算推导，超 80% 触发告警，超 100% 阻断新任务。</small>
        </div>
        <div class="field-wrap">
          <label class="field-label">归属部门</label>
          <select v-model="form.dept" class="field">
            <option v-for="dept in departments" :key="dept" :value="dept">{{ dept }}</option>
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label">项目负责人</label>
          <select v-model="form.ownerId" class="field">
            <option v-for="user in owners" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label">启动方式</label>
          <select v-model="form.startMode" class="field">
            <option value="draft">先存草稿，稍后启动</option>
            <option value="start">创建后立即启动创意策划</option>
          </select>
        </div>
      </div>

      <p v-if="error" class="form-error text-bad">{{ error }}</p>
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
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
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

const canNext = computed(() => {
  if (stepIndex.value === 1) return form.name.trim() && form.genre.trim() && Number(form.episodes) > 0
  if (stepIndex.value === 2) return true
  return Number(form.budget) > 0
})

function next() {
  if (!canNext.value) {
    error.value = stepIndex.value === 1 ? '请填写项目名称、题材与集数' : '请填写预算'
    return
  }
  error.value = ''
  stepIndex.value += 1
}

async function bootstrap() {
  const [depts, users] = await Promise.all([projectApi.departments(), projectApi.users()])
  departments.value = depts.rows.map((row) => String(row.name))
  owners.value = users.rows.filter((row) => ['项目负责人', '制作员工'].includes(String(row.role)))
}

async function submit() {
  error.value = ''
  if (!canNext.value) {
    error.value = '预算必须大于 0'
    return
  }
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
    ui.toast(`项目《${created.name}》已创建（${created.id}）`)
    router.push('/projects/workflow')
  } catch (err) {
    error.value = (err as Error).message || '创建失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

bootstrap()
</script>
