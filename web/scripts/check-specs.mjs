import fs from 'node:fs'

const router = fs.readFileSync('src/router/index.ts', 'utf8')
const specs = fs.readFileSync('src/views/specs.ts', 'utf8')
const groupsFile = fs.readFileSync('src/views/spec-groups.ts', 'utf8')

const specRoutes = [...router.matchAll(/path: '(\/[^']+)',[^\n]*component: view\('SpecPage'\)/g)].map((m) => m[1])
const keys = [...specs.matchAll(/^ {2}'(\/[^']+)': {/gm)].map((m) => m[1])
const grouped = [...groupsFile.matchAll(/path: '(\/[^']+)'/g)].map((m) => m[1])
const groups = (groupsFile.match(/^ {2}\{ key:/gm) || []).length

const missingSpecs = specRoutes.filter((path) => !keys.includes(path))
const ungroupedRoutes = specRoutes.filter((path) => !grouped.includes(path))

console.log('SpecPage routes:', specRoutes.length, 'spec keys:', keys.length)
console.log('spec groups:', groups, 'grouped routes:', grouped.length)
console.log('missing specs:', missingSpecs)
console.log('ungrouped routes:', ungroupedRoutes)

if (missingSpecs.length || ungroupedRoutes.length || groups > 15) {
  console.error('规格页检查失败：缺少规格、未归入分组，或分组数超过 15。')
  process.exit(1)
}
