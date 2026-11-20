/** AGREE — Analytical GREEnness metric (Pena-Pereira, Wojnowski, Tobiszewski,
 *  Anal. Chem. 2020, 92, 10076–10082; open-source calculator, MIT licence).
 *
 *  The score functions reproduce the authors' calculator (AGREE.py), which is
 *  what published AGREE scores are made with. Where the calculator differs from
 *  the equations printed in the paper (principle 11) the calculator is followed.
 *  The overall score is the weighted mean of the 12 principle scores; the
 *  calculator's default weight is the same for every principle. */

export type Source = 'method' | 'text' | 'assumption' | 'missing'

export const P1_OPTIONS: Record<string, number> = {
  'Remote sensing without sample damage': 1.0,
  'Remote sensing with little physical damage': 0.95,
  'Non-invasive analysis': 0.9,
  'In-field sampling and direct analysis': 0.85,
  'In-field sampling and on-line analysis': 0.78,
  'On-line analysis': 0.7,
  'At-line analysis': 0.6,
  'Off-line analysis': 0.48,
  'External pretreatment, batch analysis (few steps)': 0.3,
  'External pretreatment, batch analysis (many steps)': 0.0,
}
export const P3_OPTIONS: Record<string, number> = { 'in-line': 1.0, 'on-line': 0.66, 'at-line': 0.33, 'off-line': 0.0 }
export const P9_OPTIONS: Record<string, number> = {
  'LC-MS (> 1.5 kWh/sample)': 0.0, 'LC, GC, ICP-MS (0.1–1.5 kWh/sample)': 0.5, 'UPLC, SPE, immunoassay (< 0.1 kWh/sample)': 1.0,
}
export const P10_OPTIONS: Record<string, number> = {
  'No reagents, or all bio-based': 1.0, 'Some reagents are bio-based': 0.5, 'None of the reagents are bio-based': 0.0,
}
export const THREATS = ['toxic to aquatic life', 'bioaccumulative', 'persistent', 'highly flammable', 'highly oxidizable', 'explosive', 'corrosive'] as const

export interface AgreeInputs {
  p1: string | null
  p2_ml: number | null          // sample amount, g or mL
  p3: string
  p4_steps: number | null
  p5_automation: 'automatic' | 'semi-automatic' | 'manual'
  p5_miniaturized: boolean
  p6_derivatized: boolean
  p6_agent_score: number | null // the agent's score in the AGREE derivatisation-agent list, 0–1
  p7_waste_ml: number | null
  p8_analytes: number | null
  p8_per_hour: number | null    // samples per hour
  p9: string
  p9_kwh: number | null         // optional measured energy per sample; overrides the category
  p10: string
  p11_toxic: boolean
  p11_ml: number | null
  p12_threats: string[] | null  // null = not known (mobile-phase composition not reported)
}

const ln = Math.log

export const PRINCIPLES: { n: number; short: string; title: string }[] = [
  { n: 1, short: 'Sample treatment', title: 'Direct analytical techniques should be applied to avoid sample treatment' },
  { n: 2, short: 'Sample size', title: 'Minimal sample size and minimal number of samples are goals' },
  { n: 3, short: 'Device position', title: 'In situ measurements should be performed' },
  { n: 4, short: 'Steps', title: 'Integration of analytical processes and operations saves energy and reduces the use of reagents' },
  { n: 5, short: 'Automation', title: 'Automated and miniaturized methods should be selected' },
  { n: 6, short: 'Derivatization', title: 'Derivatization should be avoided' },
  { n: 7, short: 'Waste', title: 'Generation of a large volume of analytical waste should be avoided' },
  { n: 8, short: 'Analytes per hour', title: 'Multi-analyte or multi-parameter methods are preferred' },
  { n: 9, short: 'Energy', title: 'The use of energy should be minimized' },
  { n: 10, short: 'Bio-based reagents', title: 'Reagents obtained from renewable sources should be preferred' },
  { n: 11, short: 'Toxic reagents', title: 'Toxic reagents should be eliminated or replaced' },
  { n: 12, short: 'Operator safety', title: "The operator's safety should be increased" },
]

/** Score per principle, or null when an input it needs is missing. */
export function agreeScores(i: AgreeInputs): (number | null)[] {
  const s2 = i.p2_ml == null ? null : i.p2_ml > 100 ? 0 : i.p2_ml < 0.1 ? 1 : Math.abs(-0.142 * ln(i.p2_ml) + 0.65)
  const s4 = i.p4_steps == null ? null : i.p4_steps <= 3 ? 1 : i.p4_steps >= 8 ? 0 : [0.8, 0.6, 0.4, 0.2][i.p4_steps - 4]
  const a = { automatic: 1, 'semi-automatic': 0.5, manual: 0 }[i.p5_automation]
  const s5 = i.p5_miniaturized ? [0.5, 0.75, 1][a * 2] : [0, 0.25, 0.5][a * 2]
  const s6 = !i.p6_derivatized ? 1 : i.p6_agent_score == null ? null : Math.max(0, i.p6_agent_score - 0.2)
  const s7 = i.p7_waste_ml == null ? null : i.p7_waste_ml > 150 ? 0 : i.p7_waste_ml < 0.1 ? 1 : Math.abs(-0.134 * ln(i.p7_waste_ml) + 0.6946)
  const per = i.p8_analytes != null && i.p8_per_hour != null ? i.p8_analytes * i.p8_per_hour : null
  const s8 = per == null ? null : per < 1 ? 0 : per > 70 ? 1 : Math.abs(0.2429 * ln(per) - 0.0517)
  const s9 = i.p9_kwh != null
    ? (i.p9_kwh > 1.5 ? 0 : i.p9_kwh < 0.1 ? 1 : Math.abs(-0.7143 * i.p9_kwh + 1.0714))
    : P9_OPTIONS[i.p9]
  const s11 = !i.p11_toxic ? 1 : i.p11_ml == null ? null : i.p11_ml < 0.1 ? 0.8 : i.p11_ml > 50 ? 0 : Math.abs(-0.129 * ln(i.p11_ml) + 0.5012)
  const s12 = i.p12_threats == null ? null : [1, 0.8, 0.6, 0.4, 0.2][i.p12_threats.length] ?? 0
  return [i.p1 == null ? null : P1_OPTIONS[i.p1], s2, P3_OPTIONS[i.p3], s4, s5, s6, s7, s8, s9, P10_OPTIONS[i.p10], s11, s12]
}

/** Weighted mean over the principles that could be scored (equal weights by default). */
export function agreeTotal(scores: (number | null)[], weights: number[] = Array(12).fill(2)) {
  let num = 0, den = 0
  scores.forEach((s, k) => { if (s != null) { num += s * weights[k]; den += weights[k] } })
  return { score: den ? num / den : null, scored: scores.filter(s => s != null).length }
}

/** The calculator's colour scale: red (0) → yellow (0.5) → green (1), matplotlib 'green' = #008000. */
export function agreeColor(v: number): string {
  const x = Math.round(Math.max(0, Math.min(1, v)) * 255) / 255
  const [r, g, b] = x <= 0.5
    ? [1, x / 0.5, 0]
    : [1 - (x - 0.5) / 0.5, 1 - 0.5 * (x - 0.5) / 0.5, 0]
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}

const PREP_STEPS: [RegExp, number][] = [
  [/dilute|dilution|shoot/i, 3], [/deriv/i, 7], [/hydrolys/i, 6], [/liquid-liquid|\blle\b|supported liquid/i, 6],
  [/solid phase|\bspe\b/i, 6], [/precipitation|\bppt\b/i, 4],
]
const FLAMMABLE = /acetonitrile|methanol|isopropanol|ethanol|hexane|heptane|mtbe|ethyl acetate|acetone|diethyl ether/i
const AQUATIC = /hexane|heptane/i

/** Starting inputs from the method record, each with where it came from. */
export function defaultInputs(m: any, g: any): { inputs: AgreeInputs; source: Record<number, Source>; why: Record<number, string> } {
  const source: Record<number, Source> = {}
  const why: Record<number, string> = {}
  const prepName = `${m.sample_prep_method || ''}`
  const prepAll = `${prepName} ${m.sample_prep_details || ''}`
  const prepSolvents: { solvent: string; ul: number }[] = g?.prep?.solvents || []
  const prepMl = prepSolvents.reduce((s, x) => s + x.ul / 1000, 0)
  const sampleMl = g?.prep?.sample ? g.prep.sample.ul / 1000 : null

  const steps = PREP_STEPS.find(([re]) => re.test(prepName))?.[1] ?? null
  const many = steps != null && steps >= 6
  const p1 = steps == null ? null : many ? 'External pretreatment, batch analysis (many steps)' : 'External pretreatment, batch analysis (few steps)'
  source[1] = p1 ? 'assumption' : 'missing'; why[1] = 'Clinical LC-MS/MS: samples are prepared off the instrument and run in batches.'
  source[2] = sampleMl != null ? 'text' : 'missing'; why[2] = g?.prep?.sample ? `From the preparation text: “${g.prep.sample.snippet}”.` : 'Sample volume not found in the preparation text.'
  source[3] = 'assumption'; why[3] = 'Laboratory instrument, off-line from where the sample is taken.'
  source[4] = steps != null ? 'assumption' : 'missing'; why[4] = steps != null ? `Typical number of steps for ${prepName.toLowerCase()}; adjust to the actual procedure.` : 'Preparation type not recognised.'
  const automated = !!g?.automated
  const miniaturized = /\bdbs\b|dried blood|vams|microsampl|micro-?extraction|\bspme\b/i.test(prepAll)
  source[5] = 'assumption'; why[5] = `${automated ? 'Automation mentioned in the preparation' : 'No automation mentioned'}; ${miniaturized ? 'micro-sampling or microextraction mentioned' : 'not miniaturized'}.`
  const derivatized = !!g?.derivatized
  source[6] = derivatized ? 'missing' : 'method'; why[6] = derivatized ? 'Derivatized: enter the agent’s score from the AGREE derivatization-agent list.' : 'No derivatization recorded.'
  const waste = g?.computable ? g.total_ml + (sampleMl ?? 0) + prepMl : null
  source[7] = waste != null ? 'method' : 'missing'
  why[7] = waste != null ? `Mobile phase per injection${sampleMl ? ' + sample' : ''}${prepMl ? ' + solvents in the preparation text' : ''}.` : 'Mobile-phase volume could not be calculated.'
  const perHour = g?.run_time_min ? 60 / g.run_time_min : null
  source[8] = g?.n_analytes && perHour ? 'method' : 'missing'; why[8] = 'Analytes in the transition table × injections per hour (60 / run time).'
  source[9] = 'assumption'; why[9] = 'AGREE classes LC-MS as > 1.5 kWh per sample unless a measured value is entered.'
  source[10] = 'assumption'; why[10] = 'Solvents assumed to be from fossil sources (AGREE allows 0.5 if the alcohols are bio-based).'
  const organicMl = (g?.organic_ml ?? 0) + prepMl
  // Commercial kits and unspecified phases: what the solvents are is not known.
  const compositionUnknown = [g?.phase_a, g?.phase_b].some((ph: any) => ph?.status === 'unknown')
  const toxic = compositionUnknown || organicMl > 0 || FLAMMABLE.test(`${m.mobile_phase_a} ${m.mobile_phase_b}`)
  source[11] = g?.computable ? 'method' : toxic ? 'missing' : 'assumption'
  why[11] = compositionUnknown ? 'Mobile-phase composition not reported: enter the volume of toxic solvents per sample.' : 'Organic solvents (mobile phase and preparation) counted as toxic, as in the AGREE case studies.'
  let threats: string[] | null = []
  if (FLAMMABLE.test(`${m.mobile_phase_a} ${m.mobile_phase_b} ${prepSolvents.map(s => s.solvent).join(' ')}`)) threats.push('highly flammable')
  if (prepSolvents.some(s => AQUATIC.test(s.solvent))) threats.push('toxic to aquatic life')
  if (compositionUnknown && threats.length === 0) threats = null
  source[12] = threats == null ? 'missing' : 'assumption'
  why[12] = threats == null ? 'Mobile-phase composition not reported: tick the hazards of the solvents used.' : 'Hazards of the solvents named in the method; add corrosive if concentrated acids or bases are handled.'

  return {
    source, why,
    inputs: {
      p1, p2_ml: sampleMl, p3: 'off-line', p4_steps: steps,
      p5_automation: automated ? 'automatic' : 'manual', p5_miniaturized: miniaturized,
      p6_derivatized: derivatized, p6_agent_score: null,
      p7_waste_ml: waste, p8_analytes: g?.n_analytes ?? null, p8_per_hour: perHour,
      p9: 'LC-MS (> 1.5 kWh/sample)', p9_kwh: null, p10: 'None of the reagents are bio-based',
      p11_toxic: toxic, p11_ml: g?.computable ? organicMl : null, p12_threats: threats,
    },
  }
}
