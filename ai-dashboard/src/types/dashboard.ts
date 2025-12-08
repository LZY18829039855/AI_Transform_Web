export type TrendType = 'up' | 'down' | 'flat'

export interface MetricItem {
  id: string
  title: string
  value: number
  unit?: string
  delta?: number
  trend?: TrendType
}

export interface TrendPoint {
  label: string
  value: number
}

export interface TrainingTask {
  id: string
  name: string
  owner: string
  status: '进行中' | '待启动' | '已完成'
  progress: number
  dataset: string
  updatedAt: string
}

export type RoleValue = '0' | '1' | '2' | '3'

export type TrainingRole = RoleValue

export interface TrainingPlanningResource {
  id: string
  title: string
  owner: string
  updatedAt: string
  downloadUrl: string
  description?: string
}

export interface TrainingPersonalOverviewRow {
  classification: string
  courseTotal: number
  targetCompleted: number
  actualCompleted: number
  completionRate: number
}

export interface TrainingRoleSummaryRow {
  maturityLevel: string
  personCount: number
  beginnerCourses: number
  intermediateCourses: number
  advancedCourses: number
  practiceCourses: number
  beginnerAvgLearners: number
  intermediateAvgLearners: number
  advancedAvgLearners: number
  practiceAvgLearners: number
  beginnerCompletionRate: number
  intermediateCompletionRate: number
  advancedCompletionRate: number
  practiceCompletionRate: number
}

export interface TrainingExpertCadreSummaryRow {
  dimension: string
  personCount: number
  beginnerCourses: number
  intermediateCourses: number
  advancedCourses: number
  practiceCourses: number
  beginnerAvgLearners: number
  intermediateAvgLearners: number
  advancedAvgLearners: number
  practiceAvgLearners: number
  beginnerCompletionRate: number
  intermediateCompletionRate: number
  advancedCompletionRate: number
  practiceCompletionRate: number
}

export interface TrainingExpertCadreSummary {
  title: string
  dimensionLabel: string
  rows: TrainingExpertCadreSummaryRow[]
}

export interface TrainingAllStaffSummaryRow {
  dimension: string
  baseline: number
  beginnerCourses: number
  intermediateCourses: number
  advancedCourses: number
  practiceCourses: number
  beginnerAvgLearners: number
  intermediateAvgLearners: number
  advancedAvgLearners: number
  practiceAvgLearners: number
  beginnerCompletionRate: number
  intermediateCompletionRate: number
  advancedCompletionRate: number
  practiceCompletionRate: number
}

export interface TrainingAllStaffSummaryGroup {
  title: string
  dimensionLabel: string
  rows: TrainingAllStaffSummaryRow[]
}

export interface TrainingDashboardFilters {
  departmentPath?: string[]
  role?: TrainingRole
}

export interface TrainingDashboardData {
  personalOverview: TrainingPersonalOverviewRow[]
  expertSummary: TrainingRoleSummaryRow[]
  cadreSummary: TrainingRoleSummaryRow[]
  expertCadreSummary: TrainingExpertCadreSummary
  allStaffSummary: {
    role: TrainingRole
    groups: TrainingAllStaffSummaryGroup[]
  }
  planningResources: TrainingPlanningResource[]
  filters: {
    departmentTree: DepartmentNode[]
    roles: SelectOption<TrainingRole>[]
  }
}

export interface TrainingBattleRecord {
  id: string
  name: string
  employeeId: string
  jobFamily: string
  jobCategory: string
  jobSubCategory: string
  departmentPath: string[]
  departmentLevel1: string
  departmentLevel2: string
  departmentLevel3: string
  departmentLevel4: string
  departmentLevel5: string
  departmentLevel6: string
  minDepartment: string
  trainingCategory: string
  courseCategory: string
  courseName: string
  isTargetCourse: boolean
  isCompleted: boolean
  completionDate?: string
  isCadre: boolean
  cadreType?: string
  isExpert: boolean
  isFrontlineManager: boolean
  organizationMaturity: 'L1' | 'L2' | 'L3'
  positionMaturity: 'L1' | 'L2' | 'L3'
}

export interface TrainingCoursePlanRecord {
  id: string
  trainingCategory: string
  courseName: string
  courseCode: string
  targetAudience: string
  credits: number
  courseUrl: string
}

export interface TrainingDetailData {
  records: TrainingBattleRecord[]
  coursePlans: TrainingCoursePlanRecord[]
  filters: {
    departmentTree: DepartmentNode[]
    jobFamilies: string[]
    jobCategories: string[]
    jobSubCategories: string[]
    roles: SelectOption<TrainingRole>[]
    maturityOptions: SelectOption<'全部' | 'L1' | 'L2' | 'L3'>[]
  }
}

export interface TrainingDetailFilters {
  departmentPath?: string[]
  jobFamily?: string
  jobCategory?: string
  jobSubCategory?: string
  role?: TrainingRole
  positionMaturity?: '全部' | 'L1' | 'L2' | 'L3'
}

export interface CourseItem {
  id: string
  title: string
  category: string
  learners: number
  completionRate: number
  updatedAt: string
}

export interface CertificationItem {
  id: string
  name: string
  level: '初级' | '中级' | '高级'
  participants: number
  passRate: number
  status: '报名中' | '进行中' | '已结束'
  updatedAt: string
}

export interface DepartmentNode {
  label: string
  value: string
  children?: DepartmentNode[]
  disabled?: boolean // 是否禁用该节点
}

export interface ExpertCertificationSummaryRow {
  maturityLevel: string
  jobCategory: string
  baseline: number
  certified: number
  certificationRate: number
}

export interface ExpertAppointmentSummaryRow {
  maturityLevel: string
  jobCategory: string
  baseline: number
  appointed: number
  appointedByRequirement: number
  appointmentRate: number
  certificationCompliance: number
}

export interface CadreCertificationSummaryRow {
  maturityLevel: string
  jobCategory: string
  baseline: number
  aiCertificateHolders: number
  subjectTwoPassed: number
  certificateRate: number
  subjectTwoRate: number
  certStandardCount?: number
  complianceRate: number
}

export interface CadreAppointmentSummaryRow {
  maturityLevel: string
  jobCategory: string
  baseline: number
  appointed: number
  appointedByRequirement: number
  appointmentRate: number
  certificationCompliance: number
}

export type CertificationRole = RoleValue

export interface OverallCertificationTrendRow {
  role: CertificationRole
  dimension: string
  category: string
  appointed: number
  appointedRate: number
  certified: number
  certifiedRate: number
}

export interface CertificationAuditRecord {
  id: string
  name: string
  employeeId: string
  positionCategory: string
  positionSubCategory: string
  departmentLevel1: string
  departmentLevel2: string
  departmentLevel3: string
  departmentLevel4: string
  departmentLevel5: string
  departmentLevel6?: string
  minDepartment: string
  certificateName: string
  certificateEffectiveDate: string
  subjectTwoPassed: boolean
  isCadre: boolean
  cadreType?: string
  isExpert?: boolean
  isFrontlineManager?: boolean
  organizationMaturity?: 'L1' | 'L2' | 'L3'
  positionMaturity?: 'L1' | 'L2' | 'L3'
  requiredCertificate: string
  isQualified?: boolean
  isCertStandard?: boolean
}

export interface AppointmentAuditRecord {
  id: string
  name: string
  employeeId: string
  positionCategory: string
  positionSubCategory: string
  departmentLevel1: string
  departmentLevel2: string
  departmentLevel3: string
  departmentLevel4: string
  departmentLevel5: string
  departmentLevel6: string
  minDepartment: string
  professionalCategory: string
  expertCategory: string
  professionalSubCategory: string
  qualificationDirection: string
  qualificationLevel: string
  acquisitionMethod: string
  effectiveDate: string
  expiryDate: string
  isCadre: boolean
  cadreType?: string
  isExpert?: boolean
  isFrontlineManager?: boolean
  organizationMaturity?: 'L1' | 'L2' | 'L3'
  positionMaturity?: 'L1' | 'L2' | 'L3'
  requiredCertificate?: string
  isQualified?: boolean
}

export interface StaffChartPoint {
  label: string
  count: number
  rate: number
  deptCode?: string // 部门编码，用于点击跳转
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
  certStandardCount?: number
  certStandardRate?: number
}

export interface CadreMaturityCertStatistics {
  maturityLevel: string
  baselineCount: number
  certifiedCount: number
  certRate: number
  subject2PassCount: number
  subject2PassRate: number
  certStandardCount?: number
  certStandardRate?: number
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
  qualifiedByRequirementCount?: number
  qualifiedByRequirementRate?: number
}

export interface CadreMaturityQualifiedStatistics {
  maturityLevel: string
  baselineCount: number
  qualifiedCount: number
  qualifiedRate: number
  qualifiedByRequirementCount?: number
  qualifiedByRequirementRate?: number
  jobCategoryStatistics?: CadreJobCategoryQualifiedStatistics[]
}

export interface CadreMaturityJobCategoryQualifiedStatisticsResponse {
  deptCode: string
  deptName: string
  maturityStatistics: CadreMaturityQualifiedStatistics[]
  totalStatistics: CadreMaturityQualifiedStatistics
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

export interface SelectOption<T extends string> {
  label: string
  value: T
}

export type SchoolRole = RoleValue

export interface SchoolPersonalOverview {
  targetCredits: number
  currentCredits: number
  completionRate: number
  benchmarkRate: number
  scheduleTarget: number
  expectedCompletionDate: string
  status: '正常' | '轻度预警' | '滞后预警'
  statusType: 'success' | 'warning' | 'danger'
}

export interface SchoolRoleSummaryRow {
  maturityLevel: string
  baseline: number
  maxCredits: number
  minCredits: number
  averageCredits: number
  targetCredits: number
  completionRate: number
  scheduleTarget: number
  status: '正常' | '轻度预警' | '滞后预警'
  statusType: 'success' | 'warning' | 'danger'
}

export interface SchoolAllStaffSummaryRow {
  dimension: string
  baseline: number
  maxCredits: number
  minCredits: number
  averageCredits: number
  targetCredits: number
  completionRate: number
  scheduleTarget: number
  status: '正常' | '轻度预警' | '滞后预警'
  statusType: 'success' | 'warning' | 'danger'
}

export interface SchoolAllStaffSummaryGroup {
  title: string
  dimensionLabel: string
  rows: SchoolAllStaffSummaryRow[]
}

export interface SchoolAllStaffSummary {
  role: SchoolRole
  groups: SchoolAllStaffSummaryGroup[]
}

export interface SchoolDashboardData {
  personalOverview: SchoolPersonalOverview
  expertSummary: SchoolRoleSummaryRow[]
  cadreSummary: SchoolRoleSummaryRow[]
  allStaffSummary: SchoolAllStaffSummary
  filters: {
    departmentTree: DepartmentNode[]
    roles: SelectOption<SchoolRole>[]
  }
}

export interface SchoolDashboardFilters {
  departmentPath?: string[]
  role?: SchoolRole
}

export interface SchoolCreditRecord {
  id: string
  name: string
  employeeId: string
  jobFamily: string
  jobCategory: string
  jobSubCategory: string
  departmentPath: string[]
  departmentLevel1: string
  departmentLevel2: string
  departmentLevel3: string
  departmentLevel4: string
  departmentLevel5: string
  departmentLevel6?: string
  minDepartment: string
  isCadre: boolean
  cadreType?: string
  isExpert: boolean
  isFrontlineManager: boolean
  organizationMaturity: 'L1' | 'L2' | 'L3'
  positionMaturity: 'L1' | 'L2' | 'L3'
  currentCredits: number
  completionRate: number
  benchmarkRate: number
  completionDate: string
  scheduleTarget: number
  status: '正常' | '轻度预警' | '滞后预警'
  statusType: 'success' | 'warning' | 'danger'
}

export interface SchoolRuleRecord {
  id: string
  sourceType: string
  content: string
  credits: number
}

export interface SchoolDetailData {
  records: SchoolCreditRecord[]
  rules: SchoolRuleRecord[]
  filters: {
    departmentTree: DepartmentNode[]
    jobFamilies: string[]
    jobCategories: string[]
    jobSubCategories: string[]
    roles: SelectOption<SchoolRole>[]
    maturityOptions: SelectOption<'全部' | 'L1' | 'L2' | 'L3'>[]
  }
}

export interface SchoolDetailFilters {
  departmentPath?: string[]
  jobFamily?: string
  jobCategory?: string
  jobSubCategory?: string
  role?: SchoolRole
  positionMaturity?: '全部' | 'L1' | 'L2' | 'L3'
}

export interface CertificationDashboardFilters {
  departmentPath?: string[]
  role?: CertificationRole
}

export interface CertificationDashboardData {
  metrics: MetricItem[]
  expertCertification: ExpertCertificationSummaryRow[]
  expertAppointment: ExpertAppointmentSummaryRow[]
  cadreCertification: CadreCertificationSummaryRow[]
  cadreAppointment: CadreAppointmentSummaryRow[]
  allStaff: {
    departmentAppointment: StaffChartPoint[]
    organizationAppointment: StaffChartPoint[]
    jobCategoryAppointment: StaffChartPoint[]
    departmentCertification: StaffChartPoint[]
    organizationCertification: StaffChartPoint[]
    jobCategoryCertification: StaffChartPoint[]
  }
  employeeCertStatistics?: EmployeeCertStatisticsResponse | null
  competenceCategoryCertStatistics?: CompetenceCategoryCertStatisticsResponse | null
  filters: {
    departmentTree: DepartmentNode[]
    roles: SelectOption<CertificationRole>[]
  }
}

export interface CertificationDetailFilters {
  departmentPath?: string[]
  jobFamily?: string
  jobCategory?: string
  jobSubCategory?: string
  role?: CertificationRole
  maturity?: '全部' | 'L1' | 'L2' | 'L3'
  name?: string
  employeeId?: string
}

export interface CertificationDetailData {
  summary: CertificationItem | null
  certificationRecords: CertificationAuditRecord[]
  appointmentRecords: AppointmentAuditRecord[]
  filters: {
    departmentTree: DepartmentNode[]
    jobFamilies: string[]
    jobCategories: string[]
    jobSubCategories: string[]
    roles: SelectOption<CertificationRole>[]
    maturityOptions: SelectOption<'全部' | 'L1' | 'L2' | 'L3'>[]
  }
}

/**
 * 后端统一响应结果
 */
export interface Result<T> {
  code: number
  message: string
  data: T
}

/**
 * 部门信息VO（对应后端 DepartmentInfoVO）
 */
export interface DepartmentInfoVO {
  deptCode: string
  deptName: string
  deptLevel: string
  parentDeptCode?: string
  children?: DepartmentInfoVO[]
}

/**
 * 员工详细信息VO（对应后端 EmployeeDetailVO）
 */
export interface EmployeeDetailVO {
  name?: string
  employeeNumber?: string
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
  isQualificationsStandard?: number
  isCertStandard?: number
}

/**
 * 员工下钻查询响应VO（对应后端 EmployeeDrillDownResponseVO）
 */
export interface EmployeeDrillDownResponseVO {
  employeeDetails?: EmployeeDetailVO[]
}

