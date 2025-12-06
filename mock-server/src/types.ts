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

export interface EmployeeDetailVO {
  name: string
  employeeNumber: string
  competenceCategory?: string
  competenceSubcategory?: string
  firstLevelDept?: string
  secondLevelDept?: string
  thirdLevelDept?: string
  fourthLevelDept?: string
  fifthLevelDept?: string
  sixthLevelDept?: string
  certTitle?: string
  certStartTime?: string
  isPassedSubject2?: number
  isCadre?: number
  aiMaturity?: string
  miniDeptName?: string
  cadreType?: string
  competenceFamilyCn?: string
  competenceCategoryCn?: string
  competenceSubcategoryCn?: string
  directionCnName?: string
  competenceRatingCn?: string
  competenceGradeCn?: string
  competenceFrom?: string
  competenceTo?: string
}

export interface EmployeeDrillDownResponseVO {
  employeeDetails: EmployeeDetailVO[]
}

export interface StaffChartPoint {
  label: string
  count: number
  rate: number
}

export interface OverallCertificationTrendsResponse {
  departmentAppointment: StaffChartPoint[]
  organizationAppointment: StaffChartPoint[]
  jobCategoryAppointment: StaffChartPoint[]
  departmentCertification: StaffChartPoint[]
  organizationCertification: StaffChartPoint[]
  jobCategoryCertification: StaffChartPoint[]
}

export interface ExpertJobCategoryCertStatistics {
  jobCategory: string
  baselineCount: number
  certifiedCount: number
  certRate: number
}

export interface ExpertMaturityCertStatistics {
  maturityLevel: string
  baselineCount: number
  certifiedCount: number
  certRate: number
  jobCategoryStatistics?: ExpertJobCategoryCertStatistics[]
}

export interface ExpertAiCertStatisticsResponse {
  deptCode: string
  deptName: string
  maturityStatistics: ExpertMaturityCertStatistics[]
  totalStatistics: ExpertMaturityCertStatistics
}

export interface ExpertJobCategoryQualifiedStatistics {
  jobCategory: string
  baselineCount: number
  qualifiedCount: number
  qualifiedRate: number
  qualifiedByRequirementCount?: number
  qualifiedByRequirementRate?: number
}

export interface ExpertMaturityQualifiedStatistics {
  maturityLevel: string
  baselineCount: number
  qualifiedCount: number
  qualifiedRate: number
  qualifiedByRequirementCount?: number
  qualifiedByRequirementRate?: number
  jobCategoryStatistics?: ExpertJobCategoryQualifiedStatistics[]
}

export interface ExpertAiQualifiedStatisticsResponse {
  deptCode: string
  deptName: string
  maturityStatistics: ExpertMaturityQualifiedStatistics[]
  totalStatistics: ExpertMaturityQualifiedStatistics
}
