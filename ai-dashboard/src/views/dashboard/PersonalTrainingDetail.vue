<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElAvatar, ElButton, ElCard, ElEmpty, ElLink, ElMessage, ElSelect, ElOption, ElSkeleton, ElSpace, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { fetchPersonalCourseCompletion } from '@/api/dashboard'
import type { PersonalCourseCompletionResponse, CourseInfo } from '@/types/dashboard'

const router = useRouter()
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

const filteredCourses = computed(() => {
  if (!detailData.value) {
    return []
  }
  const allCourses: Array<CourseInfo & { category: string }> = []
  detailData.value.courseStatistics.forEach((stat) => {
    if (stat.courseList) {
      stat.courseList.forEach((course) => {
        allCourses.push({
          ...course,
          category: stat.courseLevel,
        })
      })
    }
  })
  if (selectedCategory.value === '全部') {
    return allCourses
  }
  return allCourses.filter((course) => course.category === selectedCategory.value)
})

const fetchDetail = async () => {
  loading.value = true
  try {
    const data = await fetchPersonalCourseCompletion()
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
            <h3>课程列表</h3>
            <el-select v-model="selectedCategory" placeholder="选择分类" style="width: 180px">
              <el-option
                v-for="option in categoryOptions"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
          </div>
        </template>
        <el-table 
          :data="filteredCourses" 
          border 
          stripe 
          style="width: 100%" 
          max-height="600"
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
          <el-table-column label="是否目标课程" width="140" align="center">
            <template #default>
              <el-tag type="success" effect="light">是</el-tag>
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

