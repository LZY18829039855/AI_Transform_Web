/**
 * Cookie工具函数
 */

/**
 * 获取指定名称的cookie值
 * @param name cookie名称
 * @returns cookie值，如果不存在则返回null
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null
  }
  return null
}

/**
 * 从 Cookie `account` 中解析当前登录人 8 位数字工号（去掉首字母）。
 * 约定格式：首字母 + 8 位阿拉伯数字（如 `A12345678` → `12345678`）。
 * 用于 School 看板「个人数据总览」下钻等**未带 query.account** 的场景；若 URL 已带业务下发的工号（如姓名下钻），应直接使用 query，勿经此函数改写。
 * @returns 8 位数字工号，格式不正确则返回 null
 */
export function getUserIdFromAccount(): string | null {
  const account = getCookie('account')
  if (!account) {
    return null
  }

  // 校验格式：首字母 + 8位阿拉伯数字
  const accountPattern = /^[A-Za-z]\d{8}$/
  if (!accountPattern.test(account)) {
    console.warn('account cookie格式不正确，应为：首字母+8位数字，当前值：', account)
    return null
  }

  // 提取8位阿拉伯数字
  const digits = account.match(/\d{8}$/)
  if (digits && digits[0]) {
    return digits[0]
  }

  return null
}

/**
 * 获取用户头像URL
 * @returns 头像URL，如果无法获取工号则返回null
 */
export function getUserAvatarUrl(): string | null {
  const userId = getUserIdFromAccount()
  if (!userId) {
    return null
  }
  return `https://w3.huawei.com/w3lab/rest/yellowpage/face/${userId}/120`
}





