import type { Result } from '@/types/dashboard'
import type { PageResult } from '@/types/manualCredit'
import type { UserConfigApi, UserConfigRecord } from '@/types/permission'
import { get, post, request } from '@/utils/request'

export interface FetchUserConfigListParams {
  pageNum?: number
  pageSize?: number
  account?: string
}

export function mapUserConfigApiToRecord(row: UserConfigApi): UserConfigRecord {
  return {
    id: row.id,
    account: row.account ?? '',
    employeeName: row.employeeName ?? '',
    asAdmin: row.asAdmin === true,
    canEditCredit: row.canEditCredit === true,
  }
}

function recordToPayload(record: UserConfigRecord) {
  return {
    account: record.account,
    asAdmin: record.asAdmin,
    canEditCredit: record.canEditCredit,
  }
}

export async function fetchUserConfigList(
  params: FetchUserConfigListParams = {},
): Promise<PageResult<UserConfigRecord>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const q = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (params.account?.trim()) {
    q.set('filterAccount', params.account.trim())
  }
  const res = await get<Result<PageResult<UserConfigApi>>>(`/user-config/list?${q.toString()}`)
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '查询失败')
  }
  return {
    total: res.data.total,
    rows: res.data.rows.map(mapUserConfigApiToRecord),
  }
}

export async function createUserConfig(record: UserConfigRecord): Promise<UserConfigRecord> {
  const res = await post<Result<UserConfigApi>>('/user-config', recordToPayload(record))
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '新增失败')
  }
  return mapUserConfigApiToRecord(res.data)
}

export async function updateUserConfig(id: number, record: UserConfigRecord): Promise<UserConfigRecord> {
  const res = await request.request<Result<UserConfigApi>>(`/user-config/${id}`, {
    method: 'PUT',
    body: JSON.stringify(recordToPayload(record)),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '更新失败')
  }
  return mapUserConfigApiToRecord(res.data)
}

export async function deleteUserConfig(id: number): Promise<void> {
  const res = await request.request<Result<boolean>>(`/user-config/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 200) {
    throw new Error(res.message || '删除失败')
  }
}
