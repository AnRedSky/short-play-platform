import { expect, test } from '@playwright/test'

test('workspace shell renders the navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toBeVisible()
})
