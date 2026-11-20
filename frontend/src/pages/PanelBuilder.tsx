import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Download, FlaskConical, Layers, Plus, Search, Trash2, X } from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Verified } from '@/components/method/badges'
import { API, searchMethods, type MethodHit } from '@/lib/api'
import { mz } from '@/lib/format'
import {
  alternatives, dwellFor, family, findConflicts, polarityOf, uid,
  type DwellSettings, type PanelRow, type Polarity, type Role, type TransitionOption,
} from '@/lib/panel'
import { cn } from '@/lib/utils'

interface Compound { name: string; normalized: string; method_count: number; verified_count: number; polarity: string | null }
interface ExportFormat { key: string; label: string; software: string; extension: string; status: string; tested_in: string | null }

const STORE = 'koine_panel_v1'
// Example values only: every instrument is different, so they are shown as editable fields.
const DEFAULT_SETTINGS: DwellSettings = { peakWidthS: 6, pointsPerPeak: 12, delayMs: 3, switchMs: 20, minDwellMs: 5 }

interface Saved { name: string; rows: PanelRow[]; settings: DwellSettings; tol: number }
const load = (): Saved | null => { try { const s = localStorage.getItem(STORE); return s ? JSON.parse(s) : null } catch { return null } }

const cell = 'px-3 py-2 text-sm'
const numCls = 'num tabular-nums'

export default function PanelBuilder() {
  const saved = useRef(load()).current
  const [name, setName] = useState(saved?.name ?? 'My panel')
  const [rows, setRows] = useState<PanelRow[]>(saved?.rows ?? [])
  const [settings, setSettings] = useState<DwellSettings>(saved?.settings ?? DEFAULT_SETTINGS)
  const [tol, setTol] = useState(saved?.tol ?? 0.5)
  const [options, setOptions] = useState<Record<string, TransitionOption[]>>({})
  const [mode, setMode] = useState<'analytes' | 'method' | 'manual'>('analytes')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ name, rows, settings, tol })) } catch { /* private mode: the panel lasts for this visit only */ }
  }, [name, rows, settings, tol])

  /** null = the request failed (not "no transitions"), so the caller can say why nothing happened. */
  const loadOptions = async (key: string, name?: string): Promise<TransitionOption[] | null> => {
    if (options[key]) return options[key]
    try {
      const r = await axios.get<{ options: TransitionOption[] }>(`${API}/tools/panel/options`, { params: { key, name } })
      setOptions(o => ({ ...o, [key]: r.data.options }))
      return r.data.options
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 404 && err?.response?.data?.detail === 'No transitions for this analyte.') {
        setOptions(o => ({ ...o, [key]: [] })); return []
      }
      setNotice(status === 404
        ? 'The server does not know the panel builder yet. Restart the backend (uvicorn) and try again.'
        : 'The transitions could not be loaded. Check that the backend is running and try again.')
      return null
    }
  }
  // Options are needed to suggest alternatives; fetch them for every analyte in the panel.
  useEffect(() => {
    const seen = new Set<string>()
    rows.forEach(r => { if (r.key && !seen.has(r.key)) { seen.add(r.key); if (!options[r.key]) loadOptions(r.key, r.compound) } })
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const fromOption = (compound: string, key: string, o: TransitionOption, role: Role): PanelRow => ({
    uid: uid(), compound, key, role, polarity: o.polarity, q1: o.q1, q3: o.q3,
    ce: o.source.ce ?? o.collision_energies[0] ?? null, cone_voltage: o.source.cone_voltage,
    declustering_potential: o.source.declustering_potential, cell_exit_potential: o.source.cell_exit_potential,
    sourceId: o.source.method_id,
  })

  const addAnalyte = async (c: Compound) => {
    if (rows.some(r => family(r) === c.name.trim().toLowerCase())) return
    setNotice(null)
    const opts = await loadOptions(c.normalized, c.name)
    if (opts === null) return
    const quant = opts.find(o => o.role === 'Quant') ?? opts[0]
    if (!quant) { setNotice(`The library has no transitions for ${c.name}. You can type one yourself.`); return }
    const qual = opts.find(o => o !== quant && o.polarity === quant.polarity && Math.abs(o.q3 - quant.q3) > 0.05)
    setRows(rs => [...rs, fromOption(c.name, c.normalized, quant, 'Quant'), ...(qual ? [fromOption(c.name, c.normalized, qual, 'Qual')] : [])])
  }

  const replace = (row: PanelRow, o: TransitionOption) => setRows(rs => rs.map(r => r.uid === row.uid
    ? { ...fromOption(r.compound, r.key!, o, r.role), uid: r.uid } : r))
  const remove = (u: string) => setRows(rs => rs.filter(r => r.uid !== u))
  const removeCompound = (f: string) => setRows(rs => rs.filter(r => family(r) !== f))
  const setRole = (u: string, role: Role) => setRows(rs => rs.map(r => (r.uid === u ? { ...r, role } : r)))

  const conflicts = useMemo(() => findConflicts(rows, tol), [rows, tol])
  const conflictUids = useMemo(() => new Set(conflicts.flatMap(c => [c.a.uid, c.b.uid])), [conflicts])
  const dwell = useMemo(() => dwellFor(rows, settings), [rows, settings])

  const groups = useMemo(() => {
    const m = new Map<string, PanelRow[]>()
    rows.forEach(r => { const f = family(r); m.set(f, [...(m.get(f) ?? []), r]) })
    return [...m.values()]
  }, [rows])

  return (
    <>
      <SEO title="Panel builder — combine LC-MS/MS transitions and check isobaric conflicts"
        description="Pick the analytes you want to measure together, take their MRM transitions from the library, find isobaric conflicts, estimate dwell times and export the transition table." />
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="label-caps text-primary">Library</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Layers className="text-primary" size={26} /> Panel builder
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Pick the analytes you want to measure together, or start from a method and keep the ones you need. Koiné takes their transitions from the library, flags isobaric conflicts and estimates the dwell time.
          </p>
        </header>

        {/* 1 · Add */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm sm:w-fit" role="tablist">
            {([['analytes', 'Add analytes', FlaskConical], ['method', 'Start from a method', BookOpen], ['manual', 'Type a transition', Plus]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
                  mode === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          {notice && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" /> {notice}
              <button type="button" onClick={() => setNotice(null)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Dismiss"><X size={14} /></button>
            </p>
          )}
          <div className="mt-4">
            {mode === 'analytes' && <AnalytePicker onPick={addAnalyte} inPanel={new Set(rows.map(family))} />}
            {mode === 'method' && <MethodPicker onAdd={add => setRows(rs => [...rs, ...add.filter(a => !rs.some(r => family(r) === family(a) && r.q1 === a.q1 && r.q3 === a.q3))])} />}
            {mode === 'manual' && <ManualRow onAdd={r => setRows(rs => [...rs, r])} />}
          </div>
        </section>

        {/* 2 · Panel */}
        <section className="rounded-xl border border-border bg-card" aria-labelledby="panel-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <h2 id="panel-title" className="text-sm font-semibold text-foreground">
              Panel · <span className="num">{groups.length}</span> compounds, <span className="num">{rows.length}</span> transitions
            </h2>
            {rows.length > 0 && (
              <button type="button" onClick={() => setRows([])} className="text-xs text-muted-foreground hover:text-destructive">Clear panel</button>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Add analytes or start from a method to build your panel.</p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className={cell}>Compound</th><th className={cell}>Role</th><th className={cell}>Pol.</th>
                    <th className={cn(cell, 'text-right')}>Q1</th><th className={cn(cell, 'text-right')}>Q3</th><th className={cn(cell, 'text-right')}>CE</th>
                    <th className={cell}>Transition</th><th className={cell} />
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => g.map((r, i) => {
                    const opts = r.key ? options[r.key] ?? [] : []
                    const current = opts.find(o => Math.abs(o.q1 - r.q1) < 0.05 && Math.abs(o.q3 - r.q3) < 0.05 && o.polarity === r.polarity)
                    return (
                      <tr key={r.uid} className={cn('border-b border-border last:border-0', conflictUids.has(r.uid) && 'bg-destructive/5')}>
                        <td className={cn(cell, 'font-medium text-foreground')}>
                          {i === 0 && (
                            <span className="flex items-center gap-2">
                              {r.compound}
                              <button type="button" onClick={() => removeCompound(family(r))} title={`Remove ${r.compound}`} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                            </span>
                          )}
                        </td>
                        <td className={cell}>
                          {r.role === 'IS'
                            ? <span className="rounded bg-muted px-1.5 py-px text-xs">IS</span>
                            : <select value={r.role} onChange={e => setRole(r.uid, e.target.value as Role)} aria-label="Role"
                                className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs text-foreground">
                                <option>Quant</option><option>Qual</option>
                              </select>}
                        </td>
                        <td className={cn(cell, numCls)}>{r.polarity}</td>
                        <td className={cn(cell, numCls, 'text-right')}>{mz(r.q1)}</td>
                        <td className={cn(cell, numCls, 'text-right')}>{mz(r.q3)}</td>
                        <td className={cn(cell, numCls, 'text-right text-muted-foreground')}>{r.ce ?? '—'}</td>
                        <td className={cell}>
                          {opts.length > 1 ? (
                            <select aria-label={`Transition for ${r.compound}`} value={current ? opts.indexOf(current) : ''}
                              onChange={e => replace(r, opts[Number(e.target.value)])}
                              className="max-w-[260px] rounded-md border border-input bg-background px-1.5 py-0.5 text-xs text-foreground">
                              {!current && <option value="">Custom</option>}
                              {opts.map((o, k) => (
                                <option key={k} value={k}>{mz(o.q1)} → {mz(o.q3)} ({o.polarity}) · {o.method_count} method{o.method_count === 1 ? '' : 's'}{o.verified_count ? `, ${o.verified_count} verified` : ''}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-muted-foreground">{current ? `${current.method_count} method${current.method_count === 1 ? '' : 's'}` : r.sourceId ? 'From the method' : 'Typed by you'}</span>
                          )}
                          {r.sourceId && <Link to={`/method/${r.sourceId}`} className="ml-2 text-xs text-primary hover:underline">source</Link>}
                        </td>
                        <td className={cn(cell, 'text-right')}>
                          <button type="button" onClick={() => remove(r.uid)} title="Remove this transition" className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    )
                  }))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {rows.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 3 · Conflicts */}
            <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="conflicts-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="conflicts-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {conflicts.length ? <AlertTriangle size={16} className="text-destructive" /> : <CheckCircle2 size={16} className="text-success" />}
                  Isobaric conflicts
                </h2>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">Tolerance ±
                  <Input type="number" step="0.1" min="0.05" max="2" value={tol} onChange={e => setTol(Math.max(0.05, Number(e.target.value) || 0.5))} className="h-7 w-16 text-xs" /> m/z
                </label>
              </div>
              {conflicts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No two compounds share a Q1 and Q3 within ±{tol} m/z in the same polarity.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {conflicts.map(c => {
                    const fixes = [c.a, c.b].map(r => ({ r, alt: r.key ? alternatives(r, options[r.key] ?? [], rows, tol)[0] : undefined })).filter(f => f.alt)
                    return (
                      <li key={c.a.uid + c.b.uid} className={cn('rounded-lg border p-3 text-sm', c.severe ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5')}>
                        <p className="font-medium text-foreground">
                          {c.a.compound} <span className="text-muted-foreground">({c.a.role})</span> and {c.b.compound} <span className="text-muted-foreground">({c.b.role})</span>
                        </p>
                        <p className="num mt-0.5 text-xs text-muted-foreground">{mz(c.a.q1)} → {mz(c.a.q3)} and {mz(c.b.q1)} → {mz(c.b.q3)} ({c.a.polarity})</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.severe ? 'Same Q1 and Q3: they can only be told apart if they are separated chromatographically.' : 'Two qualifiers clash: the ion ratio can be affected unless they are separated chromatographically.'}
                        </p>
                        {fixes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {fixes.map(({ r, alt }) => (
                              <Button key={r.uid} size="sm" variant="outline" onClick={() => replace(r, alt!)}>
                                Use {mz(alt!.q1)} → {mz(alt!.q3)} for {r.compound}
                              </Button>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* 4 · Dwell time */}
            <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="dwell-title">
              <h2 id="dwell-title" className="text-sm font-semibold text-foreground">Dwell time</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Example values: set them for your instrument.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {([
                  ['peakWidthS', 'Peak width', 's'], ['pointsPerPeak', 'Points per peak', ''], ['minDwellMs', 'Minimum dwell', 'ms'],
                  ['delayMs', 'Inter-channel delay', 'ms'], ['switchMs', 'Polarity switch', 'ms'],
                ] as const).map(([k, label, unit]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">{label}{unit && ` (${unit})`}</span>
                    <Input type="number" min="0" step="any" value={settings[k]}
                      onChange={e => setSettings(s => ({ ...s, [k]: Math.max(0, Number(e.target.value) || 0) }))} className="h-8" />
                  </label>
                ))}
              </div>
              {dwell && (
                <div className={cn('mt-4 rounded-lg border p-3', dwell.ok ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5')}>
                  <p className="text-sm text-foreground">
                    <span className="num text-2xl font-semibold">{dwell.dwellMs > 0 ? dwell.dwellMs.toFixed(1) : '0'}</span> ms per transition
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="num">{dwell.n}</span> transitions{dwell.switching && <> (<span className="num">{dwell.nPos}</span> positive, <span className="num">{dwell.nNeg}</span> negative, polarity switching)</>}, cycle time <span className="num">{dwell.cycleMs.toFixed(0)}</span> ms for <span className="num">{settings.pointsPerPeak}</span> points across a <span className="num">{settings.peakWidthS}</span> s peak.
                  </p>
                  {!dwell.ok && (
                    <p className="mt-1 text-xs font-medium text-destructive">
                      Below the minimum dwell. With {settings.minDwellMs} ms you would get about <span className="num">{dwell.pointsAtMinDwell.toFixed(1)}</span> points per peak: remove transitions, accept fewer points, or use scheduled MRM.
                    </p>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Assumes every transition is acquired for the whole run. Scheduled MRM in your instrument software gives each transition more time.
              </p>
            </section>
          </div>
        )}

        {rows.length > 0 && <ExportBox name={name} setName={setName} rows={rows} dwellMs={dwell && dwell.dwellMs > 0 ? Math.round(dwell.dwellMs * 10) / 10 : null} />}

        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">A new panel has to be validated before it is used. Koiné Validate designs the experiments and prepares the dossier.</p>
          <Link to="/validation" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/45 px-3.5 py-2 text-sm font-semibold text-primary no-underline hover:bg-primary/10">
            Validate this panel <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </>
  )
}

function AnalytePicker({ onPick, inPanel }: { onPick: (c: Compound) => Promise<void>; inPanel: Set<string> }) {
  const [all, setAll] = useState<Compound[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    axios.get<Compound[]>(`${API}/methods/compounds`).then(r => {
      // The index can list an analyte twice (with and without a PubChem CID): one entry per name.
      const byName = new Map<string, Compound>()
      r.data.forEach(c => {
        const k = c.name.trim().toLowerCase(), prev = byName.get(k)
        if (!prev) byName.set(k, { ...c })
        else byName.set(k, { ...prev, normalized: /^\d+$/.test(prev.normalized) ? prev.normalized : c.normalized, method_count: prev.method_count + c.method_count })
      })
      setAll([...byName.values()].sort((x, y) => y.method_count - x.method_count))
    }).catch(() => { setAll([]); setFailed(true) })
  }, [])
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!all || s.length < 2) return []
    // Exact name first, then names that start with the text, then the rest
    const rank = (c: Compound) => { const n = c.name.toLowerCase(); return n === s ? 0 : n.startsWith(s) ? 1 : 2 }
    return all.filter(c => c.name.toLowerCase().includes(s)).sort((x, y) => rank(x) - rank(y)).slice(0, 8)
  }, [all, q])
  useEffect(() => setActive(0), [q])
  const pick = async (c: Compound | undefined) => {
    if (!c || inPanel.has(c.name.trim().toLowerCase())) return
    setBusy(c.normalized); await onPick(c); setBusy(null); setQ('')
  }
  return (
    <div className="max-w-xl">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Analyte name, e.g. tacrolimus" className="pl-9" aria-label="Search analytes"
          role="combobox" aria-expanded={hits.length > 0} aria-controls="analyte-hits" aria-autocomplete="list"
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); pick(hits[active]) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, hits.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
            else if (e.key === 'Escape') setQ('')
          }} />
      </div>
      {hits.length > 0 && (
        <ul id="analyte-hits" role="listbox" className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {hits.map((c, i) => {
            const added = inPanel.has(c.name.trim().toLowerCase())
            return (
              <li key={c.normalized} role="option" aria-selected={i === active}>
                <button type="button" disabled={added || busy === c.normalized} onMouseEnter={() => setActive(i)} onClick={() => pick(c)}
                  className={cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:opacity-60', i === active ? 'bg-accent' : 'hover:bg-accent')}>
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{added ? 'In the panel' : busy === c.normalized ? 'Adding…' : `${c.method_count} method${c.method_count === 1 ? '' : 's'}`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {hits.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Press Enter to add the highlighted analyte, or click one.</p>}
      {failed && <p role="alert" className="mt-2 text-xs text-destructive">The analyte list could not be loaded. Is the backend running?</p>}
      {all && !failed && q.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Not in the library. You can type its transition yourself.</p>}
      {all === null && q.trim().length >= 2 && <p className="mt-2 text-xs text-muted-foreground">Loading the analyte list…</p>}
    </div>
  )
}

interface MethodTransition {
  compound_name: string; is_internal_standard: boolean | number; is_quantifier: boolean | number
  precursor_mz: number | null; product_mz: number | null; collision_energy_ev: number | null; polarity: string | null
  cone_voltage?: number | null; declustering_potential?: number | null; cell_exit_potential?: number | null; pubchem_cid?: number | null
}

function MethodPicker({ onAdd }: { onAdd: (rows: PanelRow[]) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MethodHit[]>([])
  const [method, setMethod] = useState<{ id: number; title: string; status: string; ionization_mode: string | null; mrm_transitions: MethodTransition[] } | null>(null)
  const [keep, setKeep] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const ctl = new AbortController()
    const t = setTimeout(() => searchMethods(new URLSearchParams({ q: q.trim(), limit: '8' }), ctl.signal).then(r => setHits(r.items)).catch(() => {}), 250)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])
  const pick = async (id: number) => {
    const r = await axios.get(`${API}/methods/${id}`)
    setMethod(r.data); setHits([]); setQ('')
    setKeep(new Set((r.data.mrm_transitions as MethodTransition[]).map(t => t.compound_name.trim())))
  }
  const compounds = useMemo(() => {
    if (!method) return []
    const m = new Map<string, { name: string; is: boolean; n: number }>()
    method.mrm_transitions.forEach(t => {
      const k = t.compound_name.trim()
      const e = m.get(k) ?? { name: k, is: !!t.is_internal_standard, n: 0 }
      e.n += 1; m.set(k, e)
    })
    return [...m.values()].sort((a, b) => Number(a.is) - Number(b.is) || a.name.localeCompare(b.name))
  }, [method])
  const toggle = (n: string) => setKeep(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x })
  const add = () => {
    if (!method) return
    onAdd(method.mrm_transitions
      .filter(t => keep.has(t.compound_name.trim()) && t.precursor_mz != null && t.product_mz != null)
      .map(t => ({
        uid: uid(), compound: t.compound_name.trim(),
        key: t.is_internal_standard ? null : (t.pubchem_cid && t.pubchem_cid > 0 ? String(t.pubchem_cid) : t.compound_name.trim().toLowerCase()),
        role: t.is_internal_standard ? 'IS' : t.is_quantifier ? 'Quant' : 'Qual',
        polarity: polarityOf(t.polarity, method.ionization_mode), q1: Number(t.precursor_mz), q3: Number(t.product_mz),
        ce: t.collision_energy_ev, cone_voltage: t.cone_voltage, declustering_potential: t.declustering_potential,
        cell_exit_potential: t.cell_exit_potential, sourceId: method.id,
      })))
    setMethod(null)
  }
  const nAnalytes = compounds.filter(c => !c.is && keep.has(c.name)).length
  return (
    <div>
      {!method && (
        <div className="max-w-xl">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Method title, analyte or matrix" className="pl-9" aria-label="Search methods"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) pick(hits[0].id) } }} />
          </div>
          {hits.length > 0 && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {hits.map(h => (
                <li key={h.id}>
                  <button type="button" onClick={() => pick(h.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                    {h.status === 'verified' && <Verified className="shrink-0" />}
                    <span className="min-w-0 flex-1 truncate text-foreground">{h.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {method && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground"><span className="text-muted-foreground">Keep the compounds you need from</span> {method.title}</p>
            <div className="flex gap-3 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => setKeep(new Set(compounds.map(c => c.name)))}>All</button>
              <button type="button" className="text-primary hover:underline" onClick={() => setKeep(new Set())}>None</button>
            </div>
          </div>
          <div className="mt-3 grid max-h-72 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
            {compounds.map(c => (
              <label key={c.name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                <input type="checkbox" checked={keep.has(c.name)} onChange={() => toggle(c.name)} />
                <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                {c.is && <span className="rounded bg-muted px-1 text-[10px]">IS</span>}
                <span className="num text-xs text-muted-foreground">{c.n}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={add} disabled={keep.size === 0}>Add {nAnalytes} analyte{nAnalytes === 1 ? '' : 's'}{keep.size - nAnalytes > 0 ? ` and ${keep.size - nAnalytes} IS` : ''}</Button>
            <Button size="sm" variant="outline" onClick={() => setMethod(null)}>Choose another method</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManualRow({ onAdd }: { onAdd: (r: PanelRow) => void }) {
  const [f, setF] = useState({ compound: '', q1: '', q3: '', ce: '', role: 'Quant' as Role, polarity: '+' as Polarity })
  const ok = f.compound.trim() && Number(f.q1) > 0 && Number(f.q3) > 0
  return (
    <form className="grid max-w-3xl grid-cols-2 items-end gap-3 sm:grid-cols-6"
      onSubmit={e => {
        e.preventDefault(); if (!ok) return
        onAdd({ uid: uid(), compound: f.compound.trim(), key: null, role: f.role, polarity: f.polarity, q1: Number(f.q1), q3: Number(f.q3), ce: f.ce ? Number(f.ce) : null, sourceId: null })
        setF(x => ({ ...x, q1: '', q3: '', ce: '' }))
      }}>
      <label className="col-span-2 block"><span className="mb-1 block text-xs text-muted-foreground">Compound</span>
        <Input value={f.compound} onChange={e => setF({ ...f, compound: e.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Q1</span>
        <Input type="number" step="any" value={f.q1} onChange={e => setF({ ...f, q1: e.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Q3</span>
        <Input type="number" step="any" value={f.q3} onChange={e => setF({ ...f, q3: e.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-xs text-muted-foreground">CE (optional)</span>
        <Input type="number" step="any" value={f.ce} onChange={e => setF({ ...f, ce: e.target.value })} /></label>
      <div className="flex gap-2">
        <select aria-label="Role" value={f.role} onChange={e => setF({ ...f, role: e.target.value as Role })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option>Quant</option><option>Qual</option><option>IS</option>
        </select>
        <select aria-label="Polarity" value={f.polarity} onChange={e => setF({ ...f, polarity: e.target.value as Polarity })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="+">+</option><option value="-">−</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={!ok} className="col-span-2 sm:col-span-1">Add</Button>
    </form>
  )
}

function ExportBox({ name, setName, rows, dwellMs }: { name: string; setName: (s: string) => void; rows: PanelRow[]; dwellMs: number | null }) {
  const [formats, setFormats] = useState<ExportFormat[]>([])
  const [fmt, setFmt] = useState('skyline')
  const [fillDwell, setFillDwell] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { axios.get<ExportFormat[]>(`${API}/export-formats`).then(r => setFormats(r.data)).catch(() => {}) }, [])
  const download = async () => {
    setError(null)
    try {
      const r = await axios.post(`${API}/tools/panel/export/${fmt}`, {
        name: name.trim() || 'Koiné panel',
        rows: rows.map(({ compound, role, polarity, q1, q3, ce, cone_voltage, declustering_potential, cell_exit_potential }) => ({
          compound, role, polarity, q1, q3, ce, cone_voltage, declustering_potential, cell_exit_potential,
          dwell_ms: fillDwell ? dwellMs : null,
        })),
      }, { responseType: 'blob' })
      const f = formats.find(x => x.key === fmt)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(r.data)
      a.download = `Koine_panel_${(name || 'panel').replace(/[^A-Za-z0-9]+/g, '_')}_${fmt}.${f?.extension ?? 'csv'}`
      a.click(); URL.revokeObjectURL(a.href)
    } catch { setError('The export could not be created. Try again in a moment.') }
  }
  const f = formats.find(x => x.key === fmt)
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="export-title">
      <h2 id="export-title" className="text-sm font-semibold text-foreground">Export the transition table</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Panel name</span>
          <Input value={name} maxLength={60} onChange={e => setName(e.target.value)} className="h-9 w-56" /></label>
        <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Format</span>
          <select value={fmt} onChange={e => setFmt(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            {formats.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select></label>
        <label className="flex h-9 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={fillDwell} onChange={e => setFillDwell(e.target.checked)} disabled={dwellMs == null} />
          Fill in the calculated dwell{dwellMs != null && ` (${dwellMs} ms)`}
        </label>
        <Button onClick={download} disabled={!formats.length}><Download /> Download</Button>
      </div>
      {f && f.status !== 'documented' && !f.tested_in && <p className="mt-2 text-xs text-warning">This format has not been verified yet: check the columns when you import it.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Retention times are left empty: they depend on your column and gradient.</p>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  )
}
