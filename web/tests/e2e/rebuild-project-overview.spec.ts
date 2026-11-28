import { expect, test } from '@playwright/test'

const REBUILD_KEY = 'sp_rebuild_projects_v1'

test.describe('重建版项目概览', () => {
  test('项目阶段由单集推导，单集推进和项目治理可用', async ({ page }) => {
    await page.goto('/studio/projects')
    await page.evaluate((key) => localStorage.removeItem(key), REBUILD_KEY)
    await page.reload()

    await expect(page.locator('main h1')).toContainText('项目概览')
    await expect(page.getByText('当前阶段 素材生产')).toBeVisible()
    await expect(page.getByText('第 2 集').first()).toBeVisible()
    await expect(page.getByText('声音字幕').first()).toBeVisible()

    await page.getByRole('button', { name: '执行并刷新' }).click()
    await expect(page.getByText('已推进第 3 集，当前阶段为剪辑。')).toBeVisible()
    await expect(page.getByText('当前阶段 剪辑')).toBeVisible()

    await page.getByRole('button', { name: '暂停项目' }).click()
    await expect(page.getByText('项目已执行暂停项目。')).toBeVisible()
    await expect(page.getByRole('button', { name: '恢复项目' })).toBeVisible()
  })
})
