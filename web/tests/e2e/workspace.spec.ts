import { expect, request as playwrightRequest, test } from '@playwright/test'

const apiBase = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1'
const readerEmail = 'project-reader@example.test'
const readerPassword = 'ProjectReader-Password-123!'

let api: Awaited<ReturnType<typeof playwrightRequest.newContext>>
let readerToken = ''
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

  const bootstrap = await api.post('/auth/bootstrap', {
    data: {
      email: 'ci-admin@example.test',
      password: 'CI-Administrator-Password-123!',
      full_name: 'CI Administrator',
      organization_name: 'CI Project Access Organization',
    },
  })
  expect(bootstrap.status(), await bootstrap.text()).toBe(200)

  const adminLogin = await api.post('/auth/login', {
    data: { email: 'ci-admin@example.test', password: 'CI-Administrator-Password-123!' },
  })
  const admin = (await payload(adminLogin)).access_token
  const adminHeaders = { Authorization: `Bearer ${admin}` }

  const roleResponse = await api.post('/roles', {
    headers: adminHeaders,
    data: {
      code: 'project_reader_e2e',
      name: 'Project Reader E2E',
      permissions: ['projects:read'],
    },
  })
  const role = await payload(roleResponse)

  const userResponse = await api.post('/users', {
    headers: adminHeaders,
    data: {
      email: readerEmail,
      full_name: 'Project Reader',
      password: readerPassword,
      role_ids: [role.id],
    },
  })
  const reader = await payload(userResponse)

  const createProject = async (code: string, title: string) =>
    payload(await api.post('/projects', {
      headers: adminHeaders,
      data: { code, title, summary: 'Playwright project authorization fixture' },
    }))

  const a = await createProject('E2E-PROJECT-A', 'E2E Project A')
  const b = await createProject('E2E-PROJECT-B', 'E2E Project B')
  const c = await createProject('E2E-PROJECT-C', 'E2E Project C')
  projectA = a.id
  projectB = b.id
  projectWithoutMembership = c.id

  for (const projectId of [projectA, projectB]) {
    const member = await api.post(`/projects/${projectId}/members`, {
      headers: adminHeaders,
      data: { user_id: reader.id, project_role: 'viewer' },
    })
    expect(member.status(), await member.text()).toBe(201)
  }

  const assetResponse = await api.post(`/projects/${projectWithoutMembership}/assets`, {
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

  const readerLogin = await api.post('/auth/login', {
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

test('a project member can switch projects but cannot open a project without membership', async ({ page }) => {
  await loginAsProjectReader(page)

  await page.goto(`/projects/${projectA}/stories`)
  await expect(page.locator('.project-context')).toContainText(projectA)

  await page.goto(`/projects/${projectB}/assets`)
  await expect(page.locator('.project-context')).toContainText(projectB)
  await expect(page.locator('.module-tabs').getByRole('link', { name: '故事圣经' })).toHaveAttribute(
    'href',
    `/projects/${projectB}/stories`,
  )

  await page.goto(`/projects/${projectWithoutMembership}/assets`)
  await expect(page).toHaveURL(/\/access-error\?reason=forbidden/)
  await expect(page.getByRole('heading', { name: '无权访问此项目' })).toBeVisible()
  await expect(page.getByText(`项目 ID：${projectWithoutMembership}`)).toBeVisible()
})

test('browser requests cannot read or download an asset from another project', async ({ page }) => {
  await loginAsProjectReader(page)

  const results = await page.evaluate(async ({ assetId, token }) => {
    const headers = { Authorization: `Bearer ${token}` }
    const detail = await fetch(`/api/v1/assets/${assetId}`, { headers })
    const download = await fetch(`/api/v1/assets/${assetId}/download`, { headers })
    return { detail: detail.status, download: download.status }
  }, { assetId: foreignAssetId, token: readerToken })

  expect(results.detail).toBe(403)
  expect(results.download).toBe(403)
})
