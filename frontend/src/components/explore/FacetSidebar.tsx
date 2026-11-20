import { useState } from 'react'
import { FACETS, type FacetKey, type FacetValue } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const COLLAPSED_COUNT = 6
const TOLERANCES = ['0.1', '0.5', '1']

export interface FilterState {
  facets: Record<FacetKey, string[]>
  mz: string
  mzTol: string
  verified: boolean
  derivatized: boolean
}

interface Props {
  state: FilterState
  facets?: Record<FacetKey, FacetValue[]>
  onToggle: (facet: FacetKey, value: string) => void
  onSet: (patch: Partial<Pick<FilterState, 'mz' | 'mzTol' | 'verified' | 'derivatized'>>) => void
}

function CheckRow({ checked, onChange, label, count, muted }: {
  checked: boolean; onChange: () => void; label: string; count?: number; muted?: boolean
}) {
  return (
    <label className={cn(
      'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/60',
      muted && !checked && 'text-muted-foreground',
    )}>
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 shrink-0 cursor-pointer accent-[var(--primary)]" />
      <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
      {count !== undefined && <span className="num text-xs text-muted-foreground">{count}</span>}
    </label>
  )
}

function Group({ label, values, selected, onToggle }: {
  label: string; values: FacetValue[]; selected: string[]; onToggle: (value: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (values.length === 0) return null
  // Selected values always stay visible, even when the list is collapsed.
  const visible = expanded ? values : values.filter((v, i) => i < COLLAPSED_COUNT || selected.includes(v.value))
  const hidden = values.length - visible.length
  return (
    <fieldset className="space-y-0.5">
      <legend className="label-caps mb-1.5 px-1.5">{label}</legend>
      {visible.map(v => (
        <CheckRow key={v.value} label={v.label} count={v.count} muted={v.count === 0}
          checked={selected.includes(v.value)} onChange={() => onToggle(v.value)} />
      ))}
      {(hidden > 0 || expanded) && values.length > COLLAPSED_COUNT && (
        <button type="button" onClick={() => setExpanded(e => !e)}
          className="px-1.5 pt-1 text-xs font-medium text-primary hover:underline">
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </fieldset>
  )
}

/** Every filter is visible and one click away; counts update as you filter. */
export default function FacetSidebar({ state, facets, onToggle, onSet }: Props) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label-caps mb-1.5 px-1.5">MRM transition</legend>
        <div className="flex items-center gap-1.5 px-1.5">
          <Input
            inputMode="decimal"
            value={state.mz}
            onChange={e => onSet({ mz: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })}
            placeholder="m/z  e.g. 363.2"
            aria-label="Precursor or product m/z"
            className="num h-8 flex-1"
          />
          <select value={state.mzTol} onChange={e => onSet({ mzTol: e.target.value })} aria-label="m/z tolerance"
            className="num h-8 rounded-lg border border-input bg-transparent px-1.5 text-xs text-foreground outline-none focus-visible:border-ring">
            {TOLERANCES.map(t => <option key={t} value={t} className="bg-popover">± {t}</option>)}
          </select>
        </div>
        <p className="px-1.5 pt-1 text-xs text-muted-foreground">Matches precursor (Q1) or product (Q3).</p>
      </fieldset>

      <fieldset className="space-y-0.5">
        <legend className="label-caps mb-1.5 px-1.5">Status</legend>
        <CheckRow label="Verified only" checked={state.verified} onChange={() => onSet({ verified: !state.verified })} />
        <CheckRow label="Derivatized" checked={state.derivatized} onChange={() => onSet({ derivatized: !state.derivatized })} />
      </fieldset>

      {facets
        ? FACETS.map(f => (
            <Group key={f.key} label={f.label} values={facets[f.key] || []}
              selected={state.facets[f.key]} onToggle={v => onToggle(f.key, v)} />
          ))
        : Array.from({ length: 4 }).map((_, g) => (
            <div key={g} className="space-y-2 px-1.5">
              <Skeleton className="h-3 w-20" />
              {Array.from({ length: 4 }).map((__, i) => <Skeleton key={i} className="h-4" style={{ width: `${85 - i * 12}%` }} />)}
            </div>
          ))}
    </div>
  )
}
