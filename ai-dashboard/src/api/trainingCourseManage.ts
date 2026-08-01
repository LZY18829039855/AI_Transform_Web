import type { CoursePlanningInfo, Result } from '@/types/dashboard'
import type {
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

function paginateAndFilterCourses(
  all: TrainingCourseRecord[],
  params: FetchTrainingCourseListParams,
): { total: number; rows: TrainingCourseRecord[] } {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const nameKw = params.courseName?.trim().toLowerCase() ?? ''
  const levelKw = params.courseLevel?.trim() ?? ''
  const bigTypeKw = params.bigType?.trim() ?? ''

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

/**
 * 部门目标选课 / 规划表：复用 GET /course-planning-info/list（含 selectedDepts）
 */
export async function fetchCoursePlanningWithDeptSelections(): Promise<TrainingCourseRecord[]> {
  const res = await get<Result<CoursePlanningInfo[]>>('/course-planning-info/list')
  if (res.code !== 200) {
    throw new Error(res.message || '查询课程规划失败')
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
