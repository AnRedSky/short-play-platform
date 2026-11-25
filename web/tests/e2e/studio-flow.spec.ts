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

  test('新建项目从立项走到交付全链路', async ({ page }) => {
    test.setTimeout(180_000)
    await resetStudio(page)
    await page.goto('/projects/new')
    await page.getByPlaceholder('例：雾城来信').fill('E2E 自动化项目')
    await page.getByPlaceholder('悬疑 / 都市').fill('悬疑')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.locator('.card-title').first()).toContainText('制作设定')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page.locator('.card-title').first()).toContainText('预算与团队')
    await page.getByRole('button', { name: '创建项目' }).click()
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
})
