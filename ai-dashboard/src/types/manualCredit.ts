/**
 * 与表 t_manual_enter_credit 对齐的手动录入学分记录（前端态）
 */
export interface ManualEnterCreditRecord {
  id: number
  employee_number: string
  employee_name: string
  credit_type: string
  activity_name: string
  /** 展示用 ISO 风格字符串，如 2026-04-09 12:00:00 */
  activity_date: string | null
  credits: string
  description: string
  attachment_url: string
  create_time: string | null
  update_time: string | null
  Modifier__number: string
}

/** Excel 导入行（无系统字段） */
export type ManualCreditImportRow = Omit<ManualEnterCreditRecord, 'id' | 'create_time' | 'update_time'>

/** 与后端 PageResult 对齐 */
export interface PageResult<T> {
  total: number
  rows: T[]
}

/** 后端接口驼峰字段（列表/详情） */
export interface ManualEnterCreditApi {
  id: number
  employeeNumber?: string
  employeeName?: string
  creditType?: string
  activityName?: string
  activityDate?: string | null
  credits?: string
  description?: string
  attachmentUrl?: string
  createTime?: string | null
  updateTime?: string | null
  modifierNumber?: string | null
}

export interface ManualEnterCreditBatchImportResult {
  insertedCount: number
}
