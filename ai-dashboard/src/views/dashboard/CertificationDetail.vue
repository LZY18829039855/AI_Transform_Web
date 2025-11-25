<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchCertificationDetailData, fetchCadreQualifiedDetails, fetchPersonCertDetails } from '@/api/dashboard'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import { normalizeRoleOptions } from '@/constants/roles'
import type {
  AppointmentAuditRecord,
  CertificationAuditRecord,
  CertificationDetailData,
  CertificationDetailFilters,
  CertificationRole,
  EmployeeDetailVO,
} from '@/types/dashboard'

const props = defineProps<{ id: string }>()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const detailData = ref<CertificationDetailData | null>(null)
const activeTab = ref<'certification' | 'appointment'>('certification')
// 标记是否是用户主动点击查询按钮
const isUserQuery = ref(false)
// 表格引用
const appointmentTableRef = ref()
const ROLE_VALUES: CertificationRole[] = ['0', '1', '2', '3']
const routeRole = route.query.role as string | undefined
const normalizedRole: CertificationRole = ROLE_VALUES.includes(routeRole as CertificationRole)
  ? (routeRole as CertificationRole)
  : '0'
// 从路由参数中解析部门路径
const parseDepartmentPathFromQuery = (): string[] => {
  const departmentPathStr = route.query.departmentPath as string | undefined
  if (departmentPathStr && typeof departmentPathStr === 'string' && departmentPathStr.trim()) {
    const pathArray = departmentPathStr.split(',').filter((dept) => dept.trim().length > 0)
    return pathArray
  }
  return []
}

// 从路由参数中解析成熟度，如果是L5则显示为"全部"
const parseMaturityFromQuery = (): '全部' | 'L1' | 'L2' | 'L3' => {
  const maturityFromQuery = route.query.maturity as string | undefined
  if (maturityFromQuery === 'L5') {
    return '全部' // L5代表总计，显示为"全部"
  }
  if (maturityFromQuery && ['全部', 'L1', 'L2', 'L3'].includes(maturityFromQuery)) {
    return maturityFromQuery as '全部' | 'L1' | 'L2' | 'L3'
  }
  return '全部'
}

const filters = ref<CertificationDetailFilters>({
  role: normalizedRole,
  maturity: parseMaturityFromQuery(),
  departmentPath: parseDepartmentPathFromQuery(),
  jobCategory: (route.query.jobCategory as string) || undefined,
  name: undefined,
  employeeId: undefined,
})

const {
  departmentTree: departmentOptions,
  cascaderProps,
  initDepartmentTree,
  refreshDepartmentTree,
} = useDepartmentFilter()
const roleOptions = computed(() => normalizeRoleOptions(detailData.value?.filters.roles ?? []))

// 将EmployeeDetailVO转换为AppointmentAuditRecord
const convertEmployeeDetailToAppointmentRecord = (employee: EmployeeDetailVO): AppointmentAuditRecord => {
  return {
    id: employee.employeeNumber || '',
    name: employee.name || '',
    employeeId: employee.employeeNumber || '',
    positionCategory: employee.competenceCategoryCn || employee.competenceCategory || '',
    positionSubCategory: '', // 职位子类为空，不展示
    departmentLevel1: employee.firstLevelDept || '',
    departmentLevel2: employee.secondLevelDept || '',
    departmentLevel3: employee.thirdLevelDept || '',
    departmentLevel4: employee.fourthLevelDept || '',
    departmentLevel5: employee.fifthLevelDept || '',
    departmentLevel6: '', // 六级部门不展示
    minDepartment: employee.miniDeptName || '',
    professionalCategory: employee.competenceFamilyCn || '',
    expertCategory: employee.competenceCategoryCn || '',
    professionalSubCategory: employee.competenceSubcategoryCn || '',
    qualificationDirection: employee.directionCnName || '',
    qualificationLevel: employee.competenceRatingCn || '',
    acquisitionMethod: employee.competenceGradeCn || '', // 对应 t_qualifications.competence_grade_cn
    effectiveDate: employee.competenceFrom ? new Date(employee.competenceFrom).toLocaleDateString('zh-CN') : '',
    expiryDate: employee.competenceTo ? new Date(employee.competenceTo).toLocaleDateString('zh-CN') : '',
    isCadre: employee.isCadre === 1,
    cadreType: employee.cadreType || '',
    isExpert: undefined, // 暂无数据
    isFrontlineManager: undefined, // 暂无数据
    organizationMaturity: undefined, // 暂无数据
    positionMaturity: (employee.aiMaturity as 'L1' | 'L2' | 'L3') || undefined,
    requiredCertificate: undefined, // 暂无数据
    isQualified: employee.isQualificationsStandard !== undefined ? employee.isQualificationsStandard === 1 : undefined,
  }
}

// 从部门路径获取部门代码
const getDeptCodeFromPath = (path?: string[]): string => {
  if (!path || path.length === 0) {
    return '0'
  }
  const last = path[path.length - 1]
  return last && last.trim().length ? last : '0'
}

const fetchDetail = async () => {
  loading.value = true
  try {
    // 检查是否是干部数据查询（任职或认证）
    const isCadreQuery = 
      normalizedRole === '1' && 
      route.query.column && 
      ['appointed', 'appointedByRequirement', 'baseline', 'aiCertificateHolders', 'certification'].includes(route.query.column as string)

    // 检查是否是干部任职数据查询
    const isCadreQualifiedQuery = 
      normalizedRole === '1' && 
      route.query.column && 
      ['appointed', 'appointedByRequirement', 'baseline'].includes(route.query.column as string)

    // 检查是否是干部认证数据查询
    const isCadreCertQuery = 
      normalizedRole === '1' && 
      route.query.column && 
      ['aiCertificateHolders', 'certification', 'baseline'].includes(route.query.column as string)

    if (isCadreQuery) {
      // 干部角色：同时加载任职和认证数据
      // 使用筛选条件中的值（部门、职位类、成熟度）
      const deptCode = getDeptCodeFromPath(filters.value.departmentPath)
      const jobCategory = filters.value.jobCategory || undefined
      
      // 处理成熟度参数：
      // 1. 如果用户点击查询按钮（isUserQuery为true），使用筛选条件中的值
      // 2. 如果是首次加载（从看板跳转），优先检查路由参数中是否有L5
      let maturityParam: string | undefined = undefined
      const maturityFromRoute = route.query.maturity as string | undefined
      const aiMaturity = filters.value.maturity
      
      if (isUserQuery.value) {
        // 用户点击查询按钮，使用筛选条件中的值
        if (aiMaturity && aiMaturity !== '全部') {
          if (aiMaturity === 'L5') {
            maturityParam = 'L5' // L5代表查询L2和L3的数据
          } else if (aiMaturity === '总计' || aiMaturity === 'Total' || aiMaturity === 'total') {
            maturityParam = 'L5' // 总计行转换为L5
          } else {
            maturityParam = aiMaturity
          }
        }
      } else {
        // 首次加载（从看板跳转），优先检查路由参数
        if (maturityFromRoute === 'L5') {
          maturityParam = 'L5' // L5代表查询L2和L3的数据
        } else if (aiMaturity && aiMaturity !== '全部') {
          if (aiMaturity === 'L5') {
            maturityParam = 'L5' // L5代表查询L2和L3的数据
          } else if (aiMaturity === '总计' || aiMaturity === 'Total' || aiMaturity === 'total') {
            maturityParam = 'L5' // 总计行转换为L5
          } else {
            maturityParam = aiMaturity
          }
        }
      }

      // 确定queryType：
      // 1. 如果是从看板跳转过来的（有route.query.column），根据column决定：baseline=2，其他=1
      // 2. 如果是在详情页面点击查询按钮（没有route.query.column），默认为2
      const column = route.query.column as string | undefined
      let queryType = 2 // 默认值：在详情页面点击查询按钮时使用
      if (column) {
        // 从看板跳转过来，根据点击的列决定queryType
        queryType = column === 'baseline' ? 2 : 1
      }

      // 并行加载任职和认证数据（对于干部角色，无论点击哪个列，都同时加载两种数据）
      const [qualifiedResponse, certResponse] = await Promise.all([
        // 加载任职数据，queryType默认为2
        fetchCadreQualifiedDetails(
          deptCode,
          maturityParam,
          jobCategory,
          1, // personType: 1-干部
          queryType
        ),
        // 加载认证数据，queryType默认为2
        fetchPersonCertDetails(
          deptCode,
          maturityParam,
          jobCategory,
          1, // personType: 1-干部
          queryType
        ),
      ])

      // 转换任职数据
      let appointmentRecords: AppointmentAuditRecord[] = []
      if (qualifiedResponse && qualifiedResponse.employeeDetails) {
        appointmentRecords = qualifiedResponse.employeeDetails.map(
          convertEmployeeDetailToAppointmentRecord
        )
      }

      // 转换认证数据
      let certificationRecords: CertificationAuditRecord[] = []
      if (certResponse && certResponse.employeeDetails) {
        certificationRecords = certResponse.employeeDetails.map(
          (emp) => ({
            id: emp.employeeNumber || '',
            name: emp.name || '',
            employeeId: emp.employeeNumber || '',
            positionCategory: emp.competenceCategory || '',
            positionSubCategory: emp.competenceSubcategory || '',
            departmentLevel1: emp.firstLevelDept || '',
            departmentLevel2: emp.secondLevelDept || '',
            departmentLevel3: emp.thirdLevelDept || '',
            departmentLevel4: emp.fourthLevelDept || '',
            departmentLevel5: emp.fifthLevelDept || '',
            minDepartment: emp.miniDeptName || '',
            certificateName: emp.certTitle || '',
            certificateEffectiveDate: emp.certStartTime ? new Date(emp.certStartTime).toISOString().split('T')[0] : '',
            subjectTwoPassed: emp.isPassedSubject2 === 1,
            isCadre: emp.isCadre === 1,
            cadreType: emp.cadreType || undefined,
            isExpert: undefined, // 暂无数据
            isFrontlineManager: undefined, // 暂无数据
            organizationMaturity: undefined, // 暂无数据
            positionMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
            requiredCertificate: '',
            isQualified: undefined, // 暂无数据
          })
        )
      }

      // 构建detailData对象，同时包含任职和认证数据
      detailData.value = {
        summary: null,
        certificationRecords: certificationRecords,
        appointmentRecords: appointmentRecords,
        filters: {
          departmentTree: departmentOptions.value,
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
            { label: 'L2', value: 'L2' },
            { label: 'L3', value: 'L3' },
          ],
        },
      }

      // 根据点击的列和来源决定默认显示的标签页
      // 优先判断具体的列，再判断baseline和source参数
      const source = route.query.source as string | undefined
      
      if (column === 'appointed' || column === 'appointedByRequirement') {
        // 明确是任职相关列，默认显示任职tab
        activeTab.value = 'appointment'
      } else if (column === 'aiCertificateHolders' || column === 'certification') {
        // 明确是认证相关列，默认显示认证tab
        activeTab.value = 'certification'
      } else if (column === 'baseline') {
        // baseline在两个表格中都存在，根据source参数判断
        if (source === 'appointment') {
          // 从干部任职数据表格点击的baseline，显示任职tab
          activeTab.value = 'appointment'
        } else if (source === 'certification') {
          // 从干部认证数据表格点击的baseline，显示认证tab
          activeTab.value = 'certification'
        } else {
          // 如果没有source参数，根据其他列判断
          const isCadreQualifiedOnlyQuery = 
            normalizedRole === '1' && 
            route.query.column && 
            ['appointed', 'appointedByRequirement'].includes(route.query.column as string)
          const isCadreCertOnlyQuery = 
            normalizedRole === '1' && 
            route.query.column && 
            ['aiCertificateHolders', 'certification'].includes(route.query.column as string)
          
          if (isCadreQualifiedOnlyQuery) {
            activeTab.value = 'appointment'
          } else if (isCadreCertOnlyQuery) {
            activeTab.value = 'certification'
          } else {
            // 默认显示认证tab
            activeTab.value = 'certification'
          }
        }
      }
    } else {
      // 检查是否是专家认证数据查询
      const isExpertCertQuery = 
        normalizedRole === '2' && 
        route.query.column && 
        ['aiCertificateHolders', 'certification', 'baseline'].includes(route.query.column as string)

      if (isExpertCertQuery) {
        // 调用专家认证详情接口
        // 使用筛选条件中的值（部门、职位类、成熟度）
        const deptCode = getDeptCodeFromPath(filters.value.departmentPath)
        const jobCategory = filters.value.jobCategory || undefined
        
        // 处理成熟度参数：
        // 1. 如果用户点击查询按钮（isUserQuery为true），使用筛选条件中的值
        // 2. 如果是首次加载（从看板跳转），优先检查路由参数中是否有L5
        let maturityParam: string | undefined = undefined
        const maturityFromRoute = route.query.maturity as string | undefined
        const aiMaturity = filters.value.maturity
        
        if (isUserQuery.value) {
          // 用户点击查询按钮，使用筛选条件中的值
          if (aiMaturity && aiMaturity !== '全部') {
            if (aiMaturity === 'L5') {
              maturityParam = 'L5' // L5代表查询L2和L3的数据
            } else if (aiMaturity === '总计' || aiMaturity === 'Total' || aiMaturity === 'total') {
              maturityParam = 'L5' // 总计行转换为L5
            } else {
              maturityParam = aiMaturity
            }
          }
        } else {
          // 首次加载（从看板跳转），优先检查路由参数
          if (maturityFromRoute === 'L5') {
            maturityParam = 'L5' // L5代表查询L2和L3的数据
          } else if (aiMaturity && aiMaturity !== '全部') {
            if (aiMaturity === 'L5') {
              maturityParam = 'L5' // L5代表查询L2和L3的数据
            } else if (aiMaturity === '总计' || aiMaturity === 'Total' || aiMaturity === 'total') {
              maturityParam = 'L5' // 总计行转换为L5
            } else {
              maturityParam = aiMaturity
            }
          }
        }
        
        // 确定queryType：
        // 1. 如果是从看板跳转过来的（有route.query.column），根据column决定：baseline=2，其他=1
        // 2. 如果是在详情页面点击查询按钮（没有route.query.column），默认为2
        const column = route.query.column as string | undefined
        let queryType = 2 // 默认值：在详情页面点击查询按钮时使用
        if (column) {
          // 从看板跳转过来，根据点击的列决定queryType
          queryType = column === 'baseline' ? 2 : 1
        }
        
        const response = await fetchPersonCertDetails(
          deptCode,
          maturityParam,
          jobCategory,
          2, // personType: 2-专家
          queryType
        )

        if (response && response.employeeDetails) {
          // 转换为CertificationAuditRecord格式
          const certificationRecords: CertificationAuditRecord[] = response.employeeDetails.map(
            (emp) => ({
              id: emp.employeeNumber || '',
              name: emp.name || '',
              employeeId: emp.employeeNumber || '',
              positionCategory: emp.competenceCategory || '',
              positionSubCategory: emp.competenceSubcategory || '',
              departmentLevel1: emp.firstLevelDept || '',
              departmentLevel2: emp.secondLevelDept || '',
              departmentLevel3: emp.thirdLevelDept || '',
              departmentLevel4: emp.fourthLevelDept || '',
              departmentLevel5: emp.fifthLevelDept || '',
              minDepartment: emp.miniDeptName || '',
              certificateName: emp.certTitle || '',
              certificateEffectiveDate: emp.certStartTime ? new Date(emp.certStartTime).toISOString().split('T')[0] : '',
              subjectTwoPassed: emp.isPassedSubject2 === 1,
              isCadre: emp.isCadre === 1,
              cadreType: emp.cadreType || undefined,
              isExpert: undefined, // 暂无数据
              isFrontlineManager: undefined, // 暂无数据
              organizationMaturity: undefined, // 暂无数据
              positionMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
              requiredCertificate: '',
              isQualified: undefined, // 暂无数据
            })
          )

          // 构建detailData对象
          detailData.value = {
            summary: null,
            certificationRecords: certificationRecords,
            appointmentRecords: [],
            filters: {
              departmentTree: departmentOptions.value,
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
                { label: 'L2', value: 'L2' },
                { label: 'L3', value: 'L3' },
              ],
            },
          }
          // 默认显示认证标签页
          activeTab.value = 'certification'
        } else {
          // 如果没有数据，使用默认的空数据结构
          detailData.value = await fetchCertificationDetailData(props.id, {
            ...filters.value,
            departmentPath: filters.value.departmentPath?.length
              ? [...(filters.value.departmentPath ?? [])]
              : undefined,
          })
        }
      } else {
        // 使用原有的接口
        detailData.value = await fetchCertificationDetailData(props.id, {
          ...filters.value,
          departmentPath: filters.value.departmentPath?.length
            ? [...(filters.value.departmentPath ?? [])]
            : undefined,
        })
      }
    }
  } finally {
    loading.value = false
    // 查询完成后，重置用户查询标志（下次如果是首次加载，会使用路由参数）
    isUserQuery.value = false
  }
}

const handleBack = () => {
  router.push({ name: 'CertificationDashboard' })
}

// 查询按钮点击事件（用于其他筛选条件）
const handleQuery = () => {
  isUserQuery.value = true
  fetchDetail()
}

const resetFilters = () => {
  filters.value = {
    role: '0',
    maturity: '全部',
    departmentPath: [],
    jobFamily: undefined,
    jobCategory: undefined,
    jobSubCategory: undefined,
    name: undefined,
    employeeId: undefined,
  }
}

const formatBoolean = (value: boolean) => (value ? '是' : '否')

// 通用的过滤方法
const filterMethod = (value: string | string[], row: any, column: any) => {
  const property = column.property
  const cellValue = row[property]
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return true
  }
  if (cellValue === undefined || cellValue === null || cellValue === '') {
    return false
  }
  const filterValues = Array.isArray(value) ? value : [value]
  return filterValues.includes(String(cellValue))
}

// 布尔类型的过滤方法（支持多选）
const filterBooleanMethod = (value: boolean | boolean[], row: any, property: string) => {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return true
  }
  const cellValue = (row as any)[property]
  const filterValues = Array.isArray(value) ? value : [value]
  return filterValues.includes(cellValue)
}

// 获取列的过滤选项（从数据中动态提取唯一值）
const getColumnFilters = (records: AppointmentAuditRecord[], property: string) => {
  const values = new Set<string>()
  records.forEach((record) => {
    const value = (record as any)[property]
    if (value !== undefined && value !== null && value !== '') {
      values.add(String(value))
    }
  })
  return Array.from(values)
    .sort()
    .map((value) => ({ text: value, value }))
}

// 隐藏筛选面板中的确认和重置按钮
const hideFilterButtons = () => {
  const filterPanels = document.querySelectorAll('.el-table-filter')
  filterPanels.forEach((panel) => {
    // 隐藏底部区域
    const bottom = panel.querySelector('.el-table-filter__bottom') as HTMLElement
    const footer = panel.querySelector('.el-table-filter__footer') as HTMLElement
    if (bottom) {
      bottom.style.display = 'none'
      bottom.style.height = '0'
      bottom.style.padding = '0'
      bottom.style.margin = '0'
      bottom.style.visibility = 'hidden'
    }
    if (footer) {
      footer.style.display = 'none'
      footer.style.height = '0'
      footer.style.padding = '0'
      footer.style.margin = '0'
      footer.style.visibility = 'hidden'
    }
    
    // 隐藏所有按钮
    const buttons = panel.querySelectorAll('button, .el-button')
    buttons.forEach((btn) => {
      const button = btn as HTMLElement
      const classList = button.className || ''
      if (classList.includes('confirm') || 
          classList.includes('reset') || 
          classList.includes('Confirm') || 
          classList.includes('Reset') ||
          button.textContent?.includes('确认') ||
          button.textContent?.includes('重置')) {
        button.style.display = 'none'
        button.style.visibility = 'hidden'
        button.style.opacity = '0'
        button.style.height = '0'
        button.style.width = '0'
        button.style.padding = '0'
        button.style.margin = '0'
        button.style.pointerEvents = 'none'
      }
    })
  })
}

// 使用 MutationObserver 监听 DOM 变化，持续隐藏按钮
let filterObserver: MutationObserver | null = null

const setupFilterButtonObserver = () => {
  // 先执行一次隐藏
  hideFilterButtons()
  
  // 创建观察器，监听 DOM 变化
  filterObserver = new MutationObserver(() => {
    hideFilterButtons()
  })
  
  // 开始观察整个文档的变化
  filterObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
}

// 触发筛选确认
const triggerFilterConfirm = () => {
  // 查找所有筛选面板
  const filterPanels = document.querySelectorAll('.el-table-filter')
  filterPanels.forEach((panel) => {
    // 查找确认按钮（即使被隐藏）
    const confirmBtn = panel.querySelector('.el-table-filter__confirm') as HTMLElement
    if (confirmBtn) {
      // 先临时显示按钮以确保可以触发点击
      const originalDisplay = confirmBtn.style.display
      const originalVisibility = confirmBtn.style.visibility
      const originalOpacity = confirmBtn.style.opacity
      const originalPointerEvents = confirmBtn.style.pointerEvents
      
      confirmBtn.style.display = 'block'
      confirmBtn.style.visibility = 'visible'
      confirmBtn.style.opacity = '1'
      confirmBtn.style.pointerEvents = 'auto'
      
      // 触发确认按钮的点击事件
      try {
        // 使用原生 click 方法
        if (typeof confirmBtn.click === 'function') {
          confirmBtn.click()
        }
        // 也尝试 dispatchEvent
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
        confirmBtn.dispatchEvent(event)
      } catch (e) {
        console.warn('触发筛选确认失败:', e)
      } finally {
        // 恢复隐藏状态
        confirmBtn.style.display = originalDisplay
        confirmBtn.style.visibility = originalVisibility
        confirmBtn.style.opacity = originalOpacity
        confirmBtn.style.pointerEvents = originalPointerEvents
      }
    }
  })
}

// 检查筛选面板是否打开
const isFilterPanelOpen = (panel: Element): boolean => {
  // 检查面板的父元素（可能是 popper 或 dropdown）
  let parent = panel.parentElement
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent)
    // 如果父元素被隐藏，面板也不可见
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    // 检查是否是 popper 容器
    if (parent.classList.contains('el-popper') || 
        parent.classList.contains('el-table-filter__dropdown') ||
        parent.getAttribute('x-placement')) {
      // 检查 popper 是否可见
      const popperStyle = window.getComputedStyle(parent)
      return popperStyle.display !== 'none' && popperStyle.visibility !== 'hidden'
    }
    parent = parent.parentElement
  }
  // 如果面板在 body 中，检查面板本身是否可见
  const panelStyle = window.getComputedStyle(panel)
  return panelStyle.display !== 'none' && panelStyle.visibility !== 'hidden'
}

// 处理点击外部自动确认筛选
const handleDocumentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target) {
    return
  }
  
  // 检查是否点击在筛选面板内（包括筛选面板本身和其子元素）
  const filterPanel = target.closest('.el-table-filter')
  const filterDropdown = target.closest('.el-table-filter__dropdown')
  const filterContent = target.closest('.el-table-filter__content')
  const filterList = target.closest('.el-table-filter__list')
  const filterCheckbox = target.closest('.el-checkbox')
  const popper = target.closest('.el-popper')
  
  // 如果点击在筛选面板内
  if (filterPanel || filterDropdown || filterContent || filterList || (popper && popper.querySelector('.el-table-filter'))) {
    // 检查是否是点击了复选框
    if (filterCheckbox) {
      // 点击了筛选选项，延迟应用筛选（等待复选框状态更新）
      setTimeout(() => {
        triggerFilterConfirm()
      }, 150)
    }
    return
  }
  
  // 点击在筛选面板外部，查找所有打开的筛选面板并触发确认
  setTimeout(() => {
    const filterPanels = document.querySelectorAll('.el-table-filter')
    
    filterPanels.forEach((panel) => {
      // 检查面板是否打开
      if (!isFilterPanelOpen(panel)) {
        return
      }
      
      // 检查是否有选中的选项
      const checkedItems = panel.querySelectorAll('.el-checkbox.is-checked')
      if (checkedItems.length > 0) {
        // 有选中的选项，触发确认
        triggerFilterConfirm()
      } else {
        // 没有选中的选项，关闭面板
        const cancelBtn = panel.querySelector('.el-table-filter__reset') as HTMLElement
        if (cancelBtn) {
          // 临时显示按钮以确保可以触发点击
          const originalDisplay = cancelBtn.style.display
          const originalVisibility = cancelBtn.style.visibility
          const originalOpacity = cancelBtn.style.opacity
          const originalPointerEvents = cancelBtn.style.pointerEvents
          
          cancelBtn.style.display = 'block'
          cancelBtn.style.visibility = 'visible'
          cancelBtn.style.opacity = '1'
          cancelBtn.style.pointerEvents = 'auto'
          
          try {
            if (typeof cancelBtn.click === 'function') {
              cancelBtn.click()
            }
            const event = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
            })
            cancelBtn.dispatchEvent(event)
          } catch (e) {
            console.warn('关闭筛选面板失败:', e)
          } finally {
            // 恢复隐藏状态
            cancelBtn.style.display = originalDisplay
            cancelBtn.style.visibility = originalVisibility
            cancelBtn.style.opacity = originalOpacity
            cancelBtn.style.pointerEvents = originalPointerEvents
          }
        }
      }
    })
  }, 50)
}

// 过滤认证记录（根据姓名和工号）
const filteredCertificationRecords = computed(() => {
  if (!detailData.value) {
    return []
  }
  let records = detailData.value.certificationRecords
  
  // 根据姓名筛选
  if (filters.value.name && filters.value.name.trim()) {
    const nameFilter = filters.value.name.trim().toLowerCase()
    records = records.filter((record) => 
      record.name && record.name.toLowerCase().includes(nameFilter)
    )
  }
  
  // 根据工号筛选
  if (filters.value.employeeId && filters.value.employeeId.trim()) {
    const employeeIdFilter = filters.value.employeeId.trim().toLowerCase()
    records = records.filter((record) => 
      record.employeeId && record.employeeId.toLowerCase().includes(employeeIdFilter)
    )
  }
  
  return records
})

// 过滤任职记录（根据姓名和工号）
const filteredAppointmentRecords = computed(() => {
  if (!detailData.value) {
    return []
  }
  let records = detailData.value.appointmentRecords
  
  // 根据姓名筛选
  if (filters.value.name && filters.value.name.trim()) {
    const nameFilter = filters.value.name.trim().toLowerCase()
    records = records.filter((record) => 
      record.name && record.name.toLowerCase().includes(nameFilter)
    )
  }
  
  // 根据工号筛选
  if (filters.value.employeeId && filters.value.employeeId.trim()) {
    const employeeIdFilter = filters.value.employeeId.trim().toLowerCase()
    records = records.filter((record) => 
      record.employeeId && record.employeeId.toLowerCase().includes(employeeIdFilter)
    )
  }
  
  return records
})

const summaryMetrics = computed(() => {
  if (!detailData.value) return []
  // 使用过滤后的数据计算统计指标
  const certificationRecords = filteredCertificationRecords.value
  const appointmentRecords = filteredAppointmentRecords.value
  const qualifiedCount = certificationRecords.filter((item) => item.isQualified).length
  const appointmentQualified = appointmentRecords.filter((item) => item.isQualified).length

  return [
    { label: '认证记录', value: certificationRecords.length, unit: '条' },
    { label: '任职记录', value: appointmentRecords.length, unit: '条' },
    {
      label: '认证达标率',
      value: certificationRecords.length
        ? Math.round((qualifiedCount / certificationRecords.length) * 100)
        : 0,
      unit: '%',
    },
    {
      label: '任职达标率',
      value: appointmentRecords.length
        ? Math.round((appointmentQualified / appointmentRecords.length) * 100)
        : 0,
      unit: '%',
    },
  ]
})

// 移除自动触发的watch，改为手动点击查询按钮触发
// watch(
//   () => [
//     filters.value.role,
//     filters.value.maturity,
//     filters.value.departmentPath,
//     filters.value.jobFamily,
//     filters.value.jobCategory,
//     filters.value.jobSubCategory,
//   ],
//   () => {
//     // 只有这些字段变化时才重新加载数据，姓名和工号是前端过滤，不需要重新加载
//     fetchDetail()
//   },
//   { deep: true }
// )

onMounted(() => {
  initDepartmentTree()
  
  // 从路由参数中更新filters（确保路由参数已准备好）
  const departmentPathFromQuery = parseDepartmentPathFromQuery()
  if (departmentPathFromQuery.length > 0) {
    filters.value.departmentPath = departmentPathFromQuery
  }
  
  const jobCategoryFromQuery = route.query.jobCategory as string | undefined
  if (jobCategoryFromQuery) {
    filters.value.jobCategory = jobCategoryFromQuery
  }
  
  // 从路由参数中读取成熟度，如果是L5则显示为"全部"
  const maturityFromQuery = route.query.maturity as string | undefined
  if (maturityFromQuery === 'L5') {
    filters.value.maturity = '全部' // L5代表总计，显示为"全部"
  } else if (maturityFromQuery && ['全部', 'L1', 'L2', 'L3'].includes(maturityFromQuery)) {
    filters.value.maturity = maturityFromQuery as '全部' | 'L1' | 'L2' | 'L3'
  } else {
    filters.value.maturity = '全部'
  }
  
  // 根据点击的列和来源决定默认显示的标签页
  // 优先判断具体的列，再判断baseline和source参数
  const column = route.query.column as string | undefined
  const source = route.query.source as string | undefined
  
  if (column === 'appointed' || column === 'appointedByRequirement') {
    // 明确是任职相关列，默认显示任职tab
    activeTab.value = 'appointment'
  } else if (column === 'aiCertificateHolders' || column === 'certification') {
    // 明确是认证相关列，默认显示认证tab
    activeTab.value = 'certification'
  } else if (column === 'baseline') {
    // baseline在两个表格中都存在，根据source参数判断
    if (source === 'appointment') {
      // 从干部任职数据表格点击的baseline，显示任职tab
      activeTab.value = 'appointment'
    } else if (source === 'certification') {
      // 从干部认证数据表格点击的baseline，显示认证tab
      activeTab.value = 'certification'
    } else {
      // 如果没有source参数，默认显示认证tab
      activeTab.value = 'certification'
    }
  }
  
  // 添加点击监听器，实现点击页面任意位置自动确认筛选
  document.addEventListener('click', handleDocumentClick)
  
  // 设置筛选按钮观察器，持续隐藏确认和重置按钮
  nextTick(() => {
    setupFilterButtonObserver()
  })
  
  fetchDetail()
})

onActivated(() => {
  refreshDepartmentTree()
  
  // 从路由参数中更新filters（当从其他页面返回时，路由参数可能已变化）
  const departmentPathFromQuery = parseDepartmentPathFromQuery()
  if (departmentPathFromQuery.length > 0) {
    filters.value.departmentPath = departmentPathFromQuery
  }
  
  const jobCategoryFromQuery = route.query.jobCategory as string | undefined
  if (jobCategoryFromQuery) {
    filters.value.jobCategory = jobCategoryFromQuery
  }
  
  // 从路由参数中读取成熟度，如果是L5则显示为"全部"
  const maturityFromQuery = route.query.maturity as string | undefined
  if (maturityFromQuery === 'L5') {
    filters.value.maturity = '全部' // L5代表总计，显示为"全部"
  } else if (maturityFromQuery && ['全部', 'L1', 'L2', 'L3'].includes(maturityFromQuery)) {
    filters.value.maturity = maturityFromQuery as '全部' | 'L1' | 'L2' | 'L3'
  } else {
    filters.value.maturity = '全部'
  }
  
  // 添加点击监听器，实现点击页面任意位置自动确认筛选
  document.addEventListener('click', handleDocumentClick)
  
  // 设置筛选按钮观察器，持续隐藏确认和重置按钮
  nextTick(() => {
    setupFilterButtonObserver()
  })
  
  fetchDetail()
})

onBeforeUnmount(() => {
  // 移除点击监听器
  document.removeEventListener('click', handleDocumentClick)
  
  // 清理筛选按钮观察器
  if (filterObserver) {
    filterObserver.disconnect()
    filterObserver = null
  }
})
</script>

<template>
  <section class="detail-view cert-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button type="primary" text :icon="ArrowLeft" @click="handleBack">返回列表页</el-button>
        <div>
          <h2>{{ detailData?.summary?.name ?? 'AI任职认证详情' }}</h2>
          <p>
            支持六级部门级联、职位族与成熟度多维筛选，结合盘点明细掌握人才任职与认证达标情况。
          </p>
        </div>
      </div>
    </header>

    <!-- 第一行：姓名和工号筛选 -->
    <el-card shadow="hover" class="filter-card">
      <el-form :inline="true" :model="filters" label-width="90">
        <el-form-item label="姓名">
          <el-input
            v-model="filters.name"
            placeholder="请输入姓名"
            clearable
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="工号">
          <el-input
            v-model="filters.employeeId"
            placeholder="请输入工号"
            clearable
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 第二行：其他筛选条件 -->
    <el-card shadow="hover" class="filter-card">
      <el-form :inline="true" :model="filters" label-width="90">
        <el-form-item label="部门筛选">
          <el-cascader
            v-model="filters.departmentPath"
            :options="departmentOptions"
            :props="cascaderProps"
            clearable
            placeholder="可选择至六级部门"
            separator=" / "
            style="min-width: 260px"
          />
        </el-form-item>
        <el-form-item label="职位族">
          <el-select
            v-model="filters.jobFamily"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="family in detailData?.filters.jobFamilies ?? []"
              :key="family"
              :label="family"
              :value="family"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="职位类">
          <el-select
            v-model="filters.jobCategory"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option label="软件类" value="软件类" />
            <el-option label="非软件类" value="非软件类" />
          </el-select>
        </el-form-item>
        <el-form-item label="职位子类">
          <el-select
            v-model="filters.jobSubCategory"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option
              v-for="sub in detailData?.filters.jobSubCategories ?? []"
              :key="sub"
              :label="sub"
              :value="sub"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色视图">
          <el-select v-model="filters.role" placeholder="全员" style="width: 150px">
            <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="成熟度">
          <el-select v-model="filters.maturity" placeholder="全部" style="width: 140px">
            <el-option
              v-for="opt in detailData?.filters.maturityOptions ?? []"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button text type="primary" @click="resetFilters" style="margin-left: 8px">重置筛选</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-skeleton :rows="8" animated v-if="loading" />
    <template v-else-if="detailData">
      <el-card shadow="hover" class="summary-card">
        <el-row :gutter="16">
          <el-col v-for="item in summaryMetrics" :key="item.label" :xs="12" :md="6">
            <div class="summary-item">
              <p>{{ item.label }}</p>
              <h3>
                {{ item.value }}
                <small>{{ item.unit }}</small>
              </h3>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-card shadow="hover" class="detail-card">
        <el-tabs v-model="activeTab" stretch class="detail-tabs">
          <el-tab-pane label="AI 认证盘点" name="certification">
            <el-table :data="filteredCertificationRecords" border stripe height="520" highlight-current-row>
              <el-table-column prop="name" label="姓名" width="120" fixed="left" />
              <el-table-column prop="employeeId" label="工号" width="140" />
              <el-table-column prop="positionCategory" label="职位类" width="140" />
              <el-table-column prop="positionSubCategory" label="职位子类" width="140" />
              <el-table-column prop="departmentLevel1" label="一级部门" width="140" />
              <el-table-column prop="departmentLevel2" label="二级部门" width="140" />
              <el-table-column prop="departmentLevel3" label="三级部门" width="140" />
              <el-table-column prop="departmentLevel4" label="四级部门" width="140" />
              <el-table-column prop="departmentLevel5" label="五级部门" width="140" />
              <el-table-column prop="minDepartment" label="最小部门" width="160" />
              <el-table-column prop="certificateName" label="证书名称" width="160" />
              <el-table-column prop="certificateEffectiveDate" label="证书生效日期" width="160" />
              <el-table-column label="是否通过科目二" width="150">
                <template #default="{ row }">
                  <el-tag :type="row.subjectTwoPassed ? 'success' : 'info'" effect="light">
                    {{ formatBoolean(row.subjectTwoPassed) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="是否干部" width="110">
                <template #default="{ row }">
                  {{ formatBoolean(row.isCadre) }}
                </template>
              </el-table-column>
              <el-table-column prop="cadreType" label="干部类型" width="140" />
              <el-table-column label="是否专家" width="110">
                <template #default="{ row }">
                  <span v-if="row.isExpert !== undefined">{{ formatBoolean(row.isExpert) }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column label="是否基层主管" width="140">
                <template #default="{ row }">
                  <span v-if="row.isFrontlineManager !== undefined">{{ formatBoolean(row.isFrontlineManager) }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column prop="organizationMaturity" label="组织AI成熟度" width="150">
                <template #default="{ row }">
                  <span v-if="row.organizationMaturity">{{ row.organizationMaturity }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column prop="positionMaturity" label="岗位AI成熟度" width="150" />
              <el-table-column prop="requiredCertificate" label="要求持证类型" width="160" />
              <el-table-column label="是否达标" width="120">
                <template #default="{ row }">
                  <el-tag v-if="row.isQualified !== undefined" :type="row.isQualified ? 'success' : 'danger'" effect="light">
                    {{ formatBoolean(row.isQualified) }}
                  </el-tag>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="AI 任职盘点" name="appointment">
            <el-table ref="appointmentTableRef" :data="filteredAppointmentRecords" border stripe height="520" highlight-current-row>
              <el-table-column prop="name" label="姓名" width="120" fixed="left" />
              <el-table-column prop="employeeId" label="工号" width="140" />
              <el-table-column 
                prop="positionCategory" 
                label="职位类" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'positionCategory')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="departmentLevel1" 
                label="一级部门" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'departmentLevel1')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="departmentLevel2" 
                label="二级部门" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'departmentLevel2')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="departmentLevel3" 
                label="三级部门" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'departmentLevel3')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="departmentLevel4" 
                label="四级部门" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'departmentLevel4')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="departmentLevel5" 
                label="五级部门" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'departmentLevel5')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="minDepartment" 
                label="最小部门" 
                width="160" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'minDepartment')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="professionalCategory" 
                label="专业任职资格类" 
                width="180" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'professionalCategory')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="expertCategory" 
                label="专家任职资格类（仅体现AI）" 
                width="220" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'expertCategory')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="professionalSubCategory" 
                label="专业任职资格子类" 
                width="180" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'professionalSubCategory')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="qualificationDirection" 
                label="资格方向" 
                width="160" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'qualificationDirection')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="qualificationLevel" 
                label="资格级别" 
                width="160" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'qualificationLevel')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="acquisitionMethod" 
                label="获取方式" 
                width="160" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'acquisitionMethod')"
                :filter-method="filterMethod"
              />
              <el-table-column prop="effectiveDate" label="生效日期" width="150" />
              <el-table-column prop="expiryDate" label="失效日期" width="150" />
              <el-table-column 
                label="是否干部" 
                width="110" 
                sortable 
                filter-multiple
                :filters="[
                  { text: '是', value: true },
                  { text: '否', value: false },
                ]"
                :filter-method="(value: boolean | boolean[], row: AppointmentAuditRecord) => filterBooleanMethod(value, row, 'isCadre')"
              >
                <template #default="{ row }">
                  {{ formatBoolean(row.isCadre) }}
                </template>
              </el-table-column>
              <el-table-column 
                prop="cadreType" 
                label="干部类型" 
                width="140" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'cadreType')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                label="是否专家" 
                width="110" 
                sortable 
                filter-multiple
                :filters="[
                  { text: '是', value: true },
                  { text: '否', value: false },
                ]"
                :filter-method="(value: boolean | boolean[], row: AppointmentAuditRecord) => filterBooleanMethod(value, row, 'isExpert')"
              >
                <template #default="{ row }">
                  <span v-if="row.isExpert !== undefined">{{ formatBoolean(row.isExpert) }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column 
                label="是否基层主管" 
                width="140" 
                sortable 
                filter-multiple
                :filters="[
                  { text: '是', value: true },
                  { text: '否', value: false },
                ]"
                :filter-method="(value: boolean | boolean[], row: AppointmentAuditRecord) => filterBooleanMethod(value, row, 'isFrontlineManager')"
              >
                <template #default="{ row }">
                  <span v-if="row.isFrontlineManager !== undefined">{{ formatBoolean(row.isFrontlineManager) }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column 
                prop="organizationMaturity" 
                label="组织AI成熟度" 
                width="150" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'organizationMaturity')"
                :filter-method="filterMethod"
              >
                <template #default="{ row }">
                  <span v-if="row.organizationMaturity">{{ row.organizationMaturity }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column 
                prop="positionMaturity" 
                label="岗位AI成熟度" 
                width="150" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'positionMaturity')"
                :filter-method="filterMethod"
              />
              <el-table-column 
                prop="requiredCertificate" 
                label="要求持证类型" 
                width="160" 
                sortable 
                filter-multiple
                :filters="getColumnFilters(filteredAppointmentRecords, 'requiredCertificate')"
                :filter-method="filterMethod"
              >
                <template #default="{ row }">
                  <span v-if="row.requiredCertificate">{{ row.requiredCertificate }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
              <el-table-column 
                label="是否达标" 
                width="120" 
                sortable 
                filter-multiple
                :filters="[
                  { text: '是', value: true },
                  { text: '否', value: false },
                ]"
                :filter-method="(value: boolean | boolean[], row: AppointmentAuditRecord) => filterBooleanMethod(value, row, 'isQualified')"
              >
                <template #default="{ row }">
                  <el-tag v-if="row.isQualified !== undefined" :type="row.isQualified ? 'success' : 'danger'" effect="light">
                    {{ formatBoolean(row.isQualified) }}
                  </el-tag>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </template>
    <el-empty v-else description="暂无详情数据" />
  </section>
</template>

<style scoped lang="scss">
.detail-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.glass-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-lg;
  padding: $spacing-lg;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, rgba(7, 116, 221, 0.18), rgba(61, 210, 255, 0.12));
  box-shadow: 0 18px 40px rgba(7, 116, 221, 0.16);
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

.header-left {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  align-items: flex-start;
}

.filter-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;
  :deep(.el-form-item) {
    margin-right: $spacing-md;
    margin-bottom: $spacing-sm;
  }
}

.summary-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;

  .summary-item {
    padding: $spacing-md;
    border-radius: $radius-md;
    background: linear-gradient(135deg, rgba(58, 122, 254, 0.06), rgba(58, 122, 254, 0.02));

    p {
      margin: 0;
      color: $text-secondary-color;
      font-size: 13px;
    }

    h3 {
      margin: $spacing-xs 0 0;
      font-size: 22px;
      font-weight: 700;
      color: $text-main-color;

      small {
        margin-left: 4px;
        font-size: 13px;
        font-weight: 500;
        color: $text-secondary-color;
      }
    }
  }
}

.detail-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;
}

.detail-tabs {
  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    font-weight: 600;
    color: $text-secondary-color;

    &.is-active {
      color: $primary-color;
    }
  }
}

// 隐藏表格筛选面板的确认和取消按钮
// 使用更通用的选择器，确保隐藏所有筛选面板中的按钮
:deep(.el-table-filter) {
  // 隐藏底部按钮区域
  .el-table-filter__bottom {
    display: none !important;
    height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    visibility: hidden !important;
  }
  
  .el-table-filter__footer {
    display: none !important;
    height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
    visibility: hidden !important;
  }
  
  // 隐藏所有按钮（包括确认和重置）
  button,
  .el-button {
    &.el-table-filter__confirm,
    &.el-table-filter__reset {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      height: 0 !important;
      width: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      font-size: 0 !important;
      line-height: 0 !important;
      pointer-events: none !important;
    }
  }
  
  // 隐藏底部区域中的所有按钮
  .el-table-filter__bottom button,
  .el-table-filter__footer button,
  .el-table-filter__bottom .el-button,
  .el-table-filter__footer .el-button {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0 !important;
    width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    font-size: 0 !important;
    line-height: 0 !important;
    pointer-events: none !important;
  }
}

// 全局隐藏筛选面板底部的按钮区域
:deep(.el-table-filter__bottom),
:deep(.el-table-filter__footer) {
  display: none !important;
  height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
  visibility: hidden !important;
}

// 使用属性选择器隐藏所有可能的确认和重置按钮
:deep(.el-table-filter [class*="confirm"]),
:deep(.el-table-filter [class*="reset"]),
:deep(.el-table-filter [class*="Confirm"]),
:deep(.el-table-filter [class*="Reset"]),
:deep(.el-table-filter [class*="CONFIRM"]),
:deep(.el-table-filter [class*="RESET"]) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  pointer-events: none !important;
}

// 隐藏筛选面板底部区域的所有子元素
:deep(.el-table-filter__bottom *),
:deep(.el-table-filter__footer *) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  pointer-events: none !important;
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
