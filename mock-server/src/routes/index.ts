import { Router } from 'express'
import departmentRouter from './department'
import expertCertStatisticsRouter from './expertCertStatistics'
import { successResponse } from '../utils/response'

const router = Router()

router.get('/health', (_, res) => {
  return res.json(successResponse({ status: 'ok' }, 'mock server works'))
})

router.use('/ai_transform_webapi/department-info', departmentRouter)
router.use('/ai_transform_webapi/expert-cert-statistics', expertCertStatisticsRouter)

export default router
