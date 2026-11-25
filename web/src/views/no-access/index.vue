<template>
  <section class="page">
    <PageHeader kicker="ACCESS / DENIED" title="当前身份无权访问该页面" :desc="`目标路径 ${fromPath} 需要权限 ${needed}；当前身份 ${session.name} 不具备。`">
      <HeadActions>
        <button class="btn" @click="$router.push('/workspace/home')">回工作台</button>
      </HeadActions>
    </PageHeader>

    <div class="card" style="max-width: 560px">
      <div class="card-head"><h3 class="card-title">切换身份继续</h3><span class="card-sub">mock 演示可直接切换，真实环境走 SSO</span></div>
      <div class="list-row" v-for="identity in candidates" :key="identity.id">
        <span class="k">{{ identity.name }}<em class="muted"> · {{ identity.dept }}</em></span>
        <span class="v"><button class="link-btn" @click="use(identity)">切换并打开</button></span>
      </div>
      <div v-if="!candidates.length" class="empty">没有其他身份可用于该页面</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import { http } from '../../api/client'
import PageHeader from '../../components/ui/PageHeader.vue'
import HeadActions from '../../components/ui/HeadActions.vue'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const project = useProjectStore()
const ui = useUiStore()

const fromPath = computed(() => String(route.query.from || '/workspace/home'))
const needed = computed(() => String(route.query.need || ''))
const permissions = ref<Record<string, string[]>>({})

const candidates = computed(() => session.identities.filter((identity) => {
  const list = permissions.value[identity.id] || []
  return !needed.value || list.includes(needed.value)
}))

async function loadPermissions() {
  const result = await http.list<{ id: string; permissions?: string[] }>('/identities')
  const map: Record<string, string[]> = {}
  for (const row of result.rows) map[row.id] = row.permissions || []
  permissions.value = map
}

async function use(identity: { id: string }) {
  await session.switchIdentity(identity.id)
  await project.load()
  ui.toast(`已切换为 ${session.name}`, 'ok')
  if (session.can(needed.value)) router.push(fromPath.value)
  else ui.toast('该身份仍无此权限', 'bad')
}

onMounted(async () => {
  if (!session.identities.length) await session.loadIdentities()
  await loadPermissions()
})
</script>
