import { expect, test } from '@playwright/test'

test('workspace shell renders the navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.brand')).toBeVisible()
})

test('production navigation does not point at a hard-coded demo project', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '故事圣经' })).toHaveAttribute('href', '/projects')
})


test('switching project routes updates the active project context and navigation', async ({ page }) => {
  await page.goto('/projects/project-a/stories')
  await expect(page.locator('.project-context')).toContainText('project-a')

  await page.goto('/projects/project-b/assets')
  await expect(page.locator('.project-context')).toContainText('project-b')
  await expect(page.locator('.module-tabs').getByRole('link', { name: '故事圣经' })).toHaveAttribute(
    'href',
    '/projects/project-b/stories',
  )
  await expect(page.locator('a[href*="demo-project"]')).toHaveCount(0)
})

test('leaving a project clears the project context from the workspace shell', async ({ page }) => {
  await page.goto('/projects/project-a/stories')
  await expect(page.locator('.project-context')).toContainText('project-a')

  await page.goto('/projects')
  await expect(page.locator('.project-context')).toHaveCount(0)
})


test('production routes never display local demo records as real project data', async ({ page }) => {
  await page.goto('/projects/project-b/stories')
  await expect(page.getByText('故事圣经尚未接入真实业务数据')).toBeVisible()
  await expect(page.getByText('雨夜来信')).toHaveCount(0)
  await expect(page.getByText('演示数据')).toHaveCount(0)
})
