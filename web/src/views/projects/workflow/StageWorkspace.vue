<template>
  <div class="stage-content">
    <div v-if="stageKey !== 'script'" class="stage-kpis">
      <div v-for="item in kpis" :key="item.label" class="stage-kpi">
        <span>{{ item.label }}</span>
        <b>{{ item.value }}</b>
        <small v-if="item.hint">{{ item.hint }}</small>
      </div>
    </div>

    <div class="stage-main">
      <template v-if="stageKey === 'script'">
        <ScriptWorkspace :project="project" :summary="summary" @refresh="$emit('refresh')" @navigate="$emit('navigate', $event)" />
      </template>

      <template v-else-if="stageKey === 'plan'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">镜头生产计划</h3>
              <p class="card-sub">计划固化后锁定镜头、任务与并行组；变更必须重新校验并生成新版本。</p>
            </div>
            <span class="pill accent">{{ currentPlan?.id || '未固化' }}</span>
          </div>
          <div v-for="plan in plans" :key="plan.id" class="list-row">
            <span class="k">{{ plan.id }} · {{ plan.scope }}</span>
            <span class="v">{{ plan.shots }} 镜 / {{ plan.tasks }} 任务 · {{ plan.status }}</span>
            <p class="stage-note">固化 {{ plan.frozen }} · {{ plan.note }}</p>
          </div>
          <EmptyState v-if="!plans.length" title="暂无固化计划" desc="完成镜头契约校验后，计划会在此显示。" compact />
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">项目镜头契约</h3>
              <p class="card-sub">全项目 {{ shots.length }} 个镜头；当前计划覆盖 {{ currentPlan?.shots ?? 0 }} 镜。画面、人物、时长与参考资产缺一不可，下表展示前 10 个。</p>
            </div>
            <span class="pill" :class="{ warn: shotIssues.length }">{{ shotIssues.length }} 个缺项</span>
          </div>
          <DataTable
            :columns="[
              { key: 'ep', label: '集', width: '46px' },
              { key: 'scene', label: '场', width: '52px' },
              { key: 'no', label: '镜号' },
              { key: 'frame', label: '景别' },
              { key: 'duration', label: '时长' },
              { key: 'status', label: '状态', pill: true },
              { key: 'desc', label: '画面描述' },
            ]"
            :rows="shots.slice(0, 10)"
            row-key="id"
            wide
            empty-title="暂无镜头契约"
          />
          <p v-if="shotIssues.length" class="notice warn">存在缺项镜头：{{ shotIssues.slice(0, 4).join('、') }}</p>
        </div>
      </template>

      <template v-else-if="stageKey === 'video'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">生产队列</h3>
              <p class="card-sub">执行中受并发上限约束；失败任务保留尝试记录，可回到视频生产队列处理。</p>
            </div>
            <span class="pill">{{ videoTasks.length }} 个任务</span>
          </div>
          <div class="queue-grid">
            <div v-for="column in videoColumns" :key="column.status" class="queue-col">
              <div class="queue-head"><b>{{ column.status }}</b><span>{{ column.rows.length }}</span></div>
              <div v-for="task in column.rows.slice(0, 4)" :key="task.id" class="queue-item">
                <b>{{ task.id }} · {{ task.kind }}</b>
                <small>E{{ task.ep }} {{ task.scene }} / {{ task.shot }}</small>
                <span class="tag">尝试 {{ task.attempt }}/{{ task.maxAttempts }} · 预估 {{ task.est }}s</span>
              </div>
              <p v-if="!column.rows.length" class="queue-empty">暂无任务</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">任务明细</h3><p class="card-sub">按提交顺序展示；失败原因与质检结论随任务记录。</p></div>
          </div>
          <DataTable
            :columns="[
              { key: 'id', label: '任务' },
              { key: 'ep', label: '集' },
              { key: 'shot', label: '镜号' },
              { key: 'status', label: '状态', pill: true },
              { key: 'attempt', label: '尝试' },
              { key: 'est', label: '预估' },
              { key: 'failReason', label: '失败原因' },
            ]"
            :rows="videoTasks"
            row-key="id"
            wide
            empty-title="本阶段暂无视频任务"
          />
        </div>
      </template>

      <template v-else-if="stageKey === 'audio'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">对白配音</h3>
              <p class="card-sub">按角色音色合成；回听一致后才进入口型与混音。</p>
            </div>
            <span class="pill">{{ dialogues.length }} 条对白</span>
          </div>
          <DataTable
            :columns="[
              { key: 'ep', label: '集' },
              { key: 'char', label: '角色' },
              { key: 'text', label: '台词' },
              { key: 'voice', label: '音色' },
              { key: 'audio', label: '音频' },
              { key: 'status', label: '状态', pill: true },
              { key: 'cost', label: '成本' },
            ]"
            :rows="dialogues"
            row-key="id"
            wide
            empty-title="暂无对白"
          />
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">字幕与时间轴</h3><span class="card-sub">{{ subtitles.length }} 个版本 · 按集保留</span></div>
          <DataTable
            :columns="[
              { key: 'ep', label: '集' },
              { key: 'version', label: '版本' },
              { key: 'lines', label: '行' },
              { key: 'asr', label: '校对' },
              { key: 'style', label: '样式' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="subtitles"
            wide
            empty-title="暂无字幕版本"
          />
        </div>
      </template>

      <template v-else-if="stageKey === 'post'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">分集状态</h3>
              <p class="card-sub">按集查看场次、镜头、质检与时间线；点击行可查看分集详情。</p>
            </div>
            <span class="pill">{{ episodeDone }} / {{ project?.episodes || episodes.length }} 集已通过</span>
          </div>
          <DataTable
            :columns="[
              { key: 'no', label: '集' },
              { key: 'title', label: '标题' },
              { key: 'scenes', label: '场次' },
              { key: 'shots', label: '镜头' },
              { key: 'duration', label: '时长' },
              { key: 'qc', label: '质检', pill: true },
              { key: 'status', label: '状态', pill: true },
              { key: 'timeline', label: '时间线' },
            ]"
            :rows="episodes"
            row-key="no"
            clickable
            wide
            empty-title="暂无分集"
            @row-click="openEpisode"
          />
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">时间线版本</h3><p class="card-sub">过期片段存在时不能输出；重建时间线后重新质检。</p></div>
            <span class="pill" :class="{ warn: staleClips }">{{ staleClips }} 个过期片段</span>
          </div>
          <DataTable
            :columns="[
              { key: 'ep', label: '集' },
              { key: 'version', label: '版本' },
              { key: 'tracks', label: '轨道' },
              { key: 'clips', label: '片段' },
              { key: 'duration', label: '时长' },
              { key: 'stale', label: '过期' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="timelines"
            row-key="version"
            wide
            empty-title="暂无时间线"
          />
        </div>
      </template>

      <template v-else-if="stageKey === 'qc'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">质检报告</h3>
              <p class="card-sub">镜头级、单集级与整剧级分别出报告；高风险未关闭不能人工通过。</p>
            </div>
            <span class="pill" :class="{ warn: qualityFailCount }">{{ qualityFailCount }} 个 FAIL</span>
          </div>
          <DataTable
            :columns="[
              { key: 'id', label: '报告' },
              { key: 'level', label: '级别' },
              { key: 'object', label: '对象' },
              { key: 'result', label: '结论', pill: true },
              { key: 'items', label: '检查项' },
              { key: 'issues', label: '问题' },
              { key: 'engine', label: '引擎' },
              { key: 'at', label: '时间' },
            ]"
            :rows="qualityReports"
            row-key="id"
            wide
            empty-title="暂无质检报告"
          />
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">问题项</h3><p class="card-sub">按维度定位到集 / 场 / 镜；合规高风险直接阻断下游。</p></div>
            <span class="pill">{{ qualityIssues.length }} 项</span>
          </div>
          <DataTable
            :columns="[
              { key: 'dim', label: '维度' },
              { key: 'where', label: '位置' },
              { key: 'level', label: '风险' },
              { key: 'action', label: '建议处理' },
              { key: 'auto', label: '自动' },
            ]"
            :rows="qualityIssues"
            empty-title="暂无问题项"
            wide
          />
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">质量矩阵</h3><p class="card-sub">按资产、镜头、单集、整剧四级查看各维度结论；不适用记为空。</p></div>
            <span class="pill">{{ qualityMatrixRows.length }} 个维度</span>
          </div>
          <DataTable
            :columns="[
              { key: 'dim', label: '质量维度' },
              { key: 'asset', label: '资产级' },
              { key: 'shot', label: '镜头级' },
              { key: 'ep', label: '单集级' },
              { key: 'all', label: '整剧级' },
            ]"
            :rows="qualityMatrixRows"
            wide
            empty-title="暂无质量矩阵"
          />
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">返工台账</h3><p class="card-sub">每轮返工保留旧版本与成本，避免覆盖历史。</p></div>
            <span class="pill">{{ rework.length }} 单</span>
          </div>
          <DataTable
            :columns="[
              { key: 'id', label: '返工单' },
              { key: 'target', label: '对象' },
              { key: 'type', label: '类型' },
              { key: 'round', label: '轮次' },
              { key: 'cost', label: '成本' },
              { key: 'status', label: '状态', pill: true },
              { key: 'at', label: '时间' },
            ]"
            :rows="rework"
            row-key="id"
            wide
            empty-title="暂无返工记录"
          />
        </div>
      </template>

      <template v-else-if="stageKey === 'delivery'">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">交付清单</h3>
              <p class="card-sub">逐项核对成片、字幕、剧本、报告与授权资料；缺一不可冻结交付。</p>
            </div>
            <span class="pill" :class="{ accent: deliveryReadyCount === deliveryChecklist.length }">{{ deliveryReadyCount }} / {{ deliveryChecklist.length }} 就绪</span>
          </div>
          <DataTable
            :columns="[
              { key: 'item', label: '交付物' },
              { key: 'required', label: '必需', format: (row) => (row.required ? '是' : '否') },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="deliveryChecklist"
            empty-title="暂无清单"
          />
        </div>

        <div class="card">
          <div class="card-head">
            <div><h3 class="card-title">交付记录</h3><p class="card-sub">每次交付生成不可变版本，记录接收方、文件数与校验摘要。</p></div>
            <span class="pill">{{ deliveries.length }} 次</span>
          </div>
          <DataTable
            :columns="[
              { key: 'id', label: '交付包' },
              { key: 'version', label: '版本' },
              { key: 'episodes', label: '集数' },
              { key: 'files', label: '文件' },
              { key: 'size', label: '大小' },
              { key: 'receiver', label: '接收方' },
              { key: 'status', label: '状态', pill: true },
              { key: 'frozen', label: '冻结', format: (row) => (row.frozen ? '是' : '否') },
            ]"
            :rows="deliveries"
            row-key="id"
            wide
            empty-title="暂未生成交付包"
          />
        </div>
      </template>
    </div>

    <div v-if="stageKey !== 'brief' && stageKey !== 'script'" class="stage-side">
      <template v-if="stageKey === 'plan'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">导演资产</h3></div>
          <div v-for="item in directorAssetCounts" :key="item.label" class="list-row">
            <span class="k">{{ item.label }}</span>
            <span class="v">{{ item.value }}</span>
          </div>
          <div class="act-bar"><button class="btn" @click="$emit('navigate', '/director/cast')">人物档案</button><button class="btn" @click="$emit('navigate', '/director/world')">场景道具</button></div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">契约检查</h3><span class="pill" :class="{ warn: shotIssues.length }">{{ shotChecked }}</span></div>
          <div class="list-row"><span class="k">画面描述</span><span class="v">{{ shotMissing('desc') }} 个缺失</span></div>
          <div class="list-row"><span class="k">人物 / 参考</span><span class="v">{{ shotMissing('chars') }} 个缺失</span></div>
          <div class="list-row"><span class="k">时长</span><span class="v">{{ shotMissing('duration') }} 个缺失</span></div>
          <p class="stage-note">检查范围为全项目 {{ shots.length }} 个镜头；当前计划 {{ currentPlan?.shots ?? 0 }} 镜，固化前按计划范围复核。</p>
        </div>
      </template>

      <template v-else-if="stageKey === 'video'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">执行与预算</h3></div>
          <div class="list-row"><span class="k">执行中</span><span class="v">{{ videoExecuting }} 个 · 并发上限 3</span></div>
          <div class="list-row"><span class="k">预算占用</span><span class="v">¥{{ Number(project?.actual || 0).toLocaleString('zh-CN') }} / ¥{{ Number(project?.budget || 0).toLocaleString('zh-CN') }}</span></div>
          <div class="bar"><i :style="{ width: `${budgetPercent}%` }" /></div>
          <p class="stage-note">失败重试仍受最大尝试次数约束；超限后转人工处理。</p>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">失败任务</h3><span class="pill warn">{{ videoFailed.length }}</span></div>
          <div v-for="task in videoFailed.slice(0, 3)" :key="task.id" class="list-row">
            <span class="k">{{ task.id }} · E{{ task.ep }} {{ task.shot }}</span>
            <span class="v">{{ task.failReason }}</span>
          </div>
          <EmptyState v-if="!videoFailed.length" title="当前无失败任务" desc="失败任务会在这里列出原因与重试次数。" compact />
          <div class="act-bar"><button class="btn" @click="$emit('navigate', '/video/production')">进入生产队列</button></div>
        </div>
      </template>

      <template v-else-if="stageKey === 'audio'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">口型同步</h3><span class="card-sub">{{ lipSync.length }} 条</span></div>
          <DataTable
            :columns="[
              { key: 'shot', label: '镜头' },
              { key: 'line', label: '对白' },
              { key: 'match', label: '匹配' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="lipSync"
            empty-title="暂无口型任务"
          />
          <p class="stage-note">口型在台词定稿后执行；重配台词会触发对应镜头重做。</p>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">声音档案</h3><span class="card-sub">{{ voiceProfiles.length }} 个</span></div>
          <div v-for="voice in voiceProfiles" :key="voice.id" class="list-row">
            <span class="k">{{ voice.char }} · {{ voice.timbre }}</span>
            <span class="v">{{ voice.status }} · 至 {{ voice.validUntil }}</span>
            <p class="stage-note">{{ voice.lang }} · {{ voice.rights }}</p>
          </div>
          <EmptyState v-if="!voiceProfiles.length" title="暂无声音档案" desc="创建角色音色后在此查看授权有效期。" compact />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">配乐与音效</h3><span class="card-sub">{{ audioAssets.length }} 个</span></div>
          <div v-for="asset in audioAssets" :key="asset.id" class="list-row">
            <span class="k">{{ asset.name }}</span>
            <span class="v">{{ asset.status }} · {{ asset.type }}</span>
            <p class="stage-note">{{ asset.used }} · {{ asset.mix }}</p>
          </div>
          <EmptyState v-if="!audioAssets.length" title="暂无音频资产" desc="生成或登记的配乐、音效会在此显示授权与使用位置。" compact />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">混音检查</h3><span class="pill">{{ audioChecks.filter((item) => item.ok).length }} / {{ audioChecks.length }}</span></div>
          <div class="check-grid">
            <div v-for="item in audioChecks" :key="item.label" class="check-item">
              <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
              <span>{{ item.label }}</span>
            </div>
          </div>
          <p class="stage-note">混音输出前确认：对白 -16 LUFS、音乐 -18 LUFS、字幕对齐整数毫秒。</p>
        </div>
      </template>

      <template v-else-if="stageKey === 'post'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">时间线轨道</h3><span class="card-sub">{{ tracks.length }} 轨</span></div>
          <div class="timeline-lanes">
            <div v-for="track in tracks" :key="track.name" class="lane">
              <span class="name">{{ track.name }}</span>
              <div class="track">
                <div v-for="clip in track.items" :key="clip.label" class="clip" :style="{ width: `${clip.w}px`, flex: 'none' }">{{ clip.label }}</div>
              </div>
            </div>
          </div>
          <p class="stage-note">示例为当前集轨道结构；过期片段会在重建后替换。</p>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">输出准入</h3></div>
          <div class="check-grid">
            <div v-for="item in postChecks" :key="item.label" class="check-item">
              <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="stageKey === 'qc'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">质检门槛</h3></div>
          <div class="check-grid">
            <div v-for="item in qualityChecks" :key="item.label" class="check-item">
              <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
              <span>{{ item.label }}</span>
            </div>
          </div>
          <div class="act-bar"><button class="btn" @click="$emit('navigate', '/quality/reports')">质量报告</button><button class="btn" @click="$emit('navigate', '/quality/rework')">返工台账</button></div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">质量等级</h3></div>
          <div v-for="level in qualityLevels" :key="level.level" class="list-row">
            <span class="k">{{ level.level }}</span>
            <span class="v">{{ level.object }}</span>
            <p class="stage-note">{{ level.check }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="stageKey === 'delivery'">
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付门槛</h3></div>
          <div class="check-grid">
            <div v-for="item in deliveryChecks" :key="item.label" class="check-item">
              <i :class="{ on: item.ok }">{{ item.ok ? '✓' : '' }}</i>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">交付规格</h3></div>
          <div v-for="item in deliverySpecs" :key="item.label" class="list-row">
            <span class="k">{{ item.label }}</span>
            <span class="v">{{ item.value }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Row } from '../../../mock/db'
import DataTable from '../../../components/ui/DataTable.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import ScriptWorkspace from './ScriptWorkspace.vue'

const props = defineProps<{
  stageKey: string
  project: Row | null
  summary: Row
}>()

const emit = defineEmits<{
  (event: 'open-episode', row: Row): void
  (event: 'navigate', path: string): void
  (event: 'refresh'): void
}>()

function list(key: string): Row[] {
  return (props.summary[key] as Row[] | undefined) ?? []
}

const plans = computed(() => list('plans'))
const shots = computed(() => list('shots'))
const characters = computed(() => list('characters'))
const locations = computed(() => list('locations'))
const propsRows = computed(() => list('props'))
const episodes = computed(() => list('episodes'))
const tasks = computed(() => list('tasks'))
const dialogues = computed(() => list('dialogues'))
const voiceProfiles = computed(() => list('voiceProfiles'))
const audioAssets = computed(() => list('audioAssets'))
const subtitles = computed(() => list('subtitles'))
const lipSync = computed(() => list('lipSync'))
const timelines = computed(() => list('timelines'))
const tracks = computed(() => list('tracks'))
const qualityReports = computed(() => list('qualityReports'))
const qualityIssues = computed(() => list('qualityIssues'))
const qualityLevels = computed(() => list('qualityLevels'))
function qualityWord(value: unknown) {
  if (value === 'PASS') return '通过'
  if (value === 'REVIEW') return '待复核'
  if (value === 'FAIL') return '阻断'
  return '—'
}
const qualityMatrixRows = computed(() =>
  list('qualityMatrix').map((row) => ({
    dim: row.dim,
    asset: qualityWord(row.asset),
    shot: qualityWord(row.shot),
    ep: qualityWord(row.ep),
    all: qualityWord(row.all),
  })),
)
const rework = computed(() => list('rework'))
const deliveries = computed(() => list('deliveries'))
const deliveryChecklist = computed(() => list('deliveryChecklist'))

const currentPlan = computed(() => plans.value[0] ?? null)
const videoTasks = computed(() => tasks.value.filter((row) => String(row.stage) === '视频生产'))
const videoExecuting = computed(() => videoTasks.value.filter((row) => String(row.status) === '执行中').length)
const videoFailed = computed(() => videoTasks.value.filter((row) => String(row.status) === '失败'))
const videoColumns = computed(() =>
  ['执行中', '排队中', '失败', '成功'].map((status) => ({
    status,
    rows: videoTasks.value.filter((row) => String(row.status) === status),
  })),
)
const episodeDone = computed(() => episodes.value.filter((row) => String(row.status).includes('已通过质检')).length)
const subtitleReady = computed(() => {
  const ready = subtitles.value.filter((row) => String(row.status) === '已通过').map((row) => Number(row.ep))
  return new Set(ready).size
})
const staleClips = computed(() => timelines.value.reduce((sum, row) => sum + Number(row.stale || 0), 0))
const qualityFailCount = computed(() => qualityReports.value.filter((row) => String(row.result) === 'FAIL').length)
const qualityReviewCount = computed(() =>
  qualityReports.value.reduce((sum, row) => sum + Number(row.review || 0), 0),
)
const qualityHighIssues = computed(() => qualityIssues.value.filter((row) => String(row.level) === '高'))
const passRate = computed(() => {
  if (!qualityReports.value.length) return 0
  return Math.round((qualityReports.value.filter((row) => String(row.result) === 'PASS').length / qualityReports.value.length) * 100)
})
const deliveryReadyCount = computed(() => deliveryChecklist.value.filter((row) => String(row.status) === '已就绪').length)
const budgetPercent = computed(() =>
  Math.min(100, Math.round((Number(props.project?.actual || 0) / Math.max(1, Number(props.project?.budget || 1))) * 100)),
)

const shotIssues = computed(() =>
  shots.value
    .filter((row) => !String(row.desc ?? '').trim() || !String(row.chars ?? '').trim() || !String(row.duration ?? '').trim())
    .map((row) => String(row.id)),
)
const shotChecked = computed(() => `${shots.value.length - shotIssues.value.length} / ${shots.value.length} 通过`)
const directorAssetCounts = computed(() => [
  { label: '人物档案', value: `${characters.value.length} 个` },
  { label: '场景', value: `${locations.value.length} 个` },
  { label: '场景道具', value: `${propsRows.value.length} 个` },
  { label: '正式资产', value: `${list('assets').filter((row) => row.formal).length} 个` },
])

function shotMissing(field: string) {
  return shots.value.filter((row) => !String(row[field] ?? '').trim()).length
}

const postChecks = computed(() => [
  { label: '分集均已通过质检', ok: episodeDone.value === Number(props.project?.episodes || episodes.value.length) },
  { label: '时间线无过期片段', ok: staleClips.value === 0 },
  { label: '字幕校对完成', ok: subtitles.value.every((row) => String(row.status) === '已通过') },
])
const qualityChecks = computed(() => [
  { label: '无 FAIL 报告', ok: qualityFailCount.value === 0 },
  { label: '无高风险问题', ok: qualityHighIssues.value.length === 0 },
  { label: '待人工项已确认', ok: qualityReviewCount.value === 0 },
  { label: '单集与整剧均出报告', ok: qualityReports.value.some((row) => String(row.level) === '单集级') && qualityReports.value.some((row) => String(row.level) === '整剧级') },
])
const deliveryChecks = computed(() => [
  { label: '集数完整', ok: Number(props.project?.done || 0) >= Number(props.project?.episodes || 1) },
  { label: '质检无阻断', ok: qualityFailCount.value === 0 && qualityHighIssues.value.length === 0 },
  { label: '待人工已清零', ok: qualityReviewCount.value === 0 },
  { label: '整剧质检已通过', ok: qualityReports.value.some((row) => String(row.level) === '整剧级' && String(row.result) === 'PASS') },
  { label: '交付清单全部就绪', ok: deliveryReadyCount.value === deliveryChecklist.value.length },
  { label: '版本已冻结', ok: deliveries.value.some((row) => Boolean(row.frozen)) },
])
const deliverySpecs = computed(() => [
  { label: '画幅', value: String(props.project?.ratio ?? '—') },
  { label: '单集时长', value: String(props.project?.duration ?? '—') },
  { label: '语言', value: String(props.project?.language ?? '—') },
  { label: '交付格式', value: 'MP4 + SRT + PDF 清单' },
])
const deliveryGateCount = computed(() => deliveryChecks.value.filter((item) => item.ok).length)
const audioChecks = computed(() => [
  { label: '台词均已生成音频', ok: dialogues.value.every((row) => String(row.audio ?? '').startsWith('已生成')) },
  { label: '口型全部通过', ok: lipSync.value.length > 0 && lipSync.value.every((row) => String(row.status) === '已通过') },
  { label: '字幕全部校对完成', ok: subtitles.value.length > 0 && subtitles.value.every((row) => String(row.status) === '已通过') },
  { label: '配乐与音效授权有效', ok: audioAssets.value.every((row) => String(row.status) === '已通过') },
])

const kpis = computed<Array<{ label: string; value: string | number; hint?: string }>>(() => {
  if (props.stageKey === 'plan') {
    return [
      { label: '固化计划', value: plans.value.length, hint: currentPlan.value?.id ?? '未固化' },
      { label: '计划镜头', value: currentPlan.value?.shots ?? 0, hint: currentPlan.value?.scope ?? '—' },
      { label: '计划任务', value: currentPlan.value?.tasks ?? 0, hint: '含并行组' },
      { label: '项目镜头', value: shotChecked.value, hint: `全项目 ${shots.value.length} 镜` },
      { label: '视觉资产', value: characters.value.length + locations.value.length + propsRows.value.length, hint: '人物 / 场景 / 道具' },
    ]
  }
  if (props.stageKey === 'video') {
    return [
      { label: '视频任务', value: videoTasks.value.length },
      { label: '执行中', value: videoExecuting.value, hint: '并发上限 3' },
      { label: '排队中', value: videoTasks.value.filter((row) => String(row.status) === '排队中').length },
      { label: '失败', value: videoFailed.value.length, hint: '可重试' },
      { label: '预算占用', value: `${budgetPercent.value}%`, hint: `¥${Number(props.project?.actual || 0).toLocaleString('zh-CN')}` },
    ]
  }
  if (props.stageKey === 'audio') {
    return [
      { label: '对白', value: dialogues.value.length },
      { label: '声音档案', value: voiceProfiles.value.length },
      { label: '音频资产', value: audioAssets.value.length },
      { label: '字幕版本', value: subtitles.value.length },
      { label: '口型任务', value: lipSync.value.length },
    ]
  }
  if (props.stageKey === 'post') {
    return [
      { label: '已通过集', value: `${episodeDone.value} / ${props.project?.episodes ?? episodes.value.length}` },
      { label: '时间线', value: timelines.value.length },
      { label: '过期片段', value: staleClips.value, hint: staleClips.value ? '需重建' : '可输出' },
      { label: '字幕就绪', value: `${subtitleReady.value} / ${props.project?.episodes ?? episodes.value.length}` },
      { label: '交付清单', value: `${deliveryReadyCount.value} / ${deliveryChecklist.value.length}` },
    ]
  }
  if (props.stageKey === 'qc') {
    return [
      { label: '质检报告', value: qualityReports.value.length },
      { label: '问题项', value: qualityIssues.value.length },
      { label: '待人工', value: qualityReviewCount.value },
      { label: 'FAIL', value: qualityFailCount.value, hint: qualityFailCount.value ? '阻断下游' : '无阻断' },
      { label: 'PASS 率', value: `${passRate.value}%` },
    ]
  }
  if (props.stageKey === 'delivery') {
    return [
      { label: '交付记录', value: deliveries.value.length },
      { label: '清单就绪', value: `${deliveryReadyCount.value} / ${deliveryChecklist.value.length}` },
      { label: '集数完成', value: `${props.project?.done ?? 0} / ${props.project?.episodes ?? 0}` },
      { label: '质量结论', value: qualityFailCount.value ? '阻断' : qualityReviewCount.value ? '待人工' : '通过', hint: `${qualityFailCount.value} FAIL / ${qualityReviewCount.value} 待确认` },
      { label: '交付门槛', value: `${deliveryGateCount.value} / ${deliveryChecks.value.length}`, hint: deliveryGateCount.value === deliveryChecks.value.length ? '可冻结' : '未就绪' },
    ]
  }
  return []
})

function openEpisode(row: Row) {
  emit('open-episode', row)
}
</script>

<style scoped>
.stage-content {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}
.stage-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
  gap: 8px;
}
.stage-kpi {
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 9px 10px;
  min-width: 0;
}
.stage-kpi span {
  display: block;
  font-size: 10px;
  color: var(--muted);
}
.stage-kpi b {
  display: block;
  margin-top: 3px;
  font-size: 18px;
  line-height: 1.3;
  color: var(--ink);
}
.stage-kpi small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stage-main,
.stage-side {
  display: grid;
  gap: 12px;
  align-content: start;
}
.stage-side {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.stage-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.kv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.kv-grid > div {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-2);
  padding: 8px 10px;
}
.kv-grid .wide {
  grid-column: 1 / -1;
}
.kv-grid b {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.plan-card {
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 10px;
}
.plan-card.chosen {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.plan-head b {
  font-size: 12px;
  color: var(--ink);
}
.plan-selling {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
}
.queue-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.queue-col {
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface-2);
  padding: 8px;
  min-height: 120px;
}
.queue-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ink-2);
  margin-bottom: 6px;
}
.queue-item {
  display: grid;
  gap: 2px;
  border-top: 1px solid var(--line);
  padding: 7px 0;
}
.queue-item b {
  font-size: 11px;
  color: var(--ink);
}
.queue-item small {
  font-size: 10px;
  color: var(--muted);
}
.queue-item .tag {
  width: fit-content;
}
.queue-empty {
  margin: 8px 0;
  font-size: 10px;
  color: var(--faint);
}
.check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: var(--ink-2);
}
.check-item i {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  display: grid;
  place-items: center;
  font-style: normal;
  font-size: 10px;
  color: var(--faint);
  flex: none;
}
.check-item i.on {
  border-color: var(--ok);
  color: var(--ok);
  background: rgba(90, 200, 140, 0.12);
}
@media (max-width: 1280px) {
  .plan-grid,
  .queue-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .stage-side,
  .stage-split,
  .kv-grid,
  .check-grid {
    grid-template-columns: 1fr;
  }
  .plan-grid,
  .queue-grid {
    grid-template-columns: 1fr;
  }
}
</style>
