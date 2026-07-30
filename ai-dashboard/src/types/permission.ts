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
