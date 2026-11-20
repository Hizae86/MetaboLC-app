import { isNum, num } from './format'
import { sourceParams, transitionParams } from './vendors'

/** Plain-text renderings of a method for the clipboard: a full method sheet
 *  (pastes cleanly into an ELN, e-mail or SOP draft) and the transition list
 *  as TSV (pastes into Excel or an acquisition-method table). Only values that
 *  are stored are written; nothing is filled in or converted. */

const role = (t: any) => (t.is_internal_standard ? 'IS' : t.is_quantifier ? 'Quant' : 'Qual')
const cell = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v))

export const sortedGradient = (method: any) =>
  [...(method.gradient_steps || [])].sort((a: any, b: any) => a.time_min - b.time_min)

export const columnLine = (m: any) => {
  const name = [m.column_brand, m.column_name].filter(Boolean).join(' ')
  const dims = isNum(m.column_length_mm) && isNum(m.column_diameter_mm) ? `${num(m.column_length_mm)} × ${num(m.column_diameter_mm)} mm` : ''
  const particle = isNum(m.column_particle_size_um) ? `${num(m.column_particle_size_um)} µm` : ''
  return [name, dims, particle].filter(Boolean).join(', ')
}

export const transitionColumns = (method: any) => {
  const extra = transitionParams(method.instrument_manufacturer)
  const vendor = extra.fields
    .map((field, i) => ({ field, label: extra.headers[i] }))
    .filter(c => c.field !== 'polarity' && c.field !== 'collision_energy_ev')
  return [
    { field: 'precursor_mz', label: 'Q1 (m/z)' },
    { field: 'product_mz', label: 'Q3 (m/z)' },
    { field: 'retention_time_min', label: 'RT (min)' },
    { field: 'collision_energy_ev', label: 'CE (eV)' },
    ...vendor,
    { field: 'dwell_time_ms', label: 'Dwell (ms)' },
    { field: 'polarity', label: 'Polarity' },
  ]
}

export const transitionsToTSV = (method: any) => {
  const cols = transitionColumns(method)
  const header = ['Compound', 'Role', ...cols.map(c => c.label), 'Internal standard']
  const rows = (method.mrm_transitions || []).map((t: any) =>
    [t.compound_name, role(t), ...cols.map(c => cell(t[c.field])), cell(t.assigned_is)].join('\t'))
  return [header.join('\t'), ...rows].join('\n')
}

const table = (rows: string[][]) => {
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] || '').length)))
  return rows.map(r => '  ' + r.map((c, i) => (c || '').padEnd(widths[i])).join('  ').trimEnd()).join('\n')
}

export const methodToText = (method: any, url: string) => {
  const out: string[] = []
  const kv = (label: string, value: unknown, unit = '') => {
    if (value === null || value === undefined || value === '') return
    out.push(`${(label + ':').padEnd(26)}${value}${unit ? ' ' + unit : ''}`)
  }

  out.push(method.title || method.analyte, '='.repeat(Math.min(72, (method.title || method.analyte || '').length)))
  kv('Analyte(s)', method.analyte)
  kv('Matrix', method.matrix)
  kv('Instrument', [method.instrument_manufacturer, method.instrument_model].filter(Boolean).join(' '))
  kv('Ionization', method.ionization_mode)
  kv('Laboratory', [method.laboratory, method.country].filter(Boolean).join(', '))
  kv('Method source', [method.source_type, method.source_authors, method.reference].filter(Boolean).join(' · '))
  kv('Source', `Koiné method #${method.id} · ${url}`)

  out.push('', 'LIQUID CHROMATOGRAPHY', '-'.repeat(21))
  kv('Column', columnLine(method))
  kv('Stationary phase', method.column_stationary_phase)
  kv('Column temperature', method.column_temperature_c, '°C')
  kv('Mobile phase A', method.mobile_phase_a)
  kv('Mobile phase B', method.mobile_phase_b)
  kv('Injection volume', method.injection_volume_ul, 'µL')
  kv('Autosampler temp', method.autosampler_temperature_c, '°C')
  kv('Needle wash', method.needle_wash_solvent)
  const steps = sortedGradient(method)
  if (steps.length) {
    out.push('Gradient:')
    out.push(table([
      ['Time (min)', '%B', 'Flow (mL/min)', 'Curve'],
      ...steps.map((s: any) => [cell(s.time_min), cell(s.percent_b), cell(s.flow_rate_ml_min), cell(s.curve)]),
    ]))
  }

  out.push('', 'MASS SPECTROMETRY', '-'.repeat(17))
  sourceParams(method.instrument_manufacturer).forEach(p => kv(p.label, method[p.field], p.unit))
  const transitions = method.mrm_transitions || []
  if (transitions.length) {
    const cols = transitionColumns(method)
    out.push(`MRM transitions (${transitions.length}):`)
    out.push(table([
      ['Compound', 'Role', ...cols.map(c => c.label)],
      ...transitions.map((t: any) => [t.compound_name, role(t), ...cols.map(c => cell(t[c.field]))]),
    ]))
  }

  if (method.sample_prep_method || method.sample_prep_details) {
    out.push('', 'SAMPLE PREPARATION', '-'.repeat(18))
    kv('Method', method.sample_prep_method)
    if (method.sample_prep_details) out.push(method.sample_prep_details)
  }
  if (method.reference) { out.push(''); kv('Reference', method.reference) }
  out.push('', 'For research and method-development reference only. Clinical use requires local validation.')
  return out.join('\n')
}

export const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall through */ }
  // Non-secure contexts (e.g. the app opened over plain http on a lab network).
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  document.body.removeChild(ta)
  return ok
}

export const downloadText = (filename: string, content: string, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
