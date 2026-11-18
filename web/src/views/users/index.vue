<template>
  <section class="page"><div class="page-heading"><div><p class="eyebrow">IDENTITY</p><h1>用户管理</h1><p class="muted">查看组织用户并创建新成员账号。</p></div><button class="primary-button" @click="showForm = !showForm">添加用户</button></div>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="createUser"><label>姓名<input v-model.trim="form.full_name" required maxlength="200"></label><label>企业邮箱<input v-model.trim="form.email" type="email" required maxlength="320"></label><label>初始密码<input v-model="form.password" type="password" required minlength="8"></label><div class="span-all form-actions"><button class="primary-button" :disabled="saving">{{ saving ? '创建中…' : '创建账号' }}</button><button type="button" class="secondary-button" @click="showForm = false">取消</button></div></form>
    <p v-if="error" class="error-text">{{ error }}</p><div class="content-card"><div class="card-heading"><h2>组织成员</h2><button class="secondary-button small" @click="load">刷新</button></div><div v-if="loading" class="empty-state">正在加载…</div><div v-else-if="!users.length" class="empty-state">暂无用户记录。</div><div v-else class="table-wrap"><table><thead><tr><th>成员</th><th>邮箱</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="u in users" :key="u.id"><td><strong>{{ u.full_name }}</strong></td><td>{{ u.email }}</td><td><span class="status-pill" :class="{ inactive: !u.is_active }">{{ u.is_active ? '正常' : '已禁用' }}</span></td><td><button class="text-action" @click="toggle(u)">{{ u.is_active ? '禁用账号' : '启用账号' }}</button></td></tr></tbody></table></div></div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { usersApi } from '../../api/users'
import type { User } from '../../types/api'
const users = ref<User[]>([]); const loading = ref(false); const saving = ref(false); const error = ref(''); const showForm = ref(false)
const form = reactive({ full_name: '', email: '', password: '' })
async function load() { loading.value = true; error.value = ''; try { users.value = (await usersApi.list()).data } catch (e) { error.value = e instanceof Error ? e.message : '用户加载失败' } finally { loading.value = false } }
async function createUser() { saving.value = true; error.value = ''; try { await usersApi.create({ ...form }); form.full_name = ''; form.email = ''; form.password = ''; showForm.value = false; await load() } catch (e) { error.value = e instanceof Error ? e.message : '用户创建失败' } finally { saving.value = false } }
async function toggle(user: User) { try { await usersApi.update(user.id, { is_active: !user.is_active }); await load() } catch (e) { error.value = e instanceof Error ? e.message : '用户更新失败' } }
onMounted(load)
</script>
