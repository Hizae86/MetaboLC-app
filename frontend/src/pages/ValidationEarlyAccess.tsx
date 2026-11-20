import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowDown, ArrowRight, BadgeCheck, Beaker, ClipboardList, Cpu, FileCheck2, FlaskConical, Gauge, Keyboard, Library, ListTree, Upload, Waves } from 'lucide-react'
import SEO from '../components/SEO'
import ValidationDemo from '@/components/validation/ValidationDemo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MANUFACTURERS } from '@/lib/vendors'
import { API } from '@/lib/api'

/* ── Early-access form ─────────────────────────────────────────────────── */
const ROLES = ['Laboratory director', 'Scientist / specialist', 'Technician', 'Quality manager', 'Consultant', 'Other']
// Values must match backend/routes/validation.py GUIDELINES; the label adds what each one is for.
const GUIDELINES: [string, string][] = [
  ['ICH M10', 'ICH M10 — PK studies, clinical trials, bioanalytical research'],
  ['CLSI (C62 / EP series)', 'CLSI C62 / EP — clinical diagnosis and monitoring'],
  ['ISO 15189 / IVDR in-house', 'ISO 15189 / IVDR — in-house methods in patient care'],
  ['Own SOP', 'Own SOP'],
  ['Not sure', 'Not sure'],
]
const VOLUMES = ['1-2', '3-5', '6-10', '>10']
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground'

function EarlyAccessForm() {
  const [sp] = useSearchParams()
  const methodId = Number(sp.get('method')) || null
  const [methodTitle, setMethodTitle] = useState<string | null>(null)
  const [f, setF] = useState({ email: '', name: '', laboratory: '', country: '', role: '', vendor: '', guideline: '', methods_per_year: '', note: '' })
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    if (!methodId) return
    axios.get(`${API}/methods/${methodId}`).then(r => setMethodTitle(r.data?.title || null)).catch(() => setMethodTitle(null))
  }, [methodId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!consent) { setError('Please tick the consent box so we can store your details.'); return }
    setState('sending')
    try {
      await axios.post(`${API}/validation/waitlist`, {
        ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])),
        method_id: methodTitle ? methodId : null, source: methodTitle ? 'method_page' : 'validation_page', consent: true,
      })
      setState('done')
    } catch (err: any) {
      setState('idle')
      setError(err?.response?.data?.detail && typeof err.response.data.detail === 'string'
        ? err.response.data.detail : 'Something went wrong. Please try again in a moment.')
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-5">
        <p className="flex items-center gap-2 font-semibold text-foreground"><BadgeCheck size={18} className="text-success" /> You’re on the early-access list.</p>
        <p className="mt-1 text-sm text-muted-foreground">We’ll write to you when the validation module opens to the first laboratories{methodTitle ? ', and we have noted the method you want to validate' : ''}.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
      {methodTitle && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="label-caps text-muted-foreground">Method you want to validate</span>
          <p className="mt-0.5 text-foreground">{methodTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">Its chromatography, sample preparation and transitions will be imported directly into your validation plan.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="label-caps mb-1 block text-muted-foreground">Work email *</span>
          <Input type="email" required value={f.email} onChange={set('email')} placeholder="name@laboratory.org" autoComplete="email" /></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Name</span>
          <Input value={f.name} onChange={set('name')} autoComplete="name" /></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Laboratory</span>
          <Input value={f.laboratory} onChange={set('laboratory')} autoComplete="organization" /></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Country</span>
          <Input value={f.country} onChange={set('country')} autoComplete="country-name" /></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Role</span>
          <select className={selectCls} value={f.role} onChange={set('role')}><option value="">—</option>{ROLES.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Mass spectrometer vendor</span>
          <select className={selectCls} value={f.vendor} onChange={set('vendor')}><option value="">—</option>{MANUFACTURERS.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Guideline you validate against</span>
          <select className={selectCls} value={f.guideline} onChange={set('guideline')}><option value="">—</option>{GUIDELINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="block"><span className="label-caps mb-1 block text-muted-foreground">Methods validated per year</span>
          <select className={selectCls} value={f.methods_per_year} onChange={set('methods_per_year')}><option value="">—</option>{VOLUMES.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="block sm:col-span-2"><span className="label-caps mb-1 block text-muted-foreground">What would help you most? (optional)</span>
          <textarea maxLength={500} rows={3} value={f.note} onChange={set('note')}
            className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground" /></label>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
        <span>I agree that Koiné stores these details to contact me about the validation module. They are not shared with third parties, and you can ask us to delete them at any time by writing to <a href="mailto:hello@metabolc.io" className="text-primary hover:underline">hello@metabolc.io</a>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Join early access'}</Button>
    </form>
  )
}

/* ── From the library ──────────────────────────────────────────────────── */
const IMPORTED = [
  { icon: Waves, title: 'Chromatography', text: 'Column, mobile phases, gradient, flow and injection volume.' },
  { icon: Beaker, title: 'Sample preparation', text: 'Every step, volume and reagent, as published.' },
  { icon: ListTree, title: 'MRM transitions', text: 'Precursor and product ions, collision energies, retention times, quantifier and qualifier.' },
  { icon: FlaskConical, title: 'Internal standards', text: 'Each analyte with its assigned internal standard.' },
  { icon: Cpu, title: 'Source parameters', text: 'In the fields of your instrument vendor.' },
  { icon: Gauge, title: 'Published performance', text: 'Range, LLOQ, precision and accuracy, to compare against your own results.' },
]
function FromLibrary() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Start from the library, not from a blank spreadsheet</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every method in the Koiné library can become the reference for your validation. Choose it and its conditions are copied into your plan as they are in the library,
          so the method you validate is the method you read, with no transcription step in between.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Library size={14} className="text-primary" /> Library method <ArrowRight size={13} /> <ClipboardList size={14} className="text-primary" /> Your validation plan
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {IMPORTED.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5">
                <Icon size={15} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-sm"><span className="font-medium text-foreground">{title}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-success/40 bg-success/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Keyboard size={15} className="text-success" /> Nothing to retype</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              No copying transitions, gradients or volumes from a PDF into a spreadsheet, so no typing errors in the conditions you validate.
              Your results come in from the export of your quantitation software, so the numbers are not typed either.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">Adapted to your laboratory</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Different column or instrument? Change what differs before the plan is locked. Every change from the library method is recorded and listed in the dossier.
            </p>
          </div>
          <Link to="/methods" className="inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline">
            <Library size={15} /> Browse the library
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */
const STEPS = [
  { icon: FlaskConical, title: 'Import a library method', text: 'Pick a method from the library and import it as it is: column, gradient, sample preparation, transitions and internal standards, without retyping a value. Or start from a list of analytes.' },
  { icon: ClipboardList, title: 'Get the experimental design', text: 'Koiné creates the experimental design to validate your method. Everything is in the protocol, such as how to prepare the mobile phases, standards, calibrators and QCs. It also creates the list of samples to run, each with its own name.' },
  { icon: Upload, title: 'Import the results', text: 'From the export of your quantitation software or an Excel template; each result is matched to its sample by name. Every injection is kept; excluding one needs a reason.' },
  { icon: FileCheck2, title: 'Calculations and dossier', text: 'Koiné helps you with the calculations and the analytics to validate your method, and helps you create the validation dossier for your review and sign-off.' },
]
const PROFILES = [
  { family: 'Bioanalysis', name: 'ICH M10', use: 'Pharmacokinetic studies, clinical trials and bioanalytical research.', text: 'Accuracy and precision in three runs, matrix effect in six lots, carry-over, dilution, stability and reinjection.' },
  { family: 'Clinical', name: 'In-house method · CLSI, ISO 15189, IVDR', use: 'Clinical diagnosis, therapeutic monitoring and in-house methods used in patient care.', text: 'CLSI C62 and the EP series: precision over 5 days × 5 (20 × 2 × 2 for high-risk tests), trueness, interferences, measurement uncertainty and the IVDR Art. 5(5) justification.' },
  { family: 'Clinical', name: 'CE-IVD kit verification', use: 'A CE-IVD kit for diagnosis or monitoring, verified in your laboratory.', text: 'Precision against the manufacturer’s claims (CLSI EP15-A3), trueness and measurement uncertainty.' },
  { family: 'Clinical', name: 'Your own SOP', use: 'Your laboratory’s written criteria.', text: 'Start from the clinical profile and set your criteria. Every dossier states which criteria it was evaluated against.' },
]

export default function ValidationEarlyAccess() {
  const [sp] = useSearchParams()
  useEffect(() => {
    if (sp.get('method')) document.getElementById('early-access')?.scrollIntoView({ behavior: 'smooth' })
  }, [sp])
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-16">
      <SEO title="Method validation — early access" description="Validate your LC-MS/MS method your way: your criteria or an ICH M10 / CLSI-based profile, import your sample results and get the validation dossier. In development." />

      <header className="space-y-4 pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Method validation · Early access</span>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Validate the method your way, in your laboratory.</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Choose the experiments and acceptance criteria you want, or start from ICH M10 or a CLSI-based profile. Koiné gives you the complete experimental design and how to prepare the mobile phases, standards, spiked matrices and every validation sample.
          Import the results; Koiné does the calculations, tells you whether the method passes and, if it does, writes the validation dossier.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => go('early-access')}>Join early access</Button>
          <Button size="lg" variant="outline" onClick={() => go('example')}><ArrowDown size={15} /> Try the example</Button>
          <Link to="/validation/sample-dossier" className="ml-1 inline-flex items-center gap-1 text-sm font-medium text-primary no-underline hover:underline">
            <FileCheck2 size={15} /> See a sample dossier
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">In development. There is no release date or pricing yet.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">How it will work</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-primary"><Icon size={16} /><span className="num text-xs text-muted-foreground">{i + 1}</span></div>
              <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <FromLibrary />

      <section id="example" className="scroll-mt-20 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">See it in action</h2>
          <p className="text-sm text-muted-foreground">From plan to dossier in under a minute: design, upload, evaluation, the statistics and the report. Touch anything to explore it; the walkthrough waits for you.</p>
        </div>
        <ValidationDemo />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Criteria you can validate against</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bioanalysis and clinical rules are kept apart: a study is judged against one profile, never a mix of both.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROFILES.map(p => (
            <div key={p.name} className="rounded-xl border border-border bg-card p-4">
              <p className={`label-caps ${p.family === 'Bioanalysis' ? 'text-chart-2' : 'text-primary'}`}>{p.family}</p>
              <h3 className="mt-0.5 text-sm font-semibold text-foreground">{p.name}</h3>
              <p className="mt-2 text-sm leading-snug text-foreground"><span className="font-medium">Use it for: </span>{p.use}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Koiné will evaluate a study against the criteria you choose; it will not certify methods. The validation decision stays with your laboratory.
          {' '}<Link to="/verification" className="text-primary hover:underline">“Verified” methods in the library</Link> are a different thing: they were checked against their source, not validated.
        </p>
      </section>

      <section id="early-access" className="scroll-mt-20 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Join early access</h2>
          <p className="text-sm text-muted-foreground">The first laboratories on the list will help shape the module and try it before anyone else. Tell us what you validate and we’ll build for it.</p>
        </div>
        <EarlyAccessForm />
      </section>
    </div>
  )
}
