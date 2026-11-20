import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, ClipboardCheck, FileQuestion, ServerCrash, TriangleAlert } from 'lucide-react'
import SEO from '../components/SEO'
import CommunityReviews from '../components/CommunityReviews'
import SimilarMethods from '../components/SimilarMethods'
import ValidationView from '../components/ValidationView'
import MethodHeader from '@/components/method/MethodHeader'
import LCPanel from '@/components/method/LCPanel'
import MSPanel from '@/components/method/MSPanel'
import GreenPanel from '@/components/method/GreenPanel'
import SamplePrep from '@/components/method/SamplePrep'
import MethodEditDialog from '@/components/method/MethodEditDialog'
import AdminLoginDialog from '@/components/method/AdminLoginDialog'
import ModerationBar from '@/components/method/ModerationBar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { REVIEW_EVENT, adminConfig, setMethodStatus, useAdmin } from '@/lib/admin'
import { API } from '@/lib/api'

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

// The API stores "not applicable" as a flag next to each value.
const withNotApplicable = (rows: any[]) => rows.map(v => ({
  ...v,
  lod: v.lod_na ? 'N/A' : v.lod,
  loq: v.loq_na ? 'N/A' : v.loq,
  r2: v.r2_na ? 'N/A' : v.r2,
  cv_percent: v.cv_percent_na ? 'N/A' : v.cv_percent,
  accuracy_percent: v.accuracy_percent_na ? 'N/A' : v.accuracy_percent,
}))

function SheetSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading method">
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-5 w-48" /><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-3 gap-3 pt-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {[0, 1].map(i => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-5 w-40" /><Skeleton className="h-24" /><Skeleton className="h-44" /><Skeleton className="h-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

function Problem({ kind, onRetry }: { kind: 'not-found' | 'error'; onRetry: () => void }) {
  const notFound = kind === 'not-found'
  const Icon = notFound ? FileQuestion : ServerCrash
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon size={18} /></span>
      <h1 className="text-base font-semibold text-foreground">{notFound ? 'This method doesn’t exist' : 'Couldn’t load this method'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {notFound
          ? 'It may have been removed, or the link is incomplete.'
          : 'The Koiné API didn’t respond. Check that the backend is running, then try again.'}
      </p>
      <div className="mt-5 flex gap-2">
        {!notFound && <Button variant="outline" onClick={onRetry}>Try again</Button>}
        <Button asChild><Link to="/methods" className="no-underline">Browse methods</Link></Button>
      </div>
    </div>
  )
}

export default function MethodDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, login, logout } = useAdmin()

  const [method, setMethod] = useState<any>(null)
  const [validation, setValidation] = useState<any[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [editTab, setEditTab] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback((silent = false) => {
    if (!silent) setState('loading')
    // Reviewers send their key so they can open methods that are not public yet.
    axios.get(`${API}/methods/${id}`, adminConfig())
      .then(res => { setMethod(res.data); setState('ready') })
      .catch(err => setState(err?.response?.status === 404 || err?.response?.status === 422 ? 'not-found' : 'error'))
    axios.get(`${API}/methods/${id}/validation`, adminConfig())
      .then(res => setValidation(withNotApplicable(res.data)))
      .catch(() => setValidation([]))
  }, [id, isAdmin])

  useEffect(() => { load() }, [load])

  // A 401 means the stored key is wrong or expired: leave admin mode rather
  // than keep showing edit controls whose saves will fail.
  const onAuthError = (err: any) => {
    if (err?.response?.status !== 401) return false
    logout()
    setEditTab(null)
    setNotice('Your admin key is no longer valid. Sign in again to keep editing.')
    return true
  }

  const verify = async () => {
    try {
      const res = await setMethodStatus(Number(id), method.status === 'verified' ? 'pending' : 'verified')
      setMethod((prev: any) => ({ ...prev, ...res }))
    } catch (err) { if (!onAuthError(err)) setNotice('The verification status could not be changed. Try again.') }
  }

  const remove = async () => {
    if (!window.confirm('Delete this method permanently? This cannot be undone.')) return
    try {
      await axios.delete(`${API}/methods/${id}`, adminConfig())
      navigate('/methods')
    } catch (err) { if (!onAuthError(err)) setNotice('The method could not be deleted. Try again.') }
  }

  if (state === 'loading') return <SheetSkeleton />
  if (state !== 'ready' || !method) return <Problem kind={state === 'not-found' ? 'not-found' : 'error'} onRetry={() => load()} />

  const validationStatus = validation.length === 0 ? 'missing'
    : validation.some((v: any) => v.lloq || v.loq || v.cv_percent) ? 'complete' : 'partial'
  const seoDescription = [
    method.analyte && method.matrix ? `${method.analyte} in ${method.matrix}` : null,
    method.instrument_manufacturer ? `on ${method.instrument_manufacturer} ${method.instrument_model || ''}`.trim() : null,
    method.lloq ? `LLOQ ${method.lloq} ${method.lloq_unit || 'ng/mL'}` : null,
  ].filter(Boolean).join(' · ') || undefined

  return (
    <div className="space-y-4 pb-12">
      <SEO title={method.title || `${method.analyte || 'Method'} in ${method.matrix || 'sample'}`} description={seoDescription} />

      <Link to="/methods" className="no-print inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft size={14} /> Methods
      </Link>

      {notice && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <TriangleAlert size={15} className="shrink-0 text-warning" />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {isAdmin && (
        <ModerationBar method={method} onAuthError={onAuthError}
          onChanged={status => { setMethod((prev: any) => ({ ...prev, status })); window.dispatchEvent(new Event(REVIEW_EVENT)) }} />
      )}

      <MethodHeader method={method} validationStatus={validationStatus} isAdmin={isAdmin}
        onEdit={() => setEditTab('basic')} onVerify={verify} onDelete={remove} />

      {/* The two halves of the method side by side: what goes on the LC, what goes on the MS. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <LCPanel method={method} />
        <MSPanel method={method} />
      </div>

      <GreenPanel key={method.id} method={method} />

      <section className="rounded-xl border border-border bg-card p-4">
        <Tabs defaultValue="prep">
          {/* Scrolls sideways only if the tabs don't fit (phones), with no visible scrollbar */}
          <div className="max-w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="w-max">
              <TabsTrigger value="prep">Sample preparation</TabsTrigger>
              <TabsTrigger value="validation">Validation{validation.length > 0 && <span className="num ml-1 text-xs opacity-70">{validation.length}</span>}</TabsTrigger>
              <TabsTrigger value="reference">Reference &amp; notes</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="prep" className="pt-3"><SamplePrep method={method} /></TabsContent>
          <TabsContent value="validation" className="pt-3">
            <ValidationView validation={validation} units={method.validation_units || 'ng/mL'}
              onEdit={isAdmin ? () => setEditTab('validation') : undefined} />
            <Link to={`/tools/unit-converter?unit=${encodeURIComponent(method.validation_units || method.lloq_unit || 'ng/mL')}&analyte=${encodeURIComponent((method.analyte || '').split(',')[0].trim())}${method.lloq ? `&value=${method.lloq}` : ''}`}
              className="no-print mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary no-underline hover:underline">
              Convert these units to molar (nmol/L) →
            </Link>
            <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">Validate this method in your laboratory</p>
                <p className="text-xs text-muted-foreground">Free: the experiments, concentrations, injections and acceptance criteria for this method under ICH M10 or a clinical profile (CLSI, ISO 15189, IVDR), with the source of every rule. Results upload and the dossier are in <Link to={`/validation?method=${method.id}`} className="font-medium text-primary hover:underline">early access</Link>.</p>
              </div>
              <Link to={`/validation/plan?method=${method.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary/85">
                <ClipboardCheck size={14} /> Get the validation plan
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="reference" className="space-y-3 pt-3 text-sm">
            {!method.reference && !method.notes && <p className="text-muted-foreground">No reference or notes were submitted with this method.</p>}
            {method.reference && <div><h3 className="label-caps mb-1">Reference</h3><p className="break-words text-foreground">{method.reference}</p></div>}
            {method.notes && <div><h3 className="label-caps mb-1">Notes</h3><p className="whitespace-pre-wrap text-foreground">{method.notes}</p></div>}
          </TabsContent>
        </Tabs>
      </section>

      <div className="no-print">
        <SimilarMethods methodId={method.id} analyte={method.analyte || ''} matrix={method.matrix || ''} />
        <CommunityReviews methodId={Number(id)} isAdmin={isAdmin} />
      </div>

      <footer className="space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <p>
          For research and method-development reference only. Clinical use requires local validation per ISO 15189 or an
          equivalent accreditation standard. Koiné does not guarantee analytical performance under your laboratory’s conditions.{' '}
          <Link to={`/validation?method=${method.id}`} className="no-print font-medium text-primary hover:underline">Validate this method (early access)</Link>
        </p>
        <p className="no-print flex flex-wrap gap-x-4 gap-y-1">
          <a className="font-medium text-primary hover:underline"
            href={`mailto:hello@metabolc.io?subject=${encodeURIComponent(`Error report: method #${method.id}`)}&body=${encodeURIComponent(`Method: ${method.title}\nID: ${method.id}\n\nWhat is wrong:\n`)}`}>
            Report an error in this method
          </a>
          <Link to="/verification" className="hover:text-foreground hover:underline">What “verified” means</Link>
          {isAdmin
            ? <button type="button" onClick={logout} className="hover:text-foreground hover:underline">Sign out of reviewer mode</button>
            : <button type="button" onClick={() => setLoginOpen(true)} className="hover:text-foreground hover:underline">Reviewer sign-in</button>}
        </p>
      </footer>

      {editTab && (
        <MethodEditDialog method={method} validation={validation} initialTab={editTab}
          onClose={() => setEditTab(null)} onSaved={() => { setEditTab(null); load(true) }} onAuthError={onAuthError} />
      )}
      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLogin={login} />
    </div>
  )
}
