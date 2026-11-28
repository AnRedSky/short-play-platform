<template>
  <AppPage
    context="PLUGINS / 内部插件中心"
    title="插件市场"
    description="浏览、安装、卸载与配置平台已登记的插件。按产品章程不开放第三方公网市场，安装只登记本机启停状态，不加载外部代码。"
  >
    <template #actions>
      <AppButton icon="search" @click="focusSearch">搜索插件</AppButton>
      <AppButton variant="ghost" @click="restore">恢复默认</AppButton>
    </template>

    <div class="stat-grid">
      <AppCard compact>
        <p class="stat-label">已安装</p>
        <p class="stat-value">{{ store.installedCount }}</p>
        <p class="stat-hint">共 {{ store.catalog.length }} 个登记插件</p>
      </AppCard>
      <AppCard compact>
        <p class="stat-label">已启用</p>
        <p class="stat-value">{{ store.enabledCount }}</p>
        <p class="stat-hint">停用后不出现在任务编排</p>
      </AppCard>
      <AppCard compact>
        <p class="stat-label">可安装</p>
        <p class="stat-value">{{ store.catalog.length - store.installedCount }}</p>
        <p class="stat-hint">由平台或内部团队维护</p>
      </AppCard>
    </div>

    <AppCard title="插件目录" subtitle="按分类与安装状态筛选，安装后可进入配置">
      <template #actions>
        <label class="search-field">
          <AppIcon name="search" :size="15" />
          <input ref="searchRef" v-model="keyword" class="search" placeholder="搜索插件名 / 提供方" aria-label="搜索插件" />
        </label>
      </template>

      <div class="filter-row">
        <div class="chips" role="group" aria-label="插件分类">
          <button
            v-for="chip in categoryChips"
            :key="chip.value"
            type="button"
            class="chip"
            :class="{ 'is-on': category === chip.value }"
            @click="category = chip.value"
          >
            {{ chip.label }}
            <span class="chip-count">{{ chip.count }}</span>
          </button>
        </div>
        <div class="chips" role="group" aria-label="安装状态">
          <button
            v-for="chip in statusChips"
            :key="chip.value"
            type="button"
            class="chip"
            :class="{ 'is-on': status === chip.value }"
            @click="status = chip.value"
          >
            {{ chip.label }}
          </button>
        </div>
      </div>

      <div v-if="visible.length" class="plugin-grid">
        <article v-for="item in visible" :key="item.id" class="plugin">
          <header class="plugin-head">
            <div class="plugin-title">
              <h3>{{ item.name }}</h3>
              <p>{{ item.vendor }} · v{{ item.version }} · {{ item.category }}</p>
            </div>
            <span class="pill" :class="stateTone(item.state)">
              {{ !item.state.installed ? '可安装' : item.state.enabled ? '已启用' : '已停用' }}
            </span>
          </header>

          <p class="plugin-summary">{{ item.summary }}</p>

          <div class="plugin-perms">
            <span class="perms-label">权限</span>
            <span v-for="perm in item.permissions" :key="perm" class="tag">{{ perm }}</span>
          </div>

          <footer class="plugin-foot">
            <span v-if="item.state.installed" class="plugin-time">安装于 {{ item.state.installedAt || '未记录' }}</span>
            <span v-else class="plugin-time">未安装</span>
            <span class="plugin-actions">
              <AppButton v-if="!item.state.installed" size="sm" variant="primary" @click="install(item)">安装</AppButton>
              <template v-else>
                <AppButton size="sm" @click="configure(item.id)">配置</AppButton>
                <AppButton size="sm" variant="ghost" @click="toggleEnabled(item)">{{ item.state.enabled ? '停用' : '启用' }}</AppButton>
                <AppButton size="sm" variant="danger" @click="remove(item)">卸载</AppButton>
              </template>
            </span>
          </footer>
        </article>
      </div>

      <div v-else class="empty">
        <b>没有匹配的插件</b>
        <p>调整分类、安装状态或清空搜索词再试。</p>
      </div>
    </AppCard>

    <AppDrawer :open="Boolean(configId)" :title="configTitle" subtitle="配置只影响本机编排，不改插件代码" @close="closeConfig">
      <div v-if="draft" class="config-form">
        <label class="field-line">
          <span>启用状态</span>
          <input v-model="draft.enabled" type="checkbox" class="switch" />
        </label>
        <label class="field-line">
          <span>并发上限</span>
          <input v-model.number="draft.concurrency" class="field" type="number" min="1" max="8" step="1" />
        </label>
        <p class="field-tip">并发 1–8，超过平台配额需要走运维审批。</p>
        <label class="field-line column">
          <span>备注</span>
          <textarea v-model="draft.note" class="field" rows="3" placeholder="记录用途或对接人，便于交接"></textarea>
        </label>
        <div class="config-actions">
          <AppButton variant="primary" @click="saveConfig">保存配置</AppButton>
          <AppButton variant="ghost" @click="closeConfig">取消</AppButton>
        </div>
      </div>
    </AppDrawer>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import AppPage from '../../components/ds/AppPage.vue'
import AppCard from '../../components/ds/AppCard.vue'
import AppButton from '../../components/ds/AppButton.vue'
import AppIcon from '../../components/ds/AppIcon.vue'
import AppDrawer from '../../components/ui/AppDrawer.vue'
import { usePluginsStore, type PluginConfig } from '../../stores/plugins'
import { useUiStore } from '../../stores/ui'

const store = usePluginsStore()
const ui = useUiStore()

const keyword = ref('')
const category = ref('')
const status = ref('')
const searchRef = ref<HTMLInputElement | null>(null)
const configId = ref('')

const draft = reactive<PluginConfig>({ enabled: true, concurrency: 2, note: '' })

const categoryChips = computed(() => {
  const cats = Array.from(new Set(store.catalog.map((item) => item.category)))
  return [
    { value: '', label: '全部分类', count: store.catalog.length },
    ...cats.map((cat) => ({
      value: cat,
      label: cat,
      count: store.catalog.filter((item) => item.category === cat).length,
    })),
  ]
})

const statusChips = [
  { value: '', label: '全部状态' },
  { value: 'installed', label: '已安装' },
  { value: 'available', label: '未安装' },
]

const visible = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return store.entries.filter((item) => {
    if (category.value && item.category !== category.value) return false
    if (status.value === 'installed' && !item.state.installed) return false
    if (status.value === 'available' && item.state.installed) return false
    if (!query) return true
    return `${item.name}${item.vendor}${item.summary}`.toLowerCase().includes(query)
  })
})

const configTitle = computed(() => {
  const hit = store.catalog.find((item) => item.id === configId.value)
  return hit ? `配置 · ${hit.name}` : '插件配置'
})

function stateTone(state: { installed: boolean; enabled: boolean }) {
  if (!state.installed) return 'outline'
  return state.enabled ? 'ok' : 'warn'
}

function focusSearch() {
  searchRef.value?.focus()
}

function install(item: { id: string; name: string }) {
  if (!store.install(item.id)) return
  ui.toast(`已安装 ${item.name}`, 'ok')
}

function toggleEnabled(item: { id: string; name: string; state: { enabled: boolean } }) {
  store.setEnabled(item.id, !item.state.enabled)
  ui.toast(`${item.name} 已${item.state.enabled ? '启用' : '停用'}`, 'ok')
}

async function remove(item: { id: string; name: string }) {
  const yes = await ui.confirm('卸载插件', `卸载「${item.name}」后，任务编排中不再可选，配置一并清除。`, true)
  if (!yes) return
  store.uninstall(item.id)
  ui.toast(`已卸载 ${item.name}`, 'ok')
}

function configure(id: string) {
  const state = store.stateOf(id)
  if (!state) return
  configId.value = id
  draft.enabled = state.enabled
  draft.concurrency = state.concurrency
  draft.note = state.note
}

function closeConfig() {
  configId.value = ''
}

function saveConfig() {
  store.saveConfig(configId.value, { enabled: draft.enabled, concurrency: draft.concurrency, note: draft.note })
  closeConfig()
  ui.toast('插件配置已保存', 'ok')
}

async function restore() {
  const yes = await ui.confirm('恢复默认插件状态', '安装、启停与配置都会回到初始值。', true)
  if (!yes) return
  store.reset()
  ui.toast('已恢复默认插件状态', 'ok')
}
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.stat-label {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ds-text-muted);
}

.stat-value {
  margin: var(--space-1) 0 0;
  font-size: 26px;
  font-weight: 700;
  color: var(--ds-text-primary);
}

.stat-hint {
  margin: var(--space-half) 0 0;
  font-size: 11.5px;
  color: var(--ds-text-disabled);
}

.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 240px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-s);
  background: var(--ds-surface-2);
  color: var(--ds-text-muted);
}

.search-field:focus-within {
  border-color: var(--ds-interactive);
  box-shadow: 0 0 0 3px var(--ds-focus-ring);
}

.search-field .search {
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  flex: 1;
}

.search-field .search:focus {
  outline: none;
  box-shadow: none;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  padding-bottom: var(--space-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-half);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-half);
  height: 28px;
  padding: 0 var(--space-1);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-pill);
  background: var(--ds-surface-2);
  color: var(--ds-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

.chip:hover {
  border-color: var(--ds-border-strong);
  color: var(--ds-text-primary);
}

.chip.is-on {
  border-color: var(--ds-interactive-line);
  background: var(--ds-interactive-soft);
  color: var(--accent-ink);
}

.chip-count {
  font-size: 10.5px;
  color: var(--ds-text-disabled);
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-2);
}

.plugin {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--ds-border);
  border-radius: var(--radius-m);
  background: var(--ds-surface-2);
  transition: border-color var(--motion-fast) var(--ease-out);
}

.plugin:hover {
  border-color: var(--ds-border-strong);
}

.plugin-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-1);
}

.plugin-title h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 660;
  color: var(--ds-text-primary);
}

.plugin-title p {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--ds-text-muted);
}

.plugin-summary {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--ds-text-secondary);
}

.plugin-perms {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-half);
}

.perms-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ds-text-disabled);
}

.plugin-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
  margin-top: auto;
  padding-top: var(--space-1);
  border-top: 1px solid var(--ds-border);
}

.plugin-time {
  font-size: 11px;
  color: var(--ds-text-disabled);
}

.plugin-actions {
  display: inline-flex;
  gap: var(--space-half);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 13px;
  color: var(--ds-text-secondary);
}

.field-line.column {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
}

.field-tip {
  margin: 0;
  font-size: 11.5px;
  color: var(--ds-text-disabled);
}

.config-actions {
  display: flex;
  gap: var(--space-1);
  padding-top: var(--space-1);
  border-top: 1px solid var(--ds-border);
}

.switch {
  width: 18px;
  height: 18px;
  accent-color: var(--ds-interactive);
}

@media (max-width: 1024px) {
.stat-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .search-field {
    width: 100%;
  }
}
</style>
