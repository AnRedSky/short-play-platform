import { describe, expect, it } from 'vitest'
import {
  idempotencyKey,
  rememberTask,
  resolveTaskId,
  toAttemptRow,
  toCreatePayload,
  toTaskRow,
  type GenerationTaskDto,
} from '../../src/services/video/contract'

const task: GenerationTaskDto = {
  id: '9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f',
  project_id: '6c2b11a0-1f2e-4a3b-9c8d-7e6f5a4b3c2d',
  capability: 'video_generation',
  provider_code: 'mock',
  model_code: 'mock-video-1',
  status: 'running',
  attempt_count: 1,
  max_attempts: 3,
  error_message: null,
  request_payload: {
    parameters: {
      episode_number: 3,
      shot_label: 'S03-02',
      scene_label: '雨夜天台',
      priority: '高',
      est_seconds: 45,
      kind_label: '视频生成',
    },
  },
  result_payload: {},
  created_at: '2026-11-26T04:54:00Z',
}

describe('video contract mapping', () => {
  it('maps capability + Chinese page status onto a task row', () => {
    const row = toTaskRow(task, 'SP-26031')
    expect(row.id).toBe('T-9F4D22C1')
    expect(row.project).toBe('SP-26031')
    expect(row.status).toBe('执行中')
    expect(row.kind).toBe('视频生成')
    expect(row.ep).toBe(3)
    expect(row.shot).toBe('S03-02')
    expect(row.priority).toBe('高')
    expect(row.est).toBe(45)
  })

  it('maps queued/succeeded/failed backend states to page wording', () => {
    expect(toTaskRow({ ...task, status: 'retry_wait' }, 'SP-1').status).toBe('排队中')
    expect(toTaskRow({ ...task, status: 'succeeded' }, 'SP-1').status).toBe('已完成')
    expect(toTaskRow({ ...task, status: 'cancelled' }, 'SP-1').status).toBe('失败')
    expect(toTaskRow({ ...task, status: 'cancel_requested' }, 'SP-1').status).toBe('执行中')
  })

  it('maps page ep/shot/kind/est onto backend capability and parameters', () => {
    const dto = toCreatePayload({
      project: 'SP-26031',
      ep: 3,
      shot: 'S03-02',
      kind: '音频合成',
      priority: '高',
      est: 45,
    })
    expect(dto.capability).toBe('tts')
    expect(dto.max_attempts).toBe(3)
    expect(dto.parameters).toMatchObject({
      episode_number: 3,
      shot_label: 'S03-02',
      kind_label: '音频合成',
      priority: '高',
      est_seconds: 45,
    })
    expect(dto.prompt).toContain('E3 S03-02')
  })

  it('maps audio/video/lip-sync kinds onto supported capabilities', () => {
    expect(toCreatePayload({ kind: '视频生成' }).capability).toBe('video_generation')
    expect(toCreatePayload({ kind: '音频合成' }).capability).toBe('tts')
    expect(toCreatePayload({ kind: '口型校验' }).capability).toBe('video_generation')
    expect(toCreatePayload({ kind: '推理' }).capability).toBe('text_generation')
  })

  it('caches the displayed task code back to its UUID', () => {
    rememberTask('T-ABC12345', '9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f')
    expect(resolveTaskId('T-ABC12345')).toBe('9f4d22c1-2e3a-4a11-8a5c-4f7b1c2d3e4f')
    expect(resolveTaskId('6c2b11a0-1f2e-4a3b-9c8d-7e6f5a4b3c2d')).toBe(
      '6c2b11a0-1f2e-4a3b-9c8d-7e6f5a4b3c2d',
    )
  })

  it('maps attempts for the drawer fields', () => {
    const row = toAttemptRow(
      { attempt_number: 2, status: 'failed', error_code: 'PROVIDER_TIMEOUT' },
      'T-ABC12345',
    )
    expect(row.id).toBe('AT-T-ABC12345-2')
    expect(row.n).toBe(2)
    expect(row.status).toBe('失败')
    expect(row.fail).toBe('PROVIDER_TIMEOUT')
  })

  it('always yields a non-empty idempotency key', () => {
    expect(idempotencyKey().length).toBeGreaterThan(8)
  })
})
