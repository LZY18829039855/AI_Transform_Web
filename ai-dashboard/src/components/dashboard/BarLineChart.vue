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

const emit = defineEmits<{
  (e: 'barClick', data: { label: string; deptCode?: string; count: number; rate: number }): void
}>()

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
  
  // 判断图表类型：根据 countLabel 判断是任职表还是认证表
  const isAppointmentChart = props.countLabel?.includes('任职') || false
  const isCertificationChart = props.countLabel?.includes('认证') || false
  
  // 根据图表类型设置坐标轴名称
  const leftAxisName = isCertificationChart ? '认证人数占比' : isAppointmentChart ? '任职人数占比' : '人数占比'
  const rightAxisName = isCertificationChart ? '认证人数' : isAppointmentChart ? '任职人数' : props.countLabel || '人数'
  
  // 判断是否是职位类任职数据或职位类认证数据图表
  const isJobCategoryChart = props.title === '职位类任职数据' || props.title === '职位类认证数据'
  const maxCharsPerLine = 4
  
  // 职位类图表不换行，其他图表按原逻辑处理
  const shouldWrapLabels = isJobCategoryChart ? false : longestLabelLength > maxCharsPerLine
  const axisLabelMargin = 8
  const fontSize = 12
  const lineHeight = fontSize * 1.2
  const estimatedLines = shouldWrapLabels ? Math.ceil(longestLabelLength / maxCharsPerLine) : 1
  const estimatedLabelHeight = estimatedLines * lineHeight
  const gridBottom = Math.max(30, Math.ceil(estimatedLabelHeight + axisLabelMargin + 16))

  // 先添加折线图（如果有），确保它在底层
  const series: EChartsOption['series'] = []
  
  if (props.showRate) {
    series.push({
      name: props.rateLabel,
      type: 'line',
      data: rates,
      yAxisIndex: 0, // 折线图使用左侧坐标轴（index=0）
      smooth: true,
      symbol: 'circle',
      symbolSize: 10,
      z: 1, // 设置较低的z值，确保在底层
      silent: false, // 允许点击，但会在事件处理中判断
      lineStyle: {
        width: 3,
        color: '#34c38f',
      },
      itemStyle: {
        color: '#34c38f',
        shadowBlur: 8,
        shadowColor: 'rgba(52, 195, 143, 0.35)',
      },
      // 移除areaStyle，避免遮挡柱状图的点击区域
      // areaStyle: {
      //   opacity: 0.08,
      //   color: '#34c38f',
      // },
    })
  }
  
  // 后添加柱状图，确保它在折线图上层，可以接收点击事件
  series.push({
    name: props.countLabel,
    type: 'bar',
    data: counts,
    yAxisIndex: props.showRate ? 1 : 0, // 如果有占比，柱状图使用右侧坐标轴（index=1），否则使用左侧（index=0）
    barWidth: 28,
    z: 2, // 设置较高的z值，确保在上层，优先接收点击事件
    // 确保柱状图可以点击
    emphasis: {
      focus: 'series',
    },
    itemStyle: {
      borderRadius: [8, 8, 0, 0],
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(58, 122, 254, 0.85)' },
        { offset: 1, color: 'rgba(58, 122, 254, 0.35)' },
      ]),
    },
  })

  return {
    grid: {
      left: '6%',
      right: props.showRate ? '10%' : '4%',
      top: props.showRate ? 60 : 40, // 当有占比时，增加顶部空间，为坐标轴名称和图例留出位置
      bottom: gridBottom,
      containLabel: false,
    },
    legend: {
      right: props.showRate ? 10 : 20, // 当有占比时，图例靠近右坐标轴
      top: props.showRate ? 5 : 10, // 当有占比时，图例位置在右坐标轴标题上方，避免重叠和被遮挡
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
          // 特殊处理：C Lab（模块）部门名称，让C Lab在一行，后面的（模块）在下一行
          if (value === 'C Lab（模块）') {
            return 'C Lab\n（模块）'
          }
          // 职位类图表不换行，直接返回原始值
          if (isJobCategoryChart) {
            return value
          }
          // 其他情况按原逻辑处理
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
      // 左侧坐标轴：人数占比（根据图表类型动态设置）
      props.showRate
        ? {
            type: 'value',
            name: leftAxisName,
            min: 0,
            max: 100,
            position: 'left',
            nameLocation: 'end', // 名称显示在坐标轴上方
            nameGap: 12, // 增大间距，使标题上移
            nameRotate: 0, // 文字横向排列
            nameTextStyle: {
              padding: [-5, 0, 0, -5], // 顶部负padding，使标题上移；左侧负padding，使标题左移
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { type: 'dashed', color: 'rgba(31, 45, 61, 0.12)' } },
            axisLabel: {
              formatter: '{value}%',
              color: 'rgba(31, 45, 61, 0.65)',
            },
          }
        : {
            type: 'value',
            name: props.countLabel,
            position: 'left',
            nameLocation: 'end', // 名称显示在坐标轴上方
            nameRotate: 0, // 文字横向排列
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { type: 'dashed', color: 'rgba(31, 45, 61, 0.12)' } },
            axisLabel: { color: 'rgba(31, 45, 61, 0.65)' },
          },
      // 右侧坐标轴：总人数（根据图表类型动态设置）
      props.showRate
        ? {
            type: 'value',
            name: rightAxisName,
            position: 'right',
            nameLocation: 'end', // 名称显示在坐标轴上方
            nameGap: 16, // 增大间距，使标题上移和右移
            nameRotate: 0, // 文字横向排列
            nameTextStyle: {
              padding: [-5, 0, 0, 5], // 顶部负padding，使标题上移；右侧正padding，使标题右移
            },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { color: 'rgba(31, 45, 61, 0.65)' },
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
  
  // 添加点击事件监听
  instance.off('click') // 先移除之前的监听，避免重复绑定
  
  // 监听所有点击事件
  instance.on('click', (params: any) => {
    // 调试信息
    console.log('BarLineChart click event:', {
      componentType: params.componentType,
      componentSubType: params.componentSubType,
      seriesType: params.seriesType,
      seriesName: params.seriesName,
      seriesIndex: params.seriesIndex,
      dataIndex: params.dataIndex,
      data: params.data,
      countLabel: props.countLabel,
    })
    
    // 处理点击事件：无论是点击柱状图还是折线图，都根据 dataIndex 来触发下钻
    // 因为柱状图和折线图对应的是同一个数据点
    if (params.componentType === 'series' && params.dataIndex !== undefined && params.dataIndex >= 0) {
      const dataIndex = params.dataIndex
      if (dataIndex < props.points.length) {
        const point = props.points[dataIndex]
        if (point) {
          // 判断是否是柱状图的点击，或者折线图的点击（都触发下钻）
          const isBarClick = params.seriesType === 'bar' || params.seriesName === props.countLabel
          const isLineClick = params.seriesType === 'line' && params.seriesName === props.rateLabel
          
          // 如果是柱状图点击，优先触发下钻
          // 如果是折线图点击，也触发下钻（因为对应同一个数据点）
          if (isBarClick || isLineClick) {
            console.log('Emitting barClick event:', {
              label: point.label,
              deptCode: point.deptCode,
              count: point.count,
              rate: point.rate,
              clickedSeries: params.seriesType,
              seriesName: params.seriesName,
            })
            emit('barClick', {
              label: point.label,
              deptCode: point.deptCode,
              count: point.count,
              rate: point.rate,
            })
          } else {
            console.log('Click event ignored - not a bar or line series', {
              seriesType: params.seriesType,
              seriesName: params.seriesName,
              countLabel: props.countLabel,
              rateLabel: props.rateLabel,
            })
          }
        } else {
          console.warn('Point not found at index:', dataIndex)
        }
      } else {
        console.warn('Invalid dataIndex:', dataIndex, 'points length:', props.points.length)
      }
    } else {
      // 如果点击的不是系列，尝试使用坐标转换来判断
      if (params.event && params.event.offsetX !== undefined && params.event.offsetY !== undefined) {
        try {
          const pointInPixel = [params.event.offsetX, params.event.offsetY]
          const pointInGrid = instance.convertFromPixel('grid', pointInPixel)
          if (pointInGrid && pointInGrid[0] !== undefined) {
            const dataIndex = Math.round(pointInGrid[0])
            if (dataIndex >= 0 && dataIndex < props.points.length) {
              const point = props.points[dataIndex]
              if (point) {
                console.log('Fallback: Emitting barClick event by coordinate:', {
                  label: point.label,
                  deptCode: point.deptCode,
                  count: point.count,
                  rate: point.rate,
                })
                emit('barClick', {
                  label: point.label,
                  deptCode: point.deptCode,
                  count: point.count,
                  rate: point.rate,
                })
              }
            }
          }
        } catch (error) {
          console.warn('Failed to convert pixel to grid:', error)
        }
      } else {
        console.log('Click event ignored - not a series component or invalid dataIndex', {
          componentType: params.componentType,
          dataIndex: params.dataIndex,
        })
      }
    }
  })
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
        <h3>
          {{ title }}
          <slot name="title-suffix" />
        </h3>
        <slot name="header-extra" />
      </div>
    </template>
    <div v-if="points.length" ref="chartRef" class="chart-wrapper" :style="{ height: `${height}px` }" />
    <el-empty v-else description="待提供数据" :image-size="80" />
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

