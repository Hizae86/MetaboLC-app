import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Info } from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BASE, CALIBRATORS, CAL_BACK, CAL_FIT, CARRYOVER, DILUTION, LEVELS, MATRIX, REINJECTION, RUN_LOG, SELECTIVITY,
  SPECIFICITY, STABILITY, UNIT, anova, cvp, mean, pct,
} from '@/components/validation/sampleStudy'

/* All numbers come from the synthetic study in sampleStudy.ts. The laboratory,
 * people and lots are fictitious. Paper colours are fixed on purpose: this is
 * a document, and it must look the same on screen, in dark mode and in print. */

const DOC = { id: 'VAL-VOR-001', version: '1.0', title: 'Validation report — Voriconazole in human plasma by LC-MS/MS' }
const ACCEPTED_RUNS = ['R1', 'R2b', 'R3']
const PAGES = 9

/* ── computed results ─────────────────────────────────────────────────── */
const AP = LEVELS.map((l, i) => {
  const runs = BASE[i].map(run => ({ bias: 100 * (mean(run) / l.nominal - 1), cv: cvp(run) }))
  const a = anova(BASE[i])
  const bias = 100 * (mean(BASE[i].flat()) / l.nominal - 1)
  const pass = runs.every(r => Math.abs(r.bias) <= l.limit && r.cv <= l.limit) && Math.abs(bias) <= l.limit && a.intermediateCv <= l.limit
  return { ...l, runs, bias, ...a, mean: mean(BASE[i].flat()), pass }
})
const U_REF = 1.0 // % standard uncertainty of the calibrator value (reference standard CoA), assumed
const MU = AP.filter(l => l.key !== 'LLOQ').map(l => {
  const uBias = Math.sqrt(l.bias ** 2 + U_REF ** 2)
  const uc = Math.sqrt(l.intermediateCv ** 2 + uBias ** 2)
  return { key: l.key, nominal: l.nominal, uRw: l.intermediateCv, uBias, uc, U: 2 * uc }
})
const ME = MATRIX.map(m => ({ ...m, lqcAcc: mean(m.lqc), hqcAcc: mean(m.hqc), lqcCv: cvp(m.lqc), hqcCv: cvp(m.hqc) }))
const mePass = ME.every(m => Math.abs(m.lqcAcc - 100) <= 15 && Math.abs(m.hqcAcc - 100) <= 15 && m.lqcCv <= 15 && m.hqcCv <= 15)
const calPass = CAL_BACK.every(run => run.filter((v, i) => Math.abs(v - 100) <= (i === 0 ? 20 : 15)).length >= Math.max(6, Math.ceil(0.75 * run.length)))
const selPass = SELECTIVITY.every(s => s.analytePctLloq <= 20 && s.isPct <= 5)
const spePass = SPECIFICITY.every(s => Math.abs(s.effect) <= 15)
const coPass = CARRYOVER.every(c => c.analytePctLloq <= 20 && c.isPct <= 5)
const dilAcc = 100 * mean(DILUTION.values) / DILUTION.nominal, dilCv = cvp(DILUTION.values)
const dilPass = Math.abs(dilAcc - 100) <= 15 && dilCv <= 15
const reiPass = Math.abs(REINJECTION.lqc - 100) <= 15 && Math.abs(REINJECTION.hqc - 100) <= 15
const apPass = AP.every(l => l.pass)
const worst = (vals: number[]) => vals.reduce((w, v) => (Math.abs(v) > Math.abs(w) ? v : w), 0)
const f = (v: number, d = 1) => v.toFixed(d)
const range = (vals: number[], d = 1, suffix = '%') => `${f(Math.min(...vals), d)}–${f(Math.max(...vals), d)}${suffix}`

type St = 'Pass' | 'Fail' | 'Interim'
const SUMMARY: { exp: string; criterion: string; result: string; status: St }[] = [
  { exp: 'Selectivity', criterion: '≤20% of LLOQ response; ≤5% of IS', result: `max ${f(Math.max(...SELECTIVITY.map(s => s.analytePctLloq)))}% of LLOQ; ${f(Math.max(...SELECTIVITY.map(s => s.isPct)))}% of IS (8 sources)`, status: selPass ? 'Pass' : 'Fail' },
  { exp: 'Specificity', criterion: 'Interferent effect within ±15%', result: `max ${pct(worst(SPECIFICITY.map(s => s.effect)))} (5 compounds)`, status: spePass ? 'Pass' : 'Fail' },
  { exp: 'Matrix effect', criterion: '6 lots; accuracy ±15%, CV ≤15% per lot', result: `LQC ${range(ME.map(m => m.lqcAcc))}; HQC ${range(ME.map(m => m.hqcAcc))}`, status: mePass ? 'Pass' : 'Fail' },
  { exp: 'Calibration curve', criterion: '≥75% and ≥6 calibrators within ±15% (±20% LLOQ)', result: `3/3 accepted runs; r² ≥ ${f(Math.min(...CAL_FIT.map(c => c.r2)), 4)} (for information only)`, status: calPass ? 'Pass' : 'Fail' },
  { exp: 'Accuracy & precision', criterion: '±15% / CV ≤15% (±20% / ≤20% at LLOQ), within and between runs', result: `bias ${pct(worst(AP.map(l => l.bias)))}; CV ≤ ${f(Math.max(...AP.map(l => l.intermediateCv)))}%`, status: apPass ? 'Pass' : 'Fail' },
  { exp: 'Carry-over', criterion: 'Blank after ULOQ ≤20% of LLOQ; ≤5% of IS', result: `max ${f(Math.max(...CARRYOVER.map(c => c.analytePctLloq)))}% of LLOQ`, status: coPass ? 'Pass' : 'Fail' },
  { exp: 'Dilution integrity', criterion: '×10; accuracy ±15%, CV ≤15% (n = 5)', result: `${f(dilAcc)}%, CV ${f(dilCv)}%`, status: dilPass ? 'Pass' : 'Fail' },
  { exp: 'Stability', criterion: 'Mean within ±15% of nominal', result: '4 conditions passed; long-term 1 month (interim)', status: 'Interim' },
  { exp: 'Reinjection reproducibility', criterion: 'Within ±15% of nominal', result: `LQC ${f(REINJECTION.lqc)}%, HQC ${f(REINJECTION.hqc)}%`, status: reiPass ? 'Pass' : 'Fail' },
]

/* ── document building blocks ─────────────────────────────────────────── */
function Page({ n, children }: { n: number; children: ReactNode }) {
  return (
    <section className="dossier-page relative mx-auto mb-8 w-full max-w-[210mm] overflow-hidden rounded-sm bg-white px-[14mm] pb-[20mm] pt-[12mm] text-[12px] leading-relaxed text-slate-800 shadow-2xl ring-1 ring-black/10 print:mb-0 print:max-w-none print:break-after-page print:rounded-none print:shadow-none print:ring-0"
      style={{ minHeight: '297mm' }}>
      <span className="pointer-events-none absolute right-[12mm] top-[17mm] rotate-[-8deg] rounded border-2 border-red-300/70 px-2 py-0.5 text-[9px] font-bold tracking-[0.2em] text-red-400/80">SYNTHETIC EXAMPLE</span>
      <header className="mb-6 flex items-end justify-between border-b border-slate-300 pb-2 text-[10px] text-slate-500">
        <span>Example University Hospital · Clinical Pharmacology Laboratory <em>(fictitious)</em></span>
        <span className="font-mono">{DOC.id} · v{DOC.version}</span>
      </header>
      {children}
      <footer className="absolute bottom-[8mm] left-[14mm] right-[14mm] flex justify-between gap-4 border-t border-slate-200 pt-2 text-[9px] text-slate-400">
        <span>{DOC.title}</span><span>Generated by Koiné · koine-rules@1.0.0 · ICH M10 profile</span><span className="whitespace-nowrap">Page {n} of {PAGES}</span>
      </footer>
    </section>
  )
}
const H1 = ({ children, gap }: { children: ReactNode; gap?: boolean }) => <h2 className={cn('mb-3 text-[15px] font-bold text-slate-900', gap ? 'mt-7' : 'mt-1')}>{children}</h2>
const H2 = ({ children }: { children: ReactNode }) => <h3 className="mb-1.5 mt-5 flex items-center gap-2 text-[12.5px] font-semibold text-slate-900">{children}</h3>
const Note = ({ children }: { children: ReactNode }) => <p className="mt-1.5 text-[10.5px] text-slate-500">{children}</p>
type Align = 'l' | 'r' | 'c'
function T({ head, rows, align }: { head: string[]; rows: ReactNode[][]; align?: Align[] }) {
  const cls = (a?: Align) => (a === 'r' ? 'text-right' : a === 'c' ? 'text-center' : 'text-left')
  return (
    <table className="w-full border-collapse text-[10.5px]">
      <thead><tr className="bg-slate-100 text-slate-600">{head.map((h, i) => <th key={i} className={cn('border border-slate-200 px-1.5 py-1 font-semibold', cls(align?.[i]))}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} className="even:bg-slate-50/60">{r.map((c, j) => <td key={j} className={cn('border border-slate-200 px-1.5 py-0.5 align-top', cls(align?.[j]), align?.[j] === 'r' && 'font-mono')}>{c}</td>)}</tr>
      ))}</tbody>
    </table>
  )
}
type BadgeKind = St | 'Accepted' | 'Rejected' | 'Attached' | 'Pending'
function Badge({ s }: { s: BadgeKind }) {
  const tone = s === 'Pass' || s === 'Accepted' || s === 'Attached' ? 'bg-green-100 text-green-800' : s === 'Fail' || s === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
  return <span className={cn('inline-block rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide', tone)}>{s}</span>
}

function AccuracyChart() {
  const W = 520, H = 200, top = 14, bottom = 170, left = 40
  const y = (b: number) => top + ((25 - Math.max(-25, Math.min(25, b))) / 50) * (bottom - top)
  const cx = (i: number) => left + 58 + i * 118
  const col = ['#0b67a3', '#b45309', '#7c3aed']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Accuracy profile of every replicate by level and run">
      {[-20, -15, 0, 15, 20].map(t => (
        <g key={t}>
          <line x1={left} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t ? '3 3' : undefined} />
          <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#64748b">{t > 0 ? '+' : ''}{t}%</text>
        </g>
      ))}
      {AP.map((l, i) => (
        <g key={l.key}>
          <rect x={cx(i) - 48} width={96} y={y(l.limit)} height={y(-l.limit) - y(l.limit)} fill="#16a34a" fillOpacity={0.07} stroke="#16a34a" strokeOpacity={0.35} strokeDasharray="3 3" />
          {BASE[i].map((run, k) => run.map((v, p) => <circle key={`${k}-${p}`} cx={cx(i) + (k - 1) * 26 + (p - 2) * 3.5} cy={y(100 * (v / l.nominal - 1))} r={2.6} fill={col[k]} />))}
          <text x={cx(i)} y={bottom + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f172a">{l.key}</text>
          <text x={cx(i)} y={bottom + 27} textAnchor="middle" fontSize="8.5" fill="#64748b">{l.nominal} {UNIT}</text>
        </g>
      ))}
      {ACCEPTED_RUNS.map((r, k) => (
        <g key={r}><circle cx={W - 150 + k * 50} cy={6} r={3} fill={col[k]} /><text x={W - 144 + k * 50} y={9} fontSize="9" fill="#475569">{r}</text></g>
      ))}
    </svg>
  )
}

/* ── page ──────────────────────────────────────────────────────────────── */
export default function SampleDossier() {
  return (
    <div className="dossier-doc pb-16">
      <SEO title="Sample validation dossier" description="A synthetic example of the validation dossier the Koiné validation module will generate: plan, criteria, results, run log, deviations, measurement uncertainty and approvals." />

      <div className="no-print mx-auto mb-6 max-w-[210mm] space-y-3">
        <Link to="/validation" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"><ArrowLeft size={14} /> Method validation</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sample validation dossier</h1>
            <p className="text-sm text-muted-foreground">What the validation module will hand you at the end of a study: everything an auditor asks for, in one document.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Download size={15} /> Save as PDF</Button>
            <Button asChild><Link to="/validation#early-access" className="no-underline">Join early access</Link></Button>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <Info size={14} className="mt-0.5 shrink-0 text-warning" />
          Synthetic example. The laboratory, people, lots and results are fictitious and generated for illustration. The structure follows what ICH M10 asks of a
          validation report and what ISO 15189:2022 expects in validation records. The module is in development.
        </p>
      </div>

      {/* 1 · Cover and document control */}
      <Page n={1}>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Method validation report</p>
        <h1 className="mt-2 text-[24px] font-bold leading-tight text-slate-900">Voriconazole in human plasma (K₂-EDTA) by LC-MS/MS</h1>
        <p className="mt-1 text-[13px] text-slate-600">Full validation of a laboratory-developed test · measuring interval 0.10–10.0 {UNIT}</p>
        <div className="mt-6 grid grid-cols-2 gap-x-8 text-[11px]">
          {[['Document ID', DOC.id], ['Version', `${DOC.version} (supersedes draft 0.3)`], ['Status', 'Approved for routine use, one open item (section 8)'],
            ['Validation profile', 'ICH M10, chromatographic methods'], ['Regulatory context', 'ISO 15189:2022 · IVDR Art. 5(5) in-house device'],
            ['Validation period', '2026-10-05 → 2026-11-06'], ['Plan locked', '2026-10-01, before the first run'], ['Analysts', 'Analyst A, Analyst B']].map(([k, v]) => (
            <div key={k} className="flex gap-2 border-b border-slate-100 py-1"><span className="w-32 shrink-0 text-slate-500">{k}</span><span className="text-slate-900">{v}</span></div>
          ))}
        </div>
        <H2>Approval</H2>
        <T head={['Role', 'Function', 'Date', 'Signature']} rows={[
          ['Prepared', 'Method validation scientist (Analyst A)', '2026-11-08', <span className="italic text-slate-500">e-signed</span>],
          ['Reviewed', 'Quality manager', '2026-11-10', <span className="italic text-slate-500">e-signed</span>],
          ['Approved', 'Laboratory director', '2026-11-12', <span className="italic text-slate-500">e-signed</span>],
        ]} />
        <H2>Revision history</H2>
        <T head={['Version', 'Date', 'Change']} rows={[
          ['0.1', '2026-10-01', 'Validation plan and acceptance criteria locked'],
          ['0.3', '2026-11-07', 'Results of all runs; deviation DEV-01 recorded'],
          ['1.0', '2026-11-12', 'Reviewed and approved; long-term stability left as open item OI-01'],
        ]} />
        <H2>Contents</H2>
        <ol className="grid grid-cols-2 gap-x-8 text-[11px] text-slate-700">
          {['Summary and statement of validity', 'Scope and method description', 'Materials and metrological traceability', 'Validation plan and acceptance criteria',
            'Results by experiment', 'Measurement uncertainty', 'Run log, deviations and exclusions', 'Conclusions, open items and routine QC', 'Annexes and data integrity'].map((t, i) => (
            <li key={t} className="border-b border-dotted border-slate-200 py-0.5">{i + 1}. {t}</li>
          ))}
        </ol>
      </Page>

      {/* 2 · Summary */}
      <Page n={2}>
        <H1>1. Summary and statement of validity</H1>
        <div className="rounded border-l-4 border-green-600 bg-green-50 px-3 py-2 text-[11.5px] text-slate-800">
          The method meets every predefined acceptance criterion of the validation plan. It is valid for the quantification of voriconazole in human
          plasma (K₂-EDTA) between <b>0.10 and 10.0 {UNIT}</b>, and up to 100 {UNIT} after ×10 dilution. Long-term frozen stability is supported for
          <b> 1 month</b>; the 6- and 12-month time points are an open item (section 8).
        </div>
        <H2>Results against acceptance criteria</H2>
        <T head={['Experiment', 'Acceptance criterion', 'Result', 'Status']} align={['l', 'l', 'l', 'c']}
          rows={SUMMARY.map(s => [s.exp, s.criterion, s.result, <Badge s={s.status} />])} />
        <H2>Declared performance characteristics</H2>
        <T head={['Characteristic', 'Value']} rows={[
          ['Measuring interval', `0.10–10.0 ${UNIT} (LLOQ 0.10 ${UNIT})`],
          ['Extended range', `up to 100 ${UNIT} after ×10 dilution with blank plasma`],
          ['Repeatability (CV)', range(AP.map(l => l.repeatabilityCv))],
          ['Intermediate precision (CV)', range(AP.map(l => l.intermediateCv))],
          ['Bias', `${pct(Math.min(...AP.map(l => l.bias)))} to ${pct(Math.max(...AP.map(l => l.bias)))}`],
          ['Expanded uncertainty (k = 2)', `${range(MU.map(m => m.U))} (LQC to HQC)`],
          ['Carry-over', `≤${f(Math.max(...CARRYOVER.map(c => c.analytePctLloq)))}% of LLOQ after ULOQ`],
          ['Sample stability', 'Room temperature 24 h · 3 freeze-thaw cycles · whole blood 4 h · −80 °C 1 month (interim)'],
          ['Extract stability', '72 h at 8 °C in the autosampler'],
        ]} />
        <Note>Performance applies to this laboratory, these instruments and this procedure. It does not transfer to another laboratory without verification.</Note>
      </Page>

      {/* 3 · Scope, method, materials */}
      <Page n={3}>
        <H1>2. Scope and method description</H1>
        <p><b>Intended use.</b> Quantification of voriconazole in human plasma (K₂-EDTA) for therapeutic drug monitoring. Serum and heparin plasma are outside the scope of this validation.</p>
        <H2>Sample preparation (SOP-TDM-014 v2)</H2>
        <ol className="list-decimal pl-5">
          <li>50 µL plasma + 20 µL internal standard (voriconazole-d3, 1 µg/mL).</li>
          <li>Add 200 µL acetonitrile; vortex 30 s.</li>
          <li>Centrifuge 10 min at 14 000 g, 4 °C.</li>
          <li>Dilute the supernatant 1:1 with water; inject 2 µL.</li>
        </ol>
        <H2>Chromatography</H2>
        <p>C18 column, 2.1 × 50 mm, 1.7 µm, 40 °C; autosampler 8 °C; 0.40 mL/min. A: water + 0.1% formic acid; B: acetonitrile + 0.1% formic acid.</p>
        <div className="mt-1.5">
          <T head={['Time (min)', '0.0', '0.4', '2.2', '2.5', '2.6', '3.5']} rows={[['%B', '20', '20', '90', '90', '20', '20']]} align={['l', 'r', 'r', 'r', 'r', 'r', 'r']} />
        </div>
        <H2>Mass spectrometry (ESI+, MRM)</H2>
        <T head={['Compound', 'Role', 'Q1 (m/z)', 'Q3 (m/z)', 'CE (eV)', 'RT (min)']} align={['l', 'l', 'r', 'r', 'r', 'r']} rows={[
          ['Voriconazole', 'Quantifier', '350.1', '281.1', '16', '1.62'],
          ['Voriconazole', 'Qualifier', '350.1', '127.0', '28', '1.62'],
          ['Voriconazole-d3', 'Internal standard', '353.1', '284.1', '16', '1.61'],
        ]} />
        <p className="mt-2">Instrument LCMS-02 (triple quadrupole, operational qualification 2026-09-12). Acquisition and quantitation software versions are recorded in annex A8.</p>

        <H1 gap>3. Materials and metrological traceability</H1>
        <T head={['Material', 'Identification', 'Traceability / certificate', 'Use']} rows={[
          ['Voriconazole reference standard', 'Lot RS-VOR-2291, purity 99.6%', 'Certificate of analysis (annex A1)', 'Calibrators'],
          ['Voriconazole, second weighing', 'Lot RS-VOR-2291, independent stock', 'Same certificate; separate weighing and analyst', 'QCs'],
          ['Voriconazole-d3', 'Lot IS-VD3-0412, isotopic purity ≥99%', 'Certificate of analysis (annex A2)', 'Internal standard'],
          ['Stock solutions', '1 mg/mL in methanol, prepared 2026-09-28', 'Within the 3-month stability at −20 °C', 'Calibrators, QCs'],
          ['Blank plasma', '6 individual K₂-EDTA lots BM-2341 to 2346', 'Supplier certificates (annex A3)', 'Calibrators, QCs, matrix effect'],
          ['External control', 'EQA sample, round 2026-2', 'Assigned value from the scheme provider', 'Trueness check (5.5)'],
        ]} />
        <p className="mt-2">Calibrators: {CALIBRATORS.join(', ')} {UNIT} in pooled blank plasma. QCs: LLOQ 0.10, LQC 0.30, MQC 4.00, HQC 8.00 {UNIT}, prepared from the independent stock.</p>
      </Page>

      {/* 4 · Plan */}
      <Page n={4}>
        <H1>4. Validation plan and acceptance criteria</H1>
        <p className="mb-2">The plan was approved and locked on 2026-10-01, before the first analytical run. Acceptance criteria were not changed after results were known. Criteria follow ICH M10 for chromatographic methods.</p>
        <T head={['Experiment', 'Design', 'Acceptance criterion']} rows={[
          ['Selectivity', '6 individual blank lots + 1 haemolysed + 1 lipaemic', 'Response ≤20% of LLOQ (analyte), ≤5% (IS)'],
          ['Specificity', 'Metabolite and co-medications spiked at high concentration into LQC', 'Effect on LQC within ±15%'],
          ['Matrix effect', '6 lots, LQC and HQC, triplicate', 'Accuracy ±15% and CV ≤15% in each lot'],
          ['Calibration curve', 'Blank, zero and 8 calibrators, linear 1/x², in every A&P run', '≥75% and ≥6 calibrators within ±15% (±20% at LLOQ)'],
          ['Accuracy & precision', '4 levels × 5 replicates × 3 runs on 2 days, 2 analysts', 'Mean ±15% (±20% LLOQ); CV ≤15% (≤20% LLOQ), within and between runs'],
          ['Carry-over', 'Blank after ULOQ in every A&P run', '≤20% of LLOQ response; ≤5% of IS'],
          ['Dilution integrity', '40 µg/mL diluted ×10 with blank plasma, n = 5', 'Accuracy ±15%, CV ≤15%'],
          ['Stability', 'LQC and HQC in triplicate, against freshly prepared calibrators', 'Mean within ±15% of nominal'],
          ['Reinjection reproducibility', 'Accepted run re-injected after 48 h at 8 °C', 'LQC and HQC within ±15% of nominal'],
          ['Measurement uncertainty', 'Top-down from intermediate precision and bias', 'Reported and compared with the laboratory target (≤30%, k = 2)'],
        ]} />
        <Note>Run acceptance during validation: calibration criteria above; at least 2/3 of QCs, and 50% at each level, within ±15%.</Note>
      </Page>

      {/* 5 · Selectivity, specificity, matrix */}
      <Page n={5}>
        <H1>5. Results by experiment</H1>
        <H2>5.1 Selectivity <Badge s={selPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Blank source', 'Analyte (% of LLOQ)', 'IS (% of mean IS)']} align={['l', 'r', 'r']}
          rows={SELECTIVITY.map(s => [s.source, f(s.analytePctLloq), f(s.isPct)])} />
        <H2>5.2 Specificity <Badge s={spePass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Potential interferent', 'Concentration', 'Effect on LQC']} align={['l', 'r', 'r']}
          rows={SPECIFICITY.map(s => [s.compound, s.conc, pct(s.effect)])} />
        <H2>5.3 Matrix effect <Badge s={mePass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Lot', 'Type', 'LQC accuracy', 'LQC CV', 'HQC accuracy', 'HQC CV', 'IS-normalised MF']} align={['l', 'l', 'r', 'r', 'r', 'r', 'r']}
          rows={ME.map(m => [m.lot, m.type, `${f(m.lqcAcc)}%`, `${f(m.lqcCv)}%`, `${f(m.hqcAcc)}%`, `${f(m.hqcCv)}%`, f(m.isMf, 2)])} />
        <Note>Accuracy as % of nominal (mean of 3). IS-normalised matrix factor from post-extraction spikes against neat solution.</Note>
      </Page>

      {/* 6 · Calibration and A&P */}
      <Page n={6}>
        <H2>5.4 Calibration curve <Badge s={calPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Run', 'Slope', 'Intercept', 'r²', ...CALIBRATORS.map(c => `${c}`)]} align={['l', 'r', 'r', 'r', ...CALIBRATORS.map(() => 'r' as const)]}
          rows={CAL_FIT.map((fit, r) => [ACCEPTED_RUNS[r], f(fit.slope, 4), f(fit.intercept, 4), f(fit.r2, 4), ...CAL_BACK[r].map((v, i) => (
            <span className={cn(Math.abs(v - 100) > (i === 0 ? 20 : 15) && 'font-bold text-red-700')}>{f(v)}</span>))])} />
        <Note>Linear regression, weighting 1/x², analyte/IS area ratio. Back-calculated calibrators as % of nominal; the header gives each calibrator in {UNIT}.</Note>

        <H2>5.5 Accuracy and precision <Badge s={apPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Level', 'Nominal', ...ACCEPTED_RUNS.map(r => `${r} bias · CV`), 'Overall bias', 'Repeat. CV', 'Interm. CV', 'Limit']}
          align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={AP.map(l => [l.key, `${l.nominal}`, ...l.runs.map(r => `${pct(r.bias)} · ${f(r.cv)}%`), pct(l.bias), `${f(l.repeatabilityCv)}%`, `${f(l.intermediateCv)}%`, `±${l.limit}%`])} />
        <Note>n = 5 per level and run. Precision components from a one-way ANOVA with runs as groups. Trueness was also checked with the EQA sample (round 2026-2): +1.8% from the assigned value.</Note>
        <AccuracyChart />
        <Note>Accuracy profile: every replicate as bias from nominal, by level and run, against the acceptance limits (shaded).</Note>
      </Page>

      {/* 7 · Carry-over, dilution, stability, reinjection, MU */}
      <Page n={7}>
        <H2>5.6 Carry-over <Badge s={coPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Run', 'Blank after ULOQ: analyte (% of LLOQ)', 'IS (% of mean IS)']} align={['l', 'r', 'r']}
          rows={CARRYOVER.map((c, i) => [ACCEPTED_RUNS[i], f(c.analytePctLloq), f(c.isPct)])} />
        <H2>5.7 Dilution integrity <Badge s={dilPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Sample', 'Dilution', `Replicates (${UNIT}, back-calculated)`, 'Accuracy', 'CV']} align={['l', 'r', 'l', 'r', 'r']}
          rows={[[`${DILUTION.nominal} ${UNIT}`, `×${DILUTION.factor}`, DILUTION.values.map(v => f(v, 1)).join(' · '), `${f(dilAcc)}%`, `${f(dilCv)}%`]]} />
        <H2>5.8 Stability <Badge s="Interim" /></H2>
        <T head={['Condition', 'Duration', 'LQC (% nominal)', 'HQC (% nominal)', 'Status']} align={['l', 'l', 'r', 'r', 'c']}
          rows={STABILITY.map(s => [s.condition, s.duration, f(s.lqc), f(s.hqc), <Badge s={s.status === 'pass' ? 'Pass' : 'Interim'} />])} />
        <Note>Long-term stability at −80 °C continues at 6 and 12 months (open item OI-01). Until then, frozen samples older than 1 month are not reported.</Note>
        <H2>5.9 Reinjection reproducibility <Badge s={reiPass ? 'Pass' : 'Fail'} /></H2>
        <T head={['Condition', 'LQC (% nominal)', 'HQC (% nominal)']} align={['l', 'r', 'r']} rows={[[`Re-injected after ${REINJECTION.delay}`, f(REINJECTION.lqc), f(REINJECTION.hqc)]]} />

        <H1 gap>6. Measurement uncertainty</H1>
        <T head={['Level', 'Nominal', 'u(Rw)', 'u(bias)', 'Combined u', 'Expanded U (k = 2)']} align={['l', 'r', 'r', 'r', 'r', 'r']}
          rows={MU.map(m => [m.key, `${m.nominal} ${UNIT}`, `${f(m.uRw)}%`, `${f(m.uBias)}%`, `${f(m.uc)}%`, <b>{f(m.U)}%</b>])} />
        <Note>Top-down estimate: u(Rw) is the intermediate precision; u(bias) combines the observed bias with a {f(U_REF)}% standard uncertainty assumed for the calibrator value (reference standard certificate). All levels are below the laboratory target of 30% (k = 2).</Note>
      </Page>

      {/* 8 · Runs, deviations, conclusions, QC, annexes */}
      <Page n={8}>
        <H1>7. Run log, deviations and exclusions</H1>
        <T head={['Run', 'Date', 'Analyst', 'Purpose', 'Status', 'Note']} align={['l', 'l', 'l', 'l', 'c', 'l']}
          rows={RUN_LOG.map(r => [r.id, <span className="whitespace-nowrap">{r.date}</span>, <span className="whitespace-nowrap">{r.analyst}</span>, r.purpose, <Badge s={r.status === 'accepted' ? 'Accepted' : 'Rejected'} />, r.note])} />
        <H2>Deviations</H2>
        <T head={['ID', 'Description', 'Impact', 'Action']} rows={[[
          'DEV-01', 'Run R2: IS working solution prepared at 10 µg/mL instead of 1 µg/mL.', 'Run rejected by the calibration criteria; no data used.',
          'Solution discarded; preparation check added to the worksheet; run repeated as R2b.']]} />
        <H2>Exclusions</H2>
        <p>No individual result was excluded from any accepted run. Every injection of every run, R2 included, is kept in the raw data (annex A6).</p>

        <H1 gap>8. Conclusions, open items and routine QC</H1>
        <T head={['Open item', 'Action', 'Responsible', 'Due']} rows={[['OI-01', 'Long-term stability at −80 °C, 6 and 12 months', 'Analyst A', '2027-04 and 2027-10']]} />
        <H2>Routine QC derived from this validation</H2>
        <T head={['Parameter', 'Initial acceptance range', 'Basis']} rows={[
          ...AP.filter(l => l.key !== 'LLOQ').map(l => [`QC ${l.key} (${l.nominal} ${UNIT})`, `target ${f(l.mean, 2)} ${UNIT}; SD ${f(l.mean * l.intermediateCv / 100, 3)}`, 'Validation mean and intermediate precision; Westgard rules']),
          ['Ion ratio 127.0 / 281.1', '0.42 ± 20%', 'Mean of the calibrators'],
          ['IS response', '50–150% of the calibrator mean', 'Laboratory rule'],
          ['Retention time', '1.62 ± 0.10 min', 'Validation runs'],
        ]} />
      </Page>

      {/* 9 · Annexes */}
      <Page n={9}>
        <H1>9. Annexes and data integrity</H1>
        <T head={['Annex', 'Content', 'Status']} align={['l', 'l', 'c']} rows={[
          ['A1–A3', 'Certificates of analysis: reference standard, internal standard, blank matrix', <Badge s="Attached" />],
          ['A4', 'Chromatograms: 100% of accepted and rejected runs, with reintegrations and reasons', <Badge s="Attached" />],
          ['A5', 'Validation plan v0.1 as locked on 2026-10-01', <Badge s="Attached" />],
          ['A6', 'Raw quantitation exports of all runs (SHA-256 7f3a…c91e)', <Badge s="Attached" />],
          ['A7', 'Audit trail of the study: uploads, exclusions, approvals', <Badge s="Attached" />],
          ['A8', 'Instrument qualification, software versions, analyst training records', <Badge s="Attached" />],
        ]} />
        <Note>Results computed by Koiné with rules koine-rules@1.0.0, ICH M10 profile. Re-running the engine on annex A6 reproduces every number in this report.</Note>
        <H2>Statement</H2>
        <p>This report records the full validation study: every run, including the rejected one, every deviation and the criteria fixed before the study began.
          The decision to release the method for patient testing is taken by the laboratory director (see Approval, page 1) and is reviewed when the method,
          instrument or reagents change.</p>
        <div className="mt-10 grid grid-cols-3 gap-6 text-[10px] text-slate-500">
          {['Prepared', 'Reviewed', 'Approved'].map(r => <div key={r}><div className="mb-1 h-8 border-b border-slate-300 text-right italic text-slate-400">e-signed</div>{r}</div>)}
        </div>
      </Page>
    </div>
  )
}
