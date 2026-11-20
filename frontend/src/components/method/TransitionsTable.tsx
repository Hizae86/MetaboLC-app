import { useMemo, useState } from 'react'
import { AlertTriangle, Check, CircleCheck, Copy, SearchCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isNum, num } from '@/lib/format'
import { useAdmin } from '@/lib/admin'
import { adductLabel, checkTransition, visibleIssues, worstLevel, type TransitionIssue } from '@/lib/massSpec'
import TransitionReviewDialog from './TransitionReviewDialog'
import { copyText, transitionColumns, transitionsToTSV } from '@/lib/methodText'
import { cn } from '@/lib/utils'

const ALWAYS = new Set(['precursor_mz', 'product_mz', 'collision_energy_ev'])

function Role({ t }: { t: any }) {
  const [label, cls, title] = t.is_internal_standard
    ? ['IS', 'text-istd border-istd/40 bg-istd/10', 'Internal standard']
    : t.is_quantifier
      ? ['Quant', 'text-quant border-quant/40 bg-quant/10', 'Quantifier transition']
      : ['Qual', 'text-qual border-border bg-muted/60', 'Qualifier transition']
  return <span title={title} className={cn('inline-flex h-5 w-12 items-center justify-center rounded border text-[11px] font-semibold', cls)}>{label}</span>
}

/** Flags a transition whose product is heavier than its precursor or whose
 *  polarity disagrees with the adduct or the method (see lib/massSpec).
 *  Reviewers get a button that opens the review dialog. */
function TransitionFlag({ t, issues, adduct, onReview }: { t: any; issues: TransitionIssue[]; adduct: string | null; onReview?: () => void }) {
  const shown = visibleIssues(t, issues)
  const level = worstLevel(shown)
  if (!level) {
    if (t.review_checked && onReview)
      return <button type="button" onClick={onReview} title="Confirmed by a reviewer. Click to review again." aria-label="Confirmed by a reviewer"
        className="inline-flex rounded p-0.5 text-success/70 hover:bg-accent hover:text-success"><CircleCheck size={13} /></button>
    return adduct ? <span className="sr-only">{adduct}</span> : null
  }
  const Icon = level === 'error' ? XCircle : AlertTriangle
  const text = shown.map(i => i.message).join(' ')
  const cls = cn('inline-flex rounded p-0.5', level === 'error' ? 'text-destructive' : 'text-warning')
  return onReview
    ? <button type="button" onClick={onReview} title={`${text} Click to review.`} aria-label={`Review: ${text}`} className={cn(cls, 'hover:bg-accent')}><Icon size={13} /></button>
    : <span title={text} aria-label={text} className={cls}><Icon size={13} /></span>
}

/** MRM table: analytes first (quantifier before qualifiers), internal
 *  standards last. The compound name is printed once per group so the eye can
 *  run down the m/z columns. Columns with no data at all are hidden. */
export default function TransitionsTable({ method }: { method: any }) {
  const { isAdmin } = useAdmin()
  // Reviewer edits are applied locally so the table updates without reloading the method.
  const [patches, setPatches] = useState<Record<number, any>>({})
  const [reviewing, setReviewing] = useState<any | null>(null)
  const all: any[] = useMemo(() => (method.mrm_transitions || []).map((t: any) => (patches[t.id] ? { ...t, ...patches[t.id] } : t)), [method, patches])
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState(false)

  const columns = useMemo(
    () => transitionColumns(method).filter(c => ALWAYS.has(c.field) || all.some(t => t[c.field] !== null && t[c.field] !== undefined && t[c.field] !== '')),
    [method, all],
  )

  const groups = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const map = new Map<string, any[]>()
    all
      .filter(t => !needle || (t.compound_name || '').toLowerCase().includes(needle)
        || String(t.precursor_mz).startsWith(needle) || String(t.product_mz).startsWith(needle))
      .forEach(t => {
        const key = `${t.is_internal_standard ? 1 : 0}|${(t.compound_name || '').trim()}`
        map.set(key, [...(map.get(key) || []), t])
      })
    return [...map.entries()]
      .map(([key, rows]) => ({
        key, isIS: key.startsWith('1|'), name: key.slice(2),
        rows: [...rows].sort((a, b) => (b.is_quantifier ? 1 : 0) - (a.is_quantifier ? 1 : 0)),
      }))
      .sort((a, b) => Number(a.isIS) - Number(b.isIS))
  }, [all, filter])

  const checks = useMemo(() => all.map(t => ({ t, issues: checkTransition(t, { methodIonization: method.ionization_mode }), adduct: adductLabel(t) })), [all, method.ionization_mode])
  const checkOf = (t: any) => checks.find(c => c.t === t)!

  if (all.length === 0) return <p className="text-xs text-muted-foreground/70">No MRM transitions reported.</p>

  const flagged = checks.filter(c => visibleIssues(c.t, c.issues).length > 0)
  const errors = flagged.filter(c => visibleIssues(c.t, c.issues).some(i => i.level === 'error')).length
  const analytes = new Set(all.filter(t => !t.is_internal_standard).map(t => t.compound_name)).size
  const standards = new Set(all.filter(t => t.is_internal_standard).map(t => t.compound_name)).size
  const copy = async () => { if (await copyText(transitionsToTSV(method))) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          <span className="num text-foreground">{analytes}</span> analyte{analytes === 1 ? '' : 's'} ·{' '}
          <span className="num text-foreground">{standards}</span> IS ·{' '}
          <span className="num text-foreground">{all.length}</span> transitions
        </p>
        {flagged.length > 0 && (
          <span title={isAdmin ? 'Click the icon in each row to change the polarity or confirm the transition.' : 'Product heavier than the precursor, or polarity that disagrees with the adduct or the method. Hover the icon in each row for details.'}
            className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
              errors ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-warning/40 bg-warning/10 text-warning')}>
            {errors ? <XCircle size={12} /> : <AlertTriangle size={12} />} {flagged.length} to check
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {all.length > 10 && (
            <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter compound or m/z" aria-label="Filter transitions" className="h-7 w-44 text-xs" />
          )}
          <Button variant="outline" size="sm" onClick={copy} title="Copy as tab-separated values (pastes into Excel or an acquisition table)">
            {copied ? <><Check /> Copied</> : <><Copy /> Copy table</>}
          </Button>
        </div>
      </div>

      <div className="relative max-h-[34rem] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Compound</th>
              <th className="px-2 py-2 text-left font-medium">Role</th>
              {columns.map(c => (
                <th key={c.field} className={cn('whitespace-nowrap px-2.5 py-2 font-medium', c.field === 'polarity' ? 'text-left' : 'text-right')}>{c.label}</th>
              ))}
              <th className="w-6 px-1 py-2"><span className="sr-only">Transition check</span></th>
              <th className="w-8 px-2 py-2"><span className="sr-only">Interference check</span></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={columns.length + 4} className="px-3 py-6 text-center text-xs text-muted-foreground">No transitions match “{filter}”.</td></tr>
            )}
            {groups.map(g => g.rows.map((t, i) => (
              <tr key={`${g.key}-${i}`} className={cn('hover:bg-accent/40', i === 0 && 'border-t border-border', g.isIS && 'bg-istd/[0.04]')}>
                <td className="max-w-56 px-3 py-1.5 align-top">
                  {i === 0 && (
                    <>
                      <span className="block truncate font-medium text-foreground" title={g.name}>{g.name}</span>
                      {t.assigned_is && <span className="block truncate text-xs text-muted-foreground" title={`Internal standard: ${t.assigned_is}`}>IS: {t.assigned_is}</span>}
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5"><Role t={t} /></td>
                {columns.map(c => {
                  const v = t[c.field]
                  const empty = v === null || v === undefined || v === ''
                  return (
                    <td key={c.field} className={cn('num whitespace-nowrap px-2.5 py-1.5',
                      c.field === 'polarity' ? 'text-left text-xs text-muted-foreground' : 'text-right',
                      (c.field === 'precursor_mz' || c.field === 'product_mz') && 'font-medium text-foreground',
                      empty && 'text-muted-foreground/50')}>
                      {empty ? '—' : isNum(v) ? num(v) : String(v)}
                    </td>
                  )
                })}
                <td className="no-print px-1 py-1.5 text-center">
                  <TransitionFlag t={t} issues={checkOf(t).issues} adduct={checkOf(t).adduct}
                    onReview={isAdmin && t.id ? () => setReviewing(t) : undefined} />
                </td>
                <td className="no-print px-2 py-1.5 text-right">
                  {isNum(t.precursor_mz) && isNum(t.product_mz) && (
                    <Link to={`/tools/interference?q1=${t.precursor_mz}&q3=${t.product_mz}&exclude=${method.id}`}
                      title="Check this transition for isobaric overlaps in other methods"
                      className="inline-flex rounded p-0.5 text-muted-foreground/60 no-underline hover:bg-accent hover:text-primary">
                      <SearchCheck size={13} />
                    </Link>
                  )}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <TransitionReviewDialog methodId={method.id} methodIonization={method.ionization_mode}
          t={reviewing} issues={reviewing ? checkOf(reviewing)?.issues || [] : []}
          onClose={() => setReviewing(null)}
          onSaved={p => setPatches(prev => ({ ...prev, [p.id]: { polarity: p.polarity, review_checked: p.review_checked } }))} />
      )}
    </div>
  )
}
