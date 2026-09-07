<script setup lang="ts">
import { computed } from 'vue'
import type { CreditOverviewVO } from '@/types/dashboard'

interface Props {
  title: string
  data: CreditOverviewVO[]
  loading: boolean
  type?: 'position' | 'department'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'department',
})

interface Emits {
  (e: 'drill-down', row: CreditOverviewVO, field: string): void
}

const emit = defineEmits<Emits>()

const isDepartment = computed(() => props.type === 'department')

const categoryLabel = computed(() => {
  return props.type === 'position' ? '职位类别' : '部门'
})

const averageCreditLabel = computed(() => {
  return props.type === 'department' ? '部门平均学分' : '当前平均学分'
})

const rowIdentity = (row: CreditOverviewVO) => row.categoryCode ?? row.categoryName

/** 不参与转型 TOP 排名的部门（取中文名匹配，兼容「中文/英文」格式） */
const TOP_EXCLUDED_DEPT_NAMES = new Set([
  '云核心网架构与设计部',
  '云核心网技术规划部',
  '云核心网研究部',
])

const getDeptChineseName = (name?: string) => {
  if (!name) return ''
  return name.includes('/') ? name.split('/')[0].trim() : name.trim()
}

/** 按当前平均学分降序，为非总计行标注 TOP1~TOP3（排除指定部门） */
const transformTopMap = computed(() => {
  const map = new Map<string, string>()
  if (!isDepartment.value) return map

  const topRows = [...props.data]
    .filter((row) => {
      if (row.categoryName === '总计') return false
      return !TOP_EXCLUDED_DEPT_NAMES.has(getDeptChineseName(row.categoryName))
    })
    .sort((a, b) => {
      const scoreA = Number(a.averageCurrentCredit)
      const scoreB = Number(b.averageCurrentCredit)
      const safeA = Number.isFinite(scoreA) ? scoreA : -Infinity
      const safeB = Number.isFinite(scoreB) ? scoreB : -Infinity
      return safeB - safeA
    })
    .slice(0, 3)

  topRows.forEach((row, index) => {
    map.set(rowIdentity(row), `TOP${index + 1}`)
  })
  return map
})

const getTransformTop = (row: CreditOverviewVO) => {
  if (row.categoryName === '总计') return ''
  return transformTopMap.value.get(rowIdentity(row)) || ''
}

const formatScore = (_row: any, _column: any, cellValue: number) => {
  if (cellValue == null) return '-'
  return cellValue
}

const handleDrillDown = (row: CreditOverviewVO, field: string) => {
  emit('drill-down', row, field)
}

const tableRowClassName = ({ row }: { row: CreditOverviewVO }) => {
  if (row.categoryName === '总计') {
    return 'total-row'
  }
  return ''
}
</script>

<template>
  <el-card class="credit-overview-card" shadow="hover">
    <template #header>
      <div class="card-header">
        <h3>{{ title }}</h3>
        <p v-if="isDepartment" class="credit-cap-hint">
          架设、规划、研究部作为产品线AI龙头组织，不参与TOP排序。
        </p>
      </div>
    </template>

    <el-table
      v-loading="loading"
      :data="data"
      border
      stripe
      style="width: 100%"
      :header-cell-style="{ background: 'rgba(58, 122, 254, 0.06)', color: '#2f3b52', textAlign: 'center' }"
      :cell-style="{ textAlign: 'center' }"
      :row-class-name="tableRowClassName"
    >
      <el-table-column prop="categoryName" :label="categoryLabel" min-width="180" fixed />
      <el-table-column prop="baselineHeadcount" label="基线人数" min-width="100">
        <template #default="{ row }">
          <el-button
            link
            class="drill-link"
            @click="handleDrillDown(row, 'baselineHeadcount')"
          >
            {{ row.baselineHeadcount }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="maxScore" label="最高分" min-width="100" :formatter="formatScore" />
      <el-table-column prop="minScore" label="最低分" min-width="100" :formatter="formatScore" />
      <el-table-column prop="averageCurrentCredit" :label="averageCreditLabel" min-width="120" :formatter="formatScore" />
      <el-table-column prop="averageTargetCredit" label="目标平均学分" min-width="120" :formatter="formatScore" />
      <!-- 部门表专属列 -->
      <el-table-column v-if="isDepartment" label="转型TOP" min-width="100">
        <template #default="{ row }">
          <template v-if="getTransformTop(row)">
            <span class="transform-top-tag">{{ getTransformTop(row) }}</span>
          </template>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="isDepartment" label="干部平均学分" min-width="120">
        <template #default>—</template>
      </el-table-column>
      <el-table-column v-if="isDepartment" label="专家平均学分" min-width="120">
        <template #default>—</template>
      </el-table-column>
      <!-- 学分达成率 / 时间进度学分目标 / 学分状态预警：暂时隐藏 -->
    </el-table>
  </el-card>
</template>

<style scoped lang="scss">
.credit-overview-card {
  border: none;
  margin-bottom: 24px;

  .card-header {
    display: flex;
    flex-direction: column;
    gap: 8px;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .credit-cap-hint {
    margin: 0;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.5;
    color: #606266;
  }
}

.drill-link {
  font-weight: 600;
  padding: 0;
  border-radius: 0;
  color: #409eff;
  background: transparent;

  &:hover {
    background: transparent;
    text-decoration: underline;
  }
}

.transform-top-tag {
  display: inline-block;
  font-weight: 700;
  color: #c45606;
}

:deep(.el-table .total-row) {
  font-weight: bold;
  --el-table-tr-bg-color: #f5f7fa;
}

:deep(.el-table .total-row td.el-table__cell) {
  background-color: #f5f7fa !important;
}
</style>
