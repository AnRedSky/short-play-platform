<template>
  <section class="page">
    <PageHeader kicker="OPS / OVERVIEW" title="运维总览" desc="队列、服务、存储与任务积压的唯一视图；异常走 incident，不散落在页面。">
      <HeadActions>
        <button class="btn" @click="$router.push('/ops/queue')">队列明细</button>
        <button class="btn" @click="$router.push('/ops/logs')">日志</button>
        <button class="btn" v-if="session.can('platform.config')" @click="$router.push('/ops/config')">平台配置</button>
      </HeadActions>
    </PageHeader>

    <div class="grid grid-4">
      <div class="card stat-card"><small>队列积压</small><b>{{ queues.reduce((n, q) => n + Number(q.waiting || 0), 0) }}</b></div>
      <div class="card stat-card"><small>失败任务</small><b>{{ queues.reduce((n, q) => n + Number(q.failed || 0), 0) }}</b></div>
      <div class="card stat-card"><small>服务异常</small><b>{{ services.filter(s => s.status !== '正常').length }}</b></div>
      <div class="card stat-card"><small>事件</small><b>{{ incidents.filter(i => i.status !== '已关闭').length }}</b></div>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); margin-top: 18px">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">模型队列</h3></div>
          <DataTable
            :columns="[
              { key: 'name', label: '队列' },
              { key: 'provider', label: '提供方' },
              { key: 'running', label: '运行' },
              { key: 'waiting', label: '等待' },
              { key: 'failed', label: '失败' },
              { key: 'p95', label: 'P95（秒）' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="queues"
            row-key="name"
          />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">提供方</h3></div>
          <DataTable
            :columns="[
              { key: 'name', label: '提供方' },
              { key: 'kind', label: '类型' },
              { key: 'models', label: '模型数' },
              { key: 'sla', label: 'SLA' },
              { key: 'cost', label: '单价' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="providers"
            row-key="name"
          />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">服务状态</h3></div>
          <div v-for="service in services" :key="service.name" class="list-row">
            <span class="k">{{ service.name }}</span>
            <span class="v"><StatusPill :status="service.status" /> {{ service.note }}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">存储</h3></div>
          <dl class="kv-lite">
            <dt>对象存储</dt><dd>{{ storage.objects }}</dd>
            <dt>数据库</dt><dd>{{ storage.db }}</dd>
            <dt>缓存</dt><dd>{{ storage.cache }}</dd>
            <dt>水位</dt><dd>{{ storage.level }}</dd>
          </dl>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { http } from '../../api/client'
import { useSessionStore } from '../../stores/session'
import type { Row } from '../../mock/db'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable from '../../components/ui/DataTable.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const session = useSessionStore()
const payload = ref<Record<string, any>>({})

const queues = computed<Row[]>(() => payload.value.queues || [])
const services = computed<Row[]>(() => payload.value.services || [])
const providers = computed<Row[]>(() => payload.value.providers || [])
const storage = computed<Record<string, string>>(() => payload.value.storage || {})
const incidents = computed<Row[]>(() => payload.value.incidents || [])

async function load() {
  payload.value = await http.get<Record<string, any>>('/ops/overview')
}

onMounted(load)
</script>
