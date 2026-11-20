import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, ArrowRight, Check, CircleCheck, ClipboardPaste, Plus, Trash2, TriangleAlert } from 'lucide-react'
import SEO from '../components/SEO'
import TransitionsEditor from '@/components/submit/TransitionsEditor'
import { Choice, Field, Section, Select, Text, inputCls } from '@/components/submit/fields'
import { Button } from '@/components/ui/button'
import { API } from '@/lib/api'
import { parseGradient, type DraftStep, type DraftTransition } from '@/lib/transitionImport'
import { INSTRUMENTS, MANUFACTURERS } from '@/lib/vendors'
import { cn } from '@/lib/utils'

const STEPS = ['Method', 'Chromatography', 'Mass spectrometry', 'Sample prep', 'Source & credit'] as const
const APPLICATIONS = ['Therapeutic Drug Monitoring', 'Endocrinology', 'Toxicology', 'Newborn screening', 'Oncology', 'Metabolomics', 'Other']
const VALIDATION_LEVELS = [
  { value: 'ISO 15189', hint: 'accredited clinical lab' }, { value: 'CE-IVD', hint: 'EU regulatory' },
  { value: 'RUO', hint: 'research use only' }, { value: 'In development', hint: 'draft' },
]
const SOURCE_TYPES = [
  { value: 'Laboratory method', hint: 'developed in your lab' }, { value: 'Journal article' },
  { value: 'Application note' }, { value: 'Conference poster' },
]
const MATRICES = ['plasma', 'serum', 'urine', 'whole blood', 'dried blood spot', 'CSF', 'saliva', 'tissue', 'other']
const IONIZATION = ['ESI+', 'ESI-', 'ESI+/ESI- (polarity switching 50ms)', 'APCI+', 'APCI-']
const PREP_METHODS = ['Protein Precipitation (PPT)', 'Liquid-Liquid Extraction (LLE)', 'Solid Phase Extraction (SPE)', 'Dilute and Shoot', 'Enzymatic Hydrolysis', 'Derivatization', 'Other']
const UNITS = ['ng/mL', 'pg/mL', 'µg/mL', 'nmol/L', 'pmol/L', 'µmol/L', 'ng/dL', 'µg/dL']

const EMPTY = {
  title: '', analyte: '', analyte_normalized: '', matrix: 'plasma', ionization_mode: 'ESI+', validation_level: 'RUO',
  instrument_manufacturer: 'Sciex', instrument_model: '',
  column_brand: '', column_name: '', column_stationary_phase: '', column_length_mm: '', column_diameter_mm: '',
  column_particle_size_um: '', column_temperature_c: '', mobile_phase_a: '', mobile_phase_b: '', injection_volume_ul: '',
  sample_prep_method: '', sample_prep_details: '', lloq: '', lloq_unit: 'ng/mL', uloq: '',
  source_type: 'Laboratory method', source_authors: '', reference: '', source_url: '', notes: '',
  submitted_by: '', submitted_by_email: '', laboratory: '', country: '',
}
type Form = typeof EMPTY
type Key = keyof Form
const NUMERIC: Key[] = ['column_length_mm', 'column_diameter_mm', 'column_particle_size_um', 'column_temperature_c', 'injection_volume_ul', 'lloq', 'uloq']
const REQUIRED: Record<number, Key[]> = { 0: ['title', 'analyte', 'matrix'], 2: ['instrument_manufacturer', 'instrument_model'], 4: ['submitted_by', 'laboratory'] }

const DRAFT_KEY = 'metabolc_submit_draft_v1'
interface Draft { form: Form; apps: string[]; gradient: DraftStep[]; transitions: DraftTransition[]; step: number }
const readDraft = (): Draft | null => {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
const toNumber = (v: unknown) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }

function GradientEditor({ steps, onChange }: { steps: DraftStep[]; onChange: (s: DraftStep[]) => void }) {
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const set = (i: number, patch: Partial<DraftStep>) => onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const num = 'num h-8 w-full rounded-lg border border-input bg-transparent px-2 text-right text-sm outline-none focus-visible:border-ring'
  return (
    <div className="space-y-2">
      {steps.length > 0 && (
        <table className="w-full max-w-xl text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              {['Time (min)', '%B', 'Flow (mL/min)', 'Curve'].map(h => <th key={h} className="pb-1 pr-2 text-left font-medium">{h}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i}>
                {(['time_min', 'percent_b', 'flow_rate_ml_min'] as const).map(f => (
                  <td key={f} className="py-0.5 pr-2">
                    <input inputMode="decimal" value={s[f]} onChange={e => set(i, { [f]: e.target.value.replace(',', '.') })} aria-label={`${f}, step ${i + 1}`} className={num} />
                  </td>
                ))}
                <td className="py-0.5 pr-2">
                  <select value={s.curve} onChange={e => set(i, { curve: e.target.value })} aria-label={`Curve, step ${i + 1}`} className={cn(num, 'text-left font-sans')}>
                    <option className="bg-popover">linear</option><option className="bg-popover">step</option>
                  </select>
                </td>
                <td>
                  <button type="button" onClick={() => onChange(steps.filter((_, idx) => idx !== i))} aria-label={`Remove step ${i + 1}`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pasting && (
        <div className="max-w-xl rounded-lg border border-border bg-muted/40 p-3">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} autoFocus spellCheck={false} aria-label="Gradient table to import"
            placeholder={'0.0   5   0.4\n0.5   5   0.4\n3.0   95  0.4\n4.0   95  0.4\n4.1   5   0.4'} className={cn(inputCls, 'num h-auto py-2 text-xs leading-relaxed')} />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" disabled={!text.trim()} onClick={() => { onChange([...steps, ...parseGradient(text)]); setText(''); setPasting(false) }}>Import steps</Button>
            <Button type="button" variant="ghost" onClick={() => setPasting(false)}>Cancel</Button>
            <span className="text-xs text-muted-foreground">One step per line: time, %B, flow.</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...steps, { time_min: '', percent_b: '', flow_rate_ml_min: steps[steps.length - 1]?.flow_rate_ml_min ?? '', curve: 'linear' }])}><Plus /> Add step</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPasting(p => !p)}><ClipboardPaste /> Paste gradient table</Button>
      </div>
    </div>
  )
}

export default function SubmitMethod() {
  const draft = useRef(readDraft()).current
  const [form, setForm] = useState<Form>(draft?.form ? { ...EMPTY, ...draft.form } : EMPTY)
  const [apps, setApps] = useState<string[]>(draft?.apps ?? [])
  const [gradient, setGradient] = useState<DraftStep[]>(draft?.gradient ?? [])
  const [transitions, setTransitions] = useState<DraftTransition[]>(draft?.transitions ?? [])
  const [step, setStep] = useState(draft?.step ?? 0)
  const [restored, setRestored] = useState(!!draft)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<number | null>(null)

  // Autosave: a method takes a while to fill in, and people get interrupted in the lab.
  useEffect(() => {
    if (createdId !== null) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, apps, gradient, transitions, step })) } catch { /* storage unavailable: no draft */ }
    }, 400)
    return () => clearTimeout(timer)
  }, [form, apps, gradient, transitions, step, createdId])

  const set = (key: Key) => (value: string) => setForm(prev => ({ ...prev, [key]: value }))
  const missing = (s: number) => (REQUIRED[s] || []).filter(k => !form[k].trim())
  const invalid = (key: Key) => showErrors && (REQUIRED[step] || []).includes(key) && !form[key].trim()

  const reset = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to clear */ }
    setForm(EMPTY); setApps([]); setGradient([]); setTransitions([]); setStep(0); setRestored(false); setShowErrors(false); setError(null)
  }
  const go = (target: number) => {
    if (target > step && missing(step).length) { setShowErrors(true); return }
    setShowErrors(false); setStep(target); window.scrollTo({ top: 0 })
  }

  const validTransitions = transitions.filter(t => t.compound_name.trim() && toNumber(t.precursor_mz) !== null && toNumber(t.product_mz) !== null)
  const validSteps = gradient.filter(s => toNumber(s.time_min) !== null && toNumber(s.percent_b) !== null)

  const submit = async () => {
    const firstIncomplete = [0, 2, 4].find(s => missing(s).length)
    if (firstIncomplete !== undefined) { setStep(firstIncomplete); setShowErrors(true); return }
    setSubmitting(true); setError(null)
    const payload: Record<string, unknown> = { ...form, clinical_application: apps.join(', ') }
    NUMERIC.forEach(k => { payload[k] = toNumber(form[k]) })
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    payload.gradient_steps = validSteps.map(s => ({
      time_min: toNumber(s.time_min), percent_b: toNumber(s.percent_b), flow_rate_ml_min: toNumber(s.flow_rate_ml_min), curve: s.curve || 'linear',
    }))
    payload.mrm_transitions = validTransitions.map(t => {
      const out: Record<string, unknown> = {
        compound_name: t.compound_name.trim(), is_internal_standard: t.is_internal_standard, is_quantifier: t.is_quantifier,
        precursor_mz: toNumber(t.precursor_mz), product_mz: toNumber(t.product_mz),
        polarity: t.polarity || 'ESI+', assigned_is: t.assigned_is || null,
      }
      Object.entries(t).forEach(([k, v]) => { if (!(k in out)) out[k] = toNumber(v) })
      return out
    })
    try {
      const res = await axios.post(`${API}/methods/`, payload)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing to clear */ }
      setCreatedId(res.data.id)
    } catch (err: any) {
      const status = err?.response?.status
      setError(status === 429 ? 'Too many submissions from this network in the last hour. Your draft is saved; try again later.'
        : status === 422 ? 'The server rejected some values. Check the numeric fields and the transition list, then try again.'
        : 'The method could not be sent. Your draft is saved on this device; check your connection and try again.')
    } finally { setSubmitting(false) }
  }

  if (createdId !== null) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card px-6 py-12 text-center">
        <SEO title="Method submitted" />
        <CircleCheck size={36} className="mx-auto mb-3 text-success" />
        <h1 className="text-lg font-semibold text-foreground">Method submitted</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Thank you. A reviewer will read it before it appears in the library{form.submitted_by_email ? ', and may write to you if something needs checking' : ''}.
          It will be listed under your name, linked to its source.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Reference number <span className="num">#{createdId}</span></p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link to="/methods" className="no-underline">Back to the library</Link></Button>
          <Button variant="outline" onClick={() => { setCreatedId(null); reset() }}>Submit another</Button>
        </div>
      </div>
    )
  }

  const last = step === STEPS.length - 1
  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-16">
      <SEO title="Submit a Method" description="Contribute a clinical LC-MS/MS method to the Koiné repository and get credit on the method's page." />

      <header>
        <Link to="/methods" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"><ArrowLeft size={14} /> Methods</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Submit a method</h1>
        <p className="text-sm text-muted-foreground">Only the fields marked * are required. Your progress is saved on this device as you go.</p>
      </header>

      {restored && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
          <span className="flex-1">Picked up your unfinished draft.</span>
          <button type="button" onClick={reset} className="text-xs font-medium text-destructive hover:underline">Discard and start over</button>
          <button type="button" onClick={() => setRestored(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      <nav aria-label="Steps">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}
                className={cn('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  i === step ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground')}>
                <span className={cn('num flex size-4.5 items-center justify-center rounded-full text-[10px]', i < step ? 'bg-success/20 text-success' : 'bg-muted')}>
                  {i < step ? <Check size={11} /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {step === 0 && (
        <Section title="What the method measures">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method title" required error={invalid('title')} className="sm:col-span-2">
              <Text value={form.title} onChange={set('title')} invalid={invalid('title')} placeholder="e.g. Simultaneous quantitation of immunosuppressants in whole blood" />
            </Field>
            <Field label="Analytes" required error={invalid('analyte')} hint="Comma-separated. The full list comes from your transitions.">
              <Text value={form.analyte} onChange={set('analyte')} invalid={invalid('analyte')} placeholder="e.g. Tacrolimus, Sirolimus, Everolimus" />
            </Field>
            <Field label="Short name" hint="Used in file names.">
              <Text value={form.analyte_normalized} onChange={set('analyte_normalized')} placeholder="e.g. immunosuppressants" />
            </Field>
            <Field label="Matrix" required><Select value={form.matrix} onChange={set('matrix')} options={MATRICES} /></Field>
            <Field label="Ionization mode"><Select value={form.ionization_mode} onChange={set('ionization_mode')} options={IONIZATION} /></Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Clinical application</span>
              <Choice multiple options={APPLICATIONS.map(value => ({ value }))} value={apps}
                onChange={v => setApps(prev => (prev.includes(v) ? prev.filter(a => a !== v) : [...prev, v]))} />
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Validation level</span>
              <Choice options={VALIDATION_LEVELS} value={form.validation_level} onChange={set('validation_level')} />
            </div>
          </div>
        </Section>
      )}

      {step === 1 && (
        <>
          <Section title="Column">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Brand" className="sm:col-span-2"><Text value={form.column_brand} onChange={set('column_brand')} placeholder="e.g. Waters, Phenomenex" /></Field>
              <Field label="Name" className="sm:col-span-2"><Text value={form.column_name} onChange={set('column_name')} placeholder="e.g. Acquity UPLC BEH C18" /></Field>
              <Field label="Stationary phase"><Text value={form.column_stationary_phase} onChange={set('column_stationary_phase')} placeholder="C18, Biphenyl, HILIC" /></Field>
              <Field label="Length (mm)"><Text mono inputMode="decimal" value={form.column_length_mm} onChange={set('column_length_mm')} placeholder="50" /></Field>
              <Field label="Internal diameter (mm)"><Text mono inputMode="decimal" value={form.column_diameter_mm} onChange={set('column_diameter_mm')} placeholder="2.1" /></Field>
              <Field label="Particle size (µm)"><Text mono inputMode="decimal" value={form.column_particle_size_um} onChange={set('column_particle_size_um')} placeholder="1.7" /></Field>
              <Field label="Column temperature (°C)"><Text mono inputMode="decimal" value={form.column_temperature_c} onChange={set('column_temperature_c')} placeholder="40" /></Field>
              <Field label="Injection volume (µL)"><Text mono inputMode="decimal" value={form.injection_volume_ul} onChange={set('injection_volume_ul')} placeholder="5" /></Field>
            </div>
          </Section>
          <Section title="Mobile phases and gradient">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile phase A"><Text value={form.mobile_phase_a} onChange={set('mobile_phase_a')} placeholder="e.g. Water + 0.1% formic acid" /></Field>
              <Field label="Mobile phase B"><Text value={form.mobile_phase_b} onChange={set('mobile_phase_b')} placeholder="e.g. Methanol + 0.1% formic acid" /></Field>
            </div>
            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Gradient program</span>
              <GradientEditor steps={gradient} onChange={setGradient} />
            </div>
          </Section>
        </>
      )}

      {step === 2 && (
        <>
          <Section title="Instrument">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Manufacturer" required>
                <Select value={form.instrument_manufacturer} options={MANUFACTURERS}
                  onChange={v => setForm(prev => ({ ...prev, instrument_manufacturer: v, instrument_model: '' }))} />
              </Field>
              <Field label="Model" required error={invalid('instrument_model')}>
                <Select value={form.instrument_model} onChange={set('instrument_model')} invalid={invalid('instrument_model')}
                  options={INSTRUMENTS[form.instrument_manufacturer] || ['Other']} placeholder="Select a model" />
              </Field>
            </div>
          </Section>
          <Section title="MRM transitions" description="Import the list you already have, then check the roles. Source parameters can be added by a reviewer later.">
            <TransitionsEditor rows={transitions} onChange={setTransitions} manufacturer={form.instrument_manufacturer} ionization={form.ionization_mode} />
          </Section>
        </>
      )}

      {step === 3 && (
        <Section title="Sample preparation and sensitivity">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Preparation method" className="sm:col-span-2"><Select value={form.sample_prep_method} onChange={set('sample_prep_method')} options={PREP_METHODS} placeholder="Select a method" /></Field>
            <Field label="LLOQ"><Text mono inputMode="decimal" value={form.lloq} onChange={set('lloq')} placeholder="1.0" /></Field>
            <Field label="Unit"><Select value={form.lloq_unit} onChange={set('lloq_unit')} options={UNITS} /></Field>
            <Field label="Protocol" hint="One step per line, with volumes, speeds, times and temperatures." className="sm:col-span-4">
              <textarea value={form.sample_prep_details} onChange={e => set('sample_prep_details')(e.target.value)} rows={7}
                placeholder={'Add 300 µL cold acetonitrile to 100 µL serum.\nVortex 30 s.\nCentrifuge at 15,000 rpm for 5 min.\nTransfer the supernatant to a vial.'}
                className={cn(inputCls, 'h-auto py-2 leading-relaxed')} />
            </Field>
          </div>
        </Section>
      )}

      {step === 4 && (
        <>
          <Section title="Where the method comes from" description="Shown on the method page so others can check it against the original.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Choice options={SOURCE_TYPES} value={form.source_type} onChange={set('source_type')} /></div>
              {form.source_type !== 'Laboratory method' && (
                <Field label="Authors of the source" className="sm:col-span-2"><Text value={form.source_authors} onChange={set('source_authors')} placeholder="As listed on the document" /></Field>
              )}
              <Field label="Reference" hint="Citation, DOI or document number."><Text value={form.reference} onChange={set('reference')} placeholder="e.g. Ther Drug Monit 2019;41:29–37" /></Field>
              <Field label="Link to the source"><Text type="url" value={form.source_url} onChange={set('source_url')} placeholder="https://" /></Field>
              <Field label="Notes for other labs" className="sm:col-span-2">
                <textarea value={form.notes} onChange={e => set('notes')(e.target.value)} rows={3} placeholder="Critical separations, known interferences, tips."
                  className={cn(inputCls, 'h-auto py-2 leading-relaxed')} />
              </Field>
            </div>
          </Section>
          <Section title="Your credit" description="Your name and laboratory appear on the method page as its contributor.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" required error={invalid('submitted_by')}><Text value={form.submitted_by} onChange={set('submitted_by')} invalid={invalid('submitted_by')} autoComplete="name" /></Field>
              <Field label="Email" hint="Optional. Only for a reviewer's questions; never shown on the site."><Text type="email" value={form.submitted_by_email} onChange={set('submitted_by_email')} autoComplete="email" /></Field>
              <Field label="Institution or laboratory" required error={invalid('laboratory')}><Text value={form.laboratory} onChange={set('laboratory')} invalid={invalid('laboratory')} autoComplete="organization" /></Field>
              <Field label="Country"><Text value={form.country} onChange={set('country')} autoComplete="country-name" /></Field>
            </div>
          </Section>
          <Section title="Before you send">
            <ul className="space-y-1 text-sm text-foreground">
              <li><span className="num font-semibold">{validTransitions.length}</span> transitions, <span className="num font-semibold">{validSteps.length}</span> gradient steps.</li>
              {validTransitions.length === 0 && (
                <li className="flex items-center gap-1.5 text-warning"><TriangleAlert size={14} /> No transitions yet. A method without them is hard for another lab to reuse.</li>
              )}
              {transitions.length > validTransitions.length && (
                <li className="text-muted-foreground"><span className="num">{transitions.length - validTransitions.length}</span> incomplete transition rows will not be sent.</li>
              )}
              <li className="text-muted-foreground">A reviewer reads every submission before it is published. <Link to="/verification" className="text-primary hover:underline">How review works</Link></li>
            </ul>
          </Section>
        </>
      )}

      {showErrors && missing(step).length > 0 && (
        <p role="alert" className="text-sm text-destructive">Fill in the required fields on this step to continue.</p>
      )}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">{error}</p>}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="lg" onClick={() => go(step - 1)} className={cn(step === 0 && 'invisible')}><ArrowLeft /> Back</Button>
        {last
          ? <Button size="lg" disabled={submitting} onClick={submit}>{submitting ? 'Sending…' : 'Submit method'}</Button>
          : <Button size="lg" onClick={() => go(step + 1)}>Continue <ArrowRight /></Button>}
      </div>
    </div>
  )
}
