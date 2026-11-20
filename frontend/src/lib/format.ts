/** Formatting helpers for analytical values. Never invent precision: values
 *  are shown as stored, only trimmed of float noise. */
export const isNum = (v: unknown): v is number | string =>
  v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))

export const num = (v: unknown, maxDecimals = 4): string => {
  if (!isNum(v)) return '—'
  return String(Number(Number(v).toFixed(maxDecimals)))
}

/** m/z with a fixed number of decimals so columns align. */
export const mz = (v: unknown, decimals = 1): string => (isNum(v) ? Number(v).toFixed(decimals) : '—')

export const withUnit = (v: unknown, unit: string): string => (isNum(v) ? `${num(v)} ${unit}`.trim() : '—')

export const matrixLabel = (m?: string | null) => {
  if (!m) return '—'
  if (m.toLowerCase() === 'csf') return 'CSF'
  return m.charAt(0).toUpperCase() + m.slice(1)
}
