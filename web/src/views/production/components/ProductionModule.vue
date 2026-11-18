<template>
  <section class="page production-page">
    <div class="breadcrumb"><RouterLink to="/">工作台</RouterLink><span>/</span><RouterLink to="/projects">项目</RouterLink><span>/</span><span>{{ title }}</span></div>
    <div class="page-heading">
      <div><p class="eyebrow">{{ eyebrow }}</p><h1>{{ title }}</h1><p class="muted">{{ description }}</p></div>
      <button v-if="canCreate" class="primary-button" @click="openCreate">{{ createLabel }}</button>
    </div>
    <nav class="module-tabs" aria-label="项目生产模块">
      <RouterLink v-for="item in modules" :key="item.key" :to="path(item.key)">{{ item.label }}</RouterLink>
    </nav>
    <div v-if="pageError" class="error-text" role="alert">
      {{ pageError }} <span v-if="requestId" class="mono">Request ID: {{ requestId }}</span>
      <button class="text-action" @click="load">重试</button>
    </div>
    <div v-if="unsupported" class="content-card contract-gap">
      <p class="eyebrow">BACKEND CONTRACT GAP</p>
      <h2>此模块目前没有可执行的后端业务接口</h2>
      <p class="muted">为遵守“不使用静态占位或虚假模拟内容”的要求，本页面不会生成本地记录、伪造任务状态或显示假成功。请先完成对应服务端领域模型、持久化、API、权限和契约测试，再开放业务操作。</p>
      <ul><li v-for="gap in unsupported" :key="gap">{{ gap }}</li></ul>
      <p class="muted">项目 ID：<span class="mono">{{ projectId }}</span></p>
    </div>
    <template v-else>
      <div v-if="loading" class="content-card loading-state" aria-live="polite"><span class="spinner"></span>正在从服务端读取当前项目数据…</div>
      <div v-else-if="!pageError">
        <div v-if="module === 'stories'" class="content-card">
          <div class="module-tabs inner-tabs"><button :class="{active:tab==='stories'}" @click="tab='stories'">故事列表</button><button :class="{active:tab==='bibles'}" @click="tab='bibles'">故事圣经版本</button></div>
          <div v-if="tab==='stories'">
            <div class="card-heading"><h2>故事项目 <span class="count">{{ stories.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div>
            <div v-if="!stories.length" class="empty-state">当前项目尚无故事。创建故事后可继续维护故事圣经。</div>
            <div v-else class="table-wrap"><table><thead><tr><th>故事名称</th><th>Logline</th><th>状态</th><th>Story ID</th><th>操作</th></tr></thead><tbody><tr v-for="s in stories" :key="s.id"><td><strong>{{ s.title }}</strong><small class="cell-sub">{{ s.synopsis || '未填写梗概' }}</small></td><td>{{ s.logline || '—' }}</td><td><span class="status-pill">{{ s.status }}</span></td><td class="mono">{{ s.id }}</td><td><button class="text-action" @click="selectedStory=s">查看</button></td></tr></tbody></table></div>
          </div>
          <div v-else>
            <div class="card-heading"><h2>故事圣经版本</h2><button class="secondary-button small" @click="load">刷新</button></div>
            <div v-if="!bibles.length" class="empty-state">暂无故事圣经版本。新建版本将以不可变快照保存。</div>
            <div v-for="b in bibles" :key="b.id" class="record-card"><div><strong>版本 {{ b.version_number }}</strong><small class="cell-sub">{{ b.status }} · {{ b.id }}</small></div><button class="text-action" @click="selectedBible=b">查看 JSON</button></div>
          </div>
        </div>
        <div v-else-if="module === 'episodes'" class="content-card">
          <div class="card-heading"><h2>剧集列表 <span class="count">{{ episodes.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div>
          <div v-if="!episodes.length" class="empty-state">当前项目暂无剧集。创建第一集以开始剧本生产。</div>
          <div v-else class="table-wrap"><table><thead><tr><th>集数</th><th>标题</th><th>剧情梗概</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="ep in episodes" :key="ep.id"><td>EP{{ String(ep.episode_number).padStart(2,'0') }}</td><td><strong>{{ ep.title }}</strong></td><td>{{ ep.synopsis || '—' }}</td><td><span class="status-pill">{{ ep.status }}</span></td><td><button class="text-action" @click="selectEpisode(ep)">打开剧本工作区</button></td></tr></tbody></table></div>
          <div v-if="selectedEpisode" class="detail-workspace">
            <div class="card-heading"><div><h2>{{ selectedEpisode.title }} · 剧本工作区</h2><small class="cell-sub mono">{{ selectedEpisode.id }}</small></div><button class="secondary-button small" @click="selectedEpisode=null;selectedScript=null">关闭</button></div>
            <div class="form-inline"><input v-model.trim="scriptTitle" placeholder="剧本标题" maxlength="200"><button class="primary-button" :disabled="saving||!scriptTitle" @click="createScript">创建剧本</button></div>
            <div v-if="scripts.length" class="record-list"><button v-for="s in scripts" :key="s.id" class="record-card selectable" :class="{chosen:selectedScript?.id===s.id}" @click="selectScript(s)"><span><strong>{{ s.title }}</strong><small class="cell-sub">{{ s.status }} · {{ s.id }}</small></span><span class="text-action">打开 →</span></button></div>
            <div v-if="selectedScript" class="nested-workspace">
              <h3>{{ selectedScript.title }} · 版本</h3>
              <textarea v-model="scriptContent" rows="7" maxlength="200000" placeholder="编写本次剧本版本内容。保存会创建新的不可变版本。"></textarea>
              <button class="primary-button" :disabled="saving" @click="createScriptVersion">保存为新版本</button>
              <div v-for="ver in scriptVersions" :key="ver.id" class="record-card"><span><strong>v{{ ver.version_number }}</strong><small class="cell-sub">{{ ver.status }} · {{ ver.id }}</small></span><button class="text-action" @click="selectVersion(ver)">打开场次</button></div>
              <div v-if="selectedVersion" class="nested-workspace">
                <h3>v{{ selectedVersion.version_number }} · 场次</h3>
                <div class="form-inline"><input v-model.number="sceneForm.scene_number" type="number" min="1" max="999" placeholder="场次编号"><input v-model.trim="sceneForm.location" placeholder="场景地点"><input v-model.trim="sceneForm.time_of_day" placeholder="时间"><button class="primary-button" :disabled="saving" @click="createScene">新增场次</button></div>
                <div v-for="scene in scenes" :key="scene.id" class="record-card"><span><strong>场次 {{ scene.scene_number }} · {{ scene.location }}</strong><small class="cell-sub">{{ scene.time_of_day }} · {{ scene.summary }}</small></span><button class="text-action" @click="selectedScene=scene">添加对白</button></div>
                <div v-if="selectedScene" class="form-inline"><input v-model.number="dialogueForm.order_number" type="number" min="1" placeholder="对白顺序"><input v-model.trim="dialogueForm.character_name" placeholder="角色名"><input v-model.trim="dialogueForm.content" placeholder="对白内容"><button class="primary-button" :disabled="saving" @click="createDialogue">保存对白</button></div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="module === 'assets'" class="content-card">
          <div class="module-tabs inner-tabs"><button v-for="kind in assetKinds" :key="kind.value" :class="{active:assetKind===kind.value}" @click="assetKind=kind.value;load()">{{ kind.label }}</button><button :class="{active:assetKind==='files'}" @click="assetKind='files';load()">媒体文件</button></div>
          <div v-if="assetKind==='files'">
            <div class="card-heading"><h2>项目媒体资产 <span class="count">{{ mediaAssets.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div>
            <form class="upload-form" @submit.prevent="uploadFile"><input v-model.trim="uploadTitle" required placeholder="资产标题"><input type="file" required @change="onFileChange"><button class="primary-button" :disabled="saving||!uploadFileValue">上传文件</button></form>
            <div v-if="!mediaAssets.length" class="empty-state">当前项目没有媒体文件。</div>
            <div v-else class="table-wrap"><table><thead><tr><th>标题</th><th>类型</th><th>大小</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="a in mediaAssets" :key="String(a.id)"><td><strong>{{ a.title }}</strong><small class="cell-sub mono">{{ a.id }}</small></td><td>{{ a.kind }} · {{ a.mime_type }}</td><td>{{ formatBytes(Number(a.size_bytes)) }}</td><td><span class="status-pill">{{ a.status }}</span></td><td><button class="text-action" @click="openAsset(String(a.id))">详情 / 版本</button></td></tr></tbody></table></div>
          </div>
          <div v-else>
            <div class="card-heading"><h2>{{ assetKinds.find(k=>k.value===assetKind)?.label }}资产 <span class="count">{{ productionAssets.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div>
            <div v-if="!productionAssets.length" class="empty-state">当前项目暂无该类资产。</div>
            <div v-for="a in productionAssets" :key="a.id" class="record-card"><span><strong>{{ a.name }}</strong><small class="cell-sub">{{ a.description || '暂无描述' }} · {{ a.id }}</small></span><button class="text-action" @click="selectedProductionAsset=a">创建新版本</button></div>
            <div v-if="selectedProductionAsset" class="nested-workspace"><h3>{{ selectedProductionAsset.name }} · 新版本</h3><textarea v-model="assetVersion.appearance" rows="3" placeholder="外观 / 视觉描述"></textarea><textarea v-model="assetVersion.prompt" rows="3" placeholder="生成提示词"></textarea><button class="primary-button" :disabled="saving" @click="createAssetVersion">创建资产版本</button></div>
            <form class="form-inline create-asset-form" @submit.prevent="createProductionAsset"><input v-model.trim="assetForm.name" required maxlength="120" placeholder="资产名称"><input v-model.trim="assetForm.description" maxlength="5000" placeholder="资产描述"><button class="primary-button" :disabled="saving">创建资产</button></form>
          </div>
        </div>
        <div v-else-if="module === 'storyboards'" class="content-card">
          <div class="card-heading"><h2>分镜与镜头</h2><button class="secondary-button small" @click="load">刷新剧集</button></div>
          <p class="muted">后端当前支持创建分镜板、查询/创建镜头及查询/创建 Shot Contract；尚未提供分镜板列表接口，因此此页不会伪造历史分镜板记录。</p>
          <label class="field-label">选择剧集<select v-model="storyboardEpisode"><option value="">选择当前项目剧集</option><option v-for="ep in episodes" :key="ep.id" :value="ep.id">EP{{ ep.episode_number }} · {{ ep.title }}</option></select></label>
          <button class="primary-button" :disabled="saving||!storyboardEpisode" @click="createStoryboard">创建分镜板</button>
          <div v-if="storyboard" class="detail-workspace"><h2>分镜板 v{{ storyboard.version_number }} <small class="mono">{{ storyboard.id }}</small></h2><div class="form-inline"><input v-model.number="shotForm.shot_number" type="number" min="1" max="999" placeholder="镜头编号"><select v-model="shotForm.shot_size"><option value="wide">远景</option><option value="medium">中景</option><option value="close-up">近景</option><option value="extreme-close-up">特写</option></select><input v-model.trim="shotForm.description" placeholder="镜头描述"><button class="primary-button" :disabled="saving" @click="createShot">新增镜头</button></div><div v-if="!shots.length" class="empty-state">该分镜板暂无镜头。</div><div v-for="shot in shots" :key="shot.id" class="record-card"><span><strong>Shot {{ shot.shot_number }} · {{ shot.shot_size }}</strong><small class="cell-sub">{{ shot.description }} · {{ shot.status }}</small></span><button class="text-action" @click="openContracts(shot)">Shot Contract →</button></div><div v-if="selectedShot" class="nested-workspace"><h3>Shot {{ selectedShot.shot_number }} · Contract 版本</h3><textarea v-model="contractJson" rows="8" spellcheck="false"></textarea><button class="primary-button" :disabled="saving" @click="createContract">保存为新 Contract 版本</button><div v-for="contract in contracts" :key="contract.id" class="record-card"><strong>v{{ contract.version_number }} · {{ contract.status }}</strong><button class="text-action" @click="contractJson=JSON.stringify(contract.payload,null,2)">查看 JSON</button></div></div></div>
        </div>
        <div v-else-if="module === 'tasks'" class="content-card">
          <div class="module-tabs inner-tabs"><button :class="{active:tab==='tasks'}" @click="tab='tasks'">创建 / 查询生成任务</button><button :class="{active:tab==='workflows'}" @click="tab='workflows';load">工作流运行</button></div>
          <div v-if="tab==='tasks'"><h2>生成任务</h2><p class="muted">当前后端提供任务创建、详情和协作取消；不提供项目任务列表/重试接口。创建前会真实检查 Provider 注册表。</p><div class="form-grid task-form"><label>能力<select v-model="taskForm.capability"><option value="image">图片</option><option value="video">视频</option><option value="text">文本</option><option value="audio">音频</option></select></label><label>Provider 编码<input v-model.trim="taskForm.provider_code" required></label><label>模型编码<input v-model.trim="taskForm.model_code" required></label><label class="span-all">生成提示词<textarea v-model.trim="taskForm.prompt" required maxlength="8000" rows="4"></textarea></label><label class="span-all">参数 JSON<textarea v-model="taskParameters" rows="4"></textarea></label><div class="span-all"><button class="primary-button" :disabled="saving||!taskForm.prompt.trim()" @click="createTask">提交真实生成任务</button></div></div><div class="card-heading"><h3>Provider 健康状态</h3><button class="secondary-button small" @click="loadProviders">刷新</button></div><div v-for="p in providers" :key="p.code" class="record-card"><strong>{{ p.code }}</strong><span :class="['status-pill',p.healthy?'':'inactive']">{{ p.healthy?'健康':'不可用' }}</span></div><div class="form-inline"><input v-model.trim="taskLookupId" placeholder="输入 task_id 查询服务端详情"><button class="secondary-button" :disabled="!taskLookupId" @click="lookupTask">查询</button></div><div v-if="taskDetail" class="detail-workspace"><div class="card-heading"><h3>任务 {{ taskDetail.id }}</h3><span class="status-pill">{{ taskDetail.status }}</span></div><p class="muted">{{ taskDetail.capability }} · {{ taskDetail.provider_code }} / {{ taskDetail.model_code }}</p><p v-if="taskDetail.error_code" class="error-text">{{ taskDetail.error_code }} · {{ taskDetail.error_message }}</p><button v-if="['queued','running','cancel_requested'].includes(taskDetail.status)" class="secondary-button" :disabled="saving" @click="cancelTask">请求取消</button><div v-for="attempt in taskDetail.attempts||[]" :key="attempt.attempt_number" class="record-card"><span><strong>Attempt {{ attempt.attempt_number }}</strong><small class="cell-sub">{{ attempt.status }} · {{ attempt.error_code||'无错误码' }} · {{ attempt.duration_ms??'—' }} ms</small></span></div><pre v-if="taskDetail.result_payload" class="json-view">{{ JSON.stringify(taskDetail.result_payload,null,2) }}</pre></div></div>
          <div v-else><div class="card-heading"><h2>工作流运行 <span class="count">{{ workflows.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div><form class="form-inline" @submit.prevent="createWorkflow"><input v-model.trim="workflowCode" required placeholder="workflow_code"><button class="primary-button" :disabled="saving">创建工作流运行</button></form><div v-if="!workflows.length" class="empty-state">当前项目暂无工作流运行。</div><div v-for="w in workflows" :key="w.id" class="record-card"><span><strong>{{ w.id }}</strong><small class="cell-sub">{{ w.status }} · {{ w.error_code||'无错误' }}</small></span><div class="inline-actions"><button class="text-action" @click="openWorkflow(w.id)">详情</button><button class="text-action" @click="runWorkflowAction(w.id,'cancel')">取消</button><button class="text-action" @click="runWorkflowAction(w.id,'recover')">恢复孤儿任务</button></div></div><div v-if="workflowDetail" class="nested-workspace"><h3>工作流节点</h3><div v-for="n in workflowDetail.nodes||[]" :key="n.id" class="record-card"><span><strong>{{ n.node_key }}</strong><small class="cell-sub">{{ n.node_type }} · {{ n.status }} · Attempt {{ n.attempt_count }}/{{ n.max_attempts }}</small></span><span v-if="n.error_code" class="error-text">{{ n.error_code }}</span></div></div></div>
        </div>
      </div>
    </template>
    <div v-if="selectedStory" class="modal-backdrop" @click.self="selectedStory=null"><section class="modal-card"><div class="card-heading"><h2>{{ selectedStory.title }}</h2><button class="text-action" @click="selectedStory=null">关闭</button></div><p>{{ selectedStory.logline }}</p><p class="muted">{{ selectedStory.synopsis }}</p><small class="mono">{{ selectedStory.id }}</small></section></div>
    <div v-if="selectedBible" class="modal-backdrop" @click.self="selectedBible=null"><section class="modal-card"><div class="card-heading"><h2>故事圣经 v{{ selectedBible.version_number }}</h2><button class="text-action" @click="selectedBible=null">关闭</button></div><pre class="json-view">{{ JSON.stringify(selectedBible.content,null,2) }}</pre></section></div>
    <div v-if="assetDetail" class="modal-backdrop" @click.self="assetDetail=null"><section class="modal-card"><div class="card-heading"><h2>媒体资产详情</h2><button class="text-action" @click="assetDetail=null">关闭</button></div><pre class="json-view">{{ JSON.stringify(assetDetail,null,2) }}</pre><div class="form-inline"><input v-model.trim="versionNote" placeholder="版本说明"><input type="file" @change="onVersionFileChange"><button class="primary-button" :disabled="saving||!versionFile" @click="uploadVersion">上传新版本</button></div></section></div>
    <div v-if="showCreateForm" class="modal-backdrop" @click.self="showCreateForm=false"><section class="modal-card"><div class="card-heading"><h2>{{ createTitle }}</h2><button class="text-action" @click="showCreateForm=false">关闭</button></div>
      <form v-if="module==='stories'" class="form-grid" @submit.prevent="createStory"><label>故事名称<input v-model.trim="storyForm.title" required maxlength="200"></label><label>一句话梗概<input v-model.trim="storyForm.logline" maxlength="500"></label><label class="span-all">故事摘要<textarea v-model.trim="storyForm.synopsis" rows="5" maxlength="5000"></textarea></label><div class="span-all"><button class="primary-button" :disabled="saving">创建故事</button></div></form>
      <form v-else-if="module==='episodes'" class="form-grid" @submit.prevent="createEpisode"><label>集数<input v-model.number="episodeForm.episode_number" type="number" min="1" max="999" required></label><label>标题<input v-model.trim="episodeForm.title" required maxlength="200"></label><label class="span-all">剧情梗概<textarea v-model.trim="episodeForm.synopsis" rows="4" maxlength="5000"></textarea></label><div class="span-all"><button class="primary-button" :disabled="saving">创建剧集</button></div></form>
      <form v-else class="form-grid" @submit.prevent="createBible"><label class="span-all">故事圣经 JSON<textarea v-model="bibleJson" rows="12" spellcheck="false"></textarea></label><div class="span-all"><button class="primary-button" :disabled="saving">创建新版本</button></div></form>
    </section></div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '../../../api'
import { productionApi, type AssetVersion, type Dialogue, type Episode, type ProductionAsset, type Script, type ScriptScene, type ScriptVersion, type Shot, type ShotContract, type Story, type StoryBible, type Storyboard, type Task, type WorkflowRun, type ProviderHealth } from '../../../api/production'

type ModuleKey='stories'|'episodes'|'assets'|'storyboards'|'tasks'|'reviews'|'editor'|'exports'
const props=defineProps<{module:ModuleKey}>()
const route=useRoute()
const projectId=computed(()=>String(route.params.projectId??''))
const modules=[{key:'stories',label:'故事圣经'},{key:'episodes',label:'剧集与剧本'},{key:'assets',label:'资产中心'},{key:'storyboards',label:'分镜镜头'},{key:'tasks',label:'AI 任务'},{key:'reviews',label:'审核质量'},{key:'editor',label:'时间线'},{key:'exports',label:'导出交付'}]
const titles:Record<ModuleKey,string>={stories:'故事圣经',episodes:'剧集与剧本',assets:'资产中心',storyboards:'分镜与镜头',tasks:'AI 生成任务',reviews:'质量与审核',editor:'时间线剪辑',exports:'成片交付'}
const descriptions:Record<ModuleKey,string>={stories:'故事结构化设定与不可变故事圣经版本。',episodes:'剧集、剧本版本、场次与对白的完整创作链路。',assets:'项目内角色、场景、道具与媒体文件版本管理。',storyboards:'分镜板、镜头与 Shot Contract 版本化管理。',tasks:'真实 Provider 状态、生成任务、Attempt 与工作流运行。',reviews:'审核与质量门禁。',editor:'基于固定素材版本和精确时码的时间线编辑。',exports:'固定版本成片导出、验证和交付。'}
const gaps:Partial<Record<ModuleKey,string[]>>={reviews:['当前后端没有 QualityRuleSet / QualityRun / QualityIssue API。','当前后端没有 ReviewRecord / approve / reject / rework API。'],editor:['当前后端没有 Timeline / TimelineVersion / Track / Clip 持久化 API。'],exports:['当前只有基于图片资产的同步 slideshow 导出入口。','没有 ExportJob 列表、详情、取消、校验报告及下载接口，无法实现真实任务生命周期。']}
const title=computed(()=>titles[props.module]),description=computed(()=>descriptions[props.module]),eyebrow=computed(()=>props.module.toUpperCase()),unsupported=computed(()=>gaps[props.module]??null)
const canCreate=computed(()=>['stories','episodes'].includes(props.module))
const createLabel=computed(()=>props.module==='stories'?'新建故事':props.module==='episodes'?'新建剧集':'新建')
const createTitle=computed(()=>props.module==='stories'?'创建故事':props.module==='episodes'?'创建剧集':'新建故事圣经版本')
const loading=ref(false),saving=ref(false),pageError=ref(''),requestId=ref(''),showCreateForm=ref(false),tab=ref('stories')
const stories=ref<Story[]>([]),bibles=ref<StoryBible[]>([]),episodes=ref<Episode[]>([])
const selectedStory=ref<Story|null>(null),selectedBible=ref<StoryBible|null>(null)
const storyForm=reactive({title:'',logline:'',synopsis:''}),episodeForm=reactive({episode_number:1,title:'',synopsis:''})
const bibleJson=ref('{
  "worldview": "",
  "themes": [],
  "characters": [],
  "relationships": [],
  "rules": []
}')
const selectedEpisode=ref<Episode|null>(null),scripts=ref<Script[]>([]),selectedScript=ref<Script|null>(null),scriptTitle=ref(''),scriptVersions=ref<ScriptVersion[]>([]),scriptContent=ref(''),selectedVersion=ref<ScriptVersion|null>(null),scenes=ref<ScriptScene[]>([]),selectedScene=ref<ScriptScene|null>(null)
const sceneForm=reactive({scene_number:1,location:'',time_of_day:'',summary:''}),dialogueForm=reactive({order_number:1,character_name:'',content:''})
const assetKinds=[{value:'characters',label:'角色'},{value:'scenes',label:'场景'},{value:'props',label:'道具'}] as const
const assetKind=ref<'characters'|'scenes'|'props'|'files'>('characters'),productionAssets=ref<ProductionAsset[]>([]),mediaAssets=ref<Array<Record<string,unknown>>>([]),selectedProductionAsset=ref<ProductionAsset|null>(null),assetForm=reactive({name:'',description:''}),assetVersion=reactive({appearance:'',prompt:''}),assetDetail=ref<Record<string,unknown>|null>(null),versionNote=ref(''),versionFile=ref<File|null>(null),uploadTitle=ref(''),uploadFileValue=ref<File|null>(null)
const storyboardEpisode=ref(''),storyboard=ref<Storyboard|null>(null),shots=ref<Shot[]>([]),shotForm=reactive({shot_number:1,shot_size:'medium',description:''}),selectedShot=ref<Shot|null>(null),contracts=ref<ShotContract[]>([]),contractJson=ref('{
  "framing": "",
  "camera": "",
  "action": "",
  "dialogue": "",
  "duration": null,
  "asset_version_refs": [],
  "continuity_constraints": []
}')
const providers=ref<ProviderHealth[]>([]),taskForm=reactive({capability:'image',provider_code:'',model_code:'',prompt:''}),taskParameters=ref('{}'),taskLookupId=ref(''),taskDetail=ref<Task|null>(null),workflows=ref<WorkflowRun[]>([]),workflowCode=ref('episode-production'),workflowDetail=ref<WorkflowRun|null>(null)
function path(section:string){return projectId.value?'/projects/'+encodeURIComponent(projectId.value)+'/'+section:'/projects'}
function message(e:unknown){if(e instanceof ApiError){requestId.value=e.requestId??'';return e.status===403?'当前账号没有执行此操作的权限。':e.status===404?'资源不存在或已不可访问。':e.status===409?'数据版本冲突，请重新加载后再操作。':e.message}return e instanceof Error?e.message:'请求失败，请稍后重试。'}
async function run<T>(fn:()=>Promise<T>,after?:(v:T)=>void){saving.value=true;pageError.value='';try{const v=await fn();after?.(v);return v}catch(e){pageError.value=message(e);return null}finally{saving.value=false}}
async function load(){if(!projectId.value)return;loading.value=true;pageError.value='';requestId.value='';try{if(props.module==='stories'){const [s,b]=await Promise.all([productionApi.stories(projectId.value),productionApi.storyBibles(projectId.value)]);stories.value=s;bibles.value=b}else if(props.module==='episodes'){episodes.value=await productionApi.episodes(projectId.value)}else if(props.module==='assets'){if(assetKind.value==='files')mediaAssets.value=await productionApi.assetFiles(projectId.value);else productionAssets.value=await productionApi.productionAssets(projectId.value,assetKind.value)}else if(props.module==='storyboards'){episodes.value=await productionApi.episodes(projectId.value)}else if(props.module==='tasks'){if(tab.value==='workflows')workflows.value=await productionApi.workflows(projectId.value);await loadProviders()}}catch(e){pageError.value=message(e)}finally{loading.value=false}}
async function loadProviders(){try{providers.value=await productionApi.providers()}catch(e){pageError.value=message(e)}}
function openCreate(){showCreateForm.value=true}
async function createStory(){await run(()=>productionApi.createStory(projectId.value,{...storyForm}),async()=>{showCreateForm.value=false;Object.assign(storyForm,{title:'',logline:'',synopsis:''});await load()})}
async function createEpisode(){await run(()=>productionApi.createEpisode(projectId.value,{...episodeForm}),async()=>{showCreateForm.value=false;Object.assign(episodeForm,{episode_number:episodes.value.length+1,title:'',synopsis:''});await load()})}
async function createBible(){try{const parsed=JSON.parse(bibleJson.value);await run(()=>productionApi.createStoryBible(projectId.value,parsed),async()=>{showCreateForm.value=false;tab.value='bibles';await load()})}catch{pageError.value='故事圣经必须是有效 JSON 对象。'}}
async function selectEpisode(ep:Episode){selectedEpisode.value=ep;selectedScript.value=null;selectedVersion.value=null;scripts.value=[];scriptVersions.value=[];try{const detail=await productionApi.episode(ep.id);selectedEpisode.value=detail;const maybe=await productionApi.episode(ep.id);void maybe}catch(e){pageError.value=message(e)}}
async function createScript(){if(!selectedEpisode.value)return;await run(()=>productionApi.createScript(selectedEpisode.value!.id,scriptTitle.value),async()=>{scriptTitle.value='';await loadScripts()})}
async function loadScripts(){if(!selectedEpisode.value)return;/* Script list is not exposed by the current API; keep only a newly created script in the active interaction. */pageError.value='剧本列表读取接口尚未提供。新建剧本已由服务端保存，但刷新后无法查询历史剧本；需要补充 GET /episodes/{id}/scripts。';}
async function selectScript(s:Script){selectedScript.value=s;scriptVersions.value=await productionApi.scriptVersions(s.id)}
async function createScriptVersion(){if(!selectedScript.value)return;await run(()=>productionApi.createScriptVersion(selectedScript.value!.id,scriptContent.value),async v=>{scriptContent.value='';if(v)await selectScript(selectedScript.value!)})}
async function selectVersion(v:ScriptVersion){selectedVersion.value=v;scenes.value=await productionApi.scenes(v.id)}
async function createScene(){if(!selectedVersion.value)return;await run(()=>productionApi.createScene(selectedVersion.value!.id,{...sceneForm}),async()=>{await selectVersion(selectedVersion.value!)})}
async function createDialogue(){if(!selectedScene.value)return;await run(()=>productionApi.createDialogue(selectedScene.value!.id,{...dialogueForm}),()=>{pageError.value='对白已由服务端创建。当前 API 未提供对白列表读取接口，无法在此展示已保存对白。'})}
async function createProductionAsset(){await run(()=>productionApi.createProductionAsset(projectId.value,assetKind.value as 'characters'|'scenes'|'props',{...assetForm}),async()=>{Object.assign(assetForm,{name:'',description:''});await load()})}
async function createAssetVersion(){if(!selectedProductionAsset.value)return;await run(()=>productionApi.createAssetVersion(assetKind.value as 'characters'|'scenes'|'props',selectedProductionAsset.value!.id,{...assetVersion}),async()=>{selectedProductionAsset.value=null;Object.assign(assetVersion,{appearance:'',prompt:''});await load()})}
function onFileChange(e:Event){uploadFileValue.value=(e.target as HTMLInputElement).files?.[0]??null}
function onVersionFileChange(e:Event){versionFile.value=(e.target as HTMLInputElement).files?.[0]??null}
async function uploadFile(){if(!uploadFileValue.value)return;await run(()=>productionApi.uploadAsset(projectId.value,uploadFileValue.value!,uploadTitle.value),async()=>{uploadFileValue.value=null;uploadTitle.value='';await load()})}
async function openAsset(id:string){try{assetDetail.value=await productionApi.assetDetail(id)}catch(e){pageError.value=message(e)}}
async function uploadVersion(){if(!assetDetail.value||!versionFile.value)return;await run(()=>productionApi.uploadAssetVersion(String(assetDetail.value!.id),versionFile.value!,versionNote.value),async()=>{versionFile.value=null;versionNote.value='';assetDetail.value=await productionApi.assetDetail(String(assetDetail.value!.id))})}
async function createStoryboard(){await run(()=>productionApi.createStoryboard(storyboardEpisode.value,1),async v=>{storyboard.value=v;shots.value=[];selectedShot.value=null})}
async function createShot(){if(!storyboard.value)return;await run(()=>productionApi.createShot(storyboard.value!.id,{...shotForm}),async()=>{shots.value=await productionApi.shots(storyboard.value!.id)})}
async function openContracts(shot:Shot){selectedShot.value=shot;try{contracts.value=await productionApi.shotContracts(shot.id)}catch(e){pageError.value=message(e)}}
async function createContract(){if(!selectedShot.value)return;try{const payload=JSON.parse(contractJson.value);await run(()=>productionApi.createShotContract(selectedShot.value!.id,payload),async()=>{contracts.value=await productionApi.shotContracts(selectedShot.value!.id)})}catch{pageError.value='Shot Contract 必须是有效 JSON 对象。'}}
async function createTask(){try{const parameters=JSON.parse(taskParameters.value);await run(()=>productionApi.createTask(projectId.value,{...taskForm,parameters}),v=>{if(v){taskDetail.value=v;taskLookupId.value=v.id}})}catch{pageError.value='参数必须是有效 JSON 对象。'}}
async function lookupTask(){await run(()=>productionApi.task(taskLookupId.value),v=>{taskDetail.value=v})}
async function cancelTask(){if(!taskDetail.value)return;await run(()=>productionApi.cancelTask(taskDetail.value!.id),v=>{taskDetail.value=v})}
async function createWorkflow(){await run(()=>productionApi.createWorkflow(projectId.value,workflowCode.value,{}),async()=>{await load()})}
async function openWorkflow(id:string){await run(()=>productionApi.workflow(id),v=>{workflowDetail.value=v})}
async function runWorkflowAction(id:string,action:'cancel'|'recover'){if(!window.confirm(action==='cancel'?'确认请求取消此工作流？':'确认尝试恢复该工作流的孤儿任务？'))return;await run(()=>action==='cancel'?productionApi.cancelWorkflow(id):productionApi.recoverWorkflow(id),async()=>{await load()})}
function selectVersionContent(v:ScriptVersion){scriptContent.value=v.content}
function selectVersion(v:ScriptVersion){selectedVersion.value=v;scenes.value=[];productionApi.scenes(v.id).then(v=>scenes.value=v).catch(e=>pageError.value=message(e))}
function formatBytes(n:number){if(!Number.isFinite(n))return '—';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB'}
watch(()=>[props.module,projectId.value],()=>{showCreateForm.value=false;selectedEpisode.value=null;storyboard.value=null;taskDetail.value=null;void load()})
watch(tab,()=>{if(props.module==='tasks')void load()})
onMounted(load)
</script>

<style scoped>
.breadcrumb{display:flex;gap:9px;align-items:center;color:#929dad;font-size:12px;margin-bottom:20px}.breadcrumb a{color:#5876b5}.module-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e9edf3;margin:0 0 18px;padding-bottom:12px}.module-tabs a,.module-tabs button{border:0;background:transparent;color:#778397;padding:8px 11px;border-radius:7px;font-size:12px}.module-tabs a.router-link-active,.module-tabs button.active{background:#edf2fc;color:#3f64ad;font-weight:650}.inner-tabs{margin-bottom:18px}.count{font-size:11px;color:#8994a5;font-weight:500;margin-left:5px}.record-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border:1px solid #edf0f5;border-radius:8px;margin:8px 0;font-size:13px}.record-card strong{font-weight:650}.selectable{width:100%;text-align:left;background:#fff;color:inherit}.selectable.chosen{border-color:#9bb2df;background:#f8faff}.detail-workspace,.nested-workspace{margin-top:20px;padding:18px;border:1px solid #e7ecf4;border-radius:10px;background:#fbfcfe}.nested-workspace{margin-top:14px;background:#fff}.nested-workspace h3,.detail-workspace h2{font-size:15px;margin:0 0 13px}.form-inline{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:12px 0}.form-inline input,.form-inline select,.field-label select,.nested-workspace textarea,.task-form textarea{border:1px solid #dfe5ee;border-radius:7px;padding:10px 11px;font:inherit;font-size:13px;min-width:150px;flex:1}.nested-workspace textarea{width:100%;margin:6px 0}.field-label{display:block;margin:16px 0;font-size:12px;font-weight:600}.field-label select{display:block;width:100%;margin-top:7px}.upload-form{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:14px 0}.upload-form input{border:1px solid #dfe5ee;border-radius:7px;padding:9px;max-width:260px}.inline-actions{display:flex;gap:10px;flex-wrap:wrap}.json-view{background:#17243b;color:#e2eafa;border-radius:8px;padding:14px;overflow:auto;font:12px/1.6 ui-monospace,monospace;max-height:300px}.modal-backdrop{position:fixed;inset:0;background:#17243b80;z-index:20;display:grid;place-items:center;padding:20px}.modal-card{background:#fff;border-radius:12px;padding:22px;width:min(720px,100%);max-height:85vh;overflow:auto;box-shadow:0 20px 60px #101a2a33}.modal-card p{font-size:13px;line-height:1.7}.loading-state{display:flex;gap:12px;align-items:center;color:#78859a}.spinner{width:18px;height:18px;border:2px solid #dce4f2;border-top-color:#4268b5;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.contract-gap ul{color:#68768c;font-size:13px;line-height:1.9}.contract-gap h2{font-size:19px;margin:8px 0}.error-text .mono{margin-left:10px}.task-form{margin-top:16px}.task-form label{min-width:0}.create-asset-form{padding-top:14px;border-top:1px solid #edf0f5}@media(max-width:760px){.page{padding:24px 16px}.page-heading{align-items:flex-start;flex-direction:column}.module-tabs{overflow-x:auto;flex-wrap:nowrap}.module-tabs a,.module-tabs button{white-space:nowrap}.form-inline>*{min-width:100%!important}.record-card{align-items:flex-start;flex-direction:column}.modal-card{padding:16px}.upload-form>*{max-width:100%!important;width:100%}}
</style>
