<script setup lang="ts">
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { StaffChartPoint } from '../../types/dashboard'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer])

interface Props {
  title: string
  points: StaffChartPoint[]
  showRate?: boolean
  countLabel?: string
  rateLabel?: string
  height?: number
  legendTotals?: Record<string, string | number>
}

const props = withDefaults(defineProps<Props>(), {
  showRate: true,
  countLabel: '人数',
  rateLabel: '占比',
  height: 280,
  legendTotals: () => ({}),
})

type ChartInstance = ReturnType<typeof echarts.init>

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ChartInstance | null = null

const disposeChart = () => {
  chartInstance?.dispose()
  chartInstance = null
}

const ensureChartInstance = () => {
  if (!chartRef.value) {
    return null
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  return chartInstance
}

const getOption = (): EChartsOption => {
  const categories = props.points.map((item) => item.label)
  const counts = props.points.map((item) => item.count)
  const rates = props.points.map((item) => item.rate)
  const longestLabelLength = categories.reduce((max, label) => Math.max(max, label.length), 0)
  const shouldWrapLabels = longestLabelLength > 4
  const maxCharsPerLine = 4
  const axisLabelMargin = 8
  const fontSize = 12
  const lineHeight = fontSize * 1.2
  const estimatedLines = shouldWrapLabels ? Math.ceil(longestLabelLength / maxCharsPerLine) : 1
  const estimatedLabelHeight = estimatedLines * lineHeight
  const gridBottom = Math.max(30, Math.ceil(estimatedLabelHeight + axisLabelMargin + 16))

  const series: EChartsOption['series'] = [
    {
      name: props.countLabel,
      type: 'bar',
      data: counts,
      barWidth: 28,
      itemStyle: {
        borderRadius: [8, 8, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(58, 122, 254, 0.85)' },
          { offset: 1, color: 'rgba(58, 122, 254, 0.35)' },
        ]),
      },
    },
  ]

  if (props.showRate) {
    series.push({
      name: props.rateLabel,
      type: 'line',
      data: rates,
      yAxisIndex: 1,
      smooth: true,
      symbol: 'circle',
      symbolSize: 10,
      lineStyle: {
        width: 3,
        color: '#34c38f',
      },
      itemStyle: {
        color: '#34c38f',
        shadowBlur: 8,
        shadowColor: 'rgba(52, 195, 143, 0.35)',
      },
      areaStyle: {
        opacity: 0.08,
        color: '#34c38f',
      },
    })
  }

  return {
    grid: {
      left: '6%',
      right: props.showRate ? '10%' : '4%',
      top: 40,
      bottom: gridBottom,
      containLabel: false,
    },
    legend: {
      right: 20,
      top: 10,
      itemHeight: 12,
      itemWidth: 18,
      icon: 'roundRect',
      borderRadius: 6,
      padding: [6, 12],
      backgroundColor: 'rgba(255, 255, 255, 0.86)',
      borderColor: 'rgba(58, 122, 254, 0.18)',
      borderWidth: 1,
      itemGap: 16,
      textStyle: {
        color: 'rgba(31, 45, 61, 0.78)',
        fontSize: 12,
      },
      formatter: (name: string) => {
        const total = props.legendTotals?.[name]
        if (total === undefined || total === null || total === '') {
          return name
        }
        return `${name}（${total}）`
      },
    },
    tooltip: {
      trigger: 'axis',
      borderWidth: 1,
      borderColor: 'rgba(58, 122, 254, 0.25)',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      textStyle: { color: '#122136' },
      formatter: (params: any) => {
        const lines = [`<strong>${params[0]?.axisValue}</strong>`]
        params.forEach((item: any) => {
          const value = item.seriesName === props.rateLabel ? `${item.data}%` : item.data
          lines.push(`${item.marker} ${item.seriesName}：${value}`)
        })
        return lines.join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: 'rgba(31, 45, 61, 0.2)' } },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(31, 45, 61, 0.65)',
        rotate: 0,
        interval: 0,
        fontSize: fontSize,
        margin: axisLabelMargin,
        align: 'center',
        verticalAlign: 'top',
        formatter: (value: string) => {
          if (!shouldWrapLabels || value.length <= maxCharsPerLine) {
            return value
          }
          const lines: string[] = []
          for (let i = 0; i < value.length; i += maxCharsPerLine) {
            lines.push(value.slice(i, i + maxCharsPerLine))
          }
          return lines.join('\n')
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        name: props.countLabel,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: 'rgba(31, 45, 61, 0.12)' } },
        axisLabel: { color: 'rgba(31, 45, 61, 0.65)' },
      },
      props.showRate
        ? {
            type: 'value',
            name: props.rateLabel,
            min: 0,
            max: 100,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: {
              formatter: '{value}%',
              color: 'rgba(31, 45, 61, 0.65)',
            },
          }
        : undefined,
    ].filter(Boolean) as EChartsOption['yAxis'],
    series,
  }
}

const renderChart = () => {
  const instance = ensureChartInstance()
  if (!instance) {
    disposeChart()
    return
  }

  instance.setOption(getOption(), true)
  instance.resize()
}

watch(
  () => [props.points, props.showRate, props.countLabel, props.rateLabel, props.legendTotals],
  () => {
    nextTick(() => {
      if (props.points.length) {
        renderChart()
      } else {
        disposeChart()
      }
    })
  },
  { deep: true }
)

onMounted(() => {
  if (props.points.length) {
    nextTick(renderChart)
  }
})

onBeforeUnmount(() => {
  disposeChart()
})

useResizeObserver(chartRef, () => {
  chartInstance?.resize()
})
</script>

<template>
  <el-card shadow="hover" class="chart-card">
    <template #header>
      <div class="card-header">
        <h3>{{ title }}</h3>
        <slot name="header-extra" />
      </div>
    </template>
    <div v-if="points.length" ref="chartRef" class="chart-wrapper" :style="{ height: `${height}px` }" />
    <el-empty v-else description="暂无数据" :image-size="80" />
  </el-card>
</template>

<style scoped lang="scss">
.chart-card {
  border: none;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: $text-main-color;
    }
  }
}

.chart-wrapper {
  width: 100%;
}
</style>

