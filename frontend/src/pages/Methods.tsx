import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { LayoutGrid, SlidersHorizontal, Table2, X } from 'lucide-react'
import SEO from '../components/SEO'
import SearchBox from '@/components/explore/SearchBox'
import FacetSidebar, { type FilterState } from '@/components/explore/FacetSidebar'
import { EmptyResults, ErrorResults, ResultsCards, ResultsSkeleton, ResultsTable } from '@/components/explore/Results'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { FACETS, isCancel, searchMethods, type FacetKey, type SearchResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 48
const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'completeness', label: 'Completeness' },
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Analyte A–Z' },
]
type View = 'table' | 'cards'

/** The URL is the single source of truth for search state, so any result
 *  set can be bookmarked or pasted into a message to a colleague. */
const readState = (sp: URLSearchParams): FilterState => ({
  facets: Object.fromEntries(
    FACETS.map(f => [f.key, sp.getAll(f.key).map(v => v.toLowerCase())]),
  ) as Record<FacetKey, string[]>,
  mz: sp.get('mz') ?? '',
  mzTol: sp.get('tol') ?? '0.5',
  verified: sp.get('verified') === '1',
  derivatized: sp.get('derivatized') === '1',
})

export default function Methods() {
  const [sp, setSp] = useSearchParams()
  const urlQuery = sp.get('q') ?? ''
  const sort = sp.get('sort') ?? 'relevance'
  const view: View = sp.get('view') === 'cards' ? 'cards' : 'table'
  const state = useMemo(() => readState(sp), [sp])

  const [text, setText] = useState(urlQuery)
  const [count, setCount] = useState(PAGE_SIZE)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  const navigate = useNavigate()
  const [compareIds, setCompareIds] = useState<number[]>([])

  const update = useCallback((mutate: (p: URLSearchParams) => void) => {
    setSp(prev => { const next = new URLSearchParams(prev); mutate(next); return next }, { replace: true })
    setCount(PAGE_SIZE)
  }, [setSp])

  // Typing → URL (debounced so each keystroke isn't a history entry or request).
  useEffect(() => {
    const q = text.trim()
    if (q === urlQuery) return
    const timer = setTimeout(() => update(p => (q ? p.set('q', q) : p.delete('q'))), 180)
    return () => clearTimeout(timer)
  }, [text, urlQuery, update])
  // URL → input (back/forward, links from Home or the command palette).
  useEffect(() => { setText(t => (t.trim() === urlQuery ? t : urlQuery)) }, [urlQuery])

  const filterKey = useMemo(() => {
    const p = new URLSearchParams(sp); p.delete('view'); p.sort(); return p.toString()
  }, [sp])

  const firstLoad = useRef(true)
  useEffect(() => {
    const params = new URLSearchParams()
    if (urlQuery) params.set('q', urlQuery)
    FACETS.forEach(f => state.facets[f.key].forEach(v => params.append(f.key, v)))
    if (state.mz && !Number.isNaN(Number(state.mz))) { params.set('mz', state.mz); params.set('mz_tol', state.mzTol) }
    if (state.verified) params.set('verified', 'true')
    if (state.derivatized) params.set('derivatized', 'true')
    params.set('sort', sort)
    params.set('limit', String(count))
    if (view === 'cards') params.set('thumbnails', 'true')

    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchMethods(params, ctrl.signal)
        .then(res => { setData(res); setError(false); setLoading(false) })
        .catch(err => { if (!isCancel(err)) { setError(true); setLoading(false) } })
    }, firstLoad.current ? 0 : 120)
    firstLoad.current = false
    return () => { clearTimeout(timer); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, count, view, retry])

  const toggleFacet = (facet: FacetKey, value: string) => update(p => {
    const current = p.getAll(facet).map(v => v.toLowerCase())
    p.delete(facet)
    ;(current.includes(value) ? current.filter(v => v !== value) : [...current, value]).forEach(v => p.append(facet, v))
  })
  const setFlags = (patch: Partial<Pick<FilterState, 'mz' | 'mzTol' | 'verified' | 'derivatized'>>) => update(p => {
    if (patch.mz !== undefined) patch.mz ? p.set('mz', patch.mz) : p.delete('mz')
    if (patch.mzTol !== undefined) patch.mzTol === '0.5' ? p.delete('tol') : p.set('tol', patch.mzTol)
    if (patch.verified !== undefined) patch.verified ? p.set('verified', '1') : p.delete('verified')
    if (patch.derivatized !== undefined) patch.derivatized ? p.set('derivatized', '1') : p.delete('derivatized')
  })
  const clearAll = () => {
    setText('')
    update(p => { [...p.keys()].forEach(k => { if (k !== 'view' && k !== 'sort') p.delete(k) }) })
  }

  // Active filters as removable chips.
  const chips: { key: string; label: string; remove: () => void }[] = []
  FACETS.forEach(f => state.facets[f.key].forEach(v => chips.push({
    key: `${f.key}:${v}`,
    label: data?.facets[f.key]?.find(x => x.value === v)?.label ?? v,
    remove: () => toggleFacet(f.key, v),
  })))
  if (state.mz) chips.push({ key: 'mz', label: `m/z ${state.mz} ± ${state.mzTol}`, remove: () => setFlags({ mz: '' }) })
  if (state.verified) chips.push({ key: 'verified', label: 'Verified', remove: () => setFlags({ verified: false }) })
  if (state.derivatized) chips.push({ key: 'derivatized', label: 'Derivatized', remove: () => setFlags({ derivatized: false }) })

  const toggleCompare = (id: number) => setCompareIds(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 4 ? [...prev, id] : prev)

  const openComparator = () => navigate(`/compare?ids=${compareIds.join(',')}`)

  const sidebar = <FacetSidebar state={state} facets={data?.facets} onToggle={toggleFacet} onSet={setFlags} />
  const items = data?.items ?? []
  const remaining = data ? data.total - items.length : 0

  return (
    <div className="space-y-4 pb-16">
      <SEO title="Browse Clinical LC-MS/MS Methods"
        description="Search clinical LC-MS/MS methods by analyte, matrix, column, mobile phase and MRM transition across the Koiné repository." />

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Methods</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? <><span className="num text-foreground">{data.total}</span> of <span className="num">{data.catalogue_total}</span> methods</>
              : 'Loading the library…'}
          </p>
        </div>
      </header>

      <SearchBox
        value={text}
        onChange={setText}
        onPickCompound={setText}
        onPickFilter={(facet, value) => { setText(''); toggleFacet(facet, value) }}
        onPickMz={mz => { setText(''); setFlags({ mz: String(mz) }) }}
      />

      <div className="flex gap-8">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">{sidebar}</aside>

        <section className="min-w-0 flex-1 space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal /> Filters{chips.length > 0 && <span className="num">· {chips.length}</span>}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="px-4 pb-6">{sidebar}</div>
              </SheetContent>
            </Sheet>

            {chips.map(c => (
              <button key={c.key} type="button" onClick={c.remove} title="Remove filter"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-2.5 pr-1.5 text-xs font-medium text-foreground hover:bg-primary/20">
                {c.label}<X size={12} className="text-muted-foreground" />
              </button>
            ))}
            {(chips.length > 0 || urlQuery) && (
              <button type="button" onClick={clearAll} className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                Clear all
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Sort
                <select value={sort} onChange={e => update(p => p.set('sort', e.target.value))}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring">
                  {SORTS.map(s => <option key={s.value} value={s.value} className="bg-popover">{s.label}</option>)}
                </select>
              </label>
              <div className="flex overflow-hidden rounded-lg border border-input" role="group" aria-label="Result layout">
                {([['table', Table2, 'Table'], ['cards', LayoutGrid, 'Cards']] as const).map(([v, Icon, label]) => (
                  <button key={v} type="button" aria-pressed={view === v} title={`${label} view`}
                    onClick={() => setSp(prev => { const n = new URLSearchParams(prev); v === 'table' ? n.delete('view') : n.set('view', v); return n }, { replace: true })}
                    className={cn('flex h-8 w-9 items-center justify-center transition-colors',
                      view === v ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60')}>
                    <Icon size={15} /><span className="sr-only">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error ? <ErrorResults onRetry={() => { setError(false); setRetry(r => r + 1) }} />
            : !data ? <ResultsSkeleton view={view} />
            : items.length === 0 ? <EmptyResults query={urlQuery} hasFilters={chips.length > 0} onClear={clearAll} />
            : view === 'cards'
              ? <ResultsCards items={items} compareIds={compareIds} onToggleCompare={toggleCompare} stale={loading} />
              : <ResultsTable items={items} compareIds={compareIds} onToggleCompare={toggleCompare} stale={loading} />}

          {!error && remaining > 0 && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" disabled={loading} onClick={() => setCount(c => c + PAGE_SIZE)}>
                {loading ? 'Loading…' : <>Show {Math.min(PAGE_SIZE, remaining)} more <span className="num text-muted-foreground">({remaining} left)</span></>}
              </Button>
            </div>
          )}
        </section>
      </div>

      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2.5 text-popover-foreground shadow-xl">
          <span className="text-sm"><span className="num font-semibold">{compareIds.length}</span> selected</span>
          <Button disabled={compareIds.length < 2} onClick={openComparator}>
            {compareIds.length < 2 ? 'Select one more' : 'Compare'}
          </Button>
          <button type="button" onClick={() => setCompareIds([])} aria-label="Clear selection" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
