import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const routes: Array<{ path: string; permission?: string | string[] }> = JSON.parse(
  fs.readFileSync(path.resolve('src/mock/routes.json'), 'utf8'),
)
const identities = ['i-owner', 'i-ops', 'i-admin', 'i-dept', 'i-staff', 'i-auditor']

test.describe('权限矩阵快照', () => {
  test('6 个身份 × 56 条路由的可达结果稳定', async ({ page }) => {
    test.setTimeout(300_000)
    await page.goto('/workspace/home')
    await page.evaluate(() => {
      localStorage.clear()
      localStorage.setItem('sp_studio_identity', 'i-owner')
    })
    await page.reload()
    await expect(page.locator('main h1')).toBeVisible()

    const matrix: Record<string, Record<string, 'allow' | 'deny'>> = {}

    for (const identity of identities) {
      await page.evaluate((id) => localStorage.setItem('sp_studio_identity', id), identity)
      await page.reload()
      await expect(page.locator('main h1')).toBeVisible()
      matrix[identity] = {}

      for (const route of routes) {
        const target = route.path.startsWith('/') ? route.path : `/${route.path}`
        await page.evaluate((to) => {
          history.pushState({}, '', to)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }, target)
        await page.waitForFunction(
          (expected) => {
            const current = location.pathname
            return (current === expected || current === '/no-access') && !!document.querySelector('main h1')
          },
          target,
          { timeout: 5_000 },
        )
        const landed = await page.evaluate(() => location.pathname)
        matrix[identity][target] = landed === '/no-access' ? 'deny' : 'allow'
      }
    }

    await page.evaluate(() => localStorage.setItem('sp_studio_identity', 'i-owner'))
    expect(JSON.stringify(matrix, null, 2)).toMatchSnapshot('permission-matrix.json')
  })
})
