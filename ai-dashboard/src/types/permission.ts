export interface UserPermissionStatus {
  member: boolean
  asAdmin: boolean
  canEditCredit: boolean
}

export interface PermissionsResult {
  code: number
  message: string
  data: UserPermissionStatus | null
}

/** 权限配置角色：普通用户 / 管理员 / 超级用户 */
export type PermissionRole = 'member' | 'admin' | 'super'

/** 权限管理列表记录（与后端 UserConfigManageVO 对齐） */
export interface UserConfigRecord {
  id: number
  account: string
  employeeName: string
  asAdmin: boolean
  canEditCredit: boolean
}

export interface UserConfigApi {
  id: number
  account?: string
  employeeName?: string | null
  asAdmin?: boolean
  canEditCredit?: boolean
}

/** 部门成员候选项 */
export interface UserConfigDeptMember {
  account: string
  employeeName: string
  alreadyConfigured: boolean
}

export interface UserConfigDeptMemberApi {
  account?: string
  employeeName?: string | null
  alreadyConfigured?: boolean
}

/** 批量权限结果 */
export interface UserConfigBatchResult {
  createdCount: number
  updatedCount: number
  failedCount: number
  items: Array<{
    account: string
    status: 'created' | 'updated' | 'failed' | string
    message: string
  }>
}
