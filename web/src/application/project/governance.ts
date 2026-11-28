import type { Project, ProjectLifecycle } from '../../domain/project/types'

export type ProjectGovernanceActionKey = 'pause' | 'resume' | 'terminate' | 'archive'

export interface ProjectGovernanceAction {
  key: ProjectGovernanceActionKey
  label: string
  description: string
  danger: boolean
  target: ProjectLifecycle
}

const ACTIONS: Record<ProjectGovernanceActionKey, ProjectGovernanceAction> = {
  pause: {
    key: 'pause',
    label: '暂停项目',
    description: '暂停后停止项目级生产调度，已派发任务保留现状。',
    danger: false,
    target: 'paused',
  },
  resume: {
    key: 'resume',
    label: '恢复项目',
    description: '恢复项目调度，单集从各自当前阶段继续。',
    danger: false,
    target: 'active',
  },
  terminate: {
    key: 'terminate',
    label: '终止项目',
    description: '终止后不再允许推进生产，只保留查询和归档。',
    danger: true,
    target: 'terminated',
  },
  archive: {
    key: 'archive',
    label: '归档项目',
    description: '归档后项目退出活跃列表，历史记录保留。',
    danger: true,
    target: 'archived',
  },
}

export function allowedGovernanceActions(project: Project): ProjectGovernanceAction[] {
  switch (project.lifecycle) {
    case 'active':
      return [ACTIONS.pause, ACTIONS.terminate]
    case 'paused':
      return [ACTIONS.resume, ACTIONS.terminate, ACTIONS.archive]
    case 'terminated':
      return [ACTIONS.archive]
    case 'archived':
      return []
  }
}

export function applyGovernanceAction(
  project: Project,
  actionKey: ProjectGovernanceActionKey,
  at: string = new Date().toISOString(),
): Project {
  const action = allowedGovernanceActions(project).find((item) => item.key === actionKey)
  if (!action) throw new Error(`当前项目状态不允许执行该治理动作：${actionKey}`)
  return { ...project, lifecycle: action.target, updatedAt: at }
}
