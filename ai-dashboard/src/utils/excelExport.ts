import * as XLSX from 'xlsx-js-style'
import type { AppointmentAuditRecord, CertificationAuditRecord } from '@/types/dashboard'

/**
 * 格式化布尔值为中文
 */
const formatBoolean = (value: boolean | undefined): string => {
  if (value === undefined) {
    return '待提供数据'
  }
  return value ? '是' : '否'
}

/**
 * 导出任职认证数据到Excel
 * @param appointmentRecords 任职记录
 * @param certificationRecords 认证记录
 * @param fileName 文件名（不包含扩展名）
 * @param role 角色类型（'0'-全员，'1'-干部，'2'-专家，'3'-基层主管）
 */
export const exportCertificationDataToExcel = (
  appointmentRecords: AppointmentAuditRecord[],
  certificationRecords: CertificationAuditRecord[],
  fileName: string = '任职认证数据',
  role: string = '0',
) => {
  const isCadre = role === '1'
  const isExpert = role === '2'
  const isCadreOrExpert = isCadre || isExpert
  // 创建工作簿
  const workbook = XLSX.utils.book_new()

  // 准备任职数据
  const appointmentData = appointmentRecords.map((record) => {
    const baseData: Record<string, string> = {
      '是否达标': formatBoolean(record.isQualified),
      '姓名': record.name || '',
      '工号': record.employeeId || '',
      '岗位AI成熟度': record.positionMaturity || '',
      '职位类': record.positionCategory || '',
      '专业任职资格类': record.professionalCategory || '',
      '专家任职资格类（仅体现AI）': record.expertCategory || '',
      '专业任职资格子类': record.professionalSubCategory || '',
      '资格方向': record.qualificationDirection || '',
      '资格级别': record.qualificationLevel || '',
      '生效日期': record.effectiveDate || '',
      '失效日期': record.expiryDate || '',
      '一级部门': record.departmentLevel1 || '',
      '二级部门': record.departmentLevel2 || '',
      '三级部门': record.departmentLevel3 || '',
      '四级部门': record.departmentLevel4 || '',
      '五级部门': record.departmentLevel5 || '',
      '最小部门': record.minDepartment || '',
    }
    
    // 根据角色添加不同的列
    // 专家数据不包含干部类型
    if (isCadre) {
      baseData['干部类型'] = record.cadreType || ''
    } else if (!isCadreOrExpert) {
      baseData['获取方式'] = record.acquisitionMethod || ''
      baseData['职位子类'] = record.positionSubCategory || ''
      baseData['是否干部'] = formatBoolean(record.isCadre)
      baseData['是否专家'] = formatBoolean(record.isExpert)
      baseData['是否基层主管'] = formatBoolean(record.isFrontlineManager)
      baseData['组织AI成熟度'] = record.organizationMaturity || '待提供数据'
      baseData['要求持证类型'] = record.requiredCertificate || '待提供数据'
    }
    
    return baseData
  })

  // 准备认证数据
  const certificationData = certificationRecords.map((record) => {
    const baseData: Record<string, string> = {
      '是否达标': formatBoolean(record.isCertStandard),
      '姓名': record.name || '',
      '工号': record.employeeId || '',
      '岗位AI成熟度': record.positionMaturity || '',
      '职位类': record.positionCategory || '',
      '证书名称': record.certificateName || '',
      '是否通过科目二': formatBoolean(record.subjectTwoPassed),
      '一级部门': record.departmentLevel1 || '',
      '二级部门': record.departmentLevel2 || '',
      '三级部门': record.departmentLevel3 || '',
      '四级部门': record.departmentLevel4 || '',
      '五级部门': record.departmentLevel5 || '',
      '最小部门': record.minDepartment || '',
    }
    
    // 根据角色添加不同的列
    // 专家数据不包含干部类型
    if (isCadre) {
      baseData['干部类型'] = record.cadreType || ''
    } else if (!isCadreOrExpert) {
      baseData['证书生效日期'] = record.certificateEffectiveDate || ''
      baseData['职位子类'] = record.positionSubCategory || ''
      baseData['是否干部'] = formatBoolean(record.isCadre)
      baseData['是否专家'] = formatBoolean(record.isExpert)
      baseData['是否基层主管'] = formatBoolean(record.isFrontlineManager)
      baseData['组织AI成熟度'] = record.organizationMaturity || '待提供数据'
      baseData['要求持证类型'] = record.requiredCertificate || '待提供数据'
    }
    
    return baseData
  })

  // 创建工作表
  const appointmentSheet = XLSX.utils.json_to_sheet(appointmentData)
  const certificationSheet = XLSX.utils.json_to_sheet(certificationData)

  // 设置表头样式（加粗、居中）和数据样式（居中）
  const setSheetStyle = (sheet: XLSX.WorkSheet, data: Record<string, string>[]) => {
    if (data.length === 0) {
      return
    }

    // 获取表头范围
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
    
    // 设置表头样式（第一行）
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!sheet[cellAddress]) {
        continue
      }
      
      // 创建带样式的单元格对象
      const cell = sheet[cellAddress]
      sheet[cellAddress] = {
        ...cell,
        s: {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
        },
      }
    }
    
    // 设置数据行样式（居中）
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        if (!sheet[cellAddress]) {
          continue
        }
        
        const cell = sheet[cellAddress]
        sheet[cellAddress] = {
          ...cell,
          s: {
            alignment: { horizontal: 'center', vertical: 'center' },
          },
        }
      }
    }
  }

  // 设置列宽（根据角色动态调整）
  if (appointmentData.length > 0) {
    const firstRow = appointmentData[0]
    if (firstRow) {
      const appointmentCols = Object.keys(firstRow).map((key) => {
        // 根据列名设置合适的宽度
        if (key.includes('部门') || key.includes('资格') || key.includes('方向')) {
          return { wch: 18 }
        } else if (key.includes('名称') || key.includes('类别')) {
          return { wch: 25 }
        } else if (key.includes('日期')) {
          return { wch: 12 }
        } else if (key.includes('是否') || key.includes('达标')) {
          return { wch: 10 }
        } else {
          return { wch: 15 }
        }
      })
      appointmentSheet['!cols'] = appointmentCols
      // 设置样式
      setSheetStyle(appointmentSheet, appointmentData)
    }
  }

  if (certificationData.length > 0) {
    const firstRow = certificationData[0]
    if (firstRow) {
      const certificationCols = Object.keys(firstRow).map((key) => {
        // 根据列名设置合适的宽度
        if (key.includes('部门') || key.includes('资格') || key.includes('方向')) {
          return { wch: 18 }
        } else if (key.includes('名称') || key.includes('类别')) {
          return { wch: 25 }
        } else if (key.includes('日期')) {
          return { wch: 12 }
        } else if (key.includes('是否') || key.includes('达标')) {
          return { wch: 10 }
        } else {
          return { wch: 15 }
        }
      })
      certificationSheet['!cols'] = certificationCols
      // 设置样式
      setSheetStyle(certificationSheet, certificationData)
    }
  }

  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(workbook, appointmentSheet, '任职数据')
  XLSX.utils.book_append_sheet(workbook, certificationSheet, '认证数据')

  // 生成文件名（包含当前日期）
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const finalFileName = `${fileName}_${dateStr}.xlsx`

  // 导出文件
  XLSX.writeFile(workbook, finalFileName)
}

