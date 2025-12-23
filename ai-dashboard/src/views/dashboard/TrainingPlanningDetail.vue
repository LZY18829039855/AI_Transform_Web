<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElButton, ElCard, ElEmpty, ElLink, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { fetchCoursePlanningInfoList } from '@/api/dashboard'
import type { CoursePlanningInfo } from '@/types/dashboard'

const router = useRouter()
const loading = ref(false)
const planningData = ref<CoursePlanningInfo[]>([])

const handleBack = () => {
  router.push({ name: 'TrainingDashboard' })
}

const fetchData = async () => {
  loading.value = true
  try {
    const data = await fetchCoursePlanningInfoList()
    // 按课程主分类排序，确保相同分类的行连续，以便正确合并单元格
    planningData.value = data.sort((a, b) => {
      const aType = a.bigType || ''
      const bType = b.bigType || ''
      return aType.localeCompare(bType)
    })
  } finally {
    loading.value = false
  }
}

// 单元格合并方法
const objectSpanMethod = ({ row, column, rowIndex, columnIndex }: any) => {
  // 只对第一列（课程主分类）进行合并
  if (columnIndex === 0) {
    const currentValue = row.bigType
    // 如果当前行的值与上一行相同，则隐藏当前单元格
    if (rowIndex > 0 && planningData.value[rowIndex - 1]?.bigType === currentValue) {
      return {
        rowspan: 0,
        colspan: 0,
      }
    }
    // 计算从当前行开始，有多少行具有相同的课程主分类
    let rowspan = 1
    for (let i = rowIndex + 1; i < planningData.value.length; i++) {
      if (planningData.value[i]?.bigType === currentValue) {
        rowspan++
      } else {
        break
      }
    }
    // 返回合并的行数
    return {
      rowspan: rowspan,
      colspan: 1,
    }
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
        <h3>训战课程规划表</h3>
      </template>
      <el-skeleton :rows="8" animated v-if="loading" />
      <el-table v-else :data="planningData" border style="width: 100%" class="planning-table" empty-text="暂无数据" :span-method="objectSpanMethod">
        <el-table-column prop="bigType" label="课程主分类" width="100" align="center" />
        <el-table-column prop="courseLevel" label="训战分类" width="80" align="center" />
        <el-table-column prop="courseName" label="课程名称" width="417" align="center" />
        <el-table-column label="课程编码（线上课程涉及）" min-width="463" align="center">
          <template #default="{ row }">
            <el-link
              v-if="row.courseLink && row.courseName"
              type="primary"
              :href="row.courseLink"
              target="_blank"
              class="course-link"
            >
              {{ row.courseName }}（点击进入iLearning课程）
            </el-link>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="目标人群" width="80" align="center">
          <template #default>
            <span>ALL</span>
          </template>
        </el-table-column>
        <el-table-column prop="credit" label="学分列" width="60" align="center" />
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

