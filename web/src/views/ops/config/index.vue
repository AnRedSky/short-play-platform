<template>
  <section class="page">
    <PageHeader kicker="OPS / CONFIG" title="平台配置" desc="参数、保留策略、适配器与备份在一处治理；改动留审计并按版本生效。">
      <HeadActions>
        <button class="btn" @click="$router.push('/ops/overview')">返回总览</button>
      </HeadActions>
    </PageHeader>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.3fr) minmax(320px, 1fr)">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head"><h3 class="card-title">平台参数</h3><span class="card-sub">{{ config.platformConfig?.length ?? 0 }} 项 · 需 platform.config 权限</span></div>
          <DataTable :columns="[{ key: 'key', label: '参数' }, { key: 'value', label: '取值' }, { key: 'note', label: '说明' }]" :rows="config.platformConfig || []" row-key="key" />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">模型适配器</h3></div>
          <DataTable
            :columns="[
              { key: 'name', label: '适配器', mono: true },
              { key: 'cap', label: '能力' },
              { key: 'vendor', label: '提供方' },
              { key: 'version', label: '版本' },
              { key: 'contract', label: '契约' },
              { key: 'status', label: '状态', pill: true },
            ]"
            :rows="config.adapters || []"
            row-key="name"
            wide
          />
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">数据保留</h3></div>
          <DataTable :columns="[{ key: 'object', label: '对象' }, { key: 'period', label: '保留期' }, { key: 'action', label: '到期动作' }, { key: 'note', label: '说明' }]" :rows="config.retention || []" row-key="object" />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">存储水位</h3></div>
          <dl class="kv-lite">
            <dt>总量 / 已用</dt><dd>{{ storage.total }} / {{ storage.used }}</dd>
            <dt>正式资产</dt><dd>{{ storage.formal }}</dd>
            <dt>临时素材</dt><dd>{{ storage.temp }}</dd>
            <dt>审计与日志</dt><dd>{{ storage.audit }}</dd>
            <dt>备份策略</dt><dd>{{ storage.backup }}</dd>
            <dt>校验失败</dt><dd>{{ storage.checksumFail }} 个</dd>
          </dl>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">最近备份</h3></div>
          <div v-for="item in config.backups || []" :key="item.target" class="list-row">
            <span class="k">{{ item.target }} · {{ item.size }}</span>
            <span class="v"><StatusPill :status="item.result" /> {{ item.at }}</span>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { opsApi } from '../../../services/ops'
import type { Row } from '../../../mock/db'
import { useSessionStore } from '../../../stores/session'
import PageHeader from '../../../components/ui/PageHeader.vue'
import HeadActions from '../../../components/ui/HeadActions.vue'
import DataTable from '../../../components/ui/DataTable.vue'
import StatusPill from '../../../components/ui/StatusPill.vue'

const session = useSessionStore()
const config = ref<Row>({})

const storage = computed<Record<string, string>>(() => config.value.storage || {})

async function load() {
  config.value = await opsApi.config()
  if (!session.can('platform.config')) {
    config.value.platformConfig = []
  }
}

onMounted(load)
</script>
