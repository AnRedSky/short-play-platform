import { isMockMode } from '../../api'

const codeToRecord = new Map<string, string>()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ProjectRefSource {
  id?: unknown
  code?: unknown
  record_id?: unknown
}

/** Cache the service-layer mapping; pages keep using their business code. */
export function rememberProject(row: ProjectRefSource) {
  const code = String(row.id ?? row.code ?? '')
  const recordId = String(row.record_id ?? '')
  if (code && recordId) codeToRecord.set(code, recordId)
}

export function rememberProjects(rows: ProjectRefSource[]) {
  rows.forEach(rememberProject)
}

/** Real APIs address projects by UUID; mock and legacy data keep the code. */
export function projectRef(value: string): string {
  if (isMockMode) return value
  if (UUID_RE.test(value)) return value
  return codeToRecord.get(value) ?? value
}

export function clearProjectRefs() {
  codeToRecord.clear()
}
