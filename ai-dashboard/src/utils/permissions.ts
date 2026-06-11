import { ElMessage } from 'element-plus'
import { ADMIN_ONLY_ROUTE_NAMES, MEMBER_DASHBOARD_TABS, NO_ACCESS_MESSAGE } from '@/constants/permissions'
import type { DashboardTabName } from '@/stores/modules/app'
import type { PermissionsResult, UserPermissionStatus } from '@/types/permission'
import { getUserIdFromAccount } from './cookie'
import { get } from './request'
import { resolveSessionAccount } from './userAccount'

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

const delay = (ms = 300) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms)
})

/** 登录前无 Cookie 时的无权限结果不缓存，避免自动登录后仍读到旧状态 */
const shouldCachePermissions = (permissions: UserPermissionStatus): boolean => {
  if (permissions.member) {
    return true
  }
  return getUserIdFromAccount() != null
}

/**
 * 获取当前用户权限状态（合并并发请求，结果短期缓存）
 */
export const fetchUserPermissions = (options?: { force?: boolean }): Promise<UserPermissionStatus> => {
  if (!options?.force && cachedPermissions) {
    return Promise.resolve(cachedPermissions)
  }

  if (!options?.force && inflightCheck) {
    return inflightCheck
  }

  inflightCheck = get<PermissionsResult>('/user-config/permissions')
    .then((response) => {
      const permissions = parsePermissionsResponse(response)
      if (response.code === 200 && response.data != null && shouldCachePermissions(permissions)) {
        cachedPermissions = permissions
      }
      return permissions
    })
    .catch(() => DENIED_PERMISSIONS)
    .finally(() => {
      inflightCheck = null
    })

  return inflightCheck
}

/**
 * 导航前获取权限：先等待会话就绪，无权限时短暂重试一次（兼容自动登录后 Cookie 延迟生效）
 */
export const fetchUserPermissionsForNavigation = async (): Promise<UserPermissionStatus> => {
  await resolveSessionAccount()
  let permissions = await fetchUserPermissions({ force: true })
  if (!permissions.member) {
    await delay(300)
    permissions = await fetchUserPermissions({ force: true })
  }
  return permissions
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
