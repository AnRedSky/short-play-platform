import { describe, expect, it } from 'vitest'
import type { Row } from '../../src/mock/db'
import {
  batchOutputBlockReason,
  deliveryBlockReason,
  episodeOutputBlockReason,
  findEpisodeTimeline,
  reviewBlockReason,
  timelineQcBlockReason,
} from '../../src/composables/postGate'

const readyChecklist: Row[] = [
  { item: '完整短剧成片（整剧打包）', required: true, status: '已就绪' },
  { item: '字幕文件（含时间轴）', required: true, status: '已就绪' },
  { item: '花絮（可选）', required: false, status: '缺失' },
]

const timeline: Row = { project: 'SP-26031', ep: 16, version: 'TL-26031-E16-V3', stale: 0, status: '已输出' }

describe('postGate', () => {
  it('blocks quality submission when the timeline has stale clips', () => {
    expect(timelineQcBlockReason({ ...timeline, stale: 2 })).toContain('2 个过期片段')
  })

  it('allows quality submission for a current timeline', () => {
    expect(timelineQcBlockReason(timeline)).toBeNull()
  })

  it('finds the exact episode timeline version before falling back to the episode', () => {
    const timelines = [timeline, { ...timeline, version: 'TL-26031-E16-V4', status: '编辑中' }]
    expect(findEpisodeTimeline({ no: 16, timeline: 'TL-26031-E16-V3' }, timelines)?.status).toBe('已输出')
  })

  it('blocks output when the episode quality check is not passed', () => {
    expect(episodeOutputBlockReason({ no: 17, qc: '进行中', status: '生产中' }, timeline)).toContain('需通过质检')
  })

  it('blocks output when the timeline is stale or missing', () => {
    expect(episodeOutputBlockReason({ no: 16, qc: 'PASS', status: '已通过质检' }, { ...timeline, stale: 2 })).toContain('重建索引')
    expect(episodeOutputBlockReason({ no: 16, qc: 'PASS', status: '已通过质检' }, null)).toContain('缺少时间线')
  })

  it('blocks batch output on the first pending episode that fails a gate', () => {
    const blocked = batchOutputBlockReason(
      [{ no: 1, qc: 'PASS', status: '已通过质检' }, { no: 2, qc: '进行中', status: '生产中' }],
      [timeline, { ...timeline, ep: 1 }, { ...timeline, ep: 2 }],
    )
    expect(blocked).toContain('第 2 集')
  })

  it('allows batch output when all pending episodes are ready', () => {
    expect(batchOutputBlockReason(
      [{ no: 1, qc: 'PASS', status: '已通过质检' }, { no: 2, qc: 'PASS', status: '已输出' }],
      [{ ...timeline, ep: 1 }, { ...timeline, ep: 2 }],
    )).toBeNull()
  })

  it('blocks final approval outside the review node or with incomplete episodes', () => {
    const project = { status: '生产中', done: 16, episodes: 24, quality: '良好' }
    expect(reviewBlockReason(project, '通过', readyChecklist)).toContain('待最终审核')
    expect(reviewBlockReason({ ...project, status: '待最终审核' }, '通过', readyChecklist)).toContain('集数未完整')
  })

  it('blocks final approval when a required delivery item is missing', () => {
    const project = { status: '待最终审核', done: 24, episodes: 24, quality: '良好' }
    expect(reviewBlockReason(project, '通过', [{ item: '字幕', required: true, status: '待补' }])).toContain('字幕')
  })

  it('allows return while in review, but blocks delivery until the project is completed', () => {
    const project = { status: '待最终审核', done: 16, episodes: 24, quality: '需处理' }
    expect(reviewBlockReason(project, '退回', readyChecklist)).toBeNull()
    expect(deliveryBlockReason(project, readyChecklist)).toContain('已完成')
    expect(deliveryBlockReason({ ...project, status: '已完成' }, readyChecklist)).toBeNull()
  })
})
