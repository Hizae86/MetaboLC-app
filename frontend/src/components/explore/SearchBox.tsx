import { useEffect, useRef, useState } from 'react'
import { FlaskConical, Search, SlidersHorizontal, Waves, X } from 'lucide-react'
import { FACETS, isCancel, suggest, type FacetKey, type Suggestions } from '@/lib/api'
import { cn } from '@/lib/utils'

type Option =
  | { kind: 'compound'; label: string; count: number }
  | { kind: 'filter'; facet: FacetKey; value: string; label: string; count: number }
  | { kind: 'mz'; value: number; count: number; tolerance: number }

interface Props {
  value: string
  onChange: (text: string) => void
  onPickCompound: (name: string) => void
  onPickFilter: (facet: FacetKey, value: string) => void
  onPickMz: (mz: number) => void
}

const facetLabel = (key: FacetKey) => FACETS.find(f => f.key === key)?.label ?? key

/** Search input with autocomplete. Typing filters results live; the dropdown
 *  turns what you typed into a precise filter (compound, facet or m/z) in one
 *  click or with ↑ ↓ Enter. "/" focuses the box from anywhere on the page. */
export default function SearchBox({ value, onChange, onPickCompound, onPickFilter, onPickMz }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [data, setData] = useState<Suggestions | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      if (e.key === '/' && !typing) { e.preventDefault(); inputRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) { setData(null); return }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      suggest(q, ctrl.signal).then(setData).catch(err => { if (!isCancel(err)) setData(null) })
    }, 120)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [value])

  const options: Option[] = data ? [
    ...(data.mz && data.mz.count > 0 ? [{ kind: 'mz' as const, ...data.mz }] : []),
    ...data.filters.map(f => ({ kind: 'filter' as const, ...f })),
    ...data.compounds.map(c => ({ kind: 'compound' as const, label: c.name, count: c.count })),
  ] : []
  const showList = open && options.length > 0

  const pick = (o: Option) => {
    if (o.kind === 'compound') onPickCompound(o.label)
    else if (o.kind === 'filter') onPickFilter(o.facet, o.value)
    else onPickMz(o.value)
    setOpen(false); setActive(-1)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return }
    if (!showList) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? options.length - 1 : i - 1)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(options[active]) }
  }

  return (
    <div className="relative">
      <div className="flex h-11 items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 shadow-xs transition-colors
        focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
        <Search size={17} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls="method-search-suggestions"
          aria-autocomplete="list"
          aria-label="Search methods"
          placeholder="Search analyte, column, mobile phase or m/z (e.g. tacrolimus, biphenyl, 821.5)"
          className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {value ? (
          <button type="button" onClick={() => { onChange(''); inputRef.current?.focus() }} aria-label="Clear search"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X size={15} />
          </button>
        ) : (
          <kbd className="num hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:block">/</kbd>
        )}
      </div>

      {showList && (
        <ul id="method-search-suggestions" role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {options.map((o, i) => (
            <li key={`${o.kind}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(o) }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm', i === active && 'bg-accent text-accent-foreground')}>
              {o.kind === 'compound' && <FlaskConical size={14} className="shrink-0 text-muted-foreground" />}
              {o.kind === 'filter' && <SlidersHorizontal size={14} className="shrink-0 text-muted-foreground" />}
              {o.kind === 'mz' && <Waves size={14} className="shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">
                {o.kind === 'compound' && o.label}
                {o.kind === 'filter' && <><span className="text-muted-foreground">{facetLabel(o.facet)}: </span>{o.label}</>}
                {o.kind === 'mz' && <>Transitions with <span className="num">m/z {o.value} ± {o.tolerance}</span></>}
              </span>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {o.count} {o.count === 1 ? 'method' : 'methods'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
