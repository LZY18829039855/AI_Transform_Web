import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DASHBOARD_TABS } from '@/constants/tabs'
import type { DashboardTabName } from '@/stores/modules/app'
import { useAppStore } from '@/stores/modules/app'

export const useDashboardTabs = () => {
  const route = useRoute()
  const router = useRouter()
  const appStore = useAppStore()

  const activeTab = computed({
    get: () => appStore.activeTab,
    set: (value: DashboardTabName) => {
      appStore.setActiveTab(value)
      const target = DASHBOARD_TABS.find((tab) => tab.name === value)
      if (target) {
        router.push(target.route)
      }
    },
  })

  watch(
    () => route.path,
    (path) => {
      const matched = DASHBOARD_TABS.find((tab) => path.startsWith(tab.route))
      if (matched) {
        appStore.setActiveTab(matched.name)
      }
    },
    { immediate: true }
  )

  let navigating = false

  const goTo = async (tab: DashboardTabName) => {
    if (navigating) {
      return
    }
    const target = DASHBOARD_TABS.find((item) => item.name === tab)
    if (!target) {
      return
    }
    navigating = true
    try {
      appStore.setActiveTab(tab)
      await router.push(target.route)
    } catch (error) {
      console.error('跳转看板失败：', error)
    } finally {
      navigating = false
    }
  }

  return {
    activeTab,
    tabs: DASHBOARD_TABS,
    goTo,
  }
}

