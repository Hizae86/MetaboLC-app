import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { Check, CircleAlert, CircleX, Eye, EyeOff, Users, Wrench, type LucideIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { API, type CommunitySummary } from '@/lib/api'
import { REVIEW_EVENT, adminConfig } from '@/lib/admin'
import { cn } from '@/lib/utils'

/**
 * Community reviews: laboratories that ran a method say whether it worked as
 * published, worked with changes, or did not work. A moderator checks each
 * review before it appears. Replaces the older "Replicated by labs" panel.
 */

type Outcome = 'as_published' | 'with_changes' | 'failed'

interface Review {
  id: number
  laboratory: string | null
  country: string | null
  instrument: string | null
  outcome: Outcome
  changes: string | null
  comment: string | null
  created_at: string
  status?: 'pending' | 'published' | 'hidden'
}

const OUTCOME: Record<Outcome, { label: string; short: string; icon: LucideIcon; tone: string; bar: string }> = {
  as_published: { label: 'Worked as published', short: 'as published', icon: Check, tone: 'text-success border-success/40 bg-success/10', bar: 'bg-success' },
  with_changes: { label: 'Worked with changes', short: 'with changes', icon: Wrench, tone: 'text-warning border-warning/40 bg-warning/10', bar: 'bg-warning' },
  failed: { label: 'Didn’t work', short: 'didn’t work', icon: CircleX, tone: 'text-destructive border-destructive/40 bg-destructive/10', bar: 'bg-destructive' },
}
const ORDER: Outcome[] = ['as_published', 'with_changes', 'failed']

const labs = (n: number) => `${n} lab${n === 1 ? '' : 's'}`

export const communityTitle = (s: CommunitySummary) =>
  ORDER.map(o => `${s[o]} ${OUTCOME[o].short}`).join(' · ')

/** Small badge for method headers and result lists. Nothing is shown until a review is published. */
export function CommunityBadge({ summary, href, className }: { summary?: CommunitySummary | null; href?: string; className?: string }) {
  if (!summary || !summary.total) return null
  const worked = summary.as_published + summary.with_changes
  const body = (
    <>
      <Users size={12} aria-hidden="true" />
      <span>Community · {worked}/{summary.total} worked</span>
    </>
  )
  const cls = cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-primary/35 bg-primary/10 px-1.5 text-xs font-medium text-primary no-underline', className)
  const title = `Community reviewed by ${labs(summary.total)}: ${communityTitle(summary)}`
  return href
    ? <a href={href} className={cn(cls, 'hover:bg-primary/20')} title={title} onClick={e => e.stopPropagation()}>{body}</a>
    : <span className={cls} title={title}>{body}</span>
}

function SummaryBar({ s }: { s: CommunitySummary }) {
  return (
    <div className="mt-4">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={communityTitle(s)}>
        {ORDER.map(o => s[o] > 0 && <div key={o} className={OUTCOME[o].bar} style={{ width: `${(100 * s[o]) / s.total}%` }} />)}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {ORDER.map(o => (
          <div key={o} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', OUTCOME[o].bar)} aria-hidden="true" />
            <dt className="text-muted-foreground">{OUTCOME[o].label}</dt>
            <dd className="num font-semibold text-foreground">{s[o]}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const EMPTY = { laboratory: '', country: '', instrument: '', changes: '', comment: '' }

export default function CommunityReviews({ methodId, isAdmin }: { methodId: number; isAdmin: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [f, setF] = useState(EMPTY)
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    axios.get(`${API}/methods/${methodId}/confirmations`, adminConfig())
      .then(r => setReviews(r.data)).catch(() => setReviews([]))
  }, [methodId])
  useEffect(load, [load, isAdmin])

  const published = reviews.filter(r => (r.status ?? 'published') === 'published')
  const summary: CommunitySummary = { as_published: 0, with_changes: 0, failed: 0, total: published.length }
  published.forEach(r => { summary[r.outcome] += 1 })

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))
  const needsDetail = outcome !== null && outcome !== 'as_published'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!outcome) { setError('Choose whether the method worked.'); return }
    if (needsDetail && !f.changes.trim()) { setError(outcome === 'failed' ? 'Please say what went wrong.' : 'Please say what you changed.'); return }
    setState('sending')
    try {
      await axios.post(`${API}/methods/${methodId}/confirmations`, {
        outcome, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])),
      })
      setState('done'); setOpen(false); setF(EMPTY); setOutcome(null)
      if (isAdmin) { load(); window.dispatchEvent(new Event(REVIEW_EVENT)) }
    } catch (err: any) {
      setState('idle')
      const d = err?.response?.data?.detail
      setError(typeof d === 'string' ? d : 'Something went wrong. Please try again in a moment.')
    }
  }

  const moderate = async (id: number, status: 'published' | 'hidden') => {
    await axios.patch(`${API}/methods/${methodId}/confirmations/${id}`, { status }, adminConfig())
    load()
    window.dispatchEvent(new Event(REVIEW_EVENT))
  }

  return (
    <section id="community" className="mt-3 scroll-mt-24 rounded-xl border border-border bg-card p-5" aria-labelledby="community-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="community-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} className="text-primary" aria-hidden="true" /> Community reviews
            {summary.total > 0 && <span className="num rounded-full bg-primary/10 px-2 py-px text-xs font-semibold text-primary">{labs(summary.total)}</span>}
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Laboratories that ran this method say whether it worked. A moderator checks each review before it appears.
          </p>
        </div>
        {!open && state !== 'done' && (
          <Button size="sm" onClick={() => setOpen(true)}>I’ve run this method</Button>
        )}
        {state === 'done' && (
          <span className="rounded-lg bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            Thanks. A moderator will check your review before it appears.
          </span>
        )}
      </div>

      {summary.total > 0 && <SummaryBar s={summary} />}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-foreground">Did it work in your laboratory? *</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ORDER.map(o => {
                const { label, icon: Icon, tone } = OUTCOME[o]
                return (
                  <label key={o} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    outcome === o ? tone : 'border-border bg-card text-foreground hover:border-primary/50')}>
                    <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} className="sr-only" />
                    <Icon size={15} aria-hidden="true" /> {label}
                  </label>
                )
              })}
            </div>
          </fieldset>
          {needsDetail && (
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">{outcome === 'failed' ? 'What went wrong? *' : 'What did you change? *'}</span>
              <textarea rows={2} maxLength={500} value={f.changes} onChange={set('changes')}
                placeholder={outcome === 'failed' ? 'e.g. peaks co-eluted with an interference in plasma' : 'e.g. 50 mm column instead of 100 mm, gradient shortened to 4 min'}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Laboratory / institution *</span>
              <Input required minLength={2} maxLength={200} value={f.laboratory} onChange={set('laboratory')} placeholder="e.g. University Hospital Basel" /></label>
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Country</span>
              <Input maxLength={100} value={f.country} onChange={set('country')} placeholder="e.g. Switzerland" /></label>
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Instrument</span>
              <Input maxLength={200} value={f.instrument} onChange={set('instrument')} placeholder="e.g. Xevo TQ-XS" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Anything else (optional)</span>
            <textarea rows={2} maxLength={500} value={f.comment} onChange={set('comment')}
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          <p className="text-xs text-muted-foreground">Once approved, your review is public with your laboratory name and country. Please don’t include patient data.</p>
          {error && <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><CircleAlert size={13} /> {error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send review'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); setError(null) }}>Cancel</Button>
          </div>
        </form>
      )}

      {reviews.length === 0 && !open ? (
        <p className="mt-4 rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground">
          No reviews yet. If you have run this method, tell other laboratories whether it worked.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reviews.map(r => {
            const { label, icon: Icon, tone } = OUTCOME[r.outcome] ?? OUTCOME.as_published
            const st = r.status ?? 'published'
            return (
              <li key={r.id} className={cn('rounded-lg border border-border bg-muted/30 p-3', st !== 'published' && 'border-dashed opacity-80')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-xs font-medium', tone)}><Icon size={12} /> {label}</span>
                  <span className="text-sm font-medium text-foreground">{r.laboratory}</span>
                  {r.country && <span className="text-xs text-muted-foreground">{r.country}</span>}
                  {r.instrument && <span className="text-xs text-muted-foreground">· {r.instrument}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.changes && <p className="mt-1.5 text-sm text-foreground/90"><span className="text-muted-foreground">{r.outcome === 'failed' ? 'What went wrong: ' : 'Changes: '}</span>{r.changes}</p>}
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                {isAdmin && (
                  <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
                    <span className={cn('rounded px-1.5 py-px text-[11px] font-semibold uppercase',
                      st === 'pending' ? 'bg-warning/15 text-warning' : st === 'hidden' ? 'bg-muted text-muted-foreground' : 'bg-success/15 text-success')}>{st}</span>
                    {st !== 'published' && <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'published')}><Eye /> Publish</Button>}
                    {st !== 'hidden' && <Button size="sm" variant="outline" onClick={() => moderate(r.id, 'hidden')}><EyeOff /> Hide</Button>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
