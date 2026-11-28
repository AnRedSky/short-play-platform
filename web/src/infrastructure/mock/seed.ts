import type { Episode, EpisodeFacts, Project } from '../../domain/project/types'

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

function episode(
  projectId: string,
  number: number,
  title: string,
  episodeFacts: Partial<EpisodeFacts>,
  extra: Partial<Episode> = {},
): Episode {
  return {
    id: `${projectId}-E${String(number).padStart(2, '0')}`,
    projectId,
    number,
    title,
    facts: facts(episodeFacts),
    updatedAt: '2026-11-26T10:00:00.000Z',
    ...extra,
  }
}

const mistCity: Project = {
  id: 'P-2601',
  name: '雾城来信',
  synopsis: '雨夜来信牵出旧案，三名主角在雾城追逐真相。',
  lifecycle: 'active',
  batches: [{ id: 'P-2601-B01', index: 1, label: '第一批', episodeNumbers: [1, 2, 3] }],
  episodes: [
    episode('P-2601', 1, '雨夜来信', {
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
    }, { scriptVersion: '剧本第三版', planVersion: '计划第二版', baselineVersion: '基线第一版' }),
    episode('P-2601', 2, '旧站台', {
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: true,
      productionStarted: true,
      productionCompleted: true,
      editingCompleted: true,
      audioReady: true,
    }, { scriptVersion: '剧本第二版', planVersion: '计划第一版', baselineVersion: '基线第一版' }),
    episode('P-2601', 3, '雾中列车', {
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: true,
      productionStarted: true,
    }, { scriptVersion: '剧本第一版', planVersion: '计划第一版', baselineVersion: '基线第一版' }),
  ],
  createdAt: '2026-10-18T02:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
}

const summerEdge: Project = {
  id: 'P-2602',
  name: '夏日边界',
  synopsis: '海边小镇的最后一个夏天，四个人决定把秘密留在潮汐里。',
  lifecycle: 'paused',
  batches: [{ id: 'P-2602-B01', index: 1, label: '第一批', episodeNumbers: [1, 2, 3] }],
  episodes: [
    episode('P-2602', 1, '潮汐之前', {
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
    }, { scriptVersion: '剧本第二版', planVersion: '计划第二版', baselineVersion: '基线第一版' }),
    episode('P-2602', 2, '白色球场', {
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: true,
      productionStarted: true,
      productionCompleted: true,
      editingCompleted: true,
    }, { scriptVersion: '剧本第一版', planVersion: '计划第一版', baselineVersion: '基线第一版' }),
    episode('P-2602', 3, '潮汐之后', {
      inputConfirmed: true,
      scriptLocked: true,
      assetsLocked: true,
      productionStarted: true,
      productionCompleted: true,
      editingCompleted: true,
      audioReady: true,
    }, { scriptVersion: '剧本第一版', planVersion: '计划第一版', baselineVersion: '基线第一版' }),
  ],
  createdAt: '2026-09-02T03:00:00.000Z',
  updatedAt: '2026-11-24T06:00:00.000Z',
}

export const seedProjects: Project[] = [mistCity, summerEdge]
