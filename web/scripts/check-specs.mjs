import fs from 'node:fs'

const router = fs.readFileSync('src/router/index.ts', 'utf8')
const specs = fs.readFileSync('src/views/specs.ts', 'utf8')
const specRoutes = [...router.matchAll(/path: '(\/[^']+)',[^\n]*component: view\('SpecPage'\)/g)].map((m) => m[1])
const keys = [...specs.matchAll(/^ {2}'(\/[^']+)': {/gm)].map((m) => m[1])
const missing = specRoutes.filter((p) => !keys.includes(p))
console.log('SpecPage routes:', specRoutes.length, 'spec keys:', keys.length)
console.log('missing specs:', missing)
