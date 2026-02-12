<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElCard, ElCascader, ElEmpty, ElForm, ElFormItem, ElLink, ElMessage, ElSelect, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { Medal } from '@element-plus/icons-vue'
import { fetchCoursePlanningInfoList, fetchDepartmentCompletionRate, fetchTrainingDashboard } from '@/api/dashboard'
import { exportCoursePlanningToExcel } from '@/utils/excelExport'
import { normalizeRoleOptions } from '@/constants/roles'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import type {
  DepartmentCourseCompletionRateRow,
  TrainingAllStaffSummaryGroup,
  TrainingAllStaffSummaryRow,
  TrainingDashboardData,
  TrainingDashboardFilters,
  TrainingExpertCadreSummaryRow,
  TrainingPersonalOverviewRow,
  TrainingRoleSummaryRow,
  DepartmentSelection,
} from '@/types/dashboard'

const router = useRouter()
const loading = ref(false)
const dashboardData = ref<TrainingDashboardData | null>(null)
const departmentCompletionList = ref<DepartmentCourseCompletionRateRow[]>([])
/** 全员训战总览表 - 角色视图，当前仅「全员」对应 personType=0 */
const departmentCompletionRole = ref('0')

const filters = reactive<TrainingDashboardFilters>({
  departmentPath: [],
  role: '0',
})

const {
  departmentTree: departmentOptions,
  cascaderProps,
  initDepartmentTree,
  refreshDepartmentTree,
} = useDepartmentFilter()
const roleOptions = computed(() => normalizeRoleOptions(dashboardData.value?.filters.roles ?? []))

const DOWNLOAD_RESOURCES = [
  {
    id: 'rules',
    title: '训战课程规划表',
    description: '查看最新训战规则与学分明细',
    href: 'https://example.com/docs/ai-training-rules.xlsx',
  },
] as const

const handlePlanningDetailClick = () => {
  router.push({ name: 'TrainingPlanningDetail' })
}

const handlePlanningClick = async () => {
  try {
    // 获取课程规划明细数据
    const planningData = await fetchCoursePlanningInfoList()
    if (planningData.length === 0) {
      ElMessage.warning('暂无数据可下载')
      return
    }

    // 提取所有出现的部门作为表头列
    const deptMap = new Map<string, string>()
    planningData.forEach(course => {
      if (course.selectedDepts && course.selectedDepts.length > 0) {
        course.selectedDepts.forEach(dept => {
          deptMap.set(dept.deptCode, dept.deptName)
        })
      }
    })
    
    // 转换为数组并排序
    const departmentColumns: DepartmentSelection[] = Array.from(deptMap.entries()).map(([deptCode, deptName]) => ({
      deptCode,
      deptName
    })).sort((a, b) => a.deptCode.localeCompare(b.deptCode))

    // 导出Excel
    exportCoursePlanningToExcel(planningData, departmentColumns, '训战课程规划明细')
    ElMessage.success('下载成功')
  } catch (error) {
    console.error('下载课程规划明细失败：', error)
    ElMessage.error('下载失败，请稍后重试')
  }
}

/** 部门筛选框选中的部门 ID，作为全员训战查询接口 /department-completion-rate 的 deptId 参数；未选部门时传 '0' */
const resolveDeptIdForCompletionRate = (): string => {
  const path = filters.departmentPath
  if (!path || path.length === 0) {
    return '0'
  }
  const selectedDeptId = path[path.length - 1]
  return (selectedDeptId != null && String(selectedDeptId).trim() !== '')
    ? String(selectedDeptId)
    : '0'
}

const fetchData = async () => {
  loading.value = true
  try {
    const payload: TrainingDashboardFilters = {
      role: filters.role,
      departmentPath: filters.departmentPath?.length ? [...filters.departmentPath] : undefined,
    }
    dashboardData.value = await fetchTrainingDashboard(payload)

    const deptId = resolveDeptIdForCompletionRate()
    const personType = parseInt(departmentCompletionRole.value, 10) || 0
    departmentCompletionList.value = await fetchDepartmentCompletionRate(deptId, personType)
  } catch (error) {
    console.error('获取训战看板数据失败：', error)
    ElMessage.error('获取数据失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

watch(
  () => [filters.role, filters.departmentPath, departmentCompletionRole.value],
  () => {
    fetchData()
  },
  { deep: true }
)

const resetFilters = () => {
  filters.role = '0'
  filters.departmentPath = []
}

const goToDetail = (query: Record<string, string | undefined>) => {
  router.push({
    name: 'TrainingDetail',
    params: { id: 'drill-down' },
    query,
  })
}

const handlePersonalDrill = (row: TrainingPersonalOverviewRow, field: string) => {
  // 跳转到个人训战课程详情页
  router.push({ name: 'PersonalTrainingDetail' })
}

const handleRoleSummaryDrill = (
  row: TrainingRoleSummaryRow,
  roleType: 'expert' | 'cadre',
  field: string
) => {
  goToDetail({
    type: roleType,
    maturityLevel: row.maturityLevel,
    metric: field,
    role: filters.role,
  })
}

const handleExpertCadreDrill = (row: TrainingExpertCadreSummaryRow, field: string) => {
  goToDetail({
    type: 'expertCadre',
    dimension: row.dimension,
    metric: field,
    role: filters.role,
  })
}

const handleAllStaffDrill = (
  group: TrainingAllStaffSummaryGroup,
  row: TrainingAllStaffSummaryRow,
  field: string
) => {
  goToDetail({
    type: 'allStaff',
    group: group.title,
    dimension: row.dimension,
    metric: field,
    role: filters.role,
  })
}

const formatPercent = (value: number) => `${(value ?? 0).toFixed(1)}%`
const formatNumber = (value: number) => (value ?? 0).toFixed(1)

onMounted(() => {
  initDepartmentTree()
  fetchData()
})

onActivated(() => {
  // 确保在组件激活时也初始化部门树（如果还未初始化）
  if (!departmentOptions.value || departmentOptions.value.length === 0) {
    initDepartmentTree()
  } else {
    refreshDepartmentTree()
  }
  // 确保每次激活时都重新获取数据
  fetchData()
})

defineExpose({
  filters,
  departmentOptions,
  loading,
  dashboardData,
  fetchData,
  resetFilters,
  handlePersonalDrill,
  handleRoleSummaryDrill,
  handleExpertCadreDrill,
  handleAllStaffDrill,
  formatPercent,
  formatNumber,
})
</script>

<template>
  <section class="dashboard training-dashboard">
    <header class="dashboard__header glass-card">
      <div class="header-info">
        <h2>AI 训战看板</h2>
        <p>
          聚焦专家、干部与全员的训战执行态势，通过部门与角色筛选快速定位短板，支持关键指标下钻查看详情。
        </p>
      </div>
    </header>

    <el-card shadow="hover" class="download-resource-card" @click="handlePlanningDetailClick">
      <article class="download-resource-card__item">
        <h4>{{ DOWNLOAD_RESOURCES[0].title }}</h4>
        <p>{{ DOWNLOAD_RESOURCES[0].description }}</p>
        <el-button type="primary" @click.stop="handlePlanningClick">下载明细</el-button>
      </article>
    </el-card>

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

    <el-skeleton v-if="loading" :rows="10" animated />
    <template v-else>
      <template v-if="dashboardData">
        <el-card shadow="hover" class="overview-card">
          <template #header>
            <h3>个人训战总览</h3>
          </template>
          <el-table 
            :data="dashboardData.personalOverview" 
            border
            style="width: 100%"
            :header-cell-class-name="() => 'personal-overview-header'"
            :row-class-name="({ row }) => row.classification === '总计' ? 'personal-overview-total-row' : ''"
          >
            <el-table-column prop="classification" label="训战分类" min-width="120" align="center" />
            <el-table-column prop="courseTotal" label="课程总数" min-width="140" align="center">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'courseTotal')">
                  {{ row.courseTotal }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="targetCompleted" label="目标完课数" min-width="140" align="center">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'targetCompleted')">
                  {{ row.targetCompleted }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="actualCompleted" label="实际完课数" min-width="140" align="center">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'actualCompleted')">
                  {{ row.actualCompleted }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="completionRate" label="目标课程完课占比" min-width="180" align="center">
              <template #default="{ row }">{{ formatPercent(row.completionRate) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 全员训战总览表：样式参考任职认证看板-全员任职/认证趋势 -->
        <el-card shadow="hover" class="charts-section">
          <template #header>
            <div class="charts-header">
              <div class="charts-title">
                <el-icon><Medal /></el-icon>
                <div>
                  <h3>全员训战总览表</h3>
                  <p>聚焦专家、干部与全员的训战执行态势，通过部门与角色筛选快速定位短板，支持关键指标下钻查看详情。</p>
                </div>
              </div>
              <div class="charts-filter">
                <el-form :inline="true" label-width="80">
                  <el-form-item label="角色视图">
                    <el-select v-model="departmentCompletionRole" placeholder="全员" style="width: 200px">
                      <el-option label="全员" value="0" />
                    </el-select>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </template>
          <el-row :gutter="16">
            <el-col :xs="24" :sm="24" :md="24" :lg="24">
              <el-card shadow="hover" class="chart-card">
                <template #header>
                  <div class="card-header">
                    <h3>部门训战数据</h3>
                  </div>
                </template>
                <el-table
                  v-if="departmentCompletionList.length > 0"
                  :data="departmentCompletionList"
                  border
                  stripe
                  size="small"
                  :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52' }"
                  style="width: 100%"
                >
                  <el-table-column prop="deptName" label="部门" min-width="140" align="center" header-align="center" />
                  <el-table-column prop="baselineCount" label="基线人数" min-width="100" align="center" header-align="center" />
                  <el-table-column prop="basicCourseCount" label="基础课程数" min-width="120" align="center" header-align="center" />
                  <el-table-column prop="advancedCourseCount" label="进阶课程数" min-width="120" align="center" header-align="center" />
                  <el-table-column prop="practicalCourseCount" label="实战课程数" min-width="120" align="center" header-align="center" />
                  <el-table-column prop="basicAvgCompletedCount" label="基础课程平均完课人数" min-width="180" align="center" header-align="center">
                    <template #default="{ row }">{{ formatNumber(row.basicAvgCompletedCount) }}</template>
                  </el-table-column>
                  <el-table-column prop="advancedAvgCompletedCount" label="进阶课程平均完课人数" min-width="180" align="center" header-align="center">
                    <template #default="{ row }">{{ formatNumber(row.advancedAvgCompletedCount) }}</template>
                  </el-table-column>
                  <el-table-column prop="practicalAvgCompletedCount" label="实战课程平均完课人数" min-width="180" align="center" header-align="center">
                    <template #default="{ row }">{{ formatNumber(row.practicalAvgCompletedCount) }}</template>
                  </el-table-column>
                  <el-table-column prop="basicAvgCompletionRate" label="基础课程平均完课率" min-width="160" align="center" header-align="center">
                    <template #default="{ row }">{{ formatPercent(row.basicAvgCompletionRate) }}</template>
                  </el-table-column>
                  <el-table-column prop="advancedAvgCompletionRate" label="进阶课程平均完课率" min-width="160" align="center" header-align="center">
                    <template #default="{ row }">{{ formatPercent(row.advancedAvgCompletionRate) }}</template>
                  </el-table-column>
                  <el-table-column prop="practicalAvgCompletionRate" label="实战课程平均完课率" min-width="160" align="center" header-align="center">
                    <template #default="{ row }">{{ formatPercent(row.practicalAvgCompletionRate) }}</template>
                  </el-table-column>
                </el-table>
                <el-empty v-else-if="!loading" description="暂无数据" :image-size="80" />
              </el-card>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="hover" class="summary-card">
          <template #header>
            <h3>专家训战总览</h3>
          </template>
          <el-table :data="dashboardData.expertSummary" border>
            <el-table-column prop="maturityLevel" label="专家岗位成熟度等级" width="160" />
            <el-table-column prop="personCount" label="专家人数" width="120">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'personCount')">
                  {{ row.personCount }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCourses" label="初阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'beginnerCourses')">
                  {{ row.beginnerCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateCourses" label="中阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'intermediateCourses')">
                  {{ row.intermediateCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedCourses" label="高阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'advancedCourses')">
                  {{ row.advancedCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceCourses" label="实战课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'practiceCourses')">
                  {{ row.practiceCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerAvgLearners" label="初阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'beginnerAvgLearners')">
                  {{ formatNumber(row.beginnerAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateAvgLearners" label="中阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'intermediateAvgLearners')">
                  {{ formatNumber(row.intermediateAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedAvgLearners" label="高阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'advancedAvgLearners')">
                  {{ formatNumber(row.advancedAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceAvgLearners" label="实战平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'expert', 'practiceAvgLearners')">
                  {{ formatNumber(row.practiceAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCompletionRate" label="初阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.beginnerCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="intermediateCompletionRate" label="中阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.intermediateCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="advancedCompletionRate" label="高阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="practiceCompletionRate" label="实战平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.practiceCompletionRate) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="hover" class="summary-card">
          <template #header>
            <h3>干部训战总览</h3>
          </template>
          <el-table :data="dashboardData.cadreSummary" border>
            <el-table-column prop="maturityLevel" label="干部岗位成熟度等级" width="160" />
            <el-table-column prop="personCount" label="干部人数" width="120">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'personCount')">
                  {{ row.personCount }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCourses" label="初阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'beginnerCourses')">
                  {{ row.beginnerCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateCourses" label="中阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'intermediateCourses')">
                  {{ row.intermediateCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedCourses" label="高阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'advancedCourses')">
                  {{ row.advancedCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceCourses" label="实战课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'practiceCourses')">
                  {{ row.practiceCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerAvgLearners" label="初阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'beginnerAvgLearners')">
                  {{ formatNumber(row.beginnerAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateAvgLearners" label="中阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'intermediateAvgLearners')">
                  {{ formatNumber(row.intermediateAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedAvgLearners" label="高阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'advancedAvgLearners')">
                  {{ formatNumber(row.advancedAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceAvgLearners" label="实战平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleRoleSummaryDrill(row, 'cadre', 'practiceAvgLearners')">
                  {{ formatNumber(row.practiceAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCompletionRate" label="初阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.beginnerCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="intermediateCompletionRate" label="中阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.intermediateCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="advancedCompletionRate" label="高阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="practiceCompletionRate" label="实战平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.practiceCompletionRate) }}</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="hover" class="summary-card">
        <template #header>
            <h3>专家干部训战总览表</h3>
          </template>
          <el-table :data="dashboardData.expertCadreSummary.rows" border>
            <el-table-column :label="dashboardData.expertCadreSummary.dimensionLabel" prop="dimension" width="140" />
            <el-table-column prop="personCount" label="专家干部人数" width="150">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'personCount')">
                  {{ row.personCount }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCourses" label="初阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'beginnerCourses')">
                  {{ row.beginnerCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateCourses" label="中阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'intermediateCourses')">
                  {{ row.intermediateCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedCourses" label="高阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'advancedCourses')">
                  {{ row.advancedCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceCourses" label="实战课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'practiceCourses')">
                  {{ row.practiceCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerAvgLearners" label="初阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'beginnerAvgLearners')">
                  {{ formatNumber(row.beginnerAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateAvgLearners" label="中阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'intermediateAvgLearners')">
                  {{ formatNumber(row.intermediateAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedAvgLearners" label="高阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'advancedAvgLearners')">
                  {{ formatNumber(row.advancedAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceAvgLearners" label="实战平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleExpertCadreDrill(row, 'practiceAvgLearners')">
                  {{ formatNumber(row.practiceAvgLearners) }}
                </el-button>
        </template>
            </el-table-column>
            <el-table-column prop="beginnerCompletionRate" label="初阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.beginnerCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="intermediateCompletionRate" label="中阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.intermediateCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="advancedCompletionRate" label="高阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="practiceCompletionRate" label="实战平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.practiceCompletionRate) }}</template>
            </el-table-column>
          </el-table>
            </el-card>

        <el-card
          v-for="group in dashboardData.allStaffSummary.groups"
          :key="group.title"
          shadow="hover"
          class="summary-card"
        >
          <template #header>
            <h3>全员训战总览 - {{ group.title }}</h3>
          </template>
          <el-table :data="group.rows" border>
            <el-table-column :label="group.dimensionLabel" prop="dimension" width="140" />
            <el-table-column prop="baseline" label="基线人数" width="120">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'baseline')">
                  {{ row.baseline }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCourses" label="初阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'beginnerCourses')">
                  {{ row.beginnerCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateCourses" label="中阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'intermediateCourses')">
                  {{ row.intermediateCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedCourses" label="高阶课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'advancedCourses')">
                  {{ row.advancedCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceCourses" label="实战课程数" width="130">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'practiceCourses')">
                  {{ row.practiceCourses }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerAvgLearners" label="初阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'beginnerAvgLearners')">
                  {{ formatNumber(row.beginnerAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="intermediateAvgLearners" label="中阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'intermediateAvgLearners')">
                  {{ formatNumber(row.intermediateAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="advancedAvgLearners" label="高阶平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'advancedAvgLearners')">
                  {{ formatNumber(row.advancedAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="practiceAvgLearners" label="实战平均完课人数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handleAllStaffDrill(group, row, 'practiceAvgLearners')">
                  {{ formatNumber(row.practiceAvgLearners) }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="beginnerCompletionRate" label="初阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.beginnerCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="intermediateCompletionRate" label="中阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.intermediateCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="advancedCompletionRate" label="高阶平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
            </el-table-column>
            <el-table-column prop="practiceCompletionRate" label="实战平均完课率" width="150">
              <template #default="{ row }">{{ formatPercent(row.practiceCompletionRate) }}</template>
            </el-table-column>
          </el-table>
      </el-card>
      </template>
      <el-empty v-else description="暂无数据，请调整筛选条件后重试" />
    </template>
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
  background: linear-gradient(135deg, rgba(58, 122, 254, 0.18), rgba(14, 170, 194, 0.16));
  box-shadow: 0 18px 45px rgba(58, 122, 254, 0.12);
  padding: $spacing-lg;
  color: #000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: $spacing-lg;

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
  max-width: 720px;
}

.download-resource-card {
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(58, 122, 254, 0.15);
    transform: translateY(-2px);
  }

  &__item {
    border-radius: $radius-lg;
    background: rgba(58, 122, 254, 0.08);
    padding: $spacing-lg;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    width: 100%;

    h4 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: $text-main-color;
      flex-shrink: 0;
    }

    p {
      margin: 0;
      color: $text-secondary-color;
      flex: 1;
    }
  }
}

.resource-card {
  border: none;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 4px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: $text-main-color;
    }

    p {
      margin: 0;
      color: $text-secondary-color;
    }
  }
}

.resource-table {
  &__title {
    display: flex;
    flex-direction: column;
    gap: 4px;

    strong {
      font-size: 14px;
      color: $text-main-color;
    }

    p {
      margin: 0;
      color: $text-secondary-color;
      font-size: 12px;
    }
  }
}

.filter-card {
  border: none;

  .el-form-item {
    margin-right: $spacing-md;
  }
}

.overview-card {
  border: none;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.summary-card {
  border: none;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.drill-link {
  font-weight: 600;
  padding: 0;
  border-radius: 0;
  color: $primary-color;
  background: transparent;

  &.is-link {
    color: $primary-color;
  }

  &:hover {
    background: transparent;
    text-decoration: underline;
  }
}

// 个人训战总览表格样式
.overview-card {
  :deep(.el-card__body) {
    padding: 20px;
  }

  :deep(.el-table) {
    width: 100%;

    .el-table__header-wrapper {
      .el-table__header {
        width: 100%;

        th {
          text-align: center;
          font-weight: 700;
          font-size: 16px;
          color: #000;
        }
      }
    }

    .el-table__body-wrapper {
      .el-table__body {
        width: 100%;

        td {
          text-align: center;
        }

        tr.personal-overview-total-row {
          td {
            font-weight: 700;
            font-size: 16px;
            color: #000;
          }
        }
      }
    }
  }
}

// 全员训战总览表：样式参考任职认证看板-全员任职/认证趋势
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

    :deep(.el-form-item__label) {
      font-weight: 600;
      font-size: 16px;
    }
  }

  .chart-card {
    border: none;
    border-radius: $radius-lg;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: $shadow-card;

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: $text-main-color;
      }
    }

    .clickable-cell {
      cursor: pointer;
    }

    :deep(.el-table) {
      --el-table-border-color: rgba(47, 59, 82, 0.08);
      --el-table-row-hover-bg-color: rgba(58, 122, 254, 0.08);
      width: 100%;

      .summary-row {
        background-color: rgba(58, 122, 254, 0.1) !important;
        font-weight: bold !important;

        td {
          background-color: rgba(58, 122, 254, 0.1) !important;
          font-weight: bold !important;

          .cell {
            font-weight: bold !important;
            font-size: 14px !important;
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .download-resource-card__item {
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-sm;
  }
}
</style>

