import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import axios from 'axios'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import SEO from '../components/SEO'
import { MatrixBadge, Verified } from '@/components/method/badges'
import { Skeleton } from '@/components/ui/skeleton'
import { mz, num, withUnit } from '@/lib/format'
import { cn } from '@/lib/utils'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

type M = any

interface Row { label: string; fn: (m: M) => string | null; mono?: boolean }
interface Section { title: string; rows: Row[] }

const column = (m: M) => {
  const name = [m.column_brand, m.column_name].filter(Boolean).join(' ')
  const dims = m.column_length_mm && m.column_diameter_mm ? `${num(m.column_length_mm)}×${num(m.column_diameter_mm)} mm` : ''
  return [name, dims].filter(Boolean).join(', ') || null
}

const runTime = (m: M) => {
  const t = m.gradient_steps?.length ? Math.max(...m.gradient_steps.map((s: any) => Number(s.time_min) || 0)) : null
  return t ? `${num(t)} min` : null
}

const SECTIONS: Section[] = [
  {
    title: 'Chromatography',
    rows: [
      { label: 'Column', fn: column },
      { label: 'Stationary phase', fn: m => m.column_stationary_phase },
      { label: 'Particle size', fn: m => m.column_particle_size_um ? withUnit(m.column_particle_size_um, 'µm') : null, mono: true },
      { label: 'Column temp', fn: m => m.column_temperature_c ? withUnit(m.column_temperature_c, '°C') : null, mono: true },
      { label: 'Mobile phase A', fn: m => m.mobile_phase_a },
      { label: 'Mobile phase B', fn: m => m.mobile_phase_b },
      { label: 'Injection volume', fn: m => m.injection_volume_ul ? withUnit(m.injection_volume_ul, 'µL') : null, mono: true },
      { label: 'Run time', fn: runTime, mono: true },
      { label: 'Sample prep', fn: m => m.sample_prep_method },
    ],
  },
  {
    title: 'Mass spectrometry',
    rows: [
      { label: 'Instrument', fn: m => [m.instrument_manufacturer, m.instrument_model].filter(Boolean).join(' ') || null },
      { label: 'Ionization', fn: m => m.ionization_mode, mono: true },
      { label: 'Source temp', fn: m => m.source_temperature_c ? withUnit(m.source_temperature_c, '°C') : null, mono: true },
      { label: 'Capillary voltage', fn: m => m.capillary_voltage_v ? withUnit(m.capillary_voltage_v, 'V') : null, mono: true },
      { label: 'Transitions', fn: m => { const ts = m.mrm_transitions || []; if (!ts.length) return null; const is = ts.filter((t: any) => t.is_internal_standard).length; return `${ts.length} total` + (is ? ` · ${is} IS` : '') }, mono: true },
    ],
  },
  {
    title: 'Performance (as reported)',
    rows: [
      { label: 'LLOQ', fn: m => m.lloq != null && m.lloq !== '' ? `${num(m.lloq)} ${m.lloq_unit || 'ng/mL'}` : null, mono: true },
      { label: 'ULOQ', fn: m => m.uloq != null && m.uloq !== '' ? `${num(m.uloq)} ${m.lloq_unit || 'ng/mL'}` : null, mono: true },
      { label: 'CV intra-assay', fn: m => m.cv_intra_percent ? withUnit(m.cv_intra_percent, '%') : null, mono: true },
      { label: 'CV inter-assay', fn: m => m.cv_inter_percent ? withUnit(m.cv_inter_percent, '%') : null, mono: true },
      { label: 'Recovery', fn: m => m.recovery_percent ? withUnit(m.recovery_percent, '%') : null, mono: true },
    ],
  },
  {
    title: 'Provenance',
    rows: [
      { label: 'Source', fn: m => m.source_type },
      { label: 'Authors', fn: m => m.source_authors },
      { label: 'Reference', fn: m => m.reference },
      { label: 'Contributed by', fn: m => m.submitted_by },
      { label: 'Status', fn: m => m.status },
    ],
  },
]

/** Points for the gradient overlay; "step" segments drawn as true steps. */
function gradientPoints(m: M): { t: number; b: number }[] {
  const steps = m.gradient_steps || []
  const pts: { t: number; b: number }[] = []
  steps.forEach((s: any, i: number) => {
    if (i > 0 && s.curve === 'step') pts.push({ t: Number(s.time_min), b: Number(steps[i - 1].percent_b) })
    pts.push({ t: Number(s.time_min), b: Number(s.percent_b) })
  })
  return pts
}

const normName = (s: string) => s.trim().toLowerCase()

export default function Compare() {
  const [sp, setSp] = useSearchParams()
  const ids = useMemo(() => [...new Set((sp.get('ids') || '').split(',').map(s => parseInt(s, 10)).filter(n => n > 0))].slice(0, 4), [sp])
  const [methods, setMethods] = useState<M[] | null>(null)
  const [error, setError] = useState(false)
  const [onlyDiff, setOnlyDiff] = useState(false)

  useEffect(() => {
    if (ids.length === 0) { setMethods([]); return }
    setMethods(null); setError(false)
    Promise.all(ids.map(id => axios.get(`${API}/methods/${id}`).then(r => r.data)))
      .then(setMethods).catch(() => setError(true))
  }, [ids.join(',')])

  const remove = (id: number) => {
    const next = ids.filter(i => i !== id)
    setSp(next.length ? { ids: next.join(',') } : {}, { replace: true })
  }

  // Analytes present in every method, via their quantifier transitions.
  const shared = useMemo(() => {
    if (!methods || methods.length < 2) return []
    const perMethod = methods.map(m => {
      const map = new Map<string, any>()
      m.mrm_transitions?.forEach((t: any) => {
        if (!t.is_internal_standard && t.compound_name && (t.is_quantifier || !map.has(normName(t.compound_name))))
          if (t.is_quantifier || !map.get(normName(t.compound_name))?.is_quantifier)
            map.set(normName(t.compound_name), t)
      })
      return map
    })
    const names = [...perMethod[0].keys()].filter(n => perMethod.every(map => map.has(n)))
    return names.map(n => ({
      name: perMethod[0].get(n).compound_name as string,
      per: perMethod.map(map => map.get(n)),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [methods])

  // Best LLOQ is only meaningful when the methods measure the same thing in the same matrix.
  const sameTarget = useMemo(() => {
    if (!methods || methods.length < 2) return false
    const key = (m: M) => `${normName(m.analyte || '')}|${normName(m.matrix || '')}`
    return new Set(methods.map(key)).size === 1 && !!methods[0].analyte
  }, [methods])
  const bestLloq = useMemo(() => {
    if (!sameTarget || !methods) return null
    const sameUnit = new Set(methods.map(m => m.lloq_unit || 'ng/mL')).size === 1
    const vals = methods.map(m => parseFloat(m.lloq)).filter(v => !isNaN(v))
    return sameUnit && vals.length >= 2 ? Math.min(...vals) : null
  }, [methods, sameTarget])

  const gradients = useMemo(() => (methods || []).map(gradientPoints), [methods])
  const hasGradients = gradients.filter(g => g.length > 1).length >= 2

  if (ids.length < 2) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">Nothing to compare yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pick 2–4 methods in the explorer and hit “Compare”.</p>
      <Link to="/methods" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><ArrowLeft size={14} /> Browse methods</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <SEO title={`Comparing ${ids.length} methods`} description="Side-by-side comparison of clinical LC-MS/MS methods." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Compare methods</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Differences are highlighted. This page's URL is shareable.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} className="accent-[var(--primary)]" />
          Only differences
        </label>
        <Link to="/methods" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Explorer</Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Couldn't load one of the methods. It may have been removed.</div>
      ) : !methods ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${methods.length * 200 + 170}px` }}>
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 w-40 bg-card px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Parameter</th>
                {methods.map((m, i) => (
                  <th key={m.id} className="px-3 py-3 text-left align-top font-normal" style={{ borderTop: `2px solid ${COLORS[i]}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/method/${m.id}`} className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary" title={m.title}>{m.title || m.analyte}</Link>
                      <button type="button" onClick={() => remove(m.id)} aria-label="Remove from comparison" className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X size={13} /></button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <MatrixBadge matrix={m.matrix} />
                      {m.status === 'verified' && <Verified />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(sec => {
                const rows = sec.rows
                  .map(row => ({ row, values: methods.map(m => row.fn(m)) }))
                  .filter(({ values }) => values.some(v => v))
                  .map(r => ({ ...r, differs: new Set(r.values.map(v => v ?? '—')).size > 1 }))
                  .filter(r => !onlyDiff || r.differs)
                if (rows.length === 0) return null
                return (
                  <SectionRows key={sec.title} title={sec.title} rows={rows} methods={methods} bestLloq={bestLloq} />
                )
              })}
            </tbody>
          </table>
        </div>

        {!sameTarget && methods.some(m => m.lloq) && (
          <p className="mt-2 text-xs text-muted-foreground">LLOQ and CV figures are shown as reported; they are only directly comparable between methods for the same analyte and matrix.</p>
        )}

        {hasGradients && (
          <section className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Gradient overlay</h2>
            <p className="mb-3 text-xs text-muted-foreground">%B vs. time. One line per method.</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} unit=" min"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                    contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--popover-foreground)' }}
                    labelFormatter={t => `${num(t, 2)} min`} formatter={(v: any) => [`${num(v, 1)}% B`]} />
                  {methods.map((m, i) => gradients[i].length > 1 && (
                    <Line key={m.id} data={gradients[i]} dataKey="b" name={m.title || `Method ${m.id}`} type="linear"
                      stroke={COLORS[i]} strokeWidth={2} dot={{ r: 2, fill: COLORS[i], strokeWidth: 0 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {methods.map((m, i) => gradients[i].length > 1 && (
                <span key={m.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-0.5 w-4 rounded" style={{ background: COLORS[i] }} /> {m.title || `Method ${m.id}`}
                </span>
              ))}
            </div>
          </section>
        )}

        {shared.length > 0 && (
          <section className="mt-6 overflow-x-auto rounded-lg border border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-2.5">
              <h2 className="text-sm font-semibold text-foreground">Shared analytes <span className="num font-normal text-muted-foreground">({shared.length})</span></h2>
              <p className="text-xs text-muted-foreground">Quantifier transition, collision energy and retention time per method.</p>
            </div>
            <table className="w-full border-collapse text-sm" style={{ minWidth: `${methods.length * 200 + 170}px` }}>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="sticky left-0 z-10 w-40 bg-card px-3 py-2 text-left font-medium">Analyte</th>
                  {methods.map((m, i) => (
                    <th key={m.id} className="px-3 py-2 text-left font-medium normal-case tracking-normal">
                      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: COLORS[i] }} />{m.instrument_manufacturer || `Method ${m.id}`}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shared.map(({ name, per }) => (
                  <tr key={name} className="hover:bg-accent/50">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium text-foreground">{name}</td>
                    {per.map((t, i) => (
                      <td key={i} className="px-3 py-2">
                        <div className="num text-foreground">{mz(t.precursor_mz)} → {mz(t.product_mz)}</div>
                        <div className="num mt-0.5 text-xs text-muted-foreground">
                          {t.collision_energy_ev != null && <>CE {num(t.collision_energy_ev)} · </>}
                          {t.retention_time_min != null ? <>RT {num(t.retention_time_min, 2)} min</> : 'RT —'}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        </>
      )}
    </div>
  )
}

function SectionRows({ title, rows, methods, bestLloq }: {
  title: string
  rows: { row: Row; values: (string | null)[]; differs: boolean }[]
  methods: M[]
  bestLloq: number | null
}) {
  return (
    <>
      <tr className="border-y border-border bg-muted/30">
        <td colSpan={methods.length + 1} className="sticky left-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</td>
      </tr>
      {rows.map(({ row, values, differs }) => (
        <tr key={row.label} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
          <td className="sticky left-0 z-10 w-40 bg-card px-3 py-2 text-xs text-muted-foreground">{row.label}</td>
          {values.map((v, i) => {
            const isBest = row.label === 'LLOQ' && bestLloq != null && parseFloat(methods[i].lloq) === bestLloq
            return (
              <td key={i} className={cn('px-3 py-2', differs && 'bg-warning/[0.06]')}>
                <span className={cn(row.mono && 'num', v ? 'text-foreground' : 'text-muted-foreground')}>{v || '—'}</span>
                {isBest && <span className="ml-2 rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-medium text-success">lowest</span>}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
