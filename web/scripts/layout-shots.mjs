/**
 * 布局验收截图与度量脚本。
 *
 * 用法：
 *   1) 另开一个终端跑 npm run dev -- --port 5199 --strictPort
 *   2) node scripts/layout-shots.mjs
 *
 * 产出：
 *   docs/rebuild/screenshots/*.png  各主要页面的桌面端与移动端截图
 *   标准输出                        折叠宽度、滚动后导航位置、抽屉位移、控制台错误
 *
 * 只读脚本：不改动任何业务代码与数据，仅打开页面、点击折叠/抽屉按钮并截图。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:5199'
const OUT = path.resolve(process.env.SHOT_DIR || 'docs/rebuild/screenshots')

const routes = [
  ['01-首页-桌面.png', '/home'],
  ['03-工作台-桌面.png', '/workspace/home'],
  ['04-素材库-桌面.png', '/assets/library'],
  ['05-插件市场-桌面.png', '/plugins'],
  ['06-设置-桌面.png', '/settings'],
  ['07-项目概览-暗色改造.png', '/studio/projects'],
]

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

const browser = await chromium.launch()
const errors = []

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await desktop.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

await fs.mkdir(OUT, { recursive: true })

for (const [name, route] of routes) {
  await page.goto(BASE + route)
  await settle(page)
  await page.screenshot({ path: path.join(OUT, name) })
}

// 折叠/展开：固定按钮手动切换，读取导航宽度与主内容左偏移
await page.goto(BASE + '/home')
await settle(page)
const navWidth = () => page.locator('.app-sidebar').evaluate((el) => el.getBoundingClientRect().width)
const mainLeft = () => page.locator('.app-main').evaluate((el) => el.getBoundingClientRect().left)
const before = await navWidth()
await page.locator('.nav-toggle').click()
await page.waitForTimeout(500)
const after = await navWidth()
const collapsedLeft = await mainLeft()
await page.screenshot({ path: path.join(OUT, '02-首页-导航折叠.png') })
console.log('collapse:', JSON.stringify({ before, after, mainLeft: collapsedLeft }))
await page.locator('.nav-toggle').click()
await page.waitForTimeout(500)

// 滚动固定：主内容滚动后侧栏仍贴顶且保持一屏高
await page.setViewportSize({ width: 1440, height: 900 })
await page.mouse.wheel(0, 800)
await page.waitForTimeout(600)
const fixed = await page.locator('.app-sidebar').evaluate((el) => {
  const r = el.getBoundingClientRect()
  return { scrollY: Math.round(window.scrollY), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width) }
})
console.log('scroll-fixed:', JSON.stringify(fixed))

// 移动端：默认隐藏，点汉堡后抽屉归位，点遮罩后回收
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await mobile.newPage()
mp.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
await mp.goto(BASE + '/home')
await settle(mp)
await mp.screenshot({ path: path.join(OUT, '08-首页-移动端.png') })
const sidebarX = () => mp.locator('.app-sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().x * 10) / 10)
const hidden = { x: await sidebarX(), width: await mp.locator('.app-sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width)) }
await mp.locator('.tb-toggle').click()
await mp.waitForTimeout(500)
const open = { x: await sidebarX(), width: await mp.locator('.app-sidebar').evaluate((el) => Math.round(el.getBoundingClientRect().width)) }
await mp.screenshot({ path: path.join(OUT, '09-移动端-抽屉展开.png') })
await mp.mouse.click(360, 420)
await mp.waitForTimeout(500)
const closedAfterBackdrop = await sidebarX()
console.log('mobile-drawer:', JSON.stringify({ hidden, open, closedAfterBackdrop }))

await mp.goto(BASE + '/plugins')
await settle(mp)
await mp.screenshot({ path: path.join(OUT, '10-插件市场-移动端.png') })

console.log('console-errors:', JSON.stringify(errors))
await browser.close()
