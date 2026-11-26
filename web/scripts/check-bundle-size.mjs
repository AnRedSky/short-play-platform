import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// 主包口径：Vite manifest 中 index.html 指向的入口 chunk 的未压缩体积。
const BUDGET_BYTES = 450 * 1024
const manifestPath = path.resolve('dist', '.vite', 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const entry = manifest['index.html']

if (!entry?.file) {
  console.error('Entry chunk for index.html is missing from the Vite manifest.')
  process.exit(1)
}

const bytes = statSync(path.resolve('dist', entry.file)).size
const kb = (bytes / 1024).toFixed(2)
const budgetKb = (BUDGET_BYTES / 1024).toFixed(0)

if (bytes > BUDGET_BYTES) {
  console.error(`Entry chunk ${entry.file} is ${kb} KB, exceeding the ${budgetKb} KB budget.`)
  process.exit(1)
}

console.log(`Entry chunk ${entry.file} is ${kb} KB (budget ${budgetKb} KB).`)
