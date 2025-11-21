export interface DepartmentInfo {
  deptCode: string
  deptName: string
  deptLevel: string
  parentDeptCode?: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

export interface DepartmentCertStatistic {
  deptCode: string
  deptName: string
  totalCount: number
  certifiedCount: number
  certRate: number
  qualifiedCount?: number
  qualifiedRate?: number
}

export interface EmployeeCertStatisticsResponse {
  departmentStatistics: DepartmentCertStatistic[]
  totalStatistics: DepartmentCertStatistic
}

export interface CompetenceCategoryCertStatistics {
  competenceCategory: string
  totalCount: number
  certifiedCount: number
  qualifiedCount: number
  certRate: number
  qualifiedRate: number
}

export interface CompetenceCategoryCertStatisticsResponse {
  deptCode: string
  deptName: string
  categoryStatistics: CompetenceCategoryCertStatistics[]
  totalStatistics: CompetenceCategoryCertStatistics
}

export interface CadreJobCategoryCertStatistics {
  jobCategory: string
  baselineCount: number
  certifiedCount: number
  certRate: number
  subject2PassCount: number
  subject2PassRate: number
}

export interface CadreMaturityCertStatistics {
  maturityLevel: string
  baselineCount: number
  certifiedCount: number
  certRate: number
  subject2PassCount: number
  subject2PassRate: number
  jobCategoryStatistics?: CadreJobCategoryCertStatistics[]
}

export interface CadreMaturityJobCategoryCertStatisticsResponse {
  deptCode: string
  deptName: string
  maturityStatistics: CadreMaturityCertStatistics[]
  totalStatistics: CadreMaturityCertStatistics
}

export interface CadreJobCategoryQualifiedStatistics {
  jobCategory: string
  baselineCount: number
  qualifiedCount: number
  qualifiedRate: number
}

export interface CadreMaturityQualifiedStatistics {
  maturityLevel: string
  baselineCount: number
  qualifiedCount: number
  qualifiedRate: number
  jobCategoryStatistics?: CadreJobCategoryQualifiedStatistics[]
}

export interface CadreMaturityJobCategoryQualifiedStatisticsResponse {
  deptCode: string
  deptName: string
  maturityStatistics: CadreMaturityQualifiedStatistics[]
  totalStatistics: CadreMaturityQualifiedStatistics
}
