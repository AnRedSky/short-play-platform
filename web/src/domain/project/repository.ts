import type { Project } from './types'

export interface ProjectRepository {
  list(): Promise<Project[]>
  get(id: string): Promise<Project | null>
  save(project: Project): Promise<void>
}
