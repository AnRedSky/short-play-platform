import { expect, test } from '@playwright/test'

test('workspace shell renders the navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toBeVisible()
})

test('production navigation does not point at a hard-coded demo project', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '故事圣经' })).toHaveAttribute('href', '/projects')
})
