<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { ArrowLeft, Check } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElCard,
  ElEmpty,
  ElLink,
  ElMessage,
  ElOption,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElIcon,
  ElTooltip,
} from 'element-plus'
import { fetchCoursePlanningInfoList } from '@/api/dashboard'
import { exportCoursePlanningToExcel } from '@/utils/excelExport'
import type { CoursePlanningInfo, DepartmentSelection } from '@/types/dashboard'

const router = useRouter()
const loading = ref(false)
const planningData = ref<CoursePlanningInfo[]>([])
const departmentColumns = ref<DepartmentSelection[]>([])
const filterDeptCode = ref('')

/** 表格最大高度：表头固定，表格内部滚动 */
const tableMaxHeight = 'calc(100vh - 260px)'

/** 当前部门下的目标课程（仅展示已选课程） */
const filteredPlanningData = computed(() => {
  if (!filterDeptCode.value) {
    return []
  }
  return planningData.value.filter((row) => isSelectedByDept(row, filterDeptCode.value))
})

function handleQuickSelectDept(deptCode: string) {
  filterDeptCode.value = deptCode || ''
}

const handleBack = () => {
  router.push({ name: 'TrainingDashboard' })
}

const fetchData = async () => {
  loading.value = true
  try {
    const data = await fetchCoursePlanningInfoList()
    
    // 提取所有出现的部门作为表头列
    const deptMap = new Map<string, string>()
    data.forEach(course => {
      if (course.selectedDepts && course.selectedDepts.length > 0) {
        course.selectedDepts.forEach(dept => {
          deptMap.set(dept.deptCode, dept.deptName)
        })
      }
    })
    
    // 转换为数组并排序（可选：按部门编码或名称排序）
    departmentColumns.value = Array.from(deptMap.entries()).map(([deptCode, deptName]) => ({
      deptCode,
      deptName
    })).sort((a, b) => a.deptCode.localeCompare(b.deptCode))

    // 先按课程主分类排序，然后在同一分类内按训战分类排序（基础在前，进阶在后）
    planningData.value = data.sort((a, b) => {
      const aType = a.bigType || ''
      const bType = b.bigType || ''
      // 先比较课程主分类
      const typeCompare = aType.localeCompare(bType)
      if (typeCompare !== 0) {
        return typeCompare
      }
      // 如果课程主分类相同，则按训战分类排序（基础 < 进阶）
      const aLevel = a.courseLevel || ''
      const bLevel = b.courseLevel || ''
      // 定义排序顺序：基础在前，进阶在后
      const levelOrder: Record<string, number> = {
        '基础': 1,
        '进阶': 2,
      }
      const aOrder = levelOrder[aLevel] || 999
      const bOrder = levelOrder[bLevel] || 999
      return aOrder - bOrder
    })
  } finally {
    loading.value = false
  }
}

// 检查课程是否被某部门选中
const isSelectedByDept = (row: CoursePlanningInfo, deptCode: string) => {
  return row.selectedDepts?.some(dept => dept.deptCode === deptCode) || false
}

// 单元格合并方法（总览矩阵 / 部门明细共用）
const objectSpanMethod = ({
  row,
  column,
  rowIndex,
}: {
  row: CoursePlanningInfo
  column: { property?: string }
  rowIndex: number
}) => {
  if (column.property !== 'bigType') {
    return { rowspan: 1, colspan: 1 }
  }
  const rows = filterDeptCode.value ? filteredPlanningData.value : planningData.value
  const currentValue = row.bigType
  if (rowIndex > 0 && rows[rowIndex - 1]?.bigType === currentValue) {
    return { rowspan: 0, colspan: 0 }
  }
  let rowspan = 1
  for (let i = rowIndex + 1; i < rows.length; i++) {
    if (rows[i]?.bigType === currentValue) {
      rowspan++
    } else {
      break
    }
  }
  return { rowspan, colspan: 1 }
}

const handleDownload = async () => {
  try {
    if (planningData.value.length === 0) {
      ElMessage.warning('暂无数据可下载')
      return
    }
    // 导出Excel
    exportCoursePlanningToExcel(planningData.value, departmentColumns.value, '训战课程规划明细')
    ElMessage.success('下载成功')
  } catch (error) {
    console.error('下载课程规划明细失败：', error)
    ElMessage.error('下载失败，请稍后重试')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <section class="detail-view training-planning-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button type="primary" text :icon="ArrowLeft" @click="handleBack">返回列表页</el-button>
        <div>
          <h2>训战课程规划明细</h2>
          <p>查看详细的训战课程规划信息，包括课程明细、学分信息等。</p>
        </div>
      </div>
    </header>

    <el-card shadow="hover" class="planning-table-card">
      <template #header>
        <div class="table-header">
          <h3>训战课程规划表</h3>
          <div class="table-header__actions">
            <el-select
              :model-value="filterDeptCode"
              clearable
              filterable
              placeholder="快捷选择已配置部门"
              class="table-header__dept-select"
              @change="handleQuickSelectDept"
              @clear="handleQuickSelectDept('')"
            >
              <el-option
                v-for="d in departmentColumns"
                :key="d.deptCode"
                :label="`${d.deptName || d.deptCode}（${d.deptCode}）`"
                :value="d.deptCode"
              />
            </el-select>
            <el-button type="primary" @click="handleDownload">下载明细</el-button>
          </div>
        </div>
      </template>
      <el-skeleton :rows="8" animated v-if="loading" />
      <!-- 未选部门：规划表总览矩阵 -->
      <el-table
        v-else-if="!filterDeptCode"
        :data="planningData"
        border
        style="width: 100%"
        class="planning-table"
        empty-text="暂无数据"
        :max-height="tableMaxHeight"
        :span-method="objectSpanMethod"
      >
        <el-table-column prop="bigType" label="课程主分类" width="120" align="center" fixed />
        <el-table-column prop="courseLevel" label="训战分类" width="100" align="center" fixed />
        <el-table-column prop="courseName" label="课程名称" width="500" align="center" show-overflow-tooltip />
        <el-table-column label="课程编码（线上课程涉及）" min-width="200" align="center">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.courseLink && row.courseNumber"
              content="点击进入iLearning课程"
              placement="top"
            >
              <el-link
                type="primary"
                :href="row.courseLink"
                target="_blank"
                class="course-link"
              >
                {{ row.courseNumber }}
              </el-link>
            </el-tooltip>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
        <el-table-column label="目标人群" width="100" align="center">
          <template #default>
            <span>ALL</span>
          </template>
        </el-table-column>
        <el-table-column prop="credit" label="学分" width="80" align="center" />

        <!-- 动态生成的部门列 -->
        <el-table-column
          v-for="dept in departmentColumns"
          :key="dept.deptCode"
          :label="dept.deptName"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-icon v-if="isSelectedByDept(row, dept.deptCode)" class="check-icon"><Check /></el-icon>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
      </el-table>
      <!-- 已选部门：该部门目标课程明细 -->
      <el-table
        v-else
        :data="filteredPlanningData"
        border
        style="width: 100%"
        class="planning-table"
        :max-height="tableMaxHeight"
        :span-method="objectSpanMethod"
      >
        <el-table-column prop="bigType" label="课程主分类" width="120" align="center" />
        <el-table-column prop="courseLevel" label="训战分类" width="100" align="center" />
        <el-table-column prop="courseName" label="课程名称" min-width="300" align="center" show-overflow-tooltip />
        <el-table-column label="课程编码（线上课程涉及）" min-width="200" align="center">
          <template #default="{ row }">
            <el-tooltip
              v-if="row.courseLink && row.courseNumber"
              content="点击进入iLearning课程"
              placement="top"
            >
              <el-link
                type="primary"
                :href="row.courseLink"
                target="_blank"
                class="course-link"
              >
                {{ row.courseNumber }}
              </el-link>
            </el-tooltip>
            <span v-else class="cell-placeholder">-</span>
          </template>
        </el-table-column>
        <el-table-column label="目标人群" width="100" align="center">
          <template #default>
            <span>ALL</span>
          </template>
        </el-table-column>
        <el-table-column prop="credit" label="学分" width="80" align="center" />
        <template #empty>
          <el-empty description="该部门暂无目标课程" />
        </template>
      </el-table>
    </el-card>
  </section>
</template>

<style scoped lang="scss">
.detail-view {
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
  }
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
  align-items: flex-start;
}

.planning-table-card {
  border: none;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: $spacing-md;
    flex-wrap: wrap;
  }

  .table-header__actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  .table-header__dept-select {
    width: 280px;
    max-width: min(280px, 100%);
  }
}

.resource-table__title {
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

.course-link {
  color: $primary-color;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.planning-table {
  :deep(.el-table__body) {
    tr {
      td {
        padding: 8px 0;
        text-align: center;
      }
    }
  }

  :deep(.el-table__header) {
    th {
      padding: 10px 0;
      text-align: center;
      background-color: #eef5fe !important;
      color: #303133;
      font-weight: 700;
    }
  }

  .check-icon {
    color: #67c23a;
    font-weight: bold;
    font-size: 16px;
  }

  .cell-placeholder {
    color: #999;
  }
}

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

