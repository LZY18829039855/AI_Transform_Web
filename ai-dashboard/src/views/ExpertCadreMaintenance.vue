<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Delete, EditPen, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  createExpertCadreRecord,
  deleteExpertCadreRecord,
  fetchExpertCadreList,
  updateExpertCadreRecord,
} from '@/api/expertCadreMaintenance'
import type {
  CadreRecord,
  ExpertCadrePersonType,
  ExpertCadreRecord,
  ExpertRecord,
} from '@/types/expertCadreMaintenance'
import {
  fetchCreditWritePermission,
  guardCreditWriteAccess,
} from '@/utils/permissions'

type DisplayRecord = ExpertCadreRecord & Partial<ExpertRecord & CadreRecord>

interface MaintenanceForm extends ExpertRecord, CadreRecord {}

const activeTab = ref<ExpertCadrePersonType>('expert')
const loading = ref(false)
const tableData = ref<DisplayRecord[]>([])
const keyword = ref('')
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const pageSizeOptions = [10, 20, 50, 100, 200]
const canEditCredit = ref(false)

const dialogVisible = ref(false)
const editing = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()
const formModel = ref<MaintenanceForm>(emptyForm())

const typeLabel = computed(() => (activeTab.value === 'expert' ? '专家' : '干部'))
const dialogTitle = computed(() => `${editing.value ? '编辑' : '新增'}${typeLabel.value}数据`)

const rules: FormRules<MaintenanceForm> = {
  account: [{ required: true, message: '请输入工号', trigger: 'blur' }],
}

function emptyForm(): MaintenanceForm {
  return {
    account: '',
    employeeName: '',
    positionAiMaturity: '',
    isQualificationsStandard: false,
    isCertStandard: false,
    origPositionGrade: null,
    jobCategory: '',
    miniDepartnameId: '',
    cadreCompetenceCategory: '',
    cadreType: '',
    newOnJob: 'N',
    departname1: '',
    departname2: '',
    departname3: '',
    departname4: '',
    departname5: '',
    l2DepartmentCode: '',
    l3DepartmentCode: '',
    l4DepartmentCode: '',
    l5DepartmentCode: '',
  }
}

function normalizeRecord(row: ExpertCadreRecord): DisplayRecord {
  return {
    ...row,
    employeeName: row.employeeName ?? '',
    positionAiMaturity: row.positionAiMaturity ?? '',
    isQualificationsStandard: Boolean(row.isQualificationsStandard),
    isCertStandard: Boolean(row.isCertStandard),
    ...('newOnJob' in row ? { newOnJob: row.newOnJob === 'Y' ? 'Y' : 'N' } : {}),
  }
}

async function loadList() {
  loading.value = true
  try {
    const page = await fetchExpertCadreList(activeTab.value, {
      keyword: keyword.value,
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    tableData.value = page.rows.map(normalizeRecord)
    total.value = page.total
  } catch (error) {
    console.error(error)
    ElMessage.error(error instanceof Error ? error.message : '加载列表失败')
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  pageNum.value = 1
  keyword.value = ''
  loadList()
}

function handleSearch() {
  pageNum.value = 1
  loadList()
}

function handlePageSizeChange() {
  pageNum.value = 1
  loadList()
}

async function handleAdd() {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  editing.value = false
  formModel.value = emptyForm()
  dialogVisible.value = true
  await nextTick()
  formRef.value?.clearValidate()
}

async function handleEdit(row: DisplayRecord) {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  editing.value = true
  formModel.value = { ...emptyForm(), ...row }
  dialogVisible.value = true
  await nextTick()
  formRef.value?.clearValidate()
}

function toPayload(): ExpertCadreRecord {
  const common = {
    account: formModel.value.account.trim(),
    employeeName: formModel.value.employeeName,
    positionAiMaturity: formModel.value.positionAiMaturity,
    isQualificationsStandard: formModel.value.isQualificationsStandard,
    isCertStandard: formModel.value.isCertStandard,
  }
  if (activeTab.value === 'expert') {
    return {
      ...common,
      origPositionGrade: formModel.value.origPositionGrade,
      jobCategory: formModel.value.jobCategory,
    }
  }
  return {
    ...common,
    miniDepartnameId: formModel.value.miniDepartnameId,
    cadreCompetenceCategory: formModel.value.cadreCompetenceCategory,
    cadreType: formModel.value.cadreType,
    newOnJob: formModel.value.newOnJob,
    departname1: formModel.value.departname1,
    departname2: formModel.value.departname2,
    departname3: formModel.value.departname3,
    departname4: formModel.value.departname4,
    departname5: formModel.value.departname5,
    l2DepartmentCode: formModel.value.l2DepartmentCode,
    l3DepartmentCode: formModel.value.l3DepartmentCode,
    l4DepartmentCode: formModel.value.l4DepartmentCode,
    l5DepartmentCode: formModel.value.l5DepartmentCode,
  }
}

async function handleSubmit() {
  if (!(await guardCreditWriteAccess())) {
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
    const payload = toPayload()
    if (editing.value) {
      await updateExpertCadreRecord(activeTab.value, payload.account, payload)
      ElMessage.success('保存成功')
    } else {
      await createExpertCadreRecord(activeTab.value, payload)
      ElMessage.success('新增成功')
      pageNum.value = 1
    }
    dialogVisible.value = false
    await loadList()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: DisplayRecord) {
  if (!(await guardCreditWriteAccess())) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除${typeLabel.value}「${row.employeeName || row.account}」吗？`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
    await deleteExpertCadreRecord(activeTab.value, row.account)
    ElMessage.success('已删除')
    if (tableData.value.length === 1 && pageNum.value > 1) {
      pageNum.value--
    }
    await loadList()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }
}

onMounted(() => {
  loadList()
  fetchCreditWritePermission().then((allowed) => {
    canEditCredit.value = allowed
  })
})
</script>

<template>
  <div class="maintenance-page" v-loading="loading">
    <section class="maintenance-dashboard">
      <header class="dashboard__header glass-card">
        <div class="header-info">
          <h2>专家干部数据维护</h2>
          <p>统一查询和维护专家、干部的 AI 成熟度及任职达标信息。</p>
        </div>
      </header>

      <el-card class="maintenance-card" shadow="never">
        <el-tabs v-model="activeTab" class="maintenance-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="专家数据" name="expert" />
          <el-tab-pane label="干部数据" name="cadre" />
        </el-tabs>

        <div class="maintenance-toolbar">
          <div class="toolbar-start">
            <el-button v-if="canEditCredit" type="success" :icon="Plus" @click="handleAdd">
              新增{{ typeLabel }}
            </el-button>
            <el-tag v-else type="info" effect="plain">只读模式</el-tag>
          </div>
          <el-input
            v-model="keyword"
            class="keyword-input"
            clearable
            placeholder="查询工号或姓名"
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          >
            <template #suffix>
              <el-icon class="search-icon" title="查询" @click.stop="handleSearch">
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>

        <el-table :data="tableData" border stripe max-height="560" class="maintenance-table">
          <el-table-column prop="account" label="工号" min-width="110" fixed="left" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" min-width="100" fixed="left" show-overflow-tooltip />
          <el-table-column prop="positionAiMaturity" label="岗位AI成熟度" min-width="130" align="center" />
          <el-table-column label="任职资格达标" min-width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isQualificationsStandard ? 'success' : 'info'" effect="plain">
                {{ row.isQualificationsStandard ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="认证达标" min-width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isCertStandard ? 'success' : 'info'" effect="plain">
                {{ row.isCertStandard ? '是' : '否' }}
              </el-tag>
            </template>
          </el-table-column>

          <template v-if="activeTab === 'expert'">
            <el-table-column prop="origPositionGrade" label="原职位职级" min-width="120" show-overflow-tooltip />
            <el-table-column prop="jobCategory" label="职位类别" min-width="120" show-overflow-tooltip />
          </template>
          <template v-else>
            <el-table-column prop="miniDepartnameId" label="最小部门ID" min-width="120" show-overflow-tooltip />
            <el-table-column prop="cadreCompetenceCategory" label="干部能力类别" min-width="140" show-overflow-tooltip />
            <el-table-column prop="cadreType" label="干部类型" min-width="110" show-overflow-tooltip />
            <el-table-column label="26年新上岗" min-width="115" align="center">
              <template #default="{ row }">
                <el-tag :type="row.newOnJob === 'Y' ? 'success' : 'info'" effect="plain">
                  {{ row.newOnJob === 'Y' ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="departname1" label="一级部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="departname2" label="二级部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="departname3" label="三级部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="departname4" label="四级部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="departname5" label="五级部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="l2DepartmentCode" label="二级部门编码" min-width="140" show-overflow-tooltip />
            <el-table-column prop="l3DepartmentCode" label="三级部门编码" min-width="140" show-overflow-tooltip />
            <el-table-column prop="l4DepartmentCode" label="四级部门编码" min-width="140" show-overflow-tooltip />
            <el-table-column prop="l5DepartmentCode" label="五级部门编码" min-width="140" show-overflow-tooltip />
          </template>

          <el-table-column v-if="canEditCredit" label="操作" width="150" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" :icon="EditPen" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="`暂无${typeLabel}数据`" />
          </template>
        </el-table>

        <div class="maintenance-pagination">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="pageSizeOptions"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handlePageSizeChange"
            @current-change="loadList"
          />
        </div>
      </el-card>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(760px, 92vw)" destroy-on-close>
      <el-form
        ref="formRef"
        :model="formModel"
        :rules="rules"
        label-width="125px"
        v-loading="saving"
        class="maintenance-form"
      >
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="工号" prop="account">
              <el-input v-model="formModel.account" :disabled="editing" placeholder="员工工号" clearable />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="姓名">
              <el-input v-model="formModel.employeeName" disabled placeholder="由服务端获取" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="岗位AI成熟度">
              <el-select v-model="formModel.positionAiMaturity" placeholder="请选择" clearable>
                <el-option label="L1" value="L1" />
                <el-option label="L2" value="L2" />
                <el-option label="L3" value="L3" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="任职资格达标">
              <el-switch
                v-model="formModel.isQualificationsStandard"
                inline-prompt
                active-text="是"
                inactive-text="否"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="认证达标">
              <el-switch v-model="formModel.isCertStandard" inline-prompt active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>

          <template v-if="activeTab === 'expert'">
            <el-col :xs="24" :sm="12">
              <el-form-item label="原职位职级">
                <el-input-number
                  v-model="formModel.origPositionGrade"
                  :min="0"
                  :precision="0"
                  controls-position="right"
                  placeholder="请输入数字职级"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="职位类别">
                <el-input v-model="formModel.jobCategory" disabled placeholder="由服务端维护" />
              </el-form-item>
            </el-col>
          </template>

          <template v-else>
            <el-col :xs="24" :sm="12">
              <el-form-item label="最小部门ID">
                <el-input v-model="formModel.miniDepartnameId" clearable />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="干部能力类别">
                <el-input v-model="formModel.cadreCompetenceCategory" clearable />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="干部类型">
                <el-input v-model="formModel.cadreType" clearable />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="26年新上岗">
                <el-select v-model="formModel.newOnJob">
                  <el-option label="是" value="Y" />
                  <el-option label="否" value="N" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col v-for="level in 5" :key="`department-${level}`" :xs="24" :sm="12">
              <el-form-item :label="`${['一', '二', '三', '四', '五'][level - 1]}级部门`">
                <el-input v-model="formModel[`departname${level}` as keyof MaintenanceForm]" clearable />
              </el-form-item>
            </el-col>
            <el-col v-for="level in [2, 3, 4, 5]" :key="`code-${level}`" :xs="24" :sm="12">
              <el-form-item :label="`${['二', '三', '四', '五'][level - 2]}级部门编码`">
                <el-input v-model="formModel[`l${level}DepartmentCode` as keyof MaintenanceForm]" clearable />
              </el-form-item>
            </el-col>
          </template>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.maintenance-page {
  width: 100%;
  padding-bottom: $spacing-xl;
}

.maintenance-dashboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.dashboard__header.glass-card {
  padding: $spacing-lg;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, rgba(58, 122, 254, 0.18), rgba(14, 170, 194, 0.16));
  box-shadow: 0 18px 45px rgba(58, 122, 254, 0.12);
  color: #000;

  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: 700;
  }

  p {
    margin: $spacing-sm 0 0;
    line-height: 1.6;
  }
}

.maintenance-card {
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.maintenance-tabs {
  margin-top: -8px;
}

.maintenance-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-md;
  flex-wrap: wrap;
}

.toolbar-start {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.keyword-input {
  width: 240px;
  max-width: 100%;
}

.search-icon {
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 18px;
}

.maintenance-table {
  width: 100%;

  :deep(.el-table__header-wrapper th) {
    color: #000;
    font-weight: 700;
  }
}

.maintenance-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: $spacing-md;
  overflow-x: auto;
}

.maintenance-form {
  :deep(.el-select),
  :deep(.el-input-number) {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .maintenance-toolbar,
  .keyword-input {
    width: 100%;
  }

  .dashboard__header.glass-card h2 {
    font-size: 22px;
  }

  .maintenance-pagination {
    justify-content: flex-start;
  }
}
</style>
