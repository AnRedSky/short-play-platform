import type { Batch, Episode, Project } from '../../domain/project/types'
import { applyEpisodeAction, deriveEpisodeStage, deriveProjectPhase, nextEpisodeAction, type EpisodeAction, type EpisodeStageView, type ProjectPhaseView } from '../../domain/project/stage'

export interface EpisodeOverview {
  episode: Episode
  stage: EpisodeStageView
  nextAction: EpisodeAction | null
}

export interface BatchOverview {
  batch: Batch
  episodes: EpisodeOverview[]
}

export interface ProjectOverview {
  project: Project
  phase: ProjectPhaseView
  episodes: EpisodeOverview[]
  batches: BatchOverview[]
}

export function buildProjectOverview(project: Project): ProjectOverview {
  const episodes = [...project.episodes].sort((a, b) => a.number - b.number)
  const episodeViews: EpisodeOverview[] = episodes.map((episode) => ({
    episode,
    stage: deriveEpisodeStage(episode.facts),
    nextAction: nextEpisodeAction(episode.facts),
  }))
  const byNumber = new Map(episodeViews.map((item) => [item.episode.number, item]))
  const batches: BatchOverview[] = project.batches
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((batch) => ({
      batch,
      episodes: batch.episodeNumbers
        .map((number) => byNumber.get(number))
        .filter((item): item is EpisodeOverview => Boolean(item)),
    }))
  return {
    project,
    phase: deriveProjectPhase(project),
    episodes: episodeViews,
    batches,
  }
}

export function advanceEpisode(project: Project, episodeId: string, at: string = new Date().toISOString()): Project {
  const episode = project.episodes.find((item) => item.id === episodeId)
  if (!episode) throw new Error('单集不存在')
  const action = nextEpisodeAction(episode.facts)
  if (!action) throw new Error('当前单集没有可执行动作')
  const facts = applyEpisodeAction(episode.facts, action.key)
  return {
    ...project,
    updatedAt: at,
    episodes: project.episodes.map((item) => (item.id === episodeId ? { ...item, facts, updatedAt: at } : item)),
  }
}
