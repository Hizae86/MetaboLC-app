import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Check, ExternalLink, Inbox, LogIn, ShieldCheck, X } from 'lucide-react'
import SEO from '../components/SEO'
import AdminLoginDialog from '@/components/method/AdminLoginDialog'
import { MatrixBadge } from '@/components/method/badges'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { REVIEW_EVENT, adminConfig, setMethodStatus, useAdmin, type MethodStatus } from '@/lib/admin'
import { API } from '@/lib/api'
import { cn } from '@/lib/utils'
import { moduleTitle } from '@/lib/modules'

interface QueueItem {
  id: number; title: string; analyte: string; matrix: string
  instrument_manufacturer: string; instrument_model: string
  submitted_by: string | null; submitted_by_email: string | null; laboratory: string | null; country: string | null
  source_type: string | null; reference: string | null; source_url: string | null
  mrm_count: number; gradient_count: number; created_at: string | null
}

const TABS = [{ key: 'submitted', label: 'Waiting' }, { key: 'rejected', label: 'Rejected' }, { key: 'reviews', label: 'Community reviews' }, { key: 'early', label: 'Early access' }] as const
/** Tabs that are not lists of submitted methods. */
const OTHER: string[] = ['early', 'reviews']
type TabKey = typeof TABS[number]['key']

/** Reviewer-only page: approve or reject methods sent through the public form. */
export default function ReviewQueue() {
  const { isAdmin, login, logout } = useAdmin()
  const [tab, setTab] = useState<TabKey>('submitted')
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    if (!isAdmin || OTHER.includes(tab)) return
    setItems(null); setError(null)
    axios.get<QueueItem[]>(`${API}/methods/review-queue`, { params: { status: tab }, ...adminConfig() })
      .then(r => setItems(r.data))
      .catch(err => {
        if (err?.response?.status === 401) { logout(); return }
        setError('The review queue could not be loaded. Check that the backend is running.')
      })
  }, [isAdmin, tab, logout])
  useEffect(load, [load])

  const act = async (id: number, status: MethodStatus) => {
    setBusy(id)
    try {
      await setMethodStatus(id, status)
      setItems(prev => prev?.filter(i => i.id !== id) ?? null)
      window.dispatchEvent(new Event(REVIEW_EVENT))
    } catch (err: any) {
      if (err?.response?.status === 401) logout()
      else setError('That change could not be saved. Try again.')
    } finally { setBusy(null) }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card px-6 py-12 text-center">
        <SEO title="Review queue" />
        <LogIn size={28} className="mx-auto mb-3 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Reviewer sign-in required</h1>
        <p className="mt-1 text-sm text-muted-foreground">The review queue lists methods sent through the public form before they are published.</p>
        <Button className="mt-5" onClick={() => setLoginOpen(true)}>Sign in</Button>
        <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLogin={login} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-16">
      <SEO title="Review queue" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Review queue</h1>
          <p className="text-sm text-muted-foreground">Methods sent through the public form. None of them is visible until you publish it.</p>
        </div>
        <div className="flex rounded-lg border border-input p-0.5" role="tablist">
          {TABS.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn('rounded-md px-3 py-1 text-sm font-medium', tab === t.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'early' && <EarlyAccessList onAuthError={logout} />}
      {tab === 'reviews' && <CommunityQueue onAuthError={logout} />}

      {!OTHER.includes(tab) && error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">{error}</p>}

      {!OTHER.includes(tab) && !items && !error && (
        <div className="space-y-2" aria-busy="true">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      )}

      {!OTHER.includes(tab) && items && items.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Inbox size={22} className="mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{tab === 'submitted' ? 'Nothing waiting for review.' : 'No rejected methods.'}</p>
        </div>
      )}

      {!OTHER.includes(tab) && items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map(m => (
            <li key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <MatrixBadge matrix={m.matrix} />
                    <span>{m.instrument_manufacturer} {m.instrument_model}</span>
                    <span>· <span className="num">{m.mrm_count}</span> {m.mrm_count === 1 ? 'transition' : 'transitions'} · <span className="num">{m.gradient_count}</span> gradient {m.gradient_count === 1 ? 'step' : 'steps'}</span>
                    {m.created_at && <span>· sent {new Date(m.created_at).toLocaleDateString()}</span>}
                  </div>
                  <Link to={`/method/${m.id}`} className="font-medium text-foreground no-underline hover:text-primary hover:underline">{m.title}</Link>
                  <p className="truncate text-xs text-muted-foreground" title={m.analyte}>{m.analyte}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    From <span className="text-foreground">{m.submitted_by || 'unknown'}</span>
                    {m.laboratory && <>, {m.laboratory}</>}{m.country && <> ({m.country})</>}
                    {m.submitted_by_email && <> · <a href={`mailto:${m.submitted_by_email}`} className="text-primary hover:underline">{m.submitted_by_email}</a></>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source: {m.source_type || 'not stated'}{m.reference && <> · <span className="num">{m.reference}</span></>}
                    {m.source_url && <> · <a href={m.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">open <ExternalLink size={11} /></a></>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tab === 'submitted' ? (
                    <>
                      <Button size="sm" disabled={busy === m.id} onClick={() => act(m.id, 'pending')}><Check /> Publish</Button>
                      <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => act(m.id, 'verified')} title="Only after comparing it with the source document"><ShieldCheck /> Publish as verified</Button>
                      <Button size="sm" variant="destructive" disabled={busy === m.id} onClick={() => act(m.id, 'rejected')}><X /> Reject</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => act(m.id, 'submitted')}>Back to queue</Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface EarlyEntry {
  id: number; email: string; name: string | null; laboratory: string | null; country: string | null; role: string | null
  vendor: string | null; guideline: string | null; methods_per_year: string | null; method_ids: string | null
  note: string | null; created_at: string
}
interface EarlyData { count: number; entries: EarlyEntry[]; method_demand: { method_id: number; title: string | null; requests: number }[]; module_demand?: { module: string; requests: number }[] }

/** Who asked for early access to the validation module, and which methods they want to validate. */
function EarlyAccessList({ onAuthError }: { onAuthError: () => void }) {
  const [data, setData] = useState<EarlyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    axios.get<EarlyData>(`${API}/validation/waitlist`, adminConfig())
      .then(r => setData(r.data))
      .catch(err => { if (err?.response?.status === 401) onAuthError(); else setError('The early-access list could not be loaded.') })
  }, [onAuthError])
  const download = async () => {
    const r = await axios.get(`${API}/validation/waitlist.csv`, { ...adminConfig(), responseType: 'blob' })
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a'); a.href = url; a.download = 'metabolc-validation-early-access.csv'; a.click()
    URL.revokeObjectURL(url)
  }
  if (error) return <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">{error}</p>
  if (!data) return <Skeleton className="h-24 rounded-xl" />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground"><span className="num font-semibold text-foreground">{data.count}</span> people asked for early access to the validation module.</p>
        {data.count > 0 && <Button size="sm" variant="outline" onClick={download}>Download CSV</Button>}
      </div>
      {!!data.module_demand?.length && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="label-caps mb-2 text-muted-foreground">Modules people asked to hear about</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {data.module_demand.map(d => (
              <li key={d.module} className="flex gap-2"><span className="num font-semibold text-foreground">{d.requests}</span>
                <Link to={`/modules#${d.module}`} className="text-primary hover:underline">{moduleTitle(d.module)}</Link></li>
            ))}
          </ul>
        </section>
      )}
      {data.method_demand.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="label-caps mb-2 text-muted-foreground">Methods people want to validate</h2>
          <ul className="space-y-1 text-sm">
            {data.method_demand.map(d => (
              <li key={d.method_id} className="flex gap-2"><span className="num w-6 text-right text-muted-foreground">{d.requests}</span>
                <Link to={`/method/${d.method_id}`} className="truncate text-primary hover:underline">{d.title || `Method ${d.method_id}`}</Link></li>
            ))}
          </ul>
        </section>
      )}
      {data.entries.length === 0
        ? <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">Nobody has signed up yet.</div>
        : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr>
                {['Email', 'Laboratory', 'Country', 'Role', 'Vendor', 'Guideline', 'Methods/yr', 'Note', 'Date'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.entries.map(e => (
                  <tr key={e.id} className="border-t border-border align-top text-foreground">
                    <td className="px-3 py-2"><a href={`mailto:${e.email}`} className="text-primary hover:underline">{e.email}</a>{e.name && <div className="text-muted-foreground">{e.name}</div>}</td>
                    <td className="px-3 py-2">{e.laboratory || '—'}</td><td className="px-3 py-2">{e.country || '—'}</td>
                    <td className="px-3 py-2">{e.role || '—'}</td><td className="px-3 py-2">{e.vendor || '—'}</td>
                    <td className="px-3 py-2">{e.guideline || '—'}</td><td className="num px-3 py-2">{e.methods_per_year || '—'}</td>
                    <td className="max-w-xs px-3 py-2 text-muted-foreground">{e.note || ''}</td>
                    <td className="num whitespace-nowrap px-3 py-2 text-muted-foreground">{e.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}


interface PendingReview {
  id: number; method_id: number; method_title: string | null; laboratory: string | null; country: string | null
  instrument: string | null; outcome: 'as_published' | 'with_changes' | 'failed'; changes: string | null
  comment: string | null; created_at: string; status: string
}
const OUTCOME_LABEL = { as_published: 'Worked as published', with_changes: 'Worked with changes', failed: 'Didn’t work' } as const

/** Community reviews waiting for a moderator, across all methods. */
function CommunityQueue({ onAuthError }: { onAuthError: () => void }) {
  const [status, setStatus] = useState<'pending' | 'hidden'>('pending')
  const [rows, setRows] = useState<PendingReview[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setRows(null); setError(null)
    axios.get<PendingReview[]>(`${API}/methods/review-queue/community`, { params: { status }, ...adminConfig() })
      .then(r => setRows(r.data))
      .catch(err => { if (err?.response?.status === 401) onAuthError(); else setError('The community reviews could not be loaded.') })
  }, [status, onAuthError])
  useEffect(load, [load])
  const act = async (r: PendingReview, next: 'published' | 'hidden') => {
    try {
      await axios.patch(`${API}/methods/${r.method_id}/confirmations/${r.id}`, { status: next }, adminConfig())
      setRows(prev => prev?.filter(x => x.id !== r.id) ?? null)
      window.dispatchEvent(new Event(REVIEW_EVENT))
    } catch (err: any) {
      if (err?.response?.status === 401) onAuthError(); else setError('That change could not be saved. Try again.')
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Laboratories reporting whether a method worked. Nothing appears on the method page until you publish it.</p>
        <div className="flex rounded-lg border border-input p-0.5">
          {(['pending', 'hidden'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStatus(s)}
              className={cn('rounded-md px-2.5 py-0.5 text-xs font-medium capitalize', status === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground')}>{s === 'pending' ? 'Waiting' : 'Hidden'}</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground">{error}</p>}
      {!rows && !error && <Skeleton className="h-24 rounded-xl" />}
      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          {status === 'pending' ? 'No community reviews waiting.' : 'No hidden reviews.'}
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={cn('rounded-md border px-1.5 py-px text-xs font-medium',
                  r.outcome === 'failed' ? 'border-destructive/40 text-destructive' : r.outcome === 'with_changes' ? 'border-warning/40 text-warning' : 'border-success/40 text-success')}>{OUTCOME_LABEL[r.outcome]}</span>
                <span className="font-medium text-foreground">{r.laboratory}</span>
                {r.country && <span className="text-xs text-muted-foreground">{r.country}</span>}
                {r.instrument && <span className="text-xs text-muted-foreground">· {r.instrument}</span>}
                <span className="num ml-auto text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span>
              </div>
              <Link to={`/method/${r.method_id}#community`} className="mt-1 block truncate text-xs text-primary hover:underline">{r.method_title || `Method ${r.method_id}`}</Link>
              {r.changes && <p className="mt-1.5 text-sm text-foreground/90">{r.changes}</p>}
              {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => act(r, 'published')}><Check /> Publish</Button>
                {status === 'pending' && <Button size="sm" variant="outline" onClick={() => act(r, 'hidden')}><X /> Hide</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
