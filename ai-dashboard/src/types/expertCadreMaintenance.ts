export type ExpertCadrePersonType = 'expert' | 'cadre'

export interface ExpertCadreCommonRecord {
  account: string
  employeeName: string
  positionAiMaturity: string
  isQualificationsStandard: boolean
  isCertStandard: boolean
}

export interface ExpertRecord extends ExpertCadreCommonRecord {
  origPositionGrade: number | null
  /** 由服务端维护，前端仅展示 */
  jobCategory: string
}

export interface CadreRecord extends ExpertCadreCommonRecord {
  miniDepartnameId: string
  cadreCompetenceCategory: string
  cadreType: string
  /** Y 表示 2026 年新上岗干部，N 表示否 */
  newOnJob: 'Y' | 'N'
  departname1: string
  departname2: string
  departname3: string
  departname4: string
  departname5: string
  l2DepartmentCode: string
  l3DepartmentCode: string
  l4DepartmentCode: string
  l5DepartmentCode: string
}

export type ExpertCadreRecord = ExpertRecord | CadreRecord

export interface ExpertCadreListParams {
  keyword?: string
  pageNum?: number
  pageSize?: number
}

export interface ExpertCadrePage<T extends ExpertCadreRecord = ExpertCadreRecord> {
  total: number
  rows: T[]
}
