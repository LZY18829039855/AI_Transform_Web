<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Refresh, Search, Close, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { fetchDepartmentEmployeeTrainingOverview, fetchTrainingDetail } from '@/api/dashboard'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import { normalizeRoleOptions } from '@/constants/roles'
import { exportTrainingDetailToExcel } from '@/utils/excelExport'
import type {
  DepartmentCourseCompletionRateRow,
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
/** 部门下钻时，从看板传入的本部门训战数据行（用于展示部门训战数据表，不请求后端） */
const drillDownDepartmentRow = ref<DepartmentCourseCompletionRateRow | null>(null)

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
/** 部门训战数据表数字展示（与看板一致） */
const formatDeptNumber = (value: number | undefined) => (value ?? 0).toFixed(1)
/** 部门训战数据表百分比展示（与看板一致，一位小数） */
const formatDeptPercent = (value: number | undefined) => `${(value ?? 0).toFixed(1)}%`

const loadDrillDownDepartmentRow = () => {
  if (props.id !== 'drill-down') {
    return
  }
  // 优先从路由 state 取（点击基线人数时 router.push 传入），其次从 sessionStorage 取（兼容刷新等）
  const routeState = route.state as { departmentRow?: DepartmentCourseCompletionRateRow } | undefined
  if (routeState?.departmentRow && routeState.departmentRow.deptId != null) {
    drillDownDepartmentRow.value = routeState.departmentRow
    return
  }
  try {
    const raw = sessionStorage.getItem('training_drill_department_row')
    if (raw) {
      const row = JSON.parse(raw) as DepartmentCourseCompletionRateRow
      drillDownDepartmentRow.value = row
    } else {
      drillDownDepartmentRow.value = null
    }
  } catch (_) {
    drillDownDepartmentRow.value = null
  }
}

const handleCourseClick = (url: string) => {
  window.open(url, '_blank')
}

/** 导出数据：部门训战数据（下钻时有）+ AI训战数据明细，两个 sheet */
const handleExport = () => {
  const isDrill = isDrillDownPage.value
  const deptRow = isDrill ? drillDownDepartmentRow.value : null
  const detailList = isDrill ? filteredDrillDownRecords.value : filteredDetailRecords.value

  if (detailList.length === 0 && !deptRow) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  try {
    const fileName = deptRow?.deptName
      ? `${(deptRow.deptName || '部门').replace(/[/\\*?\[\]:]/g, '_')}_训战看板详情`
      : 'AI训战看板详情'
    exportTrainingDetailToExcel(deptRow, detailList, isDrill, fileName)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
  }
}

/** 跳转到个人训战课程详情页，使用 /completion 接口（account 工号） */
const goToPersonalDetail = (account: string) => {
  if (!account || !String(account).trim()) {
    return
  }
  router.push({
    name: 'PersonalTrainingDetail',
    query: { account: String(account).trim() },
  })
}

// 表格筛选框状态（姓名/工号，仅前端过滤当前表格数据）
const filterWrapperRef = ref()
const filterInputRef = ref()
const keywordInputRef = ref()
const showFieldDropdown = ref(false)
const showKeywordDropdown = ref(false)
const selectedField = ref<'name' | 'employeeId' | null>(null)
const keywordInput = ref('')
const filterInputValue = ref('')
const tableFilterName = ref<string | undefined>(undefined)
const tableFilterEmployeeId = ref<string | undefined>(undefined)
const isFilterBoxUpdating = ref(false)

const handleFilterInputFocus = (event: Event) => {
  event.stopPropagation()
  if (!selectedField.value) {
    showFieldDropdown.value = true
    showKeywordDropdown.value = false
  } else {
    showFieldDropdown.value = false
    showKeywordDropdown.value = true
    keywordInput.value = (selectedField.value === 'name' ? tableFilterName.value : tableFilterEmployeeId.value) || ''
    nextTick(() => {
      if (keywordInputRef.value && keywordInputRef.value.$el) {
        const inputEl = keywordInputRef.value.$el.querySelector('input')
        if (inputEl) {
          inputEl.focus()
        }
      }
    })
  }
}

const handleFieldSelect = (field: 'name' | 'employeeId') => {
  selectedField.value = field
  const fieldLabel = field === 'name' ? '姓名' : '工号'
  filterInputValue.value = fieldLabel
  showFieldDropdown.value = false
  keywordInput.value = (field === 'name' ? tableFilterName.value : tableFilterEmployeeId.value) || ''
  showKeywordDropdown.value = true
  nextTick(() => {
    if (keywordInputRef.value && keywordInputRef.value.$el) {
      const inputEl = keywordInputRef.value.$el.querySelector('input')
      if (inputEl) {
        inputEl.focus()
      }
    }
  })
}

const handleKeywordConfirm = () => {
  if (!selectedField.value) {
    return
  }
  const keyword = keywordInput.value.trim()
  isFilterBoxUpdating.value = true
  if (keyword) {
    if (selectedField.value === 'name') {
      tableFilterName.value = keyword
      tableFilterEmployeeId.value = undefined
    } else {
      tableFilterEmployeeId.value = keyword
      tableFilterName.value = undefined
    }
    filterInputValue.value = `${selectedField.value === 'name' ? '姓名' : '工号'}: ${keyword}`
  } else {
    tableFilterName.value = undefined
    tableFilterEmployeeId.value = undefined
    filterInputValue.value = ''
    selectedField.value = null
  }
  showKeywordDropdown.value = false
  nextTick(() => {
    isFilterBoxUpdating.value = false
  })
}

const handleKeywordCancel = () => {
  keywordInput.value = ''
  showKeywordDropdown.value = false
}

const handleFilterClear = () => {
  isFilterBoxUpdating.value = true
  selectedField.value = null
  filterInputValue.value = ''
  keywordInput.value = ''
  tableFilterName.value = undefined
  tableFilterEmployeeId.value = undefined
  showFieldDropdown.value = false
  showKeywordDropdown.value = false
  nextTick(() => {
    isFilterBoxUpdating.value = false
  })
}

const handleClickOutside = (event: MouseEvent) => {
  if (filterWrapperRef.value && !filterWrapperRef.value.contains(event.target as Node)) {
    showFieldDropdown.value = false
    showKeywordDropdown.value = false
  }
}

watch(
  () => [tableFilterName.value, tableFilterEmployeeId.value],
  ([name, employeeId]) => {
    if (isFilterBoxUpdating.value) {
      return
    }
    if (name && name.trim()) {
      filterInputValue.value = `姓名: ${name.trim()}`
      selectedField.value = 'name'
    } else if (employeeId && employeeId.trim()) {
      filterInputValue.value = `工号: ${employeeId.trim()}`
      selectedField.value = 'employeeId'
    } else {
      if (filterInputValue.value) {
        filterInputValue.value = ''
        selectedField.value = null
      }
    }
  },
  { immediate: true }
)

/** 部门下钻表格：按姓名、工号(employeeNumber)过滤 */
const filteredDrillDownRecords = computed(() => {
  let list = drillDownRecords.value
  if (tableFilterName.value && tableFilterName.value.trim()) {
    const kw = tableFilterName.value.trim().toLowerCase()
    list = list.filter((row) => row.name && String(row.name).toLowerCase().includes(kw))
  }
  if (tableFilterEmployeeId.value && tableFilterEmployeeId.value.trim()) {
    const kw = tableFilterEmployeeId.value.trim().toLowerCase()
    list = list.filter((row) => row.employeeNumber && String(row.employeeNumber).toLowerCase().includes(kw))
  }
  return list
})

/** 非下钻明细表格：按姓名、工号(employeeId)过滤 */
const filteredDetailRecords = computed(() => {
  if (!detailData.value) {
    return []
  }
  let list = detailData.value.records
  if (tableFilterName.value && tableFilterName.value.trim()) {
    const kw = tableFilterName.value.trim().toLowerCase()
    list = list.filter((row) => row.name && String(row.name).toLowerCase().includes(kw))
  }
  if (tableFilterEmployeeId.value && tableFilterEmployeeId.value.trim()) {
    const kw = tableFilterEmployeeId.value.trim().toLowerCase()
    list = list.filter((row) => row.employeeId && String(row.employeeId).toLowerCase().includes(kw))
  }
  return list
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
  filters.value = initFiltersFromQuery()
  nextTick(() => {
    loadDrillDownDepartmentRow()
  })
  fetchDetail()
  document.addEventListener('click', handleClickOutside)
})

onActivated(() => {
  refreshDepartmentTree()
  filters.value = initFiltersFromQuery()
  nextTick(() => {
    loadDrillDownDepartmentRow()
  })
  fetchDetail()
})

watch(
  () => [props.id, route.query.deptId],
  () => {
    if (props.id === 'drill-down') {
      nextTick(loadDrillDownDepartmentRow)
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
        <el-button
          type="primary"
          :icon="Download"
          :disabled="isDrillDownPage ? (filteredDrillDownRecords.length === 0 && !drillDownDepartmentRow) : filteredDetailRecords.length === 0"
          @click="handleExport"
        >
          导出数据
        </el-button>
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
      <!-- 部门下钻时：本部门训战数据（与部门训战数据表列一致，数据由看板传入） -->
      <el-card v-if="isDrillDownPage && drillDownDepartmentRow" shadow="hover" class="detail-block dept-summary-card">
        <template #header>
          <h3>{{ (drillDownDepartmentRow?.deptName ?? '部门') }}训战数据</h3>
        </template>
        <el-table
          :data="[drillDownDepartmentRow]"
          border
          stripe
          size="small"
          style="width: 100%"
        >
          <el-table-column prop="deptName" label="部门" min-width="100" align="center" header-align="center" />
          <el-table-column prop="baselineCount" label="基线人数" min-width="80" align="center" header-align="center" />
          <el-table-column prop="basicCourseCount" label="基础课程数" min-width="90" align="center" header-align="center" />
          <el-table-column prop="advancedCourseCount" label="进阶课程数" min-width="90" align="center" header-align="center" />
          <el-table-column prop="practicalCourseCount" label="实战课程数" min-width="90" align="center" header-align="center" />
          <el-table-column prop="basicAvgCompletedCount" label="基础课程平均完课人数" min-width="130" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptNumber(row.basicAvgCompletedCount) }}</template>
          </el-table-column>
          <el-table-column prop="advancedAvgCompletedCount" label="进阶课程平均完课人数" min-width="130" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptNumber(row.advancedAvgCompletedCount) }}</template>
          </el-table-column>
          <el-table-column prop="practicalAvgCompletedCount" label="实战课程平均完课人数" min-width="130" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptNumber(row.practicalAvgCompletedCount) }}</template>
          </el-table-column>
          <el-table-column prop="basicAvgCompletionRate" label="基础课程平均完课率" min-width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptPercent(row.basicAvgCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="advancedAvgCompletionRate" label="进阶课程平均完课率" min-width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptPercent(row.advancedAvgCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="practicalAvgCompletionRate" label="实战课程平均完课率" min-width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDeptPercent(row.practicalAvgCompletionRate) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
      <!-- AI训战数据明细：drill-down 页默认使用部门全员训战总览列（姓名、工号、职位类…目标课程完课占比） -->
      <el-card shadow="hover" class="detail-block">
        <template #header>
          <div class="detail-block-header">
            <div class="detail-block-title-wrap">
              <h3>AI 训战数据明细</h3>
              <p v-if="isDepartmentDrillDown && drillDownDeptName" class="drill-down-dept">
                部门：{{ drillDownDeptName }}
              </p>
              <p v-else-if="isDrillDownPage && !route.query.deptId" class="drill-down-dept drill-down-hint">
                请从训战看板「部门训战数据」表格中点击基线人数进入，以加载该部门全员明细。
              </p>
            </div>
            <div class="header-actions">
              <div class="filter-area">
                <div class="filter-input-wrapper" ref="filterWrapperRef">
                  <div class="filter-container">
                    <div class="filter-icon-wrapper">
                      <el-icon class="filter-icon">
                        <Search />
                      </el-icon>
                    </div>
                    <div class="filter-input-area">
                      <div class="filter-tags" v-if="filterInputValue">
                        <template v-if="filterInputValue.includes(':')">
                          <span class="filter-tag">
                            <span class="filter-tag-field">{{ filterInputValue.split(':')[0] }}</span>
                            <span class="filter-tag-separator">:</span>
                            <span class="filter-tag-value">{{ filterInputValue.split(':')[1].trim() }}</span>
                          </span>
                        </template>
                        <span v-else class="filter-tag">
                          <span class="filter-tag-field">{{ filterInputValue }}</span>
                        </span>
                      </div>
                      <div class="mainInput">
                        <input
                          ref="filterInputRef"
                          value=""
                          class="filter-input"
                          placeholder="点击此处添加筛选"
                          @focus="handleFilterInputFocus"
                          @click="handleFilterInputFocus"
                          readonly
                          @keydown.prevent
                        />
                      </div>
                    </div>
                    <button
                      v-if="filterInputValue"
                      type="button"
                      class="filter-delete-btn"
                      @click="handleFilterClear"
                      title="删除"
                    >
                      <el-icon>
                        <Close />
                      </el-icon>
                    </button>
                  </div>
                  <div v-if="showFieldDropdown" class="filter-dropdown field-dropdown" @click.stop>
                    <div class="dropdown-item" @click="handleFieldSelect('name')">
                      <span>姓名</span>
                    </div>
                    <div class="dropdown-item" @click="handleFieldSelect('employeeId')">
                      <span>工号</span>
                    </div>
                  </div>
                  <div v-if="showKeywordDropdown" class="filter-dropdown keyword-dropdown" @click.stop>
                    <div class="keyword-input-wrapper">
                      <el-input
                        v-model="keywordInput"
                        :placeholder="`请输入${selectedField === 'name' ? '姓名' : '工号'}`"
                        @keyup.enter="handleKeywordConfirm"
                        @keyup.esc="handleKeywordCancel"
                        ref="keywordInputRef"
                      />
                    </div>
                    <div class="dropdown-actions">
                      <el-button size="small" @click="handleKeywordCancel">取消</el-button>
                      <el-button type="primary" size="small" @click="handleKeywordConfirm">确认</el-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <!-- drill-down 页：始终展示部门全员训战总览表格列 -->
        <el-table
          v-if="isDrillDownPage"
          :data="filteredDrillDownRecords"
          border
          stripe
          size="small"
          style="width: 100%"
          max-height="600"
          highlight-current-row
        >
          <el-table-column label="姓名" width="100" fixed="left" align="center" header-align="center">
            <template #default="{ row }">
              <el-link type="primary" :underline="false" @click="goToPersonalDetail(row.employeeNumber)">
                {{ row.name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="employeeNumber" label="工号" width="120" align="center" header-align="center" />
          <el-table-column prop="jobCategory" label="职位类" width="100" align="center" header-align="center" />
          <el-table-column prop="jobSubcategory" label="职位子类" width="100" align="center" header-align="center" />
          <el-table-column prop="firstDept" label="一级部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="secondDept" label="二级部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="thirdDept" label="三级部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="fourthDept" label="四级部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="fifthDept" label="五级部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="lowestDept" label="最小部门" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="basicTargetCourseCount" label="基础目标课程数" width="120" align="center" header-align="center" />
          <el-table-column prop="basicCompletedCount" label="基础目标课程完课数" width="140" align="center" header-align="center" />
          <el-table-column label="基础目标课程完课占比" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatPercent(row.basicCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="advancedTargetCourseCount" label="进阶目标课程数" width="120" align="center" header-align="center" />
          <el-table-column prop="advancedCompletedCount" label="进阶目标课程完课数" width="140" align="center" header-align="center" />
          <el-table-column label="进阶目标课程完课占比" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatPercent(row.advancedCompletionRate) }}</template>
          </el-table-column>
          <el-table-column prop="totalTargetCourseCount" label="总目标课程数" width="120" align="center" header-align="center" />
          <el-table-column prop="totalCompletedCount" label="目标课程完课数" width="120" align="center" header-align="center" />
          <el-table-column label="目标课程完课占比" width="140" align="center" header-align="center">
            <template #default="{ row }">{{ formatPercent(row.totalCompletionRate) }}</template>
          </el-table-column>
        </el-table>
        <!-- 非部门下钻：原有明细表格 -->
        <el-table
          v-else
          :data="filteredDetailRecords"
          border
          stripe
          size="small"
          style="width: 100%"
          max-height="600"
          highlight-current-row
        >
          <el-table-column label="姓名" width="100" fixed="left" align="center" header-align="center">
            <template #default="{ row }">
              <el-link type="primary" :underline="false" @click="goToPersonalDetail(row.employeeId)">
                {{ row.name }}
              </el-link>
            </template>
          </el-table-column>
          <el-table-column prop="employeeId" label="工号" width="120" align="center" header-align="center" />
          <el-table-column prop="jobCategory" label="职位类" width="120" align="center" header-align="center" />
          <el-table-column prop="jobSubCategory" label="职位子类" width="120" align="center" header-align="center" />
          <el-table-column prop="departmentLevel1" label="一级部门" width="120" align="center" header-align="center" />
          <el-table-column prop="departmentLevel2" label="二级部门" width="120" align="center" header-align="center" />
          <el-table-column prop="departmentLevel3" label="三级部门" width="120" align="center" header-align="center" />
          <el-table-column prop="departmentLevel4" label="四级部门" width="120" align="center" header-align="center" />
          <el-table-column prop="departmentLevel5" label="五级部门" width="120" align="center" header-align="center" />
          <el-table-column prop="minDepartment" label="最小部门" width="150" align="center" header-align="center" />
          <el-table-column prop="trainingCategory" label="训战分类" width="120" align="center" header-align="center" />
          <el-table-column prop="courseCategory" label="课程分类" width="120" align="center" header-align="center" />
          <el-table-column prop="courseName" label="课程名称" width="200" align="center" header-align="center" />
          <el-table-column label="是否目标课程" width="130" align="center" header-align="center">
            <template #default="{ row }">
              <el-tag :type="row.isTargetCourse ? 'success' : 'info'" effect="light">
                {{ formatBoolean(row.isTargetCourse) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="是否完课" width="100" align="center" header-align="center">
            <template #default="{ row }">
              <el-tag :type="row.isCompleted ? 'success' : 'warning'" effect="light">
                {{ formatBoolean(row.isCompleted) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="completionDate" label="完课日期" width="120" align="center" header-align="center" />
          <el-table-column label="是否干部" width="100" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatBoolean(row.isCadre) }}
            </template>
          </el-table-column>
          <el-table-column prop="cadreType" label="干部类型" width="120" align="center" header-align="center" />
          <el-table-column label="是否专家" width="100" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatBoolean(row.isExpert) }}
            </template>
          </el-table-column>
          <el-table-column label="是否基层主管" width="130" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatBoolean(row.isFrontlineManager) }}
            </template>
          </el-table-column>
          <el-table-column prop="organizationMaturity" label="组织AI成熟度" width="150" align="center" header-align="center" />
          <el-table-column prop="positionMaturity" label="岗位AI成熟度" width="150" fixed="right" align="center" header-align="center" />
        </el-table>
      </el-card>

      <!-- 训战课程规划（部门下钻时不展示，因无课程规划数据） -->
      <el-card v-if="detailData" shadow="hover" class="detail-block">
        <template #header>
          <h3>训战课程规划</h3>
        </template>
        <el-table :data="detailData.coursePlans" border stripe size="small" style="width: 100%">
          <el-table-column prop="trainingCategory" label="训战分类" width="120" align="center" header-align="center" />
          <el-table-column prop="courseName" label="课程名称" min-width="200" align="center" header-align="center">
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
          <el-table-column prop="courseCode" label="课程编码" width="120" align="center" header-align="center">
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
          <el-table-column prop="targetAudience" label="目标人群" width="180" align="center" header-align="center" />
          <el-table-column prop="credits" label="学分" width="100" align="center" header-align="center" />
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

  .detail-block-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }

  .detail-block-title-wrap {
    flex: 1;
    min-width: 0;

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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .filter-area {
    position: relative;
  }

  .filter-input-wrapper {
    position: relative;
  }

  .filter-container {
    display: flex;
    border: 1px solid #d7d8da;
    border-radius: 5px;
    align-items: center;
    background: white;
    width: 280px;
    min-width: 280px;
    max-width: 280px;
    box-sizing: border-box;
  }

  .filter-icon-wrapper {
    width: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .filter-icon {
      font-size: 18px;
      color: #606266;
    }
  }

  .filter-input-area {
    flex: 1;
    min-width: 0;
    display: flex;
    overflow-x: hidden;
    overflow-y: hidden;
    align-items: center;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }

    .filter-tags {
      white-space: nowrap;
      display: flex;
      align-items: center;
      padding-left: 8px;
      flex-shrink: 0;

      .filter-tag {
        display: inline-block;
        padding: 4px 8px;
        background: #f0f2f5;
        border: 1px solid $primary-color;
        border-radius: 4px;
        font-size: 14px;
        color: #606266;
        margin-right: 8px;
      }

      .filter-tag-field {
        color: $primary-color;
        font-weight: 500;
      }

      .filter-tag-separator {
        margin: 0 4px;
        color: #606266;
      }

      .filter-tag-value {
        color: $primary-color;
        font-weight: 500;
      }
    }

    .mainInput {
      flex: 1;
      min-width: 0;
    }

    .filter-input {
      width: 100%;
      min-width: 150px;
      margin-left: 8px;
      border: none;
      outline: none;
      font-size: 14px;
      color: #606266;
      background: transparent;
      padding: 8px 0;
      cursor: pointer;

      &::placeholder {
        color: #909399;
      }

      &:focus {
        outline: none;
      }
    }
  }

  .filter-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #606266;
    padding: 0;
    flex-shrink: 0;
    transition: color 0.2s;

    &:hover {
      color: #409eff;
    }

    .el-icon {
      font-size: 12px;
    }
  }

  .filter-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: white;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    z-index: 1000;
    min-width: 280px;
    width: 280px;
  }

  .field-dropdown {
    min-width: 120px;
    width: 120px;
    text-align: left;

    .dropdown-item {
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 0.2s;
      text-align: left;

      &:hover {
        background-color: #f5f7fa;
      }

      span {
        font-size: 14px;
        color: #606266;
      }
    }
  }

  .keyword-dropdown {
    padding: 12px;
    min-width: 280px;
    width: 280px;

    .keyword-input-wrapper {
      margin-bottom: 12px;
    }

    .dropdown-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  /* 与任职认证明细表格一致：列头与内容字体、对齐统一 */
  :deep(.el-table) {
    font-size: 12px;
  }
  :deep(.el-table th) {
    font-size: 12px;
    font-weight: 700;
    color: #000;
    white-space: nowrap;
    text-align: center;
  }
  :deep(.el-table th .cell) {
    font-weight: 700;
    color: #000;
    text-align: center;
  }
  :deep(.el-table td) {
    font-size: 12px;
    white-space: nowrap;
  }
  :deep(.el-table .cell) {
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

