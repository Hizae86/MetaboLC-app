import { useState } from 'react'
import { Check, EyeOff, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setMethodStatus, type MethodStatus } from '@/lib/admin'
import { cn } from '@/lib/utils'

const COPY: Record<'submitted' | 'rejected', { title: string; body: string }> = {
  submitted: {
    title: 'Awaiting review: not visible to the public',
    body: 'Check it against its source before publishing. "Publish" lists it as not yet verified; "Publish as verified" only if you have compared it with the source document.',
  },
  rejected: {
    title: 'Rejected: not visible to the public',
    body: 'It stays here so it can be restored.',
  },
}

/** Shown to reviewers on a method that is not public yet. */
export default function ModerationBar({ method, onChanged, onAuthError }: {
  method: any; onChanged: (status: MethodStatus) => void; onAuthError: (err: any) => boolean
}) {
  const [busy, setBusy] = useState<MethodStatus | null>(null)
  const [error, setError] = useState(false)
  if (method.status !== 'submitted' && method.status !== 'rejected') return null
  const copy = COPY[method.status as 'submitted' | 'rejected']

  const change = async (status: MethodStatus) => {
    setBusy(status); setError(false)
    try { await setMethodStatus(method.id, status); onChanged(status) }
    catch (err) { if (!onAuthError(err)) setError(true) }
    finally { setBusy(null) }
  }

  return (
    <div role="status" className={cn('no-print flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
      method.status === 'submitted' ? 'border-warning/50 bg-warning/10' : 'border-destructive/40 bg-destructive/5')}>
      <EyeOff size={17} className={cn('shrink-0', method.status === 'submitted' ? 'text-warning' : 'text-destructive')} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{copy.title}</p>
        <p className="text-xs text-muted-foreground">{copy.body}</p>
        {error && <p className="mt-1 text-xs text-destructive">The status could not be changed. Try again.</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {method.status === 'submitted' ? (
          <>
            <Button size="sm" disabled={!!busy} onClick={() => change('pending')}><Check /> Publish</Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => change('verified')}><ShieldCheck /> Publish as verified</Button>
            <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => change('rejected')}><X /> Reject</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => change('submitted')}><RotateCcw /> Back to review queue</Button>
        )}
      </div>
    </div>
  )
}
