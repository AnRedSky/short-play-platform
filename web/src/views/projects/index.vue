<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">PROJECTS</p>
        <h1>项目管理</h1>
        <p class="muted">创建项目并管理短剧生产空间。</p>
      </div>
      <button class="primary-button" @click="showForm = !showForm">新建项目</button>
    </div>
    <form v-if="showForm" class="content-card form-grid" @submit.prevent="createProject">
      <label>项目编码<input v-model.trim="form.code" required minlength="2" maxlength="60" placeholder="例如：DRAMA_001"></label>
      <label>项目名称<input v-model.trim="form.title" required maxlength="200" placeholder="项目名称"></label>
      <label class="span-all">项目简介<textarea v-model="form.summary" maxlength="2000" rows="2"></textarea></label>
      <div class="span-all form-actions">
        <button class="primary-button" :disabled="saving">{{ saving ? '保存中…' : '创建项目' }}</button>
        <button type="button" class="secondary-button" @click="showForm = false">取消</button>
      </div>
    </form>
    <p v-if="error" class="error-text">{{ error }}</p>
    <div class="content-card">
      <div class="card-heading">
        <h2>项目列表</h2>
        <button class="secondary-button small" @click="load">刷新</button>
      </div>
      <div v-if="loading" class="empty-state">正在加载项目…</div>
      <div v-else-if="!projects.length" class="empty-state">暂无项目，创建第一个项目开始生产。</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>项目</th><th>编码</th><th>状态</th><th>项目 ID</th><th>工作区</th></tr></thead>
          <tbody>
            <tr v-for="p in projects" :key="p.id">
              <td><strong>{{ p.title }}</strong><small class="cell-sub">{{ p.summary || '暂无简介' }}</small></td>
              <td>{{ p.code }}</td>
              <td><span class="status-pill">{{ p.status }}</span></td>
              <td class="mono">{{ p.id }}</td>
              <td><RouterLink class="secondary-button small" :to="`/projects/${encodeURIComponent(p.id)}/stories`">进入项目</RouterLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { projectsApi } from '../../api/projects'
import type { Project } from '../../types/api'

const projects = ref<Project[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showForm = ref(false)
const form = reactive({ code: '', title: '', summary: '' })

async function load() {
  loading.value = true
  error.value = ''
  try {
    projects.value = (await projectsApi.list()).data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '项目加载失败'
  } finally {
    loading.value = false
  }
}

async function createProject() {
  saving.value = true
  error.value = ''
  try {
    await projectsApi.create({ ...form })
    form.code = ''
    form.title = ''
    form.summary = ''
    showForm.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '项目创建失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
