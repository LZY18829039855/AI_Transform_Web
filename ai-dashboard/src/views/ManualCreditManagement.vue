<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Delete, DocumentAdd, Download, EditPen, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { ManualEnterCreditRecord } from '@/types/manualCredit'
import {
  batchImportManualCreditsWithProgress,
  createManualEnterCredit,
  deleteManualEnterCredit,
  fetchManualEnterCreditList,
  updateManualEnterCredit,
} from '@/api/manualCredit'
import {
  downloadManualCreditTemplate,
  parseManualCreditWorkbook,
} from '@/utils/manualCreditExcel'

const loading = ref(false)
const tableData = ref<ManualEnterCreditRecord[]>([])
const selectedRows = ref<ManualEnterCreditRecord[]>([])

const fileInputRef = ref<HTMLInputElement | null>(null)

const dialogVisible = ref(false)
const dialogTitle = ref('编辑学分记录')
const formRef = ref<FormInstance>()
const formModel = ref<ManualEnterCreditRecord>(emptyRecord())
const saving = ref(false)

const importDialogVisible = ref(false)
const importPercent = ref(0)
const importStatusText = ref('')
const importRunning = ref(false)

function emptyRecord(): ManualEnterCreditRecord {
  return {
    id: 0,
    employee_number: '',
    employee_name: '',
    credit_type: '',
    activity_name: '',
    activity_date: null,
    credits: '',
    description: '',
    attachment_url: '',
    create_time: null,
    update_time: null,
    Modifier__number: '',
  }
}

async function loadList() {
  loading.value = true
  try {
    const page = await fetchManualEnterCreditList(1, 500)
    tableData.value = page.rows
  } catch (e) {
    console.error(e)
    ElMessage.error(e instanceof Error ? e.message : '加载列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadList()
})

const rules: FormRules = {
  employee_number: [{ required: true, message: '请输入工号', trigger: 'blur' }],
  credits: [{ required: true, message: '请输入学分', trigger: 'blur' }],
}

const hasSelection = computed(() => selectedRows.value.length > 0)

function triggerImport() {
  fileInputRef.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  loading.value = true
  try {
    const buf = await file.arrayBuffer()
    const { rows, skipped, errors } = parseManualCreditWorkbook(buf)
    if (errors.length > 0) {
      await ElMessageBox.alert(errors.join('\n'), '校验未通过', {
        type: 'error',
        confirmButtonText: '知道了',
      })
      return
    }
    if (rows.length === 0) {
      ElMessage.warning('没有可导入的数据')
      return
    }

    importDialogVisible.value = true
    importRunning.value = true
    importPercent.value = 0
    importStatusText.value = '准备上传…'

    const { totalInserted } = await batchImportManualCreditsWithProgress(rows, (pct, label) => {
      importPercent.value = pct
      importStatusText.value = label
    })

    const skipHint = skipped > 0 ? `，已跳过空行 ${skipped} 行` : ''
    await ElMessageBox.alert(
      `导入完成：成功写入 ${totalInserted} 条${skipHint}。`,
      '导入结果',
      { type: 'success', confirmButtonText: '知道了' },
    )
    await loadList()
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '导入失败'
    await ElMessageBox.alert(msg, '导入失败', { type: 'error', confirmButtonText: '知道了' })
  } finally {
    importRunning.value = false
    importDialogVisible.value = false
    loading.value = false
  }
}

function handleTemplate() {
  downloadManualCreditTemplate()
  ElMessage.success('模板已开始下载')
}

function handleSelectionChange(rows: ManualEnterCreditRecord[]) {
  selectedRows.value = rows
}

function handleAdd() {
  dialogTitle.value = '新增学分记录'
  formModel.value = emptyRecord()
  dialogVisible.value = true
}

function handleEdit(row: ManualEnterCreditRecord) {
  dialogTitle.value = '编辑学分记录'
  formModel.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit() {
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
    const m = formModel.value
    if (!m.id) {
      await createManualEnterCredit(m)
      ElMessage.success('新增成功')
      dialogVisible.value = false
      await loadList()
    } else {
      await updateManualEnterCredit(m.id, m)
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

function handleDelete(row: ManualEnterCreditRecord) {
  ElMessageBox.confirm(`确定删除「${row.employee_name || row.employee_number || row.id}」的这条记录吗？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(async () => {
      await deleteManualEnterCredit(row.id)
      tableData.value = tableData.value.filter((r) => r.id !== row.id)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}

function handleBatchDelete() {
  if (!selectedRows.value.length) {
    return
  }
  ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条记录吗？`, '批量删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(async () => {
      const ids = selectedRows.value.map((r) => r.id)
      for (const id of ids) {
        await deleteManualEnterCredit(id)
      }
      tableData.value = tableData.value.filter((r) => !ids.includes(r.id))
      ElMessage.success('已删除')
    })
    .catch(() => {})
}
</script>

<template>
  <div class="credit-page" v-loading="loading">
    <el-card class="credit-card" shadow="never">
      <div class="credit-header">
        <div>
          <h2 class="credit-title">学分管理</h2>
          <p class="credit-desc">
            Excel 需包含工号、获得学分（必填）。导入时将按批提交后端；修改人工号由服务端根据 Cookie
            <code>account</code> 写入。请确保已登录且浏览器携带该 Cookie。
          </p>
        </div>
      </div>

      <div class="credit-toolbar">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls"
          class="file-input"
          @change="onFileChange"
        />
        <div class="credit-toolbar__start">
          <el-button type="success" :icon="DocumentAdd" @click="handleAdd">新增记录</el-button>
          <el-button type="primary" :icon="Download" @click="handleTemplate">下载导入模板</el-button>
          <el-button type="primary" :icon="Upload" @click="triggerImport">导入学分</el-button>
        </div>
        <div class="credit-toolbar__right">
          <el-tooltip content="批量删除" placement="top">
            <span class="credit-toolbar__batch-icon-wrap">
              <el-button
                type="danger"
                :icon="Delete"
                :disabled="!hasSelection"
                circle
                @click="handleBatchDelete"
              />
            </span>
          </el-tooltip>
        </div>
      </div>

      <el-table
        :data="tableData"
        border
        stripe
        style="width: 100%"
        max-height="560"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" fixed />
        <el-table-column prop="employee_number" label="工号" min-width="110" fixed show-overflow-tooltip />
        <el-table-column prop="employee_name" label="姓名" min-width="100" show-overflow-tooltip />
        <el-table-column prop="credit_type" label="学分类型" min-width="120" show-overflow-tooltip />
        <el-table-column prop="activity_name" label="活动名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="activity_date" label="活动日期" min-width="170" show-overflow-tooltip />
        <el-table-column prop="credits" label="获得学分" width="100" />
        <el-table-column prop="description" label="详细描述" min-width="180" show-overflow-tooltip />
        <el-table-column prop="attachment_url" label="附件URL" min-width="160" show-overflow-tooltip />
        <el-table-column prop="Modifier__number" label="修改人工号" width="120" show-overflow-tooltip />
        <el-table-column prop="create_time" label="创建时间" width="170" />
        <el-table-column prop="update_time" label="更新时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="EditPen" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据，请导入学分或点击「新增记录」" />
        </template>
      </el-table>
    </el-card>

    <el-dialog
      v-model="importDialogVisible"
      title="正在导入学分"
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!importRunning"
      append-to-body
    >
      <div class="import-progress-wrap">
        <el-progress :percentage="importPercent" :stroke-width="14" />
        <p class="import-status">{{ importStatusText }}</p>
      </div>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="formModel" :rules="rules" label-width="110px" v-loading="saving">
        <el-form-item label="工号" prop="employee_number">
          <el-input v-model="formModel.employee_number" placeholder="员工工号" clearable />
        </el-form-item>
        <el-form-item label="姓名" prop="employee_name">
          <el-input v-model="formModel.employee_name" placeholder="员工姓名" clearable />
        </el-form-item>
        <el-form-item label="学分类型" prop="credit_type">
          <el-input v-model="formModel.credit_type" placeholder="如：培训、比赛、分享" clearable />
        </el-form-item>
        <el-form-item label="活动名称" prop="activity_name">
          <el-input v-model="formModel.activity_name" placeholder="活动 / 比赛 / 分享主题等" clearable />
        </el-form-item>
        <el-form-item label="活动日期" prop="activity_date">
          <el-date-picker
            v-model="formModel.activity_date"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择日期时间"
            style="width: 100%"
            clearable
          />
        </el-form-item>
        <el-form-item label="获得学分" prop="credits">
          <el-input v-model="formModel.credits" placeholder="数值或说明" clearable />
        </el-form-item>
        <el-form-item label="详细描述" prop="description">
          <el-input v-model="formModel.description" type="textarea" :rows="3" placeholder="活动详情" />
        </el-form-item>
        <el-form-item label="附件URL" prop="attachment_url">
          <el-input v-model="formModel.attachment_url" placeholder="证明材料、证书链接" clearable />
        </el-form-item>
        <el-form-item label="修改人工号">
          <el-input v-model="formModel.Modifier__number" disabled placeholder="保存时由服务端根据 Cookie 写入" />
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
.credit-page {
  width: 100%;
  padding-bottom: $spacing-xl;
}

.credit-card {
  border-radius: $radius-md;
  border: 1px solid $border-color;
}

.credit-header {
  margin-bottom: $spacing-md;
}

.credit-title {
  margin: 0 0 $spacing-xs;
  font-size: 20px;
  font-weight: 600;
  color: $text-main-color;
}

.credit-desc {
  margin: 0;
  color: $text-secondary-color;
  font-size: $font-size-small;
  line-height: 1.6;

  code {
    font-size: 12px;
    padding: 0 4px;
    background: $background-light;
    border-radius: 4px;
  }
}

.credit-toolbar {
  margin-bottom: $spacing-md;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.credit-toolbar__start {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-md;
  flex: 1;
  min-width: 0;
}

.credit-toolbar__right {
  flex-shrink: 0;
}

.credit-toolbar__batch-icon-wrap {
  display: inline-flex;
  vertical-align: middle;
}

.file-input {
  display: none;
}

.import-progress-wrap {
  padding: $spacing-sm 0 $spacing-md;
}

.import-status {
  margin: $spacing-md 0 0;
  color: $text-secondary-color;
  font-size: $font-size-small;
  line-height: 1.5;
}
</style>
