import { useMemo, type ReactNode } from 'react'
import { ArrowLeft, BadgeCheck, CircleX, ExternalLink, Fingerprint } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BASE, CALIBRATORS, CAL_FIT, CAL_RESPONSES, COMPARISON, LEVELS, UNIT } from './sampleStudy'
import { blandAltman, passingBablok, qcRule, sigmaMetric, toleranceInterval, wls, type Weighting } from './stats'

/* Statistics scenes of the walkthrough. Each one is driven by the timeline
 * (value) and can be taken over by the visitor (onChange pauses the video).
 * Every scene states its inputs, its method and its reference, as the dossier will. */

const f = (v: number, d = 1) => v.toFixed(d)
const sgn = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-300', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/50')}>
      {children}
    </button>
  )
}
function Audit({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <Fingerprint size={13} className="mt-0.5 shrink-0 text-primary" /><span>{children}</span>
    </p>
  )
}
const Layout = ({ visual, side }: { visual: ReactNode; side: ReactNode }) => (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
    <div className="rounded-xl border border-border bg-background/60 p-3">{visual}</div>
    <div className="space-y-3">{side}</div>
  </div>
)
const ease = 'transform 650ms cubic-bezier(.2,.8,.2,1)'

/* 1 · Weighting ─────────────────────────────────────────────────────────── */
const CAL_X = CAL_RESPONSES.flatMap(() => CALIBRATORS), CAL_Y = CAL_RESPONSES.flat()
const FITS = (['1', '1/x', '1/x²'] as Weighting[]).map(w => ({ w, ...wls(CAL_X, CAL_Y, w) }))
const BEST = FITS.reduce((a, b) => (b.sumAbsRe < a.sumAbsRe ? b : a))
export const BEST_WEIGHTING = BEST.w

export function WeightingScene({ value, onChange }: { value: Weighting; onChange: (w: Weighting) => void }) {
  const fit = FITS.find(r => r.w === value)!
  const max = Math.max(...FITS.map(r => r.sumAbsRe))
  const W = 560, H = 250, L = 46, R = W - 12, T = 14, B = 214
  const lx = (c: number) => L + 14 + (Math.log10(c) + 1) / 2 * (R - L - 28)
  const ly = (re: number) => T + (30 - Math.max(-30, Math.min(30, re))) / 60 * (B - T)
  const out = fit.re.filter((re, i) => Math.abs(re) > (CAL_X[i] === CALIBRATORS[0] ? 20 : 15)).length
  return (
    <Layout
      visual={<>
        <p className="px-1 text-xs font-semibold text-foreground">Back-calculated error of all 24 calibrators · weighting <span className="num text-primary">{value}</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Back-calculated error of each calibrator for the selected weighting">
          <rect x={L} width={R - L} y={ly(15)} height={ly(-15) - ly(15)} fill="var(--success)" fillOpacity={0.07} />
          {[-30, -15, 0, 15, 30].map(t => <g key={t}><line x1={L} x2={R} y1={ly(t)} y2={ly(t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={L - 8} y={ly(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t > 0 ? '+' : ''}{t}%</text></g>)}
          {CALIBRATORS.map(c => <text key={c} x={lx(c)} y={B + 18} textAnchor="middle" className="fill-muted-foreground text-[10px]">{c}</text>)}
          <text x={(L + R) / 2} y={B + 33} textAnchor="middle" className="fill-muted-foreground text-[10px]">calibrator ({UNIT}, log scale)</text>
          {fit.re.map((re, i) => {
            const bad = Math.abs(re) > (CAL_X[i] === CALIBRATORS[0] ? 20 : 15)
            return <circle key={i} r={4.5} cx={0} cy={0} fill={bad ? 'var(--destructive)' : `var(--chart-${(i / 8 | 0) + 1})`} fillOpacity={0.9}
              style={{ transform: `translate(${lx(CAL_X[i]) + ((i / 8) | 0) * 7 - 7}px, ${ly(re)}px)`, transition: `${ease}, fill 400ms` }} />
          })}
        </svg>
      </>}
      side={<>
        <p className="text-sm font-semibold text-foreground">Which weighting? The data decide.</p>
        <div className="space-y-2">
          {FITS.map(r => (
            <button key={r.w} type="button" onClick={() => onChange(r.w)} className="flex w-full items-center gap-2 text-left">
              <span className={cn('num w-10 text-xs', value === r.w ? 'font-semibold text-primary' : 'text-foreground')}>{r.w}</span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                <span className={cn('absolute inset-y-0 left-0 rounded transition-all duration-500', r.w === BEST.w ? 'bg-success' : 'bg-muted-foreground/40', value === r.w && 'ring-2 ring-inset ring-primary')}
                  style={{ width: `${(r.sumAbsRe / max) * 100}%` }} />
              </span>
              <span className="num w-14 text-right text-xs text-foreground">{f(r.sumAbsRe)}%</span>
            </button>
          ))}
          <p className="text-[11px] text-muted-foreground">Σ|%RE| over all calibrators. Shorter is better.</p>
        </div>
        <div className={cn('rounded-lg border px-3 py-2 text-xs transition-colors duration-500', value === BEST.w ? 'border-success/40 bg-success/10' : 'border-border bg-card')}>
          {value === BEST.w
            ? <span className="text-foreground"><b>{BEST.w}</b> gives the lowest total error and is recorded with its reason.</span>
            : <span className="text-foreground"><b>{value}</b>: {f(fit.sumAbsRe - BEST.sumAbsRe)}% more total error than {BEST.w}{out ? ` · ${out} calibrator${out > 1 ? 's' : ''} outside limits` : ''}.</span>}
          <span className="num mt-1 block text-[11px] text-muted-foreground">slope {f(fit.slope, 4)} · intercept {f(fit.intercept, 4)}</span>
        </div>
        <Audit>wls() · 24 calibrator injections (3 runs × 8) · weighted least squares on the analyte/IS ratio · choice by Σ|%RE|</Audit>
      </>}
    />
  )
}

/* 2 · β-expectation tolerance intervals ────────────────────────────────── */
export function ToleranceScene({ value, onChange }: { value: number; onChange: (b: number) => void }) {
  const ti = useMemo(() => LEVELS.map((l, i) => ({ ...l, ...toleranceInterval(BASE[i], l.nominal, value) })), [value])
  const inside = ti.map(t => t.low >= -t.limit && t.high <= t.limit)
  let first = ti.length
  for (let i = ti.length - 1; i >= 0 && inside[i]; i--) first = i
  const W = 560, H = 250, L = 46, R = W - 12, T = 12, B = 214
  const y = (v: number) => T + (30 - Math.max(-30, Math.min(30, v))) / 60 * (B - T)
  const cx = (i: number) => L + 64 + i * ((R - L - 128) / 3)
  return (
    <Layout
      visual={<>
        <p className="px-1 text-xs font-semibold text-foreground">Accuracy profile · β-expectation tolerance interval per level, β = <span className="num text-primary">{Math.round(value * 100)}%</span></p>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tolerance interval of each level against the acceptance limits">
          {[-30, -20, -15, 0, 15, 20, 30].map(t => <g key={t}><line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? '3 4' : undefined} />
            <text x={L - 8} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t > 0 ? '+' : ''}{t}%</text></g>)}
          {ti.map((t, i) => (
            <g key={t.key}>
              <rect x={cx(i) - 46} width={92} y={y(t.limit)} height={y(-t.limit) - y(t.limit)} rx={6} fill={inside[i] ? 'var(--success)' : 'var(--destructive)'} fillOpacity={inside[i] ? 0.08 : 0.13} className="transition-all duration-500" />
              <rect x={cx(i) - 9} width={18} y={0} height={1} rx={0} fill={inside[i] ? 'var(--primary)' : 'var(--destructive)'} fillOpacity={0.85}
                style={{ transform: `translateY(${y(t.high)}px) scaleY(${y(t.low) - y(t.high)})`, transformOrigin: '0 0', transition: `${ease}, fill 400ms` }} />
              <circle cx={cx(i)} r={5} cy={0} fill="var(--foreground)" style={{ transform: `translateY(${y(t.biasPct)}px)`, transition: ease }} />
              <text x={cx(i) + 14} y={0} className="num fill-muted-foreground text-[10px]" style={{ transform: `translateY(${y(t.high) + 3}px)`, transition: ease }}>{sgn(t.high)}</text>
              <text x={cx(i) + 14} y={0} className="num fill-muted-foreground text-[10px]" style={{ transform: `translateY(${y(t.low) + 3}px)`, transition: ease }}>{sgn(t.low)}</text>
              <text x={cx(i)} y={B + 18} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{t.key}</text>
              <text x={cx(i)} y={B + 31} textAnchor="middle" className="fill-muted-foreground text-[10px]">±{t.limit}% · {t.nominal} {UNIT}</text>
            </g>
          ))}
        </svg>
      </>}
      side={<>
        <p className="text-sm font-semibold text-foreground">Not “did the QCs pass?” but “where will tomorrow’s results fall?”</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">β {[0.8, 0.9, 0.95].map(b => <Pill key={b} active={value === b} onClick={() => onChange(b)}>{b * 100}%</Pill>)}</div>
        <div className={cn('rounded-lg border px-3 py-2 transition-colors duration-500', first === 0 ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10')}>
          <p className="text-[11px] text-muted-foreground">Validated interval at β = {value * 100}%</p>
          <p className="num text-xl font-semibold text-foreground">{first < ti.length ? `${ti[first].nominal.toFixed(2)}–${ti[ti.length - 1].nominal.toFixed(1)} ${UNIT}` : 'none'}</p>
          {first > 0 && first < ti.length && <p className="text-[11px] text-foreground">{ti.slice(0, first).map(t => t.key).join(', ')} outside the limits: the range shrinks on its own.</p>}
        </div>
        <ul className="space-y-1 text-xs">
          {ti.map((t, i) => (
            <li key={t.key} className="flex items-center gap-2">
              {inside[i] ? <BadgeCheck size={13} className="text-success" /> : <CircleX size={13} className="text-destructive" />}
              <span className="w-10 font-medium text-foreground">{t.key}</span>
              <span className="num text-muted-foreground">{sgn(t.low)} to {sgn(t.high)}% (limit ±{t.limit}%)</span>
            </li>
          ))}
        </ul>
        <Audit>toleranceInterval() · 60 QC results (4 levels × 3 runs × 5) · Mee 1984 / SFSTP accuracy profile · variance components from one-way ANOVA</Audit>
      </>}
    />
  )
}

/* 3 · Method comparison ────────────────────────────────────────────────── */
const XS = COMPARISON.map(c => c.x), YS = COMPARISON.map(c => c.y)
const PB = passingBablok(XS, YS), BA = blandAltman(XS, YS)

export function ComparisonScene({ value, onChange }: { value: 'pb' | 'ba'; onChange: (v: 'pb' | 'ba') => void }) {
  const noDiff = PB.slopeLo <= 1 && PB.slopeHi >= 1 && PB.interceptLo <= 0 && PB.interceptHi >= 0
  const W = 560, H = 250, L = 46, R = W - 12, T = 12, B = 222, mx = 9.5
  const px = (v: number) => L + v / mx * (R - L), py = (v: number) => B - v / mx * (B - T)
  const bx = (v: number) => L + 6 + Math.log10(v / 0.25) / Math.log10(10 / 0.25) * (R - L - 12)
  const by = (d: number) => T + (25 - Math.max(-25, Math.min(25, d))) / 50 * (B - T)
  const pb = value === 'pb'
  return (
    <Layout
      visual={<>
        <p className="px-1 text-xs font-semibold text-foreground">{pb ? 'Passing–Bablok regression · 40 patient samples' : 'Bland–Altman · relative difference vs mean'}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={pb ? 'Passing–Bablok regression' : 'Bland–Altman plot'}>
          {pb ? <>
            {[0, 2, 4, 6, 8].map(t => <g key={t}>
              <line x1={px(0)} x2={px(mx)} y1={py(t)} y2={py(t)} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={L - 8} y={py(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t}</text>
              <text x={px(t)} y={B + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">{t}</text></g>)}
            <line x1={px(0)} y1={py(0)} x2={px(mx)} y2={py(mx)} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="5 4" />
            <line x1={px(0)} y1={py(PB.intercept)} x2={px(mx)} y2={py(PB.intercept + PB.slope * mx)} stroke="var(--primary)" strokeWidth={2.5} className="animate-in fade-in duration-700" />
            {COMPARISON.map((c, i) => <circle key={i} cx={px(c.x)} cy={py(c.y)} r={4} fill="var(--chart-3)" fillOpacity={0.85} className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }} />)}
            <text x={L + 6} y={T + 10} className="fill-muted-foreground text-[10px]">this method ({UNIT})</text>
            <text x={R} y={B - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">current method ({UNIT}) · dashed: identity</text>
          </> : <>
            {[-20, -10, 0, 10, 20].map(t => <g key={t}><line x1={L} x2={R} y1={by(t)} y2={by(t)} stroke="var(--border)" strokeDasharray={t ? '2 5' : undefined} />
              <text x={L - 8} y={by(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{t > 0 ? '+' : ''}{t}%</text></g>)}
            <rect x={L} width={R - L} y={by(BA.loaPct[1])} height={by(BA.loaPct[0]) - by(BA.loaPct[1])} fill="var(--chart-2)" fillOpacity={0.07} />
            {[BA.loaPct[0], BA.meanPct, BA.loaPct[1]].map((v, i) => <g key={i}><line x1={L} x2={R} y1={by(v)} y2={by(v)} stroke={i === 1 ? 'var(--primary)' : 'var(--chart-2)'} strokeWidth={i === 1 ? 2 : 1.5} strokeDasharray={i === 1 ? undefined : '6 4'} />
              <text x={R - 2} y={by(v) - 4} textAnchor="end" className="num fill-foreground text-[10px]">{i === 1 ? 'mean ' : i ? 'upper LoA ' : 'lower LoA '}{sgn(v)}%</text></g>)}
            {COMPARISON.map((c, i) => <circle key={i} cx={bx((c.x + c.y) / 2)} cy={by(BA.diffs[i])} r={4} fill="var(--chart-3)" fillOpacity={0.85} className="animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }} />)}
            <text x={L + 6} y={B + 16} className="fill-muted-foreground text-[10px]">mean of both methods ({UNIT}, log scale)</text>
          </>}
        </svg>
      </>}
      side={<>
        <p className="text-sm font-semibold text-foreground">Against your current method, with confidence intervals.</p>
        <div className="flex gap-1.5"><Pill active={pb} onClick={() => onChange('pb')}>Passing–Bablok</Pill><Pill active={!pb} onClick={() => onChange('ba')}>Bland–Altman</Pill></div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <dt className="text-muted-foreground">Slope [95% CI]</dt><dd className="num text-right text-foreground">{f(PB.slope, 3)} [{f(PB.slopeLo, 3)}–{f(PB.slopeHi, 3)}]</dd>
          <dt className="text-muted-foreground">Intercept [95% CI]</dt><dd className="num text-right text-foreground">{f(PB.intercept, 3)} [{f(PB.interceptLo, 3)}–{f(PB.interceptHi, 3)}]</dd>
          <dt className="text-muted-foreground">Mean difference</dt><dd className="num text-right text-foreground">{sgn(BA.meanPct)}%</dd>
          <dt className="text-muted-foreground">95% limits of agreement</dt><dd className="num text-right text-foreground">{sgn(BA.loaPct[0])} to {sgn(BA.loaPct[1])}%</dd>
          <dt className="text-muted-foreground">Bias at 1.0 / 5.5 {UNIT}</dt><dd className="num text-right text-foreground">{[1, 5.5].map(d => `${sgn(100 * ((PB.intercept + PB.slope * d) / d - 1))}%`).join(' / ')}</dd>
        </dl>
        <p className={cn('rounded-lg border px-3 py-2 text-xs font-medium', noDiff ? 'border-success/40 bg-success/10 text-foreground' : 'border-warning/40 bg-warning/10 text-foreground')}>
          {noDiff ? 'Slope CI includes 1 and intercept CI includes 0: no systematic difference shown.' : 'A systematic difference is shown: review it against your allowable bias.'}
        </p>
        <Audit>passingBablok(), blandAltman() · 40 paired patient results · Passing & Bablok 1983, rank-based 95% CI · CLSI EP09 design</Audit>
      </>}
    />
  )
}

/* 4 · Sigma metrics → QC rules ─────────────────────────────────────────── */
export function SigmaScene({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const rows = LEVELS.filter(l => l.key !== 'LLOQ').map(l => {
    const i = LEVELS.indexOf(l), t = toleranceInterval(BASE[i], l.nominal, 0.9)
    const s = sigmaMetric(value, t.biasPct, t.cvIp)
    return { key: l.key, bias: t.biasPct, cv: t.cvIp, sigma: s, rule: qcRule(s) }
  })
  const tone = (s: number) => (s >= 6 ? 'bg-success' : s >= 4 ? 'bg-primary' : 'bg-destructive')
  return (
    <Layout
      visual={<>
        <label className="block px-1">
          <span className="flex justify-between text-xs"><span className="font-semibold text-foreground">Allowable total error (TEa) your laboratory sets</span><span className="num text-base font-semibold text-primary">{Math.round(value)}%</span></span>
          <input type="range" min={10} max={30} step={1} value={Math.round(value)} onChange={e => onChange(+e.target.value)} className="w-full accent-[var(--primary)]" />
        </label>
        <div className="mt-3 space-y-4 px-1">
          {rows.map(r => (
            <div key={r.key}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-foreground">{r.key}</span>
                <span className="num text-muted-foreground">bias {sgn(r.bias)}% · CV {f(r.cv)}% → <b className="text-base text-foreground">{f(r.sigma)} σ</b></span>
              </div>
              <div className="relative mt-1 h-4 rounded-full bg-muted">
                <div className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', tone(r.sigma))} style={{ width: `${Math.min(100, Math.max(2, r.sigma / 8 * 100))}%` }} />
                {[3, 4, 5, 6].map(m => <span key={m} className="absolute inset-y-0 w-0.5 bg-background" style={{ left: `${m / 8 * 100}%` }} />)}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Suggested QC: <span className="num font-medium text-foreground">{r.rule.rules}</span> · N = {r.rule.n}</p>
            </div>
          ))}
          <div className="relative h-3 text-[10px] text-muted-foreground">{[3, 4, 5, 6].map(m => <span key={m} className="absolute -translate-x-1/2" style={{ left: `${m / 8 * 100}%` }}>{m}σ</span>)}</div>
        </div>
      </>}
      side={<>
        <p className="text-sm font-semibold text-foreground">The validation sets up routine QC.</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Bias and intermediate precision from the validation give a sigma metric for every QC level. The higher the sigma, the simpler the rules and the fewer QCs per run.
        </p>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-success" /> ≥ 6σ: a single 1-3s rule</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> 4–6σ: multirule</li>
          <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> &lt; 4σ: full multirule, more QCs</li>
        </ul>
        <Audit>sigmaMetric(), qcRule() · σ = (TEa − |bias|) / CV · bias and CV from the validation study · Westgard Sigma Rules</Audit>
      </>}
    />
  )
}

/* 5 · Traceability: nothing typed, every number traced ────────────────── */
export function TraceableScene({ progress, injections, traceCode, traceRow }: { progress: number; injections: number; traceCode: string; traceRow: number }) {
  const typed = injections * 3
  const conc = BASE[2][1][2], ratio = CAL_FIT[1].intercept + CAL_FIT[1].slope * conc
  const trail = [
    ['Dossier, page 6', `MQC · run 2 mean bias, from 5 replicates`],
    ['Result', `${conc.toFixed(3)} ${UNIT} · replicate 3`],
    ['Calculation', `ratio ${ratio.toFixed(4)} on run 2 curve, 1/x²`],
    ['Export', `quant_export_voriconazole.csv · row ${traceRow}`],
    ['Sample name', traceCode],
  ]
  const shown = Math.min(trail.length, Math.floor(progress * 1.6 * trail.length))
  return (
    <Layout
      visual={<div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[[Math.round(typed * Math.min(1, progress * 1.5)), 'values read from the export instead of typed', 'text-foreground'],
            [0, 'spreadsheet formulas to write or check', 'text-foreground'],
            [`${Math.round(100 * Math.min(1, progress * 1.5))}%`, 'of numbers traceable to their injection', 'text-success']].map(([v, k, c]) => (
            <div key={k as string} className="rounded-lg border border-border bg-card px-2 py-3">
              <p className={cn('num text-3xl font-semibold', c as string)}>{v}</p><p className="text-[11px] leading-tight text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 px-1 text-xs font-semibold text-foreground">Every number in the dossier walks back to the injection it came from:</p>
          <ol className="space-y-1.5">
            {trail.map(([k, v], i) => (
              <li key={k} className={cn('flex items-center gap-3 rounded-lg border px-3 py-1.5 text-xs transition-all duration-500',
                i < shown ? 'translate-x-0 border-primary/30 bg-primary/5 opacity-100' : 'translate-x-2 border-border opacity-0')} style={{ marginLeft: `${i * 14}px` }}>
                {i > 0 && <ArrowLeft size={12} className="shrink-0 rotate-[-45deg] text-primary" />}
                <span className="w-24 shrink-0 text-muted-foreground">{k}</span>
                <code className="num min-w-0 truncate text-foreground">{v}</code>
              </li>
            ))}
          </ol>
        </div>
      </div>}
      side={<>
        <p className="text-sm font-semibold text-foreground">Less typing, fewer places for errors to hide.</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {injections} injections × 3 values (analyte area, IS area, retention time) come straight from the quantitation export.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Manual entry is not error-free: in a pathology database, manually entered fields had a <b className="text-foreground">2.8%</b> error rate compared with electronic import
          (<a href="https://pubmed.ncbi.nlm.nih.gov/23793682/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Hong et al., BMJ Open 2013 <ExternalLink size={10} className="inline" /></a>).
          Field audits found errors in <b className="text-foreground">88%</b> of 113 operational spreadsheets
          (<a href="https://www.journalofaccountancy.com/issues/2015/nov/how-to-debug-excel-spreadsheets/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Panko’s audits, 1995–2007 <ExternalLink size={10} className="inline" /></a>).
        </p>
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Illustration only: typing these {typed} values at 2.8% would leave about <b className="text-foreground">{Math.round(typed * 0.028)}</b> wrong values to find.
          The rates come from other settings, not from LC-MS/MS validation.
        </p>
      </>}
    />
  )
}
