import { useState, useMemo } from 'react'

interface Breakdown {
  category: string
  earned: number
  max: number
  missing: string[]
}

function calcBreakdown(m: any): { score: number; breakdown: Breakdown[] } {
  const breakdown: Breakdown[] = []

  // Identificación (10)
  let id = 0; const idMissing = []
  if (m.title) id += 2; else idMissing.push('Title')
  if (m.analyte) id += 3; else idMissing.push('Analyte')
  if (m.matrix) id += 3; else idMissing.push('Matrix')
  if (m.clinical_application) id += 2; else idMissing.push('Clinical application')
  breakdown.push({ category: 'Identification', earned: id, max: 10, missing: idMissing })

  // Cromatografía (20)
  let chrom = 0; const chromMissing = []
  if (m.column_name || m.column_brand) chrom += 4; else chromMissing.push('Column')
  if (m.mobile_phase_a && m.mobile_phase_b) chrom += 6; else chromMissing.push('Mobile phases A & B')
  if (m.gradient_steps?.length > 0) chrom += 6; else chromMissing.push('Gradient program')
  if (m.gradient_steps?.[0]?.flow_rate_ml_min) chrom += 4; else chromMissing.push('Flow rate')
  breakdown.push({ category: 'Chromatography', earned: chrom, max: 20, missing: chromMissing })

  // MRM (20)
  let mrm = 0; const mrmMissing = []
  const quant = (m.mrm_transitions || []).filter((t: any) => !t.is_internal_standard && t.is_quantifier)
  if (quant.length >= 1) mrm += 8; else mrmMissing.push('MRM transitions')
  if (quant[0]?.collision_energy_ev) mrm += 6; else mrmMissing.push('Collision energy (CE)')
  if (quant[0]?.retention_time_min) mrm += 6; else mrmMissing.push('Retention time')
  breakdown.push({ category: 'MRM Transitions', earned: mrm, max: 20, missing: mrmMissing })

  // MS Source (15)
  let src = 0; const srcMissing = []
  const srcFields = [
    m.ion_spray_voltage, m.source_temperature_c, m.gas1, m.gas2,
    m.curtain_gas, m.capillary_voltage_pos_v, m.desolvation_temperature_c,
    m.capillary_voltage_v, m.capillary_voltage_neg_v, m.cone_gas_flow_lh
  ]
  const filled = srcFields.filter(Boolean).length
  if (filled >= 1) src += 8; else srcMissing.push('Any MS source parameter')
  if (filled >= 3) src += 7; else if (filled > 0) srcMissing.push('2+ more MS source parameters')
  breakdown.push({ category: 'MS Source', earned: src, max: 15, missing: srcMissing })

  // Validación (20) — only from compound_validation
  let val = 0; const valMissing = []
  const cvData = m.compound_validation || []
  if (cvData.some((v: any) => v.lloq)) val += 8; else valMissing.push('LLOQ per compound')
  if (cvData.some((v: any) => v.cv_intra_percent || v.cv_inter_percent || v.cv_percent)) val += 6; else valMissing.push('CV% (precision)')
  if (cvData.some((v: any) => v.r2)) val += 6; else valMissing.push('R² (linearity)')
  breakdown.push({ category: 'Validation', earned: val, max: 20, missing: valMissing })

  // Sample prep (10)
  let prep = 0; const prepMissing = []
  if (m.sample_prep_method) prep += 4; else prepMissing.push('Sample prep method')
  if ((m.sample_prep_details || '').length > 50) prep += 6; else prepMissing.push('Detailed protocol')
  breakdown.push({ category: 'Sample Prep', earned: prep, max: 10, missing: prepMissing })

  // Trazabilidad (5)
  let trace = 0; const traceMissing = []
  if (m.reference) trace += 3; else traceMissing.push('Reference / DOI')
  if (m.laboratory) trace += 2; else traceMissing.push('Laboratory')
  breakdown.push({ category: 'Traceability', earned: trace, max: 5, missing: traceMissing })

  const score = Math.min(100, breakdown.reduce((a, b) => a + b.earned, 0))
  return { score, breakdown }
}

// Badge compact — for method cards
export function CompletenesBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-50 text-green-700 ring-green-200'
    : score >= 50 ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-red-50 text-red-600 ring-red-200'
  const label = score >= 80 ? 'Complete' : score >= 50 ? 'Partial' : 'Low'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${color}`}>
      {score}% · {label}
    </span>
  )
}

// Map missing field to edit tab
const FIELD_TAB: Record<string, string> = {
  'Title': 'basic', 'Analyte': 'basic', 'Matrix': 'basic', 'Clinical application': 'basic',
  'Column': 'chromatography', 'Mobile phases A & B': 'chromatography',
  'Gradient program': 'chromatography', 'Flow rate': 'chromatography',
  'MRM transitions': 'mrm', 'Collision energy (CE)': 'mrm', 'Retention time': 'mrm',
  'Any MS source parameter': 'ms', '2+ more MS source parameters': 'ms',
  'LLOQ': 'validation', 'CV% (precision)': 'validation', 'R² (linearity)': 'validation',
  'Sample prep method': 'sample', 'Detailed protocol': 'sample',
  'Reference / DOI': 'basic', 'Laboratory': 'basic',
}

// Full component with popover — for method detail
export function CompletenessBar({ method, onEditTab }: { method: any; onEditTab?: (tab: string) => void }) {
  const [open, setOpen] = useState(false)
  const { score, breakdown } = calcBreakdown(method)

  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626'
  const bg = score >= 80 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : '#fef2f2'
  const label = score >= 80 ? 'Complete' : score >= 50 ? 'Partial' : 'Incomplete'
  const allMissing = breakdown.flatMap(b => b.missing)

  return (
    <div className="relative mb-3">
      <div
        className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none"
        style={{ background: bg, borderColor: color + '40' }}
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color }}>
              Method Completeness — {label}
              <span className="text-slate-400 font-normal text-xs">({open ? '▲' : '▼'} details)</span>
            </span>
            <span className="text-sm font-bold font-mono" style={{ color }}>{score}/100</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden ring-1 ring-black/5">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${score}%`, background: color }} />
          </div>
        </div>
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200
          rounded-xl shadow-xl z-20 overflow-hidden">
          {/* Caret */}
          <div style={{
            position:'absolute', top:'-6px', left:'20px',
            width:0, height:0,
            borderLeft:'6px solid transparent',
            borderRight:'6px solid transparent',
            borderBottom:'6px solid #e2e8f0'
          }}/>
          <div style={{
            position:'absolute', top:'-5px', left:'21px',
            width:0, height:0,
            borderLeft:'5px solid transparent',
            borderRight:'5px solid transparent',
            borderBottom:'5px solid white'
          }}/>
          {/* Category breakdown */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Score breakdown
            </p>
            <div className="space-y-2">
              {breakdown.map(b => (
                <div key={b.category} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-32 shrink-0">{b.category}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(b.earned / b.max) * 100}%`,
                        background: b.earned === b.max ? '#16a34a' : b.earned > 0 ? '#d97706' : '#e2e8f0'
                      }} />
                  </div>
                  <span className={`text-xs font-mono shrink-0 font-semibold
                    ${b.earned === b.max ? 'text-green-600' : b.earned > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                    {b.earned}/{b.max}
                  </span>
                  {b.earned === b.max && <span className="text-green-500 text-xs">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Missing fields */}
          {allMissing.length > 0 && (
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Missing fields
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allMissing.map(f => {
                  const tab = FIELD_TAB[f]
                  return (
                    <span key={f}
                      onClick={() => { if (tab && onEditTab) { onEditTab(tab); setOpen(false) } }}
                      className={`text-xs px-2 py-0.5 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200
                        ${tab && onEditTab ? 'cursor-pointer hover:bg-red-100 hover:ring-red-300 transition-all' : ''}`}
                      title={tab && onEditTab ? `Click to edit ${tab} section` : ''}>
                      {f} {tab && onEditTab ? '→' : ''}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {allMissing.length === 0 && (
            <div className="p-4 text-center text-xs text-green-600 font-medium">
              🎉 This method is 100% complete!
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CompletenessScore({ method }: { method: any }) {
  return <CompletenessBar method={method} />
}

// Section badges — replaces the score bar in method header
export function SectionBadges({ method, validationStatus }: { method: any; validationStatus?: string }) {
  const sections = [
    {
      key: 'chromatography',
      label: 'Chromatography',
      icon: '⟳',
      check: () => {
        const hasCol = method.column_name || method.column_brand
        const hasMP = method.mobile_phase_a && method.mobile_phase_b
        const hasGrad = method.gradient_steps?.length > 0
        const filled = [hasCol, hasMP, hasGrad].filter(Boolean).length
        return filled === 3 ? 'complete' : filled > 0 ? 'partial' : 'missing'
      },
      tooltip: 'Column, mobile phases and gradient program'
    },
    {
      key: 'mrm',
      label: 'MRM',
      icon: '⇌',
      check: () => {
        const quant = (method.mrm_transitions || []).filter((t: any) => !t.is_internal_standard && t.is_quantifier)
        if (quant.length === 0) return 'missing'
        const hasCE = quant.some((t: any) => t.collision_energy_ev)
        const hasRT = quant.some((t: any) => t.retention_time_min)
        return hasCE && hasRT ? 'complete' : 'partial'
      },
      tooltip: 'MRM transitions with CE and retention times'
    },
    {
      key: 'ms_source',
      label: 'MS Source',
      icon: '⚡',
      check: () => {
        const fields = [
          method.ion_spray_voltage, method.source_temperature_c, method.gas1,
          method.gas2, method.curtain_gas, method.capillary_voltage_pos_v,
          method.desolvation_temperature_c, method.capillary_voltage_v,
          method.capillary_voltage_neg_v, method.aux_gas_flow, method.sweep_gas_flow,
          method.sheath_gas_flow_lmin, method.ion_transfer_tube_temp_c,
          method.vaporizer_temp_c, method.sheath_gas_heater_c
        ]
        const filled = fields.filter(f => f !== null && f !== undefined).length
        return filled >= 3 ? 'complete' : filled > 0 ? 'partial' : 'missing'
      },
      tooltip: 'Ion source voltages, gases and temperatures'
    },
    {
      key: 'validation',
      label: 'Validation',
      icon: '✓',
      check: () => validationStatus || 'missing',
      tooltip: 'LLOQ, CV% precision and R² linearity per compound'
    },
    {
      key: 'sample_prep',
      label: 'Sample Prep',
      icon: '🧪',
      check: () => {
        const hasMethod = !!method.sample_prep_method
        const hasDetails = (method.sample_prep_details || '').length > 50
        return hasMethod && hasDetails ? 'complete' : hasMethod ? 'partial' : 'missing'
      },
      tooltip: 'Sample preparation method and detailed protocol'
    },
  ]

  type Status = 'complete' | 'partial' | 'missing'

  const styles: Record<Status, { bg: string; text: string; border: string; dot: string }> = {
    complete: { bg: 'rgba(74,222,128,0.12)', text: '#4ade80', border: 'rgba(74,222,128,0.3)', dot: '#4ade80' },
    partial:  { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)', dot: '#fbbf24' },
    missing:  { bg: 'rgba(255,255,255,0.04)', text: '#64748b', border: 'rgba(255,255,255,0.1)', dot: '#475569' },
  }

  const labels: Record<Status, string> = {
    complete: 'Complete',
    partial: 'Partial',
    missing: 'Missing',
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
      {sections.map(s => {
        const status = s.check() as Status
        const st = styles[status]
        return (
          <div key={s.key}
            title={s.tooltip}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '20px',
              background: st.bg, border: `1px solid ${st.border}`,
              cursor: 'default', fontSize: '11px', fontWeight: 500,
              color: st.text, whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: st.dot, flexShrink: 0,
              boxShadow: status === 'complete' ? `0 0 0 2px ${st.dot}30` : 'none'
            }} />
            {s.label}
            <span style={{ opacity: 0.6, fontSize: '10px' }}>
              {status === 'complete' ? '✓' : status === 'partial' ? '◑' : '○'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
