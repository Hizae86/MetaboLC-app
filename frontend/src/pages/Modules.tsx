import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { ArrowDown, ArrowRight, Bell, Check } from 'lucide-react'
import SEO from '../components/SEO'
import { Input } from '@/components/ui/input'
import { API } from '@/lib/api'
import { AUDIT_TRAIL, MODULES, QUALITY_POINTS, STATUS_LABEL, type KoineModule, type ModuleStatus } from '@/lib/modules'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, className }: { status: ModuleStatus; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      status === 'live' && 'bg-primary text-primary-foreground',
      status === 'early' && 'border border-primary/45 text-primary',
      status === 'next' && 'border border-primary/25 bg-primary/5 text-primary/90', className)}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Email-only waitlist for a module that does not exist yet. Counts demand per module. */
export function NotifyMe({ modules, label = 'Notify me' }: { modules: string[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (state === 'done') return <p className="text-sm font-medium text-success">Thanks. We’ll write to you when it opens.</p>
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/60">
      <Bell size={14} /> {label}
    </button>
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!consent) { setError('Please tick the consent box so we can store your email.'); return }
    setState('sending')
    try {
      await axios.post(`${API}/modules/waitlist`, { email: email.trim(), modules, source: 'modules_page', consent: true })
      setState('done')
    } catch (err: any) {
      setState('idle')
      const d = err?.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Something went wrong. Please try again in a moment.')
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-2">
      <div className="flex gap-2">
        <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@laboratory.org"
          autoComplete="email" aria-label="Work email" className="h-9" />
        <button type="submit" disabled={state === 'sending'}
          className="shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : 'Notify me'}
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
        <span>Koiné may store this email to tell me when the module opens. It is not shared, and I can ask for it to be deleted at <a href="mailto:hello@metabolc.io" className="text-primary hover:underline">hello@metabolc.io</a>.</span>
      </label>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  )
}

function ModuleAction({ m }: { m: KoineModule }) {
  if (!m.to) return <NotifyMe modules={[m.id]} label={m.cta} />
  return (
    <Link to={m.to} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold no-underline',
      m.status === 'live' ? 'bg-primary text-primary-foreground hover:bg-primary/85' : 'border border-primary/45 text-primary hover:bg-primary/10')}>
      {m.cta} <ArrowRight size={14} />
    </Link>
  )
}

/** The three modules side by side: used on the home page and at the top of /modules. */
export function ModuleCards({ linkToDetails = true, compact = false }: { linkToDetails?: boolean; compact?: boolean }) {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {MODULES.map(m => {
        const Icon = m.icon
        return (
          <li key={m.id} className={cn('flex flex-col rounded-2xl border p-5',
            m.status === 'live' ? 'border-primary/45 bg-gradient-to-b from-primary/10 to-card' : 'border-border bg-card')}>
            <div className="flex items-center justify-between gap-2">
              <span className="num text-xs font-semibold text-primary">{m.n} · {m.verb.toUpperCase()}</span>
              <StatusBadge status={m.status} />
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary"><Icon size={18} /></span>
              <div>
                <h3 className="text-lg font-semibold leading-tight text-foreground">{m.title}</h3>
                <p className="text-xs font-semibold text-primary">{m.price}</p>
              </div>
            </div>
            {!compact && <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.who}</p>}
            <p className={cn('flex-1 text-sm text-muted-foreground', compact ? 'mt-3' : 'mt-1')}>{m.summary}</p>
            {m.features && !compact && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {m.features.map(({ title, icon: FIcon }) => (
                  <li key={title} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-foreground"><FIcon size={12} className="text-primary" /> {title}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ModuleAction m={m} />
              {linkToDetails && !compact && (
                <Link to={`/modules#${m.id}`} className="text-xs font-medium text-muted-foreground no-underline hover:text-primary hover:underline">How it works</Link>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const Point = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2.5 text-sm text-foreground/90">
    <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
    <span>{children}</span>
  </li>
)

function ModuleDetail({ m }: { m: KoineModule }) {
  const Icon = m.icon
  return (
    <article id={m.id} className={cn('scroll-mt-24 rounded-2xl border p-5 sm:p-7',
      m.status === 'live' ? 'border-primary/45 bg-gradient-to-b from-primary/10 to-card' : 'border-border bg-card')}>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-[36%]">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><Icon size={20} /></span>
            <span className="num text-xs font-semibold text-muted-foreground">{m.n} · {m.verb.toUpperCase()}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{m.title}</h2>
            <StatusBadge status={m.status} />
          </div>
          <p className="mt-0.5 text-sm font-semibold text-primary">{m.price}</p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{m.summary}</p>
          <div className="mt-4"><ModuleAction m={m} /></div>
        </div>
        <div className="flex-1 lg:border-l lg:border-border lg:pl-7">
          {m.rules && <ul className="space-y-3">{m.rules.map(r => <Point key={r}>{r}</Point>)}</ul>}
          {m.features && (
            <div className="space-y-5">
              {m.features.map(({ title, icon: FIcon, points }) => (
                <div key={title}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><FIcon size={15} className="text-primary" /> {title}</h3>
                  <ul className="mt-2 space-y-2.5">{points.map(p => <Point key={p}>{p}</Point>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {m.handoff && (
        <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
          <ArrowDown size={14} className="text-primary" aria-hidden="true" /> {m.handoff}
        </p>
      )}
    </article>
  )
}

export default function Modules() {
  const { hash } = useLocation()
  // Links like /modules#routine open at that module.
  useEffect(() => {
    if (!hash) return
    const t = window.setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 50)
    return () => window.clearTimeout(t)
  }, [hash])
  const Audit = AUDIT_TRAIL.icon

  return (
    <>
      <SEO title="Modules — Library, Validate and Routine"
        description="Koiné follows one LC-MS/MS method through its life: find it in the free library, validate it your way, and run it in routine with traceability and QC statistics." />

      <div className="mx-auto max-w-5xl">
        <header className="pb-8 pt-4">
          <p className="label-caps text-primary">Modules</p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Three modules, one method: find it, validate it, run it.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Each module picks up where the last one left off: the method you choose in the library is the one you validate, and the one you validate is the one you run. Nothing is typed twice.
          </p>
        </header>

        <ModuleCards linkToDetails={false} />

        <div className="mt-12 space-y-4">
          {MODULES.map(m => <ModuleDetail key={m.id} m={m} />)}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Audit size={17} /></span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{AUDIT_TRAIL.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{AUDIT_TRAIL.text}</p>
          </div>
        </div>

        <section id="quality" className="mt-12 scroll-mt-24 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8" aria-labelledby="quality-title">
          <p className="label-caps text-primary">For quality managers</p>
          <h2 id="quality-title" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Evidence for ISO 15189 and IVDR, kept with the method.</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {QUALITY_POINTS.map(p => (
              <div key={p.title}>
                <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Koiné organises the evidence; it does not make a method compliant. Responsibility for validation and for IVDR obligations stays with the laboratory.
          </p>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Routine is not built yet; this page describes how it is meant to work. Validate is open for early access.
        </p>
      </div>
    </>
  )
}
