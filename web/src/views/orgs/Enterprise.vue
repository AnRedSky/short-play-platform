<template>
  <section class="page">
    <PageHeader kicker="ORGS / ENTERPRISE" title="企业管理" desc="企业级约束与项目级执行分离：企业只定规则与配额，项目内自行流转。">
      <HeadActions>
        <button class="btn" @click="$router.push('/orgs/roles')">角色与权限</button>
        <button class="btn" @click="$router.push('/orgs/grants')">项目授权</button>
      </HeadActions>
    </PageHeader>

    <div class="grid grid-4">
      <div class="card stat-card"><small>成员</small><b>{{ enterprise.members ?? '—' }}</b></div>
      <div class="card stat-card"><small>部门</small><b>{{ enterprise.depts ?? '—' }}</b></div>
      <div class="card stat-card"><small>在管项目</small><b>{{ enterprise.projects ?? '—' }}</b></div>
      <div class="card stat-card"><small>预算使用</small><b>{{ usedRatio }}%</b></div>
    </div>

    <div class="spec-grid" style="grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); margin-top: 18px">
      <div style="display: grid; gap: 14px">
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="card-title">{{ enterprise.name || '企业' }}</h3>
              <p class="card-sub">{{ enterprise.code }} · 管理员 {{ enterprise.admin }}</p>
            </div>
            <StatusPill :status="enterprise.status || '正常'" />
          </div>
          <p class="muted" style="font-size: 12px; line-height: 1.8">{{ enterprise.intro }}</p>
          <div class="budget-bar" style="margin-top: 10px">
            <span>预算 ¥{{ Number(enterprise.budget || 0).toLocaleString('zh-CN') }}</span>
            <div class="bar"><i :style="{ width: usedRatio + '%' }"></i></div>
            <span class="muted">已用 ¥{{ Number(enterprise.used || 0).toLocaleString('zh-CN') }}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3 class="card-title">企业级规则</h3><span class="card-sub">越线需管理员审批并留审计</span></div>
          <DataTable :columns="[{ key: 'name', label: '规则' }, { key: 'value', label: '取值' }, { key: 'note', label: '说明' }]" :rows="enterprise.policies || []" row-key="name" wide />
        </div>
      </div>

      <aside class="spec-side">
        <div class="card">
          <div class="card-head"><h3 class="card-title">组织入口</h3></div>
          <div class="list-row"><span class="k">部门与成员</span><span class="v"><button class="link-btn" @click="$router.push('/orgs/departments')">进入</button></span></div>
          <div class="list-row"><span class="k">角色权限</span><span class="v"><button class="link-btn" @click="$router.push('/orgs/roles')">进入</button></span></div>
          <div class="list-row"><span class="k">项目授权</span><span class="v"><button class="link-btn" @click="$router.push('/orgs/grants')">进入</button></span></div>
          <div class="list-row"><span class="k">交接</span><span class="v"><button class="link-btn" @click="$router.push('/orgs/handover')">进入</button></span></div>
        </div>
        <div class="card">
          <div class="card-head"><h3 class="card-title">边界声明</h3></div>
          <div class="checklist">
            <div class="ck"><i class="on">✓</i><span>企业规则不替代项目关卡</span></div>
            <div class="ck"><i class="on">✓</i><span>配额按企业 → 部门 → 项目逐级收窄</span></div>
            <div class="ck"><i class="on">✓</i><span>敏感操作双人复核</span></div>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { http } from '../../api/client'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'
import DataTable from '../../components/ui/DataTable.vue'
import StatusPill from '../../components/ui/StatusPill.vue'

const enterprise = ref<Record<string, any>>({})

const usedRatio = computed(() => Math.min(100, Math.round((Number(enterprise.value.used || 0) / Math.max(1, Number(enterprise.value.budget || 1))) * 100)))

async function load() {
  enterprise.value = await http.get<Record<string, any>>('/orgs/enterprise')
}

onMounted(load)
</script>
