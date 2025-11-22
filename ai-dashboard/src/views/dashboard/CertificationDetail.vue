<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
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
const ROLE_VALUES: CertificationRole[] = ['0', '1', '2', '3']
const routeRole = route.query.role as string | undefined
const normalizedRole: CertificationRole = ROLE_VALUES.includes(routeRole as CertificationRole)
  ? (routeRole as CertificationRole)
  : '0'
const filters = ref<CertificationDetailFilters>({
  role: normalizedRole,
  maturity: '全部',
  departmentPath: [],
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
    isQualified: undefined, // 暂无数据
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
      const routeDeptCode = route.query.deptCode as string | undefined
      const deptCode = routeDeptCode || getDeptCodeFromPath(filters.value.departmentPath)
      const aiMaturity = route.query.maturity as string | undefined
      const jobCategory = route.query.jobCategory as string | undefined
      const column = route.query.column as string | undefined
      
      // 如果maturity是"全部"，则不传递该参数
      let maturityParam = aiMaturity && aiMaturity !== '全部' ? aiMaturity : undefined
      
      // 如果是总计行，将maturityParam改为L5（代表查询L2和L3的数据）
      if (maturityParam && (maturityParam === '总计' || maturityParam === '全部' || maturityParam === 'Total' || maturityParam === 'total')) {
        maturityParam = 'L5'
      }

      // 确定queryType：baseline=2（基线人数），其他=1
      const queryType = column === 'baseline' ? 2 : 1

      // 并行加载任职和认证数据（对于干部角色，无论点击哪个列，都同时加载两种数据）
      const [qualifiedResponse, certResponse] = await Promise.all([
        // 加载任职数据（如果点击的是任职相关列，使用对应的queryType；否则也加载，使用相同的参数）
        fetchCadreQualifiedDetails(
          deptCode,
          maturityParam,
          jobCategory,
          1, // personType: 1-干部
          isCadreQualifiedQuery ? queryType : 1 // 如果点击的是任职列，使用对应的queryType；否则默认查询任职人数
        ),
        // 加载认证数据（如果点击的是认证相关列，使用对应的queryType；否则也加载，使用相同的参数）
        fetchPersonCertDetails(
          deptCode,
          maturityParam,
          jobCategory,
          1, // personType: 1-干部
          isCadreCertQuery ? queryType : 1 // 如果点击的是认证列，使用对应的queryType；否则默认查询认证人数
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
            departmentLevel6: emp.sixthLevelDept || '',
            minDepartment: emp.miniDeptName || '',
            certificateName: emp.certTitle || '',
            certificateEffectiveDate: emp.certStartTime ? new Date(emp.certStartTime).toISOString().split('T')[0] : '',
            subjectTwoPassed: emp.isPassedSubject2 === 1,
            isCadre: emp.isCadre === 1,
            cadreType: emp.cadreType || undefined,
            isExpert: false,
            isFrontlineManager: false,
            organizationMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
            positionMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
            requiredCertificate: '',
            isQualified: false,
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
            { label: 'L1', value: 'L1' },
            { label: 'L2', value: 'L2' },
            { label: 'L3', value: 'L3' },
          ],
        },
      }

      // 根据点击的列决定默认显示的标签页
      // 优先判断具体的列，再判断baseline
      if (column === 'appointed' || column === 'appointedByRequirement') {
        // 明确是任职相关列，默认显示任职tab
        activeTab.value = 'appointment'
      } else if (column === 'aiCertificateHolders' || column === 'certification') {
        // 明确是认证相关列，默认显示认证tab
        activeTab.value = 'certification'
      } else if (column === 'baseline') {
        // baseline在两个表格中都存在，优先显示任职tab（因为任职表格在前）
        // 如果isCadreQualifiedQuery为true，说明可能是从任职表格点击的
        if (isCadreQualifiedQuery && !isCadreCertQuery) {
          activeTab.value = 'appointment'
        } else if (isCadreCertQuery && !isCadreQualifiedQuery) {
          activeTab.value = 'certification'
        } else {
          // 如果两个都是true（理论上不应该发生），默认显示任职tab
          activeTab.value = 'appointment'
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
        const routeDeptCode = route.query.deptCode as string | undefined
        const deptCode = routeDeptCode || getDeptCodeFromPath(filters.value.departmentPath)
        const aiMaturity = route.query.maturity as string | undefined
        const jobCategory = route.query.jobCategory as string | undefined
        
        // 如果maturity是"全部"，则不传递该参数
        let maturityParam = aiMaturity && aiMaturity !== '全部' ? aiMaturity : undefined
        
        // 如果是总计行，将maturityParam改为L5（代表查询L2和L3的数据）
        if (maturityParam && (maturityParam === '总计' || maturityParam === '全部' || maturityParam === 'Total' || maturityParam === 'total')) {
          maturityParam = 'L5'
        }
        
        // 根据column参数决定queryType：baseline=2（基线人数），aiCertificateHolders或certification=1（任职人数）
        const queryType = route.query.column === 'baseline' ? 2 : 1
        
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
              departmentLevel6: emp.sixthLevelDept || '',
              minDepartment: emp.miniDeptName || '',
              certificateName: emp.certTitle || '',
              certificateEffectiveDate: emp.certStartTime ? new Date(emp.certStartTime).toISOString().split('T')[0] : '',
              subjectTwoPassed: emp.isPassedSubject2 === 1,
              isCadre: emp.isCadre === 1,
              cadreType: emp.cadreType || undefined,
              isExpert: true,
              isFrontlineManager: false,
              organizationMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
              positionMaturity: (emp.aiMaturity as 'L1' | 'L2' | 'L3') || 'L1',
              requiredCertificate: '',
              isQualified: false,
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
                { label: 'L1', value: 'L1' },
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
  }
}

const handleBack = () => {
  router.push({ name: 'CertificationDashboard' })
}

const resetFilters = () => {
  filters.value = {
    role: '0',
    maturity: '全部',
    departmentPath: [],
    jobFamily: undefined,
    jobCategory: undefined,
    jobSubCategory: undefined,
  }
}

const formatBoolean = (value: boolean) => (value ? '是' : '否')

const summaryMetrics = computed(() => {
  if (!detailData.value) return []
  const { certificationRecords, appointmentRecords } = detailData.value
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

watch(
  filters,
  () => {
    fetchDetail()
  },
  { deep: true }
)

onMounted(() => {
  initDepartmentTree()
  // 如果是干部任职数据查询，默认显示任职标签页
  const isCadreQualifiedQuery = 
    normalizedRole === '1' && 
    route.query.column && 
    ['appointed', 'appointedByRequirement', 'baseline'].includes(route.query.column as string)
  
  if (isCadreQualifiedQuery) {
    activeTab.value = 'appointment'
  } else if (route.query.column === 'baseline') {
    activeTab.value = 'certification'
  }
  fetchDetail()
})

onActivated(() => {
  refreshDepartmentTree()
  fetchDetail()
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
            <el-option
              v-for="category in detailData?.filters.jobCategories ?? []"
              :key="category"
              :label="category"
              :value="category"
            />
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
          <el-button text type="primary" @click="resetFilters">重置筛选</el-button>
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
            <el-table :data="detailData.certificationRecords" border stripe height="520" highlight-current-row>
              <el-table-column prop="name" label="姓名" width="120" fixed="left" />
              <el-table-column prop="employeeId" label="工号" width="140" />
              <el-table-column prop="positionCategory" label="职位类" width="140" />
              <el-table-column prop="positionSubCategory" label="职位子类" width="140" />
              <el-table-column prop="departmentLevel1" label="一级部门" width="140" />
              <el-table-column prop="departmentLevel2" label="二级部门" width="140" />
              <el-table-column prop="departmentLevel3" label="三级部门" width="140" />
              <el-table-column prop="departmentLevel4" label="四级部门" width="140" />
              <el-table-column prop="departmentLevel5" label="五级部门" width="140" />
              <el-table-column prop="departmentLevel6" label="六级部门" width="140" />
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
                  {{ formatBoolean(row.isExpert) }}
                </template>
              </el-table-column>
              <el-table-column label="是否基层主管" width="140">
                <template #default="{ row }">
                  {{ formatBoolean(row.isFrontlineManager) }}
                </template>
              </el-table-column>
              <el-table-column prop="organizationMaturity" label="组织AI成熟度" width="150" />
              <el-table-column prop="positionMaturity" label="岗位AI成熟度" width="150" />
              <el-table-column prop="requiredCertificate" label="要求持证类型" width="160" />
              <el-table-column label="是否达标" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.isQualified ? 'success' : 'danger'" effect="light">
                    {{ formatBoolean(row.isQualified) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="AI 任职盘点" name="appointment">
            <el-table :data="detailData.appointmentRecords" border stripe height="520" highlight-current-row>
              <el-table-column prop="name" label="姓名" width="120" fixed="left" />
              <el-table-column prop="employeeId" label="工号" width="140" />
              <el-table-column prop="positionCategory" label="职位类" width="140" />
              <el-table-column prop="departmentLevel1" label="一级部门" width="140" />
              <el-table-column prop="departmentLevel2" label="二级部门" width="140" />
              <el-table-column prop="departmentLevel3" label="三级部门" width="140" />
              <el-table-column prop="departmentLevel4" label="四级部门" width="140" />
              <el-table-column prop="departmentLevel5" label="五级部门" width="140" />
              <el-table-column prop="minDepartment" label="最小部门" width="160" />
              <el-table-column prop="professionalCategory" label="专业任职资格类" width="180" />
              <el-table-column prop="expertCategory" label="专家任职资格类（仅体现AI）" width="220" />
              <el-table-column prop="professionalSubCategory" label="专业任职资格子类" width="180" />
              <el-table-column prop="qualificationDirection" label="资格方向" width="160" />
              <el-table-column prop="qualificationLevel" label="资格级别" width="160" />
              <el-table-column prop="acquisitionMethod" label="获取方式" width="160" />
              <el-table-column prop="effectiveDate" label="生效日期" width="150" />
              <el-table-column prop="expiryDate" label="失效日期" width="150" />
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
              <el-table-column prop="requiredCertificate" label="要求持证类型" width="160">
                <template #default="{ row }">
                  <span v-if="row.requiredCertificate">{{ row.requiredCertificate }}</span>
                  <span v-else style="color: #909399;">暂无数据</span>
                </template>
              </el-table-column>
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

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
