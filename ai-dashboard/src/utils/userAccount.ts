import { get } from './request'
import { getUserIdFromAccount } from './cookie'
import type { Result } from '@/types/dashboard'

interface UserAccountResponse {
  empNum?: string
  w3Account?: string
}

/**
 * 解析当前会话用户工号：优先入参 → 浏览器 Cookie → 服务端 /user-config/account。
 * SPA 路由跳转时 Cookie 可能尚未随首个请求送达，通过服务端 account 接口兜底。
 */
export const resolveSessionAccount = async (account?: string): Promise<string | undefined> => {
  const trimmed = account?.trim()
  if (trimmed) {
    return trimmed
  }

  const fromClientCookie = getUserIdFromAccount()
  if (fromClientCookie) {
    return fromClientCookie
  }

  try {
    const response = await get<Result<UserAccountResponse>>('/user-config/account')
    if (response.code === 200 && response.data?.empNum?.trim()) {
      return response.data.empNum.trim()
    }
  } catch {
    // 忽略，由调用方处理无工号场景
  }

  return undefined
}
