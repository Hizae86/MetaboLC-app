import { useState } from 'react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { adminConfig } from '@/lib/admin'
import { API } from '@/lib/api'
import IssueList from '@/components/IssueList'
import { suggestedPolarity, type TransitionIssue } from '@/lib/massSpec'

/** Reviewer decision on one transition flagged by the automatic checks:
 *  switch its polarity, confirm it as correct, or withdraw a confirmation. */
export default function TransitionReviewDialog({ methodId, methodIonization, t, issues, onClose, onSaved }: {
  methodId: number; methodIonization?: string | null; t: any | null; issues: TransitionIssue[]
  onClose: () => void; onSaved: (patch: { id: number; polarity: string; review_checked: number }) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suggestion = t ? suggestedPolarity(t, issues) : null
  const methodOnly = !suggestion && issues.some(i => i.code === 'method-polarity')

  const save = async (body: { polarity?: string; review_checked?: number }) => {
    if (!t) return
    setBusy(true); setError(null)
    try {
      const r = await axios.patch(`${API}/methods/${methodId}/transitions/${t.id}`, body, adminConfig())
      onSaved(r.data); onClose()
    } catch (e: any) {
      setError(e?.response?.status === 401 ? 'Your admin key is no longer valid. Sign in again.' : e?.response?.data?.detail || 'Could not save.')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!t} onOpenChange={o => { if (!o) { onClose(); setError(null) } }}>
      <DialogContent className="sm:max-w-md">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle>{t.compound_name}</DialogTitle>
              <DialogDescription>
                <span className="num">{t.precursor_mz} › {t.product_mz}</span> · {t.polarity || 'no polarity'}
                {methodIonization ? ` · method ${methodIonization}` : ''}
              </DialogDescription>
            </DialogHeader>
            {t.review_checked
              ? <p className="text-sm text-muted-foreground">A reviewer confirmed this transition as correct, so its warnings are hidden.</p>
              : <IssueList issues={issues} />}
            {!t.review_checked && methodOnly && (
              <p className="text-xs text-muted-foreground">If the method acquires in both polarities, the transition is fine: change the method's ionization mode (Edit → Basic Info → Ionization mode) instead.</p>
            )}
            <p className="text-xs text-muted-foreground">Check the transition against the source (table, figure or method file) before deciding. To correct an m/z value, use Edit → MRM Transitions.</p>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {t.review_checked ? (
                <Button variant="outline" disabled={busy} onClick={() => save({ review_checked: 0 })}>Withdraw confirmation</Button>
              ) : (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => save({ review_checked: 1 })}>Correct as recorded</Button>
                  {suggestion && <Button disabled={busy} onClick={() => save({ polarity: suggestion })}>Change to {suggestion.replace('-', '−')}</Button>}
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
