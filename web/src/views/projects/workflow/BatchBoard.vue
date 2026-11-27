<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Row } from '../../../mock/db'
import type { BatchGroup, EpisodeCard } from './episodeFlow'
import { projectApi } from '../../../services/projects'
import { useUiStore } from '../../../stores/ui'
import EmptyState from '../../../components/ui/EmptyState.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const props = defineProps<{
  project: Row | null
  batches: BatchGroup[]
  activeIndex: number
  trials?: Row[]
  packages?: Row[]
}>()

const emit = defineEmits<{
  (event: 'select-batch', index: number): void
  (event: 'open-episode', item: EpisodeCard): void
  (event: 'trial-started'): void
  (event: 'package-created'): void
  (event: 'back'): void
}>()

const ui = useUiStore()
const starting = ref(false)
const packaging = ref(false)

const currentBatch = computed(
  () => props.batches.find((batch) => batch.index === props.activeIndex) ?? props.batches[0] ?? null,
)

const totalEpisodes = computed(() => currentBatch.value?.episodes.length ?? 0)
const doneCount = computed(() => currentBatch.value?.doneCount ?? 0)
const qcCount = computed(() => currentBatch.value?.qcCount ?? 0)
const activeCount = computed(() => currentBatch.value?.activeCount ?? 0)
const progress = computed(() => currentBatch.value?.progress ?? 0)
const currentTrial = computed(
  () => (props.trials ?? []).find((trial) => Number(trial.batch) === currentBatch.value?.index) ?? null,
)
const trialEpisodes = computed(() => (currentTrial.value?.episodes as number[] | undefined) ?? [])
const trialChecks = computed(
  () => (currentTrial.value?.checks as Array<Record<string, unknown>> | undefined) ?? [],
)
const currentPackage = computed(
  () =>
    (props.packages ?? []).find(
      (item) => item.kind === '批次包' && Number(item.batch) === currentBatch.value?.index,
    ) ?? null,
)

async function startTrial() {
  if (!currentBatch.value || !props.project || starting.value) return
  starting.value = true
  try {
    const trial = await projectApi.batchTrial(String(props.project.id), currentBatch.value.index, {
      size: 3,
    })
    const eps = (trial.episodes as number[] | undefined) ?? []
    ui.toast(`已生成 ${currentBatch.value.label} 试跑单：${eps.map((no) => `E${String(no).padStart(2, '0')}`).join(' / ')}`)
    emit('trial-started')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '试跑单生成失败', 'bad')
  } finally {
    starting.value = false
  }
}

async function startPackage() {
  if (!currentBatch.value || !props.project || packaging.value) return
  packaging.value = true
  try {
    const item = await projectApi.batchPackage(String(props.project.id), currentBatch.value.index, {
      receiver: '企业内容库',
    })
    ui.toast(`批次包 ${String(item.id)} 已冻结`)
    emit('package-created')
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : '批次包生成失败', 'bad')
  } finally {
    packaging.value = false
  }
}
</script>

<template>
  <section class="batch-board">
    <div class="board-head">
      <div>
        <h2 class="board-title">批次看板</h2>
        <p class="board-sub">批次只做分组、资产锁、模型版本与交付控制；单集仍是实际交互和制作单位。</p>
      </div>
      <div class="board-actions">
        <button
          v-if="doneCount < totalEpisodes"
          class="btn primary"
          :disabled="starting || !currentBatch"
          @click="startTrial"
        >
          {{ starting ? '生成中…' : currentTrial ? '重算试跑门禁' : '创建 3 集试跑' }}
        </button>
        <button class="btn" @click="emit('back')">项目概览</button>
      </div>
    </div>

    <EmptyState
      v-if="!batches.length"
      title="尚未生成分集"
      desc="项目分集生成后，这里会出现批次分组和单集入口。"
      icon="▤"
    />

    <template v-else>
      <div class="batch-tabs" role="tablist" aria-label="批次切换">
        <button
          v-for="batch in batches"
          :key="batch.index"
          class="batch-tab"
          :class="{ active: batch.index === currentBatch?.index }"
          role="tab"
          :aria-selected="batch.index === currentBatch?.index"
          @click="emit('select-batch', batch.index)"
        >
          <b>{{ batch.label }}</b>
          <span>{{ batch.range }}</span>
          <em>{{ batch.status }}</em>
        </button>
      </div>

      <div v-if="currentBatch" class="batch-summary card">
        <div class="batch-summary-head">
          <div>
            <h3 class="card-title">{{ currentBatch.label }} · {{ currentBatch.range }}</h3>
            <p class="card-sub">本批 {{ totalEpisodes }} 集；已交付 {{ doneCount }}，质检通过待入 {{ qcCount }}，生产中 {{ activeCount }}</p>
          </div>
          <span class="pill" :class="{ accent: currentBatch.tone === 'active', ok: currentBatch.tone === 'done' }">
            {{ currentBatch.status }}
          </span>
        </div>
        <div class="batch-progress">
          <div class="bar"><i :style="{ width: `${progress}%` }" /></div>
          <span>{{ progress }}%</span>
        </div>
        <div class="batch-gates">
          <div class="batch-gate">
            <span>开工门禁</span>
            <b>{{ currentTrial?.gate || '尚未创建试跑单' }}</b>
          </div>
          <div class="batch-gate">
            <span>交付门禁</span>
            <b>{{ doneCount }} / {{ totalEpisodes }} 集已交付</b>
            <div v-if="currentPackage" class="package-line">
              批次包 {{ currentPackage.id }} · 已冻结
            </div>
            <button
              v-else-if="totalEpisodes && doneCount === totalEpisodes"
              class="gate-action"
              :disabled="packaging"
              @click="startPackage"
            >
              {{ packaging ? '生成中…' : '生成批次交付包' }}
            </button>
            <em v-else class="gate-hint">全部单集包交付后可生成批次包</em>
          </div>
          <div class="batch-gate">
            <span>模型基线</span>
            <b>{{ currentTrial?.model || '随试跑单锁定' }}</b>
          </div>
        </div>

        <div v-if="currentTrial" class="trial-card">
          <div class="trial-head">
            <div>
              <b>{{ currentTrial.status }}</b>
              <span>{{ currentTrial.range }} · {{ currentTrial.size }} 集试跑</span>
            </div>
            <span class="pill" :class="{ ok: currentTrial.status === '可开工', warn: currentTrial.status !== '可开工' }">
              {{ currentTrial.deliveryGate }}
            </span>
          </div>
          <div class="trial-episodes">
            <span v-for="no in trialEpisodes" :key="no">E{{ String(no).padStart(2, '0') }}</span>
          </div>
          <div class="trial-checks">
            <span
              v-for="check in trialChecks"
              :key="String(check.key)"
              :class="{ pass: check.pass, fail: !check.pass }"
            >
              <b>{{ check.label }}</b>
              <em>{{ check.detail }}</em>
            </span>
          </div>
          <p class="trial-note">{{ currentTrial.note }}</p>
        </div>
        <div v-else-if="doneCount < totalEpisodes" class="notice">
          批次试跑只做门禁预检：先锁定剧本、镜头与资产、模型基线，再进单集执行；不会自动推进任何一集。
        </div>
      </div>

      <div class="batch-grid">
        <button
          v-for="item in currentBatch?.episodes || []"
          :key="item.no"
          class="episode-card"
          @click="emit('open-episode', item)"
        >
          <div class="episode-card-head">
            <div>
              <span class="episode-no">E{{ String(item.no).padStart(2, '0') }}</span>
              <b>{{ item.row.title || '未命名单集' }}</b>
            </div>
            <StatusPill :status="item.row.status || '待生产'" />
          </div>
          <div class="episode-current">
            <span>当前阶段</span>
            <b>{{ item.flow.currentStep }} · {{ item.flow.steps.find((step) => step.key === item.flow.currentStep)?.name }}</b>
            <em>{{ item.flow.note }}</em>
          </div>
          <div class="episode-progress">
            <div class="bar"><i :style="{ width: `${item.flow.progress}%` }" /></div>
            <span>{{ item.flow.progress }}%</span>
          </div>
          <div class="episode-meta">
            <span>{{ item.row.duration || '时长待接入' }}</span>
            <span>{{ item.row.shots ?? 0 }} 镜</span>
            <span>QC {{ item.row.qc || '待检' }}</span>
          </div>
          <div class="episode-card-foot">
            <span>查看 E0–E7 工作区</span>
            <b>→</b>
          </div>
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.batch-board {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.board-title {
  margin: 0;
  font-size: 16px;
  color: var(--ink);
}
.board-sub {
  margin: 4px 0 0;
  max-width: 780px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
}
.board-actions {
  display: flex;
  gap: 8px;
}
.batch-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.batch-tab {
  flex: none;
  min-width: 150px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  color: var(--ink);
  text-align: left;
  padding: 9px 11px;
  cursor: pointer;
}
.batch-tab:hover,
.batch-tab.active {
  border-color: var(--accent);
  background: var(--surface);
}
.batch-tab b {
  display: inline-block;
  margin-right: 8px;
  color: var(--accent);
}
.batch-tab span {
  color: var(--muted);
  font-size: 11px;
}
.batch-tab em {
  display: block;
  margin-top: 4px;
  color: var(--faint);
  font-size: 10px;
  font-style: normal;
}
.batch-summary {
  padding: 14px;
}
.batch-summary-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.batch-progress,
.episode-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.batch-progress .bar,
.episode-progress .bar {
  flex: 1;
  height: 6px;
  border-radius: 99px;
  background: var(--surface-3);
  overflow: hidden;
}
.batch-progress .bar i,
.episode-progress .bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}
.batch-progress span,
.episode-progress span {
  min-width: 34px;
  text-align: right;
  color: var(--muted);
  font-size: 11px;
}
.batch-gates {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.batch-gate {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 9px 10px;
}
.batch-gate span {
  display: block;
  color: var(--muted);
  font-size: 10px;
}
.batch-gate b {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 11px;
  line-height: 1.45;
  font-weight: 600;
}
.package-line {
  margin-top: 6px;
  color: var(--accent);
  font-size: 10px;
  overflow-wrap: anywhere;
}
.gate-action {
  margin-top: 6px;
  border: 1px solid var(--accent);
  border-radius: 7px;
  background: transparent;
  color: var(--accent);
  padding: 3px 8px;
  font-size: 10px;
  cursor: pointer;
}
.gate-action:disabled {
  opacity: 0.55;
  cursor: default;
}
.gate-hint {
  display: block;
  margin-top: 5px;
  color: var(--faint);
  font-size: 10px;
  font-style: normal;
}
.trial-card {
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
  padding: 11px 12px;
}
.trial-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.trial-head b {
  color: var(--ink);
  font-size: 12px;
}
.trial-head span {
  margin-left: 8px;
  color: var(--muted);
  font-size: 11px;
}
.trial-episodes {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 9px;
}
.trial-episodes span {
  border: 1px solid var(--line);
  border-radius: 99px;
  padding: 2px 8px;
  color: var(--ink);
  font-size: 11px;
}
.trial-checks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  margin-top: 9px;
}
.trial-checks span {
  display: grid;
  gap: 2px;
  min-width: 0;
  border-left: 2px solid var(--line);
  padding-left: 7px;
}
.trial-checks span.pass {
  border-left-color: var(--accent);
}
.trial-checks span.fail {
  border-left-color: var(--warn);
}
.trial-checks b {
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
}
.trial-checks em {
  color: var(--ink);
  font-size: 11px;
  font-style: normal;
  overflow-wrap: anywhere;
}
.trial-note {
  margin: 9px 0 0;
  color: var(--faint);
  font-size: 10px;
  line-height: 1.5;
}
.batch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.episode-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--surface);
  color: var(--ink);
  padding: 12px;
  text-align: left;
  cursor: pointer;
}
.episode-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.episode-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.episode-no {
  display: inline-block;
  margin-right: 7px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}
.episode-card-head b {
  color: var(--ink);
  font-size: 13px;
}
.episode-current {
  display: grid;
  gap: 2px;
}
.episode-current span {
  color: var(--muted);
  font-size: 10px;
}
.episode-current b {
  color: var(--ink);
  font-size: 12px;
}
.episode-current em {
  color: var(--faint);
  font-size: 10px;
  font-style: normal;
}
.episode-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 10px;
}
.episode-meta span {
  border: 1px solid var(--line);
  border-radius: 99px;
  padding: 2px 7px;
}
.episode-card-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  color: var(--accent);
  font-size: 11px;
}
@media (max-width: 1100px) {
  .batch-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .batch-gates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .batch-grid,
  .batch-gates {
    grid-template-columns: 1fr;
  }
  .trial-checks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
