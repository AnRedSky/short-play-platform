<template>
  <AppPage
    context="SETTINGS / 系统"
    title="设置"
    description="个人信息、账号安全与系统偏好。这里的开关会直接改变外壳行为，刷新后仍然生效。"
  >
    <template #actions>
      <AppButton icon="index" @click="indexOpen = true">打开功能索引</AppButton>
    </template>

    <div class="settings-grid">
      <AppCard title="个人信息设置" subtitle="当前登录身份的展示与切换">
        <div class="profile">
          <span class="profile-avatar">{{ session.identity?.avatar || session.shortName.slice(0, 1) }}</span>
          <div class="profile-main">
            <p class="profile-name">{{ session.name }}</p>
            <p class="profile-sub">{{ session.roleName }} · {{ session.identity?.dept || '未分配部门' }}</p>
          </div>
        </div>

        <dl class="facts">
          <dt>身份编号</dt>
          <dd>{{ session.identity?.id || '—' }}</dd>
          <dt>账号</dt>
          <dd>{{ session.identity?.userId || '—' }}</dd>
          <dt>权限项</dt>
          <dd>{{ session.permissions.length }} 项</dd>
        </dl>

        <label class="field-line">
          <span>切换身份</span>
          <select :value="session.identity?.id" class="field" @change="switchIdentity">
            <option v-for="identity in session.identities" :key="identity.id" :value="identity.id">{{ identity.name }}</option>
          </select>
        </label>
        <p class="field-tip">切换身份会同时刷新项目上下文与通知，便于验证不同角色的可见范围。</p>
      </AppCard>

      <AppCard title="账号安全设置" subtitle="登录方式与数据边界">
        <dl class="facts">
          <dt>登录方式</dt>
          <dd>本地身份令牌</dd>
          <dt>会话状态</dt>
          <dd>{{ session.ready ? '已建立' : '未建立' }}</dd>
          <dt>数据模式</dt>
          <dd>{{ isMock ? '模拟数据' : '真实后端' }}</dd>
          <dt>数据说明</dt>
          <dd>{{ isMock ? '接口契约与真实后端一致，切换数据模式即接真实后端。' : '当前读取真实后端数据。' }}</dd>
        </dl>

        <div class="danger-zone">
          <div>
            <b>重置验证数据</b>
            <p>把模拟数据恢复到初始验证状态，当前操作记录会丢失。</p>
          </div>
          <AppButton variant="danger" :loading="resetting" @click="resetMock">重置数据</AppButton>
        </div>
      </AppCard>

      <AppCard title="系统偏好配置" subtitle="影响导航与动效，立即生效">
        <div class="pref-row">
          <div>
            <b>导航默认折叠</b>
            <p>桌面端把左侧导航收成图标栏，主内容区自动扩宽。</p>
          </div>
          <button
            type="button"
            class="switch"
            role="switch"
            :aria-checked="prefs.navCollapsed"
            aria-label="导航默认折叠"
            :class="{ 'is-on': prefs.navCollapsed }"
            @click="prefs.toggleNav()"
          >
            <span class="switch-knob"></span>
          </button>
        </div>

        <div class="pref-row">
          <div>
            <b>降低动效</b>
            <p>关闭导航折叠与小屏抽屉的 300ms 过渡，改为即时切换。</p>
          </div>
          <button
            type="button"
            class="switch"
            role="switch"
            :aria-checked="prefs.reduceMotion"
            aria-label="降低动效"
            :class="{ 'is-on': prefs.reduceMotion }"
            @click="prefs.setReduceMotion(!prefs.reduceMotion)"
          >
            <span class="switch-knob"></span>
          </button>
        </div>

        <dl class="facts">
          <dt>主题</dt>
          <dd>暗色（全局统一，暂不提供切换）</dd>
          <dt>间距基准</dt>
          <dd>8px 栅格</dd>
          <dt>阴影层级</dt>
          <dd>静态卡片 / 悬浮层 / 抽屉弹窗</dd>
        </dl>

        <div class="pref-actions">
          <AppButton variant="ghost" @click="restorePrefs">恢复默认偏好</AppButton>
        </div>
      </AppCard>
    </div>

    <AppIndexDrawer :open="indexOpen" @close="indexOpen = false" />
  </AppPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppPage from '../../components/ds/AppPage.vue'
import AppCard from '../../components/ds/AppCard.vue'
import AppButton from '../../components/ds/AppButton.vue'
import AppIndexDrawer from '../../layouts/AppIndexDrawer.vue'
import { isMockMode } from '../../api'
import { http } from '../../api/client'
import { useInboxStore } from '../../stores/inbox'
import { usePreferencesStore } from '../../stores/preferences'
import { useProjectStore } from '../../stores/project'
import { useSessionStore } from '../../stores/session'
import { useUiStore } from '../../stores/ui'

const router = useRouter()
const session = useSessionStore()
const project = useProjectStore()
const inbox = useInboxStore()
const prefs = usePreferencesStore()
const ui = useUiStore()

const isMock = isMockMode
const resetting = ref(false)
const indexOpen = ref(false)

async function switchIdentity(event: Event) {
  await session.switchIdentity((event.target as HTMLSelectElement).value)
  ui.toast(`已切换为 ${session.name}`, 'ok')
  await project.load()
}

async function resetMock() {
  const yes = await ui.confirm('重置验证数据', '将把全部模拟数据恢复到初始验证状态，当前操作记录会丢失。', true)
  if (!yes) return
  resetting.value = true
  try {
    await http.post('/mock/reset')
    await session.login('i-owner')
    await project.load()
    await inbox.load()
    ui.toast('模拟数据已重置')
    router.push('/home')
  } finally {
    resetting.value = false
  }
}

function restorePrefs() {
  prefs.reset()
  ui.toast('已恢复默认偏好', 'ok')
}
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--space-3);
  align-items: start;
}

.profile {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--ds-border);
}

.profile-avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: var(--radius-pill);
  background: var(--ds-interactive-soft);
  border: 1px solid var(--ds-interactive-line);
  color: var(--accent-ink);
  font-size: 15px;
  font-weight: 700;
}

.profile-name {
  margin: 0;
  font-size: 15px;
  font-weight: 660;
  color: var(--ds-text-primary);
}

.profile-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ds-text-muted);
}

.facts {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: var(--space-1) var(--space-2);
  margin: var(--space-2) 0;
  font-size: 12.5px;
}

.facts dt {
  color: var(--ds-text-muted);
}

.facts dd {
  margin: 0;
  color: var(--ds-text-secondary);
}

.field-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: 13px;
  color: var(--ds-text-secondary);
}

.field-line > span {
  flex: none;
  white-space: nowrap;
}

.field-tip {
  margin: var(--space-1) 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ds-text-disabled);
}

.danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2);
  border: 1px dashed #5a2a2e;
  border-radius: var(--radius-m);
  background: var(--ds-danger-soft);
}

.danger-zone b {
  font-size: 13px;
  color: var(--ds-danger);
}

.danger-zone p {
  margin: var(--space-half) 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ds-text-muted);
}

.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--ds-border);
}

.pref-row b {
  font-size: 13px;
  font-weight: 640;
  color: var(--ds-text-primary);
}

.pref-row p {
  margin: var(--space-half) 0 0;
  max-width: 42ch;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ds-text-muted);
}

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex: none;
  padding: 0;
  border: 1px solid var(--ds-border-strong);
  border-radius: var(--radius-pill);
  background: var(--ds-surface-3);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}

.switch.is-on {
  border-color: var(--ds-interactive);
  background: var(--ds-interactive);
}

.switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-pill);
  background: var(--ds-text-secondary);
  transition:
    transform var(--motion-nav) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

.switch.is-on .switch-knob {
  transform: translateX(18px);
  background: var(--ds-on-interactive);
}

.pref-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

@media (max-width: 720px) {
.danger-zone {
    flex-direction: column;
    align-items: flex-start;
  }

  .pref-row {
    align-items: flex-start;
  }
}
</style>
