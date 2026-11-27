import { describe, expect, it } from 'vitest'
import {
  audioAssetBlockReason,
  dialogueBatchBlockReason,
  expiringSoon,
  extractVoiceProfileId,
  lipSyncBlockReason,
  parseDateOnly,
  voiceBlockReason,
} from '../../src/composables/audioGate'
import type { Row } from '../../src/mock/db'

function row(extra: Row): Row {
  return { ...extra }
}

describe('audioGate', () => {
  const now = new Date(2026, 10, 27)

  it('parses ISO date without timezone drift', () => {
    const date = parseDateOnly('2027-06-30')
    expect(date?.getFullYear()).toBe(2027)
    expect(date?.getMonth()).toBe(5)
    expect(date?.getDate()).toBe(30)
  })

  it('accepts an enabled voice profile with a future expiry', () => {
    const profile = row({ id: 'VO-01', status: '启用', rights: '商用条款已留档', validUntil: '2027-06-30' })
    expect(voiceBlockReason(profile, now)).toBeNull()
  })

  it('blocks an expired voice profile and reports the date', () => {
    const profile = row({ id: 'VO-11', status: '启用', rights: '授权书已留档', validUntil: '2026-10-31' })
    expect(voiceBlockReason(profile, now)).toContain('2026-10-31 到期')
  })

  it('blocks a voice profile that is waiting for rights review', () => {
    const profile = row({ id: 'VO-11', status: '待复核授权到期', rights: '授权书已留档', validUntil: '2027-01-01' })
    expect(voiceBlockReason(profile, now)).toContain('需复核授权')
  })

  it('blocks audio assets with unclear rights', () => {
    const asset = row({ id: 'AU-26015-BGM-03', status: '阻断', rights: '授权不明确 · 阻断交付' })
    expect(audioAssetBlockReason(asset, now)).toContain('已被阻断')
  })

  it('flags entitlements expiring within seven days', () => {
    const asset = row({ id: 'AU-26031-BGM-07', rights: '平台授权', validUntil: '2026-11-30' })
    expect(expiringSoon(asset, now)).toBe(true)
  })

  it('requires pending dialogue targets and an authorized voice', () => {
    const rows = [row({ ep: 17, status: '待生成' }), row({ ep: 17, status: '已通过' })]
    const profile = row({ id: 'VO-01', status: '启用', rights: '商用条款已留档', validUntil: '2027-06-30' })
    expect(dialogueBatchBlockReason(rows, profile, row({ budget: 100, actual: 10 }), [], 'pending', now)).toBeNull()
    expect(dialogueBatchBlockReason(rows, profile, row({ budget: 100, actual: 100 }), [], 'pending', now)).toContain('预算已用 100%')
  })

  it('blocks a subtitle episode that needs rework and a duplicate lip-sync task', () => {
    const subtitles = [row({ ep: 17, status: '需重做' })]
    expect(lipSyncBlockReason(subtitles, [], 17, row({ budget: 100, actual: 10 }))).toContain('字幕未通过校对')
    const passed = [row({ ep: 17, status: '已通过' })]
    const tasks = [row({ id: 'T-9001', kind: '口型校验', ep: 17, status: '执行中' })]
    expect(lipSyncBlockReason(passed, tasks, 17, row({ budget: 100, actual: 10 }))).toContain('T-9001')
  })

  it('extracts a voice profile id from a shot voice label', () => {
    expect(extractVoiceProfileId('顾沉 · 声音档案 VO-01')).toBe('VO-01')
  })
})
