<template>
  <section class="page production-page">
    <div class="breadcrumb"><RouterLink to="/">工作台</RouterLink><span>/</span><RouterLink to="/projects">项目</RouterLink><span>/</span><span>{{ config.title }}</span></div>
    <div class="page-heading"><div><p class="eyebrow">{{ config.eyebrow }}</p><h1>{{ config.title }}</h1><p class="muted">{{ config.description }}</p></div><div class="heading-actions"><span class="demo-state">演示数据</span><button class="primary-button" @click="openCreate">{{ config.action }}</button></div></div>
    <div class="module-tabs">
      <RouterLink :to="path('stories')">故事圣经</RouterLink><RouterLink :to="path('episodes')">剧集与剧本</RouterLink><RouterLink :to="path('assets')">资产库</RouterLink><RouterLink :to="path('storyboards')">分镜镜头</RouterLink><RouterLink :to="path('tasks')">AI 任务</RouterLink><RouterLink :to="path('reviews')">审核质量</RouterLink><RouterLink :to="path('editor')">时间线</RouterLink><RouterLink :to="path('exports')">导出交付</RouterLink>
    </div>
    <div v-if="module === 'editor'" class="editor-layout">
      <div class="content-card editor-preview"><div class="editor-preview-screen"><span>EP01 · SCENE 02 · SHOT 003</span><strong>画面预览区域</strong><small>选择时间线片段查看镜头素材</small></div><div class="editor-transport"><button class="secondary-button small" @click="playing = !playing">{{ playing ? '暂停' : '▶ 播放预览' }}</button><span>00:00:12:08 / 00:01:45:00</span><span class="status-pill">9:16 · 25 FPS</span></div></div>
      <div class="content-card"><div class="card-heading"><h2>镜头素材</h2><span class="muted">已审核 8 / 12</span></div><div v-for="clip in clips" :key="clip.id" class="media-bin-row"><span class="clip-thumb">{{ clip.code }}</span><div><strong>{{ clip.title }}</strong><small>{{ clip.duration }} · {{ clip.status }}</small></div><button class="text-action" @click="addClip(clip)">加入时间线</button></div></div>
      <div class="content-card timeline-card"><div class="card-heading"><div><h2>时间线 · v03</h2><p class="muted">非破坏性编辑 · 时间单位：毫秒</p></div><button class="secondary-button small" @click="timelineVersion++">保存新版本 v{{ timelineVersion + 1 }}</button></div>
        <div class="timeline-ruler"><span v-for="n in 7" :key="n">{{ (n-1)*10 }}s</span></div>
        <div v-for="track in tracks" :key="track.name" class="track-row"><span class="track-name">{{ track.name }}</span><div class="track-lane"><div v-for="(clip,i) in track.items" :key="clip" class="timeline-clip" :style="{ width: (track.name === '字幕' ? 17 : 23) + '%', left: (i*25+1)+'%' }">{{ clip }}</div></div></div>
        <p class="muted timeline-note">拖拽、多轨精细编辑和实时预览将在后续版本接入；当前为时间线结构与交互原型。</p>
      </div>
    </div>
    <div v-else-if="module === 'exports'" class="export-layout">
      <div class="content-card"><div class="card-heading"><h2>导出配置</h2><span class="status-pill">MP4</span></div><div class="export-fields"><label>画幅<select v-model="exportForm.ratio"><option>9:16 竖屏</option><option>16:9 横屏</option><option>1:1 方形</option></select></label><label>分辨率<select v-model="exportForm.resolution"><option>1080 × 1920</option><option>720 × 1280</option><option>1920 × 1080</option></select></label><label>帧率<select v-model="exportForm.fps"><option>25 FPS</option><option>30 FPS</option><option>24 FPS</option></select></label><label>字幕<select v-model="exportForm.subtitle"><option>烧录字幕</option><option>独立 SRT</option><option>不导出字幕</option></select></label></div><div class="export-summary"><span>时间线版本</span><strong>v03 · 01:45</strong><span>视频编码</span><strong>H.264 · 音频 AAC</strong><span>输出文件</span><strong>EP01_final_v03.mp4</strong></div><button class="primary-button" @click="exportStarted = true">{{ exportStarted ? '已加入演示队列' : '创建导出任务' }}</button><p v-if="exportStarted" class="success-note">演示任务已创建。当前不会调用 FFmpeg 或生成真实文件。</p></div>
      <div class="content-card"><h2>导出记录</h2><div v-for="job in exportJobs" :key="job.id" class="list-row"><div><strong>{{ job.name }}</strong><small>{{ job.time }}</small></div><span class="status-pill" :class="job.status === '失败' ? 'status-danger' : ''">{{ job.status }}</span></div></div>
    </div>
    <div v-else class="content-card">
      <div class="toolbar"><div class="search-field"><span>⌕</span><input v-model="search" placeholder="搜索名称、编号或状态…"></div><select v-model="filter"><option value="全部">全部状态</option><option value="进行中">进行中</option><option value="待审核">待审核</option><option value="已完成">已完成</option><option value="草稿">草稿</option></select><span class="muted">{{ filteredRows.length }} 条记录</span></div>
      <div v-if="module === 'stories'" class="story-layout">
        <div class="story-list"><button v-for="story in filteredRows" :key="story.id" class="story-select" :class="{ selected: selectedId === story.id }" @click="selectedId = story.id"><strong>{{ story.name }}</strong><small>{{ story.code }} · {{ story.status }}</small></button></div>
        <div class="story-detail"><p class="eyebrow">STORY BIBLE · VERSION 03</p><h2>{{ selectedStory.name }}</h2><p>{{ selectedStory.summary }}</p><div class="detail-tags"><span>都市悬疑</span><span>竖屏短剧</span><span>24 集</span></div><h3>核心设定</h3><p>主角在一次意外中发现一份被隐藏多年的档案，由此卷入家族秘密与商业阴谋。每集以新的线索或反转推动故事。</p><h3>人物关系</h3><div class="relationship-row"><span>林知夏</span><b>— 姐弟 —</b><span>林知远</span><b>·</b><span>顾承</span></div><h3>世界观规则</h3><ul><li>关键线索必须在前置剧集中埋设。</li><li>人物动机与行为保持一致，重要设定不可无依据改变。</li><li>每集结尾保留推动下一集的悬念。</li></ul></div>
      </div>
      <div v-else class="table-wrap"><table><thead><tr><th>{{ config.columns[0] }}</th><th>{{ config.columns[1] }}</th><th>{{ config.columns[2] }}</th><th>负责人</th><th>更新时间</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="row in filteredRows" :key="row.id"><td><strong>{{ row.name }}</strong><small class="cell-sub">{{ row.summary }}</small></td><td>{{ row.code }}</td><td>{{ row.kind }}</td><td>{{ row.owner }}</td><td>{{ row.updated }}</td><td><span class="status-pill" :class="statusClass(row.status)">{{ row.status }}</span></td><td><button class="text-action" @click="selectedId = row.id">查看详情</button></td></tr></tbody></table></div>
      <div class="pagination"><span>共 {{ filteredRows.length }} 条 · 每页 10 条</span><div><button class="secondary-button small" disabled>上一页</button><button class="secondary-button small current-page">1</button><button class="secondary-button small" disabled>下一页</button></div></div>
    </div>
    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false"><form class="modal-card" @submit.prevent="createRow"><button type="button" class="modal-close" @click="showCreate = false">×</button><p class="eyebrow">CREATE NEW</p><h2>{{ config.action }}</h2><label>名称<input v-model.trim="newName" required maxlength="120" placeholder="请输入名称"></label><label>描述<textarea v-model.trim="newSummary" rows="3" placeholder="补充说明"></textarea></label><div class="form-actions"><button class="primary-button">创建演示记录</button><button type="button" class="secondary-button" @click="showCreate = false">取消</button></div><p class="footnote">当前为本地 UI 演示数据，不会写入后端。</p></form></div>
    <div class="module-footnote"><span>ⓘ</span> 此页面使用本地演示数据，展示产品信息架构与交互状态；未接通的接口不会伪装成真实业务操作。</div>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
type ModuleKey = 'episodes'|'stories'|'assets'|'storyboards'|'tasks'|'reviews'|'editor'|'exports'
const props = defineProps<{ module: ModuleKey }>()
interface Row { id: string; name: string; code: string; kind: string; owner: string; updated: string; status: string; summary: string }
const configs: Record<ModuleKey, { eyebrow:string; title:string; description:string; action:string; columns:[string,string,string] }> = {
 episodes:{eyebrow:'SCRIPT & EPISODES',title:'剧集与剧本',description:'管理分集结构、剧本版本、场次与对白。',action:'新建剧集',columns:['剧集名称','集数编号','剧本版本']},
 stories:{eyebrow:'STORY DEVELOPMENT',title:'故事圣经',description:'沉淀故事设定、人物关系、世界观与版本历史。',action:'新建故事',columns:['故事名称','故事编号','类型']},
 assets:{eyebrow:'ASSET LIBRARY',title:'角色 / 场景 / 道具资产',description:'管理视觉参考、资产版本与镜头引用关系。',action:'新建资产',columns:['资产名称','资产编号','资产类型']},
 storyboards:{eyebrow:'STORYBOARD & SHOTS',title:'分镜与镜头',description:'按场次组织镜头，维护 Shot Contract 与生成状态。',action:'新建镜头',columns:['镜头描述','镜头编号','所属场次']},
 tasks:{eyebrow:'AI GENERATION',title:'AI 生成任务',description:'追踪 Provider、任务状态、执行尝试与生成产物。',action:'创建生成任务',columns:['任务名称','任务编号','能力类型']},
 reviews:{eyebrow:'QUALITY & REVIEW',title:'审核与质量门禁',description:'检查技术、内容、连续性与合规结果，保留审核记录。',action:'发起审核',columns:['审核对象','对象编号','审核类型']},
 editor:{eyebrow:'TIMELINE EDITOR',title:'时间线剪辑',description:'以非破坏方式组织视频、音频和字幕轨道。',action:'添加片段',columns:['片段','编号','轨道']},
 exports:{eyebrow:'EXPORT & DELIVERY',title:'成片导出',description:'配置 MP4 画幅、帧率、字幕与交付参数。',action:'创建导出',columns:['导出任务','任务编号','输出规格']},
}
const samples: Record<ModuleKey, Row[]> = {
 episodes:[
 {id:'e1',name:'第一集 · 雨夜来信',code:'EP01',kind:'剧本 v3',owner:'林编剧',updated:'11-17 16:30',status:'已完成',summary:'女主收到匿名信，故事正式展开'},
 {id:'e2',name:'第二集 · 消失的证人',code:'EP02',kind:'剧本 v2',owner:'林编剧',updated:'11-17 15:12',status:'进行中',summary:'调查线索指向旧城区'},
 {id:'e3',name:'第三集 · 旧档案',code:'EP03',kind:'剧本 v1',owner:'陈策划',updated:'11-16 18:42',status:'待审核',summary:'关键人物首次登场'},
 {id:'e4',name:'第四集 · 交易条件',code:'EP04',kind:'剧本草稿',owner:'陈策划',updated:'11-16 11:20',status:'草稿',summary:'主角面临第一次选择'},
 ],
 stories:[{id:'s1',name:'雨夜来信',code:'STORY-001',kind:'都市悬疑',owner:'陈策划',updated:'11-17 16:30',status:'已完成',summary:'一封匿名信揭开家族尘封的秘密'}],
 assets:[
 {id:'a1',name:'林知夏 · 主角形象',code:'CHR-001',kind:'角色',owner:'美术组',updated:'11-17 14:10',status:'已完成',summary:'24 岁，黑色长发，米白风衣'},
 {id:'a2',name:'顾承 · 男主形象',code:'CHR-002',kind:'角色',owner:'美术组',updated:'11-17 13:20',status:'待审核',summary:'28 岁，深色西装，克制冷静'},
 {id:'a3',name:'旧城区档案室',code:'LOC-001',kind:'场景',owner:'美术组',updated:'11-16 19:00',status:'已完成',summary:'夜景，冷色调，顶部荧光灯'},
 {id:'a4',name:'牛皮纸信封',code:'PROP-001',kind:'道具',owner:'美术组',updated:'11-16 16:40',status:'进行中',summary:'泛黄信封，红色火漆封口'},
 ],
 storyboards:[
 {id:'b1',name:'林知夏拆开信封',code:'EP01-SC02-SH003',kind:'SC02 · 近景',owner:'导演',updated:'11-17 15:30',status:'待审核',summary:'缓慢推近，捕捉人物震惊表情'},
 {id:'b2',name:'雨夜街道空镜',code:'EP01-SC01-SH001',kind:'SC01 · 全景',owner:'导演',updated:'11-17 14:20',status:'已完成',summary:'雨夜建立镜头，冷色调'},
 {id:'b3',name:'顾承走入档案室',code:'EP02-SC01-SH002',kind:'SC01 · 中景',owner:'导演',updated:'11-17 12:00',status:'进行中',summary:'侧逆光，人物由暗处进入'},
 ],
 tasks:[
 {id:'t1',name:'林知夏角色参考图生成',code:'TASK-1048',kind:'image',owner:'AI Worker',updated:'11-17 16:28',status:'进行中',summary:'Provider: mock-image · Attempt 1/3'},
 {id:'t2',name:'EP01-SH003 视频生成',code:'TASK-1047',kind:'video',owner:'AI Worker',updated:'11-17 15:50',status:'已完成',summary:'Provider: mock-video · 生成 5 秒视频'},
 {id:'t3',name:'第一集对白配音',code:'TASK-1046',kind:'tts',owner:'AI Worker',updated:'11-17 15:20',status:'待审核',summary:'Provider: mock-tts · 4 段对白'},
 ],
 reviews:[
 {id:'r1',name:'EP01-SH003 镜头审核',code:'REV-0201',kind:'内容 / 连续性',owner:'导演',updated:'11-17 16:10',status:'待审核',summary:'检查角色服装、道具状态与镜头动作'},
 {id:'r2',name:'林知夏角色参考图',code:'REV-0200',kind:'视觉资产',owner:'美术负责人',updated:'11-17 14:00',status:'已完成',summary:'外观与角色设定一致'},
 {id:'r3',name:'EP01 技术质量检查',code:'QA-0112',kind:'技术质量',owner:'系统检查',updated:'11-17 13:40',status:'进行中',summary:'检查媒体格式、分辨率和时长'},
 ],
 editor:[],exports:[
 {id:'x1',name:'第一集正式版',code:'EXP-0031',kind:'1080×1920 MP4',owner:'剪辑组',updated:'11-17 12:30',status:'已完成',summary:'H.264 · AAC · 25 FPS'},
 {id:'x2',name:'第一集审核预览',code:'EXP-0030',kind:'720×1280 MP4',owner:'剪辑组',updated:'11-17 11:40',status:'进行中',summary:'含独立 SRT 字幕'},
 ],
}
const config = computed(()=>configs[props.module])
const rows = ref<Row[]>(samples[props.module].map(x=>({...x})))
watch(()=>props.module, value=>{ rows.value=samples[value].map(x=>({...x})); search.value=''; filter.value='全部'; selectedId.value=rows.value[0]?.id ?? '' })
const search=ref(''); const filter=ref('全部'); const selectedId=ref('s1'); const showCreate=ref(false); const newName=ref(''); const newSummary=ref('')
const selectedStory = computed(()=>rows.value.find(x=>x.id===selectedId.value) ?? rows.value[0] ?? {name:'未选择故事',summary:'请选择左侧故事'})
const filteredRows = computed(()=>rows.value.filter(x=>(filter.value==='全部'||x.status===filter.value)&&[x.name,x.code,x.kind,x.owner,x.status].join(' ').toLowerCase().includes(search.value.toLowerCase())))
function openCreate(){ if(props.module==='editor'){ addClip({id:'new',code:'SH-NEW',title:'新建镜头片段',duration:'00:05',status:'待生成'}); return } showCreate.value=true }
function createRow(){const n=rows.value.length+1;rows.value.unshift({id:'new-'+n,name:newName.value,code:'NEW-'+String(n).padStart(3,'0'),kind:config.value.title,owner:'当前用户',updated:'刚刚',status:'草稿',summary:newSummary.value||'新建演示记录'});newName.value='';newSummary.value='';showCreate.value=false}
function statusClass(status:string){return status==='待审核'?'status-review':status==='进行中'?'status-progress':status==='草稿'?'status-draft':''}
const playing=ref(false); const timelineVersion=ref(3); const exportStarted=ref(false)
const clips=[{id:'c1',code:'SH001',title:'雨夜街道',duration:'00:06',status:'已审核'},{id:'c2',code:'SH002',title:'主角入场',duration:'00:04',status:'已审核'},{id:'c3',code:'SH003',title:'拆开信封',duration:'00:05',status:'待审核'}]
const tracks=ref([{name:'视频 V1',items:['雨夜街道','主角入场','拆开信封']},{name:'音频 A1',items:['环境雨声','对白 · 林知夏']},{name:'字幕',items:['EP01 · 字幕 01','EP01 · 字幕 02']}])
function addClip(clip:{title:string}){tracks.value[0].items.push(clip.title)}
const exportForm=reactive({ratio:'9:16 竖屏',resolution:'1080 × 1920',fps:'25 FPS',subtitle:'烧录字幕'})
const exportJobs=[{id:'j1',name:'第一集正式版 · v03',time:'今天 12:30',status:'已完成'},{id:'j2',name:'第一集审核预览 · v02',time:'今天 11:40',status:'进行中'}]
</script>
