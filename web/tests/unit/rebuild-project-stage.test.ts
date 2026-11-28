import { describe, expect, it } from 'vitest'
import {
  applyEpisodeAction,
  deriveCurrentStageKey,
  deriveEpisodeStage,
  deriveProjectPhase,
  nextEpisodeAction,
} from '../../src/domain/project/stage'
import type { EpisodeFacts } from '../../src/domain/project/types'
import { advanceEpisode, buildProjectOverview } from '../../src/application/project/overview'
import { allowedGovernanceActions, applyGovernanceAction } from '../../src/application/project/governance'
import { MockProjectRepository } from '../../src/infrastructure/mock/projectRepository'
import { seedProjects } from '../../src/infrastructure/mock/seed'

function facts(overrides: Partial<EpisodeFacts> = {}): EpisodeFacts {
  return {
    inputConfirmed: false,
    scriptLocked: false,
    assetsLocked: false,
    productionStarted: false,
    productionCompleted: false,
    editingCompleted: false,
    audioReady: false,
    subtitleApproved: false,
    qcPassed: false,
    delivered: false,
    blocked: false,
    ...overrides,
  }
}

describe('重建版单集状态机', () => {
  it('剪辑完成后进入声音字幕阶段，而不是继续停在剪辑', () => {
    const stage = deriveEpisodeStage(facts({ editingCompleted: true }))
    expect(stage.current.name).toBe('声音字幕')
    expect(stage.steps[5]?.state).toBe('current')
  })

  it('声音完成后下一步是确认字幕', () => {
    const action = nextEpisodeAction(facts({ editingCompleted: true, audioReady: true }))
    expect(action?.key).toBe('approveSubtitle')
  })

  it('资产锁定后进入素材生产等待启动', () => {
    expect(deriveCurrentStageKey(facts({ assetsLocked: true }))).toBe('production')
    expect(nextEpisodeAction(facts({ assetsLocked: true }))?.key).toBe('startProduction')
  })

  it('未确认输入时不能锁定剧本', () => {
    expect(() => applyEpisodeAction(facts(), 'lockScript')).toThrow('当前状态不允许执行该动作')
  })

  it('按顺序推进可以从素材生产进入剪辑', () => {
    const before = facts({ assetsLocked: true, productionStarted: true })
    expect(deriveEpisodeStage(before).current.name).toBe('素材生产')
    const updated = applyEpisodeAction(before, 'completeProduction')
    expect(deriveEpisodeStage(updated).current.name).toBe('剪辑')
  })

  it('已交付的单集没有后续动作', () => {
    const delivered = facts({
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: true,
      productionStarted: true,
      productionCompleted: true,
      editingCompleted: true,
      audioReady: true,
      subtitleApproved: true,
      qcPassed: true,
      delivered: true,
    })
    expect(nextEpisodeAction(delivered)).toBeNull()
  })
})

describe('重建版项目阶段推导', () => {
  it('项目阶段取未交付单集中最靠前的一集', () => {
    const project = seedProjects[0]
    const phase = deriveProjectPhase(project)
    expect(phase.stage.name).toBe('素材生产')
    expect(phase.activeEpisodeNumber).toBe(3)
    expect(phase.deliveredCount).toBe(1)
    expect(phase.totalCount).toBe(3)
  })

  it('项目概览按批次分组并保留单集阶段', () => {
    const project = seedProjects[0]
    const overview = buildProjectOverview(project)
    expect(overview.batches).toHaveLength(1)
    expect(overview.episodes.map((item) => item.episode.number)).toEqual([1, 2, 3])
    expect(overview.episodes[1]?.stage.current.name).toBe('声音字幕')
  })

  it('推进单集后项目阶段自动变化', () => {
    const project = seedProjects[0]
    const updated = advanceEpisode(project, project.episodes[2].id)
    expect(updated.episodes[2].facts.productionCompleted).toBe(true)
    expect(deriveProjectPhase(updated).stage.name).toBe('剪辑')
  })
})

describe('重建版项目治理动作', () => {
  it('进行中的项目只开放暂停和终止', () => {
    const project = seedProjects[0]
    expect(allowedGovernanceActions(project).map((item) => item.key)).toEqual(['pause', 'terminate'])
  })

  it('暂停后可以恢复', () => {
    const paused = applyGovernanceAction(seedProjects[0], 'pause')
    expect(paused.lifecycle).toBe('paused')
    expect(allowedGovernanceActions(paused).map((item) => item.key)).toContain('resume')
  })
})

describe('重建版模拟仓储', () => {
  it('保存后可以读回更新后的项目', async () => {
    const repository = new MockProjectRepository({ seed: seedProjects })
    const project = seedProjects[0]
    const updated = advanceEpisode(project, project.episodes[2].id)
    await repository.save(updated)
    const loaded = await repository.get(project.id)
    expect(loaded?.episodes[2].facts.productionCompleted).toBe(true)
  })
})
