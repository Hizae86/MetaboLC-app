import { Link, useNavigate } from 'react-router-dom'
import { FilePlus2, SearchX, ServerCrash } from 'lucide-react'
import type { MethodHit } from '@/lib/api'
import { num } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Chip, MatrixBadge, Score, TransitionChip, Verified } from '@/components/method/badges'
import { cn } from '@/lib/utils'
import { CommunityBadge } from '@/components/CommunityReviews'

interface ListProps {
  items: MethodHit[]
  compareIds: number[]
  onToggleCompare: (id: number) => void
  stale?: boolean
}

const compoundsLine = (m: MethodHit) => {
  if (m.compounds_preview.length === 0) return m.analyte
  const extra = m.compound_count - m.compounds_preview.length
  return m.compounds_preview.join(', ') + (extra > 0 ? ` +${extra}` : '')
}

function CompareBox({ m, compareIds, onToggleCompare }: { m: MethodHit } & Omit<ListProps, 'items' | 'stale'>) {
  const checked = compareIds.includes(m.id)
  return (
    <input type="checkbox" checked={checked} disabled={!checked && compareIds.length >= 4}
      onChange={() => onToggleCompare(m.id)} onClick={e => e.stopPropagation()}
      aria-label={`Compare ${m.title}`} title="Select to compare (up to 4)"
      className="size-3.5 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed" />
  )
}

function Matches({ m }: { m: MethodHit }) {
  if (m.matched_transitions.length === 0) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {m.matched_transitions.map((t, i) => (
        <TransitionChip key={i} label={t.compound} precursor={t.precursor_mz} product={t.product_mz} />
      ))}
    </div>
  )
}

const th = 'label-caps whitespace-nowrap px-3 py-2 text-left font-semibold'

export function ResultsTable({ items, compareIds, onToggleCompare, stale }: ListProps) {
  const navigate = useNavigate()
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border bg-card transition-opacity', stale && 'opacity-60')}>
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="w-8 px-3 py-2"><span className="sr-only">Compare</span></th>
            <th className={th}>Method</th>
            <th className={th}>Instrument</th>
            <th className={th}>Column</th>
            <th className={cn(th, 'text-right')}>LLOQ</th>
            <th className={cn(th, 'text-right')}>MRM</th>
            <th className={cn(th, 'text-right')}>Complete</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id} onClick={() => navigate(`/method/${m.id}`)}
              className="cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-accent/50">
              <td className="px-3 py-2.5"><CompareBox m={m} compareIds={compareIds} onToggleCompare={onToggleCompare} /></td>
              <td className="max-w-80 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Link to={`/method/${m.id}`} onClick={e => e.stopPropagation()}
                    className="truncate font-medium text-foreground no-underline hover:text-primary hover:underline" title={m.title}>
                    {m.title}
                  </Link>
                  {m.status === 'verified' && <Verified className="shrink-0" />}
                  <CommunityBadge summary={m.community} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <MatrixBadge matrix={m.matrix} />
                  <p className="min-w-0 truncate text-xs text-muted-foreground" title={m.analyte}>{compoundsLine(m)}</p>
                </div>
                <Matches m={m} />
              </td>
              <td className="max-w-36 px-3 py-2.5">
                <span className="block truncate text-foreground">{m.instrument_manufacturer}</span>
                <span className="block truncate text-xs text-muted-foreground" title={m.instrument_model || ''}>{m.instrument_model || '—'}</span>
              </td>
              <td className="max-w-36 px-3 py-2.5">
                <span className="block truncate text-foreground" title={m.column_name || ''}>{m.column_name || '—'}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.column_stationary_phase || ''}</span>
              </td>
              <td className="num whitespace-nowrap px-3 py-2.5 text-right">
                {m.lloq != null ? <>{num(m.lloq)} <span className="text-xs text-muted-foreground">{m.lloq_unit || 'ng/mL'}</span></> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="num px-3 py-2.5 text-right">{m.mrm_count}</td>
              <td className="px-3 py-2.5"><div className="flex justify-end pt-0.5"><Score value={m.completeness_score} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ResultsCards({ items, compareIds, onToggleCompare, stale }: ListProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3', stale && 'opacity-60')}>
      {items.map(m => (
        <Link key={m.id} to={`/method/${m.id}`}
          className="group flex flex-col rounded-xl border border-border bg-card p-3.5 no-underline transition-colors hover:border-primary/50">
          <div className="mb-2 flex items-center gap-1.5">
            <CompareBox m={m} compareIds={compareIds} onToggleCompare={onToggleCompare} />
            <MatrixBadge matrix={m.matrix} />
            <Chip>{m.instrument_manufacturer}</Chip>
            <span className="ml-auto flex items-center gap-1.5">
              <CommunityBadge summary={m.community} />
              {m.status === 'verified' && <Verified />}
            </span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">{m.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={m.analyte}>{compoundsLine(m)}</p>
          <Matches m={m} />
          {m.chromatogram_svg && (
            <div className="mt-2 h-10 overflow-hidden rounded-md bg-muted/50 leading-none"
              dangerouslySetInnerHTML={{ __html: m.chromatogram_svg }} />
          )}
          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
            <span className="truncate" title={m.column_name || ''}>{m.column_stationary_phase || m.column_name || '—'}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="num">{m.mrm_count} MRM</span>
              <Score value={m.completeness_score} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}

export function ResultsSkeleton({ view }: { view: 'table' | 'cards' }) {
  if (view === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading methods">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2.5 rounded-xl border border-border bg-card p-3.5">
            <Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card" aria-busy="true" aria-label="Loading methods">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3">
          <Skeleton className="size-3.5" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4" style={{ width: `${70 - (i % 4) * 9}%` }} /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="h-5 w-16" /><Skeleton className="hidden h-4 w-24 md:block" /><Skeleton className="hidden h-4 w-28 lg:block" /><Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  )
}

export function EmptyResults({ query, hasFilters, onClear }: { query: string; hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><SearchX size={18} /></span>
      <h2 className="text-base font-semibold text-foreground">
        {query ? <>No methods match “{query}”</> : 'No methods match these filters'}
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {hasFilters
          ? 'Try removing a filter or widening the m/z tolerance. Compound names are matched against every MRM transition, not only the method title.'
          : 'Check the spelling or search by a transition m/z instead. If your lab runs this assay, you can add it to the library.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {(hasFilters || query) && <Button variant="outline" onClick={onClear}>Clear search and filters</Button>}
        <Button asChild><Link to="/submit" className="no-underline"><FilePlus2 /> Submit this method</Link></Button>
      </div>
    </div>
  )
}

export function ErrorResults({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"><ServerCrash size={18} /></span>
      <h2 className="text-base font-semibold text-foreground">Couldn’t load methods</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The Koiné API didn’t respond. Check that the backend is running, then try again.
      </p>
      <Button variant="outline" className="mt-5" onClick={onRetry}>Try again</Button>
    </div>
  )
}
