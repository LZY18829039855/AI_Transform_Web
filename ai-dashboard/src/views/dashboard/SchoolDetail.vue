<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Close, Download, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { fetchSchoolDetailData } from '@/api/dashboard'
import { fetchAllSchoolCreditRecords } from '@/api/dashboard_credit'
import { useDepartmentFilter } from '@/composables/useDepartmentFilter'
import { exportSchoolCreditDetailToExcel } from '@/utils/excelExport'
import type { SchoolCreditDetailRequest, SchoolDetailData, SchoolDetailFilters } from '@/types/dashboard'
import { normalizeRoleOptions } from '@/constants/roles'

const props = defineProps<{ id: string }>()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const exporting = ref(false)
const detailData = ref<SchoolDetailData | null>(null)
const hideRoleAndDept = computed(() => route.query.hideRoleAndDept === 'true')
const pageNum = ref(1)
const pageSize = ref(50)
const records = computed(() => detailData.value?.records ?? [])
const total = computed(() => detailData.value?.total ?? 0)

// 从 URL query 参数初始化 filters
const initFiltersFromQuery = (): SchoolDetailFilters => {
  const query = route.query
  const filters: SchoolDetailFilters = {
    role: (query.role as string) || '0',
    positionMaturity: '全部',
    departmentPath: [],
  }

  if (query.deptCode && query.deptCode !== '0') {
    filters.deptCode = query.deptCode as string
    filters.departmentPath = [query.deptCode as string]
  }

  if (query.deptLevel) {
    filters.deptLevel = parseInt(query.deptLevel as string, 10)
  }

  if (query.jobCategory) {
    filters.jobCategory = query.jobCategory as string
  }

  if (query.positionMaturity && String(query.positionMaturity).trim() !== '') {
    // 支持从下钻链接直接带入岗位成熟度（L1/L2/L3）
    filters.positionMaturity = query.positionMaturity as SchoolDetailFilters['positionMaturity']
  }

  return filters
}

const filters = ref<SchoolDetailFilters>(initFiltersFromQuery())

const {
  departmentTree,
  cascaderProps,
  initDepartmentTree,
  refreshDepartmentTree,
} = useDepartmentFilter()

const roleOptions = computed(() => normalizeRoleOptions(detailData.value?.filters.roles ?? []))

const fetchDetail = async () => {
  loading.value = true
  try {
    detailData.value = await fetchSchoolDetailData(props.id, {
      ...filters.value,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    if (detailData.value) {
      pageNum.value = detailData.value.pageNum ?? pageNum.value
      pageSize.value = detailData.value.pageSize ?? pageSize.value
    }
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push({ name: 'SchoolDashboard' })
}

const handleFilterChange = () => {
  pageNum.value = 1
  fetchDetail()
}

/** 点击姓名，以 employeeId 作为 account 在新标签打开个人训战课程详情页 */
const handleNameDrill = (employeeId: string) => {
  const resolved = router.resolve({
    name: 'SchoolPersonalTrainingDetail',
    query: { account: employeeId },
  })
  window.open(resolved.href, '_blank', 'noopener,noreferrer')
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const handlePageChange = (page: number) => {
  pageNum.value = page
  fetchDetail()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  pageNum.value = 1
  fetchDetail()
}

// 表格筛选框状态（姓名/工号，样式与逻辑对齐训战详情页；确认后走后端过滤）
const filterWrapperRef = ref<HTMLElement | null>(null)
const filterInputRef = ref<HTMLInputElement | null>(null)
const keywordInputRef = ref()
const showFieldDropdown = ref(false)
const showKeywordDropdown = ref(false)
const selectedField = ref<'name' | 'employeeId' | null>(null)
const keywordInput = ref('')
const filterInputValue = ref('')
const tableFilterName = ref<string | undefined>(undefined)
const tableFilterEmployeeId = ref<string | undefined>(undefined)
const isFilterBoxUpdating = ref(false)

const applyTableFilterAndFetch = () => {
  filters.value.name = tableFilterName.value
  filters.value.employeeId = tableFilterEmployeeId.value
  pageNum.value = 1
  fetchDetail()
}

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
  applyTableFilterAndFetch()
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
  applyTableFilterAndFetch()
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
    } else if (filterInputValue.value) {
      filterInputValue.value = ''
      selectedField.value = null
    }
  },
  { immediate: true },
)

/** 构建学分明细查询参数（列表与导出共用） */
const buildCreditDetailQueryParams = (): SchoolCreditDetailRequest => {
  const deptCode: string = filters.value.deptCode
    || (filters.value.departmentPath?.length
      ? filters.value.departmentPath[filters.value.departmentPath.length - 1]
      : undefined)
    || '0'
  const deptLevel =
    filters.value.deptLevel !== undefined && filters.value.deptLevel !== null
      ? filters.value.deptLevel
      : (filters.value.departmentPath?.length || 0)

  const params: SchoolCreditDetailRequest = {
    deptCode,
    deptLevel,
    pageNum: 1,
    pageSize: 50,
  }
  if (filters.value.role && filters.value.role !== '0') {
    params.roleType = parseInt(filters.value.role, 10)
  }
  if (filters.value.jobFamily) params.jobFamily = filters.value.jobFamily
  if (filters.value.jobCategory) params.jobCategory = filters.value.jobCategory
  if (filters.value.jobSubCategory) params.jobSubCategory = filters.value.jobSubCategory
  if (filters.value.positionMaturity && filters.value.positionMaturity !== '全部') {
    params.positionMaturity = filters.value.positionMaturity
  }
  if (filters.value.name?.trim()) params.name = filters.value.name.trim()
  if (filters.value.employeeId?.trim()) params.employeeId = filters.value.employeeId.trim()
  return params
}

/** 导出报表：按当前筛选条件导出全部明细为 Excel */
const handleExport = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const { pageNum: _pn, pageSize: _ps, ...exportParams } = buildCreditDetailQueryParams()
    const allRecords = await fetchAllSchoolCreditRecords(exportParams)
    if (!allRecords.length) {
      ElMessage.warning('暂无数据可导出')
      return
    }
    exportSchoolCreditDetailToExcel(allRecords, 'AI学分看板详情')
    ElMessage.success(`导出成功，共 ${allRecords.length} 条`)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  initDepartmentTree()
  fetchDetail()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

onActivated(() => {
  // 每次激活时从 query 重新初始化 filters，并清空姓名/工号筛选框
  filters.value = initFiltersFromQuery()
  tableFilterName.value = undefined
  tableFilterEmployeeId.value = undefined
  filterInputValue.value = ''
  selectedField.value = null
  keywordInput.value = ''
  showFieldDropdown.value = false
  showKeywordDropdown.value = false
  pageNum.value = 1
  refreshDepartmentTree()
  fetchDetail()
})
</script>

<template>
  <section class="detail-view school-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button class="back-button" type="primary" text :icon="ArrowLeft" @click="handleBack">
          返回列表页
        </el-button>
        <div class="header-content">
          <h2>AI学分看板详情</h2>
          <p>查看学分数据明细与规则说明，支持多维度筛选。</p>
        </div>
      </div>
      <el-space>
        <el-button type="primary" plain :icon="Refresh" @click="fetchDetail">刷新数据</el-button>
        <el-button
          type="primary"
          :icon="Download"
          :loading="exporting"
          :disabled="!detailData || total === 0"
          @click="handleExport"
        >
          导出报表
        </el-button>
      </el-space>
    </header>

    <el-card shadow="hover" class="filter-card" v-if="detailData">
      <el-row :gutter="16" align="middle">
        <el-col :xs="24" :sm="12" :md="6" v-if="!hideRoleAndDept">
          <label>部门筛选：</label>
          <el-cascader
              v-model="filters.departmentPath"
              :options="departmentTree"
              :props="cascaderProps"
              placeholder="请选择部门"
              clearable
              :disabled="!!filters.deptCode"
              @change="handleFilterChange"
              style="width: 100%"
          />
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <label>职位族：</label>
          <el-select
              v-model="filters.jobFamily"
              placeholder="请选择职位族"
              clearable
              @change="handleFilterChange"
              style="width: 100%"
          >
            <el-option
                v-for="family in detailData.filters.jobFamilies"
                :key="family"
                :label="family"
                :value="family"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <label>职位类：</label>
          <el-select
              v-model="filters.jobCategory"
              placeholder="请选择职位类"
              clearable
              @change="handleFilterChange"
              style="width: 100%"
          >
            <el-option
                v-for="category in detailData.filters.jobCategories"
                :key="category"
                :label="category"
                :value="category"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <label>职位子类：</label>
          <el-select
              v-model="filters.jobSubCategory"
              placeholder="请选择职位子类"
              clearable
              @change="handleFilterChange"
              style="width: 100%"
          >
            <el-option
                v-for="subCategory in detailData.filters.jobSubCategories"
                :key="subCategory"
                :label="subCategory"
                :value="subCategory"
            />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6" v-if="!hideRoleAndDept">
          <label>角色：</label>
          <el-select
              v-model="filters.role"
              placeholder="请选择角色"
              @change="handleFilterChange"
              style="width: 100%"
          >
            <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <template v-if="detailData">
      <!-- AI学分数据明细 -->
      <el-card shadow="hover" class="detail-block" v-loading="loading">
        <template #header>
          <div class="detail-block-header">
            <h3>AI学分数据明细</h3>
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
                      title="删除"
                      @click="handleFilterClear"
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
        <el-table :data="records" border style="width: 100%" max-height="600">
          <el-table-column prop="name" label="姓名" width="100" fixed="left" align="center" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              <el-button link type="primary" class="drill-link" @click="handleNameDrill(row.employeeId)">
                {{ row.name }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="employeeId" label="工号" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="jobFamily" label="职位族" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="jobCategory" label="职位类" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="jobSubCategory" label="职位子类" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="departmentLevel1" label="一级部门" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="departmentLevel2" label="二级部门" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="departmentLevel3" label="三级部门" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="departmentLevel4" label="四级部门" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="departmentLevel5" label="五级部门" width="120" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="minDepartment" label="最小部门" width="150" align="center" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.minDepartment ? row.minDepartment.split('/')[0] : '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="currentCredits" label="当前学分" width="100" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="completionRate" label="学分达成率" width="120" align="center" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">{{ formatPercent(row.completionRate) }}</template>
          </el-table-column>
          <el-table-column prop="benchmarkRate" label="所在最小部门标杆学分达成率" width="220" align="center" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">{{ formatPercent(row.benchmarkRate) }}</template>
          </el-table-column>
          <el-table-column prop="scheduleTarget" label="时间进度学分目标" width="160" align="center" header-align="center" show-overflow-tooltip />
          <el-table-column prop="status" label="学分状态预警" width="120" fixed="right" align="center" header-align="center">
            <template #default="{ row }">
              <el-tag :type="row.statusType">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-card>
    </template>
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

  .back-button {
    flex-shrink: 0;
  }
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: $spacing-sm;
  flex: 1;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  flex: 1;

  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
    color: #000;
  }

  p {
    margin: 0;
    max-width: 560px;
    color: #000;
  }
}

.filter-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;
  :deep(.el-row) {
    row-gap: $spacing-md;
  }

  label {
    display: inline-block;
    margin-right: $spacing-sm;
    color: $text-main-color;
    font-weight: 500;
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
    align-items: center;
    width: 100%;
    gap: $spacing-md;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
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
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
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