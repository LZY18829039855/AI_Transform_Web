<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Delete, DocumentAdd, EditPen, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  createTrainingCourse,
  deleteTrainingCourse,
  fetchCoursePlanningWithDeptSelections,
  fetchTrainingCourseList,
  updateTrainingCourse,
} from '@/api/trainingCourseManage'
import type { DepartmentSelection } from '@/types/dashboard'
import type { TrainingCourseRecord } from '@/types/trainingCourseManage'
import {
  fetchCreditWritePermission,
  guardCreditWriteAccess,
} from '@/utils/permissions'

const activeTab = ref<'courses' | 'deptSelections'>('courses')
const loading = ref(false)
const canEdit = ref(false)

/** ---------- 课程管理 ---------- */
const courseRows = ref<TrainingCourseRecord[]>([])
const courseTotal = ref(0)
const coursePageNum = ref(1)
const coursePageSize = ref(20)
const coursePageSizeOptions = [10, 20, 50, 100, 200] as const
const courseNameFilter = ref('')
const courseLevelFilter = ref('')
const selectedCourses = ref<TrainingCourseRecord[]>([])

const courseDialogVisible = ref(false)
const courseDialogTitle = ref('编辑课程')
const courseFormRef = ref<FormInstance>()
const courseForm = ref<TrainingCourseRecord>(emptyCourse())
const courseSaving = ref(false)

const COURSE_LEVEL_OPTIONS = ['基础', '进阶', '实战'] as const

function emptyCourse(): TrainingCourseRecord {
  return {
    id: 0,
    bigType: '',
    sybType: '',
    courseName: '',
    courseLink: '',
    credit: '',
    courseStatus: '',
    knowledgePoint: '',
    courseExplain: '',
    studyDuration: '',
    courseLevel: '基础',
    inClassTest: '',
    courseNumber: '',
    selectedDepts: [],
  }
}

const courseRules: FormRules = {
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  courseLevel: [{ required: true, message: '请选择训战分类', trigger: 'change' }],
}

const COURSE_LEVEL_ORDER: Record<string, number> = {
  基础: 1,
  进阶: 2,
  实战: 3,
}

function sortCourseRows(rows: TrainingCourseRecord[]): TrainingCourseRecord[] {
  return [...rows].sort((a, b) => {
    const typeCompare = (a.bigType || '').localeCompare(b.bigType || '')
    if (typeCompare !== 0) {
      return typeCompare
    }
    const aOrder = COURSE_LEVEL_ORDER[a.courseLevel] ?? 999
    const bOrder = COURSE_LEVEL_ORDER[b.courseLevel] ?? 999
    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }
    return (a.courseName || '').localeCompare(b.courseName || '')
  })
}

/** 课程主分类列合并（对齐训战课程规划表） */
const courseSpanMethod = ({
  row,
  rowIndex,
  columnIndex,
}: {
  row: TrainingCourseRecord
  rowIndex: number
  columnIndex: number
}) => {
  const bigTypeColIndex = canEdit.value ? 1 : 0
  if (columnIndex !== bigTypeColIndex) {
    return { rowspan: 1, colspan: 1 }
  }
  const currentValue = row.bigType
  if (rowIndex > 0 && courseRows.value[rowIndex - 1]?.bigType === currentValue) {
    return { rowspan: 0, colspan: 0 }
  }
  let rowspan = 1
  for (let i = rowIndex + 1; i < courseRows.value.length; i++) {
    if (courseRows.value[i]?.bigType === currentValue) {
      rowspan++
    } else {
      break
    }
  }
  return { rowspan, colspan: 1 }
}

async function loadCourses() {
  loading.value = true
  try {
    const page = await fetchTrainingCourseList({
      pageNum: coursePageNum.value,
      pageSize: coursePageSize.value,
      courseName: courseNameFilter.value.trim() || undefined,
      courseLevel: courseLevelFilter.value || undefined,
    })
    courseRows.value = sortCourseRows(page.rows)
    courseTotal.value = page.total
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载课程列表失败')
  } finally {
    loading.value = false
  }
}

function handleCourseSearch() {
  coursePageNum.value = 1
  loadCourses()
}

function handleCoursePageSizeChange() {
  coursePageNum.value = 1
  loadCourses()
}

function handleCourseSelectionChange(rows: TrainingCourseRecord[]) {
  selectedCourses.value = rows
}

const hasCourseSelection = computed(() => selectedCourses.value.length > 0)

async function handleAddCourse() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  courseDialogTitle.value = '新增训战课程'
  courseForm.value = emptyCourse()
  courseDialogVisible.value = true
}

async function handleEditCourse(row: TrainingCourseRecord) {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  courseDialogTitle.value = '编辑训战课程'
  courseForm.value = { ...row, selectedDepts: [...(row.selectedDepts ?? [])] }
  courseDialogVisible.value = true
}

async function handleSubmitCourse() {
  if (!(await guardCreditWriteAccess())) {
    courseDialogVisible.value = false
    return
  }
  if (!courseFormRef.value) {
    return
  }
  try {
    await courseFormRef.value.validate()
  } catch {
    return
  }
  courseSaving.value = true
  try {
    const m = courseForm.value
    if (!m.id) {
      await createTrainingCourse(m)
      ElMessage.success('新增成功')
      courseDialogVisible.value = false
      coursePageNum.value = 1
      await loadCourses()
      await refreshCourseOptions()
    } else {
      await updateTrainingCourse(m.id, m)
      ElMessage.success('保存成功')
      courseDialogVisible.value = false
      await loadCourses()
      await refreshCourseOptions()
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    courseSaving.value = false
  }
}

async function handleDeleteCourse(row: TrainingCourseRecord) {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除课程「${row.courseName || row.id}」吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await deleteTrainingCourse(row.id)
    ElMessage.success('已删除')
    await loadCourses()
    await refreshCourseOptions()
  } catch (e) {
    if (e === 'cancel' || e === 'close') {
      return
    }
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

async function handleBatchDeleteCourses() {
  if (!selectedCourses.value.length) {
    return
  }
  if (!(await guardCreditWriteAccess())) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedCourses.value.length} 门课程吗？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    for (const row of selectedCourses.value) {
      await deleteTrainingCourse(row.id)
    }
    ElMessage.success('已删除')
    await loadCourses()
    await refreshCourseOptions()
  } catch (e) {
    if (e === 'cancel' || e === 'close') {
      return
    }
    ElMessage.error(e instanceof Error ? e.message : '批量删除失败')
  }
}

/** ---------- 部门目标选课（对齐训战课程规划表，查询复用 /course-planning-info/list） ---------- */
const planningRows = ref<TrainingCourseRecord[]>([])
const departmentColumns = ref<DepartmentSelection[]>([])
/** courseId -> 已选部门编码集合 */
const selectionByCourse = ref<Map<number, Set<string>>>(new Map())

function isSelectedByDept(row: TrainingCourseRecord, deptCode: string): boolean {
  if (!row.id) {
    return false
  }
  return selectionByCourse.value.get(row.id)?.has(deptCode) ?? false
}

/** 规划表课程主分类合并（无多选列，主分类固定第 0 列） */
const planningSpanMethod = ({
  row,
  rowIndex,
  columnIndex,
}: {
  row: TrainingCourseRecord
  rowIndex: number
  columnIndex: number
}) => {
  if (columnIndex !== 0) {
    return { rowspan: 1, colspan: 1 }
  }
  const currentValue = row.bigType
  if (rowIndex > 0 && planningRows.value[rowIndex - 1]?.bigType === currentValue) {
    return { rowspan: 0, colspan: 0 }
  }
  let rowspan = 1
  for (let i = rowIndex + 1; i < planningRows.value.length; i++) {
    if (planningRows.value[i]?.bigType === currentValue) {
      rowspan++
    } else {
      break
    }
  }
  return { rowspan, colspan: 1 }
}

function buildDepartmentColumnsFromCourses(courses: TrainingCourseRecord[]): DepartmentSelection[] {
  const deptMap = new Map<string, string>()
  for (const course of courses) {
    for (const dept of course.selectedDepts ?? []) {
      if (dept.deptCode) {
        deptMap.set(dept.deptCode, dept.deptName || dept.deptCode)
      }
    }
  }
  return Array.from(deptMap.entries())
    .map(([deptCode, deptName]) => ({ deptCode, deptName }))
    .sort((a, b) => a.deptCode.localeCompare(b.deptCode))
}

function buildSelectionMap(courses: TrainingCourseRecord[]): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>()
  for (const course of courses) {
    if (!course.id) {
      continue
    }
    const set = new Set<string>()
    for (const dept of course.selectedDepts ?? []) {
      if (dept.deptCode) {
        set.add(dept.deptCode)
      }
    }
    map.set(course.id, set)
  }
  return map
}

async function loadDeptSelections() {
  loading.value = true
  try {
    const courses = await fetchCoursePlanningWithDeptSelections()
    planningRows.value = sortCourseRows(courses)
    departmentColumns.value = buildDepartmentColumnsFromCourses(courses)
    selectionByCourse.value = buildSelectionMap(courses)
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载部门选课失败')
  } finally {
    loading.value = false
  }
}

async function refreshCourseOptions() {
  try {
    if (activeTab.value === 'deptSelections') {
      await loadDeptSelections()
    }
  } catch (e) {
    console.error(e)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'courses') {
    loadCourses()
  } else {
    loadDeptSelections()
  }
})

onMounted(async () => {
  fetchCreditWritePermission().then((allowed) => {
    canEdit.value = allowed
  })
  await loadCourses()
})
</script>

<template>
  <div class="manage-page" v-loading="loading">
    <section class="manage-dashboard">
      <header class="dashboard__header glass-card">
        <div class="header-info">
          <h2>AI训战课程管理</h2>
          <p>
            统一维护 AI 训战课程主数据，并按四级部门配置目标选课（基础/进阶与实战）。写操作权限与多元化学分管理一致，无更新权限时为只读模式。
          </p>
        </div>
      </header>

      <el-card class="manage-card" shadow="never">
        <el-tabs v-model="activeTab">
          <!-- 课程 CRUD -->
          <el-tab-pane label="课程管理" name="courses">
            <div class="manage-toolbar">
              <div class="manage-toolbar__start">
                <el-button v-if="canEdit" type="success" :icon="DocumentAdd" @click="handleAddCourse">
                  新增课程
                </el-button>
                <el-tag v-if="!canEdit" type="info" effect="plain">只读模式</el-tag>
              </div>
              <div class="manage-toolbar__right">
                <el-select
                  v-model="courseLevelFilter"
                  clearable
                  placeholder="训战分类"
                  class="manage-toolbar__level"
                  @change="handleCourseSearch"
                  @clear="handleCourseSearch"
                >
                  <el-option v-for="lv in COURSE_LEVEL_OPTIONS" :key="lv" :label="lv" :value="lv" />
                </el-select>
                <el-input
                  v-model="courseNameFilter"
                  class="manage-toolbar__filter"
                  clearable
                  placeholder="筛选课程名称"
                  @clear="handleCourseSearch"
                  @keyup.enter="handleCourseSearch"
                >
                  <template #suffix>
                    <el-icon class="manage-toolbar__search-icon" title="查询" @click.stop="handleCourseSearch">
                      <Search />
                    </el-icon>
                  </template>
                </el-input>
                <el-tooltip v-if="canEdit" content="批量删除" placement="top">
                  <span class="manage-toolbar__batch-wrap">
                    <el-button
                      type="danger"
                      :icon="Delete"
                      :disabled="!hasCourseSelection"
                      circle
                      @click="handleBatchDeleteCourses"
                    />
                  </span>
                </el-tooltip>
              </div>
            </div>

            <el-table
              class="manage-table planning-like-table"
              :data="courseRows"
              border
              style="width: 100%"
              max-height="560"
              :span-method="courseSpanMethod"
              @selection-change="handleCourseSelectionChange"
            >
              <el-table-column
                v-if="canEdit"
                type="selection"
                width="48"
                header-align="center"
                align="center"
              />
              <el-table-column prop="bigType" label="课程主分类" width="120" header-align="center" align="center" />
              <el-table-column prop="courseLevel" label="训战分类" width="100" header-align="center" align="center" />
              <el-table-column prop="courseName" label="课程名称" min-width="280" header-align="center" align="center" show-overflow-tooltip />
              <el-table-column label="课程编码" min-width="200" header-align="center" align="center">
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
                  <span v-else-if="row.courseNumber">{{ row.courseNumber }}</span>
                  <span v-else class="cell-placeholder">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="credit" label="学分" width="80" header-align="center" align="center" />
              <el-table-column
                v-if="canEdit"
                label="操作"
                min-width="140"
                header-align="center"
                align="center"
              >
                <template #default="{ row }">
                  <el-button link type="primary" :icon="EditPen" @click="handleEditCourse(row)">编辑</el-button>
                  <el-button link type="danger" :icon="Delete" @click="handleDeleteCourse(row)">删除</el-button>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty :description="canEdit ? '暂无数据，请点击「新增课程」' : '暂无数据'" />
              </template>
            </el-table>

            <div class="manage-pagination">
              <el-pagination
                v-model:current-page="coursePageNum"
                v-model:page-size="coursePageSize"
                :total="courseTotal"
                :page-sizes="[...coursePageSizeOptions]"
                layout="total, sizes, prev, pager, next, jumper"
                background
                @size-change="handleCoursePageSizeChange"
                @current-change="loadCourses"
              />
            </div>
          </el-tab-pane>

          <!-- 部门目标选课：查询复用训战课程规划表 /course-planning-info/list -->
          <el-tab-pane label="部门目标选课" name="deptSelections">
            <div class="manage-toolbar">
              <div class="manage-toolbar__start">
                <el-tag type="info" effect="plain">当前只读展示，增删改后端待实现</el-tag>
              </div>
            </div>

            <el-table
              class="planning-table"
              :data="planningRows"
              border
              style="width: 100%"
              max-height="620"
              empty-text="暂无数据"
              :span-method="planningSpanMethod"
            >
              <el-table-column prop="bigType" label="课程主分类" width="120" align="center" />
              <el-table-column prop="courseLevel" label="训战分类" width="100" align="center" />
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

              <el-table-column
                v-for="dept in departmentColumns"
                :key="dept.deptCode"
                :label="dept.deptName"
                width="120"
                align="center"
              >
                <template #default="{ row }">
                  <el-icon v-if="isSelectedByDept(row, dept.deptCode)" class="check-icon">
                    <Check />
                  </el-icon>
                  <span v-else class="cell-placeholder">-</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </section>

    <!-- 课程表单 -->
    <el-dialog v-model="courseDialogVisible" :title="courseDialogTitle" width="640px" destroy-on-close>
      <el-form ref="courseFormRef" :model="courseForm" :rules="courseRules" label-width="110px" v-loading="courseSaving">
        <el-form-item label="课程名称" prop="courseName">
          <el-input v-model="courseForm.courseName" placeholder="课程名称" clearable />
        </el-form-item>
        <el-form-item label="训战分类" prop="courseLevel">
          <el-select v-model="courseForm.courseLevel" placeholder="请选择" style="width: 100%">
            <el-option v-for="lv in COURSE_LEVEL_OPTIONS" :key="lv" :label="lv" :value="lv" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程主分类" prop="bigType">
          <el-input v-model="courseForm.bigType" placeholder="如：通用能力 / 专业能力" clearable />
        </el-form-item>
        <el-form-item label="子类" prop="sybType">
          <el-input v-model="courseForm.sybType" placeholder="子类 / 实战任务类型" clearable />
        </el-form-item>
        <el-form-item label="课程编码" prop="courseNumber">
          <el-input v-model="courseForm.courseNumber" placeholder="线上课程编码" clearable />
        </el-form-item>
        <el-form-item label="课程链接" prop="courseLink">
          <el-input v-model="courseForm.courseLink" placeholder="iLearning 等课程链接" clearable />
        </el-form-item>
        <el-form-item label="学分" prop="credit">
          <el-input v-model="courseForm.credit" placeholder="学分" clearable />
        </el-form-item>
        <el-form-item label="课程状态" prop="courseStatus">
          <el-input v-model="courseForm.courseStatus" placeholder="如：有效 / 下线" clearable />
        </el-form-item>
        <el-form-item label="学习时长" prop="studyDuration">
          <el-input v-model="courseForm.studyDuration" placeholder="学习时长" clearable />
        </el-form-item>
        <el-form-item label="知识点" prop="knowledgePoint">
          <el-input v-model="courseForm.knowledgePoint" type="textarea" :rows="2" placeholder="知识点" />
        </el-form-item>
        <el-form-item label="课程说明" prop="courseExplain">
          <el-input v-model="courseForm.courseExplain" type="textarea" :rows="3" placeholder="课程说明" />
        </el-form-item>
        <el-form-item label="随堂测试" prop="inClassTest">
          <el-input v-model="courseForm.inClassTest" placeholder="随堂测试说明" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="courseDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="courseSaving" @click="handleSubmitCourse">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.manage-page {
  width: 100%;
  padding-bottom: $spacing-xl;
}

.manage-dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.dashboard__header.glass-card {
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
    white-space: normal;
  }
}

.header-info {
  max-width: 100%;
}

.manage-card {
  border-radius: $radius-md;
  border: 1px solid $border-color;
}

.manage-toolbar {
  margin-bottom: $spacing-md;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.manage-toolbar__start {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-md;
  flex: 1;
  min-width: 0;
}

.manage-toolbar__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.manage-toolbar__filter {
  width: 220px;
  max-width: min(220px, 100%);
}

.manage-toolbar__level {
  width: 120px;
}

.manage-toolbar__search-icon {
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 18px;
  vertical-align: middle;
  outline: none;

  &:hover {
    color: var(--el-color-primary-light-3);
  }
}

.manage-toolbar__batch-wrap {
  display: inline-flex;
  vertical-align: middle;
}

.manage-table {
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
}

.manage-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-md;
  width: 100%;
}

.course-link {
  font-weight: 500;
  color: $primary-color;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.cell-placeholder {
  color: #999;
}

.planning-table {
  width: 100%;

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
}
</style>
