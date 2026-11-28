import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 主题令牌的对比度护栏：色值改动若跌破 WCAG 阈值，这里会先失败，
 * 避免“改一处颜色，暗色下正文读不清”的回归。
 */
const css = readFileSync(resolve(__dirname, '../../src/styles/theme.dark.css'), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`))
  if (!match) throw new Error(`主题缺少令牌 --${name}`)
  return match[1]
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
  )
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const [high, low] = a > b ? [a, b] : [b, a]
  return (high + 0.05) / (low + 0.05)
}

describe('暗色主题令牌', () => {
  const surface = token('ds-surface-1')
  const page = token('ds-bg')
  const input = token('ds-surface-3')

  it('正文与页面、卡片满足 AAA（≥7:1）', () => {
    expect(contrast(token('ds-text-primary'), surface)).toBeGreaterThanOrEqual(7)
    expect(contrast(token('ds-text-primary'), page)).toBeGreaterThanOrEqual(7)
  })

  it('次要文字与辅助文字满足 AA（≥4.5:1）', () => {
    expect(contrast(token('ds-text-secondary'), surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('ds-text-muted'), surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('ds-text-muted'), input)).toBeGreaterThanOrEqual(4.5)
  })

  it('控件边框与禁用文字满足非文本对比度（≥3:1）', () => {
    expect(contrast(token('ds-border-strong'), surface)).toBeGreaterThanOrEqual(3)
    expect(contrast(token('ds-text-disabled'), input)).toBeGreaterThanOrEqual(3)
  })

  it('主交互色自身与其上的深色文字都可读', () => {
    expect(contrast(token('ds-interactive'), surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('ds-on-interactive'), token('ds-interactive'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('ds-interactive-hover'), token('ds-on-interactive'))).toBeGreaterThanOrEqual(4.5)
  })

  it('四种状态色在卡片上都达标', () => {
    for (const name of ['ds-ok', 'ds-warn', 'ds-danger', 'ds-info']) {
      expect(contrast(token(name), surface)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('间距与层级规范', () => {
  it('间距按 8px 栅格递增', () => {
    expect(css).toContain('--space-1: 8px')
    expect(css).toContain('--space-2: 16px')
    expect(css).toContain('--space-3: 24px')
    expect(css).toContain('--space-4: 32px')
    expect(css).toContain('--space-6: 48px')
    expect(css).toContain('--space-8: 64px')
  })

  it('阴影分为静态卡片 / 悬浮层 / 抽屉弹窗三级', () => {
    expect(css).toContain('--shadow-1:')
    expect(css).toContain('--shadow-2:')
    expect(css).toContain('--shadow-3:')
  })

  it('导航过渡时长为 300ms', () => {
    expect(css).toContain('--motion-nav: 300ms')
  })
})
