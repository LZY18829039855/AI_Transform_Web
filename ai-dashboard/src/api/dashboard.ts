
/**
 * 获取干部AI任职认证表统计数据
 * @returns 干部AI任职认证表统计数据
 */
export const fetchCadreAiCertificationOverview = async (): Promise<CadreAiCertificationOverviewResponseVO | null> => {
  try {
    const response = await get<Result<CadreAiCertificationOverviewResponseVO>>(
      '/cadre-ai-certification-overview'
    )
    if (response.code === 200) {
      return response.data
    }
    console.warn('获取干部AI任职认证表数据失败：', response.message)
    return null
  } catch (error) {
    console.error('获取干部AI任职认证表数据异常：', error)
    return null
  }
}
