import type { PlTmCertStatisticsResponse, PlTmDepartmentStatistics } from '../types'

/**
 * 获取PL/TM任职与认证统计数据
 * @returns PL/TM任职与认证统计数据
 */
export function getPlTmCertStatistics(): PlTmCertStatisticsResponse {
  // 研发管理部汇总数据
  const summary: PlTmDepartmentStatistics = {
    deptCode: '030681',
    deptName: '云核心网研发管理部',
    totalCount: 150,
    qualifiedCount: 120,
    qualifiedRatio: 0.8,
    certCount: 100,
    certRatio: 0.6667,
  }

  // 各四级部门统计数据
  const departmentList: PlTmDepartmentStatistics[] = [
    {
      deptCode: '030681001',
      deptName: '部门A',
      totalCount: 50,
      qualifiedCount: 40,
      qualifiedRatio: 0.8,
      certCount: 35,
      certRatio: 0.7,
    },
    {
      deptCode: '030681002',
      deptName: '部门B',
      totalCount: 60,
      qualifiedCount: 50,
      qualifiedRatio: 0.8333,
      certCount: 40,
      certRatio: 0.6667,
    },
    {
      deptCode: '030681003',
      deptName: '部门C',
      totalCount: 40,
      qualifiedCount: 30,
      qualifiedRatio: 0.75,
      certCount: 25,
      certRatio: 0.625,
    },
  ]

  return {
    summary,
    departmentList,
  }
}

