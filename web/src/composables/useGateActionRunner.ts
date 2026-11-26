import type { GateAction } from '../mock/state'
import { projectApi } from '../services/projects'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'

export const GATE_DANGER_ACTIONS = ['terminate', 'archive', 'deliver']

export function isDangerAction(key: unknown) {
  return GATE_DANGER_ACTIONS.includes(String(key))
}

const PERMISSION_LABELS: Record<string, string> = {
  'creation.write': '创作编辑',
  'script.review': '剧本审核',
  'director.write': '导演编辑',
  'production.write': '生产执行',
  'post.write': '后期制作',
  'quality.operate': '质量处置',
  'final.review': '终审',
  'delivery.execute': '交付执行',
  'project.manage': '项目管理',
}

const ACTION_IMPACTS: Record<string, string> = {
  start: '项目从草稿进入创意策划，负责人和成员会收到启动通知。',
  confirmBrief: '创意方案被确认后进入剧本创作，后续修改需新建版本。',
  submitScript: '剧本进入待审核，审核人将收到待办；此时不再接受正文修改。',
  approveScript: '剧本锁定并进入生产准备，下游镜头与资产按该版本引用。',
  rejectScript: '剧本退回创作，必须写清退回原因，返工记录会写入审计。',
  confirmPlan: '镜头计划固化，下游生成任务开始按计划派发。',
  toPost: '生产阶段结束并转入后期，未完成任务会保留为阻塞项。',
  pause: '暂停后不再派发新任务，执行中的任务按服务端状态继续或回收。',
  submitQc: '进入质量检测，检测完成前不能进入终审。',
  passQc: '质量检测通过后进入待最终审核，阻断项必须全部关闭。',
  failQc: '存在阻断项时退回后期，返工原因与轮次会记账。',
  finalApprove: '终审通过后进入已完成，可生成交付包。',
  finalReject: '终审退回后期，已交付版本不会自动覆盖。',
  deliver: '生成交付包并冻结当前版本，交付后不可覆盖历史。',
  archive: '归档后项目进入只读终态，资产与审计记录保留。',
  resume: '恢复暂停前的生产状态，未完成任务重新进入调度。',
  terminate: '终止是不可逆终态，未完成任务停止，原因必须留审计。',
}

export function permissionLabel(code: unknown) {
  const key = String(code ?? '')
  return PERMISSION_LABELS[key] ? `「${PERMISSION_LABELS[key]}」` : `「${key}」`
}

export function actionImpact(action: GateAction) {
  return action.hint || ACTION_IMPACTS[action.key] || '该动作会推进项目状态并写入审计日志。'
}

export function actionTarget(action: GateAction) {
  return action.next === '__prev__' ? '暂停前状态' : `「${action.next}」`
}

function errorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message
  const text = String(err ?? '')
  return text || '服务端未返回原因'
}

export interface GateActionRunnerOptions {
  projectId: () => string
  status: () => string | undefined
  reload: () => Promise<void>
}

/**
 * 项目域关卡动作的统一执行器：L2 原因表单、L3 影响确认、成功刷新与失败提示走同一套规则。
 * 页面只负责提供当前项目、当前状态与刷新函数，避免工作台和生命周期各写一份。
 */
export function useGateActionRunner(options: GateActionRunnerOptions) {
  const ui = useUiStore()
  const projectStore = useProjectStore()

  async function finish(action: GateAction) {
    ui.toast(`${action.label} 已完成`)
    try {
      await projectStore.load()
      await options.reload()
    } catch (err) {
      ui.toast(`${action.label} 已完成，但页面刷新失败：${errorMessage(err)}`, 'info')
    }
  }

  async function run(action: GateAction) {
    const projectId = options.projectId()
    if (!projectId) {
      ui.toast('请先选择项目', 'bad')
      return
    }

    if (action.needReason) {
      ui.openDialog({
        title: action.label,
        subtitle: `当前状态「${options.status() ?? '未知'}」→ ${actionTarget(action)}。${actionImpact(action)}`,
        danger: action.key === 'terminate',
        fields: [{ key: 'reason', label: '原因', type: 'textarea', required: true, placeholder: '说明为什么执行该动作，原因会写入审计日志' }],
        submitLabel: '确认执行',
        onSubmit: async (values) => {
          await projectApi.transition(projectId, action.key, String(values.reason))
          await finish(action)
        },
      })
      return
    }

    const yes = await ui.confirm(
      action.label,
      `当前状态「${options.status() ?? '未知'}」→ ${actionTarget(action)}。${actionImpact(action)}该动作会写入审计日志。`,
      isDangerAction(action.key),
    )
    if (!yes) return

    try {
      await projectApi.transition(projectId, action.key)
      await finish(action)
    } catch (err) {
      ui.toast(`${action.label} 失败：${errorMessage(err)}`, 'bad')
    }
  }

  return { run }
}
