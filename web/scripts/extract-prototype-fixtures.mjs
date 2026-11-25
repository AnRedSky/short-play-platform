/**
 * 从静态原型 prototype/v9 抽取 mock 数据与路由契约，产出前端可直接 import 的 JSON。
 * 只读取原型文件，不修改原型。
 *
 *   node scripts/extract-prototype-fixtures.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, '..')
const proto = path.resolve(webRoot, '..', 'prototype', 'v9')
const outDir = path.resolve(webRoot, 'src', 'mock')

const sandbox = { console }
sandbox.window = sandbox
sandbox.location = { hash: '#/' }
sandbox.document = {
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild() {}, setAttribute() {}, classList: { add() {} } }),
}
vm.createContext(sandbox)

const run = (rel) => vm.runInContext(fs.readFileSync(path.join(proto, rel), 'utf8'), sandbox, { filename: rel })

run('assets/js/data.js')
run('assets/js/ui.js')

const modules = []
sandbox.AppModule = { register: (c) => modules.push(c) }
sandbox.App = {
  on() {}, guard: () => true, get: (s, k, d) => d, set() {}, mem: () => ({}),
  go() {}, toast() {}, modal() {}, confirm() {}, drawer() {}, refresh() {}, can: () => true,
  exportCsv() {}, identity: () => sandbox.DB.identities[0], role: () => sandbox.DB.roles[0],
  home: () => 'workspace/home', current: () => ({ path: '', query: {}, route: null }),
  currentProject: () => null, routes: () => [], groups: () => [],
}
run('assets/js/store.js')
sandbox.DB.state.bind({ identity: () => sandbox.DB.identities[0], role: () => sandbox.DB.roles[0] })
run('assets/js/derived.js')
sandbox.DB.derived.bind({ identity: () => sandbox.DB.identities[0] })

for (const name of fs.readdirSync(path.join(proto, 'modules'))) {
  const file = path.join(proto, 'modules', name, 'pages.js')
  if (fs.existsSync(file)) run(path.join('modules', name, 'pages.js'))
}

const DB = sandbox.DB
const routes = []
for (const mod of modules) {
  for (const r of mod.routes || []) {
    routes.push({
      group: mod.group,
      path: r.path,
      title: r.title || r.path,
      permission: r.permission || null,
      keep: r.keep || undefined,
    })
  }
}

const entities = {}
for (const key of Object.keys(DB)) {
  const value = DB[key]
  if (Array.isArray(value) && value.every((row) => row && typeof row === 'object')) entities[key] = value
}

const seed = {
  meta: { generatedAt: new Date().toISOString(), source: 'prototype/v9 9.7.8', version: '9.7.8' },
  entities,
  dicts: {
    permissions: DB.permissions,
    enums: DB.enums,
    enterprise: DB.enterprise,
    pricing: DB.pricing,
    routePolicy: DB.routePolicy,
    analytics: DB.analytics,
    ops: DB.ops,
  },
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'seed.json'), `${JSON.stringify(seed, null, 0)}\n`)
fs.writeFileSync(path.join(outDir, 'routes.json'), `${JSON.stringify(routes, null, 0)}\n`)
fs.writeFileSync(
  path.join(outDir, 'menu.json'),
  `${JSON.stringify({ menu: DB.menu, identities: DB.identities, roles: DB.roles, departments: DB.departments, users: DB.users }, null, 0)}\n`,
)

const counts = Object.entries(entities).map(([k, v]) => `${k}=${v.length}`)
console.log(`routes=${routes.length} entities=${Object.keys(entities).length} seedKB=${Math.round(fs.statSync(path.join(outDir, 'seed.json')).size / 1024)}`)
console.log(counts.join(' '))
