<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Delete, DocumentAdd, EditPen, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  createUserConfig,
  deleteUserConfig,
  fetchUserConfigList,
  updateUserConfig,
} from '@/api/userConfig'
import type { PermissionRole, UserConfigRecord } from '@/types/permission'
import {
  fetchCreditWritePermission,
  guardPermissionWriteAccess,
} from '@/utils/permissions'

const loading = ref(false)
const tableData = ref<UserConfigRecord[]>([])
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const pageSizeOptions = [10, 20, 50, 100, 200] as const
const canEditCredit = ref(false)
const filterKeyword = ref('')

const dialogVisible = ref(false)
const dialogTitle = ref('新增权限')
const formRef = ref<FormInstance>()
const formModel = ref({
  account: '',
  role: 'member' as PermissionRole,
})
const editingId = ref(0)
const saving = ref(false)
const accountLocked = ref(false)

function emptyRecord(): UserConfigRecord {
  return {
    id: 0,
    account: '',
    employeeName: '',
    asAdmin: false,
    canEditCredit: false,
  }
}

function roleOf(row: Pick<UserConfigRecord, 'asAdmin' | 'canEditCredit'>): PermissionRole {
  if (row.canEditCredit) {
    return 'super'
  }
  if (row.asAdmin) {
    return 'admin'
  }
  return 'member'
}

function roleLabel(role: PermissionRole): string {
  if (role === 'super') {
    return '超级用户'
  }
  if (role === 'admin') {
    return '管理员'
  }
  return '普通用户'
}

function roleTagType(role: PermissionRole): 'danger' | 'success' | 'info' {
  if (role === 'super') {
    return 'danger'
  }
  if (role === 'admin') {
    return 'success'
  }
  return 'info'
}

function toRecordFromForm(): UserConfigRecord {
  return {
    ...emptyRecord(),
    id: editingId.value,
    account: formModel.value.account.trim(),
    asAdmin: formModel.value.role !== 'member',
    canEditCredit: formModel.value.role === 'super',
  }
}

async function loadList() {
  loading.value = true
  try {
    const page = await fetchUserConfigList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      ...(filterKeyword.value.trim() ? { account: filterKeyword.value.trim() } : {}),
    })
    tableData.value = page.rows
    total.value = page.total
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载列表失败')
  } finally {
    loading.value = false
  }
}

function handlePageSizeChange() {
  pageNum.value = 1
  loadList()
}

function handleFilterSearch() {
  pageNum.value = 1
  loadList()
}

function handleFilterClear() {
  pageNum.value = 1
  loadList()
}

onMounted(() => {
  loadList()
  fetchCreditWritePermission().then((allowed) => {
    canEditCredit.value = allowed
  })
})

const rules: FormRules = {
  account: [{ required: true, message: '请输入工号', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

async function handleAdd() {
  if (!(await guardPermissionWriteAccess())) {
    return
  }
  dialogTitle.value = '新增权限'
  editingId.value = 0
  formModel.value = { account: '', role: 'member' }
  accountLocked.value = false
  dialogVisible.value = true
}

async function handleEdit(row: UserConfigRecord) {
  if (!(await guardPermissionWriteAccess())) {
    return
  }
  dialogTitle.value = '编辑权限'
  editingId.value = row.id
  formModel.value = { account: row.account, role: roleOf(row) }
  accountLocked.value = true
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!(await guardPermissionWriteAccess())) {
    dialogVisible.value = false
    return
  }
  if (!formRef.value) {
    return
  }
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = toRecordFromForm()
    if (!payload.id) {
      await createUserConfig(payload)
      ElMessage.success('新增成功')
      dialogVisible.value = false
      pageNum.value = 1
      await loadList()
    } else {
      await updateUserConfig(payload.id, payload)
      ElMessage.success('保存成功')
      dialogVisible.value = false
      await loadList()
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: UserConfigRecord) {
  if (!(await guardPermissionWriteAccess())) {
    return
  }
  ElMessageBox.confirm(
    `确定删除「${row.employeeName || row.account}」的权限配置吗？删除后该用户将无法访问看板。`,
    '删除确认',
    {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    },
  )
    .then(async () => {
      await deleteUserConfig(row.id)
      ElMessage.success('已删除')
      await loadList()
    })
    .catch(() => {})
}
</script>

<template>
  <div class="permission-page" v-loading="loading">
    <section class="permission-dashboard">
      <header class="dashboard__header glass-card">
        <div class="header-info">
          <h2>权限管理</h2>
          <p>
            在此维护看板白名单与角色：普通用户仅可访问授权看板，管理员可查看本页及管理类页面，超级用户可新增、编辑、删除权限配置（逻辑与多元化学分管理一致）。
          </p>
        </div>
      </header>

      <el-card class="permission-card" shadow="never">
        <div class="permission-toolbar">
          <div class="permission-toolbar__start">
            <el-button v-if="canEditCredit" type="success" :icon="DocumentAdd" @click="handleAdd">
              新增权限
            </el-button>
            <el-tag v-if="!canEditCredit" type="info" effect="plain">只读模式</el-tag>
          </div>
          <div class="permission-toolbar__right">
            <el-input
              v-model="filterKeyword"
              class="permission-toolbar__filter"
              clearable
              placeholder="筛选工号"
              @clear="handleFilterClear"
              @keyup.enter="handleFilterSearch"
            >
              <template #suffix>
                <el-icon
                  class="permission-toolbar__filter-search-icon"
                  title="查询"
                  @click.stop="handleFilterSearch"
                >
                  <Search />
                </el-icon>
              </template>
            </el-input>
          </div>
        </div>

        <el-table
          class="permission-table"
          :data="tableData"
          border
          stripe
          style="width: 100%"
          max-height="560"
        >
          <el-table-column
            label="工号"
            min-width="120"
            header-align="center"
            align="center"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="permission-table__text-cell">{{ row.account }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="employeeName"
            label="姓名"
            min-width="100"
            header-align="center"
            align="center"
            show-overflow-tooltip
          />
          <el-table-column
            label="角色"
            min-width="120"
            header-align="center"
            align="center"
          >
            <template #default="{ row }">
              <el-tag :type="roleTagType(roleOf(row))" effect="plain">
                {{ roleLabel(roleOf(row)) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canEditCredit"
            label="操作"
            min-width="160"
            header-align="center"
            align="center"
          >
            <template #default="{ row }">
              <el-button link type="primary" :icon="EditPen" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty
              :description="canEditCredit ? '暂无数据，请点击「新增权限」' : '暂无数据'"
            />
          </template>
        </el-table>

        <div class="permission-pagination">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[...pageSizeOptions]"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handlePageSizeChange"
            @current-change="loadList"
          />
        </div>
      </el-card>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="formModel" :rules="rules" label-width="90px" v-loading="saving">
        <el-form-item label="工号" prop="account">
          <el-input
            v-model="formModel.account"
            placeholder="员工工号"
            clearable
            :disabled="accountLocked"
          />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="formModel.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="普通用户" value="member" />
            <el-option label="管理员" value="admin" />
            <el-option label="超级用户" value="super" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.permission-page {
  width: 100%;
  padding-bottom: $spacing-xl;
}

.permission-dashboard {
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

.permission-card {
  border-radius: $radius-md;
  border: 1px solid $border-color;
}

.permission-toolbar {
  margin-bottom: $spacing-md;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.permission-toolbar__start {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-md;
  flex: 1;
  min-width: 0;
}

.permission-toolbar__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.permission-toolbar__filter {
  width: 220px;
  max-width: min(220px, 100%);
}

.permission-toolbar__filter-search-icon {
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 18px;
  vertical-align: middle;
  outline: none;

  &:hover {
    color: var(--el-color-primary-light-3);
  }

  &:active {
    color: var(--el-color-primary-dark-2);
  }
}

.permission-table {
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

.permission-table__text-cell {
  font-family: inherit;
  font-variant-numeric: normal;
  letter-spacing: normal;
}

.permission-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-md;
  width: 100%;
}
</style>
