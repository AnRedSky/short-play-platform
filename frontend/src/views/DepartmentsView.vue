<template>
  <section class="page"><div class="page-heading"><div><p class="eyebrow">ORGANIZATION</p><h1>组织与部门</h1><p class="muted">查看当前账号所属组织和部门结构。</p></div><button class="primary-button" @click="showForm = !showForm">新建部门</button></div>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="create"><label>部门名称<input v-model.trim="name" required maxlength="120" placeholder="例如：制作部"></label><div class="form-actions"><button class="primary-button" :disabled="saving">{{ saving ? '保存中…' : '创建部门' }}</button><button type="button" class="secondary-button" @click="showForm = false">取消</button></div></form>
    <p v-if="error" class="error-text">{{ error }}</p><div class="content-card"><div class="card-heading"><h2>组织信息</h2><button class="secondary-button small" @click="load">刷新</button></div><div v-for="org in organizations" :key="org.id" class="org-banner"><div class="avatar large">{{ org.name.slice(0,1) }}</div><div><strong>{{ org.name }}</strong><small>{{ org.slug }}</small></div></div><h3 class="section-subtitle">部门列表</h3><div v-if="loading" class="empty-state">正在加载…</div><div v-else-if="!departments.length" class="empty-state">暂无部门，请创建部门。</div><div v-else class="department-list"><div v-for="d in departments" :key="d.id" class="department-row"><span class="dept-icon">▦</span><strong>{{ d.name }}</strong><small>{{ d.parent_id ? '子部门' : '一级部门' }}</small></div></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { organizationsApi, type Department, type Organization } from '../services/resources'
const organizations = ref<Organization[]>([]); const departments = ref<Department[]>([]); const loading = ref(false); const saving = ref(false); const showForm = ref(false); const name = ref(''); const error = ref('')
async function load() { loading.value = true; error.value = ''; try { const [o,d] = await Promise.all([organizationsApi.list(), organizationsApi.departments()]); organizations.value = o.data; departments.value = d.data } catch (e) { error.value = e instanceof Error ? e.message : '组织数据加载失败' } finally { loading.value = false } }
async function create() { saving.value = true; error.value = ''; try { await organizationsApi.createDepartment({ name: name.value }); name.value = ''; showForm.value = false; await load() } catch (e) { error.value = e instanceof Error ? e.message : '部门创建失败' } finally { saving.value = false } }
onMounted(load)
</script>
