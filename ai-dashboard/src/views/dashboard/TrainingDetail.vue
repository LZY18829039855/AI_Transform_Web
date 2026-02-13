<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchDepartmentEmployeeTrainingOverview, fetchTrainingDetail } from '@/api/dashboard'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import { normalizeRoleOptions } from '@/constants/roles'
import type {
  DepartmentEmployeeTrainingOverviewRow,
  TrainingDetailData,
  TrainingDetailFilters,
} from '@/types/dashboard'

const props = defineProps<{ id: string }>()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const detailData = ref<TrainingDetailData | null>(null)
/** 部门下钻时，从「部门全员训战总览」接口返回的明细列表 */
const drillDownRecords = ref<DepartmentEmployeeTrainingOverviewRow[]>([])

/** 是否为 drill-down 页面（路径为 training/detail/drill-down）：该页默认使用「部门全员训战总览」表格列 */
const isDrillDownPage = computed(() => props.id === 'drill-down')
/** 是否有部门参数可请求下钻数据（有 deptId 时才调接口） */
const isDepartmentDrillDown = computed(
  () => isDrillDownPage.value && !!route.query.deptId
)
/** 部门下钻时的部门名称（用于标题展示） */
const drillDownDeptName = computed(() => (route.query.deptName as string) || '')

// 从路由参数中解析部门路径
const parseDepartmentPathFromQuery = (): string[] => {
  const departmentPathStr = route.query.departmentPath as string | undefined
  if (departmentPathStr && typeof departmentPathStr === 'string' && departmentPathStr.trim()) {
    const pathArray = departmentPathStr.split(',').filter((dept) => dept.trim().length > 0)
    return pathArray
  }
  return []
}

// 从路由参数中初始化筛选条件
const initFiltersFromQuery = (): TrainingDetailFilters => {
  return {
    role: (route.query.role as string) || '0',
    positionMaturity: (route.query.maturity as string) || '全部',
    departmentPath: parseDepartmentPathFromQuery(),
    jobFamily: (route.query.jobFamily as string) || undefined,
    jobCategory: (route.query.jobCategory as string) || undefined,
    jobSubCategory: (route.query.jobSubCategory as string) || undefined,
  }
}

const filters = ref<TrainingDetailFilters>(initFiltersFromQuery())

const {
  departmentTree: departmentOptions,
  cascaderProps,
  initDepartmentTree,
  refreshDepartmentTree,
} = useDepartmentFilter()
const roleOptions = computed(() => normalizeRoleOptions(detailData.value?.filters.roles ?? []))

const fetchDetail = async () => {
  loading.value = true
  try {
    if (isDrillDownPage.value) {
      if (route.query.deptId) {
        const deptId = route.query.deptId as string
        const personType = parseInt((route.query.role as string) || '0', 10)
        drillDownRecords.value = await fetchDepartmentEmployeeTrainingOverview(deptId, personType)
      } else {
        drillDownRecords.value = []
      }
    } else {
      detailData.value = await fetchTrainingDetail(props.id, {
        ...filters.value,
        departmentPath: filters.value.departmentPath?.length
          ? [...(filters.value.departmentPath ?? [])]
          : undefined,
      })
      drillDownRecords.value = []
    }
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push({ name: 'TrainingDashboard' })
}

const resetFilters = () => {
  filters.value = {
    role: '0',
    positionMaturity: '全部',
    departmentPath: [],
    jobFamily: undefined,
    jobCategory: undefined,
    jobSubCategory: undefined,
  }
}

const formatBoolean = (value: boolean) => (value ? '是' : '否')
/** 完课占比展示（接口已为百分比数值，保留 2 位小数） */
const formatPercent = (value: number | undefined) =>
  value != null ? `${Number(value).toFixed(2)}%` : '-'

const handleCourseClick = (url: string) => {
  window.open(url, '_blank')
}

watch(
  filters,
  () => {
    fetchDetail()
  },
  { deep: true }
)

onMounted(() => {
  initDepartmentTree()
  // 从路由参数中初始化筛选条件
  filters.value = initFiltersFromQuery()
  fetchDetail()
})

onActivated(() => {
  refreshDepartmentTree()
  // 从路由参数中初始化筛选条件（支持从其他页面返回时更新）
  filters.value = initFiltersFromQuery()
  fetchDetail()
})
</script>

<template>
  <section class="detail-view training-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button type="primary" text :icon="ArrowLeft" @click="handleBack">返回列表页</el-button>
        <div>
          <h2>AI 训战看板详情</h2>
          <p>查看训战数据明细与课程规划，支持多维度筛选，快速定位关键信息。</p>
        </div>
      </div>
      <el-space>
        <el-button type="primary" plain :icon="Refresh" @click="fetchDetail">刷新数据</el-button>
        <el-button type="primary">导出报表</el-button>
      </el-space>
    </header>

    <el-card v-if="!isDrillDownPage" shadow="hover" class="filter-card">
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
        <el-form-item label="岗位成熟度">
          <el-select v-model="filters.positionMaturity" placeholder="全部" style="width: 140px">
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
    <template v-else-if="isDrillDownPage || detailData">
      <!-- AI训战数据明细：drill-down 页默认使用部门全员训战总览列（姓名、工号、职位类…目标课程完课占比） -->
      <el-card shadow="hover" class="detail-block">
        <template #header>
          <h3>AI 训战数据明细</h3>
          <p v-if="isDepartmentDrillDown && drillDownDeptName" class="drill-down-dept">
            部门：{{ drillDownDeptName }}
          </p>
          <p v-else-if="isDrillDownPage && !route.query.deptId" class="drill-down-dept drill-down-hint">
            请从训战看板「部门训战数据」表格中点击基线人数进入，以加载该部门全员明细。
          </p>
        </template>
        <!-- drill-down 页：始终展示部门全员训战总览表格列 -->
        <el-table
          v-if="isDrillDownPage"
          :data="drillDownRecords"
          border
          stripe
          style="width: 100%"
          max-height="600"
          highlight-current-row
        >
          <el-table-column prop="name" label="姓名" width="100" fixed="left" />
          <el-table-column prop="employeeNumber" label="工号" width="120" />
          <el-table-column prop="jobCategory" label="职位类" width="100" />
          <el-table-column prop="jobSubcategory" label="职位子类" width="100" />
          <el-table-column prop="firstDept" label="一级部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="secondDept" label="二级部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="thirdDept" label="三级部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="fourthDept" label="四级部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="fifthDept" label="五级部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="lowestDept" label="最小部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="basicTargetCourseCount" label="基础目标课程数" width="120" align="center" />
          <el-table-column prop="basicCompletedCount" label="基础目标课程完课数" width="140" align="center" />
          <el-table-column label="基础目标课程完课占比" width="160" align="center">
            <template #default="{ row }">{{ formatPercent(row.basicCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="advancedTargetCourseCount" label="进阶目标课程数" width="120" align="center" />
          <el-table-column prop="advancedCompletedCount" label="进阶目标课程完课数" width="140" align="center" />
          <el-table-column label="进阶目标课程完课占比" width="160" align="center">
            <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="totalTargetCourseCount" label="总目标课程数" width="120" align="center" />
          <el-table-column prop="totalCompletedCount" label="目标课程完课数" width="120" align="center" />
          <el-table-column label="目标课程完课占比" width="140" align="center">
            <template #default="{ row }">{{ formatPercent(row.totalCompletionRate) }}</template>
          </el-table-column>
        </el-table>
        <!-- 非部门下钻：原有明细表格 -->
        <el-table
          v-else
          :data="detailData!.records"
          border
          stripe
          style="width: 100%"
          max-height="600"
          highlight-current-row
        >
          <el-table-column prop="name" label="姓名" width="100" fixed="left" />
          <el-table-column prop="employeeId" label="工号" width="120" />
          <el-table-column prop="jobCategory" label="职位类" width="120" />
          <el-table-column prop="jobSubCategory" label="职位子类" width="120" />
          <el-table-column prop="departmentLevel1" label="一级部门" width="120" />
          <el-table-column prop="departmentLevel2" label="二级部门" width="120" />
          <el-table-column prop="departmentLevel3" label="三级部门" width="120" />
          <el-table-column prop="departmentLevel4" label="四级部门" width="120" />
          <el-table-column prop="departmentLevel5" label="五级部门" width="120" />
          <el-table-column prop="minDepartment" label="最小部门" width="150" />
          <el-table-column prop="trainingCategory" label="训战分类" width="120" />
          <el-table-column prop="courseCategory" label="课程分类" width="120" />
          <el-table-column prop="courseName" label="课程名称" width="200" />
          <el-table-column label="是否目标课程" width="130">
            <template #default="{ row }">
              <el-tag :type="row.isTargetCourse ? 'success' : 'info'" effect="light">
                {{ formatBoolean(row.isTargetCourse) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="是否完课" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isCompleted ? 'success' : 'warning'" effect="light">
                {{ formatBoolean(row.isCompleted) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="completionDate" label="完课日期" width="120" />
          <el-table-column label="是否干部" width="100">
            <template #default="{ row }">
              {{ formatBoolean(row.isCadre) }}
            </template>
          </el-table-column>
          <el-table-column prop="cadreType" label="干部类型" width="120" />
          <el-table-column label="是否专家" width="100">
            <template #default="{ row }">
              {{ formatBoolean(row.isExpert) }}
            </template>
          </el-table-column>
          <el-table-column label="是否基层主管" width="130">
            <template #default="{ row }">
              {{ formatBoolean(row.isFrontlineManager) }}
            </template>
          </el-table-column>
          <el-table-column prop="organizationMaturity" label="组织AI成熟度" width="150" />
          <el-table-column prop="positionMaturity" label="岗位AI成熟度" width="150" fixed="right" />
        </el-table>
      </el-card>

      <!-- 训战课程规划（部门下钻时不展示，因无课程规划数据） -->
      <el-card v-if="detailData" shadow="hover" class="detail-block">
        <template #header>
          <h3>训战课程规划</h3>
        </template>
        <el-table :data="detailData.coursePlans" border stripe style="width: 100%">
          <el-table-column prop="trainingCategory" label="训战分类" width="120" />
          <el-table-column prop="courseName" label="课程名称" min-width="200">
            <template #default="{ row }">
              <el-link
                type="primary"
                :href="row.courseUrl"
                target="_blank"
                @click.prevent="handleCourseClick(row.courseUrl)"
              >
                {{ row.courseName }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="courseCode" label="课程编码" width="120">
            <template #default="{ row }">
              <el-link
                type="primary"
                :href="row.courseUrl"
                target="_blank"
                @click.prevent="handleCourseClick(row.courseUrl)"
              >
                {{ row.courseCode }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="targetAudience" label="目标人群" width="180" />
          <el-table-column prop="credits" label="学分" width="100" />
        </el-table>
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
    max-width: 560px;
    color: #000;
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

.detail-block {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .drill-down-dept {
    margin: $spacing-xs 0 0;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.7);
  }
  .drill-down-hint {
    color: rgba(0, 0, 0, 0.55);
    font-size: 13px;
  }
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

