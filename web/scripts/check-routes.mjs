import fs from 'node:fs'

const routes = JSON.parse(fs.readFileSync('src/mock/routes.json', 'utf8')).map((r) => r.path)
const router = fs.readFileSync('src/router/index.ts', 'utf8')
const defined = [...router.matchAll(/path: '(\/[^']+)'/g)].map((m) => m[1].slice(1))
const missing = routes.filter((path) => !defined.includes(path))
const extra = defined.filter((path) => path && !routes.includes(path) && !path.includes(':') && path !== 'no-access')
console.log('routes', routes.length, 'defined', defined.length)
console.log('missing:', missing)
console.log('extra:', extra)
