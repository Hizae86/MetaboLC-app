/* Mass spectrometry arithmetic shared by the mass calculator, the transition tables and the
   transition editors: element masses, adducts, neutral losses, ion m/z, and the automatic
   transition checks (product lighter than precursor, polarity coherent with the adduct). */

export const ELECTRON = 0.000548579909

// Monoisotopic and average (IUPAC) masses.
export const ELEMENTS: Record<string, { mono: number; avg: number }> = {
  H: { mono: 1.0078250319, avg: 1.008 },   D: { mono: 2.0141017781, avg: 2.014 },
  Li: { mono: 7.0160035, avg: 6.94 },      B: { mono: 11.0093055, avg: 10.81 },
  C: { mono: 12.0, avg: 12.011 },          N: { mono: 14.0030740052, avg: 14.007 },
  O: { mono: 15.9949146221, avg: 15.999 }, F: { mono: 18.99840322, avg: 18.998 },
  Na: { mono: 22.9897692, avg: 22.99 },    Mg: { mono: 23.9850417, avg: 24.305 },
  Al: { mono: 26.9815385, avg: 26.982 },   Si: { mono: 27.9769265, avg: 28.085 },
  P: { mono: 30.97376151, avg: 30.974 },   S: { mono: 31.97207069, avg: 32.06 },
  Cl: { mono: 34.96885268, avg: 35.45 },   K: { mono: 38.9637069, avg: 39.098 },
  Ca: { mono: 39.9625912, avg: 40.078 },   Fe: { mono: 55.9349375, avg: 55.845 },
  Cu: { mono: 62.9295975, avg: 63.546 },   Zn: { mono: 63.929142, avg: 65.38 },
  Br: { mono: 78.9183376, avg: 79.904 },   Se: { mono: 79.9165218, avg: 78.971 },
  I: { mono: 126.9044719, avg: 126.904 },
}

export type Mode = '+' | '-'
export interface Adduct { name: string; mode: Mode; charge: number; delta: number; common: boolean }

// delta = mass added to M (electron mass already included), m/z = (M + delta) / charge
export const ADDUCTS: Adduct[] = [
  { name: '[M+H]+', mode: '+', charge: 1, delta: +1.007276, common: true },
  { name: '[M+Na]+', mode: '+', charge: 1, delta: +22.989218, common: true },
  { name: '[M+K]+', mode: '+', charge: 1, delta: +38.963158, common: true },
  { name: '[M+NH4]+', mode: '+', charge: 1, delta: +18.034164, common: true },
  { name: '[M+2H]2+', mode: '+', charge: 2, delta: +2.014552, common: false },
  { name: '[M+H+Na]2+', mode: '+', charge: 2, delta: +23.996494, common: false },
  { name: '[M+2Na]2+', mode: '+', charge: 2, delta: +45.978436, common: false },
  { name: '[M+Li]+', mode: '+', charge: 1, delta: +7.016003, common: false },
  { name: '[M+ACN+H]+', mode: '+', charge: 1, delta: +42.033825, common: false },
  { name: '[M+2ACN+H]+', mode: '+', charge: 1, delta: +83.060399, common: false },
  { name: '[M+MeOH+H]+', mode: '+', charge: 1, delta: +33.034164, common: false },
  { name: '[M-H2O+H]+', mode: '+', charge: 1, delta: -16.987484, common: false },
  { name: '[M+H-NH3]+', mode: '+', charge: 1, delta: -16.018724, common: false },
  { name: '[M]+', mode: '+', charge: 1, delta: -ELECTRON, common: false },
  { name: '[M-H]-', mode: '-', charge: 1, delta: -1.007276, common: true },
  { name: '[M+Cl]-', mode: '-', charge: 1, delta: +34.969402, common: true },
  { name: '[M+HCOO]-', mode: '-', charge: 1, delta: +44.997655, common: true },
  { name: '[M+CH3COO]-', mode: '-', charge: 1, delta: +59.013305, common: true },
  { name: '[M-2H]2-', mode: '-', charge: 2, delta: -2.014552, common: false },
  { name: '[M-H2O-H]-', mode: '-', charge: 1, delta: -19.01784, common: false },
  { name: '[M+Na-2H]-', mode: '-', charge: 1, delta: +20.974666, common: false },
  { name: '[M+K-2H]-', mode: '-', charge: 1, delta: +36.948606, common: false },
  { name: '[M+Br]-', mode: '-', charge: 1, delta: +78.918338, common: false },
  { name: '[M]-', mode: '-', charge: 1, delta: +ELECTRON, common: false },
]

export interface Parsed { elements: Record<string, number>; mono: number; avg: number; valid: boolean; error?: string }

function expandBrackets(formula: string): string {
  let out = formula
  for (let i = 0; i < 10 && /\(/.test(out); i++) {
    out = out.replace(/\(([^()]+)\)(\d*)/g, (_, inner: string, mult: string) => {
      const m = mult ? parseInt(mult, 10) : 1
      return inner.replace(/([A-Z][a-z]?)(\d*)/g, (__, el: string, n: string) => el + ((n ? parseInt(n, 10) : 1) * m))
    })
  }
  return out
}

/** Neutral formula → monoisotopic and average mass. Accepts brackets, D for deuterium,
 *  and a trailing charge written as + / - / 2+ which is ignored here. */
export function parseFormula(formula: string): Parsed {
  const elements: Record<string, number> = {}
  let mono = 0, avg = 0
  const clean = expandBrackets(formula.replace(/\s/g, '').replace(/\d*[+-]$/, ''))
  if (!clean) return { elements, mono: 0, avg: 0, valid: false }
  let consumed = 0
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    if (!m[0]) break
    const el = m[1], count = m[2] ? parseInt(m[2], 10) : 1
    if (!ELEMENTS[el]) return { elements, mono: 0, avg: 0, valid: false, error: `Unknown element: ${el}` }
    elements[el] = (elements[el] || 0) + count
    mono += ELEMENTS[el].mono * count
    avg += ELEMENTS[el].avg * count
    consumed += m[0].length
  }
  if (consumed !== clean.length) return { elements, mono: 0, avg: 0, valid: false, error: 'Invalid formula' }
  return { elements, mono, avg, valid: mono > 0 }
}

export const adductMz = (M: number, a: Adduct) => (M + a.delta) / a.charge

/** m/z of an ion given as its own elemental formula (e.g. a fragment C7H7 for tropylium):
 *  the electron mass is removed (positive) or added (negative) once per charge. */
export function ionFormulaMz(formula: string, charge = 1, mode: Mode = '+'): number | null {
  const p = parseFormula(formula)
  if (!p.valid) return null
  return (p.mono + (mode === '+' ? -1 : 1) * charge * ELECTRON) / charge
}

/** Common neutral losses for product-ion prediction. */
export const NEUTRAL_LOSSES: { label: string; formula: string }[] = [
  { label: 'H2O', formula: 'H2O' }, { label: '2 H2O', formula: 'H4O2' }, { label: 'NH3', formula: 'NH3' },
  { label: 'CO', formula: 'CO' }, { label: 'CO2', formula: 'CO2' }, { label: 'HCOOH', formula: 'CH2O2' },
  { label: 'CH3OH', formula: 'CH4O' }, { label: 'CH3COOH', formula: 'C2H4O2' }, { label: 'HCl', formula: 'HCl' },
  { label: 'HF', formula: 'HF' }, { label: 'SO3', formula: 'SO3' }, { label: 'H3PO4', formula: 'H3PO4' },
  { label: 'Glucuronide (C6H8O6)', formula: 'C6H8O6' }, { label: 'Hexose (C6H10O5)', formula: 'C6H10O5' },
]

/** 'ESI+', 'APCI+', '+' → '+'; 'ESI-', 'ESI−' → '-'; switching or unknown → null. */
export function polarityOf(p?: string | null): Mode | null {
  if (!p) return null
  const s = String(p).replace('−', '-').trim()
  if (/polarity|\+\s*\/\s*-|\+\/ESI-/i.test(s)) return null
  if (/\+\s*$/.test(s)) return '+'
  if (/-\s*$/.test(s)) return '-'
  return null
}

export interface AdductMatch { adduct: Adduct; mz: number; diff: number }

/** Adducts of neutral mass M whose m/z lies within ±tol of the observed precursor. */
export function matchAdducts(precursor: number, M: number, tol = 0.5): AdductMatch[] {
  return ADDUCTS.map(a => ({ adduct: a, mz: adductMz(M, a), diff: precursor - adductMz(M, a) }))
    .filter(x => Math.abs(x.diff) <= tol)
    .sort((x, y) => Math.abs(x.diff) - Math.abs(y.diff))
}

export type IssueLevel = 'error' | 'warning' | 'info'
export interface TransitionIssue { level: IssueLevel; code: string; message: string }

const toNum = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v))
const fmt = (v: number, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toString()
const sign = (m: Mode) => (m === '+' ? 'ESI+' : 'ESI−')

/** Automatic checks for one MRM transition.
 *  - the product ion must be lighter than a singly charged precursor;
 *  - the transition polarity must match the method ionization mode (unless it switches);
 *  - when the neutral monoisotopic mass of the compound is known (PubChem), Q1 must match an
 *    adduct of the same polarity as the transition. Internal standards and derivatised
 *    compounds are skipped for this last check because their mass differs from PubChem's. */
export function checkTransition(t: Record<string, any>, opts: { methodIonization?: string | null; exactMass?: number | null; tolerance?: number } = {}): TransitionIssue[] {
  const issues: TransitionIssue[] = []
  const q1 = toNum(t.precursor_mz), q3 = toNum(t.product_mz)
  if (isNaN(q1) || isNaN(q3)) return issues
  const tol = opts.tolerance ?? 0.5
  const pol = polarityOf(t.polarity)
  if (!t.polarity) issues.push({ level: 'warning', code: 'no-polarity', message: 'Polarity not set.' })

  const methodPol = polarityOf(opts.methodIonization)
  if (pol && methodPol && pol !== methodPol)
    issues.push({ level: 'warning', code: 'method-polarity', message: `Transition is ${sign(pol)} but the method ionization mode is ${sign(methodPol)}.` })

  const massRaw = opts.exactMass ?? t.pubchem_exact_mass
  const M = toNum(massRaw)
  const skipAdduct = !!t.is_internal_standard || !!t.is_derivatized || !!t.derivative || isNaN(M) || M <= 0
  const matches = skipAdduct ? [] : matchAdducts(q1, M, tol)
  const multiCharged = matches.some(m => m.adduct.charge > 1)

  if (Math.abs(q3 - q1) <= 0.05) {
    issues.push({ level: 'info', code: 'pseudo', message: 'Pseudo-transition (Q1 = Q3): the precursor is monitored without fragmentation.' })
  } else if (q3 > q1) {
    if (multiCharged) issues.push({ level: 'info', code: 'product-above-2plus', message: `Product above Q1, consistent with a doubly charged precursor (${matches.find(m => m.adduct.charge > 1)!.adduct.name}).` })
    else if (!skipAdduct) issues.push({ level: 'error', code: 'product-heavier', message: `Product ${fmt(q3)} is heavier than precursor ${fmt(q1)}, which is singly charged for this compound.` })
    else issues.push({ level: 'warning', code: 'product-heavier', message: `Product ${fmt(q3)} is heavier than precursor ${fmt(q1)}: only possible if the precursor is multiply charged.` })
  }

  if (!skipAdduct && pol) {
    const same = matches.filter(m => m.adduct.mode === pol)
    const other = matches.filter(m => m.adduct.mode !== pol)
    if (same.length === 0 && other.length > 0) {
      const o = other[0]
      issues.push({ level: 'error', code: 'adduct-polarity', message: `Q1 ${fmt(q1)} matches ${o.adduct.name} (${fmt(o.mz, 4)}), an ${sign(o.adduct.mode)} ion, but the transition is ${sign(pol)}.` })
    } else if (matches.length === 0) {
      issues.push({ level: 'info', code: 'adduct-unmatched', message: `Q1 ${fmt(q1)} matches no listed adduct of M = ${fmt(M, 4)} (in-source fragment, isotope or a different compound?).` })
    }
  }
  return issues
}

/** Best adduct label for a transition, when the compound mass is known. */
export function adductLabel(t: Record<string, any>, tol = 0.5): string | null {
  const M = toNum(t.pubchem_exact_mass), q1 = toNum(t.precursor_mz)
  if (isNaN(M) || isNaN(q1) || t.is_internal_standard) return null
  const pol = polarityOf(t.polarity)
  const m = matchAdducts(q1, M, tol)
  return (m.find(x => x.adduct.mode === pol) || m[0])?.adduct.name ?? null
}

export const worstLevel = (issues: TransitionIssue[]): IssueLevel | null =>
  issues.some(i => i.level === 'error') ? 'error' : issues.some(i => i.level === 'warning') ? 'warning' : issues.length ? 'info' : null

/** The polarity a reviewer would most likely switch a flagged transition to:
 *  only when Q1 matches nothing but opposite-polarity adducts (evidence from m/z).
 *  A mismatch with the method alone is not enough: the method's own mode may be the
 *  incomplete field (e.g. a polarity-switching method recorded as ESI+). */
export function suggestedPolarity(t: Record<string, any>, issues: TransitionIssue[]): string | null {
  const current = polarityOf(t.polarity)
  if (!current || !issues.some(i => i.code === 'adduct-polarity')) return null
  const prefix = String(t.polarity).replace(/[+\-−]\s*$/, '').trim() || 'ESI'
  return `${prefix}${current === '+' ? '-' : '+'}`
}

/** Issues a reader should see: warnings and errors, unless a reviewer confirmed the row. */
export const visibleIssues = (t: Record<string, any>, issues: TransitionIssue[]) =>
  t.review_checked ? [] : issues.filter(i => i.level !== 'info')
