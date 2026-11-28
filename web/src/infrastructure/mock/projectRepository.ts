import type { ProjectRepository } from '../../domain/project/repository'
import type { Project } from '../../domain/project/types'
import { seedProjects } from './seed'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface MockRepositoryOptions {
  seed?: Project[]
  storageKey?: string
}

export class MockProjectRepository implements ProjectRepository {
  private readonly storageKey?: string
  private projects: Project[]

  constructor(options: MockRepositoryOptions = {}) {
    this.storageKey = options.storageKey
    this.projects = clone(options.seed ?? seedProjects)
    this.restore()
  }

  async list(): Promise<Project[]> {
    return clone(this.projects)
  }

  async get(id: string): Promise<Project | null> {
    const found = this.projects.find((project) => project.id === id)
    return found ? clone(found) : null
  }

  async save(project: Project): Promise<void> {
    const index = this.projects.findIndex((item) => item.id === project.id)
    if (index >= 0) this.projects[index] = clone(project)
    else this.projects.push(clone(project))
    this.persist()
  }

  reset(): void {
    this.projects = clone(seedProjects)
    this.persist()
  }

  private restore(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    const raw = localStorage.getItem(this.storageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Project[]
      if (Array.isArray(parsed) && parsed.length) this.projects = parsed
    } catch {
      localStorage.removeItem(this.storageKey)
    }
  }

  private persist(): void {
    if (!this.storageKey || typeof localStorage === 'undefined') return
    localStorage.setItem(this.storageKey, JSON.stringify(this.projects))
  }
}

export const mockProjectRepository = new MockProjectRepository({ storageKey: 'sp_rebuild_projects_v1' })
