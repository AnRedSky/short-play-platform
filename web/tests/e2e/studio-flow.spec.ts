import { expect, test } from '@playwright/test'

const MOCK_KEY = 'sp_studio_mock_v3'

async function resetStudio(page: import('@playwright/test').Page, identity = 'i-owner') {
  await page.goto('/workspace/home')
  await page.evaluate(({ key, identity }) => {
    localStorage.clear()
    localStorage.setItem('sp_studio_identity', identity)
    localStorage.removeItem(key)
  }, { key: MOCK_KEY, identity })
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
}

async function switchIdentity(page: import('@playwright/test').Page, identity: string) {
  await page.evaluate((id) => localStorage.setItem('sp_studio_identity', id), identity)
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
}

async function runGate(page: import('@playwright/test').Page, label: string, nextStatus?: string) {
  const button = page.locator('.wf-gate-row button', { hasText: label }).first()
  await expect(button).toBeVisible()
  await button.click()
  const modal = page.locator('.modal').last()
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: '确认' }).click()
  await expect(modal).toBeHidden()
  await expect(page.getByText(`${label} 已完成`)).toBeVisible()
  if (nextStatus) await expect(page.locator('main')).toContainText(`· ${nextStatus} ·`)
}

test.describe('工作室 mock 全流程', () => {
  test('工作台合并项目列表，通知从顶栏打开居中弹窗', async ({ page }) => {
    await resetStudio(page)
    await expect(page.locator('main h1')).toContainText('工作台')
    await expect(page.locator('.ws-projects tbody tr').first()).toBeVisible()

    const bell = page.locator('.tb-bell')
    const unreadBefore = await bell.locator('.dot-badge').innerText()
    await bell.click()

    const modal = page.locator('.inbox-modal')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.inbox-item').first()).toBeVisible()

    const box = await modal.boundingBox()
    const viewport = page.viewportSize()
    expect(box && viewport).toBeTruthy()
    expect(Math.abs(box!.x - (viewport!.width - box!.x - box!.width))).toBeLessThan(4)

    await modal.locator('.inbox-item.unread').first().getByRole('button', { name: '标记已读' }).click()
    await expect(bell.locator('.dot-badge')).toHaveText(String(Number(unreadBefore) - 1))

    await modal.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(modal).toBeHidden()
    await expect(bell.locator('.dot-badge')).toBeVisible()
  })

  test('生产 → 后期 → 质检 → 终审 → 交付闭环', async ({ page }) => {
    test.setTimeout(120_000)
    await resetStudio(page)
    await page.goto('/projects/workflow')
    await expect(page.locator('main h1')).toContainText('雾城来信')

    await runGate(page, '转入后期', '后期制作中')

    await runGate(page, '提交质量检测', '质量检测中')

    await switchIdentity(page, 'i-staff')
    await runGate(page, '检测通过', '待最终审核')

    await switchIdentity(page, 'i-owner')
    await runGate(page, '终审通过', '已完成')
    await runGate(page, '生成并交付', '已交付')

    await page.goto('/projects/workflow')
    await expect(page.locator('main')).toContainText('· 已交付 ·')
    await page.goto('/post/delivery')
    await expect(page.locator('tbody tr').filter({ hasText: 'DP-26031-01' }).first()).toBeVisible()
  })

  test('新建项目弹窗一次填完并走到交付全链路', async ({ page }) => {
    test.setTimeout(180_000)
    await resetStudio(page)
    await page.getByRole('button', { name: '新建项目' }).click()

    const modal = page.locator('.create-modal')
    await expect(modal).toBeVisible()
    // 三段字段全部在同一弹窗内，不进入下一步也能看到与编辑。
    await expect(modal).toContainText('基础信息')
    await expect(modal).toContainText('制作设定')
    await expect(modal).toContainText('预算与团队')
    await expect(modal.locator('input, select, textarea')).toHaveCount(13)
    await expect(modal.locator('#np-genre option')).toHaveCount(11)
    await expect(modal.locator('#np-ratio')).toContainText('16:9 · 1920×1080')
    await expect(modal.locator('#np-language')).toContainText('普通话 + 粤语片段')
    await expect(modal.locator('#np-style')).toContainText('赛博霓虹 · 高反差')
    await modal.locator('#np-constraints').scrollIntoViewIfNeeded()
    await expect(modal.locator('#np-constraints')).toBeVisible()
    await expect(modal.locator('#np-budget')).toBeAttached()
    await expect(page.locator('.sb-scroll').getByText('新建项目', { exact: true })).toHaveCount(0)

    await modal.getByPlaceholder('例：雾城来信').fill('E2E 自动化项目')
    await modal.locator('#np-genre').selectOption('悬疑 / 都市')
    await modal.getByRole('button', { name: '创建项目' }).click()
    await expect(page).toHaveURL(/\/projects\/workflow/)
    await expect(page.locator('main h1')).toContainText('E2E 自动化项目')

    const code = (await page.locator('main p').first().innerText()).match(/SP-\d+/)?.[0]
    expect(code).toBeTruthy()

    await runGate(page, '启动创意策划', '创意策划中')
    await runGate(page, '确认创意方案', '剧本创作中')
    await runGate(page, '提交剧本审核', '待剧本审核')
    await runGate(page, '审核通过并锁定', '生产准备中')
    await runGate(page, '固化镜头计划', '生产中')
    await runGate(page, '转入后期', '后期制作中')
    await runGate(page, '提交质量检测', '质量检测中')
    await runGate(page, '检测通过', '待最终审核')
    await runGate(page, '终审通过', '已完成')
    await runGate(page, '生成并交付', '已交付')

    await expect(page.locator('main')).toContainText('· 已交付 ·')
    await page.goto('/post/delivery')
    await expect(page.locator('tbody tr').filter({ hasText: code! }).first()).toContainText('已交付')
  })

  test('项目概览汇总详情，阶段管线固定顶部并可切换', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow')
    await expect(page.locator('main h1')).toContainText('· 项目详情')

    const dock = page.locator('.stage-dock')
    await expect(dock.locator('.stage-card')).toHaveCount(9)
    await expect(dock.locator('.stage-card.active')).toContainText('项目概览')
    await expect(page.locator('.overview-grid')).toContainText('基本档案')
    await expect(page.locator('.overview-grid')).toContainText('制作设定')
    await expect(page.locator('.overview-grid')).toContainText('预算与产出')
    await expect(page.locator('.spec-side')).not.toContainText('项目信息')

    const scroll = page.locator('.cockpit-scroll')
    const head = page.locator('.cockpit-head')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight))
      .toBe(0)
    await scroll.evaluate((el) => el.scrollTo({ top: 700 }))
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await expect.poll(() => head.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(64)

    await dock.locator('.stage-card').filter({ hasText: '剧本创作' }).click()
    await expect(page).toHaveURL(/stage=script/)
    await expect(page.locator('.card-title', { hasText: '剧本创作 · 阶段工作区' })).toBeVisible()
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0)
    await expect(page.getByRole('button', { name: /剧本版本 →/ })).toBeVisible()

    await page.mouse.wheel(0, 900)
    await expect.poll(() => head.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(64)

    await dock.locator('.stage-card').filter({ hasText: '终审交付' }).click()
    await expect(page.locator('.stage-body')).toContainText('DP-26031-00')

    await page.goto('/projects/detail')
    await expect(page).toHaveURL(/\/projects\/workflow/)
    await expect(page.locator('main h1')).toContainText('· 项目详情')
  })
})
