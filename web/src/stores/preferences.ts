import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

/**
 * 界面偏好：只存“用户看得见、能改变外壳行为”的开关。
 * 布局组件与设置页共用同一份状态，避免两处各记一份导致刷新后不一致。
 */
const NAV_COLLAPSED_KEY = 'sp_pref_nav_collapsed'
const REDUCE_MOTION_KEY = 'sp_pref_reduce_motion'

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === '1'
  } catch {
    return fallback
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* 隐私模式下写入失败不影响本次会话 */
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  /** 导航默认折叠：刷新后仍保持上一次的手动选择。 */
  const navCollapsed = ref(readFlag(NAV_COLLAPSED_KEY, false))
  /** 动效降级：关闭 300ms 过渡，供对动效敏感的用户使用。 */
  const reduceMotion = ref(readFlag(REDUCE_MOTION_KEY, false))

  watch(navCollapsed, (value) => writeFlag(NAV_COLLAPSED_KEY, value))
  watch(reduceMotion, (value) => writeFlag(REDUCE_MOTION_KEY, value))

  function toggleNav() {
    navCollapsed.value = !navCollapsed.value
  }

  function setReduceMotion(value: boolean) {
    reduceMotion.value = value
  }

  function reset() {
    navCollapsed.value = false
    reduceMotion.value = false
  }

  return { navCollapsed, reduceMotion, toggleNav, setReduceMotion, reset }
})
