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
 * 从 Cookie `account` 中解析当前登录人 8 位数字工号（去掉字母前缀等）。
 * 兼容：纯 8 位数字、`字母+8位数字`、多字母前缀+8 位数字、以及仅含数字且长度≥8 时取末 8 位等。
 * 看板下钻可在跳转前调用以写入 query；详情页无 query 时也会兜底调用。
 * @returns 8 位数字工号，无法解析则返回 null
 */
export function getUserIdFromAccount(): string | null {
  const raw = getCookie('account')
  if (!raw) {
    return null
  }
  let account = raw.trim()
  if (!account) {
    return null
  }
  try {
    account = decodeURIComponent(account)
  } catch {
    /* 保持原样 */
  }
  account = account.trim()

  /** 纯 8 位数字工号 */
  if (/^\d{8}$/.test(account)) {
    return account
  }

  /**
   * 前缀为字母、末尾恰好 8 位数字（兼容单字母/多字母前缀，如 w12345678、AB12345678）
   */
  const letterThen8 = account.match(/^([A-Za-z]+)(\d{8})$/)
  if (letterThen8 && letterThen8[2]) {
    return letterThen8[2]
  }

  const allDigits = account.replace(/\D/g, '')
  if (allDigits.length >= 8) {
    return allDigits.slice(-8)
  }

  console.warn('account cookie 无法解析出 8 位工号，当前值：', raw)
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





