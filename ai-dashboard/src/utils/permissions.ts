import { get } from './request'

interface PermissionsResult {
  code: number
  message: string
  data: boolean
}

let inflightCheck: Promise<boolean> | null = null

/**
 * 校验当前用户是否在白名单内（合并并发请求，避免重复调用 permissions）
 */
export const checkUserPermissions = (): Promise<boolean> => {
  if (inflightCheck) {
    return inflightCheck
  }

  inflightCheck = get<PermissionsResult>('/user-config/permissions')
    .then((response) => {
      return response.code === 200 && response.data === true
    })
    .catch(() => {
      return false
    })
    .finally(() => {
      inflightCheck = null
    })

  return inflightCheck
}
