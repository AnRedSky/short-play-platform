<template>
  <div class="script-workspace">
    <div class="stage-kpis">
      <div v-for="item in kpis" :key="item.label" class="stage-kpi">
        <span>{{ item.label }}</span>
        <b>{{ item.value }}</b>
        <small>{{ item.hint }}</small>
      </div>
    </div>

    <div class="card script-flow-card">
      <div class="card-head">
        <div>
          <h3 class="card-title">剧本创作入口</h3>
          <p class="card-sub">{{ sourceIntro }}<span v-if="lockedScript"> 本阶段已完成；下列步骤用于新建修订版。</span></p>
        </div>
        <div class="script-flow-actions">
          <button
            v-if="sourceMode === 'model'"
            type="button"
            class="btn primary"
            :disabled="!canGenerate"
            :title="canGenerate ? '' : '当前状态暂不能生成或编辑剧本'"
            @click="openGenerate(false)"
          >{{ generateLabel }}</button>
          <button
            v-else-if="sourceMode === 'manual'"
            type="button"
            class="btn primary"
            :disabled="!canGenerate || creating"
            @click="createManualScript"
          >{{ creating ? '创建中…' : activeSourceKind === 'manual' && activeDraft ? '新建一集' : '新建空白剧本' }}</button>
          <template v-else>
            <button
              v-if="novelSourceReady"
              type="button"
              class="btn primary"
              :disabled="!canGenerate || adapting"
              @click="openChapterMapping"
            >{{ adapting ? '生成中…' : '章节映射' }}</button>
            <button
              v-else
              type="button"
              class="btn primary"
              :disabled="!canGenerate"
              @click="openNovel"
            >导入小说 / 章节</button>
            <button v-if="novelSourceReady" type="button" class="btn" :disabled="!canGenerate" @click="openNovel">重新导入</button>
          </template>
          <button
            v-if="sourceMode === 'model' && activeDraft"
            type="button"
            class="btn"
            :disabled="!canGenerate"
            @click="newVersion"
          >另起一版</button>
          <button
            v-if="projectStatus === '剧本创作中'"
            type="button"
            class="btn"
            :class="{ primary: canSubmit }"
            :disabled="!canSubmit || submitting"
            :title="submitHint"
            @click="submitReview"
          >{{ submitting ? '提交中…' : '提交剧本审核' }}</button>
        </div>
      </div>

      <div class="script-source-tabs" role="tablist" aria-label="创作方式">
        <button
          v-for="mode in sourceModes"
          :key="mode.key"
          type="button"
          role="tab"
          class="script-source-tab"
          :class="{ active: sourceMode === mode.key }"
          :aria-selected="sourceMode === mode.key"
          @click="sourceMode = mode.key"
        >
          <b>{{ mode.label }}</b>
          <small>{{ mode.desc }}</small>
        </button>
      </div>

      <div class="script-source-note">
        <span class="pill" :class="{ accent: sourceReady }">{{ sourceLabel }}</span>
        <span>{{ sourceModeHelp }}</span>
      </div>

      <div class="script-flow">
        <div
          v-for="step in flowSteps"
          :key="step.title"
          class="script-flow-step"
          :class="{ done: step.ok, now: !step.ok && step.no === firstUndone }"
        >
          <i>{{ step.ok ? '✓' : step.no }}</i>
          <div><b>{{ step.title }}</b><small>{{ step.desc }}</small></div>
        </div>
      </div>

      <p v-if="lockedScript" class="notice script-gate-note">
        正式版本 {{ lockedScript.version }} 已锁定并供下游引用。如需修改，请另起一版，审核通过后才替换基线。
      </p>
    </div>

    <div class="script-split">
      <div class="card script-canvas">
        <div class="card-head">
          <div>
            <h3 class="card-title">剧本工作区</h3>
            <p class="card-sub">
              {{ activeScript ? `${activeScript.id} · ${activeScript.version} · ${activeScript.status}` : '尚未建立剧本版本' }}
              <span v-if="activeDraft">· 已写 {{ draftEpisodes.length }} / {{ totalEpisodes }} 集</span>
            </p>
          </div>
          <div class="script-head-tools">
            <select v-if="versions.length" v-model="selectedId" class="field script-version-select" aria-label="切换剧本版本">
              <option v-for="version in versions" :key="version.id" :value="version.id">
                {{ version.version }} · {{ version.status }}
              </option>
            </select>
            <button v-if="activeDraft && activeEpisode" type="button" class="btn" @click="openEditor">编辑本集</button>
          </div>
        </div>

        <div v-if="!activeScript" class="script-empty">
          <b>还没有剧本版本</b>
          <p>{{ emptyIntro }}</p>
          <button v-if="sourceMode === 'model'" type="button" class="btn primary" :disabled="!canGenerate" @click="openGenerate(false)">用模型生成第一版</button>
          <button v-else-if="sourceMode === 'manual'" type="button" class="btn primary" :disabled="!canGenerate || creating" @click="createManualScript">{{ creating ? '创建中…' : '新建空白剧本' }}</button>
          <button v-else type="button" class="btn primary" :disabled="!canGenerate" @click="openNovel">导入小说 / 章节</button>
        </div>

        <div v-else-if="!draftEpisodes.length" class="script-empty">
          <b>{{ activeScript.locked ? `${activeScript.version} 已锁定` : emptyDraftTitle }}</b>
          <p>{{ emptyDraftText }}</p>
          <div v-if="activeSourceKind === 'novel' && novelChapterPreview.length" class="script-novel-preview">
            <span v-for="chapter in novelChapterPreview" :key="chapter.no" class="pill">第 {{ chapter.no }} 章 · {{ chapter.title }}</span>
          </div>
          <button v-if="activeScript.locked" type="button" class="btn primary" :disabled="!canGenerate" @click="openGenerate(false)">生成修订版</button>
          <button v-else-if="activeSourceKind === 'novel' && novelSourceReady" type="button" class="btn primary" :disabled="!canGenerate || adapting" @click="openChapterMapping">{{ adapting ? '生成中…' : '章节映射并生成分集稿' }}</button>
          <button v-else-if="activeSourceKind === 'novel'" type="button" class="btn primary" :disabled="!canGenerate" @click="openNovel">重新导入小说全文</button>
          <button v-else-if="activeSourceKind === 'manual'" type="button" class="btn primary" :disabled="!canGenerate || creating" @click="addManualEpisode">{{ creating ? '创建中…' : '新建第一集' }}</button>
          <button v-else-if="activeSourceKind === 'model'" type="button" class="btn primary" :disabled="!canGenerate" @click="openGenerate(false)">用模型补齐分集稿</button>
        </div>

        <div v-else class="script-body">
          <div class="script-episode-list" role="list" aria-label="分集稿">
            <button
              v-for="episode in draftEpisodes"
              :key="episode.no"
              type="button"
              class="script-episode-item"
              :class="{ active: episode.no === activeEpisode?.no }"
              @click="selectedEpisodeNo = episode.no"
            >
              <span class="no">第 {{ String(episode.no).padStart(2, '0') }} 集</span>
              <span class="title">{{ episode.title }}</span>
              <small>{{ episode.scenes.length }} 场 · {{ episodeLineCount(episode) }} 行{{ episode.edited ? ' · 已修订' : '' }}</small>
            </button>
          </div>

          <div v-if="activeEpisode" class="script-episode-detail">
            <div class="script-episode-head">
              <div>
                <div class="script-episode-title">
                  <b>第 {{ String(activeEpisode.no).padStart(2, '0') }} 集 · {{ activeEpisode.title }}</b>
                  <span class="pill">{{ activeEpisode.scenes.length }} 场</span>
                  <span v-if="activeEpisode.edited" class="pill accent">人工修订</span>
                </div>
                <p>{{ activeEpisode.logline }}</p>
              </div>
              <div class="script-episode-actions">
                <button type="button" class="btn" :disabled="!canGenerate" @click="openRewrite(activeEpisode)">模型重写本集</button>
                <button type="button" class="btn" @click="openEditor">编辑内容</button>
              </div>
            </div>

            <div class="script-hook"><span class="metric-label">结尾钩子</span><b>{{ activeEpisode.hook }}</b></div>

            <article v-for="scene in activeEpisode.scenes" :key="`${activeEpisode.no}-${scene.no}`" class="script-scene">
              <header>
                <b>S{{ scene.no }}</b>
                <span>{{ scene.location }}</span>
                <small>{{ scene.time }} · {{ scene.chars }}</small>
              </header>
              <p>{{ scene.action }}</p>
              <div class="script-lines">
                <div v-for="(line, index) in scene.lines" :key="index" class="script-line">
                  <b>{{ line.char }}</b><span>{{ line.text }}</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div class="script-side">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">创作设定</h3>
              <p class="card-sub">创作来源、项目基线会随版本留档；不通过单独阶段审批。</p>
            </div>
            <span class="pill" :class="{ accent: sourceReady }">{{ sourceLabel }}</span>
          </div>
          <blockquote class="script-source">{{ sourceSummary }}</blockquote>
          <div v-if="novelSourceReady" class="script-source-actions">
            <button type="button" class="btn ghost sm" @click="openChapterView(1)">查看源章节</button>
            <small>共 {{ novelSource?.chapters?.length ?? 0 }} 章，可核对原文</small>
          </div>
          <div class="script-input-grid">
            <div><span class="metric-label">题材</span><b>{{ project?.genre || '—' }}</b></div>
            <div><span class="metric-label">受众</span><b>{{ project?.audience || '—' }}</b></div>
            <div><span class="metric-label">单集时长</span><b>{{ project?.duration || '—' }}</b></div>
            <div><span class="metric-label">语言</span><b>{{ project?.language || '—' }}</b></div>
            <div class="wide"><span class="metric-label">影像风格</span><b>{{ project?.style || '—' }}</b></div>
            <div class="wide"><span class="metric-label">内容约束</span><b>{{ project?.constraints || '—' }}</b></div>
          </div>
          <div v-if="generation" class="script-generation">
            <span class="metric-label">最近一次模型生成</span>
            <b>{{ generation.model }} · {{ generation.elapsed }} · 约 {{ generation.tokens }} tokens · ¥{{ generation.cost }}</b>
            <small>{{ generation.strength }} · {{ generation.scope === 'full' ? '整剧' : `第 ${generation.from}–${generation.from + generation.count - 1} 集` }} · {{ generation.at }}</small>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h3 class="card-title">{{ activeScript?.locked ? '修订版门禁' : '提交门禁' }}</h3>
            <span class="pill" :class="{ accent: gatePass }">{{ gateDone }} / 5</span>
          </div>
          <ul class="script-checks">
            <li v-for="check in gateChecks" :key="check.label" :class="{ ok: check.ok }">
              <i>{{ check.ok ? '✓' : '!' }}</i>
              <div><b>{{ check.label }}</b><small>{{ check.detail }}</small></div>
            </li>
          </ul>
          <p class="script-gate-hint">{{ submitHint }}</p>
        </div>
      </div>
    </div>

    <div class="script-records">
      <div class="card">
        <div class="card-head"><h3 class="card-title">版本链</h3><span class="card-sub">点击切换查看</span></div>
        <div class="script-version-list">
          <button
            v-for="version in versions"
            :key="version.id"
            type="button"
            class="script-version-row"
            :class="{ active: version.id === activeScript?.id }"
            @click="selectedId = version.id"
          >
            <span class="k">{{ version.version }} · {{ version.id }}</span>
            <StatusPill :status="String(version.status)" />
            <span class="v">{{ version.writtenEpisodes ?? version.episodes ?? 0 }} / {{ totalEpisodes }} 集 · {{ version.scenes ?? 0 }} 场</span>
            <small>{{ version.by || '—' }} · {{ version.at || '—' }} · {{ version.note || '—' }}</small>
          </button>
          <EmptyState v-if="!versions.length" title="暂无剧本版本" desc="模型生成后，版本链会在这里留档。" compact />
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3 class="card-title">审核记录</h3></div>
        <div v-for="review in scriptReviews" :key="String(review.id)" class="script-review-row">
          <span class="k">{{ review.version }} · {{ reviewNode(review.node) }}</span>
          <StatusPill :status="String(review.result)" />
          <p>{{ review.note || '—' }} · {{ review.auditor }} · {{ review.at }}</p>
        </div>
        <EmptyState v-if="!scriptReviews.length" title="暂无审核记录" desc="提交审核后，结论与意见会在这里留痕。" compact />
      </div>
    </div>

    <div v-if="novelOpen" class="modal-backdrop script-editor-backdrop" @click.self="closeNovel">
      <div class="modal wide script-novel-modal" role="dialog" aria-modal="true" aria-label="导入小说或章节">
        <div class="modal-head">
          <div>
            <h3>导入小说 / 章节</h3>
            <p>解析章节正文并保留全文；导入后做章节映射，即可生成可分集稿。</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭小说导入" @click="closeNovel">✕</button>
        </div>
        <div class="modal-body script-novel-body">
          <label class="field-wrap">
            <span class="metric-label">作品名称</span>
            <input v-model="novelTitle" class="field" placeholder="例：雾城来信（原著）" />
          </label>
          <label class="field-wrap">
            <span class="metric-label">选择文件</span>
            <input type="file" accept=".txt,.md,text/plain,text/markdown" class="field" @change="onNovelFile" />
            <small class="field-hint">支持纯文本与标记文本，单次不超过 12 万字；Word 文档、固定版式文档在后续流程接入。</small>
          </label>
          <label class="field-wrap">
            <span class="metric-label">或粘贴章节内容</span>
            <textarea v-model="novelText" class="field" rows="8" placeholder="粘贴全文或章节；系统会按「第 X 章 / Chapter X」识别章节目录，并保留每章正文。" />
            <small class="field-hint">当前 {{ novelCharCount }} 字，上限 120,000 字。</small>
          </label>
          <div v-if="novelChapters.length" class="script-novel-chapters">
            <div class="script-novel-summary">
              <span class="pill accent">识别 {{ novelChapters.length }} 章</span>
              <span class="muted">共 {{ novelWordCount }} 字 · 已解析每章正文</span>
            </div>
            <div class="script-novel-list">
              <span v-for="chapter in novelChapters.slice(0, 12)" :key="chapter.no" class="script-novel-chip">
                第 {{ chapter.no }} 章 · {{ chapter.title }} · {{ chapter.words }} 字
              </span>
            </div>
            <small v-if="novelChapters.length > 12" class="field-hint">仅显示前 12 章，其余章节同样解析。</small>
          </div>
          <p class="notice">导入只建立小说来源与章节目录；点“章节映射”后，才会按映射关系生成分集稿。</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="closeNovel">取消</button>
          <button type="button" class="btn primary" :disabled="!canImportNovel || importing" @click="importNovel">
            {{ importing ? '解析中…' : '导入并解析小说' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="mapOpen" class="modal-backdrop script-editor-backdrop" @click.self="closeChapterMapping">
      <div class="modal wide script-map-modal" role="dialog" aria-modal="true" aria-label="章节映射并生成分集稿">
        <div class="modal-head">
          <div>
            <h3>章节映射并生成分集稿</h3>
            <p>一章可拆成多集，多章也可并进同一集；未映射的集不会进入分集稿。</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭章节映射" @click="closeChapterMapping">✕</button>
        </div>
        <div class="modal-body script-map-body">
          <div class="script-map-source">
            <span class="pill accent">{{ sourceLabel }}</span>
            <b>《{{ String(novelSource?.title ?? '未命名') }}》</b>
            <span class="muted">{{ mappingRows.length }} 章 · {{ novelSourceWords }} 字 · 目标 {{ totalEpisodes }} 集</span>
            <button type="button" class="btn ghost sm" @click="autoMapChapters">按集均分</button>
          </div>

          <div class="script-map-list">
            <div class="script-map-row script-map-head">
              <span>章节</span><span>字数</span><span>起始集</span><span>拆/并集数</span>
            </div>
            <div v-for="(row, index) in mappingRows" :key="row.no" class="script-map-row">
              <span>
                <b>第 {{ row.no }} 章</b> {{ row.title }}
                <button type="button" class="link-btn script-map-source-link" @click="openChapterView(row.no)">查看原文</button>
              </span>
              <small>{{ row.words }} 字</small>
              <span class="script-map-start">第 {{ String(row.fromEpisode).padStart(2, '0') }} 集</span>
              <select
                v-model.number="row.episodeCount"
                class="field"
                :aria-label="`第 ${row.no} 章拆并集数`"
                @change="reflowMapping"
              >
                <option v-for="count in mappingMaxCount(index)" :key="count" :value="count">{{ count }} 集</option>
              </select>
            </div>
          </div>

          <div class="script-map-summary">
            <span class="pill" :class="{ accent: mappedEpisodeCount > 0 }">将生成 {{ mappedEpisodeCount }} 集</span>
            <span class="muted">覆盖第 {{ String(mappedStart).padStart(2, '0') }}–{{ String(mappedEnd).padStart(2, '0') }} 集 · {{ mappingRows.length }} 章拆分/合并</span>
            <span v-if="mappedEpisodeGap" class="script-map-warning">还差 {{ totalEpisodes - mappedEpisodeCount }} 集未覆盖；可增加某章集数，后续起始集会随之顺延。</span>
          </div>

          <div class="script-map-options">
            <label class="field-wrap">
              <span class="metric-label">改编模型</span>
              <select v-model="mapModel" class="field">
                <option v-for="model in scriptModels" :key="model" :value="model">{{ model }}</option>
              </select>
            </label>
            <label class="field-wrap">
              <span class="metric-label">改编强度</span>
              <select v-model="mapStrength" class="field">
                <option value="贴稿改编">贴稿改编 · 尽量保留原文情节</option>
                <option value="标准改编">标准改编 · 合并场景并强化钩子</option>
                <option value="大胆重构">大胆重构 · 允许重排章节顺序</option>
              </select>
            </label>
          </div>

          <p v-if="draftEpisodes.length" class="notice script-map-overwrite">
            当前 {{ activeScript?.version }} 已有 {{ draftEpisodes.length }} 集分集稿；生成会覆盖这些集，人工修订也会被替换。
          </p>
          <p class="script-map-hint">本流程按章节正文切分场次并生成旁白稿；模型选择记入版本与生成记录，供后续真实模型接入复现。</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="closeChapterMapping">取消</button>
          <button type="button" class="btn primary" :disabled="!canAdapt || adapting" @click="adaptNovelSource">
            {{ adapting ? '生成中…' : `生成 ${mappedEpisodeCount} 集分集稿` }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="chapterViewOpen" class="modal-backdrop script-editor-backdrop" @click.self="closeChapterView">
      <div class="modal wide script-chapter-modal" role="dialog" aria-modal="true" aria-label="查看源章节">
        <div class="modal-head">
          <div>
            <h3>第 {{ chapterView?.no ?? 0 }} 章 · {{ chapterView?.title ?? '源章节' }}</h3>
            <p>《{{ String(novelSource?.title ?? '未命名') }}》 · {{ chapterView?.words ?? 0 }} 字 · 原文仅供核对，不参与版本锁定</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭源章节" @click="closeChapterView">✕</button>
        </div>
        <div class="modal-body script-chapter-body">
          <pre class="script-chapter-text">{{ chapterView?.content || '这个来源没有保存正文；请重新导入小说全文。' }}</pre>
        </div>
        <div class="modal-foot script-chapter-foot">
          <span class="muted">第 {{ chapterViewIndex + 1 }} / {{ novelSource?.chapters?.length ?? 0 }} 章</span>
          <div>
            <button type="button" class="btn" :disabled="chapterViewIndex <= 0" @click="stepChapter(-1)">上一章</button>
            <button type="button" class="btn" :disabled="chapterViewIndex >= (novelSource?.chapters?.length ?? 1) - 1" @click="stepChapter(1)">下一章</button>
            <button type="button" class="btn primary" @click="closeChapterView">关闭</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="editorOpen && editDraft" class="modal-backdrop script-editor-backdrop" @click.self="closeEditor">
      <div class="modal wide script-editor-modal" role="dialog" aria-modal="true" aria-label="编辑分集稿">
        <div class="modal-head">
          <div>
            <h3>编辑第 {{ String(editDraft.no).padStart(2, '0') }} 集《{{ editDraft.title }}》</h3>
            <p>{{ activeScript?.version }} · 人工修订会留痕，不覆盖旧版本</p>
          </div>
          <button type="button" class="btn ghost" aria-label="关闭编辑" @click="closeEditor">✕</button>
        </div>
        <div class="modal-body script-editor-body">
          <div class="script-editor-fields">
            <label><span class="metric-label">集标题</span><input v-model="editDraft.title" class="field" /></label>
            <label class="wide"><span class="metric-label">本集梗概</span><textarea v-model="editDraft.logline" class="field" rows="2" /></label>
            <label class="wide"><span class="metric-label">结尾钩子</span><textarea v-model="editDraft.hook" class="field" rows="2" /></label>
          </div>

          <div v-for="(scene, index) in editDraft.scenes" :key="index" class="script-scene-editor">
            <div class="script-editor-fields">
              <label><span class="metric-label">场次</span><input v-model="scene.no" class="field" /></label>
              <label><span class="metric-label">场景</span><input v-model="scene.location" class="field" /></label>
              <label><span class="metric-label">时间</span><input v-model="scene.time" class="field" /></label>
              <label class="wide"><span class="metric-label">人物</span><input v-model="scene.chars" class="field" /></label>
              <label class="wide"><span class="metric-label">动作与画面</span><textarea v-model="scene.action" class="field" rows="2" /></label>
              <label class="wide">
                <span class="metric-label">台词</span>
                <textarea v-model="sceneLineTexts[index]" class="field" rows="4" placeholder="每行一句，格式：角色：台词" />
              </label>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="closeEditor">取消</button>
          <button type="button" class="btn primary" :disabled="saving" @click="saveEditor">{{ saving ? '保存中…' : '保存修订' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { creationApi } from '../../../services/creation'
import { projectApi } from '../../../services/projects'
import { useSessionStore } from '../../../stores/session'
import { useUiStore } from '../../../stores/ui'
import StatusPill from '../../../components/ui/StatusPill.vue'
import EmptyState from '../../../components/ui/EmptyState.vue'
import type { Row } from '../../../mock/db'

interface ScriptLine {
  char: string
  text: string
}

interface ScriptScene {
  no: string
  location: string
  time: string
  chars: string
  action: string
  lines: ScriptLine[]
}

interface EpisodeDraft {
  [key: string]: unknown
  no: number
  title: string
  logline: string
  hook: string
  scenes: ScriptScene[]
  edited?: boolean
  editedAt?: string
}

interface NovelChapter {
  no: number
  title: string
  words: number
  content?: string
}

interface ChapterMappingRow extends NovelChapter {
  fromEpisode: number
  episodeCount: number
}

interface ScriptSource {
  kind?: string
  label?: string
  title?: string
  fileName?: string
  model?: string
  note?: string
  chapters?: NovelChapter[]
  mapping?: Array<{ chapterNo: number; fromEpisode?: number; episodeCount?: number; episodeNo?: number }>
  fullText?: string
  importedAt?: string
  adaptedAt?: string
}

interface ScriptRow extends Row {
  version: string
  status: string
  locked?: boolean
  episodes?: number
  writtenEpisodes?: number
  scenes?: number
  lines?: number
  note?: string
  by?: string
  at?: string
  episodeDrafts?: EpisodeDraft[]
  source?: ScriptSource
  revision?: number
  updatedAt?: string
  generation?: {
    model: string
    prompt: string
    strength: string
    scope: string
    from: number
    count: number
    elapsed: string
    tokens: number
    cost: number
    at: string
  }
}

const props = defineProps<{
  project: Record<string, unknown> | null
  summary: Record<string, unknown> | null
}>()
const emit = defineEmits<{
  (event: 'refresh'): void
  (event: 'navigate', path: string): void
}>()

const session = useSessionStore()
const ui = useUiStore()
const canWrite = computed(() => session.can('creation.write'))
const projectId = computed(() => String(props.project?.id ?? ''))
const projectStatus = computed(() => {
  const scripts = (props.summary?.scripts as Row[] | undefined) ?? []
  void scripts.map((row) => `${row.id}:${row.status}:${row.revision ?? 0}`).join('|')
  return String(props.project?.status ?? '')
})
const totalEpisodes = computed(() => Math.max(1, Number(props.project?.episodes ?? 1)))
const canGenerate = computed(
  () =>
    canWrite.value &&
    !['待剧本审核', '已完成', '已交付', '已归档', '已终止'].includes(projectStatus.value),
)

const versions = computed<ScriptRow[]>(() => {
  const value = props.summary?.scripts
  const list = Array.isArray(value) ? value as ScriptRow[] : []
  return [...list].sort((left, right) => {
    const leftNo = Number(String(left.version ?? '').replace(/[^0-9]/g, '')) || 0
    const rightNo = Number(String(right.version ?? '').replace(/[^0-9]/g, '')) || 0
    return rightNo - leftNo
  })
})
const selectedId = ref('')
watch(versions, (list) => {
  if (!list.length) {
    selectedId.value = ''
    return
  }
  if (!list.some((row) => row.id === selectedId.value)) selectedId.value = list[0].id
}, { immediate: true })
const activeScript = computed(() => versions.value.find((row) => row.id === selectedId.value) ?? versions.value[0] ?? null)
const lockedScript = computed(() => versions.value.find((row) => row.locked) ?? null)

type SourceMode = 'model' | 'manual' | 'novel'
const sourceModes: Array<{ key: SourceMode; label: string; desc: string }> = [
  { key: 'model', label: '模型生成', desc: '按模型与范围出稿' },
  { key: 'manual', label: '自主编写', desc: '空白稿逐集写' },
  { key: 'novel', label: '小说改编', desc: '导入全文并映射章节' },
]
const scriptModels = ['剧本模型 A · 长篇结构', '剧本模型 B · 快节奏短剧', '剧本模型 C · 对话打磨']
const sourceMode = ref<SourceMode>('model')
const activeSourceKind = computed<SourceMode>(() => {
  const kind = String(activeScript.value?.source?.kind ?? '')
  if (kind === 'manual' || kind === 'novel' || kind === 'model') return kind
  return activeScript.value?.generation || activeScript.value?.locked ? 'model' : 'manual'
})
watch(activeSourceKind, (kind) => {
  if (activeScript.value) sourceMode.value = kind
}, { immediate: true })
const sourceReady = computed(() =>
  Boolean(activeScript.value && (activeScript.value.source?.kind || draftEpisodes.value.length || activeScript.value.generation)),
)
const sourceLabel = computed(() => {
  if (!activeScript.value) return '尚未建立版本'
  if (activeScript.value.source?.label) return String(activeScript.value.source.label)
  if (activeScript.value.source?.kind === 'novel') return '小说改编'
  if (activeScript.value.source?.kind === 'manual') return '自主编写'
  if (activeScript.value.generation) return '模型生成'
  return '历史稿件'
})
const sourceSummary = computed(() => {
  if (!activeScript.value) return '选择一种创作方式后，会建立可追溯的剧本版本。'
  const source = activeScript.value.source
  if (source?.kind === 'novel') {
    const words = (source.chapters ?? []).reduce((sum, chapter) => sum + Number(chapter.words ?? 0), 0)
    const mapped = new Set<number>()
    for (const item of source.mapping ?? []) {
      const from = Number(item.fromEpisode ?? item.episodeNo ?? 0)
      const count = Math.max(1, Number(item.episodeCount ?? 1))
      for (let index = 0; index < count; index += 1) mapped.add(from + index)
    }
    return `小说改编 · 《${String(source.title ?? '未命名')}》 · ${source.chapters?.length ?? 0} 章 / ${words} 字${mapped.size ? ` · 已映射 ${mapped.size} 集` : ' · 尚未映射'}`
  }
  if (source?.kind === 'manual') {
    return `自主编写 · 已写 ${draftEpisodes.value.length} / ${totalEpisodes.value} 集${source.note ? ` · ${source.note}` : ''}`
  }
  if (activeScript.value.generation) {
    return `模型生成 · ${activeScript.value.generation.model} · ${activeScript.value.generation.strength}`
  }
  return '当前版本未登记创作来源。'
})
const novelSource = computed(() => activeScript.value?.source?.kind === 'novel' ? activeScript.value.source : null)
const novelSourceWords = computed(() =>
  (novelSource.value?.chapters ?? []).reduce((sum, chapter) => sum + Number(chapter.words ?? 0), 0),
)
const novelSourceReady = computed(() =>
  Boolean(novelSource.value?.chapters?.length)
  && (novelSource.value?.chapters ?? []).every((chapter) => String(chapter.content ?? '').trim().length > 0),
)
const novelChapterPreview = computed(() =>
  (activeScript.value?.source?.chapters ?? []).slice(0, 6),
)
const sourceIntro = computed(() => {
  if (sourceMode.value === 'manual') return '自主编写：从空白稿开始，逐集添加场次、动作与台词，再走同一套审核。'
  if (sourceMode.value === 'novel') return '小说改编：导入全文并解析章节，完成章节映射后生成可分集稿，再逐集修订与审核。'
  return '模型生成：先出样章再补齐全剧，逐集修订后提交审核；与自主编写共用同一套版本。'
})
const sourceModeHelp = computed(() => {
  if (sourceMode.value === 'manual') return '新建空白稿会直接建立第 1 集，可逐集编辑；不会调用模型。'
  if (sourceMode.value === 'novel') return novelSourceReady.value
    ? `已解析 ${novelSource.value?.chapters?.length ?? 0} 章 / ${novelSourceWords.value} 字；下一步做章节映射。`
    : '导入小说全文后可解析章节、保留正文，并按章节映射生成分集稿。'
  return '生成结果并入当前草稿；人工修订过的集不会被自动覆盖。'
})
const emptyIntro = computed(() => {
  if (sourceMode.value === 'manual') return '还没有剧本版本。新建空白稿后，从第 1 集开始逐集写场次与台词。'
  if (sourceMode.value === 'novel') return '还没有剧本版本。先导入小说全文，解析章节后做章节映射。'
  return '还没有剧本版本。用模型生成第一版分集稿，建议先出前 3 集样章。'
})
const emptyDraftTitle = computed(() => {
  if (activeSourceKind.value === 'novel') return '小说已解析，尚未生成分集稿'
  if (activeSourceKind.value === 'manual') return '空白稿还没有分集'
  return '这个版本还没有分集稿'
})
const emptyDraftText = computed(() => {
  if (activeSourceKind.value === 'novel') {
    return novelSourceReady.value
      ? `已解析 ${novelSource.value?.chapters?.length ?? 0} 章 / ${novelSourceWords.value} 字；点“章节映射”把章节分给目标集，即可生成分集稿。`
      : '这个来源只有章节标题，没有正文；请重新导入小说全文后再映射。'
  }
  if (activeSourceKind.value === 'manual') return '从第一集开始写：添加场次、动作和“角色：台词”，写完整剧后提交审核。'
  return '当前版本只登记了集数与统计，没有可编辑的分集正文。可以继续用模型补齐。'
})

const draftEpisodes = ref<EpisodeDraft[]>([])
const scriptTick = ref(0)
watch(
  [
    selectedId,
    () => activeScript.value?.id,
    () => activeScript.value?.revision,
    () => activeScript.value?.updatedAt,
    () => activeScript.value?.status,
    () => versions.value.length,
    () => versions.value.map((row) => `${row.id}:${row.status}:${row.revision ?? 0}:${row.updatedAt ?? ''}`).join('|'),
  ],
  () => {
    const value = activeScript.value?.episodeDrafts
    draftEpisodes.value = Array.isArray(value) ? [...value as EpisodeDraft[]] : []
    scriptTick.value += 1
  },
  { immediate: true },
)
const activeDraft = computed(() => Boolean(activeScript.value && !activeScript.value.locked && draftEpisodes.value.length))
const isLatestVersion = computed(() => Boolean(activeScript.value && versions.value[0]?.id === activeScript.value.id))
const selectedEpisodeNo = ref<number | null>(null)
watch([() => activeScript.value?.id, () => draftEpisodes.value.length], () => {
  const current = draftEpisodes.value.find((episode) => episode.no === selectedEpisodeNo.value)
  if (!current) selectedEpisodeNo.value = draftEpisodes.value[0]?.no ?? null
}, { immediate: true })
const activeEpisode = computed(() =>
  draftEpisodes.value.find((episode) => episode.no === selectedEpisodeNo.value) ?? draftEpisodes.value[0] ?? null,
)

const scriptReviews = computed(() => {
  const value = props.summary?.reviews
  return (Array.isArray(value) ? value as Row[] : []).filter((row) => String(row.node ?? '').includes('剧本'))
})

function reviewNode(value: unknown): string {
  return String(value ?? '').replace('节点 A', '节点一')
}

function episodeLineCount(episode: EpisodeDraft): number {
  return episode.scenes.reduce((sum, scene) => sum + (scene.lines?.length ?? 0), 0)
}

const gateChecks = computed(() => {
  const allScenes = draftEpisodes.value.every((episode) => episode.scenes?.length >= 3)
  const allLines = draftEpisodes.value.every(
    (episode) => episode.scenes?.length && episode.scenes.every((scene) => scene.lines?.length),
  )
  return [
    { label: '创作来源已登记', ok: sourceReady.value, detail: sourceReady.value ? sourceLabel.value : '先选择模型生成、自主编写或小说改编' },
    { label: '分集稿覆盖全剧', ok: draftEpisodes.value.length >= totalEpisodes.value, detail: `${draftEpisodes.value.length} / ${totalEpisodes.value} 集` },
    { label: '每集至少 3 场', ok: Boolean(draftEpisodes.value.length) && allScenes, detail: allScenes ? '场次结构完整' : '存在场次不足的集' },
    { label: '每场均有台词', ok: Boolean(draftEpisodes.value.length) && allLines, detail: allLines ? '台词与人物已就位' : '存在空场或空台词' },
    { label: '版本可追溯', ok: Boolean(activeScript.value), detail: activeScript.value ? `${activeScript.value.version} · ${activeScript.value.status}` : '尚未建立版本' },
  ]
})
const gateDone = computed(() => gateChecks.value.filter((check) => check.ok).length)
const gatePass = computed(() => gateDone.value === 5)
const canSubmit = computed(() =>
  canWrite.value
  && projectStatus.value === '剧本创作中'
  && gatePass.value
  && Boolean(activeScript.value)
  && !activeScript.value?.locked
  && isLatestVersion.value,
)
const submitHint = computed(() => {
  if (!canWrite.value) return '当前身份没有脚本写入权限。'
  if (projectStatus.value !== '剧本创作中') {
    return `项目当前为「${projectStatus.value || '未知'}」，不在剧本创作中；只有剧本创作中才可提交审核。`
  }
  if (!isLatestVersion.value) return '当前查看的是历史版本；切换到最新草稿后再提交。'
  if (!draftEpisodes.value.length) return '先用模型生成分集稿。'
  if (draftEpisodes.value.length < totalEpisodes.value) return `还差 ${totalEpisodes.value - draftEpisodes.value.length} 集，补齐全剧后可提交。`
  if (!gatePass.value) return `仍有 ${5 - gateDone.value} 项门禁未通过。`
  return '分集稿完整，可提交审核；审核通过后锁定正式版本。'
})
const generation = computed(() => {
  void scriptTick.value
  return activeScript.value?.generation ?? null
})

const flowSteps = computed(() => {
  const submitted = String(activeScript.value?.status ?? '').includes('待审核')
    || projectStatus.value === '待剧本审核'
    || Boolean(scriptReviews.value.length)
  const locked = Boolean(activeScript.value?.locked)
  return [
    { no: 1, title: '确定创作来源', desc: '模型 / 自主编写 / 小说改编', ok: sourceReady.value },
    { no: 2, title: '完成初稿', desc: '逐集形成可分集稿', ok: draftEpisodes.value.length > 0 },
    { no: 3, title: locked ? '补齐修订版' : '补齐全剧', desc: `${draftEpisodes.value.length} / ${totalEpisodes.value} 集`, ok: draftEpisodes.value.length >= totalEpisodes.value },
    { no: 4, title: '提交审核', desc: '剧本审核节点一', ok: submitted },
    { no: 5, title: '审核锁定', desc: '正式版本供下游引用', ok: locked },
  ]
})
const firstUndone = computed(() => flowSteps.value.find((step) => !step.ok)?.no ?? 0)

const draftSceneCount = computed(() =>
  draftEpisodes.value.reduce((sum, episode) => sum + (episode.scenes?.length ?? 0), 0),
)
const draftLineCount = computed(() =>
  draftEpisodes.value.reduce((sum, episode) => sum + episodeLineCount(episode), 0),
)

const kpis = computed(() => [
  { label: '当前版本', value: activeScript.value?.version ?? '未创建', hint: activeScript.value?.status ?? '等待生成' },
  { label: activeScript.value?.locked ? '当前草稿' : '分集稿', value: `${draftEpisodes.value.length} / ${totalEpisodes.value}`, hint: '已写 / 全剧' },
  { label: '场次', value: String(draftSceneCount.value), hint: '当前草稿合计' },
  { label: '台词行', value: String(draftLineCount.value), hint: '当前草稿合计' },
  { label: activeScript.value?.locked ? '修订版门禁' : '提交门禁', value: `${gateDone.value} / 5`, hint: activeScript.value?.locked ? '修订版未就绪' : canSubmit.value ? '可提交审核' : '未就绪' },
])

const generateLabel = computed(() => {
  if (activeScript.value?.locked) return '生成修订版'
  if (activeDraft.value) return '继续用模型生成'
  return '用模型生成剧本'
})

const submitting = ref(false)
const creating = ref(false)
const importing = ref(false)
const adapting = ref(false)
const novelOpen = ref(false)
const novelTitle = ref('')
const novelFileName = ref('')
const novelText = ref('')
const novelChapters = ref<NovelChapter[]>([])
const novelWordCount = computed(() => novelChapters.value.reduce((sum, chapter) => sum + chapter.words, 0))
const novelCharCount = computed(() => novelText.value.length)
const canImportNovel = computed(() =>
  canWrite.value
  && Boolean(novelTitle.value.trim())
  && novelChapters.value.length > 0
  && novelCharCount.value <= 120_000
  && !importing.value,
)
const mapOpen = ref(false)
const mapModel = ref(scriptModels[0])
const mapStrength = ref('贴稿改编')
const mappingRows = ref<ChapterMappingRow[]>([])
const mappingEpisodeNos = computed(() => {
  const list: number[] = []
  for (const row of mappingRows.value) {
    const start = Math.max(1, Number(row.fromEpisode ?? 1))
    const count = Math.max(1, Number(row.episodeCount ?? 1))
    for (let index = 0; index < count; index += 1) list.push(start + index)
  }
  return list
})
const mappedEpisodeCount = computed(() => new Set(mappingEpisodeNos.value).size)
const mappedStart = computed(() => mappingEpisodeNos.value.length ? Math.min(...mappingEpisodeNos.value) : 0)
const mappedEnd = computed(() => mappingEpisodeNos.value.length ? Math.max(...mappingEpisodeNos.value) : 0)
const mappedEpisodeGap = computed(() => mappedEpisodeCount.value < totalEpisodes.value)
const canAdapt = computed(() =>
  canGenerate.value
  && novelSourceReady.value
  && mappingRows.value.length > 0
  && mappingRows.value.every((row) =>
    Number(row.fromEpisode) >= 1
    && Number(row.episodeCount) >= 1
    && Number(row.fromEpisode) + Number(row.episodeCount) - 1 <= totalEpisodes.value,
  )
  && mappedEpisodeCount.value > 0
  && !adapting.value,
)
const chapterViewOpen = ref(false)
const chapterViewNo = ref(0)
const chapterViewIndex = computed(() =>
  Math.max(0, (novelSource.value?.chapters ?? []).findIndex((chapter) => chapter.no === chapterViewNo.value)),
)
const chapterView = computed(() =>
  (novelSource.value?.chapters ?? []).find((chapter) => chapter.no === chapterViewNo.value) ?? null,
)

function openChapterView(no = 1) {
  chapterViewNo.value = no
  chapterViewOpen.value = true
}

function closeChapterView() {
  chapterViewOpen.value = false
}

function stepChapter(delta: number) {
  const chapters = novelSource.value?.chapters ?? []
  const next = chapters[chapterViewIndex.value + delta]
  if (next) chapterViewNo.value = next.no
}

function autoEpisodeFor(index: number, total: number, target: number): { from: number; count: number } {
  if (total >= target) {
    return { from: Math.min(target, Math.floor(index * target / total) + 1), count: 1 }
  }
  const base = Math.floor(target / total)
  const extra = target % total
  let offset = 0
  for (let cursor = 0; cursor < index; cursor += 1) offset += base + (cursor < extra ? 1 : 0)
  return { from: offset + 1, count: base + (index < extra ? 1 : 0) }
}

function mappingMaxCount(index: number): number {
  const row = mappingRows.value[index]
  if (!row) return 1
  const later = mappingRows.value.length - index - 1
  return Math.max(1, totalEpisodes.value - row.fromEpisode + 1 - later)
}

function reflowMapping() {
  let cursor = 1
  mappingRows.value.forEach((row, index) => {
    row.fromEpisode = cursor
    const later = mappingRows.value.length - index - 1
    const maxCount = Math.max(1, totalEpisodes.value - cursor + 1 - later)
    const count = Math.max(1, Number(row.episodeCount ?? 1))
    row.episodeCount = Math.min(count, maxCount)
    cursor += row.episodeCount
  })
}

function blankEpisode(no: number): EpisodeDraft {
  return {
    no,
    title: `第 ${no} 集`,
    logline: '',
    hook: '',
    scenes: [{ no: '01', location: '', time: '', chars: '', action: '', lines: [] }],
    edited: false,
  }
}

function countWords(text: string): number {
  return text.replace(/\s/g, '').length
}

function parseNovelChapters(text: string): NovelChapter[] {
  const source = text.replace(/\r\n/g, '\n')
  if (!source.trim()) return []
  const lines = source.split('\n')
  const headings = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => /^(第[0-9一二三四五六七八九十百千零两]+[章节回卷]|Chapter\s+\d+|[0-9]+[.、]\s*)/i.test(line))
  if (!headings.length) return [{ no: 1, title: '全文', words: countWords(source), content: source.trim() }]
  return headings.map((heading, index) => {
    const next = headings[index + 1]?.index ?? lines.length
    const body = lines.slice(heading.index + 1, next).join('\n').trim()
    const title = heading.line
      .replace(/^第[0-9一二三四五六七八九十百千零两]+[章节回卷][：:、\s]*/u, '')
      .replace(/^Chapter\s+\d+[：:、\s]*/i, '')
      .replace(/^[0-9]+[.、]\s*/, '')
      .slice(0, 28)
    return { no: index + 1, title: title || `第 ${index + 1} 章`, words: countWords(body), content: body }
  })
}

watch(novelText, (text) => {
  novelChapters.value = parseNovelChapters(text)
})

function openNovel() {
    if (!canGenerate.value) {
      ui.toast('当前状态暂不能登记小说来源', 'bad')
      return
    }
  if (!novelTitle.value) novelTitle.value = `${String(props.project?.name ?? '')}（原著）`
  novelOpen.value = true
}

function closeNovel() {
  novelOpen.value = false
  novelTitle.value = ''
  novelFileName.value = ''
  novelText.value = ''
  novelChapters.value = []
}

function onNovelFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!/\.(txt|md)$/i.test(file.name)) {
    ui.toast('当前仅支持 TXT / Markdown 文件', 'bad')
    input.value = ''
    return
  }
  if (file.size > 500_000) {
    ui.toast('文件超过约 12 万字，请拆分后再导入', 'bad')
    input.value = ''
    return
  }
  novelFileName.value = file.name
  if (!novelTitle.value.trim()) novelTitle.value = file.name.replace(/\.(txt|md)$/i, '')
  const reader = new FileReader()
  reader.onload = () => {
    novelText.value = String(reader.result ?? '')
  }
  reader.onerror = () => ui.toast('文件读取失败，请改用粘贴', 'bad')
  reader.readAsText(file, 'utf-8')
}

async function importNovel() {  if (!canImportNovel.value) return
  importing.value = true
  const chapterCount = novelChapters.value.length
  const wordCount = novelWordCount.value
  try {
    const created = await creationApi.createBlankScript({
      project: projectId.value,
      note: `小说解析 · ${chapterCount} 章`,
      source: {
        kind: 'novel',
        label: '小说改编',
        title: novelTitle.value.trim(),
        fileName: novelFileName.value,
        chapters: novelChapters.value,
        fullText: novelText.value,
        importedAt: new Date().toISOString(),
        note: `已解析 ${chapterCount} 章，等待章节映射`,
      },
    })
    selectedId.value = String(created.id)
    sourceMode.value = 'novel'
    closeNovel()
    emit('refresh')
    ui.toast(`已解析 ${chapterCount} 章 · ${wordCount} 字，可开始章节映射`)
  } catch (err) {
    ui.toast((err as Error).message || '小说来源登记失败', 'bad')
  } finally {
    importing.value = false
  }
}

function openChapterMapping() {
  if (!novelSourceReady.value) {
    ui.toast('这个来源缺少正文，请重新导入小说全文', 'bad')
    openNovel()
    return
  }
  const chapters = novelSource.value?.chapters ?? []
  const saved = new Map((novelSource.value?.mapping ?? []).map((item) => [item.chapterNo, item]))
  mappingRows.value = chapters.map((chapter, index) => {
    const auto = autoEpisodeFor(index, chapters.length, totalEpisodes.value)
    const stored = saved.get(chapter.no)
    return {
      ...chapter,
      fromEpisode: 1,
      episodeCount: Math.max(1, Number(stored?.episodeCount ?? auto.count)),
    }
  })
  reflowMapping()
  mapModel.value = scriptModels.includes(String(novelSource.value?.model ?? ''))
    ? String(novelSource.value?.model)
    : scriptModels[0]
  mapStrength.value = '贴稿改编'
  mapOpen.value = true
}

function autoMapChapters() {
  const chapters = novelSource.value?.chapters ?? []
  mappingRows.value = chapters.map((chapter, index) => {
    const auto = autoEpisodeFor(index, chapters.length, totalEpisodes.value)
    return { ...chapter, fromEpisode: 1, episodeCount: auto.count }
  })
  reflowMapping()
}

function closeChapterMapping() {
  mapOpen.value = false
  mappingRows.value = []
}

async function adaptNovelSource() {
  if (!canAdapt.value || !activeScript.value) return
  const overwrite = draftEpisodes.value.length > 0
  if (overwrite) {
    const confirmed = await ui.confirm(
      '覆盖当前分集稿？',
      `将按章节映射生成 ${mappedEpisodeCount.value} 集，替换 ${activeScript.value.version} 现有的 ${draftEpisodes.value.length} 集分集稿，人工修订也会被覆盖。`,
    )
    if (!confirmed) return
  }
  const chapters = novelSource.value?.chapters ?? []
  adapting.value = true
  try {
    const created = await creationApi.adaptNovel({
      project: projectId.value,
      scriptId: activeScript.value.id,
      model: mapModel.value,
      strength: mapStrength.value,
      chapters,
      mapping: mappingRows.value.map((row) => ({
        chapterNo: row.no,
        fromEpisode: row.fromEpisode,
        episodeCount: row.episodeCount,
      })),
      source: {
        title: novelSource.value?.title,
        fileName: novelSource.value?.fileName,
        fullText: novelSource.value?.fullText,
      },
    })
    const firstEpisode = Math.min(...mappingRows.value.map((row) => row.fromEpisode))
    selectedId.value = String(created.id)
    selectedEpisodeNo.value = firstEpisode
    sourceMode.value = 'novel'
    closeChapterMapping()
    emit('refresh')
    ui.toast(`已按 ${chapters.length} 章生成 ${Number(created.writtenEpisodes ?? 0)} 集分集稿`)
  } catch (err) {
    ui.toast((err as Error).message || '小说改编失败', 'bad')
  } finally {
    adapting.value = false
  }
}

async function createManualScript() {  if (!canGenerate.value || creating.value) return
  if (activeSourceKind.value === 'manual' && activeDraft.value) {
    await addManualEpisode()
    return
  }
  creating.value = true
  try {
    const first = blankEpisode(1)
    const created = await creationApi.createBlankScript({
      project: projectId.value,
      note: '自主编写 · 空白稿',
      source: { kind: 'manual', label: '自主编写', note: '空白稿逐集编写' },
      episodeDrafts: [first],
    })
    selectedId.value = String(created.id)
    selectedEpisodeNo.value = 1
    sourceMode.value = 'manual'
    emit('refresh')
    ui.toast('已新建空白剧本，可编辑第 1 集')
  } catch (err) {
    ui.toast((err as Error).message || '新建空白剧本失败', 'bad')
  } finally {
    creating.value = false
  }
}

async function addManualEpisode() {
  if (!canWrite.value || creating.value) return
  const existing = activeSourceKind.value === 'manual' && !activeScript.value?.locked
  const current = existing ? [...draftEpisodes.value] : []
  const used = new Set(current.map((episode) => episode.no))
  let no = 1
  while (used.has(no) && no <= totalEpisodes.value) no += 1
  if (no > totalEpisodes.value) {
    ui.toast(`全剧 ${totalEpisodes.value} 集已齐，可继续编辑或提交审核`, 'bad')
    return
  }
  const next = [...current, blankEpisode(no)].sort((left, right) => left.no - right.no)
  try {
    creating.value = true
    let scriptId = activeScript.value?.id ?? ''
    if (!existing || !scriptId) {
      const created = await creationApi.createBlankScript({
        project: projectId.value,
        note: '自主编写 · 空白稿',
        source: { kind: 'manual', label: '自主编写', note: '空白稿逐集编写' },
        episodeDrafts: [blankEpisode(1)],
      })
      scriptId = String(created.id)
      selectedId.value = scriptId
      selectedEpisodeNo.value = 1
      emit('refresh')
      ui.toast('已新建空白剧本，可编辑第 1 集')
      return
    }
    const scenes = next.reduce((sum, episode) => sum + episode.scenes.length, 0)
    const lines = next.reduce((sum, episode) => sum + episodeLineCount(episode), 0)
    await creationApi.updateScript(scriptId, {
      episodeDrafts: next,
      writtenEpisodes: next.length,
      scenes,
      lines,
      status: '草稿',
      revision: Number(activeScript.value?.revision ?? 0) + 1,
      note: `自主编写 · 新增第 ${no} 集`,
    })
    selectedEpisodeNo.value = no
    emit('refresh')
    ui.toast(`已新增第 ${no} 集空白稿`)
  } catch (err) {
    ui.toast((err as Error).message || '新建分集失败', 'bad')
  } finally {
    creating.value = false
  }
}

function firstMissingEpisode(): number {
  for (let no = 1; no <= totalEpisodes.value; no += 1) {
    if (!draftEpisodes.value.some((episode) => episode.no === no)) return no
  }
  return 1
}

function openGenerate(forceNew = false) {
  if (!canGenerate.value) {
    const reason = !canWrite.value
      ? '当前身份没有剧本写入权限'
      : projectStatus.value === '待剧本审核'
        ? '剧本正在审核，暂不能继续生成'
        : '当前项目状态暂不能生成剧本'
    ui.toast(reason, 'bad')
    return
  }
  const scriptId = forceNew || activeScript.value?.locked || activeSourceKind.value === 'novel'
    ? ''
    : String(activeScript.value?.id ?? '')
  const missing = totalEpisodes.value - draftEpisodes.value.length
  const scope = missing > 0 && draftEpisodes.value.length > 0 ? 'full' : 'pilot'
  const from = firstMissingEpisode()
  ui.openDialog({
    title: forceNew ? '另起一版剧本' : '用模型生成剧本',
    subtitle: scriptId
      ? `生成结果并入 ${activeScript.value?.version}；人工修订过的集不会被自动覆盖。`
      : '会新建一个草稿版本，不覆盖已锁定的正式版本。',
    wide: true,
    fields: [
      {
        key: 'model',
        label: '生成模型',
        type: 'select',
        value: '剧本模型 A · 长篇结构',
        required: true,
        options: [
          { value: '剧本模型 A · 长篇结构', label: '剧本模型 A · 长篇结构（适合悬疑、连续追更）' },
          { value: '剧本模型 B · 快节奏短剧', label: '剧本模型 B · 快节奏短剧（前 3 秒强钩子）' },
          { value: '剧本模型 C · 对话打磨', label: '剧本模型 C · 对话打磨（关系与潜台词）' },
        ],
        hint: '模型读取项目基线与下方生成要求；小说全文用于章节映射，不直接进入通用模型生成。',
      },
      {
        key: 'scope',
        label: '生成范围',
        type: 'select',
        value: scope,
        required: true,
        options: [
          { value: 'pilot', label: `前 ${Math.min(3, totalEpisodes.value)} 集 · 先出样章` },
          { value: 'full', label: `整剧 ${totalEpisodes.value} 集 · 补齐并保留人工修订` },
          { value: 'custom', label: '指定起始集与集数' },
        ],
      },
      { key: 'from', label: '起始集', type: 'number', value: from, required: true, hint: '仅「指定集数」时生效。' },
      { key: 'count', label: '生成集数', type: 'number', value: Math.max(1, Math.min(3, missing || 3)), required: true, hint: '仅「指定集数」时生效。' },
      {
        key: 'strength',
        label: '改编强度',
        type: 'select',
        value: '标准改编',
        required: true,
        options: [
          { value: '贴稿改编', label: '贴稿改编 · 尽量保留现有设定' },
          { value: '标准改编', label: '标准改编 · 强化冲突与钩子' },
          { value: '大胆重构', label: '大胆重构 · 允许重排人物关系' },
        ],
      },
      {
        key: 'prompt',
        label: '生成要求',
        type: 'textarea',
        rows: 5,
        value: `按「${String(props.project?.genre ?? '短剧')}」题材写，受众 ${String(props.project?.audience ?? '不限定')}，单集 ${String(props.project?.duration ?? '')}；${String(props.project?.constraints ?? '')}。每集结尾留一个可追更的钩子。`,
        required: true,
        full: true,
        hint: '写明人物关系、每集冲突和结尾钩子；这段要求会记入生成记录。',
      },
    ],
    submitLabel: '开始生成',
    onSubmit: async (values) => {
      const created = await creationApi.generateScript({
        project: projectId.value,
        scriptId,
        model: values.model,
        scope: values.scope,
        from: Number(values.from),
        count: Number(values.count),
        strength: values.strength,
        prompt: values.prompt,
      })
      selectedId.value = String(created.id)
      ui.toast(`已生成 ${String(created.version)} · ${String(created.writtenEpisodes ?? 0)} / ${totalEpisodes.value} 集`)
      emit('refresh')
    },
  })
}

async function newVersion() {
  const confirmed = await ui.confirm(
    '另起一版剧本？',
    '新版本会从草稿开始，不覆盖当前版本；审核通过前不会影响下游正式基准。',
  )
  if (confirmed) openGenerate(true)
}

function openRewrite(episode: EpisodeDraft) {
  if (!canGenerate.value || !activeScript.value) return
  ui.openDialog({
    title: `模型重写第 ${episode.no} 集`,
    subtitle: '只替换这一集；其他集与人工修订保持不变。',
    wide: true,
    fields: [
      {
        key: 'model',
        label: '生成模型',
        type: 'select',
        value: '剧本模型 C · 对话打磨',
        required: true,
        options: [
          { value: '剧本模型 A · 长篇结构', label: '剧本模型 A · 长篇结构' },
          { value: '剧本模型 B · 快节奏短剧', label: '剧本模型 B · 快节奏短剧' },
          { value: '剧本模型 C · 对话打磨', label: '剧本模型 C · 对话打磨' },
        ],
      },
      {
        key: 'strength',
        label: '重写强度',
        type: 'select',
        value: '标准改编',
        required: true,
        options: [
          { value: '只改台词', label: '只改台词 · 保留场次结构' },
          { value: '标准改编', label: '标准改编 · 场次与台词一起重排' },
          { value: '大胆重构', label: '大胆重构 · 允许换场景与冲突' },
        ],
      },
      {
        key: 'prompt',
        label: '重写要求',
        type: 'textarea',
        rows: 5,
        value: `保留第 ${episode.no} 集的核心冲突「${episode.hook}」，让人物关系更紧，结尾钩子更明确。`,
        required: true,
        full: true,
      },
    ],
    submitLabel: '重写本集',
    onSubmit: async (values) => {
      const created = await creationApi.generateScript({
        project: projectId.value,
        scriptId: activeScript.value?.id,
        model: values.model,
        scope: 'custom',
        from: episode.no,
        count: 1,
        strength: values.strength,
        prompt: values.prompt,
        overwrite: true,
      })
      selectedId.value = String(created.id)
      ui.toast(`第 ${episode.no} 集已用模型重写`)
      emit('refresh')
    },
  })
}

async function submitReview() {
  if (!canSubmit.value || !activeScript.value || submitting.value) return
  const confirmed = await ui.confirm(
    '提交剧本审核？',
    `${activeScript.value.version} 共 ${draftEpisodes.value.length} 集将送审；项目进入「待剧本审核」，审核通过后锁定正式版本。`,
  )
  if (!confirmed) return
  submitting.value = true
  try {
    await projectApi.transition(projectId.value, 'submitScript')
    ui.toast('剧本已提交审核，等待审核人裁决')
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '提交剧本审核失败', 'bad')
  } finally {
    submitting.value = false
  }
}

const editorOpen = ref(false)
const editDraft = ref<EpisodeDraft | null>(null)
const sceneLineTexts = ref<string[]>([])
const saving = ref(false)

function cloneEpisode(episode: EpisodeDraft): EpisodeDraft {
  return JSON.parse(JSON.stringify(episode)) as EpisodeDraft
}

function openEditor() {
  if (!activeEpisode.value) return
  editDraft.value = cloneEpisode(activeEpisode.value)
  sceneLineTexts.value = editDraft.value.scenes.map((scene) =>
    scene.lines.map((line) => `${line.char}：${line.text}`).join('\n'),
  )
  editorOpen.value = true
}
function closeEditor() {
  editorOpen.value = false
  editDraft.value = null
  sceneLineTexts.value = []
}
function parseLines(text: string): ScriptLine[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const split = line.search(/[：:]/)
    if (split < 0) return { char: '旁白', text: line }
    return { char: line.slice(0, split).trim() || '旁白', text: line.slice(split + 1).trim() }
  }).filter((line) => line.text)
}

async function saveEditor() {
  if (!editDraft.value || !activeScript.value || saving.value) return
  saving.value = true
  try {
    const episode: EpisodeDraft = {
      ...editDraft.value,
      scenes: editDraft.value.scenes.map((scene, index) => ({
        ...scene,
        lines: parseLines(sceneLineTexts.value[index] ?? ''),
      })),
      edited: true,
      editedAt: new Date().toISOString(),
    }
    const drafts = draftEpisodes.value.map((item) => (item.no === episode.no ? episode : item))
    const counts = {
      scenes: drafts.reduce((sum, item) => sum + item.scenes.length, 0),
      lines: drafts.reduce((sum, item) => sum + episodeLineCount(item), 0),
    }
    await creationApi.updateScript(activeScript.value.id, {
      episodeDrafts: drafts,
      scenes: counts.scenes,
      lines: counts.lines,
      status: '草稿',
      revision: Number(activeScript.value.revision ?? 0) + 1,
      note: `人工修订第 ${episode.no} 集 · ${activeScript.value.note ?? ''}`,
    })
    ui.toast(`第 ${episode.no} 集已保存修订`)
    closeEditor()
    emit('refresh')
  } catch (err) {
    ui.toast((err as Error).message || '保存剧本修订失败', 'bad')
  } finally {
    saving.value = false
  }
}
</script>

<script lang="ts">
export default { name: 'ScriptWorkspace' }
</script>

<style scoped>
.script-workspace { display: grid; gap: 14px; }
.stage-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(126px, 1fr)); gap: 8px; }
.stage-kpi { min-width: 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); }
.stage-kpi span { display: block; color: var(--muted); font-size: 10px; }
.stage-kpi b { display: block; margin-top: 3px; color: var(--ink); font-size: 18px; line-height: 1.3; }
.stage-kpi small { display: block; margin-top: 2px; overflow: hidden; color: var(--faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }

.script-flow-card { padding-bottom: 12px; }
.script-source-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 10px; }
.script-source-tab { display: grid; gap: 2px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); color: var(--text-2); text-align: left; cursor: pointer; }
.script-source-tab:hover { border-color: var(--line-strong); }
.script-source-tab.active { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.script-source-tab b { color: var(--ink); font-size: 12px; }
.script-source-tab small { color: var(--text-3); font-size: 10px; }
.script-source-note { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 8px; color: var(--text-3); font-size: 10px; line-height: 1.5; }
.script-novel-preview { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; }
.script-flow-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.script-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.script-flow-step { display: flex; align-items: flex-start; gap: 8px; min-width: 0; padding: 9px; border: 1px solid var(--line); border-radius: 8px; background: color-mix(in srgb, var(--surface) 70%, transparent); }
.script-flow-step i { flex: none; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid var(--line-strong); border-radius: 50%; background: var(--surface); color: var(--text-3); font-size: 11px; font-style: normal; }
.script-flow-step b { display: block; font-size: 12px; line-height: 1.3; }
.script-flow-step small { display: block; margin-top: 3px; color: var(--text-3); font-size: 10px; line-height: 1.35; }
.script-flow-step.done { border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
.script-flow-step.done i { border-color: var(--ok); color: var(--ok); }
.script-flow-step.now { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.script-flow-step.now i { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.script-gate-note { margin: 10px 0 0; }

.script-split { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.85fr); gap: 14px; align-items: start; }
.script-canvas { min-width: 0; }
.script-head-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.script-version-select { width: auto; min-width: 164px; }
.script-empty { display: grid; justify-items: center; gap: 8px; padding: 34px 16px; border: 1px dashed var(--line); border-radius: 9px; text-align: center; }
.script-empty b { font-size: 14px; }
.script-empty p { max-width: 520px; margin: 0; color: var(--text-3); font-size: 11px; line-height: 1.6; }

.script-body { display: grid; grid-template-columns: minmax(0, 218px) minmax(0, 1fr); gap: 12px; margin-top: 12px; min-width: 0; }
.script-episode-list { display: flex; flex-direction: column; gap: 5px; max-height: 560px; overflow: auto; padding-right: 4px; }
.script-episode-item { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 2px 6px; width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); color: var(--text-2); text-align: left; cursor: pointer; }
.script-episode-item:hover { border-color: var(--line-strong); }
.script-episode-item.active { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.script-episode-item .no { color: var(--accent); font-size: 10px; font-weight: 700; }
.script-episode-item .title { overflow: hidden; color: var(--ink); font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.script-episode-item small { grid-column: 2; color: var(--faint); font-size: 9px; }

.script-episode-detail { min-width: 0; }
.script-episode-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.script-episode-title { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.script-episode-title b { font-size: 15px; }
.script-episode-head p { margin: 5px 0 0; color: var(--text-3); font-size: 11px; line-height: 1.55; }
.script-episode-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.script-episode-actions .btn { padding: 4px 8px; font-size: 10px; }
.script-hook { display: flex; align-items: baseline; gap: 8px; margin: 10px 0; padding: 8px 10px; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.script-hook .metric-label { flex: none; }
.script-hook b { color: var(--text-2); font-size: 11px; line-height: 1.5; }
.script-scene { margin-top: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: color-mix(in srgb, var(--surface) 82%, transparent); }
.script-scene header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 7px; }
.script-scene header b { color: var(--accent); font-size: 11px; }
.script-scene header span { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-scene header small { color: var(--faint); font-size: 9px; }
.script-scene > p { margin: 6px 0 8px; color: var(--text-2); font-size: 11px; line-height: 1.6; }
.script-lines { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line); }
.script-line { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 8px; font-size: 11px; line-height: 1.55; }
.script-line b { color: var(--ink); font-weight: 600; }
.script-line span { color: var(--text-2); }

.script-side { display: grid; gap: 12px; align-content: start; }
.script-source { margin: 0 0 10px; padding: 9px 10px; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--text-2); font-size: 11px; line-height: 1.6; }
.script-input-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.script-input-grid > div { min-width: 0; padding: 7px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); }
.script-input-grid .wide { grid-column: 1 / -1; }
.script-input-grid b { display: block; margin-top: 3px; color: var(--ink); font-size: 11px; line-height: 1.45; font-weight: 600; overflow-wrap: anywhere; }
.script-generation { display: grid; gap: 3px; margin-top: 10px; padding-top: 9px; border-top: 1px solid var(--line); }
.script-generation b { color: var(--ink); font-size: 11px; line-height: 1.45; }
.script-generation small { color: var(--faint); font-size: 9px; line-height: 1.45; }

.script-checks { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.script-checks li { display: flex; align-items: flex-start; gap: 7px; padding: 7px 8px; border: 1px solid var(--line); border-radius: 7px; }
.script-checks li.ok { border-color: color-mix(in srgb, var(--ok) 28%, var(--line)); background: color-mix(in srgb, var(--ok) 5%, transparent); }
.script-checks i { flex: none; display: grid; place-items: center; width: 17px; height: 17px; margin-top: 1px; border: 1px solid color-mix(in srgb, var(--bad) 55%, var(--line)); border-radius: 50%; color: var(--bad); font-size: 10px; font-style: normal; }
.script-checks li.ok i { border-color: color-mix(in srgb, var(--ok) 55%, var(--line)); color: var(--ok); }
.script-checks b { display: block; font-size: 11px; line-height: 1.35; }
.script-checks small { display: block; margin-top: 2px; color: var(--text-3); font-size: 9px; line-height: 1.4; }
.script-gate-hint { margin: 9px 0 0; padding: 8px 9px; border-radius: 7px; background: color-mix(in srgb, var(--warn) 9%, transparent); color: var(--text-2); font-size: 10px; line-height: 1.5; }

.script-records { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 12px; }
.script-version-list, .script-review-row { display: grid; gap: 6px; }
.script-version-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 8px; width: 100%; padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-2); text-align: left; cursor: pointer; }
.script-version-row.active { border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); background: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.script-version-row .k { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-version-row .v { color: var(--text-2); font-size: 10px; }
.script-version-row small { grid-column: 1 / -1; overflow: hidden; color: var(--faint); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.script-review-row { padding: 8px 9px; border: 1px solid var(--line); border-radius: 7px; }
.script-review-row .k { color: var(--ink); font-size: 11px; font-weight: 600; }
.script-review-row p { margin: 4px 0 0; color: var(--text-3); font-size: 10px; line-height: 1.5; }

.script-editor-backdrop { z-index: 96; }
.script-editor-modal { max-width: 900px; }
.script-novel-modal { max-width: 760px; }
.script-novel-body { display: grid; gap: 11px; max-height: 68vh; overflow: auto; }
.script-novel-chapters { display: grid; gap: 7px; padding: 9px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }
.script-novel-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; font-size: 10px; }
.script-novel-list { display: flex; flex-wrap: wrap; gap: 5px; }
.script-novel-chip { padding: 4px 7px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--text-2); font-size: 10px; }
.script-map-modal { max-width: 860px; }
.script-map-body { display: grid; gap: 11px; max-height: 70vh; overflow: auto; }
.script-map-source { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }
.script-map-source b { color: var(--ink); font-size: 12px; }
.script-map-source .muted { color: var(--text-3); font-size: 10px; }
.script-map-list { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.script-map-row { display: grid; grid-template-columns: minmax(0, 1fr) 62px 82px 82px; align-items: center; gap: 8px; padding: 7px 10px; border-top: 1px solid var(--line); background: var(--surface); }
.script-map-row:first-child { border-top: 0; }
.script-map-head { background: var(--surface-2); color: var(--text-3); font-size: 10px; }
.script-map-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.script-map-row span b { color: var(--ink); }
.script-map-source-link { margin-left: 6px; border: 0; background: transparent; color: var(--accent-ink); font-size: 10px; cursor: pointer; padding: 0; }
.script-map-source-link:hover { text-decoration: underline; }
.script-map-start { padding: 4px 6px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-2); color: var(--ink); font-size: 11px; text-align: center; }
.script-map-row small { color: var(--text-3); font-size: 10px; }
.script-map-row .field { padding: 4px 6px; font-size: 11px; }
.script-map-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 10px; }
.script-map-summary .muted { color: var(--text-3); }
.script-map-warning { color: var(--warn, #d97706); }
.script-map-options { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.script-map-overwrite { border-color: color-mix(in srgb, var(--warn, #d97706) 45%, var(--line)); }
.script-map-hint { color: var(--text-3); font-size: 10px; line-height: 1.55; }
.script-source-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.script-source-actions small { color: var(--text-3); font-size: 10px; }
.script-chapter-modal { max-width: 860px; }
.script-chapter-body { max-height: 62vh; overflow: auto; }
.script-chapter-text { margin: 0; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); color: var(--text-2); font-family: inherit; font-size: 12px; line-height: 1.9; white-space: pre-wrap; word-break: break-word; }
.script-chapter-foot { display: flex; align-items: center; justify-content: space-between; }
.script-chapter-foot > div { display: flex; gap: 6px; }
.script-chapter-foot .muted { color: var(--text-3); font-size: 10px; }
.script-editor-body { display: grid; gap: 12px; max-height: 68vh; overflow: auto; }
.script-editor-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; }
.script-editor-fields label { display: grid; gap: 4px; min-width: 0; }
.script-editor-fields .wide { grid-column: 1 / -1; }
.script-scene-editor { padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }

@media (max-width: 1380px) {
  .script-split { grid-template-columns: minmax(0, 1fr); }
  .script-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .script-side { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1120px) {
  .script-flow, .script-records, .script-side { grid-template-columns: minmax(0, 1fr); }
  .script-body { grid-template-columns: minmax(0, 1fr); }
  .script-episode-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 260px; }
  .script-editor-fields { grid-template-columns: minmax(0, 1fr); }
}
</style>
