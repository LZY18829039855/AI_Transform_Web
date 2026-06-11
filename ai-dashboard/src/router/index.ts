import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { NO_ACCESS_MESSAGE } from '@/constants/permissions'
import { canAccessRoute, fetchUserPermissions } from '../utils/permissions'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    meta: {
      title: '首页',
      requiresAuth: false,
      keepAlive: false,
    },
  },
  {
    path: '/credit-management',
    name: 'ManualCreditManagement',
    component: () => import('@/views/ManualCreditManagement.vue'),
    meta: {
      title: '多元化学分管理',
      requiresAuth: true,
      requiresAdmin: true,
      keepAlive: false,
    },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    redirect: '/dashboard/maturity',
    meta: {
      title: '看板',
      requiresAuth: true,
    },
    children: [
      {
        path: 'maturity',
        name: 'MaturityDashboard',
        component: () => import('@/views/dashboard/MaturityDashboard.vue'),
        meta: {
          title: '组织/岗位AI成熟度看板',
          requiresAuth: true,
          requiresAdmin: true,
          keepAlive: true,
        },
      },
      {
        path: 'training',
        name: 'TrainingDashboard',
        component: () => import('@/views/dashboard/TrainingDashboard.vue'),
        meta: {
          title: 'AI训战看板',
          requiresAuth: true,
          keepAlive: true,
        },
      },
      {
        path: 'training/detail/:id',
        name: 'TrainingDetail',
        component: () => import('@/views/dashboard/TrainingDetail.vue'),
        meta: {
          title: 'AI训战看板详情',
          requiresAuth: true,
          requiresAdmin: true,
          keepAlive: false,
        },
        props: true,
      },
      {
        path: 'training/personal-detail',
        name: 'PersonalTrainingDetail',
        component: () => import('@/views/dashboard/PersonalTrainingDetail.vue'),
        meta: {
          title: '个人训战课程详情',
          requiresAuth: true,
          keepAlive: false,
        },
      },
      {
        path: 'training/planning',
        name: 'TrainingPlanningDetail',
        component: () => import('@/views/dashboard/TrainingPlanningDetail.vue'),
        meta: {
          title: '训战课程规划明细',
          requiresAuth: true,
          keepAlive: false,
        },
      },
      {
        path: 'school',
        name: 'SchoolDashboard',
        component: () => import('@/views/dashboard/SchoolDashboard.vue'),
        meta: {
          title: 'AI School看板',
          requiresAuth: true,
          keepAlive: true,
        },
      },
      {
        path: 'school/detail/:id',
        name: 'SchoolDetail',
        component: () => import('@/views/dashboard/SchoolDetail.vue'),
        meta: {
          title: 'AI School看板详情',
          requiresAuth: true,
          requiresAdmin: true,
          keepAlive: false,
        },
        props: true,
      },
      {
        path: 'school/personal-detail',
        name: 'SchoolPersonalTrainingDetail',
        component: () => import('@/views/dashboard/SchoolPersonalDetail.vue'),
        meta: {
          title: '个人课程学分详情',
          requiresAuth: true,
          keepAlive: false,
        },
      },
      {
        path: 'certification',
        name: 'CertificationDashboard',
        component: () => import('@/views/dashboard/CertificationDashboard.vue'),
        meta: {
          title: 'AI任职认证看板',
          requiresAuth: true,
          requiresAdmin: true,
          keepAlive: true,
        },
      },
      {
        path: 'certification/detail/:id',
        name: 'CertificationDetail',
        component: () => import('@/views/dashboard/CertificationDetail.vue'),
        props: true,
        meta: {
          title: 'AI任职认证看板详情',
          requiresAuth: true,
          requiresAdmin: true,
          keepAlive: false,
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to, from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} - AI转型IT看板`
  } else {
    document.title = 'AI转型IT看板'
  }
  if (to.name === 'Home') {
    next()
    return
  }

  try {
    const permissions = await fetchUserPermissions({ force: from.name === 'Home' })
    if (!permissions.member) {
      if (from.name !== 'Home') {
        next({ name: 'Home' })
      } else {
        next(false)
      }
      return
    }

    if (!canAccessRoute(to.name, permissions)) {
      ElMessage.warning(NO_ACCESS_MESSAGE)
      if (from.name && from.name !== 'Home') {
        next(false)
      } else {
        next({ name: 'Home' })
      }
      return
    }

    next()
  } catch {
    next(false)
  }
})

export default router
