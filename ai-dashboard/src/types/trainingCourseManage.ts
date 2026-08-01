/**
 * AI 训战课程管理相关类型
 * 课程主数据对齐 ai_course_planning_info / CoursePlanningInfoVO
 * 部门目标选课对齐 dept_course_selections / DeptCourseSelection
 */

import type { DepartmentSelection } from './dashboard'

/** 课程级别（与后端 course_level 口径一致） */
export type CourseLevel = '基础' | '进阶' | '实战' | string

/** 训战课程记录（管理页表格 / 表单） */
export interface TrainingCourseRecord {
  id: number
  bigType: string
  sybType: string
  courseName: string
  courseLink: string
  credit: string
  courseStatus: string
  knowledgePoint: string
  courseExplain: string
  studyDuration: string
  courseLevel: CourseLevel
  inClassTest: string
  courseNumber: string
  selectedDepts: DepartmentSelection[]
}

/** 部门目标选课配置 */
export interface DeptCourseSelectionRecord {
  deptCode: string
  deptName: string
  /** 基础+进阶课程 ID 列表（对应 course_selections） */
  courseIds: number[]
  /** 实战课程 ID 列表（对应 practical_selections） */
  practicalCourseIds: number[]
  basicTargetCoursesNum?: number | null
  advancedTargetCoursesNum?: number | null
  practicalTargetCoursesNum?: number | null
}

/** 后端部门选课 API 形态（字段与 DeptCourseSelection 对齐） */
export interface DeptCourseSelectionApi {
  deptCode?: string
  deptName?: string
  courseSelections?: string | null
  practicalSelections?: string | null
  basicTargetCoursesNum?: number | null
  advancedTargetCoursesNum?: number | null
  practicalTargetCoursesNum?: number | null
}

export interface FetchTrainingCourseListParams {
  pageNum?: number
  pageSize?: number
  courseName?: string
  courseLevel?: string
  bigType?: string
}
