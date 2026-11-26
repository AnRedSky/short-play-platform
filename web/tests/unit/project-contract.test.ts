import { describe, expect, it } from 'vitest'
import {
  toCreateDto,
  toProjectRow,
  toProjectSummary,
  toTransitionResult,
  toUpdateDto,
} from '../../src/services/projects/contract'

describe('project contract mapping', () => {
  it('maps a real backend code/title payload onto the page id/name contract', () => {
    const row = toProjectRow({
      id: '9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f',
      code: 'SP-26031',
      title: '雾城来信',
      summary: '一句话设定',
      status: 'in_review',
    })
    expect(row.id).toBe('SP-26031')
    expect(row.name).toBe('雾城来信')
    expect(row.record_id).toBe('9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f')
    expect(row.status).toBe('待剧本审核')
    expect(row.constraints).toBe('一句话设定')
    expect(row.episodes).toBe(0)
  })

  it('leaves an already-normalized mock row unchanged in the fields the page reads', () => {
    const mock = { id: 'SP-26031', name: '雾城来信', status: '生产中', episodes: 24, budget: 18000 }
    const row = toProjectRow(mock)
    expect(row.id).toBe(mock.id)
    expect(row.name).toBe(mock.name)
    expect(row.status).toBe(mock.status)
    expect(row.episodes).toBe(24)
    expect(row.budget).toBe(18000)
  })

  it('translates page create and update payloads to backend fields', () => {
    expect(toCreateDto({ name: '雾城来信', constraints: '禁止血腥', genre: '悬疑' })).toEqual({
      code: expect.stringMatching(/^SP-/),
      title: '雾城来信',
      summary: '禁止血腥',
    })
    expect(toUpdateDto({ name: '新名字', genre: '悬疑' })).toEqual({ title: '新名字' })
  })

  it('normalizes nested project objects in summary and transition responses', () => {
    const summary = toProjectSummary({
      project: { code: 'SP-1', title: '项目一', status: 'draft' },
      stages: [],
    })
    expect(summary.project).toMatchObject({ id: 'SP-1', name: '项目一', status: '草稿' })
    expect(summary.stages).toEqual([])

    const transition = toTransitionResult({
      project: { code: 'SP-1', title: '项目一', status: '生产中' },
      allowed_actions: [],
      message: '草稿 → 生产中',
    })
    expect(transition.project).toMatchObject({ id: 'SP-1', name: '项目一', status: '生产中' })
    expect(transition.message).toBe('草稿 → 生产中')
  })
})
