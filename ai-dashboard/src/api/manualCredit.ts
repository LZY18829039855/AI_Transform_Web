import type { Result } from '@/types/dashboard'
import type {
  ManualCreditImportRow,
  ManualEnterCreditApi,
  ManualEnterCreditBatchImportResult,
  ManualEnterCreditRecord,
  PageResult,
} from '@/types/manualCredit'
import { get, post, request } from '@/utils/request'

function mapImportRowsToApiPayload(rows: ManualCreditImportRow[]) {
  return rows.map((r) => ({
    employeeNumber: r.employee_number,
    employeeName: r.employee_name,
    creditType: r.credit_type,
    activityName: r.activity_name,
    activityDate: r.activity_date,
    credits: r.credits,
    description: r.description,
    attachmentUrl: r.attachment_url,
  }))
}

/** 单次请求体最大条数（与后端单次上限一致） */
const CHUNK_SIZE = 500

export function mapApiToTableRow(r: ManualEnterCreditApi): ManualEnterCreditRecord {
  return {
    id: r.id,
    employee_number: r.employeeNumber ?? '',
    employee_name: r.employeeName ?? '',
    credit_type: r.creditType ?? '',
    activity_name: r.activityName ?? '',
    activity_date: r.activityDate ?? null,
    credits: r.credits ?? '',
    description: r.description ?? '',
    attachment_url: r.attachmentUrl ?? '',
    create_time: r.createTime ?? null,
    update_time: r.updateTime ?? null,
    Modifier__number: r.modifierNumber ?? '',
  }
}

function recordToApiPayload(m: ManualEnterCreditRecord) {
  return {
    employeeNumber: m.employee_number,
    employeeName: m.employee_name,
    creditType: m.credit_type,
    activityName: m.activity_name,
    activityDate: m.activity_date,
    credits: m.credits,
    description: m.description,
    attachmentUrl: m.attachment_url,
  }
}

/** 与后端 ManualEnterCreditController 一致：pageNum、pageSize；可选工号/姓名模糊查询 */
export interface FetchManualEnterCreditListParams {
  pageNum?: number
  pageSize?: number
  employeeNumber?: string
  employeeName?: string
}

/**
 * 个人课程学分场景：与 /personal-course/completion 相同入参（account 可选，否则服务端从 Cookie 解析工号），
 * 复用 /manual-enter-credit/list 同一套查询逻辑。
 */
export interface FetchManualEnterCreditBySessionParams {
  pageNum?: number
  pageSize?: number
  /** 与 completion 的 account 一致；不传则由后端从 Cookie 解析 */
  account?: string
}

export async function fetchManualEnterCreditListBySession(
  params: FetchManualEnterCreditBySessionParams = {},
): Promise<PageResult<ManualEnterCreditRecord>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const q = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (params.account?.trim()) {
    q.set('account', params.account.trim())
  }
  const res = await get<Result<PageResult<ManualEnterCreditApi>>>(
    `/personal-course/manual-enter-credit-list?${q.toString()}`,
  )
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '查询失败')
  }
  return {
    total: res.data.total,
    rows: res.data.rows.map(mapApiToTableRow),
  }
}

/** 后端默认 pageSize=20，单页最大 200 */
export async function fetchManualEnterCreditList(
  params: FetchManualEnterCreditListParams = {},
): Promise<PageResult<ManualEnterCreditRecord>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const q = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  })
  if (params.employeeNumber?.trim()) {
    q.set('employeeNumber', params.employeeNumber.trim())
  }
  if (params.employeeName?.trim()) {
    q.set('employeeName', params.employeeName.trim())
  }
  const res = await get<Result<PageResult<ManualEnterCreditApi>>>(`/manual-enter-credit/list?${q.toString()}`)
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '查询失败')
  }
  return {
    total: res.data.total,
    rows: res.data.rows.map(mapApiToTableRow),
  }
}

export async function createManualEnterCredit(record: ManualEnterCreditRecord): Promise<ManualEnterCreditRecord> {
  const res = await post<Result<ManualEnterCreditApi>>('/manual-enter-credit', recordToApiPayload(record))
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '新增失败')
  }
  return mapApiToTableRow(res.data)
}

export async function updateManualEnterCredit(id: number, record: ManualEnterCreditRecord): Promise<ManualEnterCreditRecord> {
  const res = await request.request<Result<ManualEnterCreditApi>>(`/manual-enter-credit/${id}`, {
    method: 'PUT',
    body: JSON.stringify(recordToApiPayload(record)),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '更新失败')
  }
  return mapApiToTableRow(res.data)
}

export async function deleteManualEnterCredit(id: number): Promise<void> {
  const res = await request.request<Result<boolean>>(`/manual-enter-credit/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 200) {
    throw new Error(res.message || '删除失败')
  }
}

/**
 * 批量导入：按批请求后端 /batch-import，并回调进度（0–100）
 */
export async function batchImportManualCreditsWithProgress(
  rows: ManualCreditImportRow[],
  onProgress: (percent: number, label: string) => void,
): Promise<{ totalInserted: number }> {
  const total = rows.length
  if (total === 0) {
    return { totalInserted: 0 }
  }
  const chunks: ManualCreditImportRow[][] = []
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE))
  }
  let inserted = 0
  for (let ci = 0; ci < chunks.length; ci++) {
    onProgress(Math.round((ci / chunks.length) * 100), `正在提交第 ${ci + 1}/${chunks.length} 批（共 ${total} 条）…`)
    const body = { rows: mapImportRowsToApiPayload(chunks[ci]) }
    const res = await post<Result<ManualEnterCreditBatchImportResult>>('/manual-enter-credit/batch-import', body)
    if (res.code !== 200 || res.data == null) {
      throw new Error(res.message || '批量导入失败')
    }
    inserted += res.data.insertedCount ?? 0
    onProgress(Math.round(((ci + 1) / chunks.length) * 100), `已完成第 ${ci + 1}/${chunks.length} 批`)
  }
  onProgress(100, '导入完成')
  return { totalInserted: inserted }
}
