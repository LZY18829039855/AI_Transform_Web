<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { Medal, QuestionFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  fetchCertificationDashboard,
  fetchExpertData,
  fetchCadreData,
  fetchAllStaffTrends,
  fetchDepartmentStats,
  fetchJobCategoryStats,
  fetchDashboardFilters,
} from '@/api/dashboard'
import { normalizeRoleOptions } from '@/constants/roles'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import StatCard from '@/components/common/StatCard.vue'
import CertificationSummaryTable from '@/components/dashboard/CertificationSummaryTable.vue'
import BarLineChart from '@/components/dashboard/BarLineChart.vue'
import type {
  CertificationDashboardData,
  CertificationDashboardFilters,
  CompetenceCategoryCertStatistics,
  DepartmentCertStatistic,
  StaffChartPoint,
  ExpertCertificationSummaryRow,
  ExpertAppointmentSummaryRow,
  CadreCertificationSummaryRow,
  CadreAppointmentSummaryRow,
  EmployeeCertStatisticsResponse,
  CompetenceCategoryCertStatisticsResponse,
  DepartmentNode,
  SelectOption,
  CertificationRole,
} from '@/types/dashboard'

const router = useRouter()

// 各个数据块的独立loading状态
const loadingExpert = ref(false)
const loadingCadre = ref(false)
const loadingAllStaffTrends = ref(false)
const loadingDepartmentStats = ref(false)
const loadingJobCategoryStats = ref(false)
const loadingFilters = ref(false)

// 各个数据块的数据
const expertData = ref<{
  certification: (ExpertCertificationSummaryRow & { isMaturityRow?: boolean })[]
  appointment: ExpertAppointmentSummaryRow[]
} | null>(null)
const cadreData = ref<{
  certification: (CadreCertificationSummaryRow & { isMaturityRow?: boolean })[]
  appointment: (CadreAppointmentSummaryRow & { isMaturityRow?: boolean })[]
} | null>(null)
const allStaffTrends = ref<{
  departmentAppointment: StaffChartPoint[]
  organizationAppointment: StaffChartPoint[]
  jobCategoryAppointment: StaffChartPoint[]
  departmentCertification: StaffChartPoint[]
  organizationCertification: StaffChartPoint[]
  jobCategoryCertification: StaffChartPoint[]
} | null>(null)
const departmentStats = ref<{
  departmentAppointment: StaffChartPoint[]
  departmentCertification: StaffChartPoint[]
  employeeCertStatistics: EmployeeCertStatisticsResponse | null
} | null>(null)
const jobCategoryStats = ref<{
  jobCategoryAppointment: StaffChartPoint[]
  jobCategoryCertification: StaffChartPoint[]
  competenceCategoryCertStatistics: CompetenceCategoryCertStatisticsResponse | null
} | null>(null)
const dashboardFilters = ref<{
  departmentTree: DepartmentNode[]
  roles: SelectOption<CertificationRole>[]
} | null>(null)

// 为了兼容现有代码，保留dashboardData的computed属性
const dashboardData = computed<CertificationDashboardData | null>(() => {
  if (!expertData.value || !cadreData.value || !allStaffTrends.value || !dashboardFilters.value) {
    return null
  }

  return {
    metrics: [],
    expertCertification: expertData.value.certification,
    expertAppointment: expertData.value.appointment,
    cadreCertification: cadreData.value.certification,
    cadreAppointment: cadreData.value.appointment,
    allStaff: {
      departmentAppointment: departmentStats.value?.departmentAppointment ?? allStaffTrends.value.departmentAppointment,
      organizationAppointment: allStaffTrends.value.organizationAppointment,
      jobCategoryAppointment: jobCategoryStats.value?.jobCategoryAppointment ?? allStaffTrends.value.jobCategoryAppointment,
      departmentCertification: departmentStats.value?.departmentCertification ?? allStaffTrends.value.departmentCertification,
      organizationCertification: allStaffTrends.value.organizationCertification,
      jobCategoryCertification: jobCategoryStats.value?.jobCategoryCertification ?? allStaffTrends.value.jobCategoryCertification,
    },
    employeeCertStatistics: departmentStats.value?.employeeCertStatistics ?? null,
    competenceCategoryCertStatistics: jobCategoryStats.value?.competenceCategoryCertStatistics ?? null,
    filters: dashboardFilters.value,
  }
})

const filters = ref<CertificationDashboardFilters>({
  role: '0',
  departmentPath: ['ICT_BG', 'CLOUD_CORE_NETWORK'],
})

const {
  departmentTree: departmentOptions,
  cascaderProps,
  initDepartmentTree,
  refreshDepartmentTree,
} = useDepartmentFilter()

const roleOptions = computed(() => normalizeRoleOptions(dashboardFilters.value?.roles ?? []))
const departmentStatistics = computed(
  () => departmentStats.value?.employeeCertStatistics?.departmentStatistics ?? []
)
const resolveQualifiedCount = (item?: DepartmentCertStatistic | null) =>
  item?.qualifiedCount ?? 0
const resolveCertificationCount = (item?: DepartmentCertStatistic | null) =>
  item?.certifiedCount ?? 0
const resolveCertificationRate = (item?: DepartmentCertStatistic | null) =>
  Number(item?.certRate ?? 0)
const resolveQualifiedRate = (item?: DepartmentCertStatistic | null) =>
  Number(item?.qualifiedRate ?? 0)
const departmentStatsPoints = computed<StaffChartPoint[]>(() =>
  departmentStatistics.value
    .map((item) => ({
      label: item.deptName?.trim().length ? item.deptName : item.deptCode,
      count: resolveQualifiedCount(item),
      rate: resolveQualifiedRate(item),
    }))
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
)
const departmentCertificationStatsPoints = computed<StaffChartPoint[]>(() =>
  departmentStatistics.value
    .map((item) => ({
      label: item.deptName?.trim().length ? item.deptName : item.deptCode,
      count: resolveCertificationCount(item),
      rate: resolveCertificationRate(item),
    }))
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
)
const hasDepartmentStats = computed(() => departmentStatsPoints.value.length > 0)
const fallbackDepartmentPoints = computed<StaffChartPoint[]>(
  () => allStaffTrends.value?.departmentAppointment ?? []
)
const departmentChartPoints = computed<StaffChartPoint[]>(() =>
  hasDepartmentStats.value ? departmentStatsPoints.value : fallbackDepartmentPoints.value
)
const fallbackDepartmentCertificationPoints = computed<StaffChartPoint[]>(
  () => allStaffTrends.value?.departmentCertification ?? []
)
const departmentCertificationChartPoints = computed<StaffChartPoint[]>(() =>
  hasDepartmentStats.value
    ? departmentCertificationStatsPoints.value
    : fallbackDepartmentCertificationPoints.value
)
const departmentCountLabel = computed(() => '任职总人数')
const departmentLegendTotals = computed<Record<string, string> | undefined>(() => {
  if (!hasDepartmentStats.value) return undefined
  const total = departmentStats.value?.employeeCertStatistics?.totalStatistics
  if (!total) return undefined
  return {
    [departmentCountLabel.value]: `${resolveQualifiedCount(total)}人`,
    占比: `${resolveQualifiedRate(total)}%`,
  }
})
const departmentCertificationLegendTotals = computed<Record<string, string> | undefined>(() => {
  if (!hasDepartmentStats.value) return undefined
  const total = departmentStats.value?.employeeCertStatistics?.totalStatistics
  if (!total) return undefined
  return {
    认证总人数: `${resolveCertificationCount(total)}人`,
    占比: `${resolveCertificationRate(total)}%`,
  }
})

// 职位类统计数据
const competenceCategoryStatistics = computed(
  () => jobCategoryStats.value?.competenceCategoryCertStatistics?.categoryStatistics ?? []
)
const hasJobCategoryStats = computed(() => competenceCategoryStatistics.value.length > 0)
const resolveJobCategoryQualifiedCount = (item?: CompetenceCategoryCertStatistics | null) =>
  item?.qualifiedCount ?? 0
const resolveJobCategoryCertificationCount = (item?: CompetenceCategoryCertStatistics | null) =>
  item?.certifiedCount ?? 0
const resolveJobCategoryQualifiedRate = (item?: CompetenceCategoryCertStatistics | null) =>
  Number(item?.qualifiedRate ?? 0)
const resolveJobCategoryCertificationRate = (item?: CompetenceCategoryCertStatistics | null) =>
  Number(item?.certRate ?? 0)

// 职位类任职数据图例总计
const jobCategoryAppointmentLegendTotals = computed<Record<string, string> | undefined>(() => {
  if (!hasJobCategoryStats.value) return undefined
  const total = jobCategoryStats.value?.competenceCategoryCertStatistics?.totalStatistics
  if (!total) return undefined
  return {
    任职人数: `${resolveJobCategoryQualifiedCount(total)}人`,
    占比: `${resolveJobCategoryQualifiedRate(total)}%`,
  }
})

// 职位类认证数据图例总计
const jobCategoryCertificationLegendTotals = computed<Record<string, string> | undefined>(() => {
  if (!hasJobCategoryStats.value) return undefined
  const total = jobCategoryStats.value?.competenceCategoryCertStatistics?.totalStatistics
  if (!total) return undefined
  return {
    认证人数: `${resolveJobCategoryCertificationCount(total)}人`,
    占比: `${resolveJobCategoryCertificationRate(total)}%`,
  }
})

// 职位类任职数据（过滤和排序）
const jobCategoryAppointmentPoints = computed<StaffChartPoint[]>(() => {
  const points = dashboardData.value?.allStaff.jobCategoryAppointment ?? []
  return points
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
})

// 职位类认证数据（过滤和排序）
const jobCategoryCertificationPoints = computed<StaffChartPoint[]>(() => {
  const points = dashboardData.value?.allStaff.jobCategoryCertification ?? []
  return points
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
})

// 组织AI成熟度任职数据（过滤和排序）
const organizationAppointmentPoints = computed<StaffChartPoint[]>(() => {
  const points = dashboardData.value?.allStaff.organizationAppointment ?? []
  return points
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
})

// 组织AI成熟度认证数据（过滤和排序）
const organizationCertificationPoints = computed<StaffChartPoint[]>(() => {
  const points = dashboardData.value?.allStaff.organizationCertification ?? []
  return points
    .filter((item) => item.rate > 0)
    .sort((a, b) => {
      // 首先按占比从高到低排序
      if (b.rate !== a.rate) {
        return b.rate - a.rate
      }
      // 占比一致时，按人数从高到低排序
      return b.count - a.count
    })
})

// 渐进式加载各个数据块
const loadExpertData = async () => {
  loadingExpert.value = true
  try {
    const deptCode = resolveDepartmentCode(filters.value.departmentPath)
    expertData.value = await fetchExpertData(deptCode)
  } catch (error) {
    console.error('加载专家数据失败:', error)
  } finally {
    loadingExpert.value = false
  }
}

const loadCadreData = async () => {
  loadingCadre.value = true
  try {
    const deptCode = resolveDepartmentCode(filters.value.departmentPath)
    cadreData.value = await fetchCadreData(deptCode)
  } catch (error) {
    console.error('加载干部数据失败:', error)
  } finally {
    loadingCadre.value = false
  }
}

const loadAllStaffTrends = async () => {
  loadingAllStaffTrends.value = true
  try {
    allStaffTrends.value = await fetchAllStaffTrends()
  } catch (error) {
    console.error('加载全员趋势数据失败:', error)
  } finally {
    loadingAllStaffTrends.value = false
  }
}

const loadDepartmentStats = async () => {
  loadingDepartmentStats.value = true
  try {
    const deptCode = resolveDepartmentCode(filters.value.departmentPath)
    const personType = filters.value.role ?? '0'
    departmentStats.value = await fetchDepartmentStats(deptCode, personType)
  } catch (error) {
    console.error('加载部门统计数据失败:', error)
  } finally {
    loadingDepartmentStats.value = false
  }
}

const loadJobCategoryStats = async () => {
  loadingJobCategoryStats.value = true
  try {
    const deptCode = resolveDepartmentCode(filters.value.departmentPath)
    const personType = filters.value.role ?? '0'
    jobCategoryStats.value = await fetchJobCategoryStats(deptCode, personType)
  } catch (error) {
    console.error('加载职位类统计数据失败:', error)
  } finally {
    loadingJobCategoryStats.value = false
  }
}

const loadFilters = async () => {
  loadingFilters.value = true
  try {
    dashboardFilters.value = await fetchDashboardFilters()
  } catch (error) {
    console.error('加载筛选器数据失败:', error)
  } finally {
    loadingFilters.value = false
  }
}

// 加载所有数据（并行加载，不阻塞页面渲染）
const fetchData = async () => {
  // 先加载筛选器数据（用于显示筛选组件）
  await loadFilters()
  
  // 然后并行加载其他数据块
  Promise.all([
    loadExpertData(),
    loadCadreData(),
    loadAllStaffTrends(),
    loadDepartmentStats(),
    loadJobCategoryStats(),
  ]).catch((error) => {
    console.error('加载数据失败:', error)
  })
}

const resolveDepartmentCode = (deptPath?: string[]) => {
  if (!deptPath || deptPath.length === 0) {
    return '0'
  }
  const last = deptPath[deptPath.length - 1]
  // 特殊处理：如果选中了 ICT_BG 或 云核心网产品线，视为一级部门，传0
  if (last === 'ICT_BG' || last === 'CLOUD_CORE_NETWORK') {
    return '0'
  }
  return last && last.trim().length ? last : '0'
}

const handleCellClick = (row: Record<string, unknown>, column: string) => {
  const deptCode = resolveDepartmentCode(filters.value.departmentPath)
  
  // 获取成熟度级别和职位类
  let maturityLevel = (row.maturityLevel as string) || ''
  const jobCategory = (row.jobCategory as string) || ''
  
  // 如果是总计行，将成熟度置为L5（代表查询L2和L3的数据）
  if (maturityLevel && (maturityLevel === '总计' || maturityLevel === '全部' || maturityLevel === 'Total' || maturityLevel === 'total')) {
    maturityLevel = 'L5'
  }
  
  // 构建查询参数
  const queryParams: Record<string, string | undefined> = {
    column,
    maturity: maturityLevel || undefined,
    jobCategory: jobCategory || undefined,
    role: filters.value.role,
    deptCode: deptCode,
  }
  
  // 如果部门路径存在，添加到查询参数中
  if (filters.value.departmentPath && Array.isArray(filters.value.departmentPath) && filters.value.departmentPath.length > 0) {
    queryParams.departmentPath = filters.value.departmentPath.join(',')
  }
  
  router.push({
    path: '/dashboard/certification/detail/detail',
    query: queryParams,
  })
}

// 处理专家任职数据表格的点击事件
const handleExpertQualifiedCellClick = (row: Record<string, unknown>, column: string) => {
  const deptCode = resolveDepartmentCode(filters.value.departmentPath)
  
  // 获取成熟度级别和职位类
  let maturityLevel = (row.maturityLevel as string) || ''
  const jobCategory = (row.jobCategory as string) || ''
  
  // 如果是职位类行（maturityLevel 为空），需要从表格数据中查找父级的成熟度级别
  if (!maturityLevel && jobCategory && expertData.value?.appointment) {
    const currentIndex = expertData.value.appointment.findIndex(
      (r) => r === row
    )
    // 向上查找最近的成熟度行
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevRow = expertData.value.appointment[i]
      if (prevRow && prevRow.maturityLevel) {
        maturityLevel = prevRow.maturityLevel as string
        break
      }
    }
  }
  
  // 如果是总计行，将成熟度置为L5（代表查询L2和L3的数据）
  if (maturityLevel && (maturityLevel === '总计' || maturityLevel === '全部' || maturityLevel === 'Total' || maturityLevel === 'total')) {
    maturityLevel = 'L5'
  }
  
  // 构建查询参数
  const queryParams: Record<string, string | undefined> = {
    column,
    maturity: maturityLevel || undefined,
    jobCategory: jobCategory || undefined,
    role: '2', // 强制设置为专家角色
    deptCode: deptCode,
    source: 'appointment', // 标识来自专家任职数据表格
  }
  
  // 如果部门路径存在，添加到查询参数中
  if (filters.value.departmentPath && Array.isArray(filters.value.departmentPath) && filters.value.departmentPath.length > 0) {
    queryParams.departmentPath = filters.value.departmentPath.join(',')
  }
  
  router.push({
    path: '/dashboard/certification/detail/detail',
    query: queryParams,
  })
}

// 处理专家认证数据表格的点击事件
const handleExpertCertCellClick = (row: Record<string, unknown>, column: string) => {
  const deptCode = resolveDepartmentCode(filters.value.departmentPath)
  
  // 获取成熟度级别和职位类
  let maturityLevel = (row.maturityLevel as string) || ''
  const jobCategory = (row.jobCategory as string) || ''
  
  // 如果是职位类行（maturityLevel 为空），需要从表格数据中查找父级的成熟度级别
  if (!maturityLevel && jobCategory && expertData.value?.certification) {
    const currentIndex = expertData.value.certification.findIndex(
      (r) => r === row
    )
    // 向上查找最近的成熟度行
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevRow = expertData.value.certification[i]
      if (prevRow && prevRow.maturityLevel) {
        maturityLevel = prevRow.maturityLevel as string
        break
      }
    }
  }
  
  // 如果是总计行，将成熟度置为L5（代表查询L2和L3的数据）
  if (maturityLevel && (maturityLevel === '总计' || maturityLevel === '全部' || maturityLevel === 'Total' || maturityLevel === 'total')) {
    maturityLevel = 'L5'
  }
  
  // 构建查询参数
  const queryParams: Record<string, string | undefined> = {
    column,
    maturity: maturityLevel || undefined,
    jobCategory: jobCategory || undefined,
    role: '2', // 强制设置为专家角色
    deptCode: deptCode,
    source: 'certification', // 标识来自专家认证数据表格
  }
  
  // 如果部门路径存在，添加到查询参数中
  if (filters.value.departmentPath && Array.isArray(filters.value.departmentPath) && filters.value.departmentPath.length > 0) {
    queryParams.departmentPath = filters.value.departmentPath.join(',')
  }
  
  router.push({
    path: '/dashboard/certification/detail/detail',
    query: queryParams,
  })
}

// 处理干部认证数据表格的点击事件
const handleCadreCertCellClick = (row: Record<string, unknown>, column: string) => {
  const deptCode = resolveDepartmentCode(filters.value.departmentPath)
  
  // 获取成熟度级别和职位类
  let maturityLevel = (row.maturityLevel as string) || ''
  const jobCategory = (row.jobCategory as string) || ''
  
  // 如果是职位类行（maturityLevel 为空），需要从表格数据中查找父级的成熟度级别
  if (!maturityLevel && jobCategory && cadreData.value?.certification) {
    const currentIndex = cadreData.value.certification.findIndex(
      (r) => r === row
    )
    // 向上查找最近的成熟度行
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevRow = cadreData.value.certification[i]
      if (prevRow && prevRow.isMaturityRow && prevRow.maturityLevel) {
        maturityLevel = prevRow.maturityLevel as string
        break
      }
    }
  }
  
  // 如果是总计行，将成熟度置为L5（代表查询L2和L3的数据）
  if (maturityLevel && (maturityLevel === '总计' || maturityLevel === '全部' || maturityLevel === 'Total' || maturityLevel === 'total')) {
    maturityLevel = 'L5'
  }
  
  // 构建查询参数
  const queryParams: Record<string, string | undefined> = {
    column,
    maturity: maturityLevel || undefined,
    jobCategory: jobCategory || undefined,
    role: '1', // 强制设置为干部角色
    deptCode: deptCode,
    source: 'certification', // 标识来自干部认证数据表格
  }
  
  // 如果部门路径存在，添加到查询参数中
  if (filters.value.departmentPath && Array.isArray(filters.value.departmentPath) && filters.value.departmentPath.length > 0) {
    queryParams.departmentPath = filters.value.departmentPath.join(',')
  }
  
  router.push({
    path: '/dashboard/certification/detail/detail',
    query: queryParams,
  })
}

// 处理干部任职数据表格的点击事件
const handleCadreQualifiedCellClick = (row: Record<string, unknown>, column: string) => {
  const deptCode = resolveDepartmentCode(filters.value.departmentPath)
  
  // 获取成熟度级别和职位类
  let maturityLevel = (row.maturityLevel as string) || ''
  const jobCategory = (row.jobCategory as string) || ''
  
  // 如果是职位类行（maturityLevel 为空），需要从表格数据中查找父级的成熟度级别
  if (!maturityLevel && jobCategory && cadreData.value?.appointment) {
    const currentIndex = cadreData.value.appointment.findIndex(
      (r) => r === row
    )
    // 向上查找最近的成熟度行
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevRow = cadreData.value.appointment[i]
      if (prevRow && prevRow.isMaturityRow && prevRow.maturityLevel) {
        maturityLevel = prevRow.maturityLevel as string
        break
      }
    }
  }
  
  // 如果是总计行，将成熟度置为L5（代表查询L2和L3的数据）
  if (maturityLevel && (maturityLevel === '总计' || maturityLevel === '全部' || maturityLevel === 'Total' || maturityLevel === 'total')) {
    maturityLevel = 'L5'
  }
  
  // 构建查询参数
  const queryParams: Record<string, string | undefined> = {
    column, // 'baseline', 'appointed', 'appointedByRequirement'
    maturity: maturityLevel || undefined,
    jobCategory: jobCategory || undefined, // 如果为空则不传递
    role: '1', // 强制设置为干部角色
    deptCode: deptCode,
    source: 'appointment', // 标识来自干部任职数据表格
  }
  
  // 如果部门路径存在，添加到查询参数中
  if (filters.value.departmentPath && Array.isArray(filters.value.departmentPath) && filters.value.departmentPath.length > 0) {
    queryParams.departmentPath = filters.value.departmentPath.join(',')
  }
  
  router.push({
    path: '/dashboard/certification/detail/detail',
    query: queryParams,
  })
}

const formatNumber = (value: number) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }
  return new Intl.NumberFormat('zh-CN').format(value)
}

const formatPercent = (value: number) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-'
  }
  if (value > 1) {
    return `${value.toFixed(1)}%`
  }
  return `${(value * 100).toFixed(1)}%`
}

const getRowClassName = ({ rowIndex }: { rowIndex: number }) => {
  if (rowIndex % 2 === 0) {
    return 'row-even'
  }
  return 'row-odd'
}

const getCellClassName = ({ row, column }: { row: any; column: any }) => {
  if (column.property === 'complianceRate') {
    if (!row.isL2CalculatedNonSoftware) {
      if (row.complianceRate == null || row.complianceRate === undefined || isNaN(row.complianceRate)) {
        return 'cell-placeholder-bg'
      }
    }
  }
  if (column.property === 'certificationCompliance') {
    if (!row.isL2CalculatedNonSoftware) {
      if (row.certificationCompliance == null || row.certificationCompliance === undefined || isNaN(row.certificationCompliance)) {
        return 'cell-placeholder-bg'
      }
    }
  }
  return ''
}


const resetFilters = () => {
  filters.value = {
    role: '0',
    departmentPath: ['ICT_BG', 'CLOUD_CORE_NETWORK'],
  }
}

// 监听部门路径变化：影响专家、干部、部门和职位类数据
watch(
  () => filters.value.departmentPath,
  () => {
    // 部门筛选条件改变时，重新加载依赖部门的数据块
    loadExpertData()
    loadCadreData()
    loadDepartmentStats()
    loadJobCategoryStats()
  },
  { deep: true }
)

// 监听角色视图变化：只影响全员相关的部门和职位类数据
watch(
  () => filters.value.role,
  () => {
    // 角色视图切换时，只刷新全员相关的统计数据（部门和职位类）
    // 专家和干部数据不受角色视图影响，不需要刷新
    loadDepartmentStats()
    loadJobCategoryStats()
  }
)

onMounted(() => {
  initDepartmentTree()
  fetchData()
})

onActivated(() => {
  refreshDepartmentTree()
  fetchData()
})
</script>

<template>
  <section class="dashboard certification-dashboard">
    <header class="dashboard__header glass-card">
      <div class="header-info">
        <h2>AI 任职认证看板</h2>
        <p>
          覆盖专家、干部与全员多维度的任职与认证进度，支持六级部门级联筛选，帮助快速识别薄弱环节与提升方向。
        </p>
      </div>
    </header>

    <el-card shadow="hover" class="filter-card">
      <el-form :inline="true" :model="filters" label-width="92">
        <el-form-item label="部门筛选">
          <el-cascader
            v-model="filters.departmentPath"
            :options="departmentOptions"
            :props="cascaderProps"
            placeholder="可选择至六级部门"
            clearable
            separator=" / "
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button text type="primary" @click="resetFilters">重置筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 指标卡片区域 -->
    <el-row :gutter="16" class="metric-row" v-if="dashboardData">
      <el-col v-for="metric in dashboardData.metrics" :key="metric.id" :xs="24" :sm="12" :md="6">
        <StatCard
          :title="metric.title"
          :value="metric.value"
          :unit="metric.unit"
          :delta="metric.delta"
          :trend="metric.trend"
          subtitle="较上期"
        />
      </el-col>
    </el-row>

    <!-- 干部数据区块 -->
    <el-card shadow="hover" class="data-section cadre-data-section">
      <template #header>
        <div class="section-header">
          <h3>干部 AI 人才数据</h3>
        </div>
      </template>
      <el-row :gutter="16" class="summary-table-grid">
        <!-- 3. 干部任职数据 -->
        <el-col :xs="24" :lg="24">
          <div class="summary-table-container">
            <div class="summary-table-header">
              <h3>
                干部AI任职数据
                <el-tooltip
                  placement="top"
                  effect="dark"
                >
                  <template #content>
                    <div style="line-height: 1.8;">
                      <div style="font-weight: 500; margin-bottom: 4px;">岗位AI成熟度等级定义：</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L3，即AI生产者，优化算法框架与AI基础设施，驱动基础模型及生态创新，打造产业原生智能技术底座；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L2，即AI产品者，AI融入研发全流程，实现AI能力与产品整合，提升产品解决方案竞争力；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L1，即AI应用者，熟练使用AI技术和工具，并嵌入日常工作流，提升组织作业效能。</div>
                      <div style="margin-top: 12px; font-weight: 500; margin-bottom: 4px;">AI任职方向包括：</div>
                      <div>数据科学与AI工程（ICT）</div>
                      <div>AI算法及应用（ICT）</div>
                      <div>AI软件工程与工具（ICT）</div>
                      <div>AI系统测试（ICT）</div>
                    </div>
                  </template>
                  <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </h3>
            </div>
            <div class="summary-table-body">
              <el-skeleton :rows="4" animated v-if="loadingCadre" />
              <el-table
                v-else-if="cadreData"
                :data="cadreData.appointment"
                border
                stripe
                size="small"
                :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52' }"
                :row-class-name="getRowClassName"
                :cell-class-name="getCellClassName"
              >
                <!-- 合并的成熟度/职位类列 -->
                <el-table-column prop="maturityLevel" label="岗位AI成熟度/职位类" width="180" align="left" header-align="center">
                  <template #default="{ row }">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span v-if="row.isMaturityRow">{{ row.maturityLevel }}</span>
                      <span v-else style="flex: 1;"></span>
                      <span v-if="!row.isMaturityRow">{{ row.jobCategory }}</span>
                      <span v-else style="flex: 1;"></span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="baseline" label="基线人数" min-width="80" align="center" header-align="center">
                  <template #default="{ row }">
                    <el-link
                      v-if="!(row as any).isL2CalculatedNonSoftware"
                      type="primary"
                      :underline="false"
                      class="clickable-cell"
                      @click="handleCadreQualifiedCellClick(row, 'baseline')"
                    >
                      {{ formatNumber(row.baseline) }}
                    </el-link>
                    <span v-else>{{ formatNumber(row.baseline) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="appointed" label="AI任职人数" min-width="100" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware">
                      /
                    </template>
                    <el-link
                      v-else
                      type="primary"
                      :underline="false"
                      class="clickable-cell"
                      @click="handleCadreQualifiedCellClick(row, 'appointed')"
                    >
                      {{ formatNumber(row.appointed) }}
                    </el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="appointedByRequirement" label="按要求AI任职人数" min-width="130" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware">
                      /
                    </template>
                    <template v-else>
                      {{ formatNumber(row.appointedByRequirement) }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="appointmentRate" label="AI任职率" min-width="90" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware">
                      /
                    </template>
                    <template v-else>
                      {{ formatPercent(row.appointmentRate) }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="certificationCompliance" label="按要求AI任职人数占比" min-width="140" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware">
                      /
                    </template>
                    <template v-else>
                      {{ formatPercent(row.certificationCompliance) }}
                    </template>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="待提供数据" :image-size="80" />
            </div>
          </div>
        </el-col>
        <!-- 4. 干部认证数据 -->
        <el-col :xs="24" :lg="24">
          <div class="summary-table-container">
            <div class="summary-table-header">
              <h3>
                干部AI认证数据
                <el-tooltip
                  placement="top"
                  effect="dark"
                >
                  <template #content>
                    <div style="line-height: 1.8;">
                      <div style="font-weight: 500; margin-bottom: 4px;">岗位AI成熟度等级定义：</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L3，即AI生产者，优化算法框架与AI基础设施，驱动基础模型及生态创新，打造产业原生智能技术底座；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L2，即AI产品者，AI融入研发全流程，实现AI能力与产品整合，提升产品解决方案竞争力；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L1，即AI应用者，熟练使用AI技术和工具，并嵌入日常工作流，提升组织作业效能。</div>
                      <div style="margin-top: 12px; font-weight: 500; margin-bottom: 4px;">AI认证方向包括：</div>
                      <div>AI算法技术</div>
                      <div>AI决策推理</div>
                      <div>AI图像语言语义</div>
                    </div>
                  </template>
                  <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </h3>
            </div>
            <div class="summary-table-body">
              <el-skeleton :rows="4" animated v-if="loadingCadre" />
              <el-table
                v-else-if="cadreData"
            :data="cadreData.certification"
            border
            stripe
            size="small"
            :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52' }"
            :row-class-name="getRowClassName"
            :cell-class-name="getCellClassName"
          >
                <!-- 合并的成熟度/职位类列 -->
                <el-table-column prop="maturityLevel" label="岗位AI成熟度/职位类" width="180" align="left" header-align="center">
                  <template #default="{ row }">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span v-if="row.isMaturityRow">{{ row.maturityLevel }}</span>
                      <span v-else style="flex: 1;"></span>
                      <span v-if="!row.isMaturityRow">{{ row.jobCategory }}</span>
                      <span v-else style="flex: 1;"></span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="baseline" label="基线人数" min-width="110" align="center" header-align="center">
                  <template #default="{ row }">
                    <el-link
                      v-if="!(row as any).isL2CalculatedNonSoftware"
                      type="primary"
                      :underline="false"
                      class="clickable-cell"
                      @click="handleCadreCertCellClick(row, 'baseline')"
                    >
                      {{ formatNumber(row.baseline) }}
                    </el-link>
                    <span v-else>{{ formatNumber(row.baseline) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="aiCertificateHolders" label="AI专业级持证人数" min-width="180" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware || (!row.isMaturityRow && (row as any).actualMaturityLevel && ['L2', 'L3'].includes((row as any).actualMaturityLevel) && row.jobCategory !== '软件类')">
                      /
                    </template>
                    <el-link
                      v-else
                      type="primary"
                      :underline="false"
                      class="clickable-cell"
                      @click="handleCadreCertCellClick(row, 'aiCertificateHolders')"
                    >
                      {{ formatNumber(row.aiCertificateHolders) }}
                    </el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="certificateRate" label="AI专业级持证率" min-width="150" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware || (!row.isMaturityRow && (row as any).actualMaturityLevel && ['L2', 'L3'].includes((row as any).actualMaturityLevel) && row.jobCategory !== '软件类')">
                      /
                    </template>
                    <template v-else>
                      {{ formatPercent(row.certificateRate) }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="subjectTwoPassed" label="科目二通过人数" min-width="160" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware || (!row.isMaturityRow && (row as any).actualMaturityLevel && ['L2', 'L3'].includes((row as any).actualMaturityLevel) && row.jobCategory === '软件类')">
                      /
                    </template>
                    <template v-else>
                      {{ formatNumber(row.subjectTwoPassed) }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="subjectTwoRate" label="科目二通过率" min-width="140" align="center" header-align="center">
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware || (!row.isMaturityRow && (row as any).actualMaturityLevel && ['L2', 'L3'].includes((row as any).actualMaturityLevel) && row.jobCategory === '软件类')">
                      /
                    </template>
                    <template v-else>
                      {{ formatPercent(row.subjectTwoRate) }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column prop="complianceRate" min-width="130" align="center" header-align="center">
                  <template #header>
                    <span>按要求持证率</span>
                    <el-tooltip
                      placement="top"
                      effect="dark"
                    >
                      <template #content>
                        <div style="line-height: 1.8;">
                          <div style="font-weight: 500; margin-bottom: 4px;">干部AI认证能力要求：</div>
                          <div>软件类L2/L3干部要求在26年H1之前完成"AI算法技术"专业级认证；</div>
                          <div>其他L2/L3岗位干部要求26年H2之前完成"AI算法技术"工作级认证科目2（算法理论），牵引26H1之前完成；</div>
                          <div>产品线管理团队成员按L2标准要求。</div>
                        </div>
                      </template>
                      <el-icon style="margin-left: 4px; cursor: pointer; color: #909399; vertical-align: middle;">
                        <QuestionFilled />
                      </el-icon>
                    </el-tooltip>
                  </template>
                  <template #default="{ row }">
                    <template v-if="(row as any).isL2CalculatedNonSoftware">
                      /
                    </template>
                    <span v-else-if="row.complianceRate != null && row.complianceRate !== undefined && !isNaN(row.complianceRate)">
                      {{ formatPercent(row.complianceRate) }}
                    </span>
                    <span v-else class="pending-data">待提供数据</span>
                  </template>
                </el-table-column>
              </el-table>
            <el-empty v-else description="待提供数据" :image-size="80" />
          </div>
        </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 专家数据区块 -->
    <el-card shadow="hover" class="data-section">
      <template #header>
        <div class="section-header">
          <h3>专家 AI 人才数据</h3>
        </div>
      </template>
    <el-row :gutter="16" class="summary-table-grid">
      <!-- 1. 专家任职数据 -->
        <el-col :xs="24" :lg="24">
          <div class="summary-table-container">
            <div class="summary-table-header">
              <h3>
                专家AI任职数据
                <el-tooltip
                  placement="top"
                  effect="dark"
                >
                  <template #content>
                    <div style="line-height: 1.8;">
                      <div style="font-weight: 500; margin-bottom: 4px;">岗位AI成熟度等级定义：</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L3，即AI生产者，优化算法框架与AI基础设施，驱动基础模型及生态创新，打造产业原生智能技术底座；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L2，即AI产品者，AI融入研发全流程，实现AI能力与产品整合，提升产品解决方案竞争力；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L1，即AI应用者，熟练使用AI技术和工具，并嵌入日常工作流，提升组织作业效能。</div>
                      <div style="margin-top: 12px; font-weight: 500; margin-bottom: 4px;">AI任职方向包括：</div>
                      <div>数据科学与AI工程（ICT）</div>
                      <div>AI算法及应用（ICT）</div>
                      <div>AI软件工程与工具（ICT）</div>
                      <div>AI系统测试（ICT）</div>
                    </div>
                  </template>
                  <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </h3>
            </div>
            <div class="summary-table-body">
              <el-skeleton :rows="4" animated v-if="loadingExpert" />
              <el-table
                v-else-if="expertData"
                :data="expertData.appointment"
                border
                stripe
                size="small"
                :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52' }"
                :row-class-name="getRowClassName"
              >
                <!-- 合并的成熟度/职位类列 -->
                <el-table-column prop="maturityLevel" label="岗位AI成熟度/职位类" width="180" align="left" header-align="center">
                  <template #default="{ row }">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span v-if="row.isMaturityRow">{{ row.maturityLevel || '' }}</span>
                      <span v-else style="flex: 1;"></span>
                      <span v-if="!row.isMaturityRow">{{ row.jobCategory || '' }}</span>
                      <span v-else style="flex: 1;"></span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="baseline" label="基线人数" min-width="110" align="center" header-align="center">
                  <template #default="{ row }">
                    <span style="color: #909399;">
                      {{ formatNumber(row.baseline) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="appointed" label="AI任职人数" min-width="130" align="center" header-align="center">
                  <template #default="{ row }">
                    <span style="color: #909399;">
                      {{ formatNumber(row.appointed) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="appointmentRate" label="AI任职率" min-width="130" align="center" header-align="center">
                  <template #default="{ row }">
                    {{ formatPercent(row.appointmentRate) }}
                  </template>
                </el-table-column>
                <el-table-column prop="appointedByRequirement" label="按要求AI任职人数" min-width="180" align="center" header-align="center">
                  <template #default="{ row }">
                    <span class="pending-data">待提供数据</span>
                  </template>
                </el-table-column>
                <el-table-column prop="certificationCompliance" label="按要求AI任职人数占比" min-width="190" align="center" header-align="center">
                  <template #default="{ row }">
                    <span class="pending-data">待提供数据</span>
                  </template>
                </el-table-column>
                <template #empty>
                  <el-empty description="待提供数据" :image-size="80" />
                </template>
              </el-table>
              <el-empty v-else description="待提供数据" :image-size="80" />
            </div>
          </div>
        </el-col>
        <!-- 2. 专家认证数据 -->
        <el-col :xs="24" :lg="24">
          <div class="summary-table-container">
            <div class="summary-table-header">
              <h3>
                专家AI认证数据
                <el-tooltip
                  placement="top"
                  effect="dark"
                >
                  <template #content>
                    <div style="line-height: 1.8;">
                      <div style="font-weight: 500; margin-bottom: 4px;">岗位AI成熟度等级定义：</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L3，即AI生产者，优化算法框架与AI基础设施，驱动基础模型及生态创新，打造产业原生智能技术底座；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L2，即AI产品者，AI融入研发全流程，实现AI能力与产品整合，提升产品解决方案竞争力；</div>
                      <div style="font-weight: 500; margin-bottom: 4px;">L1，即AI应用者，熟练使用AI技术和工具，并嵌入日常工作流，提升组织作业效能。</div>
                      <div style="margin-top: 12px; font-weight: 500; margin-bottom: 4px;">AI认证方向包括：</div>
                      <div>AI算法技术</div>
                      <div>AI决策推理</div>
                      <div>AI图像语言语义</div>
                    </div>
                  </template>
                  <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                    <QuestionFilled />
                  </el-icon>
                </el-tooltip>
              </h3>
            </div>
            <div class="summary-table-body">
              <el-skeleton :rows="4" animated v-if="loadingExpert" />
              <el-table
                v-else-if="expertData"
                :data="expertData.certification"
                border
                stripe
                size="small"
                :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52' }"
                :row-class-name="getRowClassName"
              >
                <!-- 合并的成熟度/职位类列 -->
                <el-table-column prop="maturityLevel" label="岗位AI成熟度/职位类" width="180" align="left" header-align="center">
                  <template #default="{ row }">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span v-if="row.isMaturityRow">{{ row.maturityLevel || '' }}</span>
                      <span v-else style="flex: 1;"></span>
                      <span v-if="!row.isMaturityRow">{{ row.jobCategory || '' }}</span>
                      <span v-else style="flex: 1;"></span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="baseline" label="基线人数" min-width="110" align="center" header-align="center">
                  <template #default="{ row }">
                    <span style="color: #909399;">
                      {{ formatNumber(row.baseline) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="certified" label="已完成AI认证人数" min-width="170" align="center" header-align="center">
                  <template #default="{ row }">
                    <span style="color: #909399;">
                      {{ formatNumber(row.certified) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="certificationRate" label="AI认证人数占比" min-width="150" align="center" header-align="center">
                  <template #default="{ row }">
                    {{ formatPercent(row.certificationRate) }}
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="待提供数据" :image-size="80" />
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="hover" class="charts-section">
      <template #header>
        <div class="charts-header">
          <div class="charts-title">
            <el-icon><Medal /></el-icon>
            <div>
              <h3>全员任职/认证趋势</h3>
              <p>任职、认证人数使用柱状图展示，同时叠加占比折线辅助判读效率</p>
            </div>
          </div>
          <div class="charts-filter">
            <el-form :inline="true" :model="filters" label-width="80">
              <el-form-item label="角色视图">
                <el-select v-model="filters.role" placeholder="全员" style="width: 200px">
                  <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingDepartmentStats || loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="部门任职数据"
            :points="departmentChartPoints"
            :count-label="departmentCountLabel"
            rate-label="占比"
            :legend-totals="departmentLegendTotals"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI任职方向包括：</div>
                    <div>数据科学与AI工程（ICT）</div>
                    <div>AI算法及应用（ICT）</div>
                    <div>AI软件工程与工具（ICT）</div>
                    <div>AI系统测试（ICT）</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingDepartmentStats || loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="部门认证数据"
            :points="departmentCertificationChartPoints"
            count-label="认证总人数"
            rate-label="占比"
            :legend-totals="departmentCertificationLegendTotals"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI认证方向包括：</div>
                    <div>AI算法技术</div>
                    <div>AI决策推理</div>
                    <div>AI图像语言语义</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingJobCategoryStats || loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="职位类任职数据"
            :points="jobCategoryAppointmentPoints"
            count-label="任职人数"
            rate-label="占比"
            :legend-totals="jobCategoryAppointmentLegendTotals"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI任职方向包括：</div>
                    <div>数据科学与AI工程（ICT）</div>
                    <div>AI算法及应用（ICT）</div>
                    <div>AI软件工程与工具（ICT）</div>
                    <div>AI系统测试（ICT）</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingJobCategoryStats || loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="职位类认证数据"
            :points="jobCategoryCertificationPoints"
            count-label="认证人数"
            rate-label="占比"
            :legend-totals="jobCategoryCertificationLegendTotals"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI认证方向包括：</div>
                    <div>AI算法技术</div>
                    <div>AI决策推理</div>
                    <div>AI图像语言语义</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="组织AI成熟度任职数据"
            :points="organizationAppointmentPoints"
            count-label="任职人数"
            rate-label="占比"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI任职方向包括：</div>
                    <div>数据科学与AI工程（ICT）</div>
                    <div>AI算法及应用（ICT）</div>
                    <div>AI软件工程与工具（ICT）</div>
                    <div>AI系统测试（ICT）</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
        <el-col :xs="24" :sm="24" :md="24" :lg="24">
          <el-skeleton :rows="3" animated v-if="loadingAllStaffTrends" />
          <BarLineChart
            v-else-if="dashboardData"
            title="组织AI成熟度认证数据"
            :points="organizationCertificationPoints"
            count-label="认证人数"
            rate-label="占比"
            :height="320"
          >
            <template #title-suffix>
              <el-tooltip
                placement="top"
                effect="dark"
              >
                <template #content>
                  <div style="line-height: 1.8;">
                    <div style="font-weight: 500; margin-bottom: 4px;">AI认证方向包括：</div>
                    <div>AI算法技术</div>
                    <div>AI决策推理</div>
                    <div>AI图像语言语义</div>
                  </div>
                </template>
                <el-icon style="margin-left: 4px; cursor: pointer; color: #909399;">
                  <QuestionFilled />
                </el-icon>
              </el-tooltip>
            </template>
          </BarLineChart>
        </el-col>
      </el-row>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.glass-card {
  border-radius: $radius-lg;
  background: linear-gradient(135deg, rgba(58, 122, 254, 0.18), rgba(155, 92, 255, 0.16));
  box-shadow: 0 18px 45px rgba(58, 122, 254, 0.12);
  padding: $spacing-lg;
  color: #000;

  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    color: #000;
  }

  p {
    margin: $spacing-sm 0 0;
    color: #000;
    line-height: 1.6;
    white-space: nowrap;
  }
}

.header-info {
  max-width: 640px;
}

.filter-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;
}

.metric-row {
  margin-top: $spacing-xs;
}

.data-section {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;
  margin-top: $spacing-lg;

  .section-header {
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: $text-main-color;
    }
  }

  :deep(.el-card__body) {
    padding: $spacing-lg;
  }
}

.cadre-data-section {
  margin-top: -10px;
}

.summary-table-grid {
  row-gap: 16px;

  :deep(.el-col) {
    display: flex;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.summary-table-container) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;

    .summary-table-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }

    .summary-table-body {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    :deep(.el-table) {
      flex: 1;
      --el-table-border-color: rgba(47, 59, 82, 0.08);
      --el-table-row-hover-bg-color: rgba(58, 122, 254, 0.08);
    }

    :deep(.row-even) {
      background: rgba(58, 122, 254, 0.05);
    }

    :deep(.row-odd) {
      background: #fff;
    }

    .clickable-cell {
      cursor: pointer;
    }

    :deep(.cell-placeholder-bg) {
      background-color: rgba(240, 242, 245, 0.7) !important;
    }
  }
}


.charts-section {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);

  :deep(.el-card__body) {
    padding: $spacing-lg;
  }

  :deep(.el-row) {
    row-gap: $spacing-lg;
  }

  .charts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .charts-title {
    display: flex;
    align-items: center;
    gap: $spacing-md;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: $text-main-color;
    }

    p {
      margin: $spacing-xs 0 0;
      color: $text-secondary-color;
    }
  }

  .charts-filter {
    display: flex;
    align-items: center;
    margin-top: 16px;

    :deep(.el-form-item__label) {
      font-weight: 600;
      font-size: 16px;
    }
  }
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    gap: $spacing-md;
  }
}

.pending-data {
  background-color: rgba(240, 242, 245, 0.7) !important;
  color: #909399;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  font-size: 12px;
}
</style>