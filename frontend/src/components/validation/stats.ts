/* Statistics used by the validation showcase. Pure functions, no dependencies,
 * so each result can be reproduced from its inputs. */

export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
export const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) }
export const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }

/* ── Student t quantile (via the regularised incomplete beta function) ── */
function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x; const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const ci of c) ser += ci / ++y
  return -tmp + Math.log(2.5066282746310005 * ser / x)
}
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d; let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b
}
/** P(T <= t) for Student's t with df degrees of freedom (df may be non-integer). */
export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t), p = 0.5 * ibeta(df / 2, 0.5, x)
  return t >= 0 ? 1 - p : p
}
/** Quantile of Student's t (bisection on the CDF). */
export function tInv(p: number, df: number): number {
  let lo = -1000, hi = 1000
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (tCdf(mid, df) < p) lo = mid; else hi = mid }
  return (lo + hi) / 2
}
/** Standard normal quantile (Acklam's approximation). */
export function zInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - pl) return -zInv(1 - p)
  const q = p - 0.5, r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/* ── Weighted least squares and weighting selection ───────────────────── */
export type Weighting = '1' | '1/x' | '1/x²'
export function wls(x: number[], y: number[], w: Weighting) {
  const wt = x.map(v => (w === '1' ? 1 : w === '1/x' ? 1 / v : 1 / (v * v)))
  const sw = wt.reduce((s, v) => s + v, 0)
  const mx = wt.reduce((s, v, i) => s + v * x[i], 0) / sw, my = wt.reduce((s, v, i) => s + v * y[i], 0) / sw
  const sxy = wt.reduce((s, v, i) => s + v * (x[i] - mx) * (y[i] - my), 0), sxx = wt.reduce((s, v, i) => s + v * (x[i] - mx) ** 2, 0)
  const slope = sxy / sxx, intercept = my - slope * mx
  const back = y.map(v => (v - intercept) / slope)
  const re = back.map((b, i) => 100 * (b / x[i] - 1))
  return { slope, intercept, re, sumAbsRe: re.reduce((s, v) => s + Math.abs(v), 0) }
}

/* ── β-expectation tolerance interval (total error accuracy profile) ─────
 * Mee (1984) as used in the SFSTP accuracy-profile approach (Hubert et al.).
 * runs: I groups of J replicates at one concentration level. Returns the
 * interval as relative error (%) around the nominal value. */
export function toleranceInterval(runs: number[][], nominal: number, beta = 0.9) {
  const I = runs.length, J = runs[0].length, all = runs.flat(), gm = mean(all)
  const ssw = runs.reduce((s, g) => s + g.reduce((t, x) => t + (x - mean(g)) ** 2, 0), 0)
  const ssb = J * runs.reduce((s, g) => s + (mean(g) - gm) ** 2, 0)
  const msw = ssw / (I * (J - 1)), msb = ssb / (I - 1)
  const s2r = msw, s2b = Math.max(0, (msb - msw) / J), s2ip = s2r + s2b
  const R = s2b / s2r, B = Math.sqrt((R + 1) / (J * R + 1))
  const nu = (R + 1) ** 2 / ((R + 1 / J) ** 2 / (I - 1) + (1 - 1 / J) / (I * J))
  const k = tInv((1 + beta) / 2, nu) * Math.sqrt(1 + 1 / (I * J * B * B))
  const biasPct = 100 * (gm / nominal - 1), sdPct = 100 * Math.sqrt(s2ip) / nominal
  return { biasPct, low: biasPct - k * sdPct, high: biasPct + k * sdPct, cvIp: 100 * Math.sqrt(s2ip) / gm, nu, k }
}

/* ── Passing–Bablok regression with 95% CI (Passing & Bablok, 1983) ───── */
export function passingBablok(x: number[], y: number[]) {
  const n = x.length, s: number[] = []
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
    const dx = x[j] - x[i], dy = y[j] - y[i]
    if (dx === 0 && dy === 0) continue
    const v = dx === 0 ? (dy > 0 ? Infinity : -Infinity) : dy / dx
    if (v !== -1) s.push(v)
  }
  s.sort((a, b) => a - b)
  const N = s.length, K = s.filter(v => v < -1).length
  const slope = N % 2 ? s[(N + 1) / 2 + K - 1] : Math.sqrt(s[N / 2 + K - 1] * s[N / 2 + K])
  const C = 1.959964 * Math.sqrt(n * (n - 1) * (2 * n + 5) / 18)
  const M1 = Math.round((N - C) / 2), M2 = N - M1 + 1
  const slopeLo = s[M1 + K - 1], slopeHi = s[M2 + K - 1]
  const intercept = median(y.map((v, i) => v - slope * x[i]))
  const interceptLo = median(y.map((v, i) => v - slopeHi * x[i])), interceptHi = median(y.map((v, i) => v - slopeLo * x[i]))
  return { slope, slopeLo, slopeHi, intercept, interceptLo, interceptHi }
}

/** Bland–Altman on relative differences (%), with 95% limits of agreement. */
export function blandAltman(x: number[], y: number[]) {
  const d = x.map((v, i) => 200 * (y[i] - v) / (y[i] + v))
  const m = mean(d), s = sd(d)
  return { meanPct: m, loaPct: [m - 1.96 * s, m + 1.96 * s] as [number, number], diffs: d }
}

/* ── Sigma metric and QC rule suggestion (Westgard Sigma Rules) ───────── */
export function sigmaMetric(teaPct: number, biasPct: number, cvPct: number) { return (teaPct - Math.abs(biasPct)) / cvPct }
export function qcRule(sigma: number) {
  if (sigma >= 6) return { rules: '1-3s', n: 2 }
  if (sigma >= 5) return { rules: '1-3s / 2-2s / R-4s', n: 2 }
  if (sigma >= 4) return { rules: '1-3s / 2-2s / R-4s / 4-1s', n: 4 }
  return { rules: '1-3s / 2-2s / R-4s / 4-1s / 8-x', n: 8 }
}
