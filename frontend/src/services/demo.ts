import type { ApiEnvelope } from './api'
import type { User, Organization, Department, Role, Project } from './resources'
const organization: Organization = { id: 'org-demo', name: '星河短剧工作室', slug: 'xinghe-studio' }
const users: User[] = [
  { id: 'user-preview', email: 'preview@shortplay.local', full_name: '产品预览用户', is_active: true },
  { id: 'user-writer', email: 'writer@shortplay.local', full_name: '林编剧', is_active: true },
  { id: 'user-artist', email: 'artist@shortplay.local', full_name: '美术负责人', is_active: true },
]
const departments: Department[] = [
  { id: 'dept-creative', organization_id: organization.id, name: '创作策划部', parent_id: null },
  { id: 'dept-art', organization_id: organization.id, name: '视觉美术部', parent_id: null },
  { id: 'dept-production', organization_id: organization.id, name: '制作剪辑部', parent_id: null },
]
const roles: Role[] = [
  { id: 'role-admin', organization_id: organization.id, code: 'org_admin', name: '组织管理员', description: '管理组织成员、角色和项目', permissions: ['users:read','users:write','roles:read','roles:write','projects:read','projects:write'] },
  { id: 'role-writer', organization_id: organization.id, code: 'writer', name: '编剧', description: '维护故事、剧本和分集内容', permissions: ['projects:read','stories:write','scripts:write'] },
  { id: 'role-artist', organization_id: organization.id, code: 'artist', name: '美术', description: '维护角色、场景、道具视觉资产', permissions: ['projects:read','assets:write'] },
]
const projects: Project[] = [
  { id: 'demo-project', organization_id: organization.id, code: 'DRAMA-001', title: '雨夜来信', summary: '一封匿名信揭开家族尘封的秘密。都市悬疑竖屏短剧，规划 24 集。', status: 'active' },
  { id: 'demo-project-2', organization_id: organization.id, code: 'DRAMA-002', title: '逆光而行', summary: '关于成长、选择与重新开始的都市情感故事。', status: 'draft' },
]
function envelope<T>(data: T, total?: number): ApiEnvelope<T> {
  return total === undefined ? { data } : { data, meta: { page: 1, page_size: 100, total } }
}
export async function demoApiHandler(path: string, init: RequestInit): Promise<unknown> {
  const url = new URL(path, 'http://demo.local')
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
  if (url.pathname === '/auth/me') return envelope({ user: users[0], organization_id: organization.id, permissions: ['projects:read','projects:write','users:read','users:write','roles:read','organizations:read','organizations:write'] })
  if (url.pathname === '/auth/logout') return envelope({ revoked: true })
  if (url.pathname === '/organizations' && method === 'GET') return envelope([organization])
  if (url.pathname === '/organizations/departments' && method === 'GET') return envelope(departments, departments.length)
  if (url.pathname === '/organizations/departments' && method === 'POST') {
    const item: Department = { id: `dept-${Date.now()}`, organization_id: organization.id, name: String(body.name ?? '新部门'), parent_id: body.parent_id ? String(body.parent_id) : null }
    departments.unshift(item); return envelope(item)
  }
  if (url.pathname === '/users' && method === 'GET') return envelope(users, users.length)
  if (url.pathname === '/users' && method === 'POST') {
    const item: User = { id: `user-${Date.now()}`, email: String(body.email), full_name: String(body.full_name), is_active: true }
    users.unshift(item); return envelope(item)
  }
  const userMatch = url.pathname.match(/^\/users\/([^/]+)$/)
  if (userMatch && method === 'PATCH') {
    const item = users.find(user => user.id === userMatch[1])
    if (item) { if (typeof body.full_name === 'string') item.full_name = body.full_name; if (typeof body.is_active === 'boolean') item.is_active = body.is_active; return envelope(item) }
  }
  if (url.pathname === '/roles' && method === 'GET') return envelope(roles, roles.length)
  if (url.pathname === '/projects' && method === 'GET') return envelope(projects, projects.length)
  if (url.pathname === '/projects' && method === 'POST') {
    const item: Project = { id: `project-${Date.now()}`, organization_id: organization.id, code: String(body.code), title: String(body.title), summary: String(body.summary ?? ''), status: 'draft' }
    projects.unshift(item); return envelope(item)
  }
  throw new Error(`演示适配器尚未实现：${method} ${url.pathname}`)
}
