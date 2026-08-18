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
