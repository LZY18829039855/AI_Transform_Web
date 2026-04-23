<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAvatar, ElButton, ElCard, ElEmpty, ElLink, ElMessage, ElSelect, ElOption, ElSkeleton, ElSpace, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { fetchPersonalCourseCompletion } from '@/api/dashboard'
import type { PersonalCourseCompletionResponse, CourseInfo } from '@/types/dashboard'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const detailData = ref<PersonalCourseCompletionResponse | null>(null)
const selectedCategory = ref<string>('全部')

const categoryOptions = computed(() => {
  if (!detailData.value) {
    return []
  }
  const options = detailData.value.courseStatistics.map((stat) => stat.courseLevel)
  return ['全部', ...options]
})

// 训战分类排序顺序（支持多种名称映射）
const categoryOrder = ['基础', '进阶', '高阶', '实战']
const categoryMapping: Record<string, string> = {
  '初阶': '基础',
  '中阶': '进阶',
  'L1': '基础',
  'L2': '进阶',
  'L3': '高阶',
}

// 标准化分类名称
const normalizeCategory = (category: string): string => {
  return categoryMapping[category] || category
}

const getCategoryOrder = (category: string): number => {
  const normalized = normalizeCategory(category)
  const index = categoryOrder.indexOf(normalized)
  return index >= 0 ? index : categoryOrder.length
}

type TargetCourseRow = CourseInfo & { category: string; bigType: string }

const buildTargetCourseRows = (
  stats: PersonalCourseCompletionResponse['courseStatistics'],
  courseLevelFilter: (courseLevel: string) => boolean,
  selectedLevel: string
): TargetCourseRow[] => {
  // 收集所有目标课程
  const allCourses: Array<CourseInfo & { category: string }> = []
  stats.forEach((stat) => {
    const level = stat.courseLevel || '未分类'
    if (!courseLevelFilter(level)) {
      return
    }
    if (!stat.courseList) {
      return
    }
    stat.courseList.forEach((course) => {
      if (course.isTargetCourse) {
        allCourses.push({
          ...course,
          category: level,
        })
      }
    })
  })

  // 按筛选条件过滤
  const filtered =
    selectedLevel === '全部' ? allCourses : allCourses.filter((course) => course.category === selectedLevel)

  // 按主分类分组
  const groupedByBigType = new Map<string, Array<CourseInfo & { category: string }>>()
  filtered.forEach((course) => {
    const bigType = course.bigType || '未分类'
    if (!groupedByBigType.has(bigType)) {
      groupedByBigType.set(bigType, [])
    }
    groupedByBigType.get(bigType)!.push(course)
  })

  // 对每个主分类内的课程进行排序和分组
  const result: TargetCourseRow[] = []

  // 按主分类的课程数量排序（数量多的在前），如果数量相同则按名称排序
  const sortedBigTypes = Array.from(groupedByBigType.keys()).sort((a, b) => {
    const countA = groupedByBigType.get(a)!.length
    const countB = groupedByBigType.get(b)!.length
    if (countA !== countB) {
      return countB - countA
    }
    return a.localeCompare(b)
  })

  sortedBigTypes.forEach((bigType) => {
    const courses = groupedByBigType.get(bigType)!

    // 按训战分类分组
    const groupedByCategory = new Map<string, Array<CourseInfo & { category: string }>>()
    courses.forEach((course) => {
      const category = course.category || '未分类'
      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, [])
      }
      groupedByCategory.get(category)!.push(course)
    })

    // 按训战分类排序（基础、进阶、高阶、实战）
    const sortedCategories = Array.from(groupedByCategory.keys()).sort((a, b) => {
      return getCategoryOrder(a) - getCategoryOrder(b)
    })

    // 对每个训战分类内的课程排序：完课在前，未完课在后
    sortedCategories.forEach((category) => {
      const categoryCourses = groupedByCategory.get(category)!
      categoryCourses.sort((a, b) => {
        if (a.isCompleted === b.isCompleted) {
          return 0
        }
        return a.isCompleted ? -1 : 1
      })

      categoryCourses.forEach((course) => {
        result.push({
          ...course,
          bigType,
        })
      })
    })
  })

  return result
}

const practicalTargetCourses = computed<TargetCourseRow[]>(() => {
  if (!detailData.value) {
    return []
  }
  // 选了非「全部/实战」时，不展示实战表
  if (selectedCategory.value !== '全部' && selectedCategory.value !== '实战') {
    return []
  }
  return buildTargetCourseRows(
    detailData.value.courseStatistics,
    (level) => normalizeCategory(level) === '实战',
    selectedCategory.value === '实战' ? '实战' : '全部'
  )
})

const theoryTargetCourses = computed<TargetCourseRow[]>(() => {
  if (!detailData.value) {
    return []
  }
  // 选了「实战」时，不展示理论表
  if (selectedCategory.value === '实战') {
    return []
  }
  return buildTargetCourseRows(
    detailData.value.courseStatistics,
    (level) => normalizeCategory(level) !== '实战',
    selectedCategory.value
  )
})

// 计算合并单元格的 span-method
const createSpanMethod = (rows: { value: Array<{ bigType?: string }> }) => {
  return ({ row, columnIndex, rowIndex }: any) => {
    if (columnIndex === 0) {
      const currentBigType = row.bigType

      // 向前查找相同主分类的行数
      let startIndex = rowIndex
      while (startIndex > 0 && rows.value[startIndex - 1]?.bigType === currentBigType) {
        startIndex--
      }

      // 向后查找相同主分类的行数
      let endIndex = rowIndex
      while (endIndex < rows.value.length - 1 && rows.value[endIndex + 1]?.bigType === currentBigType) {
        endIndex++
      }

      if (rowIndex === startIndex) {
        return {
          rowspan: endIndex - startIndex + 1,
          colspan: 1,
        }
      }
      return {
        rowspan: 0,
        colspan: 0,
      }
    }

    return {
      rowspan: 1,
      colspan: 1,
    }
  }
}

const getPracticalSpanMethod = createSpanMethod(practicalTargetCourses)
const getTheorySpanMethod = createSpanMethod(theoryTargetCourses)

const fetchDetail = async () => {
  loading.value = true
  try {
    const account = (route.query.account as string) || undefined
    const data = await fetchPersonalCourseCompletion(account)
    if (data) {
      detailData.value = data
    } else {
      ElMessage.warning('获取个人课程详情失败')
    }
  } catch (error) {
    console.error('获取个人课程详情异常：', error)
    ElMessage.error('获取个人课程详情异常')
  } finally {
    loading.value = false
  }
}

const handleBack = () => {
  router.push({ name: 'TrainingDashboard' })
}

const formatPercent = (value: number) => `${(value ?? 0).toFixed(1)}%`

const formatBoolean = (value: boolean) => (value ? '是' : '否')

// 根据工号生成头像URL
const avatarUrl = computed(() => {
  if (!detailData.value?.empNum) {
    return null
  }
  return `https://w3.huawei.com/w3lab/rest/yellowpage/face/${detailData.value.empNum}/120`
})

// 计算包含总计行的表格数据
const tableDataWithTotal = computed(() => {
  if (!detailData.value?.courseStatistics || detailData.value.courseStatistics.length === 0) {
    return []
  }
  
  const statistics = detailData.value.courseStatistics
  
  // 计算总计行数据
  const totalRow = {
    courseLevel: '总计',
    totalCourses: statistics.reduce((sum, stat) => sum + (stat.totalCourses || 0), 0),
    targetCourses: statistics.reduce((sum, stat) => sum + (stat.targetCourses || 0), 0),
    completedCourses: statistics.reduce((sum, stat) => sum + (stat.completedCourses || 0), 0),
    completionRate: 0,
  }
  
  // 计算总计的完课占比
  if (totalRow.targetCourses > 0) {
    totalRow.completionRate = (totalRow.completedCourses / totalRow.targetCourses) * 100
  }
  
  // 合并原始数据和总计行
  return [...statistics, totalRow]
})

onMounted(() => {
  fetchDetail()
})

onActivated(() => {
  // 重新获取数据，fetchDetail 中会根据查询参数设置分类筛选条件
  fetchDetail()
})
</script>

<template>
  <section class="detail-view personal-training-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button type="primary" text :icon="ArrowLeft" @click="handleBack">返回列表页</el-button>
        <div>
          <h2>个人训战课程详情</h2>
          <div v-if="detailData" class="user-info">
            <el-avatar 
              :src="avatarUrl" 
              :size="40"
              class="user-avatar"
            />
            <span class="user-details">
              <span class="emp-num">{{ detailData.empNum }}</span>
              <span class="emp-name">{{ detailData.empName || '未获取' }}</span>
            </span>
          </div>
          <p v-else>查看个人训战课程完课情况</p>
        </div>
      </div>
      <el-space>
        <el-button type="primary" plain :icon="Refresh" @click="fetchDetail">刷新数据</el-button>
      </el-space>
    </header>

    <el-skeleton :rows="8" animated v-if="loading" />
    <template v-else-if="detailData">
      <!-- 个人训战总览统计 -->
      <el-card shadow="hover" class="summary-card">
        <template #header>
          <h3>个人训战总览</h3>
        </template>
        <el-table 
          :data="tableDataWithTotal" 
          border 
          style="width: 100%"
          :header-cell-class-name="() => 'personal-overview-header'"
          :row-class-name="({ row }) => row.courseLevel === '总计' ? 'personal-overview-total-row' : ''"
        >
          <el-table-column prop="courseLevel" label="训战分类" min-width="120" align="center" />
          <el-table-column prop="totalCourses" label="课程总数" min-width="140" align="center" />
          <el-table-column prop="targetCourses" label="目标完课数" min-width="140" align="center" />
          <el-table-column prop="completedCourses" label="实际完课数" min-width="140" align="center" />
          <el-table-column prop="completionRate" label="目标课程完课占比" min-width="180" align="center">
            <template #default="{ row }">{{ formatPercent(row.completionRate) }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 课程分类筛选 -->
      <el-card shadow="hover" class="filter-card">
        <template #header>
          <div class="filter-header">
            <h3>目标课程列表</h3>
            <div class="filter-controls">
              <span class="filter-label">训战分类：</span>
              <el-select v-model="selectedCategory" placeholder="选择分类" style="width: 180px">
                <el-option
                  v-for="option in categoryOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </div>
          </div>
        </template>

        <div class="target-course-section" v-if="practicalTargetCourses.length">
          <h4 class="target-course-title">实战目标课程列表</h4>
          <el-table
            :data="practicalTargetCourses"
            border
            stripe
            style="width: 100%"
            max-height="360"
            :span-method="getPracticalSpanMethod"
          >
            <el-table-column prop="bigType" label="课程主分类" min-width="140" align="center" />
            <el-table-column prop="category" label="训战分类" width="120" align="center" />
            <el-table-column prop="courseName" label="课程名称" min-width="200" align="center">
              <template #default="{ row }">
                <el-link
                  v-if="row.courseLink"
                  :href="row.courseLink"
                  target="_blank"
                  type="primary"
                  :underline="false"
                >
                  {{ row.courseName }}
                </el-link>
                <span v-else>{{ row.courseName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="是否完课" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isCompleted ? 'success' : 'warning'" effect="light">
                  {{ formatBoolean(row.isCompleted) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="target-course-section" v-if="theoryTargetCourses.length">
          <h4 class="target-course-title">理论目标课程列表</h4>
          <el-table
            :data="theoryTargetCourses"
            border
            stripe
            style="width: 100%"
            max-height="600"
            :span-method="getTheorySpanMethod"
          >
            <el-table-column prop="bigType" label="课程主分类" min-width="140" align="center" />
            <el-table-column prop="category" label="训战分类" width="120" align="center" />
            <el-table-column prop="courseName" label="课程名称" min-width="200" align="center">
              <template #default="{ row }">
                <el-link
                  v-if="row.courseLink"
                  :href="row.courseLink"
                  target="_blank"
                  type="primary"
                  :underline="false"
                >
                  {{ row.courseName }}
                </el-link>
                <span v-else>{{ row.courseName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="是否完课" width="120" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isCompleted ? 'success' : 'warning'" effect="light">
                  {{ formatBoolean(row.isCompleted) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
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

.target-course-section {
  & + & {
    margin-top: $spacing-lg;
  }
}

.target-course-title {
  margin: 0 0 $spacing-sm;
  font-size: 16px;
  font-weight: 700;
  color: #000;
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

  .user-info {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    margin: $spacing-sm 0 0;
  }

  .user-avatar {
    flex-shrink: 0;
  }

  .user-details {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    color: #000;
    font-size: 14px;
  }

  .emp-num {
    font-weight: 500;
  }

  .emp-name {
    font-weight: 500;
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

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .filter-controls {
      display: flex;
      align-items: center;
      gap: $spacing-sm;

      .filter-label {
        font-size: 14px;
        color: $text-main-color;
        white-space: nowrap;
      }
    }
  }

  :deep(.el-table) {
    .el-table__header-wrapper {
      .el-table__header {
        th {
          text-align: center;
          font-weight: 700;
          font-size: 17px;
          font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
          color: #000;
        }
      }
    }

    .el-table__body-wrapper {
      .el-table__body {
        td {
          text-align: center;
        }
      }
    }
  }
}

.summary-card {
  border: none;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  :deep(.el-table) {
    .el-table__header-wrapper {
      .el-table__header {
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
        td {
          text-align: center;
        }
      }
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

@media (max-width: 768px) {
  .glass-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-header {
    flex-direction: column;
    gap: $spacing-sm;
    align-items: flex-start;
  }
}
</style>

