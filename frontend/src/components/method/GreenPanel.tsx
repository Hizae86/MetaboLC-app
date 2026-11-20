import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Info, Leaf, RotateCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Block, Panel } from './parts'
import { Input } from '@/components/ui/input'
import {
  P1_OPTIONS, P10_OPTIONS, P3_OPTIONS, P9_OPTIONS, PRINCIPLES, THREATS,
  agreeColor, agreeScores, agreeTotal, defaultInputs, type AgreeInputs, type Source,
} from '@/lib/agree'
import { cn } from '@/lib/utils'

const SOLVENT_LABEL: Record<string, string> = { acetonitrile: 'Acetonitrile', methanol: 'Methanol', isopropanol: 'Isopropanol', ethanol: 'Ethanol', water: 'Water' }
const fmt = (v: number, d = 2) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d))
const SOURCE_CHIP: Record<Source | 'entered', [string, string]> = {
  method: ['From method', 'border-success/40 bg-success/10 text-success'],
  text: ['From text', 'border-primary/40 bg-primary/10 text-primary'],
  assumption: ['Assumption', 'border-border bg-muted/60 text-muted-foreground'],
  missing: ['Needs input', 'border-warning/40 bg-warning/10 text-warning'],
  entered: ['Entered', 'border-primary/40 bg-primary/10 text-primary'],
}

/** AGREE clock: 12 equal segments coloured by score, overall score in the centre. */
function AgreeClock({ scores, total }: { scores: (number | null)[]; total: number | null }) {
  const R = 90, r = 62, c = 100
  const seg = (k: number) => {
    const a0 = (k * 30 - 90) * Math.PI / 180, a1 = ((k + 1) * 30 - 90) * Math.PI / 180
    const p = (rad: number, a: number) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`
    return `M${p(r, a0)} L${p(R, a0)} A${R},${R} 0 0 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 0 0 ${p(r, a0)} Z`
  }
  return (
    <svg viewBox="0 0 200 200" className="size-48 shrink-0" role="img"
      aria-label={`AGREE score ${total != null ? total.toFixed(2) : 'not available'}`}>
      {scores.map((s, k) => {
        const mid = ((k + 0.5) * 30 - 90) * Math.PI / 180
        return (
          <g key={k}>
            <path d={seg(k)} fill={s == null ? 'var(--muted)' : agreeColor(s)} stroke="var(--card)" strokeWidth={2}>
              <title>{`${k + 1}. ${PRINCIPLES[k].short}: ${s == null ? 'needs input' : s.toFixed(2)}`}</title>
            </path>
            <text x={c + (R + r) / 2 * Math.cos(mid)} y={c + (R + r) / 2 * Math.sin(mid)} textAnchor="middle" dominantBaseline="central"
              fontSize={11} fontWeight={600} fill={s == null ? 'var(--muted-foreground)' : s > 0.35 && s < 0.85 ? '#111' : '#fff'}>{k + 1}</text>
          </g>
        )
      })}
      <circle cx={c} cy={c} r={r - 6} fill={total == null ? 'var(--muted)' : agreeColor(total)} />
      <text x={c} y={c} textAnchor="middle" dominantBaseline="central" fontSize={30} fontWeight={700}
        fill={total != null && total > 0.35 && total < 0.85 ? '#111' : '#fff'} className="num">{total != null ? total.toFixed(2) : '—'}</text>
    </svg>
  )
}

export const GREEN_EVENT = 'metabolc:green-details'
const GREEN_ID = 'environmental-impact'
export const openGreenDetails = () => window.dispatchEvent(new Event(GREEN_EVENT))

const SCALE = 'bg-gradient-to-r from-destructive/80 via-warning/80 to-success/80'

/** Red → amber → green bar with a marker; further right is greener. */
function ScaleBar({ value, label, className }: { value: number | null; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} title={label}
      className={cn('relative inline-block h-2 w-24 shrink-0 rounded-full', value == null ? 'border border-dashed border-muted-foreground/40' : SCALE, className)}>
      {value != null && (
        <span className="absolute -top-1 h-4 w-1.5 rounded-sm border border-card bg-foreground shadow"
          style={{ left: `calc(${Math.max(0, Math.min(1, value)) * 100}% - 3px)` }} />
      )}
    </span>
  )
}

/** One line at the top of the method: solvent use against the repository, and the green score. */
export function GreenSummary({ method }: { method: any }) {
  const g = method.green
  const total = useMemo(() => agreeTotal(agreeScores(defaultInputs(method, g).inputs)), [method, g])
  if (!g) return null
  const rep = g.repository
  const solventPos = g.computable && rep ? rep.share_using_more : null
  const solventTip = g.computable
    ? `${fmt(g.organic_ml)} mL of organic solvent per injection${rep ? `: less than ${Math.round(rep.share_using_more * 100)}% of the ${rep.n} methods in the repository (median ${fmt(rep.median_organic_ml)} mL)` : ''}`
    : 'Solvent use cannot be calculated from the published data'
  const scoreOk = total.score != null && total.scored >= 11
  const scoreTip = scoreOk
    ? `Green score (AGREE): ${total.score!.toFixed(2)} on a scale from 0 (not green) to 1 (greenest)${total.scored < 12 ? `, provisional: ${total.scored} of 12 criteria known` : ''}`
    : 'Green score: not enough published data'
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 whitespace-nowrap border-t border-border bg-success/[0.04] px-5 py-2.5 text-sm sm:flex-nowrap sm:overflow-x-auto">
      <span className="flex items-center gap-1.5 font-medium text-foreground"><Leaf size={14} className="text-success" /> Environmental impact</span>
      <span className="flex items-center gap-2" title={solventTip}>
        <span className="text-xs text-muted-foreground">Solvent use</span>
        <ScaleBar value={solventPos} label={solventTip} />
        {g.computable
          ? <span className="num text-xs font-semibold text-foreground">{fmt(g.organic_ml)} mL<span className="font-normal text-muted-foreground"> / injection</span></span>
          : <span className="text-xs text-muted-foreground">not calculable</span>}
      </span>
      <span className="flex items-center gap-2" title={scoreTip}>
        <span className="text-xs text-muted-foreground">Green score</span>
        <ScaleBar value={scoreOk ? total.score : null} label={scoreTip} />
        {scoreOk
          ? <span className="num text-xs font-semibold text-foreground">{total.score!.toFixed(2)}<span className="font-normal text-muted-foreground"> / 1</span></span>
          : <span className="text-xs text-muted-foreground">not enough data</span>}
      </span>
      <a href={`#${GREEN_ID}`} onClick={e => { e.preventDefault(); openGreenDetails() }}
        className="no-print ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary no-underline hover:underline">
        Learn more <ChevronRight size={13} />
      </a>
    </div>
  )
}

const sel = 'h-7 max-w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground'
const numIn = 'num h-7 w-20 px-1.5 text-xs'

export default function GreenPanel({ method }: { method: any }) {
  const g = method.green
  const defaults = useMemo(() => defaultInputs(method, g), [method, g])
  const [inputs, setInputs] = useState<AgreeInputs>(defaults.inputs)
  const [perDay, setPerDay] = useState(100)
  const [days, setDays] = useState(250)
  const set = (patch: Partial<AgreeInputs>) => setInputs(prev => ({ ...prev, ...patch }))
  const scores = agreeScores(inputs)
  const { score: total, scored } = agreeTotal(scores)
  const edited = JSON.stringify(inputs) !== JSON.stringify(defaults.inputs)
  const [open, setOpen] = useState(() => window.location.hash === `#${GREEN_ID}`)
  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(GREEN_EVENT, show)
    return () => window.removeEventListener(GREEN_EVENT, show)
  }, [])
  if (!g) return null

  const year = perDay * days
  const organicL = g.computable ? g.organic_ml * year / 1000 : null
  const wasteL = g.computable ? g.total_ml * year / 1000 : null
  const organics = Object.entries(g.by_solvent_ml || {}).filter(([s]) => s !== 'water') as [string, number][]
  const rep = g.repository
  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

  const control = (n: number) => {
    switch (n) {
      case 1: return (
        <select className={sel} value={inputs.p1 ?? ''} onChange={e => set({ p1: e.target.value || null })} aria-label="Sample treatment">
          <option value="">Select…</option>{Object.keys(P1_OPTIONS).map(o => <option key={o}>{o}</option>)}
        </select>)
      case 2: return <span className="flex items-center gap-1"><Input className={numIn} value={inputs.p2_ml ?? ''} onChange={e => set({ p2_ml: num(e.target.value) })} aria-label="Sample amount in mL" /> <span className="text-xs text-muted-foreground">mL</span></span>
      case 3: return <select className={sel} value={inputs.p3} onChange={e => set({ p3: e.target.value })} aria-label="Device position">{Object.keys(P3_OPTIONS).map(o => <option key={o}>{o}</option>)}</select>
      case 4: return <span className="flex items-center gap-1"><Input className={numIn} value={inputs.p4_steps ?? ''} onChange={e => set({ p4_steps: num(e.target.value) == null ? null : Math.max(1, Math.round(num(e.target.value)!)) })} aria-label="Number of steps" /> <span className="text-xs text-muted-foreground">steps</span></span>
      case 5: return (
        <span className="flex flex-wrap items-center gap-1.5">
          <select className={sel} value={inputs.p5_automation} onChange={e => set({ p5_automation: e.target.value as AgreeInputs['p5_automation'] })} aria-label="Automation">
            {['automatic', 'semi-automatic', 'manual'].map(o => <option key={o}>{o}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={inputs.p5_miniaturized} onChange={e => set({ p5_miniaturized: e.target.checked })} /> miniaturized</label>
        </span>)
      case 6: return inputs.p6_derivatized
        ? <span className="flex items-center gap-1"><Input className={numIn} value={inputs.p6_agent_score ?? ''} onChange={e => set({ p6_agent_score: num(e.target.value) })} placeholder="0–1" aria-label="Derivatization agent score" /> <span className="text-xs text-muted-foreground">agent score</span></span>
        : <span className="text-xs text-muted-foreground">None</span>
      case 7: return <span className="flex items-center gap-1"><Input className={numIn} value={inputs.p7_waste_ml != null ? +inputs.p7_waste_ml.toFixed(2) : ''} onChange={e => set({ p7_waste_ml: num(e.target.value) })} aria-label="Waste per sample in mL" /> <span className="text-xs text-muted-foreground">mL / sample</span></span>
      case 8: return (
        <span className="flex flex-wrap items-center gap-1">
          <Input className={cn(numIn, 'w-14')} value={inputs.p8_analytes ?? ''} onChange={e => set({ p8_analytes: num(e.target.value) })} aria-label="Analytes per run" />
          <span className="text-xs text-muted-foreground">analytes ×</span>
          <Input className={cn(numIn, 'w-14')} value={inputs.p8_per_hour != null ? +inputs.p8_per_hour.toFixed(1) : ''} onChange={e => set({ p8_per_hour: num(e.target.value) })} aria-label="Samples per hour" />
          <span className="text-xs text-muted-foreground">/ h</span>
        </span>)
      case 9: return (
        <span className="flex flex-wrap items-center gap-1.5">
          <select className={sel} value={inputs.p9} onChange={e => set({ p9: e.target.value })} aria-label="Energy class">{Object.keys(P9_OPTIONS).map(o => <option key={o}>{o}</option>)}</select>
          <Input className={cn(numIn, 'w-16')} value={inputs.p9_kwh ?? ''} onChange={e => set({ p9_kwh: num(e.target.value) })} placeholder="kWh" aria-label="Measured kWh per sample" />
        </span>)
      case 10: return <select className={sel} value={inputs.p10} onChange={e => set({ p10: e.target.value })} aria-label="Bio-based reagents">{Object.keys(P10_OPTIONS).map(o => <option key={o}>{o}</option>)}</select>
      case 11: return (
        <span className="flex flex-wrap items-center gap-1.5">
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={inputs.p11_toxic} onChange={e => set({ p11_toxic: e.target.checked })} /> toxic reagents</label>
          {inputs.p11_toxic && <><Input className={numIn} value={inputs.p11_ml != null ? +inputs.p11_ml.toFixed(2) : ''} onChange={e => set({ p11_ml: num(e.target.value) })} aria-label="Toxic reagent amount in mL" /><span className="text-xs text-muted-foreground">mL</span></>}
        </span>)
      case 12: return (
        <span className="flex flex-wrap gap-x-2 gap-y-0.5">
          {THREATS.map(t => (
            <label key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={!!inputs.p12_threats?.includes(t)}
                onChange={e => { const cur = inputs.p12_threats ?? []; set({ p12_threats: e.target.checked ? [...cur, t] : cur.filter(x => x !== t) }) }} /> {t}
            </label>
          ))}
          {inputs.p12_threats == null && <button type="button" onClick={() => set({ p12_threats: [] })} className="text-xs font-medium text-primary hover:underline">None of these</button>}
        </span>)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => {
      setOpen(o)
      if (!o && window.location.hash === `#${GREEN_ID}`) history.replaceState(null, '', window.location.pathname + window.location.search)
    }}>
    <DialogContent id={GREEN_ID} onOpenAutoFocus={e => e.preventDefault()} className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
    <DialogTitle className="sr-only">Environmental impact of this method</DialogTitle>
    <DialogDescription className="sr-only">Organic solvent per injection, yearly waste and the AGREE green score.</DialogDescription>
    <Panel title="Environmental impact" icon={Leaf} accent="var(--success)" className="rounded-none border-0">
      <Block label="Mobile phase per injection">
        {g.computable ? (
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Organic solvent</p>
              <p className="num text-2xl font-semibold text-foreground">{fmt(g.organic_ml)} <span className="text-sm font-normal text-muted-foreground">mL</span></p>
              <p className="mt-0.5 flex flex-wrap gap-1.5">
                {organics.map(([s, v]) => <span key={s} className="num rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-foreground">{SOLVENT_LABEL[s]} {fmt(v)} mL</span>)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total to waste</p>
              <p className="num text-2xl font-semibold text-foreground">{fmt(g.total_ml)} <span className="text-sm font-normal text-muted-foreground">mL</span></p>
              <p className="num text-xs text-muted-foreground">{fmt(g.run_time_min, 1)} min run · {fmt(g.total_ml / g.run_time_min, 2)} mL/min average</p>
            </div>
            {rep && (
              <div className="min-w-56 flex-1">
                <p className="text-xs text-muted-foreground">Compared with the repository</p>
                <p className="text-sm text-foreground">
                  Uses less organic solvent than <span className="num font-semibold">{Math.round(rep.share_using_more * 100)}%</span> of {rep.n} methods <span className="text-xs text-muted-foreground">(further right = greener)</span>
                </p>
                <div className="mt-1.5"><ScaleBar className="w-full max-w-md" value={rep.share_using_more} label={`Uses less organic solvent than ${Math.round(rep.share_using_more * 100)}% of methods`} /></div>
                <p className="num mt-1 text-xs text-muted-foreground">Repository median: {fmt(rep.median_organic_ml)} mL per injection</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{g.reason}</p>
        )}
      </Block>

      {g.computable && (
        <Block label="Per year">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Input className={numIn} type="number" min={1} value={perDay} onChange={e => setPerDay(Math.max(0, Number(e.target.value) || 0))} aria-label="Injections per day" /> injections / day ×
              <Input className={cn(numIn, 'w-16')} type="number" min={1} value={days} onChange={e => setDays(Math.max(0, Number(e.target.value) || 0))} aria-label="Working days per year" /> days
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Organic solvent</p>
              <p className="num text-xl font-semibold text-foreground">{fmt(organicL!, 1)} <span className="text-sm font-normal text-muted-foreground">L / year</span></p>
              <p className="num text-xs text-muted-foreground">≈ {Math.ceil(organicL! / 2.5)} bottles of 2.5 L</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Liquid waste</p>
              <p className="num text-xl font-semibold text-foreground">{fmt(wasteL!, 1)} <span className="text-sm font-normal text-muted-foreground">L / year</span></p>
              <p className="num text-xs text-muted-foreground">{year.toLocaleString('en')} injections</p>
            </div>
          </div>
        </Block>
      )}

      <Block label="Green score (AGREE, 0 = not green, 1 = greenest)"
        aside={edited && <button type="button" onClick={() => setInputs(defaults.inputs)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><RotateCcw size={12} /> Reset</button>}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-1.5 lg:w-56">
            <AgreeClock scores={scores} total={total} />
            <p className="text-center text-xs text-muted-foreground">
              {scored < 12 ? <>Provisional: {scored} of 12 principles scored. Fill in the ones marked “Needs input”.</> : 'All 12 principles scored, equal weights.'}
            </p>
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                {PRINCIPLES.map((p, k) => {
                  const s = scores[k]
                  const src = defaults.source[p.n]
                  const [chip, chipCls] = SOURCE_CHIP[s == null ? 'missing' : src === 'missing' ? 'entered' : src]
                  return (
                    <tr key={p.n}>
                      <td className="num w-6 py-1.5 align-top text-xs text-muted-foreground">{p.n}</td>
                      <td className="py-1.5 pr-3 align-top">
                        <span className="text-xs font-medium text-foreground" title={p.title}>{p.short}</span>
                        <span className={cn('ml-1.5 inline-flex rounded border px-1 py-px text-[10px] font-medium', chipCls)} title={defaults.why[p.n]}>{chip}</span>
                      </td>
                      <td className="py-1 pr-3">{control(p.n)}</td>
                      <td className="w-14 py-1.5 text-right align-top">
                        <span className="num inline-block w-11 rounded px-1 py-0.5 text-center text-xs font-semibold"
                          style={s == null ? undefined : { background: agreeColor(s), color: s > 0.35 && s < 0.85 ? '#111' : '#fff' }}>
                          {s == null ? '—' : s.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Block>

      <Block label="How this is calculated">
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />
            Solvent volumes are integrated over the gradient table (flow × time × %B) using the composition of mobile phases A and B
            {g.phase_a?.status === 'stated' && g.phase_b?.status !== 'unknown' ? ' as described in the method.' : '.'}
            {' '}Needle wash, purges and standby flow between injections are not included.</li>
          {(g.notes || []).map((n: string) => <li key={n} className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />{n}</li>)}
          {g.prep?.solvents?.length > 0 && (
            <li className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />
              <span>Solvents found in the sample preparation and counted as waste in AGREE: {g.prep.solvents.map((s: any) => `${s.solvent} ${fmt(s.ul / 1000, 3)} mL (“${s.snippet}”)`).join('; ')}. Check them against the procedure.</span></li>
          )}
          <li className="flex gap-1.5"><Info size={12} className="mt-0.5 shrink-0" />
            <span>AGREE: Pena-Pereira F, Wojnowski W, Tobiszewski M. <i>Anal Chem</i> 2020;92:10076–10082, scored with the functions of the authors’ open-source calculator. Inputs marked “Assumption” are typical values for clinical LC-MS/MS; change them to match your procedure. Changes here are not saved.</span></li>
        </ul>
      </Block>
    </Panel>
    </DialogContent>
    </Dialog>
  )
}
