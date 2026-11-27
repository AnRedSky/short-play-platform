import { describe, expect, it } from 'vitest'
import {
  toBatchPackage,
  toBatchTrial,
  toCreateDto,
  toEpisodeActionResult,
  toProjectRow,
  toProjectSummary,
  toTransitionResult,
  toUpdateDto,
} from '../../src/services/projects/contract'

describe('project contract mapping', () => {
  it('maps the B-01 backend DTO onto the page shape', () => {
    const row = toProjectRow({
      id: 'SP-26031',
      record_id: '9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f',
      name: '雾城来信',
      genre: '悬疑',
      episodes: 24,
      budget: 18000,
      owner: '林知远',
      phase: '视频生产',
      created: '2026-10-02',
      updated: '2026-11-22 10:42',
      status: 'in_review',
    })
    expect(row.id).toBe('SP-26031')
    expect(row.name).toBe('雾城来信')
    expect(row.record_id).toBe('9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f')
    expect(row.episodes).toBe(24)
    expect(row.owner).toBe('林知远')
    expect(row.status).toBe('待剧本审核')
  })

  it('maps a legacy code/title payload during the compatibility window', () => {
    const row = toProjectRow({
      id: '9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f',
      code: 'SP-26031',
      title: '雾城来信',
      summary: '一句话设定',
      status: 'draft',
    })
    expect(row.id).toBe('SP-26031')
    expect(row.name).toBe('雾城来信')
    expect(row.record_id).toBe('9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f')
    expect(row.status).toBe('草稿')
    expect(row.constraints).toBe('一句话设定')
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
    expect(
      toCreateDto({
        name: '雾城来信',
        summary: '一句话设定',
        constraints: '禁止血腥',
        genre: '悬疑',
        episodes: 24,
        budget: 18000,
      }),
    ).toEqual({
      code: expect.stringMatching(/^SP-/),
      name: '雾城来信',
      summary: '一句话设定',
      genre: '悬疑',
      audience: '',
      episodes: 24,
      duration: '',
      ratio: '',
      language: '',
      style: '',
      constraints: '禁止血腥',
      budget: 18000,
    })
    expect(toUpdateDto({ name: '新名字', genre: '悬疑', episodes: '24', budget: '18000' })).toEqual({
      name: '新名字',
      genre: '悬疑',
      episodes: '24',
      budget: '18000',
    })
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

  it('normalizes episode actions from either mock rows or backend wrappers', () => {
    const result = toEpisodeActionResult({
      state: { ep: '19', batch: '4', current_step: 'E3', status: '生产中' },
      episode: { no: 19, title: '雨夜来客' },
      message: 'lockAssets 已完成',
    })
    expect(result.state).toMatchObject({ ep: 19, batch: 4, currentStep: 'E3' })
    expect(result.episode).toMatchObject({ no: 19 })
    expect(result.message).toBe('lockAssets 已完成')
  })

  it('normalizes batch trial wrappers and light rows into one page shape', () => {
    const trial = toBatchTrial({
      trial: {
        id: 'BT-26031-B4',
        project: 'SP-26031',
        batch: '4',
        size: '3',
        episodes: ['19', '20', '21'],
        delivery_gate: '0/3 集已交付',
        checks: [{ key: 'script', label: '剧本锁定', pass: 1, detail: '3/3' }],
        created_at: '2026-11-27 10:00',
      },
    })
    expect(trial).toMatchObject({
      id: 'BT-26031-B4',
      batch: 4,
      size: 3,
      episodes: [19, 20, 21],
      deliveryGate: '0/3 集已交付',
      createdAt: '2026-11-27 10:00',
    })
    expect(trial.checks[0]).toEqual({
      key: 'script',
      label: '剧本锁定',
      pass: true,
      detail: '3/3',
    })
    expect(toBatchTrial({ id: 'BT-1', batch: 1, episodes: [1, 2] }).episodes).toEqual([1, 2])
  })

  it('normalizes batch package wrappers, snake_case and missing episodes', () => {
    const blocked = toBatchPackage({
      package: {
        id: 'BP-26031-B1',
        batch: '1',
        status: '待补齐',
        missing: ['E05', 'E06'],
      },
    })
    expect(blocked).toMatchObject({
      id: 'BP-26031-B1',
      batch: 1,
      status: '待补齐',
      missing: ['E05', 'E06'],
    })

    const ready = toBatchPackage({
      id: 'BP-26031-B2',
      kind: '批次包',
      file_count: '6',
      frozen: true,
    })
    expect(ready).toMatchObject({ id: 'BP-26031-B2', kind: '批次包', files: 6, frozen: true })
  })

  it('applies batch mappers to nested summary collections', () => {
    const summary = toProjectSummary({
      project: { code: 'SP-26031', name: '雾城来信', status: '生产中' },
      batchTrials: [{ trial: { id: 'BT-26031-B4', batch: '4', episodes: ['19'] } }],
      deliveries: [
        { package: { id: 'BP-26031-B1', batch: '1', status: '待补齐', missing: ['E02'] } },
        { id: 'DP-26031-01', version: 'V1' },
      ],
    })
    expect(summary.batchTrials[0]).toMatchObject({ id: 'BT-26031-B4', batch: 4, episodes: [19] })
    expect(summary.deliveries[0]).toMatchObject({ id: 'BP-26031-B1', missing: ['E02'] })
    expect(summary.deliveries[1]).toMatchObject({ id: 'DP-26031-01', version: 'V1' })
  })
})
