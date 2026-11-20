/* Synthetic voriconazole study shared by the validation demo and the sample
 * dossier, so both show the same numbers. Fixed seed, realistic noise.
 * Nothing here is a real laboratory's data. */

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const rand = rng(20261117)
const gauss = () => { const u = Math.max(rand(), 1e-9), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
export const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }
export const cvp = (a: number[]) => 100 * sd(a) / mean(a)
export const pct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`

/** One-way ANOVA with runs as groups. Returns repeatability CV and intermediate-precision CV (%). */
export function anova(groups: number[][]) {
  const n = groups[0].length, k = groups.length, gm = mean(groups.flat())
  const msw = groups.reduce((s, g) => s + g.reduce((t, x) => t + (x - mean(g)) ** 2, 0), 0) / (k * (n - 1))
  const msb = n * groups.reduce((s, g) => s + (mean(g) - gm) ** 2, 0) / (k - 1)
  const sb2 = Math.max(0, (msb - msw) / n)
  return { repeatabilityCv: 100 * Math.sqrt(msw) / gm, intermediateCv: 100 * Math.sqrt(msw + sb2) / gm }
}

export const UNIT = 'µg/mL'
export const LEVELS = [
  { key: 'LLOQ', nominal: 0.10, cv: 0.07, limit: 20 },
  { key: 'LQC', nominal: 0.30, cv: 0.045, limit: 15 },
  { key: 'MQC', nominal: 4.00, cv: 0.035, limit: 15 },
  { key: 'HQC', nominal: 8.00, cv: 0.035, limit: 15 },
] as const
export const RUNS = 3, REPS = 5
const runOffset = Array.from({ length: RUNS }, () => 0.02 * gauss())
/** [level][run][replicate] measured concentrations */
export const BASE: number[][][] = LEVELS.map(l => Array.from({ length: RUNS }, (_, r) =>
  Array.from({ length: REPS }, () => l.nominal * (1 + runOffset[r] + l.cv * gauss()))))
/** HQC accuracy (% of nominal) per matrix lot, used by the demo */
export const ME_LOTS = Array.from({ length: 6 }, () => 100 * (1 + 0.04 * gauss()))

/* ── Everything below is only used by the sample dossier ─────────────── */

export const CALIBRATORS = [0.10, 0.20, 0.50, 1.00, 2.00, 4.00, 7.50, 10.0]
/** back-calculated accuracy (% of nominal) [run][calibrator] */
export const CAL_BACK = Array.from({ length: RUNS }, () => CALIBRATORS.map((_, i) => 100 * (1 + (i === 0 ? 0.06 : 0.035) * gauss())))
export const CAL_FIT = Array.from({ length: RUNS }, () => ({
  slope: 0.412 * (1 + 0.03 * gauss()), intercept: 0.0009 * (1 + 0.5 * gauss()), r2: 0.9975 + 0.0015 * rand(),
}))

/** matrix effect: per lot, LQC and HQC triplicates (% of nominal) and IS-normalised matrix factor */
export const MATRIX = Array.from({ length: 6 }, (_, i) => {
  const lqc = Array.from({ length: 3 }, () => 100 * (1 + 0.035 + 0.05 * gauss() * 0.6))
  const hqc = Array.from({ length: 3 }, () => (i === 4 ? ME_LOTS[4] : 100 * (1 + 0.03 * gauss())) + 1.5 * gauss())
  return { lot: `BM-23${41 + i}`, type: i === 5 ? 'lipaemic' : i === 4 ? 'haemolysed' : 'normal', lqc, hqc, isMf: 0.97 + 0.04 * gauss() }
})

export const SELECTIVITY = Array.from({ length: 8 }, (_, i) => ({
  source: i < 6 ? `Individual donor ${i + 1}` : i === 6 ? 'Haemolysed (2% v/v)' : 'Lipaemic (Intralipid)',
  analytePctLloq: Math.max(0, 3 + 2.5 * gauss()), isPct: Math.max(0, 0.4 + 0.3 * gauss()),
}))

export const SPECIFICITY = [
  { compound: 'Voriconazole N-oxide (major metabolite)', conc: '10 µg/mL', effect: 1.8 },
  { compound: 'Fluconazole', conc: '80 µg/mL', effect: -0.9 },
  { compound: 'Posaconazole', conc: '5 µg/mL', effect: 0.6 },
  { compound: 'Isavuconazole', conc: '10 µg/mL', effect: -1.2 },
  { compound: 'Omeprazole', conc: '5 µg/mL', effect: 2.1 },
]

export const CARRYOVER = Array.from({ length: RUNS }, () => ({ analytePctLloq: Math.max(0, 7 + 3 * gauss()), isPct: Math.max(0, 0.3 + 0.2 * gauss()) }))

export const DILUTION = { factor: 10, nominal: 40, values: Array.from({ length: 5 }, () => 40 * (1 + 0.025 + 0.03 * gauss())) }

export const STABILITY = [
  { condition: 'Bench-top, room temperature', duration: '24 h', lqc: 100 + 4 * gauss(), hqc: 100 + 3 * gauss(), status: 'pass' as const },
  { condition: 'Freeze-thaw (−80 °C ↔ RT)', duration: '3 cycles', lqc: 100 + 4 * gauss(), hqc: 100 + 3 * gauss(), status: 'pass' as const },
  { condition: 'Processed extract, autosampler 8 °C', duration: '72 h', lqc: 100 + 4 * gauss(), hqc: 100 + 3 * gauss(), status: 'pass' as const },
  { condition: 'Whole blood before centrifugation, RT', duration: '4 h', lqc: 100 + 4 * gauss(), hqc: 100 + 3 * gauss(), status: 'pass' as const },
  { condition: 'Long-term, −80 °C', duration: '1 month (interim)', lqc: 100 + 4 * gauss(), hqc: 100 + 3 * gauss(), status: 'interim' as const },
]

export const REINJECTION = { delay: '48 h at 8 °C', lqc: 100 + 3 * gauss(), hqc: 100 + 2.5 * gauss() }

export const RUN_LOG = [
  { id: 'R1', date: '2026-10-05', analyst: 'Analyst A', purpose: 'Accuracy & precision, carry-over, selectivity', status: 'accepted', note: '' },
  { id: 'R2', date: '2026-10-05', analyst: 'Analyst B', purpose: 'Accuracy & precision, carry-over', status: 'rejected',
    note: '3 of 8 calibrators outside ±15%; IS working solution prepared at the wrong concentration (DEV-01). Repeated as R2b.' },
  { id: 'R2b', date: '2026-10-06', analyst: 'Analyst B', purpose: 'Accuracy & precision, carry-over', status: 'accepted', note: 'Repeat of R2' },
  { id: 'R3', date: '2026-10-07', analyst: 'Analyst A', purpose: 'Accuracy & precision, carry-over, dilution', status: 'accepted', note: '' },
  { id: 'R4', date: '2026-10-07', analyst: 'Analyst B', purpose: 'Matrix effect, specificity, stability (T0)', status: 'accepted', note: '' },
  { id: 'R5', date: '2026-10-09', analyst: 'Analyst A', purpose: 'Stability, reinjection reproducibility', status: 'accepted', note: '' },
  { id: 'R6', date: '2026-11-06', analyst: 'Analyst A', purpose: 'Long-term stability, 1 month', status: 'accepted', note: '' },
]

/* ── Statistics showcase (appended last so earlier numbers stay the same) ── */
/** Calibration responses (analyte/IS area ratio) for 3 runs, with noise proportional to concentration. */
export const CAL_RESPONSES = Array.from({ length: RUNS }, () => CALIBRATORS.map(c => (0.41 * c + 0.0004) * (1 + 0.035 * gauss())))
/** Method comparison: 40 patient samples, reference LC-MS/MS method (x) vs this method (y), µg/mL. */
export const COMPARISON = Array.from({ length: 40 }, () => {
  const x = Math.exp(Math.log(0.3) + rand() * (Math.log(9) - Math.log(0.3)))
  return { x: x * (1 + 0.03 * gauss()), y: (1.03 * x + 0.01) * (1 + 0.045 * gauss()) }
})
