<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { ElAvatar, ElButton, ElCard, ElEmpty, ElLink, ElMessage, ElSelect, ElOption, ElSkeleton, ElSpace, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { fetchPersonalCourseCompletion } from '@/api/dashboard'
import { fetchManualEnterCreditListBySession } from '@/api/manualCredit'
import type { PersonalCourseCompletionResponse, CourseInfo } from '@/types/dashboard'
import type { ManualEnterCreditRecord } from '@/types/manualCredit'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const detailData = ref<PersonalCourseCompletionResponse | null>(null)
const selectedCategory = ref<string>('全部')
/** 多元化学分场景列表数据（与学分管理同源，仅只读展示） */
const manualEnterCreditRows = ref<ManualEnterCreditRecord[]>([])

// 训战分类排序顺序（支持多种名称映射）
const categoryOrder = ['基础', '进阶', '高阶', '实战']
const categoryMapping: Record<string, string> = {
  '初阶': '基础',
  '中阶': '进阶',
  'L1': '基础',
  'L2': '进阶',
  'L3': '高阶',
}

const normalizeCategory = (category: string): string => {
  return categoryMapping[category] || category
}

const getCategoryOrder = (category: string): number => {
  const normalized = normalizeCategory(category)
  const index = categoryOrder.indexOf(normalized)
  return index >= 0 ? index : categoryOrder.length
}

const categoryOptions = computed(() => {
  if (!detailData.value) {
    return []
  }
  // 仅用于「理论目标课程列表」筛选：去掉实战，并做名称标准化后去重排序
  const levels = detailData.value.courseStatistics
    .map((stat) => normalizeCategory(stat.courseLevel || '未分类'))
    .filter((level) => level !== '实战')

  const unique = Array.from(new Set(levels))
  const sorted = unique.sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b))
  return ['全部', ...sorted]
})

type TargetCourseRow = CourseInfo & { category: string; bigType: string }

const buildTargetCourseRows = (
  stats: PersonalCourseCompletionResponse['courseStatistics'],
  courseLevelFilter: (courseLevel: string) => boolean,
  selectedLevel: string
): TargetCourseRow[] => {
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

  const filtered =
    selectedLevel === '全部' ? allCourses : allCourses.filter((course) => course.category === selectedLevel)

  const groupedByBigType = new Map<string, Array<CourseInfo & { category: string }>>()
  filtered.forEach((course) => {
    const bigType = course.bigType || '未分类'
    if (!groupedByBigType.has(bigType)) {
      groupedByBigType.set(bigType, [])
    }
    groupedByBigType.get(bigType)!.push(course)
  })

  const result: TargetCourseRow[] = []
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

    const groupedByCategory = new Map<string, Array<CourseInfo & { category: string }>>()
    courses.forEach((course) => {
      const category = course.category || '未分类'
      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, [])
      }
      groupedByCategory.get(category)!.push(course)
    })

    const sortedCategories = Array.from(groupedByCategory.keys()).sort((a, b) => {
      return getCategoryOrder(a) - getCategoryOrder(b)
    })

    sortedCategories.forEach((category) => {
      const categoryCourses = groupedByCategory.get(category)!
      categoryCourses.sort((a, b) => {
        if (a.isCompleted === b.isCompleted) return 0
        return a.isCompleted ? -1 : 1
      })
      categoryCourses.forEach((course) => {
        result.push({ ...course, bigType })
      })
    })
  })

  return result
}

const practicalTargetCourses = computed<TargetCourseRow[]>(() => {
  if (!detailData.value) {
    return []
  }
  return buildTargetCourseRows(
    detailData.value.courseStatistics,
    (level) => normalizeCategory(level) === '实战',
    '全部'
  )
})

const theoryTargetCourses = computed<TargetCourseRow[]>(() => {
  if (!detailData.value) {
    return []
  }
  const selected = selectedCategory.value === '实战' ? '全部' : selectedCategory.value
  return buildTargetCourseRows(
    detailData.value.courseStatistics,
    (level) => normalizeCategory(level) !== '实战',
    selected
  )
})

const createSpanMethod = (rows: { value: Array<{ bigType?: string }> }) => {
  return ({ row, columnIndex, rowIndex }: any) => {
    if (columnIndex === 0) {
      const currentBigType = row.bigType
      let startIndex = rowIndex
      while (startIndex > 0 && rows.value[startIndex - 1]?.bigType === currentBigType) {
        startIndex--
      }
      let endIndex = rowIndex
      while (endIndex < rows.value.length - 1 && rows.value[endIndex + 1]?.bigType === currentBigType) {
        endIndex++
      }
      if (rowIndex === startIndex) {
        return { rowspan: endIndex - startIndex + 1, colspan: 1 }
      }
      return { rowspan: 0, colspan: 0 }
    }
    return { rowspan: 1, colspan: 1 }
  }
}

const getPracticalSpanMethod = createSpanMethod(practicalTargetCourses)
const getTheorySpanMethod = createSpanMethod(theoryTargetCourses)

const fetchDetail = async () => {
  loading.value = true
  try {
    const account = (route.query.account as string) || undefined

    /** 与 /personal-course/completion 一致：有 account 则查指定人；无则由服务端从 Cookie 解析工号 */
    const manualEnterCreditPromise = fetchManualEnterCreditListBySession({
      account,
      pageNum: 1,
      pageSize: 200,
    }).catch((err) => {
      console.warn('获取手工录入学分列表失败：', err)
      return { total: 0, rows: [] as ManualEnterCreditRecord[] }
    })

    const [data, manualPage] = await Promise.all([
      fetchPersonalCourseCompletion(account),
      manualEnterCreditPromise,
    ])
    manualEnterCreditRows.value = manualPage.rows
    if (data) {
      detailData.value = data
      // 兜底：若历史路由/缓存里把筛选设成了「实战」，改为「全部」（当前下拉已移除实战选项）
      if (selectedCategory.value === '实战') {
        selectedCategory.value = '全部'
      }
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
  router.push({ name: 'SchoolDashboard' })
}

const formatPercent = (value: number) => `${(value ?? 0).toFixed(1)}%`
const formatBoolean = (value: boolean) => (value ? '是' : '否')

const avatarUrl = computed(() => {
  if (!detailData.value?.empNum) return null
  return `https://w3.huawei.com/w3lab/rest/yellowpage/face/${detailData.value.empNum}/120`
})

const tableDataWithTotal = computed(() => {
  if (!detailData.value?.courseStatistics || detailData.value.courseStatistics.length === 0) {
    return []
  }
  const statistics = detailData.value.courseStatistics
  const totalRow = {
    courseLevel: '总计',
    totalCourses: statistics.reduce((sum, stat) => sum + (stat.totalCourses || 0), 0),
    targetCourses: statistics.reduce((sum, stat) => sum + (stat.targetCourses || 0), 0),
    completedCourses: statistics.reduce((sum, stat) => sum + (stat.completedCourses || 0), 0),
    completionRate: 0,
  }
  if (totalRow.targetCourses > 0) {
    totalRow.completionRate = (totalRow.completedCourses / totalRow.targetCourses) * 100
  }
  return [...statistics, totalRow]
})

onMounted(() => {
  fetchDetail()
})

onActivated(() => {
  fetchDetail()
})
</script>

<template>
  <section class="detail-view school-personal-detail">
    <header class="detail-view__header glass-card">
      <div class="header-left">
        <el-button type="primary" text :icon="ArrowLeft" @click="handleBack">返回列表页</el-button>
        <div>
          <h2>个人课程学分详情</h2>
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
          <p v-else>查看个人课程学分完课情况</p>
        </div>
      </div>
      <el-space>
        <el-button type="primary" plain :icon="Refresh" @click="fetchDetail">刷新数据</el-button>
      </el-space>
    </header>

    <el-skeleton :rows="8" animated v-if="loading" />
    <template v-else-if="detailData">
      <!-- 个人学分总览 -->
      <el-card shadow="hover" class="summary-card">
        <template #header>
          <h3>个人学分总览</h3>
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

      <!-- 目标课程列表 -->
      <el-card shadow="hover" class="filter-card">
        <template #header>
          <div class="filter-header">
            <h3>目标课程列表</h3>
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
            <el-table-column prop="bigType" label="课程主分类" min-width="60" align="center" />
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
            <el-table-column prop="credit" label="学分" width="80" align="center">
              <template #default="{ row }">
                <span>{{ row.credit != null && String(row.credit).trim() !== '' ? row.credit : '—' }}</span>
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

        <div class="target-course-section target-course-section--fixed" v-if="theoryTargetCourses.length">
          <div class="target-course-title-row">
            <h4 class="target-course-title">理论目标课程列表</h4>
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
          <el-table
            :data="theoryTargetCourses"
            border
            stripe
            style="width: 100%"
            max-height="600"
            :span-method="getTheorySpanMethod"
          >
            <el-table-column prop="bigType" label="课程主分类" min-width="60" align="center" />
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
            <el-table-column prop="credit" label="学分" width="80" align="center">
              <template #default="{ row }">
                <span>{{ row.credit != null && String(row.credit).trim() !== '' ? row.credit : '—' }}</span>
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

      <!-- 多元化学分场景（样式对齐学分管理页表格，不含多选/工号/姓名/操作） -->
      <el-card shadow="hover" class="manual-credit-card">
        <template #header>
          <h3>多元化学分场景</h3>
        </template>
        <el-table
          class="credit-table"
          :data="manualEnterCreditRows"
          border
          stripe
          style="width: 100%"
          max-height="560"
        >
          <el-table-column
            prop="credit_type"
            label="学分类型"
            min-width="96"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="activity_name"
            label="活动名称"
            min-width="120"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="activity_date"
            label="活动日期"
            min-width="150"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="credits"
            label="获得学分"
            min-width="88"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="description"
            label="详细描述"
            min-width="140"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="attachment_url"
            label="附件URL"
            min-width="120"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            prop="update_time"
            label="更新时间"
            min-width="150"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <template #empty>
            <el-empty description="暂无多元化学分场景数据" />
          </template>
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
  background: linear-gradient(135deg, rgba(58, 122, 254, 0.18), rgba(155, 92, 255, 0.16));
  box-shadow: 0 18px 40px rgba(58, 122, 254, 0.16);
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

  .target-course-section {
    & + & {
      /* 与训战个人详情页保持一致 */
      margin-top: 12px;
    }
  }

  .target-course-section--fixed {
    /* 避免理论表切换筛选时页面“跳动” */
    min-height: 360px;
  }

  .target-course-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-md;
    /* 与上方实战表下沿留出与训战个人详情页一致的“呼吸感” */
    padding-top: 15px;
    margin: 0 0 10px;
  }

  .target-course-title {
    margin: 0;
    line-height: 22px;
    font-size: 16px;
    font-weight: 700;
    color: #000;
  }

  :deep(.el-table) {
    .el-table__header-wrapper {
      .el-table__header th {
        text-align: center;
        font-weight: 700;
        font-size: 17px;
        font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
        color: #000;
      }
    }

    .el-table__body-wrapper {
      .el-table__body td {
        text-align: center;
      }
    }
  }
}

/** 与 ManualCreditManagement 中 .credit-card 一致 */
.manual-credit-card {
  border-radius: $radius-md;
  border: 1px solid $border-color;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: $shadow-card;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

/** 与 ManualCreditManagement 中 .credit-table 一致 */
.credit-table {
  width: 100%;

  :deep(.el-table__inner-wrapper) {
    width: 100% !important;
  }

  :deep(.el-scrollbar__wrap) {
    width: 100% !important;
  }

  :deep(.el-table__header table),
  :deep(.el-table__body table) {
    width: 100% !important;
  }

  :deep(.el-table__header-wrapper th) {
    font-weight: 700;
    color: #000;
    text-align: center !important;
  }

  :deep(.el-table__header .cell) {
    font-weight: 700;
    color: #000;
    justify-content: center;
  }

  :deep(.el-table__body .cell) {
    text-align: center;
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
      .el-table__header th {
        text-align: center;
        font-weight: 700;
        font-size: 16px;
        color: #000;
      }
    }

    .el-table__body-wrapper {
      .el-table__body td {
        text-align: center;
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