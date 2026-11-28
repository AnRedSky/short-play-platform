<template>
  <section class="rebuild-page">
    <header class="hero">
      <div>
        <p class="eyebrow">重建基线 · 第一个垂直切片</p>
        <h1>项目概览</h1>
        <p class="subtitle">项目阶段由单集状态自动推导，项目级只保留治理动作。页面不再手工推进生产阶段。</p>
      </div>
      <button class="ghost" type="button" @click="resetData">重置验证数据</button>
    </header>

    <div v-if="notice" class="notice" :class="noticeTone">{{ notice }}</div>

    <div class="layout">
      <aside class="project-rail">
        <div class="rail-title">项目</div>
        <button
          v-for="project in projects"
          :key="project.id"
          type="button"
          class="project-card"
          :class="{ selected: project.id === selectedProjectId }"
          @click="chooseProject(project.id)"
        >
          <span class="project-name">{{ project.name }}</span>
          <span class="project-meta">{{ lifecycleLabel(project.lifecycle) }} · {{ project.episodes.length }} 集</span>
        </button>
      </aside>

      <main v-if="overview" class="workspace">
        <div class="overview-head">
          <div>
            <div class="title-row">
              <h2>{{ overview.project.name }}</h2>
              <span class="pill">{{ lifecycleLabel(overview.project.lifecycle) }}</span>
              <span class="pill phase">{{ overview.phase.stage.name }}</span>
            </div>
            <p class="synopsis">{{ overview.project.synopsis }}</p>
          </div>
          <div class="phase-summary">
            <div class="phase-number">{{ overview.phase.progress }}<span>%</span></div>
            <div class="phase-note">
              当前阶段 {{ overview.phase.stage.name }}<br />
              活跃单集第 {{ overview.phase.activeEpisodeNumber ?? '—' }} 集 · 已交付 {{ overview.phase.deliveredCount }} / {{ overview.phase.totalCount }}
            </div>
          </div>
        </div>

        <div class="progress-track" aria-label="项目进度">
          <span :style="{ width: `${overview.phase.progress}%` }"></span>
        </div>

        <div class="rule-note">
          <strong>推导规则</strong>
          <span>取所有未交付单集中阶段最靠前的一集作为项目当前阶段。单集交付后不再参与项目阶段推导。</span>
        </div>

        <section class="batch-section">
          <div class="section-head">
            <h3>批次与单集</h3>
            <span class="muted">共 {{ overview.episodes.length }} 集</span>
          </div>
          <div v-for="batch in overview.batches" :key="batch.batch.id" class="batch">
            <div class="batch-head">
              <span class="batch-label">{{ batch.batch.label }}</span>
              <span class="muted">第 {{ batch.batch.episodeNumbers[0] }} 至 {{ batch.batch.episodeNumbers[batch.batch.episodeNumbers.length - 1] }} 集</span>
            </div>
            <div class="episode-grid">
              <button
                v-for="item in batch.episodes"
                :key="item.episode.id"
                type="button"
                class="episode-card"
                :class="{ selected: item.episode.id === selectedEpisodeId, done: item.stage.done, blocked: item.stage.tone === 'blocked' }"
                @click="chooseEpisode(item.episode.id)"
              >
                <span class="ep-no">第 {{ item.episode.number }} 集</span>
                <span class="ep-title">{{ item.episode.title }}</span>
                <span class="ep-stage">{{ item.stage.current.name }}</span>
                <span class="ep-bar"><i :style="{ width: `${item.stage.progress}%` }"></i></span>
              </button>
            </div>
          </div>
        </section>

        <section v-if="selectedEpisode" class="detail-section">
          <div class="section-head">
            <div>
              <h3>第 {{ selectedEpisode.episode.number }} 集 · {{ selectedEpisode.episode.title }}</h3>
              <span class="muted">单集状态与阶段门禁</span>
            </div>
            <div class="version-line">
              <span>{{ selectedEpisode.episode.scriptVersion ?? '剧本未锁定' }}</span>
              <span>{{ selectedEpisode.episode.planVersion ?? '计划未固化' }}</span>
              <span>{{ selectedEpisode.episode.baselineVersion ?? '基线未绑定' }}</span>
            </div>
          </div>

          <div class="stage-chain">
            <div
              v-for="step in selectedEpisode.stage.steps"
              :key="step.key"
              class="stage-step"
              :class="step.state"
            >
              <span class="stage-dot"></span>
              <span class="stage-name">{{ step.name }}</span>
              <span class="stage-short">{{ step.short }}</span>
            </div>
          </div>

          <div class="detail-grid">
            <div class="panel">
              <div class="panel-title">下一步动作</div>
              <div v-if="selectedEpisode.nextAction" class="next-action">
                <strong>{{ selectedEpisode.nextAction.label }}</strong>
                <p>{{ selectedEpisode.nextAction.description }}</p>
                <button type="button" class="primary" @click="advance">执行并刷新</button>
              </div>
              <div v-else class="empty">
                {{ selectedEpisode.stage.done ? '本集已交付，没有后续生产动作。' : '当前单集被阻断，请先处理阻断原因。' }}
              </div>
            </div>

            <div class="panel">
              <div class="panel-title">事实状态</div>
              <div class="fact-grid">
                <div v-for="fact in factItems(selectedEpisode)" :key="fact.label" class="fact" :class="{ on: fact.value }">
                  <span class="fact-mark">{{ fact.value ? '已' : '未' }}</span>
                  <span>{{ fact.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="governance">
          <div>
            <h3>项目级治理</h3>
            <p>项目级只保留暂停、恢复、终止、归档等治理动作，不提供生产阶段推进按钮。</p>
          </div>
          <div class="governance-actions">
            <button
              v-for="action in governanceActions"
              :key="action.key"
              type="button"
              class="ghost"
              :class="{ danger: action.danger }"
              @click="govern(action)"
            >
              {{ action.label }}
            </button>
            <span v-if="!governanceActions.length" class="muted">当前状态没有可执行的治理动作。</span>
          </div>
        </footer>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { buildProjectOverview, advanceEpisode, type EpisodeOverview } from '../../../application/project/overview'
import { allowedGovernanceActions, applyGovernanceAction, type ProjectGovernanceAction } from '../../../application/project/governance'
import type { Project, ProjectLifecycle } from '../../../domain/project/types'
import { mockProjectRepository } from '../../../infrastructure/mock/projectRepository'

const projects = ref<Project[]>([])
const selectedProjectId = ref('')
const selectedEpisodeId = ref('')
const notice = ref('')
const noticeTone = ref<'ok' | 'bad'>('ok')

const selectedProject = computed(() => projects.value.find((project) => project.id === selectedProjectId.value) ?? null)
const overview = computed(() => (selectedProject.value ? buildProjectOverview(selectedProject.value) : null))
const selectedEpisode = computed<EpisodeOverview | null>(() => {
  if (!overview.value) return null
  return overview.value.episodes.find((item) => item.episode.id === selectedEpisodeId.value) ?? null
})
const governanceActions = computed<ProjectGovernanceAction[]>(() =>
  selectedProject.value ? allowedGovernanceActions(selectedProject.value) : [],
)

function lifecycleLabel(lifecycle: ProjectLifecycle): string {
  const labels: Record<ProjectLifecycle, string> = {
    active: '进行中',
    paused: '已暂停',
    terminated: '已终止',
    archived: '已归档',
  }
  return labels[lifecycle]
}

function factItems(episode: EpisodeOverview) {
  const facts = episode.episode.facts
  return [
    { label: '输入确认', value: facts.inputConfirmed },
    { label: '剧本锁定', value: facts.scriptLocked },
    { label: '镜头与资产锁定', value: facts.assetsLocked },
    { label: '素材生产启动', value: facts.productionStarted },
    { label: '素材生产完成', value: facts.productionCompleted },
    { label: '剪辑完成', value: facts.editingCompleted },
    { label: '声音完成', value: facts.audioReady },
    { label: '字幕确认', value: facts.subtitleApproved },
    { label: '质检通过', value: facts.qcPassed },
    { label: '已交付', value: facts.delivered },
  ]
}

async function loadData() {
  projects.value = await mockProjectRepository.list()
  if (!projects.value.length) return
  const stillExists = projects.value.some((project) => project.id === selectedProjectId.value)
  if (!stillExists) selectedProjectId.value = projects.value[0].id
  const current = projects.value.find((project) => project.id === selectedProjectId.value)
  if (!current) return
  const currentOverview = buildProjectOverview(current)
  const episodeExists = currentOverview.episodes.some((item) => item.episode.id === selectedEpisodeId.value)
  if (!episodeExists) {
    const active = currentOverview.episodes.find((item) => item.episode.number === currentOverview.phase.activeEpisodeNumber)
    selectedEpisodeId.value = (active ?? currentOverview.episodes[0])?.episode.id ?? ''
  }
}

function chooseProject(id: string) {
  selectedProjectId.value = id
  const current = projects.value.find((project) => project.id === id)
  if (!current) return
  const currentOverview = buildProjectOverview(current)
  const active = currentOverview.episodes.find((item) => item.episode.number === currentOverview.phase.activeEpisodeNumber)
  selectedEpisodeId.value = (active ?? currentOverview.episodes[0])?.episode.id ?? ''
  notice.value = ''
}

function chooseEpisode(id: string) {
  selectedEpisodeId.value = id
  notice.value = ''
}

async function advance() {
  if (!selectedProject.value || !selectedEpisode.value) return
  try {
    const updated = advanceEpisode(selectedProject.value, selectedEpisode.value.episode.id)
    await mockProjectRepository.save(updated)
    const episodeId = selectedEpisode.value.episode.id
    await loadData()
    selectedEpisodeId.value = episodeId
    noticeTone.value = 'ok'
    notice.value = `已推进第 ${selectedEpisode.value.episode.number} 集，当前阶段为${selectedEpisode.value.stage.current.name}。`
  } catch (error) {
    noticeTone.value = 'bad'
    notice.value = error instanceof Error ? error.message : '推进失败，请检查单集状态。'
  }
}

async function govern(action: ProjectGovernanceAction) {
  if (!selectedProject.value) return
  if (action.danger && !window.confirm(`确认${action.label}？${action.description}`)) return
  try {
    const updated = applyGovernanceAction(selectedProject.value, action.key)
    await mockProjectRepository.save(updated)
    await loadData()
    noticeTone.value = 'ok'
    notice.value = `项目已执行${action.label}。`
  } catch (error) {
    noticeTone.value = 'bad'
    notice.value = error instanceof Error ? error.message : '治理动作执行失败。'
  }
}

async function resetData() {
  if (!window.confirm('确认重置验证数据？当前推进记录会丢失。')) return
  mockProjectRepository.reset()
  selectedProjectId.value = ''
  selectedEpisodeId.value = ''
  await loadData()
  noticeTone.value = 'ok'
  notice.value = '验证数据已重置。'
}

onMounted(loadData)
</script>

<style scoped>
.rebuild-page {
  --ink: #16211c;
  --muted: #61706a;
  --line: #d8e1dc;
  --paper: #ffffff;
  --soft: #f4f7f5;
  --green: #1d6b4f;
  --green-soft: #e8f4ee;
  --amber: #9a5b13;
  --red: #a33636;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
  padding: 24px;
  color: var(--ink);
  background: #eef3f0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  box-sizing: border-box;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}
.eyebrow {
  margin: 0 0 8px;
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
}
.subtitle {
  max-width: 760px;
  margin: 10px 0 0;
  color: var(--muted);
  line-height: 1.7;
}
.notice {
  padding: 12px 16px;
  border: 1px solid #b8d8c6;
  border-radius: 10px;
  background: var(--green-soft);
  color: #194c39;
}
.notice.bad {
  border-color: #e6bcbc;
  background: #fbefef;
  color: var(--red);
}
.layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 18px;
}
.project-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--paper);
  align-self: start;
}
.rail-title {
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.project-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--soft);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.project-card.selected {
  border-color: var(--green);
  background: var(--green-soft);
}
.project-name {
  font-size: 15px;
  font-weight: 700;
}
.project-meta {
  color: var(--muted);
  font-size: 12px;
}
.workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper);
}
.overview-head {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
h2 {
  margin: 0;
  font-size: 24px;
}
.pill {
  padding: 4px 9px;
  border-radius: 999px;
  background: var(--soft);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.pill.phase {
  background: var(--green-soft);
  color: var(--green);
}
.synopsis {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.65;
}
.phase-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 230px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--soft);
}
.phase-number {
  color: var(--green);
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}
.phase-number span {
  font-size: 14px;
}
.phase-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.progress-track {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: #e4ebe7;
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1d6b4f, #52a87d);
  transition: width 0.2s ease;
}
.rule-note {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-left: 3px solid var(--green);
  border-radius: 0 10px 10px 0;
  background: var(--soft);
  color: var(--muted);
  line-height: 1.7;
}
.rule-note strong {
  flex: none;
  color: var(--ink);
}
.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
h3 {
  margin: 0;
  font-size: 18px;
}
.muted {
  color: var(--muted);
  font-size: 13px;
}
.batch {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fbfdfc;
}
.batch + .batch {
  margin-top: 10px;
}
.batch-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.batch-label {
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
}
.episode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.episode-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--paper);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.episode-card:hover,
.episode-card.selected {
  border-color: var(--green);
  box-shadow: 0 0 0 2px #d7ede4;
}
.episode-card.done {
  background: #f5faf7;
}
.episode-card.blocked {
  border-color: #dfb0b0;
  background: #fdf5f5;
}
.ep-no {
  color: var(--muted);
  font-size: 12px;
}
.ep-title {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ep-stage {
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
}
.ep-bar {
  overflow: hidden;
  height: 3px;
  border-radius: 999px;
  background: #e4ebe7;
}
.ep-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #58a681;
}
.detail-section {
  padding-top: 4px;
}
.version-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
}
.version-line span {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.stage-chain {
  display: grid;
  grid-template-columns: repeat(8, minmax(56px, 1fr));
  gap: 6px;
  margin: 8px 0 14px;
}
.stage-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--soft);
}
.stage-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #bdcac4;
}
.stage-step.done .stage-dot,
.stage-step.current .stage-dot {
  background: var(--green);
}
.stage-step.current {
  border-color: var(--green);
  background: var(--green-soft);
}
.stage-step.blocked {
  border-color: #dfb0b0;
  background: #fdf5f5;
}
.stage-step.blocked .stage-dot {
  background: var(--red);
}
.stage-name {
  font-size: 11px;
  text-align: center;
}
.stage-short {
  color: var(--muted);
  font-size: 10px;
}
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 12px;
}
.panel {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fbfdfc;
}
.panel-title {
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}
.next-action strong {
  font-size: 16px;
}
.next-action p {
  margin: 6px 0 12px;
  color: var(--muted);
  line-height: 1.7;
}
.primary {
  padding: 8px 14px;
  border: 1px solid var(--green);
  border-radius: 8px;
  background: var(--green);
  color: #fff;
  cursor: pointer;
}
.empty {
  padding: 12px 0;
  color: var(--muted);
}
.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.fact {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 7px;
  background: var(--soft);
  color: var(--muted);
  font-size: 12px;
}
.fact.on {
  background: var(--green-soft);
  color: #194c39;
}
.fact-mark {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e3e9e6;
  font-size: 10px;
  font-weight: 700;
}
.fact.on .fact-mark {
  background: var(--green);
  color: #fff;
}
.governance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 2px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.governance p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.governance-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ghost {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.ghost:hover {
  border-color: var(--green);
}
.ghost.danger {
  border-color: #e2b7b7;
  color: var(--red);
}
@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .project-rail {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .overview-head {
    flex-direction: column;
  }
  .phase-summary {
    min-width: 0;
  }
  .stage-chain {
    grid-template-columns: repeat(4, minmax(56px, 1fr));
  }
}
</style>
