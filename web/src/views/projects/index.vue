<template>
  <section class="page">
    <div class="page-heading"><div><p class="eyebrow">PROJECT WORKSPACE</p><h1>项目空间</h1><p class="muted">项目列表、项目配置与成员授权。所有数据均来自当前组织的业务 API。</p></div><button class="primary-button" @click="showForm=!showForm">新建项目</button></div>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="createProject">
      <label>项目编码<input v-model.trim="form.code" required minlength="2" maxlength="60" pattern="[A-Za-z0-9][A-Za-z0-9_-]*" placeholder="DRAMA_001"><small>2–60 位，仅允许字母、数字、下划线和连字符。</small></label>
      <label>项目名称<input v-model.trim="form.title" required maxlength="200" placeholder="项目名称"></label>
      <label class="span-all">项目简介<textarea v-model.trim="form.summary" maxlength="2000" rows="3"></textarea></label>
      <div class="span-all form-actions"><button class="primary-button" :disabled="saving">{{ saving?'提交中…':'创建项目' }}</button><button type="button" class="secondary-button" @click="showForm=false">取消</button></div>
    </form>
    <p v-if="error" class="error-text" role="alert">{{ error }} <span v-if="requestId" class="mono">Request ID: {{ requestId }}</span></p>
    <div class="content-card">
      <div class="card-heading"><h2>项目列表 <span class="count">{{ projects.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div>
      <div v-if="loading" class="loading-state"><span class="spinner"></span>正在加载项目…</div>
      <div v-else-if="!projects.length" class="empty-state">当前账号没有可访问的项目。具备 projects:write 权限后可创建项目。</div>
      <div v-else class="table-wrap"><table><thead><tr><th>项目</th><th>编码</th><th>状态</th><th>项目 ID</th><th>最近操作</th></tr></thead><tbody><tr v-for="p in projects" :key="p.id"><td><strong>{{ p.title }}</strong><small class="cell-sub">{{ p.summary || '暂无简介' }}</small></td><td>{{ p.code }}</td><td><span class="status-pill">{{ statusLabel(p.status) }}</span></td><td class="mono">{{ p.id }}</td><td><div class="inline-actions"><button class="text-action" @click="openProject(p)">配置 / 成员</button><RouterLink class="secondary-button small" :to="`/projects/${encodeURIComponent(p.id)}/stories`">进入工作区</RouterLink></div></td></tr></tbody></table></div>
    </div>
    <div v-if="selected" class="content-card project-detail">
      <div class="card-heading"><div><p class="eyebrow">PROJECT SETTINGS</p><h2>{{ selected.title }}</h2><small class="mono">{{ selected.id }}</small></div><button class="secondary-button small" @click="selected=null">关闭详情</button></div>
      <div class="module-tabs"><button :class="{active:detailTab==='settings'}" @click="detailTab='settings'">项目配置</button><button :class="{active:detailTab==='members'}" @click="detailTab='members';loadMembers()">项目成员</button></div>
      <form v-if="detailTab==='settings'" class="form-grid" @submit.prevent="saveProject">
        <label>项目名称<input v-model.trim="editForm.title" required maxlength="200"></label>
        <label>项目状态<select v-model="editForm.status"><option value="draft">草稿</option><option value="in_review">审核中</option><option value="approved">已批准</option><option value="rejected">已驳回</option><option value="archived">已归档</option></select></label>
        <label class="span-all">项目简介<textarea v-model.trim="editForm.summary" maxlength="2000" rows="4"></textarea></label>
        <div class="span-all form-actions"><button class="primary-button" :disabled="saving">保存项目配置</button></div>
      </form>
      <div v-else>
        <div class="form-inline"><select v-model="memberForm.user_id"><option value="">选择组织成员</option><option v-for="u in users" :key="u.id" :value="u.id">{{ u.full_name }} · {{ u.email }}</option></select><select v-model="memberForm.project_role"><option value="producer">制片人</option><option value="writer">编剧</option><option value="director">导演</option><option value="artist">美术</option><option value="editor">剪辑师</option><option value="reviewer">审核人</option></select><button class="primary-button" :disabled="saving||!memberForm.user_id" @click="addMember">添加成员</button></div>
        <div v-if="membersLoading" class="loading-state"><span class="spinner"></span>读取成员授权…</div>
        <div v-else-if="!members.length" class="empty-state">该项目暂无成员记录。</div>
        <div v-else class="table-wrap"><table><thead><tr><th>用户 ID</th><th>项目角色</th><th>成员状态</th><th>操作</th></tr></thead><tbody><tr v-for="m in members" :key="m.id"><td class="mono">{{ m.user_id }}</td><td>{{ roleLabel(m.project_role) }}</td><td><span class="status-pill" :class="{inactive:!m.is_active}">{{ m.is_active?'有效':'已移除' }}</span></td><td><button v-if="m.is_active" class="text-action danger" @click="removeMember(m.user_id)">移除成员</button></td></tr></tbody></table></div>
        <p class="muted">移除成员会立即撤销项目访问权限。项目 owner 不可移除，服务端执行最终校验。</p>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError } from '../../api'
import { projectsApi, type ProjectMember } from '../../api/projects'
import { usersApi } from '../../api/users'
import type { Project, User } from '../../types/api'
const projects=ref<Project[]>([]),users=ref<User[]>([]),members=ref<ProjectMember[]>([])
const loading=ref(false),saving=ref(false),membersLoading=ref(false),showForm=ref(false),error=ref(''),requestId=ref('')
const selected=ref<Project|null>(null),detailTab=ref('settings')
const form=reactive({code:'',title:'',summary:''}),editForm=reactive({title:'',summary:'',status:'draft'})
const memberForm=reactive({user_id:'',project_role:'writer'})
function errorMessage(e:unknown){if(e instanceof ApiError){requestId.value=e.requestId??'';return e.status===403?'当前账号没有项目管理权限。':e.status===409?'项目编码或版本冲突，请检查后重试。':e.message}return e instanceof Error?e.message:'请求失败'}
async function load(){loading.value=true;error.value='';try{projects.value=(await projectsApi.list()).data}catch(e){error.value=errorMessage(e)}finally{loading.value=false}}
async function createProject(){saving.value=true;error.value='';try{await projectsApi.create({...form});Object.assign(form,{code:'',title:'',summary:''});showForm.value=false;await load()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
function openProject(p:Project){selected.value=p;detailTab.value='settings';Object.assign(editForm,{title:p.title,summary:p.summary,status:p.status})}
async function saveProject(){if(!selected.value)return;saving.value=true;error.value='';try{const updated=(await projectsApi.update(selected.value.id,{...editForm})).data;selected.value=updated;await load()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
async function loadMembers(){if(!selected.value)return;membersLoading.value=true;error.value='';try{const [m,u]=await Promise.all([projectsApi.members(selected.value.id),usersApi.list()]);members.value=m.data;users.value=u.data.filter(x=>x.is_active)}catch(e){error.value=errorMessage(e)}finally{membersLoading.value=false}}
async function addMember(){if(!selected.value||!memberForm.user_id)return;saving.value=true;error.value='';try{await projectsApi.addMember(selected.value.id,memberForm.user_id,memberForm.project_role);memberForm.user_id='';await loadMembers()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
async function removeMember(userId:string){if(!selected.value||!window.confirm('确认移除此项目成员？该用户将立即失去项目访问权限。'))return;saving.value=true;error.value='';try{await projectsApi.removeMember(selected.value.id,userId);await loadMembers()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
function statusLabel(s:string){return ({draft:'草稿',in_review:'审核中',approved:'已批准',rejected:'已驳回',archived:'已归档'} as Record<string,string>)[s]??s}
function roleLabel(s:string){return ({owner:'项目所有者',producer:'制片人',writer:'编剧',director:'导演',artist:'美术',editor:'剪辑师',reviewer:'审核人'} as Record<string,string>)[s]??s}
onMounted(load)
</script>
<style scoped>
.count{font-size:11px;color:#8994a5;margin-left:6px}.loading-state{display:flex;gap:12px;align-items:center;padding:24px;color:#7f8b9e}.spinner{width:17px;height:17px;border:2px solid #dce4f2;border-top-color:#4268b5;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.inline-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.module-tabs{display:flex;gap:8px;border-bottom:1px solid #e9edf3;margin:16px 0;padding-bottom:10px}.module-tabs button{border:0;background:transparent;color:#778397;padding:8px 11px;border-radius:7px;font-size:12px}.module-tabs button.active{background:#edf2fc;color:#3f64ad;font-weight:650}.form-inline{display:flex;gap:9px;align-items:center;margin:12px 0}.form-inline select{flex:1;min-width:160px;border:1px solid #dfe5ee;border-radius:7px;padding:10px;font:inherit;font-size:13px}.danger{color:#bd4c56}.project-detail{margin-top:18px}@media(max-width:700px){.form-inline{flex-direction:column;align-items:stretch}.form-inline>*{width:100%}}
</style>
