import type {
  DepartmentCertStatistic,
  AppointmentAuditRecord,
  CadreAppointmentSummaryRow,
  CadreCertificationSummaryRow,
  CadreMaturityJobCategoryCertStatisticsResponse,
  CadreMaturityJobCategoryQualifiedStatisticsResponse,
  CertificationAuditRecord,
  CertificationDashboardData,
  CertificationDashboardFilters,
  CertificationDetailData,
  CertificationDetailFilters,
  CertificationItem,
  CompetenceCategoryCertStatisticsResponse,
  CourseItem,
  DepartmentInfoVO,
  DepartmentNode,
  EmployeeCertStatisticsResponse,
  ExpertAppointmentSummaryRow,
  ExpertCertificationSummaryRow,
  MetricItem,
  Result,
  SchoolDashboardData,
  SchoolDashboardFilters,
  SchoolDetailData,
  SchoolDetailFilters,
  StaffChartPoint,
  TrendPoint,
  TrainingAllStaffSummaryGroup,
  TrainingDashboardData,
  TrainingDashboardFilters,
  TrainingExpertCadreSummary,
  TrainingDetailData,
  TrainingDetailFilters,
  TrainingBattleRecord,
  TrainingCoursePlanRecord,
  TrainingPlanningResource,
  TrainingRole,
  TrainingRoleSummaryRow,
  TrainingTask,
} from '../types/dashboard'
import { get } from '../utils/request'

const delay = (ms = 320) => new Promise((resolve) => window.setTimeout(resolve, ms))

const resolveDepartmentCode = (deptPath?: string[]) => {
  if (!deptPath || deptPath.length === 0) {
    return '0'
  }
  const last = deptPath[deptPath.length - 1]
  return last && last.trim().length ? last : '0'
}

const mapDepartmentCertStatsToCharts = (stats?: DepartmentCertStatistic[]) => {
  if (!stats || stats.length === 0) {
    return null
  }

  const resolveQualifiedCount = (item: DepartmentCertStatistic) =>
    item.qualifiedCount ?? item.certifiedCount ?? 0
  const resolveQualifiedRate = (item: DepartmentCertStatistic) =>
    Number(item.qualifiedRate ?? item.certRate ?? 0)

  const normalizeLabel = (name?: string, code?: string) => {
    if (name && name.trim().length) {
      return name
    }
    if (code && code.trim().length) {
      return code
    }
    return '未知部门'
  }

  return {
    appointment: stats.map((item) => ({
      label: normalizeLabel(item.deptName, item.deptCode),
      count: item.totalCount ?? 0,
      rate: Number(item.certRate ?? 0),
    })),
    certification: stats.map((item) => ({
      label: normalizeLabel(item.deptName, item.deptCode),
      count: resolveQualifiedCount(item),
      rate: resolveQualifiedRate(item),
    })),
  }
}

const fetchEmployeeCertStatistics = async (
  deptCode: string,
  personType: string
): Promise<EmployeeCertStatisticsResponse | null> => {
  try {
    const query = new URLSearchParams({
      deptCode: deptCode || '0',
      personType: personType || '0',
    })
    const response = await get<Result<EmployeeCertStatisticsResponse>>(
      `/expert-cert-statistics/employee-cert-statistics?${query.toString()}`
    )
    if (response.code === 200) {
      return response.data
    }
    console.warn('获取员工任职/认证数据失败：', response.message)
    return null
  } catch (error) {
    console.error('获取员工任职/认证数据异常：', error)
    return null
  }
}

export const fetchCompetenceCategoryCertStatistics = async (
  deptCode: string,
  personType: string
): Promise<CompetenceCategoryCertStatisticsResponse | null> => {
  try {
    const query = new URLSearchParams({
      deptCode: deptCode || '0',
      personType: personType || '0',
    })
    const response = await get<Result<CompetenceCategoryCertStatisticsResponse>>(
      `/expert-cert-statistics/competence-category-cert-statistics?${query.toString()}`
    )
    if (response.code === 200) {
      return response.data
    }
    console.warn('获取职位类任职/认证数据失败：', response.message)
    return null
  } catch (error) {
    console.error('获取职位类任职/认证数据异常：', error)
    return null
  }
}

export const fetchCadreMaturityJobCategoryCertStatistics = async (
  deptCode: string
): Promise<CadreMaturityJobCategoryCertStatisticsResponse | null> => {
  try {
    const query = new URLSearchParams({
      deptCode: deptCode || '0',
    })
    const response = await get<Result<CadreMaturityJobCategoryCertStatisticsResponse>>(
      `/expert-cert-statistics/cadre-cert-statistics/by-maturity-and-job-category?${query.toString()}`
    )
    if (response.code === 200) {
      return response.data
    }
    console.warn('获取干部认证数据失败：', response.message)
    return null
  } catch (error) {
    console.error('获取干部认证数据异常：', error)
    return null
  }
}

export const fetchCadreMaturityJobCategoryQualifiedStatistics = async (
  deptCode: string
): Promise<CadreMaturityJobCategoryQualifiedStatisticsResponse | null> => {
  try {
    const query = new URLSearchParams({
      deptCode: deptCode || '0',
    })
    const response = await get<Result<CadreMaturityJobCategoryQualifiedStatisticsResponse>>(
      `/expert-cert-statistics/cadre-cert-statistics/by-maturity-and-job-category-qualified?${query.toString()}`
    )
    if (response.code === 200) {
      return response.data
    }
    console.warn('获取干部任职数据失败：', response.message)
    return null
  } catch (error) {
    console.error('获取干部任职数据异常：', error)
    return null
  }
}

export const fetchMaturityMetrics = async (): Promise<MetricItem[]> => {
  return []
}

export const fetchMaturityTrend = async (): Promise<TrendPoint[]> => {
  return []
}

export const fetchTrainingTasks = async (): Promise<TrainingTask[]> => {
  return []
}

export const fetchCourses = async (): Promise<CourseItem[]> => {
  return []
}

export const fetchCertifications = async (): Promise<CertificationItem[]> => {
  return []
}

export const fetchCertificationDetail = async (id: string): Promise<CertificationItem | undefined> => {
  const list = await fetchCertifications()
  return list.find((item) => item.id === id)
}

export const fetchCertificationDashboard = async (
  _filters?: CertificationDashboardFilters
): Promise<CertificationDashboardData> => {
  await delay()
  const deptCode = resolveDepartmentCode(_filters?.departmentPath)
  const personType = _filters?.role ?? '0'
  const [expertData, cadreData, allStaffData, deptTree, employeeCertStats, competenceCategoryStats, cadreCertStats, cadreQualifiedStats] =
    await Promise.all([
      fetchExpertCertificationSummary(),
      fetchCadreCertificationSummary(),
      fetchOverallCertificationTrends(),
      fetchDepartmentTree(),
      fetchEmployeeCertStatistics(deptCode, personType),
      fetchCompetenceCategoryCertStatistics(deptCode, personType),
      fetchCadreMaturityJobCategoryCertStatistics(deptCode),
      fetchCadreMaturityJobCategoryQualifiedStatistics(deptCode),
    ])

  const departmentCharts = mapDepartmentCertStatsToCharts(employeeCertStats?.departmentStatistics)

  // 将职位类统计数据转换为图表数据格式
  const mapCompetenceCategoryToCharts = (
    stats?: CompetenceCategoryCertStatisticsResponse
  ): { appointment: StaffChartPoint[]; certification: StaffChartPoint[] } | null => {
    if (!stats || !stats.categoryStatistics || stats.categoryStatistics.length === 0) {
      return null
    }

    return {
      appointment: stats.categoryStatistics.map((item) => ({
        label: item.competenceCategory,
        count: item.qualifiedCount ?? 0,
        rate: Number(item.qualifiedRate ?? 0),
      })),
      certification: stats.categoryStatistics.map((item) => ({
        label: item.competenceCategory,
        count: item.certifiedCount ?? 0,
        rate: Number(item.certRate ?? 0),
      })),
    }
  }

  const jobCategoryCharts = mapCompetenceCategoryToCharts(competenceCategoryStats ?? undefined)

  // 将干部认证数据转换为表格格式
  const mapCadreCertStatsToRows = (
    stats?: CadreMaturityJobCategoryCertStatisticsResponse | null
  ): (CadreCertificationSummaryRow & { isMaturityRow?: boolean })[] => {
    if (!stats || !stats.maturityStatistics || stats.maturityStatistics.length === 0) {
      return cadreData.certification
    }

    const rows: (CadreCertificationSummaryRow & { isMaturityRow?: boolean })[] = []

    // 遍历每个成熟度等级
    stats.maturityStatistics.forEach((maturity) => {
      // 如果有职位类统计，先添加成熟度行（跨两列显示），然后为每个职位类创建一行
      if (maturity.jobCategoryStatistics && maturity.jobCategoryStatistics.length > 0) {
        // 先添加成熟度行（跨两列显示，使用成熟度级别的汇总数据）
        rows.push({
          maturityLevel: maturity.maturityLevel,
          jobCategory: '',
          baseline: maturity.baselineCount,
          aiCertificateHolders: maturity.certifiedCount,
          subjectTwoPassed: maturity.subject2PassCount,
          certificateRate: Number(maturity.certRate),
          subjectTwoRate: Number(maturity.subject2PassRate),
          complianceRate: Number(maturity.certRate),
          isMaturityRow: true, // 标记为成熟度行
        })

        // 为每个职位类创建一行
        maturity.jobCategoryStatistics.forEach((jobCategory) => {
          rows.push({
            maturityLevel: '', // 成熟度列为空
            jobCategory: jobCategory.jobCategory,
            baseline: jobCategory.baselineCount,
            aiCertificateHolders: jobCategory.certifiedCount,
            subjectTwoPassed: jobCategory.subject2PassCount,
            certificateRate: Number(jobCategory.certRate),
            subjectTwoRate: Number(jobCategory.subject2PassRate),
            complianceRate: Number(jobCategory.certRate),
            isMaturityRow: false, // 标记为职位类行
          })
        })
      } else {
        // 如果没有职位类统计，只添加成熟度级别的汇总行（跨两列显示）
        rows.push({
          maturityLevel: maturity.maturityLevel,
          jobCategory: '',
          baseline: maturity.baselineCount,
          aiCertificateHolders: maturity.certifiedCount,
          subjectTwoPassed: maturity.subject2PassCount,
          certificateRate: Number(maturity.certRate),
          subjectTwoRate: Number(maturity.subject2PassRate),
          complianceRate: Number(maturity.certRate),
          isMaturityRow: true, // 标记为成熟度行
        })
      }
    })

    // 添加总计行（跨两列显示）
    if (stats.totalStatistics) {
      rows.push({
        maturityLevel: stats.totalStatistics.maturityLevel,
        jobCategory: '',
        baseline: stats.totalStatistics.baselineCount,
        aiCertificateHolders: stats.totalStatistics.certifiedCount,
        subjectTwoPassed: stats.totalStatistics.subject2PassCount,
        certificateRate: Number(stats.totalStatistics.certRate),
        subjectTwoRate: Number(stats.totalStatistics.subject2PassRate),
        complianceRate: Number(stats.totalStatistics.certRate),
        isMaturityRow: true, // 标记为成熟度行
      })
    }

    return rows.length > 0 ? rows : cadreData.certification
  }

  const cadreCertificationRows = mapCadreCertStatsToRows(cadreCertStats)

  // 将干部任职数据转换为表格格式
  const mapCadreQualifiedStatsToRows = (
    stats?: CadreMaturityJobCategoryQualifiedStatisticsResponse | null
  ): (CadreAppointmentSummaryRow & { isMaturityRow?: boolean })[] => {
    if (!stats || !stats.maturityStatistics || stats.maturityStatistics.length === 0) {
      return cadreData.appointment
    }

    const rows: (CadreAppointmentSummaryRow & { isMaturityRow?: boolean })[] = []

    // 遍历每个成熟度等级（仅L2和L3）
    stats.maturityStatistics.forEach((maturity) => {
      // 如果有职位类统计，先添加成熟度行，然后为每个职位类创建一行
      if (maturity.jobCategoryStatistics && maturity.jobCategoryStatistics.length > 0) {
        // 先添加成熟度行（使用成熟度级别的汇总数据）
        rows.push({
          maturityLevel: maturity.maturityLevel,
          jobCategory: '',
          baseline: maturity.baselineCount,
          appointed: maturity.qualifiedCount,
          appointedByRequirement: maturity.qualifiedCount, // 按要求任职人数暂时使用任职人数
          appointmentRate: Number(maturity.qualifiedRate),
          certificationCompliance: Number(maturity.qualifiedRate), // 按要求认证人数占比暂时使用任职率
          isMaturityRow: true, // 标记为成熟度行
        })

        // 为每个职位类创建一行
        maturity.jobCategoryStatistics.forEach((jobCategory) => {
          rows.push({
            maturityLevel: '', // 成熟度列为空
            jobCategory: jobCategory.jobCategory,
            baseline: jobCategory.baselineCount,
            appointed: jobCategory.qualifiedCount,
            appointedByRequirement: jobCategory.qualifiedCount, // 按要求任职人数暂时使用任职人数
            appointmentRate: Number(jobCategory.qualifiedRate),
            certificationCompliance: Number(jobCategory.qualifiedRate), // 按要求认证人数占比暂时使用任职率
            isMaturityRow: false, // 标记为职位类行
          })
        })
      } else {
        // 如果没有职位类统计，只添加成熟度级别的汇总行
        rows.push({
          maturityLevel: maturity.maturityLevel,
          jobCategory: '',
          baseline: maturity.baselineCount,
          appointed: maturity.qualifiedCount,
          appointedByRequirement: maturity.qualifiedCount, // 按要求任职人数暂时使用任职人数
          appointmentRate: Number(maturity.qualifiedRate),
          certificationCompliance: Number(maturity.qualifiedRate), // 按要求认证人数占比暂时使用任职率
          isMaturityRow: true, // 标记为成熟度行
        })
      }
    })

    // 添加总计行
    if (stats.totalStatistics) {
      rows.push({
        maturityLevel: stats.totalStatistics.maturityLevel,
        jobCategory: '',
        baseline: stats.totalStatistics.baselineCount,
        appointed: stats.totalStatistics.qualifiedCount,
        appointedByRequirement: stats.totalStatistics.qualifiedCount, // 按要求任职人数暂时使用任职人数
        appointmentRate: Number(stats.totalStatistics.qualifiedRate),
        certificationCompliance: Number(stats.totalStatistics.qualifiedRate), // 按要求认证人数占比暂时使用任职率
        isMaturityRow: true, // 标记为成熟度行
      })
    }

    return rows.length > 0 ? rows : cadreData.appointment
  }

  const cadreAppointmentRows = mapCadreQualifiedStatsToRows(cadreQualifiedStats)

  return {
    metrics: [],
    expertCertification: expertData.certification,
    expertAppointment: expertData.appointment,
    cadreCertification: cadreCertificationRows,
    cadreAppointment: cadreAppointmentRows,
    allStaff: {
      departmentAppointment: departmentCharts?.appointment?.length
        ? departmentCharts.appointment
        : allStaffData.departmentAppointment,
      organizationAppointment: allStaffData.organizationAppointment,
      jobCategoryAppointment: jobCategoryCharts?.appointment?.length
        ? jobCategoryCharts.appointment
        : allStaffData.jobCategoryAppointment,
      departmentCertification: departmentCharts?.certification?.length
        ? departmentCharts.certification
        : allStaffData.departmentCertification,
      organizationCertification: allStaffData.organizationCertification,
      jobCategoryCertification: jobCategoryCharts?.certification?.length
        ? jobCategoryCharts.certification
        : allStaffData.jobCategoryCertification,
    },
    employeeCertStatistics: employeeCertStats ?? null,
    competenceCategoryCertStatistics: competenceCategoryStats ?? null,
    filters: {
      departmentTree: deptTree,
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
    },
  }
}

export const fetchCertificationDetailData = async (
  id: string,
  _filters?: CertificationDetailFilters
): Promise<CertificationDetailData> => {
  await delay()
  const [auditData, deptTree] = await Promise.all([fetchCertificationAuditRecords(), fetchDepartmentTree()])

  return {
    summary: {
      id,
      name: '',
      level: '',
      participants: 0,
      passRate: 0,
      status: '',
      updatedAt: '',
    },
    certificationRecords: auditData.certificateAudits,
    appointmentRecords: auditData.appointmentAudits,
    filters: {
      departmentTree: deptTree,
      jobFamilies: ['技术类', '管理类', '业务类'],
      jobCategories: ['AI 架构师', '数据科学家', '算法专家', '营销干部', '运营干部', '客服干部'],
      jobSubCategories: ['CV', 'NLP', '流程优化', '渠道拓展'],
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
      maturityOptions: [
        { label: '全部', value: '全部' },
        { label: 'L1', value: 'L1' },
        { label: 'L2', value: 'L2' },
        { label: 'L3', value: 'L3' },
      ],
    },
  }
}

export const fetchCourseDetail = async (id: string): Promise<CourseItem | undefined> => {
  const list = await fetchCourses()
  return list.find((item) => item.id === id)
}

export const fetchTrainingDetail = async (
  _id: string,
  _filters?: TrainingDetailFilters
): Promise<TrainingDetailData> => {
  await delay()
  const [deptTree] = await Promise.all([fetchDepartmentTree()])

  const records: TrainingBattleRecord[] = []

  const coursePlans: TrainingCoursePlanRecord[] = []

  return {
    records,
    coursePlans,
    filters: {
      departmentTree: deptTree,
      jobFamilies: ['技术类', '管理类', '业务类'],
      jobCategories: ['算法专家', '数据科学家', '运营干部', '营销干部', '基层主管', '产品经理'],
      jobSubCategories: ['CV', 'NLP', '流程优化', '渠道拓展', '服务运营', '智能产品'],
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
      maturityOptions: [
        { label: '全部', value: '全部' },
        { label: 'L1', value: 'L1' },
        { label: 'L2', value: 'L2' },
        { label: 'L3', value: 'L3' },
      ],
    },
  }
}

export const fetchTrainingDashboard = async (
  filters?: TrainingDashboardFilters
): Promise<TrainingDashboardData> => {
  await delay()
  const departmentTree = await fetchDepartmentTree()
  const role: TrainingRole = (filters?.role ?? '0')

  const personalOverview: any[] = []

  const expertSummary: TrainingRoleSummaryRow[] = []

  const cadreSummary: TrainingRoleSummaryRow[] = []

  const expertCadreSummary: TrainingExpertCadreSummary = {
    title: '',
    dimensionLabel: '',
    rows: [],
  }

  const allStaffGroups: TrainingAllStaffSummaryGroup[] = []

  const planningResources: TrainingPlanningResource[] = []

  return {
    personalOverview,
    expertSummary,
    cadreSummary,
    expertCadreSummary,
    allStaffSummary: {
      role,
      groups: allStaffGroups,
    },
    planningResources,
    filters: {
      departmentTree,
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
    },
  }
}

export const fetchDepartmentTree = async (): Promise<DepartmentNode[]> => {
  return []
}

export const fetchExpertCertificationSummary = async (): Promise<{
  certification: ExpertCertificationSummaryRow[]
  appointment: ExpertAppointmentSummaryRow[]
}> => {
  return {
    certification: [],
    appointment: [],
  }
}

export const fetchCadreCertificationSummary = async (): Promise<{
  certification: CadreCertificationSummaryRow[]
  appointment: CadreAppointmentSummaryRow[]
}> => {
  return {
    certification: [],
    appointment: [],
  }
}

export const fetchOverallCertificationTrends = async (): Promise<{
  departmentAppointment: StaffChartPoint[]
  organizationAppointment: StaffChartPoint[]
  jobCategoryAppointment: StaffChartPoint[]
  departmentCertification: StaffChartPoint[]
  organizationCertification: StaffChartPoint[]
  jobCategoryCertification: StaffChartPoint[]
}> => {
  return {
    departmentAppointment: [],
    organizationAppointment: [],
    jobCategoryAppointment: [],
    departmentCertification: [],
    organizationCertification: [],
    jobCategoryCertification: [],
  }
}

export const fetchCertificationAuditRecords = async (): Promise<{
  certificateAudits: CertificationAuditRecord[]
  appointmentAudits: AppointmentAuditRecord[]
}> => {
  return {
    certificateAudits: [],
    appointmentAudits: [],
  }
}

export const fetchSchoolDashboard = async (
  _filters?: SchoolDashboardFilters
): Promise<SchoolDashboardData> => {
  await delay()
  const [deptTree] = await Promise.all([fetchDepartmentTree()])

  return {
    personalOverview: {
      targetCredits: 0,
      currentCredits: 0,
      completionRate: 0,
      benchmarkRate: 0,
      scheduleTarget: 0,
      expectedCompletionDate: '',
      status: '',
      statusType: 'success',
    },
    expertSummary: [],
    cadreSummary: [],
    allStaffSummary: {
      role: '0',
      groups: [],
    },
    filters: {
      departmentTree: deptTree,
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
    },
  }
}

export const fetchSchoolDetailData = async (
  _id: string,
  _filters?: SchoolDetailFilters
): Promise<SchoolDetailData> => {
  await delay()
  const [deptTree] = await Promise.all([fetchDepartmentTree()])

  return {
    records: [],
    rules: [],
    filters: {
      departmentTree: deptTree,
      jobFamilies: [],
      jobCategories: [],
      jobSubCategories: [],
      roles: [
        { label: '全员', value: '0' },
        { label: '干部', value: '1' },
        { label: '专家', value: '2' },
        { label: '基层主管', value: '3' },
      ],
      maturityOptions: [
        { label: '全部', value: '全部' },
        { label: 'L1', value: 'L1' },
        { label: 'L2', value: 'L2' },
        { label: 'L3', value: 'L3' },
      ],
    },
  }
}

/**
 * 根据部门ID查询子部门列表
 * @param deptId 部门ID（部门编码），为空或"0"时查询一级部门
 * @returns 子部门列表
 */
const departmentChildrenCache = new Map<string, DepartmentInfoVO[]>()
const departmentChildrenPromises = new Map<string, Promise<DepartmentInfoVO[]>>()

export const fetchDepartmentChildren = (
  deptId: string | number = '0',
  options?: { force?: boolean }
): Promise<DepartmentInfoVO[]> => {
  const cacheKey = String(deptId)
  if (!options?.force) {
    if (departmentChildrenCache.has(cacheKey)) {
      return Promise.resolve(departmentChildrenCache.get(cacheKey)!)
    }
    if (departmentChildrenPromises.has(cacheKey)) {
      return departmentChildrenPromises.get(cacheKey)!
    }
  }

  const requestPromise = (async () => {
    try {
      const response = await get<Result<DepartmentInfoVO[]>>(
        `/department-info/children?deptId=${deptId}`
      )
      if (response.code === 200 && response.data) {
        departmentChildrenCache.set(cacheKey, response.data)
        return response.data
      }
      throw new Error(response.message || '查询部门数据失败')
    } catch (error) {
      console.error('获取部门子节点失败:', error)
      throw error
    } finally {
      departmentChildrenPromises.delete(cacheKey)
    }
  })()

  departmentChildrenPromises.set(cacheKey, requestPromise)
  return requestPromise
}
