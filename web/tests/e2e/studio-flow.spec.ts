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

async function setEpisodeProgress(
  page: import('@playwright/test').Page,
  project: string,
  step: string,
  extra: Record<string, unknown> = {},
) {
  await page.evaluate(({ key, project, step, extra }) => {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const data = JSON.parse(raw) as { entities: { episodeStates: Array<Record<string, unknown>> } }
    for (const state of data.entities.episodeStates) {
      if (state.project !== project || state.delivered) continue
      Object.assign(state, { currentStep: step, ...extra })
    }
    localStorage.setItem(key, JSON.stringify(data))
  }, { key: MOCK_KEY, project, step, extra })
  await page.reload()
  await expect(page.locator('main h1')).toBeVisible()
}

async function runGate(page: import('@playwright/test').Page, label: string, nextStatus?: string) {
  const button = page.locator('.project-action-strip button', { hasText: label }).first()
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

  test('项目阶段随单集进度自动推导，项目级只保留治理动作', async ({ page }) => {
    test.setTimeout(120_000)
    await resetStudio(page)
    await page.goto('/projects/workflow')
    await expect(page.locator('main h1')).toContainText('雾城来信')
    await expect(page.locator('main')).toContainText('· 生产准备中 ·')
    const actions = page.locator('.project-action-strip')
    await expect(actions).toContainText('终止项目')
    await expect(actions).not.toContainText('转入后期')
    await expect(actions).not.toContainText('提交质量检测')

    await setEpisodeProgress(page, 'SP-26031', 'E4')
    await expect(page.locator('main')).toContainText('· 后期制作中 ·')
    await expect(page.locator('.project-action-strip')).toContainText('暂停派发')
    await expect(page.locator('.project-action-strip')).not.toContainText('提交质量检测')

    await setEpisodeProgress(page, 'SP-26031', 'E6')
    await expect(page.locator('main')).toContainText('· 质量检测中 ·')
    await expect(page.locator('.project-action-strip')).toHaveCount(0)

    await setEpisodeProgress(page, 'SP-26031', 'E7', { finalApproved: true })
    await expect(page.locator('main')).toContainText('· 已完成 ·')

    await setEpisodeProgress(page, 'SP-26031', 'E7', { finalApproved: true, delivered: true })
    await expect(page.locator('main')).toContainText('· 已交付 ·')
    await expect(page.locator('.project-action-strip')).toContainText('归档资产')
  })

  test('新建项目弹窗一次填完，剧本锁定后进入生产准备', async ({ page }) => {
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

    await expect(page.locator('main')).toContainText('· 剧本创作中 ·')
    await expect(page.locator('.stage-dock')).not.toContainText('创意策划')

    await page.locator('.stage-card').filter({ hasText: '剧本创作' }).click()
    await expect(page).toHaveURL(/stage=script/)
    const scriptWorkspace = page.locator('.script-workspace')
    await expect(scriptWorkspace.locator('.script-source-tab')).toHaveCount(3)
    await scriptWorkspace.getByRole('button', { name: '用模型生成剧本' }).click()
    const scriptModal = page.locator('.modal').last()
    await scriptModal.locator('#dlg-scope').selectOption('full')
    await scriptModal.getByRole('button', { name: '开始生成' }).click()
    await expect(scriptWorkspace).toContainText('5 / 5')
    await scriptWorkspace.getByRole('button', { name: '提交剧本审核' }).click()
    const submitModal = page.locator('[role="alertdialog"]')
    await submitModal.getByRole('button', { name: '确认' }).click()
    await expect(page.locator('main')).toContainText('· 待剧本审核 ·')

    await runGate(page, '审核通过并锁定', '生产准备中')
    await expect(page.locator('.project-action-strip')).not.toContainText('固化镜头计划')
    await expect(page.locator('.project-action-strip')).not.toContainText('转入后期')

    await page.locator('.stage-card').filter({ hasText: '导演规划' }).click()
    await expect(page).toHaveURL(/view=episode/)
    await expect(page).toHaveURL(/step=E2/)
    const episodeWorkspace = page.locator('.episode-workspace')
    await expect(episodeWorkspace).toContainText('第 1 集')
    await expect(episodeWorkspace).toContainText('E2 由分集稿生成镜头契约')
    await episodeWorkspace.getByRole('button', { name: '生成镜头契约' }).click()
    await expect(episodeWorkspace).toContainText('本集 9 镜')
    await expect(episodeWorkspace).toContainText('0 个缺项')
    await expect(episodeWorkspace).toContainText('草稿 · 未固化')
    await expect(episodeWorkspace.getByRole('button', { name: '新增镜头' })).toBeVisible()

    const firstShot = episodeWorkspace.locator('.table tbody tr').first()
    await firstShot.getByRole('button', { name: '编辑' }).click()
    const shotModal = page.locator('.modal').last()
    await shotModal.locator('#dlg-desc').fill('导演修订：雨夜街口，林夏回头停步，信封被雨水打湿')
    await shotModal.locator('#dlg-duration').fill('12')
    await shotModal.getByRole('button', { name: '保存镜头' }).click()
    await expect(episodeWorkspace).toContainText('导演修订')
    await expect(episodeWorkspace).toContainText('12 秒')

    await firstShot.getByRole('button', { name: '下移' }).click()
    await expect(episodeWorkspace.locator('.table tbody tr').nth(1)).toContainText('导演修订')
    await episodeWorkspace.locator('.table tbody tr').nth(1).getByRole('button', { name: '上移' }).click()
    await expect(episodeWorkspace.locator('.table tbody tr').first()).toContainText('导演修订')

    await episodeWorkspace.getByRole('button', { name: '新增镜头', exact: true }).click()
    const addModal = page.locator('.modal').last()
    await addModal.locator('#dlg-desc').fill('补一个雨中信封落地的特写')
    await addModal.getByRole('button', { name: '新增镜头' }).click()
    await expect(episodeWorkspace).toContainText('本集 10 镜')

    await episodeWorkspace.locator('.table tbody tr').last().getByRole('button', { name: '删除' }).click()
    const confirmModal = page.locator('.modal').last()
    await confirmModal.getByRole('button', { name: '确认', exact: true }).click()
    await expect(episodeWorkspace).toContainText('本集 9 镜')
    await expect(episodeWorkspace.getByRole('button', { name: '锁定资产与模型' })).toBeEnabled()

    await episodeWorkspace.getByRole('button', { name: '锁定资产与模型' }).click()
    const lockModal = page.locator('.modal').last()
    await expect(lockModal).toContainText('锁定镜头契约、关键资产与模型基线')
    await lockModal.getByRole('button', { name: '锁定并进入 E3' }).click()
    await expect(page).toHaveURL(/step=E3/)
    await expect(episodeWorkspace).toContainText('本集任务队列')

    await page.locator('.ep-step').filter({ hasText: 'E2' }).click()
    await expect(page).toHaveURL(/step=E2/)
    await expect(episodeWorkspace).toContainText(`PP-${code?.split('-')[1]}-E01-V1 · 已固化`)

    const versionCard = episodeWorkspace.locator('.card').filter({ has: page.locator('.card-title', { hasText: '分镜版本' }) })
    await expect(versionCard).toContainText('1 个版本')
    await versionCard.getByRole('button', { name: /修订当前版|返工到此版/ }).click()
    const rollbackModal = page.locator('.modal').last()
    await rollbackModal.getByRole('button', { name: '确认', exact: true }).click()
    await expect(episodeWorkspace).toContainText(`草稿 · 基于 PP-${code?.split('-')[1]}-E01-V1`)

    await episodeWorkspace.locator('.table tbody tr').first().getByRole('button', { name: '编辑' }).click()
    const v2Modal = page.locator('.modal').last()
    await v2Modal.locator('#dlg-desc').fill('V2 修订：导演调整雨夜回头的落点与停顿')
    await v2Modal.getByRole('button', { name: '保存镜头' }).click()
    await episodeWorkspace.getByRole('button', { name: '锁定资产与模型' }).click()
    const v2LockModal = page.locator('.modal').last()
    await v2LockModal.getByRole('button', { name: '锁定并进入 E3' }).click()
    await page.locator('.ep-step').filter({ hasText: 'E2' }).click()
    await expect(episodeWorkspace).toContainText(`PP-${code?.split('-')[1]}-E01-V2 · 已固化`)
    await expect(versionCard).toContainText('2 个版本')

    await versionCard.locator('tbody tr').first().getByRole('button', { name: '对比上一版' }).click()
    await expect(versionCard).toContainText('修改 1 镜')
    await expect(versionCard).toContainText('画面')

    await page.locator('.ep-step').filter({ hasText: 'E3' }).click()
    await page.getByRole('button', { name: '生成镜头任务' }).click()
    const taskModal = page.locator('.modal').last()
    await taskModal.locator('#dlg-note').fill('按 V2 镜头计划派发 9 个镜头')
    await taskModal.getByRole('button', { name: '生成镜头任务' }).click()
    const taskRows = page.locator('.card').filter({ hasText: '本集任务队列' }).locator('tbody tr')
    await expect(taskRows).toHaveCount(9)
    await expect(taskRows.first()).toContainText(`PP-${code?.split('-')[1]}-E01-V2`)
  })

  test('项目概览汇总详情，阶段管线固定顶部并可切换', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow')
    await expect(page.locator('main h1')).toContainText('· 项目详情')

    const dock = page.locator('.stage-dock')
    await expect(dock.locator('.stage-card')).toHaveCount(8)
    await expect(dock.locator('.stage-card.active')).toContainText('项目概览')
    await expect(dock.locator('.stage-card').nth(3)).toContainText('03 ·')
    await expect(dock.locator('.stage-card').nth(3)).toContainText('视频生产')
    await expect(dock.locator('.stage-card').nth(4)).toContainText('后期合成')
    await expect(dock.locator('.stage-card').nth(5)).toContainText('音频字幕')
    await expect(dock.locator('.stage-card').nth(6)).toContainText('质量检测')
    await expect(dock.locator('.stage-card').nth(7)).toContainText('终审交付')
    await expect(page.locator('.overview-grid')).toContainText('基本档案')
    await expect(page.locator('.overview-grid')).toContainText('制作设定')
    await expect(page.locator('.overview-grid')).toContainText('预算与产出')
    await expect(page.locator('.cockpit-main')).not.toContainText('项目信息')
    await expect(page.locator('.project-action-strip')).toBeVisible()

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
    await expect(page.getByRole('button', { name: /剧本审核 →/ })).toBeVisible()
    await expect(page.locator('.stage-head')).toContainText('下一阶段「导演规划」')
    await expect(page.locator('.stage-head-actions')).toContainText('剧本审核')
    await expect(page.locator('.stage-links')).toHaveCount(0)
    await expect(page.locator('.stage-content')).toContainText('版本链')
    await expect(page.locator('.stage-kpi')).not.toHaveCount(0)

    await page.mouse.wheel(0, 900)
    await expect.poll(() => head.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(64)

    await dock.locator('.stage-card').filter({ hasText: '导演规划' }).click()
    await expect(page).toHaveURL(/view=episode/)
    await expect(page).toHaveURL(/step=E2/)
    await expect(page.locator('.episode-workspace')).toContainText('镜头契约')
    await expect(page.locator('.ep-stage-head')).toContainText('镜头与资产')
    await expect(dock.locator('.stage-card.active')).toContainText('导演规划')
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0)

    const productionStages = [
      ['视频生产', 'E3', '素材生产'],
      ['后期合成', 'E4', '剪辑'],
      ['音频字幕', 'E5', '声音字幕'],
      ['质量检测', 'E6', '单集 QC'],
      ['终审交付', 'E7', '终审入库'],
    ] as const
    for (const [stage, step, name] of productionStages) {
      await dock.locator('.stage-card').filter({ hasText: stage }).click()
      await expect(page).toHaveURL(new RegExp(`view=episode.*step=${step}`))
      await expect(page.locator('.episode-workspace')).toBeVisible()
      await expect(page.locator('.ep-stage-head')).toContainText(name)
      await expect(dock.locator('.stage-card.active')).toContainText(stage)
    }

    await page.goto('/projects/detail')
    await expect(page).toHaveURL(/\/projects\/workflow/)
    await expect(page.locator('main h1')).toContainText('· 项目详情')
  })

  test('项目概览优先暴露当前瓶颈批次，批次入口直达 B4', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow')

    await expect(page.locator('.overview-progress')).toContainText('集完成制作')
    await expect(page.locator('.overview-progress')).toContainText('集已交付')
    const basics = page.locator('.overview-grid .overview-block').first()
    await expect(basics).toContainText('创建时间')
    await expect(basics).not.toContainText('当前阶段')
    const overview = page.locator('.batch-overview')
    const focus = overview.locator('.batch-overview-item.focus')
    await expect(focus).toContainText('B4')
    await expect(focus).toContainText('当前瓶颈')
    await expect(focus).toContainText('从 E19 继续')
    await expect(overview.getByRole('button', { name: '进入 B4 看板 →' })).toBeVisible()

    await focus.click()
    await expect(page).toHaveURL(/view=batch/)
    await expect(page).toHaveURL(/batch=4/)
    await expect(page.locator('main h1')).toContainText('B4 批次')

    await page.goto('/projects/workflow')
    await expect(page.locator('.batch-overview-item.focus')).toContainText('B4')
    await page.getByRole('button', { name: '批次看板', exact: true }).click()
    await expect(page).toHaveURL(/batch=4/)
  })

  test('旧阶段深链收口到单集工作区，创意阶段入口已移除', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?stage=post')
    await expect(page).toHaveURL(/view=episode/)
    await expect(page).toHaveURL(/step=E4/)
    await expect(page).not.toHaveURL(/stage=post/)
    await expect(page.locator('.episode-workspace')).toBeVisible()
    await expect(page.locator('.ep-stage-head')).toContainText('剪辑')

    await page.goto('/projects/workflow?stage=brief')
    await expect(page.locator('.stage-dock')).not.toContainText('创意策划')
    await expect(page.locator('.cockpit-main')).not.toContainText('创意输入基线')
    await expect(page.locator('.overview-grid')).toBeVisible()
  })

  test('批次看板进入单集 E0–E7 工作区并可返回批次', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?view=batch&batch=1')

    await expect(page).toHaveURL(/view=batch/)
    await expect(page.locator('.batch-board')).toContainText('单集仍是实际交互和制作单位')
    await expect(page.locator('.batch-tab')).toHaveCount(4)
    await expect(page.locator('.episode-card')).toHaveCount(6)

    await page.locator('.episode-card').first().click()
    await expect(page).toHaveURL(/view=episode/)
    await expect(page.locator('.episode-workspace')).toContainText('第 1 集')
    await expect(page.locator('.ep-step')).toHaveCount(8)

    await page.locator('.ep-step').filter({ hasText: 'E3' }).click()
    await expect(page).toHaveURL(/step=E3/)
    await expect(page.locator('.ep-stage-head')).toContainText('素材生产')
    await expect(page.locator('.ep-stage-head')).toContainText('镜头生成、审片与重试')

    await page.getByRole('button', { name: '返回批次' }).click()
    await expect(page).toHaveURL(/view=batch/)
    await expect(page.locator('.batch-board')).toBeVisible()
  })

  test('批次看板可创建 3 集试跑门禁单，且不自动推进单集', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?view=batch&batch=4')
    await expect(page.locator('.batch-board')).toContainText('批次只做分组、资产锁、模型版本与交付控制')
    const start = page.getByRole('button', { name: '创建 3 集试跑' })
    await expect(start).toBeVisible()
    await start.click()
    await expect(page.locator('.trial-card')).toContainText('待补齐')
    await expect(page.locator('.trial-card')).toContainText('E19–E21')
    await expect(page.locator('.trial-card')).toContainText('E19')
    await expect(page.locator('.trial-episode')).toHaveCount(3)
    await expect(page.locator('.trial-episode').first()).toContainText('E19')
    await expect(page.locator('.trial-episode').first()).toContainText('E2 · 待生产')
    await expect(page.locator('.trial-checks')).toContainText('剧本锁定')
    await expect(page.locator('.trial-checks')).toContainText('镜头/资产锁定')
    await expect(page.locator('.batch-gate').first()).toContainText('2/3 开工项通过')
    await page.locator('.episode-card').first().click()
    await expect(page.locator('.ep-stage-head')).toContainText('镜头与资产')
    await expect(page.locator('.ep-stage-head')).toContainText('镜头契约、资产与模型基线')
  })

  test('批次 6 集全部交付后可冻结批次包', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?view=batch&batch=1')
    await expect(page.locator('.batch-board')).toBeVisible()
    await page.waitForTimeout(300)
    await page.evaluate(({ key }) => {
      const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as {
        entities: Record<string, Array<Record<string, unknown>>>
      }
      for (const state of stored.entities.episodeStates ?? []) {
        if (state.project === 'SP-26031' && Number(state.ep) <= 6) {
          Object.assign(state, { currentStep: 'E7', status: '已交付', delivered: true })
        }
      }
      for (const episode of stored.entities.episodes ?? []) {
        if (episode.project === 'SP-26031' && Number(episode.no) <= 6) episode.status = '已交付'
      }
      localStorage.setItem(key, JSON.stringify(stored))
    }, { key: MOCK_KEY })
    await page.goto('/projects/workflow?view=batch&batch=1')
    const gate = page.locator('.batch-gate').filter({ hasText: '交付门禁' })
    await expect(gate).toContainText('6 / 6 集已交付')
    await page.getByRole('button', { name: '生成批次交付包' }).click()
    await expect(page.locator('.package-line')).toContainText('BP-26031-B1')
    await expect(page.locator('.package-line')).toContainText('已冻结')
  })

  test('E2 锁定资产后生成镜头任务，并可为镜头换模型生成新 take', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?view=episode&batch=4&episode=19&step=E2')
    await expect(page.locator('main h1')).toContainText('第 19 集')
    await expect(page.locator('.ep-action-bar')).toContainText('锁定资产与模型')

    await page.getByRole('button', { name: '锁定资产与模型' }).click()
    const lockModal = page.locator('.modal').last()
    await expect(lockModal).toContainText('模型基线')
    await lockModal.locator('#dlg-model').selectOption('视频模型 B')
    await lockModal.locator('#dlg-note').fill('E19 镜头契约与关键资产锁定')
    await lockModal.getByRole('button', { name: '锁定并进入 E3' }).click()
    await expect(page.getByText('E2 资产与模型锁定 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E3' }).click()
    await expect(page.getByRole('button', { name: '生成镜头任务' })).toBeVisible()
    await page.getByRole('button', { name: '生成镜头任务' }).click()
    const startModal = page.locator('.modal').last()
    await startModal.locator('#dlg-note').fill('先派发 18 个镜头任务')
    await startModal.getByRole('button', { name: '生成镜头任务' }).click()
    await expect(page.getByText('E3 素材生产启动 已完成')).toBeVisible()
    const taskRows = page.locator('.card').filter({ hasText: '本集任务队列' }).locator('tbody tr')
    await expect(taskRows).toHaveCount(18)

    await taskRows.first().getByRole('button', { name: '换模型' }).click()
    const modelModal = page.locator('.modal').last()
    await modelModal.locator('#dlg-model').selectOption('视频模型 A（图生视频）')
    await modelModal.locator('#dlg-note').fill('人物连续性不足，换参考视频模型重跑')
    await modelModal.getByRole('button', { name: '生成新 take' }).click()
    await expect(page.getByText('换模型生成新 take 已完成')).toBeVisible()
    await expect(taskRows.filter({ hasText: '已替代' }).first()).toBeVisible()
    await expect(taskRows.filter({ hasText: 'T2' }).first()).toBeVisible()
    const takeTree = page.locator('.card').filter({ hasText: 'Take 版本树' })
    await expect(takeTree).toContainText('19 个版本 / 18 镜')
    await expect(takeTree.locator('tbody tr').filter({ hasText: 'T2' }).first()).toContainText('由 T-')
    await expect(takeTree.locator('tbody tr').filter({ hasText: 'T2' }).first()).toContainText('当前')
  })

  test('E4→E7 完成剪辑、声音字幕、单集 QC、终审与单集交付包', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?view=episode&batch=4&episode=19&step=E2')

    await page.getByRole('button', { name: '锁定资产与模型' }).click()
    const lockModal = page.locator('.modal').last()
    await lockModal.locator('#dlg-model').selectOption('视频模型 A')
    await lockModal.locator('#dlg-note').fill('E19 资产锁定')
    await lockModal.getByRole('button', { name: '锁定并进入 E3' }).click()
    await expect(page.getByText('E2 资产与模型锁定 已完成')).toBeVisible()

    await page.getByRole('button', { name: '生成镜头任务' }).click()
    const taskModal = page.locator('.modal').last()
    await taskModal.locator('#dlg-note').fill('E19 派发 18 镜')
    await taskModal.getByRole('button', { name: '生成镜头任务' }).click()
    await expect(page.getByText('E3 素材生产启动 已完成')).toBeVisible()

    await page.getByRole('button', { name: '推进本集队列' }).click()
    await page.locator('.modal').last().getByRole('button', { name: '确认' }).click()
    await expect(page.getByText('E3 队列推进 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E4' }).click()
    await page.getByRole('button', { name: '建立时间线' }).click()
    let actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('建立 E19 时间线')
    await actionModal.getByRole('button', { name: '建立时间线' }).click()
    await expect(page.getByText('建立时间线 已完成')).toBeVisible()

    await page.getByRole('button', { name: '替换' }).first().click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-model').selectOption('视频模型 B')
    await actionModal.locator('#dlg-note').fill('E19 SH-01 换模型替换片段')
    await actionModal.getByRole('button', { name: '替换片段' }).click()
    await expect(page.getByText('E4 片段替换 已完成')).toBeVisible()

    await page.getByRole('button', { name: '重建时间线' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 替换片段后重建')
    await actionModal.getByRole('button', { name: '重建时间线' }).click()
    await expect(page.getByText('重建时间线 已完成')).toBeVisible()

    await page.getByRole('button', { name: '锁定时间线' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 精剪完成')
    await actionModal.getByRole('button', { name: '锁定时间线' }).click()
    await expect(page.getByText('锁定时间线 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E5' }).click()
    await page.getByRole('button', { name: '生成对白与字幕' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('生成 E19 对白与字幕')
    await actionModal.getByRole('button', { name: '生成对白与字幕' }).click()
    await expect(page.getByText('生成对白与字幕 已完成')).toBeVisible()

    await page.getByRole('button', { name: '确认字幕' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 字幕校对通过')
    await actionModal.getByRole('button', { name: '确认字幕' }).click()
    await expect(page.getByText('确认字幕 已完成')).toBeVisible()

    await page.getByRole('button', { name: '执行口型同步' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 口型同步通过')
    await actionModal.getByRole('button', { name: '执行口型同步' }).click()
    await expect(page.getByText('执行口型同步 已完成')).toBeVisible()

    await page.getByRole('button', { name: '混音检查并进入 QC' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 混音检查通过')
    await actionModal.getByRole('button', { name: '混音检查并进入 QC' }).click()
    await expect(page.getByText('混音检查并进入 QC 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E6' }).click()
    await page.getByRole('button', { name: '记录 QC 阻断' }).click()
    actionModal = page.locator('.modal').last()
    await expect(actionModal.locator('#dlg-profile')).toBeVisible()
    await actionModal.locator('#dlg-profile').selectOption('QC-AV')
    await actionModal.locator('#dlg-note').fill('E19 音画不同步，QC 阻断')
    await actionModal.getByRole('button', { name: '记录 QC 阻断' }).click()
    await expect(page.getByText('记录 QC 阻断 已完成')).toBeVisible()
    await expect(page.getByRole('button', { name: '退回返工' })).toBeVisible()
    await expect(page.locator('.card').filter({ hasText: '问题项' })).toContainText('音画同步')

    await page.getByRole('button', { name: '退回返工' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 退回 E5 返工')
    await actionModal.getByRole('button', { name: '创建返工' }).click()
    await expect(page.getByText('E6 退回返工 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E5' }).click()
    await page.getByRole('button', { name: '确认字幕' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 返工后字幕确认')
    await actionModal.getByRole('button', { name: '确认字幕' }).click()
    await expect(page.getByText('确认字幕 已完成')).toBeVisible()

    await page.getByRole('button', { name: '执行口型同步' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 返工后口型复检')
    await actionModal.getByRole('button', { name: '执行口型同步' }).click()
    await expect(page.getByText('执行口型同步 已完成')).toBeVisible()

    await page.getByRole('button', { name: '混音检查并进入 QC' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 返工后混音复检')
    await actionModal.getByRole('button', { name: '混音检查并进入 QC' }).click()
    await expect(page.getByText('混音检查并进入 QC 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E6' }).click()
    await page.getByRole('button', { name: '执行单集 QC' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 返工后 QC 复检')
    await actionModal.getByRole('button', { name: '执行单集 QC' }).click()
    await expect(page.getByText('执行单集 QC 已完成')).toBeVisible()

    await page.getByRole('button', { name: '确认 QC 通过' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 QC 确认通过')
    await actionModal.getByRole('button', { name: '确认 QC 通过' }).click()
    await expect(page.getByText('确认 QC 通过 已完成')).toBeVisible()

    await page.locator('.ep-step').filter({ hasText: 'E7' }).click()
    await page.getByRole('button', { name: '单集终审通过' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-note').fill('E19 终审通过')
    await actionModal.getByRole('button', { name: '终审通过', exact: true }).click()
    await expect(page.getByText('终审通过 已完成')).toBeVisible()

    await page.getByRole('button', { name: '生成单集交付包' }).click()
    actionModal = page.locator('.modal').last()
    await actionModal.locator('#dlg-receiver').fill('企业内容库')
    await actionModal.locator('#dlg-note').fill('E19 单集包入库')
    await actionModal.getByRole('button', { name: '生成并入库' }).click()
    await expect(page.getByText('E7 单集交付包 已完成')).toBeVisible()
  })

  test('剧本创作台用模型出稿、逐集修订并提交审核', async ({ page }) => {
    test.setTimeout(120_000)
    await resetStudio(page)
    await page.goto('/projects/workflow?id=SP-26011&stage=script')

    const workspace = page.locator('.script-workspace')
    await expect(workspace).toBeVisible()
    await expect(workspace).toContainText('剧本创作入口')
    await expect(workspace).toContainText('创作设定')
    await expect(page.locator('.stage-head')).toContainText('剧本创作 · 阶段工作区')

    await workspace.locator('.script-source-tab').nth(0).click()
    await page.getByRole('button', { name: '用模型生成剧本' }).click()
    const generateModal = page.locator('.modal').last()
    await expect(generateModal).toContainText('生成模型')
    await expect(generateModal).toContainText('生成范围')
    await expect(generateModal).toContainText('生成要求')
    await generateModal.locator('#dlg-model').selectOption('剧本模型 A · 长篇结构')
    await generateModal.locator('#dlg-scope').selectOption('pilot')
    await generateModal.locator('#dlg-prompt').fill('高三夏天的成长故事，前 3 集先立住人物关系，每集结尾留钩子。')
    await generateModal.getByRole('button', { name: '开始生成' }).click()

    await expect(workspace).toContainText('3 / 16')
    await expect(page.locator('.script-episode-item')).toHaveCount(3)
    await expect(page.locator('.script-episode-detail')).toContainText('开学第一天')

    await page.locator('.script-episode-item').first().click()
    await expect(page.locator('.script-episode-detail')).toContainText('校门口 · 清晨')
    await expect(page.locator('.script-line').first()).toContainText('周野')

    await page.getByRole('button', { name: '编辑本集' }).first().click()
    const editor = page.locator('.script-editor-modal')
    await expect(editor).toBeVisible()
    await editor.locator('.script-editor-fields input').first().fill('人工改过的开学日')
    await editor.locator('.script-editor-fields input').nth(2).fill('校门口 · 雨晨')
    await editor.getByRole('button', { name: '保存修订' }).click()
    await expect(page.locator('.script-episode-detail')).toContainText('人工改过的开学日')
    await expect(page.locator('.script-episode-detail')).toContainText('人工修订')

    await page.getByRole('button', { name: '继续用模型生成' }).click()
    const fullModal = page.locator('.modal').last()
    await fullModal.locator('#dlg-scope').selectOption('full')
    await fullModal.getByRole('button', { name: '开始生成' }).click()
    await expect(workspace).toContainText('16 / 16')
    await expect(workspace).toContainText('5 / 5')
    await expect(workspace).toContainText('人工改过的开学日')

    await workspace.getByRole('button', { name: '提交剧本审核' }).click()
    const confirm = page.locator('[role="alertdialog"]')
    await expect(confirm).toContainText('16 集将送审')
    await confirm.getByRole('button', { name: '确认' }).click()
    await expect(page.locator('main')).toContainText('· 待剧本审核 ·')
    await expect(workspace).toContainText('待审核')
  })

  test('剧本创作入口支持模型生成、自主编写、小说改编三种方式', async ({ page }) => {
    test.setTimeout(120_000)
    await resetStudio(page)
    await page.goto('/projects/workflow?id=SP-26011&stage=script')

    const workspace = page.locator('.script-workspace')
    await expect(workspace.locator('.script-source-tab')).toHaveCount(3)
    await expect(workspace.locator('.script-source-tab').nth(0)).toContainText('模型生成')
    await expect(workspace.locator('.script-source-tab').nth(1)).toContainText('自主编写')
    await expect(workspace.locator('.script-source-tab').nth(2)).toContainText('小说改编')

    await workspace.locator('.script-source-tab').nth(1).click()
    await workspace.getByRole('button', { name: '新建空白剧本' }).click()
    await expect(workspace).toContainText('自主编写')
    await expect(page.locator('.script-episode-item')).toHaveCount(1)
    await workspace.getByRole('button', { name: '编辑本集' }).click()
    const editor = page.locator('.script-editor-modal')
    await expect(editor).toBeVisible()
    await editor.locator('.script-editor-fields input').first().fill('手写的第一集')
    await editor.getByRole('button', { name: '保存修订' }).click()
    await expect(page.locator('.script-episode-detail')).toContainText('手写的第一集')

    await workspace.locator('.script-source-tab').nth(2).click()
    await workspace.getByRole('button', { name: '导入小说 / 章节' }).click()
    const novelModal = page.locator('.script-novel-modal')
    await expect(novelModal).toBeVisible()
    await novelModal.getByPlaceholder('例：雾城来信（原著）').fill('E2E 小说来源')
    await novelModal.locator('textarea').fill('第一章 雨夜\n雨夜错认来信。\n第二章 旧城\n旧城里的第二把钥匙。\n第三章 回信\n最后一封信没有寄件人。')
    await expect(novelModal).toContainText('识别 3 章')
    await novelModal.getByRole('button', { name: '导入并解析小说' }).click()
    await expect(workspace).toContainText('小说改编')
    await expect(workspace).toContainText('已解析 3 章')

    await workspace.locator('.script-source-tab').nth(0).click()
    await workspace.getByRole('button', { name: '用模型生成剧本' }).click()
    const generateModal = page.locator('.modal').last()
    await generateModal.locator('#dlg-scope').selectOption('pilot')
    await generateModal.getByRole('button', { name: '开始生成' }).click()
    await expect(workspace).toContainText('3 / 16')
    await expect(page.locator('.script-episode-item')).toHaveCount(3)
  })

  test('小说改编完成章节解析、章节映射并生成分集稿', async ({ page }) => {
    test.setTimeout(120_000)
    await resetStudio(page)
    await page.goto('/projects/workflow?id=SP-26011&stage=script')

    const workspace = page.locator('.script-workspace')
    await workspace.locator('.script-source-tab').nth(2).click()
    await workspace.getByRole('button', { name: '导入小说 / 章节' }).click()
    const novelModal = page.locator('.script-novel-modal')
    await novelModal.getByPlaceholder('例：雾城来信（原著）').fill('E2E 改编小说')
    await novelModal.locator('textarea').fill(
      '第一章 雨夜\n雨夜错认来信，顾沉在邮筒里摸到一封没有邮戳的信。\n信封上只写着苏眠的名字。\n'
      + '第二章 旧城\n旧城的第二把钥匙藏在门框后面，苏眠找到了它。\n门从里面反锁。\n'
      + '第三章 回信\n最后一封信没有寄件人，只有一张旧城区地图。\n地图上被划掉的地址，正是他们站的地方。',
    )
    await expect(novelModal).toContainText('识别 3 章')
    await expect(novelModal).toContainText('已解析每章正文')
    await novelModal.getByRole('button', { name: '导入并解析小说' }).click()
    await expect(workspace).toContainText('已解析 3 章')

    await workspace.getByRole('button', { name: '章节映射', exact: true }).click()
    const mapModal = page.locator('.script-map-modal')
    await expect(mapModal).toBeVisible()
    const mapRows = mapModal.locator('.script-map-list .script-map-row:not(.script-map-head)')
    await expect(mapRows).toHaveCount(3)
    await expect(mapRows.nth(0).locator('.script-map-start')).toHaveText('E01')
    await expect(mapRows.nth(1).locator('.script-map-start')).toHaveText('E07')
    await expect(mapRows.nth(2).locator('.script-map-start')).toHaveText('E12')
    await expect(mapModal).toContainText('将生成 16 集')
    await expect(mapModal).toContainText('覆盖 E01–E16')

    await mapRows.nth(0).locator('select').selectOption('4')
    await expect(mapRows.nth(1).locator('.script-map-start')).toHaveText('E05')
    await expect(mapRows.nth(2).locator('.script-map-start')).toHaveText('E10')
    await expect(mapModal).toContainText('将生成 14 集')
    await expect(mapModal).toContainText('还差 2 集未覆盖')

    await mapRows.nth(0).locator('select').selectOption('6')
    await expect(mapRows.nth(1).locator('.script-map-start')).toHaveText('E07')
    await expect(mapRows.nth(2).locator('.script-map-start')).toHaveText('E12')
    await expect(mapModal).toContainText('将生成 16 集')

    await mapRows.nth(0).getByRole('button', { name: '查看原文' }).click()
    const chapterModal = page.locator('.script-chapter-modal')
    await expect(chapterModal).toBeVisible()
    await expect(chapterModal).toContainText('雨夜错认来信')
    await chapterModal.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(chapterModal).toHaveCount(0)

    await mapModal.getByRole('button', { name: '生成 16 集分集稿' }).click()

    await expect(page.locator('.script-map-modal')).toHaveCount(0)
    await expect(workspace).toContainText('16 / 16')
    await expect(page.locator('.script-episode-item')).toHaveCount(16)
    await expect(page.locator('.script-episode-detail')).toContainText('雨夜')
    await expect(page.locator('.script-episode-detail')).toContainText('拆章改编 · 1/6')
    await expect(page.locator('.script-episode-detail')).toContainText('原著人物')

    await workspace.getByRole('button', { name: '查看源章节' }).click()
    const sourceModal = page.locator('.script-chapter-modal')
    await expect(sourceModal).toContainText('雨夜错认来信')
    await sourceModal.getByRole('button', { name: '下一章' }).click()
    await expect(sourceModal).toContainText('旧城的第二把钥匙')
    await sourceModal.getByRole('button', { name: '下一章' }).click()
    await expect(sourceModal).toContainText('最后一封信没有寄件人')
    await sourceModal.getByRole('button', { name: '关闭', exact: true }).click()

    await workspace.getByRole('button', { name: '提交剧本审核' }).click()
    const confirm = page.locator('[role="alertdialog"]')
    await expect(confirm).toContainText('16 集将送审')
    await confirm.getByRole('button', { name: '确认' }).click()
    await expect(page.locator('main')).toContainText('· 待剧本审核 ·')
  })
})
