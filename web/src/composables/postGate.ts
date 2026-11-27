import type { Row } from '../mock/db'
import { budgetText, budgetUsedUp } from './videoGate'

/** 单集时间线优先按版本匹配；找不到时退回同集最新记录，避免把缺版本误判为已合成。 */
export function findEpisodeTimeline(episode: Row, timelines: Row[]): Row | null {
  const ep = Number(episode.no ?? episode.ep)
  const version = String(episode.timeline ?? '')
  const exact = version
    ? timelines.find((row) => Number(row.ep) === ep && String(row.version) === version)
    : null
  return exact ?? timelines.find((row) => Number(row.ep) === ep) ?? null
}

export function timelineQcBlockReason(timeline?: Row | null): string | null {
  if (!timeline) return '未选择时间线版本，不能提交质检'
  if (Number(timeline.stale ?? 0) > 0) {
    return `时间线 ${timeline.version} 还有 ${timeline.stale} 个过期片段，需先重建片段索引`
  }
  if (String(timeline.status ?? '').includes('草稿')) {
    return `时间线 ${timeline.version} 仍是草稿，需输出正式版本后再质检`
  }
  return null
}

/** 输出单集前先解释阻断原因；已输出、质检未过、时间线过期或预算用尽都不能继续。 */
export function episodeOutputBlockReason(episode: Row, timeline: Row | null, project?: Row): string | null {
  const no = Number(episode.no ?? 0)
  if (String(episode.status ?? '') === '已输出') return `第 ${no} 集已经输出，如需新版本请在时间线重新合成`
  if (String(episode.qc ?? '') !== 'PASS') {
    return `第 ${no} 集质检状态为「${episode.qc || '未开始'}」，需通过质检后才能输出`
  }
  if (!timeline) return `第 ${no} 集缺少时间线版本，需先完成合成`
  if (Number(timeline.stale ?? 0) > 0) {
    return `第 ${no} 集时间线还有 ${timeline.stale} 个过期片段，需重建索引后才能输出`
  }
  if (String(timeline.status ?? '').includes('草稿') || String(timeline.status ?? '') === '编辑中') {
    return `第 ${no} 集时间线仍为「${timeline.status}」，需输出正式版本后才能生成成片`
  }
  if (budgetUsedUp(project)) {
    return `预算已用 100%（${budgetText(project)}），不能输出新成片；请追加预算或缩减范围`
  }
  return null
}

/** 批量输出只处理未输出分集；任一待输出分集不满足条件即整体阻断，避免部分成功难以解释。 */
export function batchOutputBlockReason(episodes: Row[], timelines: Row[], project?: Row): string | null {
  const pending = episodes
    .filter((row) => String(row.status ?? '') !== '已输出')
    .sort((a, b) => Number(a.no ?? 0) - Number(b.no ?? 0))
  if (!pending.length) return '当前项目没有待输出的分集'
  for (const episode of pending) {
    const blocked = episodeOutputBlockReason(episode, findEpisodeTimeline(episode, timelines), project)
    if (blocked) return blocked
  }
  return null
}

export function checklistReady(checklist: Row[]): boolean {
  return checklist.every((item) => item.status === '已就绪' || !item.required)
}

function qualityPass(project?: Row): boolean {
  const quality = String(project?.quality ?? '')
  return quality.includes('通过') || quality.includes('良好')
}

/** 终审退回只要求项目仍在待审节点；终审通过还要求集数、质检与交付清单同时满足。 */
export function reviewBlockReason(project: Row | undefined, result: '通过' | '退回', checklist: Row[]): string | null {
  const status = String(project?.status ?? '')
  if (status !== '待最终审核') {
    return `项目当前为「${status || '未知'}」，只有「待最终审核」可以提交终审`
  }
  if (result === '退回') return null
  const done = Number(project?.done ?? 0)
  const episodes = Number(project?.episodes ?? 0)
  if (done < episodes) return `集数未完整（${done}/${episodes}），不能终审通过`
  if (!qualityPass(project)) return `质检结论为「${project?.quality || '未检测'}」，有阻断项时不能终审通过`
  const missing = checklist.filter((item) => item.required && item.status !== '已就绪')
  if (missing.length) return `${missing.length} 项必需交付物未就绪（${missing[0].item}），不能终审通过`
  return null
}

export function deliveryBlockReason(project: Row | undefined, checklist: Row[]): string | null {
  const status = String(project?.status ?? '')
  if (status !== '已完成') {
    return `项目当前为「${status || '未知'}」，需终审通过并进入「已完成」后才能交付`
  }
  const missing = checklist.filter((item) => item.required && item.status !== '已就绪')
  if (missing.length) return `${missing.length} 项必需交付物未就绪（${missing[0].item}），不能生成交付包`
  return null
}
