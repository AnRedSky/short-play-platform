<template>
  <section class="page"><div class="page-heading"><div><p class="eyebrow">ORGANIZATION</p><h1>组织与部门</h1><p class="muted">查看当前账号可访问的组织、部门层级和组织成员归属。</p></div><button class="primary-button" @click="showForm=!showForm">新建部门</button></div>
    <p v-if="error" class="error-text" role="alert">{{ error }} <span v-if="requestId" class="mono">Request ID: {{ requestId }}</span></p>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="create"><label>部门名称<input v-model.trim="name" required maxlength="120" placeholder="例如：制作部"></label><label>上级部门<select v-model="parentId"><option value="">一级部门</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></label><div class="span-all form-actions"><button class="primary-button" :disabled="saving">{{ saving?'保存中…':'创建部门' }}</button><button type="button" class="secondary-button" @click="showForm=false">取消</button></div></form>
    <div class="content-card"><div class="card-heading"><h2>组织信息</h2><button class="secondary-button small" @click="load">刷新</button></div><div v-if="loading" class="loading-state">正在加载组织数据…</div><div v-else><div v-for="org in organizations" :key="org.id" class="org-banner"><div class="avatar large">{{ org.name.slice(0,1) }}</div><div><strong>{{ org.name }}</strong><small>{{ org.slug }}</small><small class="mono">{{ org.id }}</small></div></div><h3 class="section-subtitle">部门层级 <span class="count">{{ departments.length }}</span></h3><div v-if="!departments.length" class="empty-state">暂无部门，请创建第一个部门。</div><div v-else class="department-list"><div v-for="d in departments" :key="d.id" class="department-row"><span class="dept-icon">▦</span><strong>{{ d.name }}</strong><small>{{ d.parent_id ? '子部门' : '一级部门' }}</small><small class="mono">{{ d.id }}</small></div></div><h3 class="section-subtitle">组织成员 <span class="count">{{ members.length }}</span></h3><div v-if="!members.length" class="empty-state">暂无组织成员记录。</div><div v-else class="table-wrap"><table><thead><tr><th>用户 ID</th><th>部门 ID</th><th>状态</th></tr></thead><tbody><tr v-for="m in members" :key="m.id"><td class="mono">{{ m.user_id }}</td><td class="mono">{{ m.department_id||'未分配' }}</td><td><span class="status-pill" :class="{inactive:!m.is_active}">{{ m.is_active?'有效':'停用' }}</span></td></tr></tbody></table></div></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '../../api'
import { organizationsApi } from '../../api/organizations'
import type { Department, Organization } from '../../types/api'
import type { OrganizationMember } from '../../api/organizations'
const organizations=ref<Organization[]>([]),departments=ref<Department[]>([]),members=ref<OrganizationMember[]>([])
const loading=ref(false),saving=ref(false),showForm=ref(false),name=ref(''),parentId=ref(''),error=ref(''),requestId=ref('')
function errorMessage(e:unknown){if(e instanceof ApiError){requestId.value=e.requestId??'';return e.status===403?'当前账号没有组织管理权限。':e.message}return e instanceof Error?e.message:'组织数据加载失败'}
async function load(){loading.value=true;error.value='';try{const [o,d,m]=await Promise.all([organizationsApi.list(),organizationsApi.departments(),organizationsApi.members()]);organizations.value=o.data;departments.value=d.data;members.value=m.data}catch(e){error.value=errorMessage(e)}finally{loading.value=false}}
async function create(){saving.value=true;error.value='';try{await organizationsApi.createDepartment({name:name.value,parent_id:parentId.value||null});name.value='';parentId.value='';showForm.value=false;await load()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
onMounted(load)
</script>
<style scoped>
.loading-state{padding:24px;text-align:center;color:#7f8b9e}.count{font-size:11px;color:#8994a5;margin-left:6px}.section-subtitle{font-size:14px;margin:24px 0 12px}.org-banner{display:flex;align-items:center;gap:14px;padding:16px;background:#f8faff;border:1px solid #edf0f5;border-radius:10px}.org-banner strong,.org-banner small{display:block}.org-banner small{color:#8a95a5;font-size:11px;margin-top:4px}.department-row{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #eef1f5}.department-row small{color:#8a95a5;font-size:11px}.dept-icon{color:#5475b5}.department-row .mono{margin-left:auto}@media(max-width:650px){.department-row{flex-wrap:wrap}.department-row .mono{margin-left:0;width:100%}}
</style>
