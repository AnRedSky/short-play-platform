<template>
  <section class="page">
    <PageHeader kicker="WORKSPACE / ASSISTANT" title="指令式生产助手" desc="把一句话变成受控的流水线动作：助手只调用受权限约束的接口，不直接改数据。">
      <HeadActions><button class="btn" @click="$router.push('/projects/workflow')">去流水线</button></HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr)">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">输入指令</h3><span class="card-sub">当前项目 {{ projectStore.current?.name }}</span></div>
          <textarea v-model="prompt" class="field" rows="3" placeholder="例：为第 17 集剩余镜头提交视频生成；检查本项目预算；列出待我审核的剧本"></textarea>
          <div class="chip-row" style="margin-top: 8px">
            <button v-for="item in presets" :key="item.label" class="chip" @click="apply(item.label)">{{ item.label }}</button>
          </div>
          <div class="act-bar" style="margin-top: 10px">
            <button class="btn primary" :disabled="running || !prompt.trim()" @click="run">{{ running ? '执行中…' : '执行指令' }}</button>
            <button class="btn" @click="prompt = ''">清空</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">执行记录</h3><span class="card-sub">本次会话</span></div>
          <EmptyState v-if="!logs.length" title="尚未执行指令" desc="输入指令并执行后，这里会保留结果与时间。" compact />
          <div v-for="log in logs" :key="log.id" class="list-row">
            <span class="k">{{ log.at }} · {{ log.prompt }}</span>
            <span class="v"><StatusPill :status="log.status" /> {{ log.result }}</span>
          </div>
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">可执行的意图</h3></div>
          <div v-for="item in capabilities" :key="item.label" class="list-row">
            <span class="k">{{ item.label }}</span>
            <span class="v">{{ item.hint }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">权限边界</h3></div>
          <div class="checklist">
            <div class="ck"><i class="on">✓</i><span>只调用受 permission 约束的接口</span></div>
            <div class="ck"><i class="on">✓</i><span>不绕过审核与交付闸门</span></div>
            <div class="ck"><i class="on">✓</i><span>每次执行写审计</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { workspaceApi } from '../../../services/workspace'
import { useSessionStore } from '../../../stores/session'
import { useProjectStore } from '../../../stores/project'
import { useUiStore } from '../../../stores/ui'
import { useRouter } from 'vue-router'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const projectStore = useProjectStore()
const ui = useUiStore()
const router = useRouter()

const prompt = ref('')
const running = ref(false)
const logs = ref<Array<{ id: number; at: string; prompt: string; status: string; result: string }>>([])
let seq = 0

const presets = [
  { label: '提交第 17 集镜头生成', intent: 'task' },
  { label: '检查预算占用', intent: 'budget' },
  { label: '列出待我审核的剧本', intent: 'review' },
  { label: '成本导出', intent: 'cost' },
]

const capabilities = [
  { label: '生产提交', hint: '生成 / 重试 / 取消任务' },
  { label: '状态查询', hint: '项目、任务、成本、通知' },
  { label: '跳转处理', hint: '按阻塞项定位页面' },
  { label: '不支持', hint: '绕过审核、代签结论' },
]

function apply(label: string) {
  prompt.value = label
}

async function run() {
  running.value = true
  const text = prompt.value.trim()
  let status = '成功'
  let result = ''
  try {
    if (/生成|镜头|任务/.test(text)) {
      await workspaceApi.createTask({ project: projectStore.currentId, kind: '视频生成', ep: 17, shot: 'SH-04', model: '视频模型 A' })
      result = '已创建 1 个视频生成任务（第 17 集）'
    } else if (/预算|成本/.test(text)) {
      const summary = await workspaceApi.costSummary()
      result = `当前成本合计 ¥${Number(summary.total || 0).toLocaleString('zh-CN')}，失败成本 ¥${Number(summary.failed || 0).toLocaleString('zh-CN')}`
    } else if (/审核|剧本/.test(text)) {
      const notifications = await workspaceApi.notifications()
      const pending = notifications.rows.filter((row) => String(row.type).includes('审核'))
      result = pending.length ? `有 ${pending.length} 条待审核：${pending.map((row) => row.title).join('；')}` : '当前没有待审核剧本'
      if (pending.length) router.push('/creation/review')
    } else if (/导出/.test(text)) {
      result = session.can('cost.export') ? '已生成成本 CSV（mock 直达下载占位）' : '当前身份缺少 cost.export 权限'
      status = session.can('cost.export') ? '成功' : '被拒绝'
    } else {
      result = '未识别意图：可尝试「提交第 17 集镜头生成」「检查预算」「列出待审核剧本」'
      status = '未识别'
    }
  } catch (error) {
    status = '失败'
    result = (error as Error).message
  } finally {
    logs.value.unshift({ id: ++seq, at: new Date().toTimeString().slice(0, 5), prompt: text, status, result })
    running.value = false
    ui.toast(result, status === '成功' ? 'ok' : 'bad')
  }
}

onMounted(() => undefined)
</script>
