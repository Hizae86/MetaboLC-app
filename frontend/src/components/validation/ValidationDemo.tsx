import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, BadgeCheck, CircleDashed, CircleX, ClipboardList, FileCheck2, FileSpreadsheet, Library, Lock, Pause, Play, Sigma as SigmaIcon, Sparkles, Upload, Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { BASE, LEVELS, ME_LOTS, REPS, RUNS, mean, pct, sd } from './sampleStudy'
import { BEST_WEIGHTING, ComparisonScene, SigmaScene, ToleranceScene, TraceableScene, WeightingScene } from './StatsShowcase'
import type { Weighting } from './stats'

function betweenRunCv(groups: number[][]) {
  const n = groups[0].length, k = groups.length, all = groups.flat(), gm = mean(all)
  const msw = groups.reduce((s, g) => s + g.reduce((t, x) => t + (x - mean(g)) ** 2, 0), 0) / (k * (n - 1))
  const msb = n * groups.reduce((s, g) => s + (mean(g) - gm) ** 2, 0) / (k - 1)
  return 100 * Math.sqrt(msw + Math.max(0, (msb - msw) / n)) / gm
}

/* ── Plan: every injection gets a code the software can read back ─────── */
type Inj = { code: string; kind: 'cal' | 'blank' | 'qc' | 'co' | 'me' | 'other'; label: string }
function buildPlan() {
  const runs: Inj[][] = []
  for (let r = 1; r <= RUNS; r++) {
    const d = r === 3 ? 2 : 1, p = `V07-D0${d}R${r}`
    const run: Inj[] = [{ code: `${p}-BLK`, kind: 'blank', label: 'Blank' }, { code: `${p}-ZERO`, kind: 'blank', label: 'Zero' }]
    for (let c = 1; c <= 8; c++) run.push({ code: `${p}-CAL${c}`, kind: 'cal', label: `Calibrator ${c}` })
    for (const l of LEVELS) for (let k = 1; k <= REPS; k++) run.push({ code: `${p}-${l.key === 'LLOQ' ? 'LLMI' : l.key}-0${k}`, kind: 'qc', label: `${l.key} replicate ${k}` })
    run.push({ code: `${p}-COH`, kind: 'co', label: 'ULOQ before blank' }, { code: `${p}-COB`, kind: 'co', label: 'Blank after ULOQ' })
    runs.push(run)
  }
  const me: Inj[] = []
  for (let lot = 1; lot <= 6; lot++) for (const lv of ['L', 'H']) for (let k = 1; k <= 3; k++) me.push({ code: `V07-D02R4-ME0${lot}${lv}-0${k}`, kind: 'me', label: `Matrix lot ${lot} · ${lv === 'L' ? 'LQC' : 'HQC'}` })
  const other: Inj[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ code: `V07-D01R1-SEL0${i + 1}`, kind: 'other' as const, label: `Selectivity blank ${i + 1}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ code: `V07-D02R3-DIL10-0${i + 1}`, kind: 'other' as const, label: `Dilution ×10 replicate ${i + 1}` })),
  ]
  return { runs, me, other, all: [...runs.flat(), ...me, ...other] }
}
export const PLAN = buildPlan()
const KIND_COLOR: Record<Inj['kind'], string> = {
  cal: 'bg-foreground/70', blank: 'bg-muted-foreground/40', qc: 'bg-primary', co: 'bg-chart-2', me: 'bg-chart-3', other: 'bg-success',
}

/* ── Scenarios ─────────────────────────────────────────────────────────── */
type Scenario = { key: string; label: string; shift: number; carry: number; lot: number }
const SCENARIOS: Scenario[] = [
  { key: 'clean', label: 'Clean study', shift: 0, carry: 8, lot: ME_LOTS[4] },
  { key: 'drift', label: 'Run 2 drifts', shift: 18, carry: 8, lot: ME_LOTS[4] },
  { key: 'carry', label: 'Carry-over', shift: 0, carry: 28, lot: ME_LOTS[4] },
  { key: 'matrix', label: 'Bad matrix lot', shift: 0, carry: 8, lot: 119 },
]

type Status = 'pass' | 'fail' | 'incomplete' | 'not-run'
const STATUS: Record<Status, { label: string; icon: typeof BadgeCheck; tone: string; ring: string }> = {
  pass: { label: 'Pass', icon: BadgeCheck, tone: 'text-success', ring: 'border-success/40 bg-success/5' },
  fail: { label: 'Fail', icon: CircleX, tone: 'text-destructive', ring: 'border-destructive/50 bg-destructive/10' },
  incomplete: { label: 'Incomplete', icon: CircleDashed, tone: 'text-warning', ring: 'border-warning/40 bg-warning/5' },
  'not-run': { label: 'Not run', icon: CircleDashed, tone: 'text-muted-foreground', ring: 'border-border bg-card' },
}

function useEvaluation(s: { shift: number; carry: number; lot: number }) {
  return useMemo(() => {
    const data = BASE.map((lv, i) => lv.map((run, r) => run.map(x => (i === 2 && r === 1 ? x * (1 + s.shift / 100) : x))))
    const rows = LEVELS.map((l, i) => {
      const runs = data[i].map(run => ({ bias: 100 * (mean(run) / l.nominal - 1), cv: 100 * sd(run) / mean(run) }))
      const overall = { bias: 100 * (mean(data[i].flat()) / l.nominal - 1), cv: betweenRunCv(data[i]) }
      const ok = (v: { bias: number; cv: number }) => Math.abs(v.bias) <= l.limit && v.cv <= l.limit
      return { ...l, data: data[i], runs, overall, runOk: runs.map(ok), pass: runs.every(ok) && ok(overall) }
    })
    const lots = ME_LOTS.map((v, i) => (i === 4 ? s.lot : v))
    const apPass = rows.every(r => r.pass), mePass = lots.every(v => Math.abs(v - 100) <= 15), coPass = s.carry <= 20
    const failing = rows.find(r => !r.pass)
    const experiments: { name: string; status: Status; note: string }[] = [
      { name: 'Selectivity', status: 'pass', note: 'Six blanks below 20% of LLOQ' },
      { name: 'Specificity', status: 'not-run', note: 'Not run is not a pass' },
      { name: 'Matrix effect', status: mePass ? 'pass' : 'fail', note: mePass ? 'Six lots within ±15%' : `Lot 5 at ${pct(s.lot - 100)}` },
      { name: 'Calibration', status: 'pass', note: 'Three runs accepted' },
      { name: 'Accuracy & precision', status: apPass ? 'pass' : 'fail', note: apPass ? 'All levels, all runs' : `${failing?.key} outside ±${failing?.limit}%` },
      { name: 'Carry-over', status: coPass ? 'pass' : 'fail', note: `${s.carry}% of LLOQ (limit 20%)` },
      { name: 'Dilution integrity', status: 'pass', note: '×10 within ±15%' },
      { name: 'Stability', status: 'incomplete', note: 'Long-term pending' },
      { name: 'Reinjection', status: 'not-run', note: 'Not run is not a pass' },
    ]
    return { rows, lots, experiments }
  }, [s.shift, s.carry, s.lot])
}

/* ── Step 1 · Design ───────────────────────────────────────────────────── */
const HIGHLIGHTS = ['V07-D01R1-CAL1', 'V07-D01R1-LLMI-01', 'V07-D01R2-MQC-03', 'V07-D01R1-COB', 'V07-D02R4-ME05L-01', 'V07-D02R3-DIL10-02']
  .map(c => PLAN.all.findIndex(i => i.code === c))
function DesignStep({ highlight }: { highlight: number | null }) {
  // Mount hidden, then reveal on the next frame so the squares animate in.
  const [active, setActive] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setActive(true)); return () => cancelAnimationFrame(t) }, [])
  const cols = [...PLAN.runs.map((run, i) => ({ title: `Run ${i + 1}`, sub: `Day ${i === 2 ? 2 : 1}`, inj: run })),
    { title: 'Matrix effect', sub: '6 lots', inj: PLAN.me }, { title: 'Selectivity · dilution', sub: 'Day 1–2', inj: PLAN.other }]
  const [hover, setHover] = useState<Inj | null>(null)
  const shownInj = hover ?? (highlight != null ? PLAN.all[highlight] : null)
  let n = 0
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <div className="grid grid-cols-5 gap-3">
          {cols.map(c => (
            <div key={c.title} className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{c.title}</p>
              <p className="mb-2 text-[11px] text-muted-foreground">{c.sub} · {c.inj.length}</p>
              <div className="flex flex-wrap gap-1">
                {c.inj.map(inj => {
                  const idx = n++, delay = idx * 6, lit = shownInj?.code === inj.code
                  return (
                    <span key={inj.code} onMouseEnter={() => setHover(inj)} onMouseLeave={() => setHover(null)}
                      className={cn('h-3 w-3 rounded-[3px] transition-all duration-300 hover:scale-150', KIND_COLOR[inj.kind], active ? 'opacity-100' : 'scale-0 opacity-0',
                        active && (lit ? 'scale-[1.8] ring-2 ring-primary ring-offset-1 ring-offset-background' : 'scale-100'))}
                      style={{ transitionDelay: active ? `${delay}ms` : '0ms' }} />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex min-h-[2.5rem] items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          {shownInj
            ? <><span key={shownInj.code + 'l'} className="animate-in fade-in text-muted-foreground">{shownInj.label}</span><code key={shownInj.code} className="num animate-in fade-in slide-in-from-right-2 text-sm font-semibold text-primary">{shownInj.code}</code></>
            : <span className="text-muted-foreground">Every injection gets a code your software keeps in the sample name.</span>}
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[['Injections', PLAN.all.length], ['Runs · days', '3 · 2'], ['QC levels × reps', '4 × 5'], ['Matrix lots', 6]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="num text-2xl font-semibold text-foreground">{v}</p>
              <p className="text-[11px] text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-foreground"><Library size={13} className="text-success" /> Imported from the library · 0 values typed</p>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {['Column and gradient', 'Sample preparation', 'Transitions and CE', 'Internal standards', 'Source parameters', 'Published range'].map(x => (
              <li key={x} className="flex items-center gap-1"><BadgeCheck size={11} className="shrink-0 text-success" />{x}</li>
            ))}
          </ul>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs">
          <Lock size={14} className="mt-0.5 shrink-0 text-primary" />
          <span className="text-foreground">Acceptance criteria locked before the first run · <span className="num">koine-rules@1.0.0</span> · ICH M10</span>
        </div>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {(['cal', 'qc', 'co', 'me', 'other', 'blank'] as const).map(k => (
            <li key={k} className="flex items-center gap-2"><span className={cn('h-2.5 w-2.5 rounded-[2px]', KIND_COLOR[k])} />
              {{ cal: 'Calibrators', qc: 'Accuracy & precision QCs', co: 'Carry-over pair', me: 'Matrix lots (LQC, HQC)', other: 'Selectivity blanks, dilution', blank: 'Blank and zero' }[k]}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ── Step 2 · Upload ───────────────────────────────────────────────────── */
const EXPORT = PLAN.all.map((inj, i) => {
  if (i === 17) return { name: inj.code.toLowerCase().replace(/-0(\d)$/, '-$1'), inj, how: 'normalised' as const }
  if (i === 41) return { name: `${inj.code}_REINJ`, inj, how: 'reinjection' as const }
  return { name: inj.code, inj, how: 'exact' as const }
})
function UploadStep({ done }: { done: number }) {
  const shown = EXPORT.slice(Math.max(0, done - 9), done).reverse()
  const counts = EXPORT.slice(0, done).reduce((a, r) => ({ ...a, [r.how]: (a as any)[r.how] + 1 }), { exact: 0, normalised: 0, reinjection: 0 })
  const progress = done / EXPORT.length
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="overflow-hidden rounded-xl border border-border bg-background/60">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <FileSpreadsheet size={14} /> quant_export_voriconazole.csv <span className="ml-auto num">{done}/{EXPORT.length}</span>
        </div>
        <div className="h-1 bg-muted"><div className="h-1 bg-primary transition-all duration-100 ease-linear" style={{ width: `${progress * 100}%` }} /></div>
        <ul className="h-[270px] divide-y divide-border">
          {shown.map(r => (
            <li key={r.name} className="flex animate-in fade-in slide-in-from-top-1 items-center gap-3 px-4 py-1.5 text-xs">
              <code className="num w-52 shrink-0 truncate text-foreground">{r.name}</code>
              <span className="text-muted-foreground">→</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{r.inj.label}</span>
              {r.how === 'exact' && <BadgeCheck size={14} className="shrink-0 text-success" />}
              {r.how === 'normalised' && <span className="shrink-0 rounded bg-warning/15 px-1.5 text-[10px] font-medium text-warning">normalised</span>}
              {r.how === 'reinjection' && <span className="shrink-0 rounded bg-primary/15 px-1.5 text-[10px] font-medium text-primary">kept as 2nd injection</span>}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <div className="rounded-lg border border-border bg-card px-3 py-2">
          <p className="num text-3xl font-semibold text-foreground">{Math.round(progress * 100)}%</p>
          <p className="text-[11px] text-muted-foreground">of injections placed in the plan, from the sample names alone</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Exact', counts.exact, 'text-success'], ['Normalised', counts.normalised, 'text-warning'], ['Re-injected', counts.reinjection, 'text-primary']].map(([k, v, c]) => (
            <div key={k as string} className="rounded-lg border border-border bg-card px-2 py-2">
              <p className={cn('num text-xl font-semibold', c as string)}>{v as number}</p><p className="text-[10px] text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Lower-case names and a dropped zero are recognised and flagged for you to confirm. A re-injection is kept next to the first one, never silently replaced.
          Anything unrecognised waits for you to assign it.
        </p>
      </div>
    </div>
  )
}

/* ── Step 3 · Evaluate: accuracy profile ──────────────────────────────── */
const RUN_COLOR = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']
function AccuracyProfile({ rows }: { rows: ReturnType<typeof useEvaluation>['rows'] }) {
  const W = 560, H = 270, top = 16, bottom = 236, left = 44
  const y = (b: number) => top + ((30 - Math.max(-30, Math.min(30, b))) / 60) * (bottom - top)
  const cx = (i: number) => left + 62 + i * 128
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Accuracy profile: bias of every replicate by level and run, with acceptance limits">
      {[-30, -15, 0, 15, 30].map(t => (
        <g key={t}>
          <line x1={left} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '3 4'} />
          <text x={left - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t > 0 ? `+${t}` : t}%</text>
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={r.key}>
          <rect x={cx(i) - 52} width={104} y={y(r.limit)} height={y(-r.limit) - y(r.limit)} rx={6}
            fill={r.pass ? 'var(--success)' : 'var(--destructive)'} fillOpacity={r.pass ? 0.08 : 0.12} className="transition-all duration-500" />
          <line x1={cx(i) - 52} x2={cx(i) + 52} y1={y(r.limit)} y2={y(r.limit)} stroke={r.pass ? 'var(--success)' : 'var(--destructive)'} strokeOpacity={0.6} strokeDasharray="4 3" />
          <line x1={cx(i) - 52} x2={cx(i) + 52} y1={y(-r.limit)} y2={y(-r.limit)} stroke={r.pass ? 'var(--success)' : 'var(--destructive)'} strokeOpacity={0.6} strokeDasharray="4 3" />
          {r.data.map((run, k) => {
            const mx = cx(i) + (k - 1) * 30
            const mb = 100 * (mean(run) / r.nominal - 1)
            return (
              <g key={k}>
                {run.map((v, p) => (
                  <circle key={p} r={3.2} cx={0} cy={0} fill={RUN_COLOR[k]} fillOpacity={0.85}
                    style={{ transform: `translate(${mx + (p - 2) * 4}px, ${y(100 * (v / r.nominal - 1))}px)`, transition: 'transform 600ms cubic-bezier(.2,.8,.2,1)' }} />
                ))}
                <rect x={0} y={0} width={18} height={3} rx={1.5} fill={r.runOk[k] ? RUN_COLOR[k] : 'var(--destructive)'}
                  style={{ transform: `translate(${mx - 9}px, ${y(mb) - 1.5}px)`, transition: 'transform 600ms cubic-bezier(.2,.8,.2,1)' }} />
              </g>
            )
          })}
          <text x={cx(i)} y={bottom + 18} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{r.key}</text>
          <text x={cx(i)} y={bottom + 31} textAnchor="middle" className="fill-muted-foreground text-[10px]">±{r.limit}% · {r.nominal} µg/mL</text>
        </g>
      ))}
    </svg>
  )
}

function VerdictRing({ experiments }: { experiments: { status: Status }[] }) {
  const pass = experiments.filter(e => e.status === 'pass').length
  const fail = experiments.filter(e => e.status === 'fail').length
  const total = experiments.length, C = 2 * Math.PI * 34
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90">
        <circle cx={40} cy={40} r={34} fill="none" stroke="var(--border)" strokeWidth={7} />
        {pass > 0 && <circle cx={40} cy={40} r={34} fill="none" stroke="var(--success)" strokeWidth={7}
          strokeDasharray={`${(pass / total) * C} ${C}`} className="transition-all duration-700" />}
        {fail > 0 && <circle cx={40} cy={40} r={34} fill="none" stroke="var(--destructive)" strokeWidth={7}
          strokeDasharray={`${(fail / total) * C} ${C}`} strokeDashoffset={-(pass / total) * C} className="transition-all duration-700" />}
      </svg>
      <div>
        <p className={cn('text-lg font-semibold', fail ? 'text-destructive' : 'text-foreground')}>
          {fail ? `${fail} experiment${fail > 1 ? 's' : ''} fail${fail > 1 ? '' : 's'}` : 'Everything run so far passes'}
        </p>
        <p className="text-xs text-muted-foreground"><span className="num">{pass}</span> pass · <span className="num">{fail}</span> fail · <span className="num">{total - pass - fail}</span> open. Without data, an experiment never counts as passed.</p>
      </div>
    </div>
  )
}

function EvaluateStep({ ev, scenario, setScenario, shift, setShift }: {
  ev: ReturnType<typeof useEvaluation>; scenario: string; setScenario: (s: Scenario) => void; shift: number; setShift: (v: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Try a scenario:</span>
        {SCENARIOS.map(s => (
          <button key={s.key} type="button" onClick={() => setScenario(s)}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              scenario === s.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50')}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs font-semibold text-foreground">Accuracy profile · every replicate, 3 runs × 5</p>
            <div className="flex gap-3 text-[11px] text-muted-foreground">
              {RUN_COLOR.map((c, i) => <span key={i} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />Run {i + 1}</span>)}
            </div>
          </div>
          <AccuracyProfile rows={ev.rows} />
          <label className="mt-1 block px-1">
            <span className="flex justify-between text-[11px] text-muted-foreground"><span>Drag: shift MQC run 2</span><span className="num text-foreground">{pct(shift)}</span></span>
            <input type="range" min={-25} max={25} step={0.5} value={shift} onChange={e => setShift(+e.target.value)} className="w-full accent-[var(--primary)]" />
          </label>
        </div>
        <div className="space-y-3">
          <VerdictRing experiments={ev.experiments} />
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {ev.experiments.map(e => {
              const s = STATUS[e.status]
              return (
                <li key={e.name} className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors duration-500', s.ring)}>
                  <s.icon size={14} className={cn('shrink-0', s.tone)} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{e.name}</span>
                  <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">{e.note}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">The engine never takes a %CV from you: it recomputes bias and precision from the concentrations. Between-run precision comes from a one-way ANOVA, not from pooling replicates.</p>
    </div>
  )
}

/* ── Step 4 · Dossier ──────────────────────────────────────────────────── */
function DossierStep({ ev }: { ev: ReturnType<typeof useEvaluation> }) {
  const fails = ev.experiments.filter(e => e.status === 'fail')
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="relative mx-auto w-full max-w-xl rotate-[-0.6deg] rounded-md bg-white p-6 text-slate-900 shadow-2xl ring-1 ring-black/10 transition-transform duration-500 hover:rotate-0">
        <span className="pointer-events-none absolute right-6 top-16 rotate-[-18deg] rounded border-2 border-slate-300 px-2 py-0.5 text-[10px] font-bold tracking-widest text-slate-300">SYNTHETIC EXAMPLE</span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Validation report · V07</p>
        <h4 className="mt-1 text-lg font-semibold leading-tight">Voriconazole in human plasma (K₂-EDTA)</h4>
        <p className="mt-0.5 text-[11px] text-slate-500">Rules koine-rules@1.0.0 · ICH M10 profile · LC-MS/MS, ESI+ · 0.10–10.0 µg/mL</p>
        <table className="mt-4 w-full text-[11px]">
          <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-1 font-medium">Experiment</th><th className="py-1 font-medium">Result</th><th className="py-1 text-right font-medium">Status</th></tr></thead>
          <tbody>
            {ev.experiments.map(e => (
              <tr key={e.name} className="border-b border-slate-100">
                <td className="py-1">{e.name}</td><td className="py-1 text-slate-500">{e.note}</td>
                <td className={cn('py-1 text-right font-semibold', e.status === 'pass' ? 'text-green-700' : e.status === 'fail' ? 'text-red-700' : 'text-amber-700')}>{STATUS[e.status].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 rounded bg-slate-50 px-3 py-2 text-[11px]">
          <span className="font-semibold">Measuring interval you can claim: </span>
          {fails.length ? <span className="text-red-700">not yet — {fails.map(f => f.name.toLowerCase()).join(', ')} must be resolved first</span> : '0.10–10.0 µg/mL, pending the open experiments'}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-[10px] text-slate-500">
          {['Prepared', 'Reviewed', 'Approved'].map(s => <div key={s}><div className="mb-1 h-6 border-b border-slate-300" />{s}</div>)}
        </div>
      </div>
      <ul className="space-y-2 text-xs">
        {[
          ['Every run, including failed ones', 'with the reason it was rejected'],
          ['Every exclusion', 'who, when and why'],
          ['Criteria and engine version', 'so the result can be reproduced'],
          ['Attachments still missing', 'certificates of analysis, chromatograms'],
        ].map(([a, b]) => (
          <li key={a} className="flex gap-2 rounded-lg border border-border bg-card px-3 py-2"><FileCheck2 size={14} className="mt-0.5 shrink-0 text-primary" />
            <span><span className="font-medium text-foreground">{a}</span> <span className="text-muted-foreground">— {b}</span></span></li>
        ))}
        <li>
          <Link to="/validation/sample-dossier"
            className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary/85">
            <span>Open the full sample dossier<span className="block text-[11px] font-normal opacity-80">9 pages, ready for an auditor · completed study</span></span>
            <ArrowRight size={16} />
          </Link>
        </li>
      </ul>
    </div>
  )
}

/* ── Player: one continuous, looping walkthrough ───────────────────────── */
type SceneKey = 'design' | 'upload' | 'evaluate' | 'weighting' | 'tolerance' | 'comparison' | 'sigma' | 'traceable' | 'dossier'
const CHAPTERS = [
  { label: 'Design', icon: ClipboardList },
  { label: 'Upload', icon: Upload },
  { label: 'Evaluate', icon: Wand2 },
  { label: 'Statistics', icon: SigmaIcon },
  { label: 'Dossier', icon: FileCheck2 },
]
const SCENES: { key: SceneKey; chapter: number; ms: number; caption: string }[] = [
  { key: 'design', chapter: 0, ms: 6000, caption: 'Import a method from the library — chromatography, sample prep and every transition, nothing retyped — and get a locked plan with a code for every injection.' },
  { key: 'upload', chapter: 1, ms: 5500, caption: 'Drop the export of your quantitation software. Every injection finds its place in the plan by its name.' },
  { key: 'evaluate', chapter: 2, ms: 8000, caption: 'Bias and precision recomputed from the raw concentrations and judged against the profile. Here run 2 drifts.' },
  { key: 'weighting', chapter: 3, ms: 6000, caption: 'Calibration weighting chosen on evidence, not habit: the fit with the lowest total back-calculation error wins.' },
  { key: 'tolerance', chapter: 3, ms: 7000, caption: 'Total error with β-expectation tolerance intervals. Ask for more certainty and the LLOQ drops out of the range.' },
  { key: 'comparison', chapter: 3, ms: 7000, caption: 'Method comparison on 40 patient samples: Passing–Bablok and Bland–Altman, with confidence intervals.' },
  { key: 'sigma', chapter: 3, ms: 6500, caption: 'Sigma metrics turn the validation into routine QC rules, for the allowable error your laboratory sets.' },
  { key: 'traceable', chapter: 4, ms: 6500, caption: 'Nothing typed, nothing lost: every number in the report walks back to the injection it came from.' },
  { key: 'dossier', chapter: 4, ms: 8000, caption: 'A report that shows everything, including what failed and what is still missing.' },
]
const TOTAL = SCENES.reduce((s, x) => s + x.ms, 0)
const START = SCENES.map((_, i) => SCENES.slice(0, i).reduce((s, x) => s + x.ms, 0))
const TRACE_CODE = 'V07-D01R2-MQC-03'
const TRACE_ROW = PLAN.all.findIndex(i => i.code === TRACE_CODE) + 2
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

/* What each scene shows at time t, unless the visitor has taken over. */
function cue(key: SceneKey, t: number) {
  switch (key) {
    case 'design': return { highlight: t < 1400 ? null : HIGHLIGHTS[Math.floor((t - 1400) / 750) % HIGHLIGHTS.length] }
    case 'upload': return { done: Math.min(EXPORT.length, Math.round((t / 4000) * EXPORT.length)) }
    case 'evaluate': return { sc: t < 3000 ? SCENARIOS[0] : SCENARIOS[1] }
    case 'weighting': return { w: (t < 1800 ? '1' : t < 3600 ? '1/x' : BEST_WEIGHTING) as Weighting }
    case 'tolerance': return { beta: t < 2000 ? 0.8 : t < 4200 ? 0.9 : 0.95 }
    case 'comparison': return { view: (t < 3500 ? 'pb' : 'ba') as 'pb' | 'ba' }
    case 'sigma': return { tea: Math.min(25, 10 + Math.floor(t / 300)) }
    case 'traceable': return { progress: Math.min(1, t / 4000) }
    default: return {}
  }
}

export default function ValidationDemo() {
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const [scene, setScene] = useState(0)
  const [t, setT] = useState(0)
  const [paused, setPaused] = useState(reduce)
  const [inView, setInView] = useState(false)
  const [override, setOverride] = useState<Record<string, any>>({})
  const [userSc, setUserSc] = useState<Scenario | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const running = !paused && inView

  // Plays while on screen, like a muted video; pauses when scrolled away.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const id = window.setInterval(() => { const now = performance.now(), dt = now - last; last = now; setT(v => v + dt) }, 100)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (t < SCENES[scene].ms) return
    const next = (scene + 1) % SCENES.length
    if (next === 0) setUserSc(null)
    setScene(next); setT(0); setOverride({})
  }, [t, scene])

  const seek = (i: number) => { setScene(i); setT(0); setOverride({}) }
  const takeOver = (k: string, v: unknown) => { setOverride(o => ({ ...o, [k]: v })); setPaused(true) }
  const toggle = () => { if (paused) { setOverride({}); setPaused(false) } else setPaused(true) }

  const s = SCENES[scene], c: any = { ...cue(s.key, t), ...override }
  const evSc = s.key === 'evaluate' ? (userSc ?? c.sc) : (userSc ?? SCENARIOS[1])
  const ev = useEvaluation(evSc)
  const elapsed = START[scene] + Math.min(t, s.ms)

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background/40 px-3 py-2.5">
        {CHAPTERS.map((ch, i) => {
          const first = SCENES.findIndex(x => x.chapter === i)
          return (
            <button key={ch.label} type="button" onClick={() => seek(first)}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-300',
                s.chapter === i ? 'bg-primary text-primary-foreground' : s.chapter > i ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted')}>
              <ch.icon size={13} /> <span className="num opacity-70">{i + 1}</span> {ch.label}
            </button>
          )
        })}
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex min-h-[2.5rem] items-start gap-2">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-primary" />
          <p key={s.key} className="animate-in fade-in slide-in-from-left-1 text-sm text-foreground duration-500">{s.caption}</p>
        </div>
        <div key={s.key} className="flex min-h-[340px] flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 lg:min-h-[495px]">
          {s.key === 'design' && <DesignStep highlight={c.highlight} />}
          {s.key === 'upload' && <UploadStep done={c.done} />}
          {s.key === 'evaluate' && <EvaluateStep ev={ev} scenario={evSc.key} setScenario={x => { setUserSc({ ...x }); setPaused(true) }}
            shift={evSc.shift} setShift={v => { setUserSc({ ...evSc, key: 'custom', label: 'Custom', shift: v }); setPaused(true) }} />}
          {s.key === 'weighting' && <WeightingScene value={c.w} onChange={w => takeOver('w', w)} />}
          {s.key === 'tolerance' && <ToleranceScene value={c.beta} onChange={b => takeOver('beta', b)} />}
          {s.key === 'comparison' && <ComparisonScene value={c.view} onChange={v => takeOver('view', v)} />}
          {s.key === 'sigma' && <SigmaScene value={c.tea} onChange={v => takeOver('tea', v)} />}
          {s.key === 'traceable' && <TraceableScene progress={c.progress} injections={PLAN.all.length} traceCode={TRACE_CODE} traceRow={TRACE_ROW} />}
          {s.key === 'dossier' && <DossierStep ev={ev} />}
        </div>
      </div>

      {/* Transport bar: play/pause, chapter timeline you can click, time */}
      <div className="flex items-center gap-3 border-t border-border bg-background/40 px-3 py-2">
        <button type="button" onClick={toggle} aria-label={paused ? 'Play' : 'Pause'}
          className={cn('flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
            paused ? 'bg-primary text-primary-foreground hover:bg-primary/85' : 'border border-border text-muted-foreground hover:text-foreground')}>
          {paused ? <><Play size={13} /> {Object.keys(override).length || userSc ? 'Resume' : 'Play'}</> : <><Pause size={13} /> Pause</>}
        </button>
        <div className="flex h-8 flex-1 items-center gap-0.5" role="group" aria-label="Walkthrough timeline">
          {SCENES.map((x, i) => (
            <button key={x.key} type="button" onClick={() => seek(i)} title={`${CHAPTERS[x.chapter].label} · ${x.key}`}
              className="group flex h-full items-center" style={{ flexGrow: x.ms, flexBasis: 0 }}>
              <span className={cn('relative h-1.5 w-full overflow-hidden rounded-full transition-all group-hover:h-2.5', i < scene ? 'bg-primary/60' : 'bg-muted')}>
                {i === scene && <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, (t / x.ms) * 100)}%` }} />}
              </span>
            </button>
          ))}
        </div>
        <span className="num hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{clock(elapsed)} / {clock(TOTAL)}</span>
      </div>
      <p className="border-t border-border bg-background/40 px-4 py-2 text-[11px] text-muted-foreground">
        {paused && (Object.keys(override).length || userSc) ? 'Paused while you explore. Press Resume to continue the walkthrough. · ' : ''}
        Synthetic example: voriconazole in human plasma, 0.10–10.0 µg/mL, ICH M10 criteria. Not a laboratory’s data.
      </p>
    </div>
  )
}
