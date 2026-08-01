<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Delete, DocumentAdd, EditPen, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { fetchDepartmentChildren } from '@/api/dashboard'
import {
  calcTargetNums,
  createDeptCourseSelection,
  createTrainingCourse,
  deleteDeptCourseSelection,
  deleteTrainingCourse,
  fetchAllTrainingCourses,
  fetchDeptCourseSelectionList,
  fetchTrainingCourseList,
  splitCourseIdsByLevel,
  updateDeptCourseSelection,
  updateTrainingCourse,
} from '@/api/trainingCourseManage'
import type { DepartmentInfoVO } from '@/types/dashboard'
import type { DeptCourseSelectionRecord, TrainingCourseRecord } from '@/types/trainingCourseManage'
import {
  fetchCreditWritePermission,
  guardCreditWriteAccess,
} from '@/utils/permissions'

/** 云核心网研发管理部（三级），其下直属子部门为四级部门 */
const R_D_MANAGEMENT_DEPT_CODE = '030681'

const activeTab = ref<'courses' | 'deptSelections'>('courses')
const courseLoading = ref(false)
const deptLoading = ref(false)
/** 与多元化学分管理一致：canEditCredit 控制配置权限 */
const canEditCredit = ref(false)
/** 部门选课是否已加载过，避免切页签重复请求导致整页闪烁 */
let deptLoaded = false

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
  bigType: [{ required: true, message: '请输入课程主分类', trigger: 'blur' }],
  courseNumber: [{ required: true, message: '请输入课程编码', trigger: 'blur' }],
  courseLink: [{ required: true, message: '请输入课程链接', trigger: 'blur' }],
  credit: [
    { required: true, message: '请输入学分', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const text = String(value ?? '').trim()
        if (!text) {
          callback(new Error('请输入学分'))
          return
        }
        // 仅允许非负整数或小数（如 1、1.5），禁止文字及其他格式
        if (!/^\d+(\.\d+)?$/.test(text)) {
          callback(new Error('学分仅支持整数或小数'))
          return
        }
        if (!Number.isFinite(Number(text))) {
          callback(new Error('学分仅支持整数或小数'))
          return
        }
        callback()
      },
      trigger: ['blur', 'change'],
    },
  ],
}

/** 输入时过滤非法字符，仅保留数字与一个小数点 */
function onCreditInput(value: string) {
  let next = String(value ?? '').replace(/[^\d.]/g, '')
  const firstDot = next.indexOf('.')
  if (firstDot !== -1) {
    next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, '')}`
  }
  courseForm.value.credit = next
}

const COURSE_LEVEL_ORDER: Record<string, number> = {
  基础: 1,
  进阶: 2,
  实战: 3,
}

function sortCourseRows(rows: TrainingCourseRecord[], preferBigType?: string): TrainingCourseRecord[] {
  const prefer = preferBigType?.trim() || ''
  return [...rows].sort((a, b) => {
    if (prefer) {
      const aPin = (a.bigType || '') === prefer ? 0 : 1
      const bPin = (b.bigType || '') === prefer ? 0 : 1
      if (aPin !== bPin) {
        return aPin - bPin
      }
    }
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

/** 增改成功后置顶的课程主分类 */
const pinnedBigType = ref('')


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
  const bigTypeColIndex = 1
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
  courseLoading.value = true
  try {
    const page = await fetchTrainingCourseList({
      pageNum: coursePageNum.value,
      pageSize: coursePageSize.value,
      courseName: courseNameFilter.value.trim() || undefined,
      courseLevel: courseLevelFilter.value || undefined,
      preferBigType: pinnedBigType.value || undefined,
    })
    // API 内已按 preferBigType 排序分页；此处再排一次保证页内合并单元格稳定
    courseRows.value = sortCourseRows(page.rows, pinnedBigType.value || undefined)
    courseTotal.value = page.total
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载课程列表失败')
  } finally {
    courseLoading.value = false
  }
}

function handleCourseSearch() {
  pinnedBigType.value = ''
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
    const preferType = (m.bigType || '').trim()
    if (!m.id) {
      await createTrainingCourse(m)
      ElMessage.success('新增成功')
      courseDialogVisible.value = false
      pinnedBigType.value = preferType
      coursePageNum.value = 1
      await loadCourses()
      await refreshCourseOptions()
    } else {
      await updateTrainingCourse(m.id, m)
      ElMessage.success('保存成功')
      courseDialogVisible.value = false
      pinnedBigType.value = preferType
      coursePageNum.value = 1
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
  if (!(await guardCreditWriteAccess())) {
    return
  }
  if (!selectedCourses.value.length) {
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

/** ---------- 部门目标选课 ---------- */
const allCoursesForDept = ref<TrainingCourseRecord[]>([])
const deptSelectionList = ref<DeptCourseSelectionRecord[]>([])
const filterDeptCode = ref('')
const filterDeptName = ref('')
const selectedDeptCourseRows = ref<TrainingCourseRecord[]>([])
const deptSaving = ref(false)

const addDeptDialogVisible = ref(false)
const addDeptCode = ref('')
const addDeptName = ref('')
const addDeptCourseIds = ref<number[]>([])
const level4DeptOptions = ref<DepartmentInfoVO[]>([])
const level4DeptLoading = ref(false)

const editCoursesDialogVisible = ref(false)
const editCourseIds = ref<number[]>([])

const currentDeptSelection = computed(() =>
  deptSelectionList.value.find((d) => d.deptCode === filterDeptCode.value) ?? null,
)

/** 总览：与训战课程规划表一致的部门列 */
const departmentColumns = computed(() =>
  [...deptSelectionList.value]
    .map((d) => ({ deptCode: d.deptCode, deptName: d.deptName || d.deptCode }))
    .sort((a, b) => a.deptCode.localeCompare(b.deptCode)),
)

/** 总览矩阵：全部课程行 */
const planningOverviewRows = computed(() => sortCourseRows(allCoursesForDept.value))

function isSelectedByDept(row: TrainingCourseRecord, deptCode: string): boolean {
  if (!row.id || !deptCode) {
    return false
  }
  const sel = deptSelectionList.value.find((d) => d.deptCode === deptCode)
  if (!sel) {
    return false
  }
  return sel.courseIds.includes(row.id) || sel.practicalCourseIds.includes(row.id)
}

/** 当前部门下的目标课程（仅展示已选课程） */
const filteredDeptCourses = computed(() => {
  if (!filterDeptCode.value) {
    return []
  }
  const sel = currentDeptSelection.value
  if (!sel) {
    return []
  }
  const idSet = new Set([...sel.courseIds, ...sel.practicalCourseIds])
  return sortCourseRows(allCoursesForDept.value.filter((c) => idSet.has(c.id)))
})

const courseOptionsForSelect = computed(() =>
  allCoursesForDept.value.map((c) => ({
    value: c.id,
    label: `[${c.courseLevel || '-'}] ${c.courseName || c.courseNumber || c.id}`,
  })),
)

/** 规划表总览：主分类在第 0 列 */
const planningOverviewSpanMethod = ({
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
  const rows = planningOverviewRows.value
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

/** 部门明细：有多选列时主分类为第 1 列 */
const deptSpanMethod = ({
  row,
  rowIndex,
  columnIndex,
}: {
  row: TrainingCourseRecord
  rowIndex: number
  columnIndex: number
}) => {
  if (columnIndex !== 1) {
    return { rowspan: 1, colspan: 1 }
  }
  const currentValue = row.bigType
  const rows = filteredDeptCourses.value
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

function handleQuickSelectDept(deptCode: string) {
  filterDeptCode.value = deptCode || ''
  const existing = deptSelectionList.value.find((d) => d.deptCode === filterDeptCode.value)
  filterDeptName.value = existing?.deptName || filterDeptCode.value
  selectedDeptCourseRows.value = []
}

async function loadLevel4DeptOptions() {
  level4DeptLoading.value = true
  try {
    const children = await fetchDepartmentChildren(R_D_MANAGEMENT_DEPT_CODE)
    // 研发管理部下直属子部门即为四级；再按层级过滤兜底
    level4DeptOptions.value = (children || [])
      .filter((d) => !d.deptLevel || String(d.deptLevel) === '4')
      .sort((a, b) => a.deptCode.localeCompare(b.deptCode))
  } catch (e) {
    console.error(e)
    level4DeptOptions.value = []
    ElMessage.error(e instanceof Error ? e.message : '加载四级部门失败')
  } finally {
    level4DeptLoading.value = false
  }
}

function handleAddDeptSelect(deptCode: string) {
  const selected = level4DeptOptions.value.find((d) => d.deptCode === deptCode)
  addDeptCode.value = selected?.deptCode || ''
  addDeptName.value = selected?.deptName || ''
}

function buildRecordFromSelectedIds(
  deptCode: string,
  deptName: string,
  selectedIds: number[],
  prev?: DeptCourseSelectionRecord | null,
): DeptCourseSelectionRecord {
  const { courseIds, practicalCourseIds } = splitCourseIdsByLevel(allCoursesForDept.value, selectedIds)
  const nums = calcTargetNums(allCoursesForDept.value, courseIds, practicalCourseIds)
  return {
    deptCode,
    deptName: deptName || deptCode,
    courseIds,
    practicalCourseIds,
    basicTargetCoursesNum: prev?.basicTargetCoursesNum ?? nums.basicTargetCoursesNum,
    advancedTargetCoursesNum: prev?.advancedTargetCoursesNum ?? nums.advancedTargetCoursesNum,
    practicalTargetCoursesNum: prev?.practicalTargetCoursesNum ?? nums.practicalTargetCoursesNum,
  }
}

async function loadDeptSelections(force = false) {
  if (deptLoaded && !force) {
    return
  }
  deptLoading.value = true
  try {
    const [courses, depts] = await Promise.all([
      fetchAllTrainingCourses(),
      fetchDeptCourseSelectionList(),
    ])
    allCoursesForDept.value = sortCourseRows(courses)
    deptSelectionList.value = depts.sort((a, b) => a.deptCode.localeCompare(b.deptCode))
    deptLoaded = true
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载部门选课失败')
  } finally {
    deptLoading.value = false
  }
}

async function refreshCourseOptions() {
  deptLoaded = false
  try {
    if (activeTab.value === 'deptSelections') {
      await loadDeptSelections(true)
    }
  } catch (e) {
    console.error(e)
  }
}

async function openAddDeptDialog() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  addDeptCode.value = ''
  addDeptName.value = ''
  addDeptCourseIds.value = []
  addDeptDialogVisible.value = true
  if (!level4DeptOptions.value.length) {
    await loadLevel4DeptOptions()
  }
}

async function submitAddDeptSelection() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  const code = addDeptCode.value.trim()
  const name = addDeptName.value.trim() || code
  if (!code) {
    ElMessage.warning('请选择四级部门')
    return
  }
  if (deptSelectionList.value.some((d) => d.deptCode === code)) {
    ElMessage.warning('该部门选课配置已存在，请直接筛选后编辑')
    return
  }
  deptSaving.value = true
  try {
    const record = buildRecordFromSelectedIds(code, name, addDeptCourseIds.value)
    // 新建时目标数按选课自动计算
    const nums = calcTargetNums(allCoursesForDept.value, record.courseIds, record.practicalCourseIds)
    record.basicTargetCoursesNum = nums.basicTargetCoursesNum
    record.advancedTargetCoursesNum = nums.advancedTargetCoursesNum
    record.practicalTargetCoursesNum = nums.practicalTargetCoursesNum
    await createDeptCourseSelection(record)
    ElMessage.success('新增部门选课成功')
    addDeptDialogVisible.value = false
    await loadDeptSelections(true)
    handleQuickSelectDept(code)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '新增失败')
  } finally {
    deptSaving.value = false
  }
}

async function openEditCoursesDialog() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  if (!filterDeptCode.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  const sel = currentDeptSelection.value
  if (!sel) {
    ElMessage.warning('该部门尚无选课配置，请先「新增部门选课」')
    return
  }
  editCourseIds.value = [...sel.courseIds, ...sel.practicalCourseIds]
  editCoursesDialogVisible.value = true
}

async function submitEditCourses() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  if (!filterDeptCode.value) {
    return
  }
  const prev = currentDeptSelection.value
  if (!prev) {
    ElMessage.warning('该部门尚无选课配置')
    return
  }
  deptSaving.value = true
  try {
    const record = buildRecordFromSelectedIds(
      filterDeptCode.value,
      filterDeptName.value || prev.deptName,
      editCourseIds.value,
    )
    // 编辑选课时同步刷新目标数
    const nums = calcTargetNums(allCoursesForDept.value, record.courseIds, record.practicalCourseIds)
    record.basicTargetCoursesNum = nums.basicTargetCoursesNum
    record.advancedTargetCoursesNum = nums.advancedTargetCoursesNum
    record.practicalTargetCoursesNum = nums.practicalTargetCoursesNum
    await updateDeptCourseSelection(filterDeptCode.value, record)
    ElMessage.success('选课已更新')
    editCoursesDialogVisible.value = false
    await loadDeptSelections(true)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  } finally {
    deptSaving.value = false
  }
}

async function handleRemoveDeptCourses(rows: TrainingCourseRecord[]) {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  if (!filterDeptCode.value || !rows.length) {
    return
  }
  const prev = currentDeptSelection.value
  if (!prev) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定从该部门目标选课中移除 ${rows.length} 门课程吗？`,
      '移除确认',
      { type: 'warning', confirmButtonText: '移除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  const removeIds = new Set(rows.map((r) => r.id))
  const remainIds = [...prev.courseIds, ...prev.practicalCourseIds].filter((id) => !removeIds.has(id))
  deptSaving.value = true
  try {
    const record = buildRecordFromSelectedIds(
      filterDeptCode.value,
      filterDeptName.value || prev.deptName,
      remainIds,
    )
    const nums = calcTargetNums(allCoursesForDept.value, record.courseIds, record.practicalCourseIds)
    record.basicTargetCoursesNum = nums.basicTargetCoursesNum
    record.advancedTargetCoursesNum = nums.advancedTargetCoursesNum
    record.practicalTargetCoursesNum = nums.practicalTargetCoursesNum
    await updateDeptCourseSelection(filterDeptCode.value, record)
    ElMessage.success('已移除')
    selectedDeptCourseRows.value = []
    await loadDeptSelections(true)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '移除失败')
  } finally {
    deptSaving.value = false
  }
}

async function handleDeleteDeptConfig() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  if (!filterDeptCode.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  if (!currentDeptSelection.value) {
    ElMessage.warning('该部门尚无选课配置')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除部门「${filterDeptName.value || filterDeptCode.value}」的全部目标选课配置吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  deptSaving.value = true
  try {
    await deleteDeptCourseSelection(filterDeptCode.value)
    ElMessage.success('已删除部门选课配置')
    filterDeptCode.value = ''
    filterDeptName.value = ''
    await loadDeptSelections(true)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  } finally {
    deptSaving.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'deptSelections') {
    loadDeptSelections()
  }
})

onMounted(async () => {
  fetchCreditWritePermission().then((allowed) => {
    canEditCredit.value = allowed
  })
  await loadCourses()
})
</script>

<template>
  <div class="manage-page">
    <section class="manage-dashboard">
      <header class="dashboard__header glass-card">
        <div class="header-info">
          <h2>AI训战课程管理</h2>
          <p>
            统一维护 AI 训战课程主数据，并查看各部门目标选课情况（基础/进阶与实战）。
          </p>
        </div>
      </header>

      <el-card class="manage-card" shadow="never">
        <el-tabs v-model="activeTab">
          <!-- 课程 CRUD -->
          <el-tab-pane label="课程管理" name="courses">
            <div v-loading="courseLoading">
            <div class="manage-toolbar">
              <div class="manage-toolbar__start">
                <el-button
                  v-if="canEditCredit"
                  type="success"
                  :icon="DocumentAdd"
                  @click="handleAddCourse"
                >
                  新增课程
                </el-button>
                <el-tag v-if="!canEditCredit" type="info" effect="plain">只读模式</el-tag>
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
                <el-tooltip v-if="canEditCredit" content="批量删除" placement="top">
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
                v-if="canEditCredit"
                type="selection"
                width="48"
                header-align="center"
                align="center"
              />
              <el-table-column prop="bigType" label="课程主分类" width="120" header-align="center" align="center" />
              <el-table-column prop="courseLevel" label="训战分类" width="100" header-align="center" align="center" />
              <el-table-column prop="sybType" label="课程子类" min-width="120" header-align="center" align="center" show-overflow-tooltip />
              <el-table-column prop="courseName" label="课程名称" min-width="200" header-align="center" align="center" show-overflow-tooltip />
              <el-table-column prop="knowledgePoint" label="知识点" min-width="140" header-align="center" align="center" show-overflow-tooltip />
              <el-table-column prop="courseExplain" label="课程说明" min-width="160" header-align="center" align="center" show-overflow-tooltip />
              <el-table-column label="课程编码" min-width="160" header-align="center" align="center">
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
                v-if="canEditCredit"
                label="操作"
                width="100"
                header-align="center"
                align="center"
              >
                <template #default="{ row }">
                  <el-tooltip content="编辑" placement="top">
                    <el-button link type="primary" :icon="EditPen" @click="handleEditCourse(row)" />
                  </el-tooltip>
                  <el-tooltip content="删除" placement="top">
                    <el-button link type="danger" :icon="Delete" @click="handleDeleteCourse(row)" />
                  </el-tooltip>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty
                  :description="canEditCredit ? '暂无数据，请点击「新增课程」' : '暂无数据'"
                />
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
            </div>
          </el-tab-pane>

          <!-- 部门目标选课：按部门过滤 + 增删改 -->
          <el-tab-pane label="部门目标选课" name="deptSelections">
            <div v-loading="deptLoading || deptSaving">
              <div class="manage-toolbar">
                <div class="manage-toolbar__start">
                  <el-button
                    v-if="canEditCredit"
                    type="success"
                    :icon="Plus"
                    @click="openAddDeptDialog"
                  >
                    新增部门选课
                  </el-button>
                  <template v-if="canEditCredit && filterDeptCode">
                    <el-button
                      type="primary"
                      :icon="EditPen"
                      :disabled="!currentDeptSelection"
                      @click="openEditCoursesDialog"
                    >
                      编辑目标课程
                    </el-button>
                    <el-button
                      type="danger"
                      :icon="Delete"
                      :disabled="!currentDeptSelection"
                      @click="handleDeleteDeptConfig"
                    >
                      删除部门配置
                    </el-button>
                  </template>
                  <el-tag v-if="!canEditCredit" type="info" effect="plain">只读模式</el-tag>
                </div>
                <div class="manage-toolbar__right dept-filter-bar">
                  <el-select
                    :model-value="filterDeptCode"
                    clearable
                    filterable
                    placeholder="快捷选择已配置部门"
                    class="manage-toolbar__dept-select"
                    @change="handleQuickSelectDept"
                    @clear="handleQuickSelectDept('')"
                  >
                    <el-option
                      v-for="d in deptSelectionList"
                      :key="d.deptCode"
                      :label="`${d.deptName || d.deptCode}（${d.deptCode}）`"
                      :value="d.deptCode"
                    />
                  </el-select>
                  <el-tooltip
                    v-if="canEditCredit && filterDeptCode"
                    content="批量移除选中课程"
                    placement="top"
                  >
                    <span class="manage-toolbar__batch-wrap">
                      <el-button
                        type="danger"
                        :icon="Delete"
                        circle
                        :disabled="!selectedDeptCourseRows.length"
                        @click="handleRemoveDeptCourses(selectedDeptCourseRows)"
                      />
                    </span>
                  </el-tooltip>
                </div>
              </div>

              <el-alert
                v-if="!filterDeptCode"
                type="info"
                :closable="false"
                show-icon
                :title="
                  canEditCredit
                    ? '当前为全部部门选课总览（同训战课程规划表）；选择部门后可查看并编辑该部门目标课程'
                    : '当前为全部部门选课总览（同训战课程规划表）；选择部门后可查看该部门目标课程'
                "
                class="dept-filter-tip"
              />

              <!-- 未选部门：规划表总览 -->
              <el-table
                v-if="!filterDeptCode"
                class="planning-table"
                :data="planningOverviewRows"
                border
                style="width: 100%"
                max-height="620"
                empty-text="暂无数据"
                :span-method="planningOverviewSpanMethod"
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

              <!-- 已选部门：该部门目标课程明细（可增删改） -->
              <el-table
                v-else
                class="manage-table planning-like-table"
                :data="filteredDeptCourses"
                border
                style="width: 100%"
                max-height="560"
                :span-method="deptSpanMethod"
                @selection-change="(rows: TrainingCourseRecord[]) => (selectedDeptCourseRows = rows)"
              >
                <el-table-column
                  v-if="canEditCredit"
                  type="selection"
                  width="48"
                  header-align="center"
                  align="center"
                />
                <el-table-column prop="bigType" label="课程主分类" width="120" header-align="center" align="center" />
                <el-table-column prop="courseLevel" label="训战分类" width="100" header-align="center" align="center" />
                <el-table-column prop="sybType" label="课程子类" min-width="120" header-align="center" align="center" show-overflow-tooltip />
                <el-table-column prop="courseName" label="课程名称" min-width="200" header-align="center" align="center" show-overflow-tooltip />
                <el-table-column prop="credit" label="学分" width="80" header-align="center" align="center" />
                <el-table-column
                  v-if="canEditCredit"
                  label="操作"
                  width="80"
                  header-align="center"
                  align="center"
                >
                  <template #default="{ row }">
                    <el-tooltip content="移除" placement="top">
                      <el-button
                        link
                        type="danger"
                        :icon="Delete"
                        @click="handleRemoveDeptCourses([row])"
                      />
                    </el-tooltip>
                  </template>
                </el-table-column>
                <template #empty>
                  <el-empty
                    :description="
                      !currentDeptSelection
                        ? canEditCredit
                          ? '该部门尚无选课配置，请点击「新增部门选课」'
                          : '该部门尚无选课配置'
                        : canEditCredit
                          ? '该部门暂无目标课程，可点击「编辑目标课程」添加'
                          : '该部门暂无目标课程'
                    "
                  />
                </template>
              </el-table>
            </div>
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
        <el-form-item label="课程子类" prop="sybType">
          <el-input v-model="courseForm.sybType" placeholder="子类 / 实战任务类型" clearable />
        </el-form-item>
        <el-form-item label="课程编码" prop="courseNumber">
          <el-input v-model="courseForm.courseNumber" placeholder="线上课程编码" clearable />
        </el-form-item>
        <el-form-item label="课程链接" prop="courseLink">
          <el-input v-model="courseForm.courseLink" placeholder="iLearning 等课程链接" clearable />
        </el-form-item>
        <el-form-item label="学分" prop="credit">
          <el-input
            :model-value="courseForm.credit"
            placeholder="请输入整数或小数，如 1 或 1.5"
            clearable
            @update:model-value="onCreditInput"
          />
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
      </el-form>
      <template #footer>
        <el-button @click="courseDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="courseSaving" @click="handleSubmitCourse">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新增部门选课 -->
    <el-dialog v-model="addDeptDialogVisible" title="新增部门选课" width="640px" destroy-on-close>
      <el-form label-width="110px" v-loading="deptSaving || level4DeptLoading">
        <el-form-item label="四级部门" required>
          <el-select
            :model-value="addDeptCode"
            filterable
            clearable
            placeholder="请选择云核心网研发管理部下的四级部门"
            style="width: 100%"
            @change="handleAddDeptSelect"
            @clear="handleAddDeptSelect('')"
          >
            <el-option
              v-for="opt in level4DeptOptions"
              :key="opt.deptCode"
              :label="`${opt.deptName}（${opt.deptCode}）`"
              :value="opt.deptCode"
            />
          </el-select>
          <p class="form-hint">仅支持选择研发管理部下的四级部门；选择后自动带出部门编码。</p>
        </el-form-item>
        <el-form-item label="部门编码" required>
          <el-input v-model="addDeptCode" placeholder="选择部门后自动带出" disabled />
        </el-form-item>
        <el-form-item label="部门名称" required>
          <el-input v-model="addDeptName" placeholder="选择部门后自动带出" disabled />
        </el-form-item>
        <el-form-item label="目标课程">
          <el-select
            v-model="addDeptCourseIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择目标课程（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="opt in courseOptionsForSelect"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDeptDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="deptSaving" @click="submitAddDeptSelection">保存</el-button>
      </template>
    </el-dialog>

    <!-- 编辑部门目标课程 -->
    <el-dialog v-model="editCoursesDialogVisible" title="编辑目标课程" width="640px" destroy-on-close>
      <el-form label-width="110px" v-loading="deptSaving">
        <el-form-item label="当前部门">
          <span>{{ filterDeptName || filterDeptCode }}（{{ filterDeptCode }}）</span>
        </el-form-item>
        <el-form-item label="目标课程">
          <el-select
            v-model="editCourseIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择该部门目标课程"
            style="width: 100%"
          >
            <el-option
              v-for="opt in courseOptionsForSelect"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editCoursesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="deptSaving" @click="submitEditCourses">保存</el-button>
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

.manage-toolbar__dept-select {
  width: 280px;
  max-width: min(280px, 100%);
}

.dept-filter-bar {
  flex-wrap: wrap;
}

.dept-filter-tip {
  margin-bottom: $spacing-md;
}

.form-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: $text-secondary-color;
  line-height: 1.5;
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
