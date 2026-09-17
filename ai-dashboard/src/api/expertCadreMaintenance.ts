import type { Result } from '@/types/dashboard'
import type {
  ExpertCadreListParams,
  ExpertCadrePage,
  ExpertCadrePersonType,
  ExpertCadreRecord,
} from '@/types/expertCadreMaintenance'
import { get, post, request } from '@/utils/request'

const basePath = '/expert-cadre-maintenance'

export async function fetchExpertCadreList<T extends ExpertCadreRecord>(
  personType: ExpertCadrePersonType,
  params: ExpertCadreListParams = {},
): Promise<ExpertCadrePage<T>> {
  const query = new URLSearchParams({
    keyword: params.keyword?.trim() ?? '',
    pageNum: String(params.pageNum ?? 1),
    pageSize: String(params.pageSize ?? 20),
  })
  const res = await get<Result<ExpertCadrePage<T>>>(
    `${basePath}/${personType}/list?${query.toString()}`,
  )
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '查询专家干部数据失败')
  }
  return {
    total: res.data.total ?? 0,
    rows: Array.isArray(res.data.rows) ? res.data.rows : [],
  }
}

export async function createExpertCadreRecord(
  personType: ExpertCadrePersonType,
  record: ExpertCadreRecord,
): Promise<void> {
  const res = await post<Result<unknown>>(`${basePath}/${personType}`, record)
  if (res.code !== 200) {
    throw new Error(res.message || '新增失败')
  }
}

export async function updateExpertCadreRecord(
  personType: ExpertCadrePersonType,
  account: string,
  record: ExpertCadreRecord,
): Promise<void> {
  const res = await request.request<Result<unknown>>(
    `${basePath}/${personType}/${encodeURIComponent(account)}`,
    {
      method: 'PUT',
      body: JSON.stringify(record),
    },
  )
  if (res.code !== 200) {
    throw new Error(res.message || '更新失败')
  }
}

export async function deleteExpertCadreRecord(
  personType: ExpertCadrePersonType,
  account: string,
): Promise<void> {
  const res = await request.request<Result<unknown>>(
    `${basePath}/${personType}/${encodeURIComponent(account)}`,
    { method: 'DELETE' },
  )
  if (res.code !== 200) {
    throw new Error(res.message || '删除失败')
  }
}
