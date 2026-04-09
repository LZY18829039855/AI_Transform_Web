import * as XLSX from 'xlsx'
import * as XLSXStyle from 'xlsx-js-style'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import type { ManualCreditImportRow, ManualEnterCreditRecord } from '@/types/manualCredit'

dayjs.extend(customParseFormat)

/** 模板示例行 I 列固定提示；导入解析时命中则跳过该行 */
const TEMPLATE_EXAMPLE_NOTE = '录入数据时该示例数据务必删除'

type ManualFieldKey = Exclude<keyof ManualEnterCreditRecord, 'id' | 'create_time' | 'update_time'>

/** 表头别名 → 内部字段名（不含 id / create / update，由页面填充） */
const HEADER_ALIASES: Record<string, ManualFieldKey> = {
  工号: 'employee_number',
  '工号（必填）': 'employee_number',
  员工工号: 'employee_number',
  employee_number: 'employee_number',

  姓名: 'employee_name',
  员工姓名: 'employee_name',
  employee_name: 'employee_name',

  学分类型: 'credit_type',
  credit_type: 'credit_type',

  活动名称: 'activity_name',
  比赛名称: 'activity_name',
  分享主题: 'activity_name',
  认证名称: 'activity_name',
  activity_name: 'activity_name',

  活动日期: 'activity_date',
  activity_date: 'activity_date',

  获得学分: 'credits',
  '获得学分（必填）': 'credits',
  学分: 'credits',
  credits: 'credits',

  详细描述: 'description',
  描述: 'description',
  description: 'description',

  附件url: 'attachment_url',
  附件URL: 'attachment_url',
  附件链接: 'attachment_url',
  attachment_url: 'attachment_url',

  数据修改人工号: 'Modifier__number',
  modifier__number: 'Modifier__number',
  Modifier__number: 'Modifier__number',
}

function normalizeHeader(cell: unknown): string {
  return String(cell ?? '')
    .trim()
    .replace(/\s+/g, '')
}

function mapHeaderToField(header: string): ManualFieldKey | null {
  const compact = normalizeHeader(header)
  const stripped = compact.replace(/（必填）/g, '').replace(/\(必填\)/gi, '')
  const lower = compact.toLowerCase()
  const lowerStripped = stripped.toLowerCase()
  if (HEADER_ALIASES[compact]) {
    return HEADER_ALIASES[compact]
  }
  if (HEADER_ALIASES[stripped]) {
    return HEADER_ALIASES[stripped]
  }
  if (HEADER_ALIASES[lower]) {
    return HEADER_ALIASES[lower]
  }
  if (HEADER_ALIASES[lowerStripped]) {
    return HEADER_ALIASES[lowerStripped]
  }
  return null
}

/** 将 Excel 单元格转为活动日期字符串 */
export function parseActivityDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (value instanceof Date) {
    return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : null
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF?.parse_date_code?.(value) as
      | { y: number; m: number; d: number; H?: number; M?: number; S?: number }
      | undefined
    if (parsed && parsed.y) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, parsed.S ?? 0)
      return dayjs(d).format('YYYY-MM-DD HH:mm:ss')
    }
  }
  const s = String(value).trim()
  const formats = ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY/M/D', 'MM-DD-YYYY']
  for (const f of formats) {
    const d = dayjs(s, f, true)
    if (d.isValid()) {
      return f === 'YYYY-MM-DD' || f === 'YYYY/MM/DD' || f === 'YYYY/M/D' || f === 'MM-DD-YYYY'
        ? d.format('YYYY-MM-DD HH:mm:ss')
        : d.format('YYYY-MM-DD HH:mm:ss')
    }
  }
  const loose = dayjs(s)
  return loose.isValid() ? loose.format('YYYY-MM-DD HH:mm:ss') : s
}

export interface ParseManualCreditResult {
  rows: ManualCreditImportRow[]
  skipped: number
  errors: string[]
}

/**
 * 解析手动学分 Excel：第一行为表头；第二行可为模板示例行（I 列含固定提示则跳过）；其后为数据行。
 */
export function parseManualCreditWorkbook(buffer: ArrayBuffer): ParseManualCreditResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], skipped: 0, errors: ['工作簿为空'] }
  }
  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]

  if (!matrix.length) {
    return { rows: [], skipped: 0, errors: ['工作表为空'] }
  }

  const headerRow = matrix[0].map((c) => normalizeHeader(c))
  const colIndex: Partial<Record<ManualFieldKey, number>> = {}
  headerRow.forEach((h, i) => {
    const field = mapHeaderToField(h)
    if (field) {
      colIndex[field] = i
    }
  })

  if (colIndex.employee_number === undefined && colIndex.employee_name === undefined) {
    return {
      rows: [],
      skipped: 0,
      errors: ['未识别到「工号」或「姓名」列，请检查表头是否与模板一致'],
    }
  }

  const rows: ManualCreditImportRow[] = []
  const errors: string[] = []
  let skipped = 0
  let requiredFieldMissing = false

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r]
    if (!line || line.every((c) => String(c ?? '').trim() === '')) {
      skipped++
      continue
    }

    if (String(line[8] ?? '').includes(TEMPLATE_EXAMPLE_NOTE)) {
      skipped++
      continue
    }

    const pick = (field: ManualFieldKey): string => {
      const idx = colIndex[field]
      if (idx === undefined) {
        return ''
      }
      const raw = line[idx]
      if (raw === null || raw === undefined) {
        return ''
      }
      if (field === 'activity_date') {
        return parseActivityDateCell(raw) ?? ''
      }
      return String(raw).trim()
    }

    const employee_number = pick('employee_number')
    const employee_name = pick('employee_name')
    const credits = pick('credits')
    const excelRowLabel = `Excel 第 ${r + 1} 行`

    if (!employee_number && !employee_name && !credits && !pick('credit_type') && !pick('activity_name')) {
      skipped++
      continue
    }

    if (!employee_number) {
      requiredFieldMissing = true
    }
    if (!credits) {
      requiredFieldMissing = true
    }
    if (!employee_number || !credits) {
      continue
    }

    const ad = pick('activity_date')
    rows.push({
      employee_number,
      employee_name,
      credit_type: pick('credit_type'),
      activity_name: pick('activity_name'),
      activity_date: ad ? ad : null,
      credits,
      description: pick('description'),
      attachment_url: pick('attachment_url'),
      Modifier__number: pick('Modifier__number'),
    })
  }

  if (errors.length > 0) {
    return { rows: [], skipped, errors }
  }

  if (requiredFieldMissing) {
    return { rows: [], skipped, errors: ['请确认工号或学分信息都填写完整'] }
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('请确认工号或学分信息都填写完整')
  }

  return { rows, skipped, errors }
}

const TEMPLATE_HEADERS = [
  '工号（必填）',
  '姓名',
  '学分类型',
  '活动名称',
  '活动日期',
  '获得学分（必填）',
  '详细描述',
  '附件URL',
]

/** I 列：模板说明（示例行必填，表头可为空） */
const TEMPLATE_HEADER_COL_I = ''

const HEADER_CELL_STYLE = {
  font: { bold: true, color: { rgb: '000000' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
}

/** 示例数据行：醒目红色 */
const EXAMPLE_ROW_FONT = { color: { rgb: 'FF0000' } }

/** 活动日期示例：显示为 yyyy-mm-dd */
const EXAMPLE_ACTIVITY_DATE_FMT = 'yyyy-mm-dd'

/**
 * Excel 1900 日期系统序列值（与 SheetJS / Excel 展示一致，用于单元格 t:'n'）
 */
function dateToExcelSerial(y: number, m: number, d: number): number {
  const epoch = new Date(1899, 11, 30)
  const target = new Date(y, m - 1, d)
  return Math.round((target.getTime() - epoch.getTime()) / (24 * 60 * 60 * 1000))
}

/** 工号列预置空行：从第 3 行起（第 2 行为示例），这些行的 A 列设为「文本」格式 */
const TEXT_FORMAT_PREFILL_ROWS = 200

/** 下载导入模板（.xlsx）：表头居中加粗黑色；工号列（A）为文本格式；含红色示例行 */
export function downloadManualCreditTemplate(fileName = '学分录入导入模板') {
  const headersFull = [...TEMPLATE_HEADERS, TEMPLATE_HEADER_COL_I]
  const colCount = headersFull.length

  const exampleRowPlain: (string | number)[] = [
    '00123456',
    '张三',
    '比赛',
    '云核第一届Agent大赛',
    '', // E：日期单独写为序列 + 格式
    1.5,
    '云核第一届Agent大赛32强',
    'http://xxx',
    TEMPLATE_EXAMPLE_NOTE,
  ]

  const ws = XLSXStyle.utils.aoa_to_sheet([headersFull, exampleRowPlain])
  const exampleDateSerial = dateToExcelSerial(2026, 3, 1)

  for (let c = 0; c < colCount; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c })
    const cell = ws[addr] as { t?: string; v?: unknown; s?: unknown }
    if (cell) {
      cell.s = HEADER_CELL_STYLE
    }
  }

  const exampleRowIndex = 1
  for (let c = 0; c < colCount; c++) {
    const addr = XLSXStyle.utils.encode_cell({ r: exampleRowIndex, c })
    if (!ws[addr]) {
      ws[addr] = { t: 's', v: '' }
    }
    const base = ws[addr] as { t?: string; v?: unknown; z?: string; s?: { font?: unknown; numFmt?: string } }
    if (c === 4) {
      base.t = 'n'
      base.v = exampleDateSerial
      base.z = EXAMPLE_ACTIVITY_DATE_FMT
      base.s = { font: EXAMPLE_ROW_FONT, numFmt: EXAMPLE_ACTIVITY_DATE_FMT }
      continue
    }
    if (c === 0) {
      base.t = 's'
      base.v = '00123456'
      base.s = { font: EXAMPLE_ROW_FONT, numFmt: '@' }
      continue
    }
    base.s = { ...base.s, font: EXAMPLE_ROW_FONT }
  }

  const firstDataRow = 2
  const lastRow = firstDataRow + TEXT_FORMAT_PREFILL_ROWS - 1
  for (let r = firstDataRow; r <= lastRow; r++) {
    const addr = XLSXStyle.utils.encode_cell({ r, c: 0 })
    ws[addr] = {
      t: 's',
      v: '',
      s: { numFmt: '@' },
    }
  }

  ws['!ref'] = XLSXStyle.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: colCount - 1 },
  })

  ws['!cols'] = headersFull.map((_, i) => {
    if (i === 0) {
      return { wch: 18 }
    }
    if (i === 5) {
      return { wch: 18 }
    }
    if (i === colCount - 1) {
      return { wch: 36 }
    }
    return { wch: 16 }
  })

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, '学分录入')
  XLSXStyle.writeFile(wb, `${fileName}.xlsx`)
}
