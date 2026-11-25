import fs from 'node:fs'
import path from 'node:path'

/** 分层约束：页面只通过 services/<domain> 取数，不直连 api/client，也不直接使用 http。 */
const root = 'src/views'
const violations = []

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) walk(full)
    else if (name.endsWith('.vue')) {
      const text = fs.readFileSync(full, 'utf8')
      if (/from\s+['"][^'"]*api\/client['"]/.test(text)) violations.push(`${full}: 直连 api/client`)
      if (/\bhttp\.(get|list|post|patch|del)\b/.test(text)) violations.push(`${full}: 直接调用 http`)
    }
  }
}

walk(root)
if (violations.length) {
  console.error('分层检查失败：')
  violations.forEach((item) => console.error(` - ${item}`))
  process.exit(1)
}
console.log('layering ok: 页面均通过 services 取数')
