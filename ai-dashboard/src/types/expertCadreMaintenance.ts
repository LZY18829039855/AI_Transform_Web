export type ExpertCadrePersonType = 'expert' | 'cadre'

export interface ExpertCadreCommonRecord {
  account: string
  name: string
  positionAiMaturity: string
  /** Y 表示新上岗，N 表示否 */
  newOnJob: 'Y' | 'N'
}

export interface ExpertRecord extends ExpertCadreCommonRecord {
  origPositionGrade: number | null
  origPositionName: string
}

export interface CadreRecord extends ExpertCadreCommonRecord {
  miniDepartnameId: string
  cadreCompetenceCategory: string
  cadreType: string
  departname1: string
  departname2: string
  departname3: string
  departname4: string
  departname5: string
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
