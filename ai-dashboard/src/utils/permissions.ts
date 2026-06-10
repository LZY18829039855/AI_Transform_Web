import { ElMessage } from 'element-plus'
import { ADMIN_ONLY_ROUTE_NAMES, MEMBER_DASHBOARD_TABS, NO_ACCESS_MESSAGE } from '@/constants/permissions'
import type { DashboardTabName } from '@/stores/modules/app'
import type { PermissionsResult, UserPermissionStatus } from '@/types/permission'
import { get } from './request'

const DENIED_PERMISSIONS: UserPermissionStatus = {
  member: false,
  asAdmin: false,
}

let inflightCheck: Promise<UserPermissionStatus> | null = null
let cachedPermissions: UserPermissionStatus | null = null

const parsePermissionsResponse = (response: PermissionsResult): UserPermissionStatus => {
  if (response.code !== 200 || response.data == null) {
    return DENIED_PERMISSIONS
  }
  return {
    member: response.data.member === true,
    asAdmin: response.data.member === true && response.data.asAdmin === true,
  }
}

/**
 * 获取当前用户权限状态（合并并发请求，结果短期缓存）
 */
export const fetchUserPermissions = (options?: { force?: boolean }): Promise<UserPermissionStatus> => {
  if (!options?.force && cachedPermissions) {
    return Promise.resolve(cachedPermissions)
  }

  if (inflightCheck) {
    return inflightCheck
  }

  inflightCheck = get<PermissionsResult>('/user-config/permissions')
    .then((response) => {
      cachedPermissions = parsePermissionsResponse(response)
      return cachedPermissions
    })
    .catch(() => {
      cachedPermissions = DENIED_PERMISSIONS
      return cachedPermissions
    })
    .finally(() => {
      inflightCheck = null
    })

  return inflightCheck
}

/** 是否在白名单内 */
export const checkUserPermissions = async (): Promise<boolean> => {
  const permissions = await fetchUserPermissions()
  return permissions.member
}

/** 是否为管理员 */
export const isUserAdmin = async (): Promise<boolean> => {
  const permissions = await fetchUserPermissions()
  return permissions.asAdmin
}

export const clearPermissionsCache = (): void => {
  cachedPermissions = null
  inflightCheck = null
}

export const canAccessDashboardTab = (
  tab: DashboardTabName,
  permissions: UserPermissionStatus,
): boolean => {
  if (!permissions.member) {
    return false
  }
  if (MEMBER_DASHBOARD_TABS.has(tab)) {
    return true
  }
  return permissions.asAdmin
}

export const isAdminOnlyRoute = (routeName?: string | symbol | null): boolean => {
  if (routeName == null || typeof routeName !== 'string') {
    return false
  }
  return ADMIN_ONLY_ROUTE_NAMES.has(routeName)
}

export const canAccessRoute = (
  routeName: string | symbol | undefined | null,
  permissions: UserPermissionStatus,
): boolean => {
  if (!permissions.member) {
    return false
  }
  if (!isAdminOnlyRoute(routeName)) {
    return true
  }
  return permissions.asAdmin
}

/** 非管理员操作时提示并返回 false */
export const guardAdminAccess = async (): Promise<boolean> => {
  const permissions = await fetchUserPermissions()
  if (!permissions.asAdmin) {
    ElMessage.warning(NO_ACCESS_MESSAGE)
    return false
  }
  return true
}
