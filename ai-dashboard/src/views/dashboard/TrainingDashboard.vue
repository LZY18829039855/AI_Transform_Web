<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElButton, ElCard, ElCascader, ElEmpty, ElForm, ElFormItem, ElLink, ElSelect, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { fetchTrainingDashboard } from '@/api/dashboard'
import { normalizeRoleOptions } from '@/constants/roles'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import type {
  TrainingAllStaffSummaryGroup,
  TrainingAllStaffSummaryRow,
  TrainingDashboardData,
  TrainingDashboardFilters,
  TrainingExpertCadreSummaryRow,
  TrainingPersonalOverviewRow,
  TrainingPlanningResource,
  TrainingRoleSummaryRow,
} from '@/types/dashboard'

const router = useRouter()
const loading = ref(false)
const dashboardData = ref<TrainingDashboardData | null>(null)

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
const planningResources = computed<TrainingPlanningResource[]>(() => dashboardData.value?.planningResources ?? [])

const fetchData = async () => {
  loading.value = true
  try {
    const payload: TrainingDashboardFilters = {
      role: filters.role,
      departmentPath: filters.departmentPath?.length ? [...filters.departmentPath] : undefined,
    }
    dashboardData.value = await fetchTrainingDashboard(payload)
  } finally {
    loading.value = false
  }
}

watch(
  () => [filters.role, filters.departmentPath],
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
  goToDetail({
    type: 'personal',
    classification: row.classification,
    metric: field,
    role: filters.role,
  })
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
  refreshDepartmentTree()
  fetchData()
})

defineExpose({
  filters,
  departmentOptions,
  roleOptions,
  planningResources,
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

    <el-card shadow="hover" class="resource-card">
      <template #header>
        <div class="resource-card__header">
          <h3>训战课程规划表</h3>
          <p>下载最新训战规划、重点岗位方案与实战日历。</p>
        </div>
      </template>
      <el-table :data="planningResources" class="resource-table" border>
        <el-table-column prop="title" label="文档名称" min-width="260">
          <template #default="{ row }">
            <div class="resource-table__title">
              <strong>{{ row.title }}</strong>
              <p v-if="row.description">{{ row.description }}</p>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="owner" label="责任部门" width="180" />
        <el-table-column prop="updatedAt" label="更新时间" width="180" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-link type="primary" :href="row.downloadUrl" target="_blank">下载</el-link>
          </template>
        </el-table-column>
      </el-table>
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
        <el-form-item label="角色视图">
          <el-select v-model="filters.role" placeholder="全员" style="width: 180px">
            <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
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
          <el-table :data="dashboardData.personalOverview" border>
            <el-table-column prop="classification" label="训练分类" width="120" />
            <el-table-column prop="courseTotal" label="课程总数" width="140">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'courseTotal')">
                  {{ row.courseTotal }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="targetCompleted" label="目标完成课数" width="160">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'targetCompleted')">
                  {{ row.targetCompleted }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="actualCompleted" label="实际完课数" width="140">
              <template #default="{ row }">
                <el-button link class="drill-link" @click="handlePersonalDrill(row, 'actualCompleted')">
                  {{ row.actualCompleted }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column prop="completionRate" label="完课占比">
              <template #default="{ row }">{{ formatPercent(row.completionRate) }}</template>
            </el-table-column>
          </el-table>
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
    max-width: 720px;
  }
}

.header-info {
  max-width: 720px;
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

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

