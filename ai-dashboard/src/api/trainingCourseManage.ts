import type { CoursePlanningInfo, Result } from '@/types/dashboard'
import type {
  DeptCourseSelectionApi,
  DeptCourseSelectionRecord,
  FetchTrainingCourseListParams,
  TrainingCourseRecord,
} from '@/types/trainingCourseManage'
import { get, post, request } from '@/utils/request'

export function mapCourseApiToRecord(c: CoursePlanningInfo): TrainingCourseRecord {
  return {
    id: c.id ?? 0,
    bigType: c.bigType ?? '',
    sybType: c.sybType ?? '',
    courseName: c.courseName ?? '',
    courseLink: c.courseLink ?? '',
    credit: c.credit ?? '',
    courseStatus: c.courseStatus ?? '',
    knowledgePoint: c.knowledgePoint ?? '',
    courseExplain: c.courseExplain ?? '',
    studyDuration: c.studyDuration ?? '',
    courseLevel: c.courseLevel ?? '',
    inClassTest: c.inClassTest ?? '',
    courseNumber: c.courseNumber ?? '',
    selectedDepts: c.selectedDepts ?? [],
  }
}

function recordToCoursePayload(m: TrainingCourseRecord) {
  return {
    bigType: m.bigType,
    sybType: m.sybType,
    courseName: m.courseName,
    courseLink: m.courseLink,
    credit: m.credit,
    courseStatus: m.courseStatus,
    knowledgePoint: m.knowledgePoint,
    courseExplain: m.courseExplain,
    studyDuration: m.studyDuration,
    courseLevel: m.courseLevel,
    inClassTest: m.inClassTest,
    courseNumber: m.courseNumber,
  }
}

function parseIdList(raw?: string | null): number[] {
  if (!raw || !String(raw).trim()) {
    return []
  }
  const ids: number[] = []
  const seen = new Set<number>()
  for (const part of String(raw).split(',')) {
    const n = Number(part.trim())
    if (!Number.isFinite(n) || seen.has(n)) {
      continue
    }
    seen.add(n)
    ids.push(n)
  }
  return ids
}

function joinIdList(ids: number[]): string | null {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id)))]
  return unique.length ? unique.join(',') : null
}

export function mapDeptSelectionApiToRecord(r: DeptCourseSelectionApi): DeptCourseSelectionRecord {
  return {
    deptCode: r.deptCode ?? '',
    deptName: r.deptName ?? '',
    courseIds: parseIdList(r.courseSelections),
    practicalCourseIds: parseIdList(r.practicalSelections),
    basicTargetCoursesNum: r.basicTargetCoursesNum ?? null,
    advancedTargetCoursesNum: r.advancedTargetCoursesNum ?? null,
    practicalTargetCoursesNum: r.practicalTargetCoursesNum ?? null,
  }
}

function deptRecordToApiPayload(m: DeptCourseSelectionRecord): DeptCourseSelectionApi {
  return {
    deptCode: m.deptCode,
    deptName: m.deptName,
    courseSelections: joinIdList(m.courseIds),
    practicalSelections: joinIdList(m.practicalCourseIds),
    basicTargetCoursesNum: m.basicTargetCoursesNum ?? null,
    advancedTargetCoursesNum: m.advancedTargetCoursesNum ?? null,
    practicalTargetCoursesNum: m.practicalTargetCoursesNum ?? null,
  }
}

function paginateAndFilterCourses(
  all: TrainingCourseRecord[],
  params: FetchTrainingCourseListParams,
): { total: number; rows: TrainingCourseRecord[] } {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const nameKw = params.courseName?.trim().toLowerCase() ?? ''
  const levelKw = params.courseLevel?.trim() ?? ''
  const bigTypeKw = params.bigType?.trim() ?? ''
  const prefer = params.preferBigType?.trim() ?? ''

  const COURSE_LEVEL_ORDER: Record<string, number> = {
    基础: 1,
    进阶: 2,
    实战: 3,
  }

  const filtered = all.filter((row) => {
    if (nameKw && !(row.courseName || '').toLowerCase().includes(nameKw)) {
      return false
    }
    if (levelKw && row.courseLevel !== levelKw) {
      return false
    }
    if (bigTypeKw && row.bigType !== bigTypeKw) {
      return false
    }
    return true
  })

  filtered.sort((a, b) => {
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

  const start = (pageNum - 1) * pageSize
  return {
    total: filtered.length,
    rows: filtered.slice(start, start + pageSize),
  }
}

/**
 * 课程管理：查询全部课程主数据（GET /course-planning-info/manage/list），前端筛选分页
 */
export async function fetchTrainingCourseList(
  params: FetchTrainingCourseListParams = {},
): Promise<{ total: number; rows: TrainingCourseRecord[] }> {
  const res = await get<Result<CoursePlanningInfo[]>>('/course-planning-info/manage/list')
  if (res.code !== 200) {
    throw new Error(res.message || '查询课程列表失败')
  }
  return paginateAndFilterCourses((res.data ?? []).map(mapCourseApiToRecord), params)
}

/** 全量课程主数据（部门选课穿梭框 / 过滤用） */
export async function fetchAllTrainingCourses(): Promise<TrainingCourseRecord[]> {
  const res = await get<Result<CoursePlanningInfo[]>>('/course-planning-info/manage/list')
  if (res.code !== 200) {
    throw new Error(res.message || '查询课程列表失败')
  }
  return (res.data ?? []).map(mapCourseApiToRecord)
}

export async function createTrainingCourse(record: TrainingCourseRecord): Promise<TrainingCourseRecord> {
  const res = await post<Result<CoursePlanningInfo>>('/course-planning-info', recordToCoursePayload(record))
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '新增课程失败')
  }
  return mapCourseApiToRecord(res.data)
}

export async function updateTrainingCourse(id: number, record: TrainingCourseRecord): Promise<TrainingCourseRecord> {
  const res = await request.request<Result<CoursePlanningInfo>>(`/course-planning-info/${id}`, {
    method: 'PUT',
    body: JSON.stringify(recordToCoursePayload(record)),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '更新课程失败')
  }
  return mapCourseApiToRecord(res.data)
}

export async function deleteTrainingCourse(id: number): Promise<void> {
  const res = await request.request<Result<boolean>>(`/course-planning-info/${id}`, {
    method: 'DELETE',
  })
  if (res.code !== 200) {
    throw new Error(res.message || '删除课程失败')
  }
}

/** ---------- 部门目标选课 ---------- */

export async function fetchDeptCourseSelectionList(): Promise<DeptCourseSelectionRecord[]> {
  const res = await get<Result<DeptCourseSelectionApi[]>>('/dept-course-selections/list')
  if (res.code !== 200) {
    throw new Error(res.message || '查询部门选课失败')
  }
  return (res.data ?? []).map(mapDeptSelectionApiToRecord)
}

export async function fetchDeptCourseSelection(deptCode: string): Promise<DeptCourseSelectionRecord | null> {
  const res = await get<Result<DeptCourseSelectionApi>>(
    `/dept-course-selections/${encodeURIComponent(deptCode)}`,
  )
  if (res.code === 404) {
    return null
  }
  if (res.code !== 200) {
    throw new Error(res.message || '查询部门选课失败')
  }
  return res.data ? mapDeptSelectionApiToRecord(res.data) : null
}

export async function createDeptCourseSelection(
  record: DeptCourseSelectionRecord,
): Promise<DeptCourseSelectionRecord> {
  const res = await post<Result<DeptCourseSelectionApi>>(
    '/dept-course-selections',
    deptRecordToApiPayload(record),
  )
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '新增部门选课失败')
  }
  return mapDeptSelectionApiToRecord(res.data)
}

export async function updateDeptCourseSelection(
  deptCode: string,
  record: DeptCourseSelectionRecord,
): Promise<DeptCourseSelectionRecord> {
  const res = await request.request<Result<DeptCourseSelectionApi>>(
    `/dept-course-selections/${encodeURIComponent(deptCode)}`,
    {
      method: 'PUT',
      body: JSON.stringify(deptRecordToApiPayload({ ...record, deptCode })),
    },
  )
  if (res.code !== 200 || !res.data) {
    throw new Error(res.message || '更新部门选课失败')
  }
  return mapDeptSelectionApiToRecord(res.data)
}

export async function deleteDeptCourseSelection(deptCode: string): Promise<void> {
  const res = await request.request<Result<boolean>>(
    `/dept-course-selections/${encodeURIComponent(deptCode)}`,
    { method: 'DELETE' },
  )
  if (res.code !== 200) {
    throw new Error(res.message || '删除部门选课失败')
  }
}

/** 按课程级别拆分后保存（基础/进阶 → courseIds，实战 → practicalCourseIds） */
export function splitCourseIdsByLevel(
  courses: TrainingCourseRecord[],
  selectedIds: number[],
): { courseIds: number[]; practicalCourseIds: number[] } {
  const idSet = new Set(selectedIds)
  const courseIds: number[] = []
  const practicalCourseIds: number[] = []
  for (const c of courses) {
    if (!idSet.has(c.id)) {
      continue
    }
    if (c.courseLevel === '实战') {
      practicalCourseIds.push(c.id)
    } else {
      courseIds.push(c.id)
    }
  }
  return { courseIds, practicalCourseIds }
}

export function calcTargetNums(
  courses: TrainingCourseRecord[],
  courseIds: number[],
  practicalCourseIds: number[],
) {
  const idSet = new Set(courseIds)
  let basic = 0
  let advanced = 0
  for (const c of courses) {
    if (!idSet.has(c.id)) {
      continue
    }
    if (c.courseLevel === '基础') {
      basic++
    } else if (c.courseLevel === '进阶') {
      advanced++
    }
  }
  return {
    basicTargetCoursesNum: basic,
    advancedTargetCoursesNum: advanced,
    practicalTargetCoursesNum: practicalCourseIds.length,
  }
}
