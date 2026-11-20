import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import {
  AlertTriangle, BookOpen, CheckCircle2, ClipboardCheck, ClipboardCopy, FileText, Lock, Plus, Printer, Search, Trash2,
} from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { API, searchMethods, type MethodHit } from '@/lib/api'
import { cn } from '@/lib/utils'

/* ── Types (mirror backend/validation_rules.py) ─────────────────────────── */
type ProfileId = 'bioanalysis_m10' | 'clinical_inhouse' | 'clinical_ceivd' | 'own'
interface Profile { id: ProfileId; label: string; family: 'bioanalysis' | 'clinical'; use_for: string; context: string; editable: boolean }
interface Rules { rules_version: string; profiles: Profile[]; uloq_label: string; hil_defaults: Record<string, number | string> }
interface Range { method_id: number; title: string; matrix: string | null; lloq: number | null; uloq: number | null; unit: string | null; label: string | null; missing: string[] }
interface Qc { level: string; conc: number; limit: number; rule: string }
interface Experiment {
  key: string; label: string; required: boolean; design: string; criteria: string[]; injections: number | null; source: string
  qcs?: Qc[]; levels?: number[]; routes?: string[]
}
interface Plan {
  rules_version: string; profile: ProfileId; profile_label: string; family: string; use_for: string
  range: { lloq: number | null; uloq: number | null; unit: string | null; confirmed: boolean }
  status: 'draft' | 'ready'; blockers: string[]; can_generate_protocols: boolean
  experiments: Experiment[]; run_acceptance: { rule: string; source: string }[]; total_injections: number
}
interface IvdrSection { id: string; title: string; text: string; help: string; options?: { id: string; text: string; source: string }[]; sources?: string[]; non_equivalence?: string[] }
interface IvdrTemplate { source: string; legal_text: string; regulatory_note: string; sections: IvdrSection[] }
interface Device { name: string; maker: string; grounds: string[]; note: string }
interface IvdrState { text: Record<string, string>; needs: string[]; date: string; sources: string[]; devices: Device[] }

const HIL_LABEL: Record<string, string> = { haemoglobin_mg_dl: 'Haemoglobin', bilirubin_mg_dl: 'Bilirubin', triglycerides_mg_dl: 'Triglycerides' }
const fmt = (x: number) => (x >= 100 ? Math.round(x).toLocaleString('en') : String(+x.toPrecision(3)))
const nums = (s: string) => s.split(/[,;\s]+/).map(Number).filter(v => Number.isFinite(v) && v > 0)
const STORE = (m: number | null) => `koine_ivdr_v1_${m ?? 'none'}`
const loadIvdr = (m: number | null): IvdrState | null => { try { const s = localStorage.getItem(STORE(m)); return s ? JSON.parse(s) : null } catch { return null } }
const box = 'rounded-xl border border-border bg-card p-4 sm:p-5'
const fieldLabel = 'label-caps mb-1 block text-muted-foreground'

export default function ValidationPlan() {
  const [sp, setSp] = useSearchParams()
  const methodId = sp.get('method') ? Number(sp.get('method')) : null
  const [rules, setRules] = useState<Rules | null>(null)
  const [range, setRange] = useState<Range | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileId | null>((sp.get('profile') as ProfileId) || null)
  const [lloq, setLloq] = useState(''), [uloq, setUloq] = useState(''), [unit, setUnit] = useState('ng/mL')
  const [confirmed, setConfirmed] = useState(false)
  const [nCal, setNCal] = useState(8), [highRisk, setHighRisk] = useState(false), [nearZero, setNearZero] = useState(false)
  const [dilution, setDilution] = useState(''), [decision, setDecision] = useState(''), [matrix, setMatrix] = useState('')
  const [hil, setHil] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<Plan | null>(null)

  useEffect(() => { axios.get<Rules>(`${API}/validation/rules`).then(r => setRules(r.data)).catch(() => setError('The validation rules could not be loaded. Is the backend running the latest version?')) }, [])
  useEffect(() => {
    setRange(null); setConfirmed(false)
    if (methodId == null) return
    axios.get<Range>(`${API}/validation/methods/${methodId}/range`).then(r => {
      setRange(r.data)
      setLloq(r.data.lloq != null ? String(r.data.lloq) : ''); setUloq(r.data.uloq != null ? String(r.data.uloq) : '')
      if (r.data.unit) setUnit(r.data.unit)
      setMatrix(r.data.matrix || '')
    }).catch(() => setError('This method could not be found.'))
  }, [methodId])

  const p = rules?.profiles.find(x => x.id === profile)
  const clinical = p?.family === 'clinical'
  useEffect(() => { if (clinical && (nCal < 6 || nCal > 8)) setNCal(8) }, [clinical, nCal])

  const body = useMemo(() => profile && ({
    profile, lloq: +lloq > 0 ? +lloq : null, uloq: +uloq > 0 ? +uloq : null, unit, range_confirmed: confirmed,
    n_calibrators: nCal, high_risk: profile === 'clinical_inhouse' && highRisk, near_zero: clinical && nearZero,
    dilution_factors: nums(dilution).filter(v => v > 1), matrix: matrix || null,
    decision_points: clinical ? nums(decision) : [], method_id: methodId,
    hil: clinical ? Object.fromEntries(Object.entries(hil).filter(([, v]) => +v > 0).map(([k, v]) => [k, +v])) : null,
  }), [profile, lloq, uloq, unit, confirmed, nCal, highRisk, nearZero, dilution, matrix, decision, methodId, hil, clinical])

  const [planError, setPlanError] = useState<string | null>(null)
  useEffect(() => {
    if (!body) { setPlan(null); return }
    const ctl = new AbortController()
    const t = setTimeout(() => axios.post<Plan>(`${API}/validation/plan`, body, { signal: ctl.signal })
      .then(r => { setPlan(r.data); setPlanError(null) })
      .catch(e => { if (!axios.isCancel(e)) setPlanError(e?.response?.data?.detail?.toString?.() || 'The plan could not be calculated.') }), 200)
    return () => { clearTimeout(t); ctl.abort() }
  }, [body])

  const editRange = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { fn(e.target.value); setConfirmed(false) }
  const suggestedUloq = range?.uloq != null && String(range.uloq) === uloq

  return (
    <>
      <SEO title="Validation plan — experiments, design and criteria for your LC-MS/MS method"
        description="Choose ICH M10 for bioanalysis or a clinical profile (CLSI, ISO 15189, IVDR) and get the experiments, concentrations, injections and acceptance criteria for your method, with the source of every rule." />
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="no-print">
          <p className="label-caps text-primary">Validate</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <ClipboardCheck className="text-primary" size={26} /> Validation plan
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Choose what the method is for and confirm its measuring interval. Koiné lists every experiment with its design, concentrations, number of injections and acceptance criteria, and says where each rule comes from.
          </p>
        </header>

        {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" />{error}</p>}

        {/* 1 · Method */}
        <section className={cn(box, 'no-print')}>
          <Step n={1} title="Method" />
          {range ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2.5">
              <div className="min-w-0">
                <Link to={`/method/${range.method_id}`} className="font-medium text-foreground hover:underline">{range.title}</Link>
                <p className="text-xs text-muted-foreground">{range.matrix || 'Matrix not stated'}</p>
              </div>
              <button type="button" onClick={() => { sp.delete('method'); setSp(sp) }} className="text-xs font-medium text-muted-foreground hover:text-foreground">Change</button>
            </div>
          ) : <MethodPicker onPick={id => { sp.set('method', String(id)); setSp(sp) }} />}
        </section>

        {/* 2 · Profile */}
        <section className={cn(box, 'no-print')}>
          <Step n={2} title="What is the method for?" />
          <p className="mt-1 text-sm text-muted-foreground">Bioanalysis and clinical rules are kept apart: the study is judged against one profile, never a mix of both.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Validation profile">
            {(rules?.profiles ?? []).map(x => (
              <button key={x.id} type="button" role="radio" aria-checked={profile === x.id} onClick={() => setProfile(x.id)}
                className={cn('rounded-xl border p-3 text-left transition-colors',
                  profile === x.id ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50')}>
                <span className={cn('label-caps', x.family === 'bioanalysis' ? 'text-chart-2' : 'text-primary')}>{x.family === 'bioanalysis' ? 'Bioanalysis · ICH M10' : 'Clinical · CLSI / ISO 15189 / IVDR'}</span>
                <span className="mt-1 block text-sm font-semibold text-foreground">{(l => l.charAt(0).toUpperCase() + l.slice(1))(x.label.replace(/^(Bioanalysis|Clinical) · /, ''))}</span>
                <span className="mt-1.5 block text-xs leading-snug text-muted-foreground"><span className="font-medium text-foreground">Use it for: </span>{x.use_for}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 3 · Interval and options */}
        <section className={cn(box, 'no-print')}>
          <Step n={3} title="Measuring interval" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label><span className={fieldLabel}>{clinical ? 'LLMI / LLOQ' : 'LLOQ'}</span><Input inputMode="decimal" value={lloq} onChange={editRange(setLloq)} placeholder="e.g. 0.1" /></label>
            <label><span className={fieldLabel}>{clinical ? 'ULMI / ULOQ' : 'ULOQ'}</span><Input inputMode="decimal" value={uloq} onChange={editRange(setUloq)} placeholder="Type the upper limit" /></label>
            <label><span className={fieldLabel}>Unit</span><Input value={unit} onChange={editRange(setUnit)} /></label>
          </div>
          {range && (suggestedUloq && rules
            ? <p className="mt-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">{rules.uloq_label}</p>
            : range.uloq == null && <p className="mt-2 text-xs text-muted-foreground">The source publication does not give an upper limit: type the one your laboratory will validate. Koiné never fills it in.</p>)}
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={confirmed} disabled={!(+lloq > 0 && +uloq > +lloq)}
              onChange={e => setConfirmed(e.target.checked)} />
            <span>I confirm this is the measuring interval the laboratory will validate. <span className="text-muted-foreground">Protocols and sample labels stay locked until it is confirmed.</span></span>
          </label>

          {p && (
            <details className="mt-4 rounded-lg border border-border bg-background/50 px-3 py-2" open>
              <summary className="cursor-pointer text-sm font-medium text-foreground">Study options</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label><span className={fieldLabel}>Calibrators ({clinical ? '6–8' : '≥6'})</span>
                  <Input type="number" min={6} max={clinical ? 8 : 20} value={nCal} onChange={e => setNCal(Math.max(6, Math.min(clinical ? 8 : 20, +e.target.value || 6)))} /></label>
                <label><span className={fieldLabel}>Matrix</span><Input value={matrix} onChange={e => setMatrix(e.target.value)} placeholder="e.g. Plasma K2-EDTA" /></label>
                <label><span className={fieldLabel}>Dilution factors (if diluted)</span><Input value={dilution} onChange={e => setDilution(e.target.value)} placeholder="e.g. 10, 100" /></label>
                {clinical && <label><span className={fieldLabel}>Clinical decision points</span><Input value={decision} onChange={e => setDecision(e.target.value)} placeholder="Three values place the QCs" /></label>}
                {profile === 'clinical_inhouse' && <Toggle checked={highRisk} onChange={setHighRisk} label="High-risk test or population screening" hint="Precision over 20 days × 2 runs × 2 replicates (CLSI EP05-A3) instead of 5 × 5." />}
                {clinical && <Toggle checked={nearZero} onChange={setNearZero} label="Results reported as qualitative or near clinical zero" hint="Adds a formal LoB and LoD (CLSI EP17)." />}
              </div>
              {clinical && rules && (
                <div className="mt-3">
                  <p className={fieldLabel}>HIL test levels, mg/dL <span className="normal-case tracking-normal">· indicative, set your own (not verified against CLSI EP37)</span></p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.keys(HIL_LABEL).map(k => (
                      <label key={k} className="text-xs text-muted-foreground">{HIL_LABEL[k]}
                        <Input inputMode="decimal" value={hil[k] ?? ''} placeholder={String(rules.hil_defaults[k])} onChange={e => setHil(h => ({ ...h, [k]: e.target.value }))} /></label>
                    ))}
                  </div>
                </div>
              )}
            </details>
          )}
        </section>

        {/* 4 · Plan */}
        {!profile && <p className="no-print rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Choose what the method is for to see its validation plan.</p>}
        {planError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-destructive" />{planError}</p>}
        {plan && profile && <PlanView plan={plan} title={range?.title} />}
        {plan && profile === 'clinical_inhouse' && <IvdrJustification methodId={methodId} />}

        {plan && (
          <p className="no-print text-xs text-muted-foreground">
            Koiné drafts the plan from the rules it states; the validation decision and sign-off stay with your laboratory.
            Results upload and the validation dossier are in <Link to="/validation#early-access" className="font-medium text-primary hover:underline">early access</Link>.
          </p>
        )}
      </div>
    </>
  )
}

function Step({ n, title }: { n: number; title: string }) {
  return <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><span className="num flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>{title}</h2>
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-1">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span><span className="font-medium text-foreground">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
    </label>
  )
}

function MethodPicker({ onPick }: { onPick: (id: number) => void }) {
  const [q, setQ] = useState(''), [hits, setHits] = useState<MethodHit[]>([])
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const ctl = new AbortController()
    const t = setTimeout(() => searchMethods(new URLSearchParams({ q: q.trim(), limit: '6' }), ctl.signal).then(r => setHits(r.items)).catch(() => {}), 250)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q])
  return (
    <div className="mt-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Start from a library method: analyte, matrix or title" aria-label="Search the library" />
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {hits.map(h => (
            <li key={h.id}><button type="button" onClick={() => onPick(h.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted">
              <span className="min-w-0 truncate text-foreground">{h.title}</span><span className="shrink-0 text-xs text-muted-foreground">{h.matrix}</span>
            </button></li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Or skip this and type the interval of your own method below.</p>
    </div>
  )
}

function PlanView({ plan, title }: { plan: Plan; title?: string }) {
  const ready = plan.status === 'ready'
  const u = plan.range.unit || ''
  return (
    <section className="space-y-4">
      <div className={cn(box, 'flex flex-wrap items-start justify-between gap-4')}>
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Validation plan · {plan.profile_label}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{title || 'Your method'}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Use it for: {plan.use_for}</p>
          <p className="mt-1 text-sm text-foreground">
            Interval: <span className="num">{plan.range.lloq != null ? fmt(plan.range.lloq) : '—'}–{plan.range.uloq != null ? fmt(plan.range.uloq) : '—'} {u}</span>
            <span className="text-muted-foreground"> · rules <span className="num">{plan.rules_version}</span></span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', ready ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>
            {ready ? <CheckCircle2 size={13} /> : <Lock size={13} />} {ready ? 'Ready' : 'Draft'}
          </span>
          <p className="num text-2xl font-semibold text-foreground">{plan.total_injections}<span className="ml-1 text-xs font-normal text-muted-foreground">injections</span></p>
          <Button size="sm" variant="outline" className="no-print" disabled={!plan.can_generate_protocols} onClick={() => window.print()}
            title={plan.can_generate_protocols ? 'Print or save as PDF' : 'Confirm the measuring interval first'}>
            <Printer size={14} /> Print plan
          </Button>
        </div>
        {!ready && (
          <ul className="w-full space-y-1 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            {plan.blockers.map(b => <li key={b} className="flex items-center gap-2"><Lock size={13} className="shrink-0 text-warning" />{b}</li>)}
          </ul>
        )}
      </div>

      <ol className="grid gap-3 lg:grid-cols-2">
        {plan.experiments.map((e, i) => (
          <li key={e.key} className={cn(box, 'break-inside-avoid')}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground"><span className="num mr-1.5 text-muted-foreground">{i + 1}.</span>{e.label}{!e.required && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">optional</span>}</h3>
              {e.injections != null && <span className="num shrink-0 text-xs text-muted-foreground">{e.injections} inj.</span>}
            </div>
            <p className="mt-1.5 text-sm text-foreground">{e.design}</p>
            {e.levels && e.levels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {e.levels.map((c, k) => <span key={k} className="num rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{fmt(c)}</span>)}
                <span className="text-xs text-muted-foreground">{u} · suggested, log-spaced</span>
              </div>
            )}
            {e.qcs && e.qcs.length > 0 && (
              <table className="mt-2 w-full text-xs">
                <tbody>{e.qcs.map(q => (
                  <tr key={q.level} className="border-t border-border">
                    <td className="py-1 pr-2 font-medium text-foreground">{q.level}</td>
                    <td className="num py-1 pr-2 text-right text-foreground">{fmt(q.conc)} {u}</td>
                    <td className="num py-1 pr-2 text-muted-foreground">±{q.limit}%</td>
                    <td className="py-1 text-muted-foreground">{q.rule}</td>
                  </tr>))}</tbody>
              </table>
            )}
            {e.criteria.length > 0 && <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{e.criteria.map(c => <li key={c} className="flex gap-1.5"><span className="text-primary">·</span>{c}</li>)}</ul>}
            <p className="mt-2 text-[11px] text-muted-foreground"><BookOpen size={11} className="mr-1 inline" />{e.source}</p>
          </li>
        ))}
      </ol>

      <div className={box}>
        <h3 className="text-sm font-semibold text-foreground">Run acceptance (every run, also in routine)</h3>
        <ul className="mt-2 space-y-1 text-sm">{plan.run_acceptance.map(r => <li key={r.rule} className="flex justify-between gap-3"><span className="text-foreground">{r.rule}</span><span className="shrink-0 text-xs text-muted-foreground">{r.source}</span></li>)}</ul>
      </div>
    </section>
  )
}

function IvdrJustification({ methodId }: { methodId: number | null }) {
  const [t, setT] = useState<IvdrTemplate | null>(null)
  const [s, setS] = useState<IvdrState>(() => loadIvdr(methodId) ?? { text: {}, needs: [], date: '', sources: [], devices: [] })
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    axios.get<IvdrTemplate>(`${API}/validation/ivdr-template`, { params: methodId != null ? { method_id: methodId } : {} }).then(r => setT(r.data)).catch(() => {})
    setS(loadIvdr(methodId) ?? { text: {}, needs: [], date: '', sources: [], devices: [] })
  }, [methodId])
  useEffect(() => { try { localStorage.setItem(STORE(methodId), JSON.stringify(s)) } catch { /* storage unavailable */ } }, [s, methodId])
  if (!t) return null
  const val = (sec: IvdrSection) => s.text[sec.id] ?? sec.text
  const setText = (id: string, v: string) => setS(x => ({ ...x, text: { ...x.text, [id]: v } }))
  const toggle = (list: 'needs' | 'sources', v: string) => setS(x => ({ ...x, [list]: x[list].includes(v) ? x[list].filter(y => y !== v) : [...x[list], v] }))
  const setDevice = (i: number, d: Partial<Device>) => setS(x => ({ ...x, devices: x.devices.map((y, k) => (k === i ? { ...y, ...d } : y)) }))
  const need = t.sections.find(x => x.id === 'need'), market = t.sections.find(x => x.id === 'market')

  const asText = () => {
    const lines = ['IVDR (EU) 2017/746 Article 5(5)(d) — justification', `Requirement: ${t.legal_text}.`, '']
    for (const sec of t.sections) {
      lines.push(sec.title.toUpperCase())
      if (sec.id === 'need') need?.options?.filter(o => s.needs.includes(o.id)).forEach(o => lines.push(`- ${o.text}`))
      if (sec.id === 'market') {
        lines.push(`Search date: ${s.date || '[date]'} · Sources: ${s.sources.join(', ') || '[sources]'}`)
        s.devices.forEach(d => lines.push(`- ${d.name || '[device]'} (${d.maker || '[manufacturer]'}): not equivalent in ${d.grounds.join(', ').toLowerCase() || '[grounds]'}${d.note ? ` — ${d.note}` : ''}`))
      }
      if (val(sec)) lines.push(val(sec))
      lines.push('')
    }
    lines.push(`Drafted with Koiné (${t.source}). Reviewed and approved by: ______________________   Date: ________`)
    return lines.join('\n')
  }
  const copy = () => navigator.clipboard?.writeText(asText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })

  return (
    <section className={cn(box, 'space-y-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-primary">Annex · Clinical in-house</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground"><FileText size={18} className="text-primary" /> IVDR Article 5(5)(d) justification</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">The Regulation asks that {t.legal_text}. Koiné drafts it following MDCG 2023-1 §3.6; you complete it and sign it.</p>
        </div>
        <Button size="sm" variant="outline" className="no-print" onClick={copy}><ClipboardCopy size={14} /> {copied ? 'Copied' : 'Copy as text'}</Button>
      </div>
      <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-warning" />{t.regulatory_note}</p>

      {t.sections.map(sec => (
        <div key={sec.id}>
          <h3 className="text-sm font-semibold text-foreground">{sec.title}</h3>
          <p className="text-xs text-muted-foreground">{sec.help}</p>
          {sec.id === 'need' && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {sec.options?.map(o => (
                <label key={o.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', s.needs.includes(o.id) ? 'border-primary/60 bg-primary/5' : 'border-border')}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={s.needs.includes(o.id)} onChange={() => toggle('needs', o.id)} />
                  <span><span className="text-foreground">{o.text}</span><span className="block text-[11px] text-muted-foreground">{o.source}</span></span>
                </label>
              ))}
            </div>
          )}
          {sec.id === 'market' && market && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Search date</span><Input type="date" className="h-8 w-40" value={s.date} onChange={e => setS(x => ({ ...x, date: e.target.value }))} /></label>
                {market.sources?.map(src => (
                  <label key={src} className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary)]" checked={s.sources.includes(src)} onChange={() => toggle('sources', src)} />{src}</label>
                ))}
              </div>
              {s.devices.map((d, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex gap-2">
                    <Input className="h-8" placeholder="CE-IVD device" value={d.name} onChange={e => setDevice(i, { name: e.target.value })} />
                    <Input className="h-8" placeholder="Manufacturer" value={d.maker} onChange={e => setDevice(i, { maker: e.target.value })} />
                    <button type="button" aria-label="Remove device" onClick={() => setS(x => ({ ...x, devices: x.devices.filter((_, k) => k !== i) }))} className="text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {market.non_equivalence?.map(g => (
                      <button key={g} type="button" onClick={() => setDevice(i, { grounds: d.grounds.includes(g) ? d.grounds.filter(y => y !== g) : [...d.grounds, g] })}
                        className={cn('rounded-full border px-2 py-0.5 text-[11px]', d.grounds.includes(g) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50')}>{g}</button>
                    ))}
                  </div>
                  <Input className="h-8" placeholder="Why it does not meet the need (e.g. LLOQ 50 pg/mL, adult reference values)" value={d.note} onChange={e => setDevice(i, { note: e.target.value })} />
                </div>
              ))}
              <Button size="sm" variant="ghost" className="no-print" onClick={() => setS(x => ({ ...x, devices: [...x.devices, { name: '', maker: '', grounds: [], note: '' }] }))}><Plus size={14} /> Add a CE-IVD device you considered</Button>
            </div>
          )}
          <textarea value={val(sec)} onChange={e => setText(sec.id, e.target.value)} rows={sec.id === 'device' || sec.id === 'not_economic' ? 2 : 3}
            placeholder={sec.id === 'patient_group' ? 'e.g. Children under 12 years with suspected congenital adrenal hyperplasia' : sec.id === 'need' ? 'Add details in your own words' : sec.id === 'market' ? 'Conclusion of the market search' : ''}
            className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Saved in this browser only. {t.source}.</p>
    </section>
  )
}
