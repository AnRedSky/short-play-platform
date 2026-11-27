import fs from 'node:fs'

const routes = JSON.parse(fs.readFileSync('src/mock/routes.json', 'utf8')).map((r) => r.path)
const router = fs.readFileSync('src/router/index.ts', 'utf8')
const defined = [...router.matchAll(/path: '(\/[^']+)'/g)].map((m) => m[1].slice(1))
/** 旧地址重定向：页面合并或弹窗化后保留，允许出现在 router 而不在 routes.json。 */
const legacyRedirects = ['projects/list', 'notify/inbox', 'projects/new']
const missing = routes.filter((path) => !defined.includes(path))
const extra = defined.filter((path) => path && !routes.includes(path) && !path.includes(':') && path !== 'no-access' && !legacyRedirects.includes(path))
console.log('routes', routes.length, 'defined', defined.length)
console.log('missing:', missing)
console.log('extra:', extra)
