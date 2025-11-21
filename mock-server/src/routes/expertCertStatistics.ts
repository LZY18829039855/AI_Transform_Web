import { Router } from 'express'
import { getEmployeeCertStatistics } from '../data/employeeCertStatistics'
import { getCompetenceCategoryCertStatistics } from '../data/competenceCategoryCertStatistics'
import { getCadreMaturityJobCategoryCertStatistics } from '../data/cadreMaturityJobCategoryCertStatistics'
import { getCadreMaturityJobCategoryQualifiedStatistics } from '../data/cadreMaturityJobCategoryQualifiedStatistics'
import { successResponse } from '../utils/response'

const router = Router()

router.get('/employee-cert-statistics', (req, res) => {
  const deptCode = typeof req.query.deptCode === 'string' ? req.query.deptCode : '0'
  const personType = typeof req.query.personType === 'string' ? req.query.personType : '0'
  const data = getEmployeeCertStatistics(deptCode, personType)
  return res.json(successResponse(data, 'mock employee cert statistics'))
})

router.get('/competence-category-cert-statistics', (req, res) => {
  const deptCode = typeof req.query.deptCode === 'string' ? req.query.deptCode : '0'
  const personType = typeof req.query.personType === 'string' ? req.query.personType : '0'
  const data = getCompetenceCategoryCertStatistics(deptCode, personType)
  return res.json(successResponse(data, 'mock competence category cert statistics'))
})

router.get('/cadre-cert-statistics/by-maturity-and-job-category', (req, res) => {
  const deptCode = typeof req.query.deptCode === 'string' ? req.query.deptCode : '0'
  const data = getCadreMaturityJobCategoryCertStatistics(deptCode)
  return res.json(successResponse(data, 'mock cadre maturity job category cert statistics'))
})

router.get('/cadre-cert-statistics/by-maturity-and-job-category-qualified', (req, res) => {
  // 支持 deptCode 和 deptId 参数（Java接口使用deptId，前端使用deptCode）
  const deptCode = typeof req.query.deptCode === 'string' 
    ? req.query.deptCode 
    : typeof req.query.deptId === 'string' 
    ? req.query.deptId 
    : '0'
  const data = getCadreMaturityJobCategoryQualifiedStatistics(deptCode)
  return res.json(successResponse(data, 'mock cadre maturity job category qualified statistics'))
})

export default router

