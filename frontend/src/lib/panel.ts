/**
 * Panel builder logic, kept free of React so it can be checked on its own.
 *
 * No chromatography: transitions come from different methods, so retention
 * times are never combined. Conflicts are judged on m/z and polarity only, and
 * the dwell time assumes every transition is acquired for the whole run.
 */

export type Role = 'Quant' | 'Qual' | 'IS'
export type Polarity = '+' | '-'

export interface PanelRow {
  uid: string
  compound: string
  key: string | null          // analyte key for /tools/panel/options (PubChem CID or lower-case name)
  role: Role
  polarity: Polarity
  q1: number
  q3: number
  ce: number | null
  cone_voltage?: number | null
  declustering_potential?: number | null
  cell_exit_potential?: number | null
  sourceId: number | null     // method the transition was taken from; null = typed by the user
}

export interface TransitionOption {
  q1: number
  q3: number
  polarity: Polarity
  role: 'Quant' | 'Qual'
  method_count: number
  verified_count: number
  collision_energies: number[]
  source: { method_id: number; ce: number | null; cone_voltage: number | null; declustering_potential: number | null; cell_exit_potential: number | null }
  methods: { id: number; title: string; status: string; vendor: string | null }[]
}

export interface Conflict { a: PanelRow; b: PanelRow; severe: boolean }

export const uid = () => Math.random().toString(36).slice(2, 10)

/** Rows of the same compound never conflict with each other. */
export const family = (r: Pick<PanelRow, 'compound'>) => r.compound.trim().toLowerCase()

export const clashes = (x: Pick<PanelRow, 'q1' | 'q3' | 'polarity'>, y: Pick<PanelRow, 'q1' | 'q3' | 'polarity'>, tol: number) =>
  x.polarity === y.polarity && Math.abs(x.q1 - y.q1) <= tol + 1e-9 && Math.abs(x.q3 - y.q3) <= tol + 1e-9

/** Pairs of transitions of different compounds with the same Q1 and Q3 within the tolerance. */
export function findConflicts(rows: PanelRow[], tol: number): Conflict[] {
  const out: Conflict[] = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j]
      if (family(a) === family(b) || !clashes(a, b, tol)) continue
      // A clash on a quantifier or an internal standard affects the result; on a qualifier, only the ion ratio.
      out.push({ a, b, severe: a.role !== 'Qual' || b.role !== 'Qual' })
    }
  }
  return out
}

/** Other transitions of the same analyte that would not clash with anything else in the panel. */
export function alternatives(row: PanelRow, options: TransitionOption[], rows: PanelRow[], tol: number): TransitionOption[] {
  const others = rows.filter(r => family(r) !== family(row))
  const mine = rows.filter(r => family(r) === family(row) && r.uid !== row.uid)
  return options.filter(o =>
    !clashes(o, row, 0.05) &&
    !mine.some(r => clashes(o, r, 0.05)) &&
    !others.some(r => clashes(o, r, tol)))
}

export interface DwellSettings {
  peakWidthS: number      // base width of a chromatographic peak, seconds
  pointsPerPeak: number   // data points wanted across that peak
  delayMs: number         // inter-channel delay / pause between transitions
  switchMs: number        // polarity switching time, per switch
  minDwellMs: number      // shortest dwell the instrument accepts
}

export interface DwellResult {
  n: number
  nPos: number
  nNeg: number
  switching: boolean
  cycleMs: number          // cycle time that gives the points per peak asked for
  dwellMs: number          // dwell per transition to reach that cycle time
  ok: boolean              // dwellMs at or above the instrument minimum
  pointsAtMinDwell: number // points per peak you would get with the minimum dwell
}

/**
 * Unscheduled MRM: every transition is acquired in every cycle.
 *   cycle = n · (dwell + delay) + switches · switchTime, with 2 switches per cycle when both polarities are used
 *   cycle needed = peak width / points per peak
 */
export function dwellFor(rows: Pick<PanelRow, 'polarity'>[], s: DwellSettings): DwellResult | null {
  const n = rows.length
  if (!n || !(s.peakWidthS > 0) || !(s.pointsPerPeak > 0)) return null
  const nPos = rows.filter(r => r.polarity === '+').length
  const nNeg = n - nPos
  const switching = nPos > 0 && nNeg > 0
  const switches = switching ? 2 : 0
  const cycleMs = (s.peakWidthS * 1000) / s.pointsPerPeak
  const dwellMs = (cycleMs - switches * s.switchMs) / n - s.delayMs
  const minCycle = n * (s.minDwellMs + s.delayMs) + switches * s.switchMs
  return { n, nPos, nNeg, switching, cycleMs, dwellMs, ok: dwellMs >= s.minDwellMs, pointsAtMinDwell: (s.peakWidthS * 1000) / minCycle }
}

/** Sign of a method's polarity, as the backend reads it. */
export function polarityOf(transitionPolarity: string | null | undefined, methodMode: string | null | undefined): Polarity {
  const mode = (methodMode || '').toLowerCase()
  const single = mode && !(mode.includes('switch') || mode.includes('+/') || mode.includes('±'))
  if (single) return mode.includes('-') || mode.includes('neg') ? '-' : '+'
  return (transitionPolarity || '').endsWith('-') ? '-' : '+'
}
