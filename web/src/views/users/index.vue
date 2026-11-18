<template>
  <section class="page"><div class="page-heading"><div><p class="eyebrow">IDENTITY & ACCESS</p><h1>用户管理</h1><p class="muted">管理组织账号、部门归属和初始角色。账号启停由服务端生效。</p></div><button class="primary-button" @click="showForm=!showForm">添加用户</button></div>
    <p v-if="error" class="error-text" role="alert">{{ error }} <span v-if="requestId" class="mono">Request ID: {{ requestId }}</span></p>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="createUser"><label>姓名<input v-model.trim="form.full_name" required maxlength="200"></label><label>企业邮箱<input v-model.trim="form.email" type="email" required maxlength="320"></label><label>初始密码<input v-model="form.password" type="password" required minlength="8" autocomplete="new-password"><small>至少 8 位，密码仅提交给服务端，不在列表回显。</small></label><label>所属部门<select v-model="form.department_id"><option value="">不指定部门</option><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></label><label class="span-all">初始角色<select v-model="form.role_id"><option value="">不分配角色</option><option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }} · {{ r.code }}</option></select></label><div class="span-all form-actions"><button class="primary-button" :disabled="saving">{{ saving?'创建中…':'创建账号' }}</button><button type="button" class="secondary-button" @click="showForm=false">取消</button></div></form>
    <div class="content-card"><div class="card-heading"><h2>组织成员 <span class="count">{{ users.length }}</span></h2><button class="secondary-button small" @click="load">刷新</button></div><div v-if="loading" class="loading-state">正在加载用户…</div><div v-else-if="!users.length" class="empty-state">暂无用户记录。</div><div v-else class="table-wrap"><table><thead><tr><th>成员</th><th>邮箱</th><th>状态</th><th>用户 ID</th><th>操作</th></tr></thead><tbody><tr v-for="u in users" :key="u.id"><td><strong>{{ u.full_name }}</strong></td><td>{{ u.email }}</td><td><span class="status-pill" :class="{inactive:!u.is_active}">{{ u.is_active?'正常':'已禁用' }}</span></td><td class="mono">{{ u.id }}</td><td><button class="text-action" @click="toggle(u)">{{ u.is_active?'禁用账号':'启用账号' }}</button></td></tr></tbody></table></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ApiError } from '../../api'
import { usersApi } from '../../api/users'
import { organizationsApi } from '../../api/organizations'
import { rolesApi } from '../../api/roles'
import type { Department, Role, User } from '../../types/api'
const users=ref<User[]>([]),departments=ref<Department[]>([]),roles=ref<Role[]>([]),loading=ref(false),saving=ref(false),error=ref(''),requestId=ref(''),showForm=ref(false)
const form=reactive({full_name:'',email:'',password:'',department_id:'',role_id:''})
function errorMessage(e:unknown){if(e instanceof ApiError){requestId.value=e.requestId??'';return e.status===403?'当前账号没有用户管理权限。':e.message}return e instanceof Error?e.message:'用户操作失败'}
async function load(){loading.value=true;error.value='';try{const [u,d,r]=await Promise.all([usersApi.list(),organizationsApi.departments(),rolesApi.list()]);users.value=u.data;departments.value=d.data;roles.value=r.data}catch(e){error.value=errorMessage(e)}finally{loading.value=false}}
async function createUser(){saving.value=true;error.value='';try{await usersApi.create({full_name:form.full_name,email:form.email,password:form.password,department_id:form.department_id||null,role_ids:form.role_id?[form.role_id]:[]});Object.assign(form,{full_name:'',email:'',password:'',department_id:'',role_id:''});showForm.value=false;await load()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
async function toggle(user:User){if(!window.confirm(`确认${user.is_active?'禁用':'启用'}账号 ${user.email}？`))return;saving.value=true;error.value='';try{await usersApi.update(user.id,{is_active:!user.is_active});await load()}catch(e){error.value=errorMessage(e)}finally{saving.value=false}}
onMounted(load)
</script>
<style scoped>.count{font-size:11px;color:#8994a5;margin-left:6px}.loading-state{padding:24px;text-align:center;color:#7f8b9e}.form-grid small{font-size:11px;color:#8a95a5;font-weight:400}</style>
