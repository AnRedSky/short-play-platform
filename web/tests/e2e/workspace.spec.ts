import { expect, request as playwrightRequest, test } from '@playwright/test'

const apiBase = (process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/?$/, '/')
const readerEmail = 'project-reader@example.test'
const readerPassword = 'ProjectReader-Password-123!'

let api: Awaited<ReturnType<typeof playwrightRequest.newContext>>
let readerToken = ''
let readerId = ''
let adminHeaders: Record<string, string> = {}
let projectA = ''
let projectB = ''
let projectWithoutMembership = ''
let foreignAssetId = ''

async function payload(response: Awaited<ReturnType<typeof api.get>>) {
  const body = await response.json()
  expect(response.ok(), JSON.stringify(body)).toBeTruthy()
  return body.data
}

async function loginAsProjectReader(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('企业邮箱').fill(readerEmail)
  await page.getByLabel('登录密码').fill(readerPassword)
  await page.getByRole('button', { name: '登录工作台' }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL: apiBase })

  const bootstrap = await api.post('auth/bootstrap', {
    data: {
      email: 'ci-admin@example.test',
      password: 'CI-Administrator-Password-123!',
      full_name: 'CI Administrator',
      organization_name: 'CI Project Access Organization',
    },
  })
  expect(bootstrap.status(), await bootstrap.text()).toBe(200)

  const adminLogin = await api.post('auth/login', {
    data: { email: 'ci-admin@example.test', password: 'CI-Administrator-Password-123!' },
  })
  const admin = (await payload(adminLogin)).access_token
  adminHeaders = { Authorization: `Bearer ${admin}` }

  const roleResponse = await api.post('roles', {
    headers: adminHeaders,
    data: {
      code: 'project_reader_e2e',
      name: 'Project Reader E2E',
      permissions: ['projects:read'],
    },
  })
  const role = await payload(roleResponse)

  const userResponse = await api.post('users', {
    headers: adminHeaders,
    data: {
      email: readerEmail,
      full_name: 'Project Reader',
      password: readerPassword,
      role_ids: [role.id],
    },
  })
  const reader = await payload(userResponse)
  readerId = reader.id

  const createProject = async (code: string, title: string) =>
    payload(await api.post('projects', {
      headers: adminHeaders,
      data: { code, title, summary: 'Playwright project authorization fixture' },
    }))

  const a = await createProject('E2E-PROJECT-A', 'E2E Project A')
  const b = await createProject('E2E-PROJECT-B', 'E2E Project B')
  const c = await createProject('E2E-PROJECT-C', 'E2E Project C')
  projectA = a.id
  projectB = b.id
  projectWithoutMembership = c.id

  const invalidMember = await api.post(`projects/${projectWithoutMembership}/members`, {
    headers: adminHeaders,
    data: { user_id: reader.id, project_role: 'viewer' },
  })
  expect(invalidMember.status(), await invalidMember.text()).toBe(422)

  for (const projectId of [projectA, projectB, projectWithoutMembership]) {
    const member = await api.post(`projects/${projectId}/members`, {
      headers: adminHeaders,
      data: { user_id: reader.id, project_role: 'reviewer' },
    })
    expect(member.status(), await member.text()).toBe(201)
  }

  const assetResponse = await api.post(`projects/${projectWithoutMembership}/assets`, {
    headers: adminHeaders,
    multipart: {
      title: 'Private project C asset',
      file: {
        name: 'private.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4YkAAAAASUVORK5CYII=',
          'base64',
        ),
      },
    },
  })
  const asset = await payload(assetResponse)
  foreignAssetId = asset.id

  const readerLogin = await api.post('auth/login', {
    data: { email: readerEmail, password: readerPassword },
  })
  readerToken = (await payload(readerLogin)).access_token
})

test.afterAll(async () => {
  await api?.dispose()
})

test('anonymous users are redirected away from project workspaces', async ({ page }) => {
  await page.goto(`/projects/${projectA}/stories`)
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
})

test('a project member can switch projects but cannot open a project after membership is revoked', async ({ page }) => {
  await loginAsProjectReader(page)

  await page.getByRole('link', { name: '项目管理', exact: true }).click()
  const projectARow = page.getByRole('row').filter({ hasText: 'E2E-PROJECT-A' })
  await projectARow.getByRole('link', { name: '进入项目' }).click()
  await expect(page.locator('.project-context')).toContainText(projectA)

  await page.getByRole('link', { name: '项目管理', exact: true }).click()
  const projectBRow = page.getByRole('row').filter({ hasText: 'E2E-PROJECT-B' })
  await projectBRow.getByRole('link', { name: '进入项目' }).click()
  await expect(page.locator('.project-context')).toContainText(projectB)

  await page.getByRole('link', { name: '项目管理', exact: true }).click()
  const projectCRow = page.getByRole('row').filter({ hasText: 'E2E-PROJECT-C' })
  await expect(projectCRow).toBeVisible()
  const revoke = await api.fetch(
    `projects/${projectWithoutMembership}/members/${readerId}`,
    { method: 'DELETE', headers: adminHeaders },
  )
  expect(revoke.status(), await revoke.text()).toBe(204)

  await projectCRow.getByRole('link', { name: '进入项目' }).click()
  await expect(page).toHaveURL(/\/access-error\?reason=forbidden/)
  await expect(page.getByRole('heading', { name: '无权访问此项目' })).toBeVisible()
  await expect(page.getByText(`项目 ID：${projectWithoutMembership}`)).toBeVisible()
})

test('browser requests cannot read or download an asset from another project', async ({ page }) => {
  await loginAsProjectReader(page)

  const results = await page.evaluate(async ({ apiUrl, assetId, token }) => {
    const headers = { Authorization: `Bearer ${token}` }
    const detail = await fetch(`${apiUrl}assets/${assetId}`, { headers })
    const download = await fetch(`${apiUrl}assets/${assetId}/download`, { headers })
    return { detail: detail.status, download: download.status }
  }, { apiUrl: apiBase, assetId: foreignAssetId, token: readerToken })

  expect(results.detail).toBe(403)
  expect(results.download).toBe(403)
})
