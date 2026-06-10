import type { DashboardTabName } from '@/stores/modules/app'

/** 非管理员也可访问的看板 Tab */
export const MEMBER_DASHBOARD_TABS = new Set<DashboardTabName>(['training', 'school'])

/** 仅管理员可访问的路由 name */
export const ADMIN_ONLY_ROUTE_NAMES = new Set<string>([
  'MaturityDashboard',
  'TrainingDetail',
  'TrainingPlanningDetail',
  'SchoolDetail',
  'CertificationDashboard',
  'CertificationDetail',
  'ManualCreditManagement',
])

export const NO_ACCESS_MESSAGE = '暂无访问权限'
