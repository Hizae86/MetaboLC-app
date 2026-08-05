import { Link } from 'react-router-dom'

interface Props {
  methods: any[]
  onClose: () => void
}

function parseLloq(val: any, unit?: string): number | null {
  if (val === null || val === undefined) return null
  const v = parseFloat(val)
  if (isNaN(v)) return null
  if (unit?.toLowerCase().includes('pg')) return v / 1000
  return v
}

const MATRIX_CLS: Record<string, string> = {
  plasma: 'bg-red-50 text-red-700',
  serum: 'bg-orange-50 text-orange-700',
  urine: 'bg-yellow-50 text-yellow-700',
  'whole blood': 'bg-red-100 text-red-800',
  'dried blood spot': 'bg-pink-50 text-pink-700',
  other: 'bg-slate-100 text-slate-500',
}

const ND = () => <span className="text-slate-300 font-mono">—</span>

export default function MethodComparator({ methods, onClose }: Props) {
  const lloqValues = methods.map(m => parseLloq(m.lloq))
  const validLloqs = lloqValues.filter(v => v !== null) as number[]
  const bestLloq = validLloqs.length ? Math.min(...validLloqs) : null

  const rows = [
    { label: 'Ionization', fn: (m: any) => m.ionization_mode },
    { label: 'Column', fn: (m: any) => m.column_name ? `${m.column_name} ${m.column_length_mm ? m.column_length_mm + '×' + m.column_diameter_mm + 'mm' : ''}` : null },
    { label: 'Particle size', fn: (m: any) => m.column_particle_size_um ? `${m.column_particle_size_um} µm` : null },
    { label: 'Phase A', fn: (m: any) => m.mobile_phase_a },
    { label: 'Phase B', fn: (m: any) => m.mobile_phase_b },
    { label: 'Sample prep', fn: (m: any) => m.sample_prep_method },
    { label: 'Inj. volume', fn: (m: any) => m.injection_volume_ul ? `${m.injection_volume_ul} µL` : null },
    { label: 'Col. temp', fn: (m: any) => m.column_temperature_c ? `${m.column_temperature_c} °C` : null },
    {
      label: 'Q1 (quant)',
      fn: (m: any) => {
        const t = m.mrm_transitions?.find((t: any) => t.is_quantifier && !t.is_internal_standard)
        return t ? `${t.precursor_mz}→${t.product_mz}` : null
      },
      mono: true, green: true
    },
    {
      label: 'Q2 (qual)',
      fn: (m: any) => {
        const t = m.mrm_transitions?.find((t: any) => !t.is_quantifier && !t.is_internal_standard)
        return t ? `${t.precursor_mz}→${t.product_mz}` : null
      },
      mono: true, amber: true
    },
    {
      label: 'RT',
      fn: (m: any) => {
        const t = m.mrm_transitions?.find((t: any) => t.is_quantifier && t.retention_time_min)
        return t ? `${t.retention_time_min} min` : null
      },
      mono: true
    },
    { label: 'CE (eV)', fn: (m: any) => {
        const t = m.mrm_transitions?.find((t: any) => t.is_quantifier && t.collision_energy_ev)
        return t ? `${t.collision_energy_ev} eV` : null
      }, mono: true },
    { label: 'LLOQ', fn: (m: any) => m.lloq ? `${m.lloq} ng/mL` : null, mono: true, isLloq: true },
    { label: 'CV intra', fn: (m: any) => m.cv_intra_percent ? `${m.cv_intra_percent}%` : null, mono: true },
    { label: 'Recovery', fn: (m: any) => m.recovery_percent ? `${m.recovery_percent}%` : null, mono: true },
    { label: 'Laboratory', fn: (m: any) => m.laboratory },
    { label: 'Country', fn: (m: any) => m.country },
    { label: 'Reference', fn: (m: any) => m.reference },
  ]

  const thStyle = "py-2.5 px-3 text-slate-400 font-medium text-xs uppercase tracking-wider text-center"

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-6xl mb-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Comparing {methods.length} methods
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {methods.map(m => m.analyte?.split(',')[0]).join(' · ')}
            </p>
          </div>
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all">
            ✕ Close
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: `${methods.length * 180 + 160}px` }}>
            <thead>
              <tr className="bg-slate-900">
                <th className="py-2.5 px-3 text-left text-slate-400 font-medium text-xs
                  uppercase tracking-wider sticky left-0 bg-slate-900 z-10 w-36">
                  Parameter
                </th>
                {methods.map(m => (
                  <th key={m.id} className={thStyle}>
                    <div className="font-medium text-white text-xs normal-case tracking-normal mb-1">
                      {m.instrument_manufacturer} {m.instrument_model}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${MATRIX_CLS[m.matrix] || MATRIX_CLS.other}`}>
                      {m.matrix}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, ri) => {
                const values = methods.map(m => row.fn(m))
                const hasAny = values.some(v => v !== null && v !== undefined)
                if (!hasAny) return null

                return (
                  <tr key={ri} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-xs font-medium text-slate-400
                      uppercase tracking-wider sticky left-0 bg-white z-10
                      border-r border-slate-100 whitespace-nowrap">
                      {row.label}
                    </td>
                    {methods.map((m, mi) => {
                      const val = values[mi]
                      const lloqNum = row.isLloq ? parseLloq(m.lloq) : null
                      const isBest = row.isLloq && lloqNum !== null && lloqNum === bestLloq

                      return (
                        <td key={mi}
                          className={`py-2 px-3 text-center
                            ${isBest ? 'bg-green-50' : ''}`}>
                          {val ? (
                            <div>
                              <span className={`text-xs
                                ${row.mono ? 'font-mono' : ''}
                                ${row.green ? 'bg-green-50 text-green-700 px-2 py-0.5 rounded-md ring-1 ring-green-200' : ''}
                                ${row.amber ? 'bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md ring-1 ring-orange-200' : ''}
                                ${!row.green && !row.amber ? 'text-slate-700' : ''}`}>
                                {val}
                              </span>
                              {isBest && (
                                <div className="flex justify-center mt-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-medium
                                    bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    🏆 Best sensitivity
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : <ND />}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* View links row */}
              <tr className="bg-slate-50">
                <td className="py-3 px-3 text-xs font-medium text-slate-400
                  uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-r border-slate-100">
                  View
                </td>
                {methods.map(m => (
                  <td key={m.id} className="py-3 px-3 text-center">
                    <Link to={`/method/${m.id}`}
                      onClick={onClose}
                      className="text-xs font-medium text-blue-500 hover:text-blue-700
                        transition-colors no-underline">
                      View method →
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
