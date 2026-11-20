import { useState, type CSSProperties } from 'react'

/* Method completeness is computed once, in the backend (backend/completeness.py), and arrives on
   the method as `completeness` (score, band, sections with earned/max/missing) plus
   `completeness_score`. This file only displays it. */

type Status = 'complete' | 'partial' | 'missing'
export type Band = 'ready' | 'partial' | 'reference'

interface Section { key: string; label: string; earned: number; max: number; status: Status; missing: string[] }
interface Completeness { score: number; raw_score: number; band: Band; capped_by: string[]; sections: Section[] }

export const BAND_MIN = { ready: 85, partial: 60 }

export function bandOf(score: number): Band {
  return score >= BAND_MIN.ready ? 'ready' : score >= BAND_MIN.partial ? 'partial' : 'reference'
}

export const BAND_TEXT: Record<Band, { label: string; meaning: string; color: string }> = {
  ready: {
    label: 'Ready to run', color: 'var(--success)',
    meaning: 'Everything needed to program the instrument and run the assay is here.',
  },
  partial: {
    label: 'Partially usable', color: 'var(--warning)',
    meaning: 'The MS and chromatography core is here; a secondary parameter is missing.',
  },
  reference: {
    label: 'Reference only', color: 'var(--destructive)',
    meaning: 'Transitions or critical chromatographic conditions are missing; useful as a literature pointer.',
  },
}

// Compact badge for method cards
export function CompletenesBadge({ score }: { score: number }) {
  const band = bandOf(score)
  const tone = band === 'ready' ? 'bg-green-50 text-green-700 ring-green-200'
    : band === 'partial' ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-red-50 text-red-600 ring-red-200'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${tone}`} title={BAND_TEXT[band].meaning}>
      {score}% · {BAND_TEXT[band].label}
    </span>
  )
}

// Map a section to the edit-dialog tab
const SECTION_TAB: Record<string, string> = {
  mrm: 'mrm', chromatography: 'chromatography', ms_source: 'ms', sample_prep: 'sample', validation: 'validation', source: 'basic',
}

// Full bar with breakdown popover
export function CompletenessBar({ method, onEditTab }: { method: any; onEditTab?: (tab: string) => void }) {
  const [open, setOpen] = useState(false)
  const c: Completeness | undefined = method?.completeness
  if (!c) return null
  const band = BAND_TEXT[c.band]

  return (
    <div className="relative mb-3">
      <div className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none"
        style={{ borderColor: `color-mix(in srgb, ${band.color} 35%, transparent)`, background: `color-mix(in srgb, ${band.color} 8%, transparent)` }}
        onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: band.color }}>
              {band.label} <span className="text-slate-400 font-normal">({open ? '▲' : '▼'} details)</span>
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: band.color }}>{c.score}/100</span>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden ring-1 ring-black/5">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.score}%`, background: band.color }} />
          </div>
        </div>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-4 space-y-2">
          <p className="text-xs text-slate-500">{band.meaning}</p>
          {c.capped_by.length > 0 && (
            <p className="text-xs text-amber-700">Capped at {c.score} because: {c.capped_by.join('; ')}.</p>
          )}
          {c.sections.map(s => (
            <div key={s.key} className="flex items-start gap-3">
              <span className="text-xs text-slate-600 w-36 shrink-0">{s.label}</span>
              <span className="text-xs font-mono w-12 shrink-0">{s.earned}/{s.max}</span>
              <span className="flex flex-wrap gap-1">
                {s.missing.map(f => (
                  <span key={f}
                    onClick={() => { if (onEditTab && SECTION_TAB[s.key]) { onEditTab(SECTION_TAB[s.key]); setOpen(false) } }}
                    className={`text-xs px-2 py-0.5 rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200 ${onEditTab ? 'cursor-pointer hover:bg-red-100' : ''}`}>
                    {f}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CompletenessScore({ method }: { method: any }) {
  return <CompletenessBar method={method} />
}

const STYLES: Record<Status, { bg: string; text: string; border: string; dot: string }> = {
  complete: { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', text: 'var(--success)', border: 'color-mix(in srgb, var(--success) 35%, transparent)', dot: 'var(--success)' },
  partial: { bg: 'color-mix(in srgb, var(--warning) 12%, transparent)', text: 'var(--warning)', border: 'color-mix(in srgb, var(--warning) 35%, transparent)', dot: 'var(--warning)' },
  missing: { bg: 'var(--muted)', text: 'var(--muted-foreground)', border: 'var(--border)', dot: 'var(--muted-foreground)' },
}

const pill: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px',
  cursor: 'default', fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap',
}

// Overall band + one chip per section, shown in the method header
export function SectionBadges({ method }: { method: any; validationStatus?: string }) {
  const c: Completeness | undefined = method?.completeness
  if (!c) return null
  const band = BAND_TEXT[c.band]
  const bandTitle = `${band.meaning}${c.capped_by.length ? `\nCapped: ${c.capped_by.join('; ')}` : ''}`

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
      <span title={bandTitle} style={{
        ...pill, fontWeight: 600, color: band.color,
        background: `color-mix(in srgb, ${band.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${band.color} 35%, transparent)`,
      }}>
        <span className="num">{c.score}%</span> · {band.label}
      </span>
      {c.sections.map(s => {
        const st = STYLES[s.status]
        const title = `${s.label}: ${s.earned}/${s.max}` + (s.missing.length ? `\nMissing: ${s.missing.join(', ')}` : '')
        return (
          <span key={s.key} title={title} style={{ ...pill, background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
            {s.label}
            <span style={{ opacity: 0.6, fontSize: '10px' }}>{s.status === 'complete' ? '✓' : s.status === 'partial' ? '◑' : '○'}</span>
          </span>
        )
      })}
    </div>
  )
}
