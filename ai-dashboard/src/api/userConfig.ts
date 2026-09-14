import type { Result } from '@/types/dashboard'
import type { PageResult } from '@/types/manualCredit'
import type {
  PermissionRole,
  UserConfigApi,
  UserConfigBatchResult,
  UserConfigDeptMember,
  UserConfigDeptMemberApi,
  UserConfigRecord,
} from '@/types/permission'
import { get, post, request } from '@/utils/request'

export interface FetchUserConfigListParams {
  pageNum?: number
  pageSize?: number
  account?: string
  /** super / admin / member */
  role?: PermissionRole | ''
}

export interface FetchDeptMembersParams {
  deptId: string
  keyword?: string
  pageNum?: number
  pageSize?: number
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
  if (params.role) {
    q.set('filterRole', params.role)
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

export async function fetchUserConfigDeptMembers(
  params: FetchDeptMembersParams,
): Promise<PageResult<UserConfigDeptMember>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const q = new URLSearchParams({
    deptId: params.deptId,
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (params.keyword?.trim()) {
    q.set('keyword', params.keyword.trim())
  }
  const res = await get<Result<PageResult<UserConfigDeptMemberApi>>>(
    `/user-config/dept-members?${q.toString()}`,
  )
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '查询部门成员失败')
  }
  return {
    total: res.data.total,
    rows: (res.data.rows || []).map((row) => ({
      account: row.account ?? '',
      employeeName: row.employeeName ?? '',
      alreadyConfigured: row.alreadyConfigured === true,
    })),
  }
}

export async function batchUpsertUserConfig(payload: {
  accounts: string[]
  asAdmin: boolean
  canEditCredit: boolean
}): Promise<UserConfigBatchResult> {
  const res = await post<Result<UserConfigBatchResult>>('/user-config/batch', payload)
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '批量处理失败')
  }
  return {
    createdCount: res.data.createdCount ?? 0,
    updatedCount: res.data.updatedCount ?? 0,
    failedCount: res.data.failedCount ?? 0,
    items: res.data.items ?? [],
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
