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

    await page.locator('.stage-card').filter({ hasText: '创意策划' }).click()
    await page.getByRole('button', { name: '编辑为新版本' }).first().click()
    const briefModal = page.locator('.modal').last()
    await briefModal.locator('#dlg-audience').selectOption('25–40 岁女性')
    await briefModal.locator('#dlg-style').selectOption('冷灰低饱和 · 手持近景')
    await briefModal.locator('#dlg-constraints').fill('不出现真实品牌，不使用真实案件细节。')
    await briefModal.locator('#dlg-note').fill('雨夜错认来信，前三集每集一个钩子，最后用一封信完成反转。')
    await briefModal.getByRole('button', { name: '保存为新版本' }).click()
    await expect(page.getByText('已保存新的创意版本')).toBeVisible()

    await page.getByRole('button', { name: '生成候选方向' }).click()
    const generateModal = page.locator('.modal').last()
    await generateModal.locator('#dlg-idea').fill('雨夜错认来信，冷叙事，每集以信件推进。')
    await generateModal.getByRole('button', { name: '生成候选' }).click()
    await expect(page.locator('.brief-plan-card')).toHaveCount(3)

    await page.locator('.brief-plan-card').first().getByRole('button', { name: '设为选定' }).click()
    const chooseModal = page.locator('.modal').last()
    await expect(chooseModal).toContainText('选定这个创意方向')
    await chooseModal.getByRole('button', { name: '确认' }).click()
    await expect(page.locator('.brief-plan-card').first()).toContainText('已选定')

    await page.getByRole('button', { name: '确认创意方案' }).first().click()
    const gateModal = page.locator('.modal').last()
    await expect(gateModal.locator('.brief-checks li.ok')).toHaveCount(5)
    await gateModal.getByRole('button', { name: '确认并交棒' }).click()
    await expect(page.locator('main')).toContainText('· 剧本创作中 ·')

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
    await expect(page.locator('.stage-content')).toContainText('剧本版本')
    await expect(page.locator('.stage-kpi')).not.toHaveCount(0)

    await page.mouse.wheel(0, 900)
    await expect.poll(() => head.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBe(64)

    const stageWorkspaces = [
      ['创意策划', '创意输入基线'],
      ['剧本创作', '剧本版本'],
      ['导演规划', '项目镜头契约'],
    ] as const
    for (const [stage, content] of stageWorkspaces) {
      await dock.locator('.stage-card').filter({ hasText: stage }).click()
      await expect(page.locator('.stage-content')).toContainText(content)
      await expect(page.locator('.stage-kpi')).not.toHaveCount(0)
      await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0)
    }

    const productionStages = [
      ['视频生产', 'E3', '素材生产'],
      ['音频字幕', 'E5', '声音字幕'],
      ['后期合成', 'E4', '剪辑'],
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

  test('旧阶段深链收口到单集工作区，保留创意阶段入口', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?stage=post')
    await expect(page).toHaveURL(/view=episode/)
    await expect(page).toHaveURL(/step=E4/)
    await expect(page).not.toHaveURL(/stage=post/)
    await expect(page.locator('.episode-workspace')).toBeVisible()
    await expect(page.locator('.ep-stage-head')).toContainText('剪辑')

    await page.goto('/projects/workflow?stage=brief')
    await expect(page).toHaveURL(/stage=brief/)
    await expect(page.locator('.stage-content')).toContainText('创意输入基线')
  })

  test('批次看板进入单集 E0–E7 工作区并可返回批次', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow')
    await page.getByRole('button', { name: '批次看板' }).click()

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

  test('创意策划的方案、版本与确认门禁都走居中弹窗', async ({ page }) => {
    await resetStudio(page)
    await page.goto('/projects/workflow?stage=brief')
    await expect(page.locator('.stage-content')).toContainText('创意输入基线')
    await expect(page.locator('.stage-links')).toHaveCount(0)
    await expect(page.locator('.brief-plan-card')).toHaveCount(2)

    await page.locator('.brief-plan-card').first().locator('.brief-plan-head').click()
    const planModal = page.locator('.modal').last()
    await expect(planModal).toContainText('创意方向详情')
    await expect(planModal).toContainText('核心卖点')
    await planModal.getByRole('button', { name: '关闭弹窗' }).click()

    await page.locator('tbody tr').first().click()
    const versionModal = page.locator('.modal').last()
    await expect(versionModal).toContainText('简报版本')
    await expect(versionModal).toContainText('内容约束与禁区')
    await versionModal.getByRole('button', { name: '关闭弹窗' }).click()

    await page.getByRole('button', { name: '确认创意方案' }).first().click()
    const gateModal = page.locator('.modal').last()
    await expect(gateModal).toContainText('创意已冻结')
    await expect(gateModal.getByRole('button', { name: '创意已冻结' })).toBeDisabled()
  })
})
