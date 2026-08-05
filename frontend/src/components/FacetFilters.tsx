import { useState } from 'react'

interface FilterOption {
  value: string
  label: string
  count: number
}

interface FilterGroup {
  id: string
  label: string
  type: 'checkbox' | 'toggle'
  options?: FilterOption[]
  searchable?: boolean
}

interface Props {
  methods: any[]
  filters: {
    matrix: string[]
    vendor: string[]
    app: string[]
    ionization: string[]
    verified: boolean
    derivatized: boolean
  }
  onChange: (filters: any) => void
  onClearAll: () => void
}

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())

export default function FacetFilters({ methods, filters, onChange, onClearAll }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState<Record<string, string>>({})

  const activeCount = filters.matrix.length + filters.vendor.length +
    filters.app.length + filters.ionization.length +
    (filters.verified ? 1 : 0) + (filters.derivatized ? 1 : 0)

  // Count per value
  const countBy = (key: string) => methods.reduce((acc, m) => {
    const val = m[key] || 'other'
    acc[val] = (acc[val] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const matrixCounts = countBy('matrix')
  const vendorCounts = countBy('instrument_manufacturer')
  const appCounts = countBy('clinical_application')
  const ionCounts = countBy('ionization_mode')

  const toggle = (group: string, val: string) => {
    const current = filters[group as keyof typeof filters] as string[]
    onChange({
      ...filters,
      [group]: current.includes(val) ? current.filter(v => v !== val) : [...current, val]
    })
  }

  const CheckGroup = ({
    id, label, counts, selected, searchKey
  }: {
    id: string, label: string,
    counts: Record<string, number>,
    selected: string[],
    searchKey?: boolean
  }) => {
    const isCollapsed = collapsed[id]
    const q = search[id] || ''
    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .filter(([k]) => !q || k.toLowerCase().includes(q.toLowerCase()))

    return (
      <div className="border-b border-slate-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
        <button
          onClick={() => setCollapsed(c => ({ ...c, [id]: !c[id] }))}
          className="w-full flex justify-between items-center mb-2 group">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            {selected.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50
                text-blue-600 ring-1 ring-blue-200 font-medium">
                {selected.length}
              </span>
            )}
            <span className="text-slate-400 text-xs">{isCollapsed ? '▶' : '▼'}</span>
          </div>
        </button>

        {!isCollapsed && (
          <>
            {searchKey && (
              <input
                value={q}
                onChange={e => setSearch(s => ({ ...s, [id]: e.target.value }))}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg
                  bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
            )}
            <div className="space-y-0.5">
              {entries.map(([val, count]) => (
                <label key={val}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg
                    cursor-pointer hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={selected.includes(val)}
                      onChange={() => toggle(id, val)}
                      className="w-3.5 h-3.5 accent-blue-600 rounded"
                    />
                    <span className={`text-xs ${selected.includes(val)
                      ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                      {toTitleCase(val)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{count}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="w-52 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Filters
        </span>
        {activeCount > 0 && (
          <button onClick={onClearAll}
            className="text-xs text-red-500 hover:text-red-700 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Quick toggles */}
      <div className="space-y-2 mb-4 pb-4 border-b border-slate-100">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-slate-700">Verified only</span>
          <div className="relative">
            <input type="checkbox" className="sr-only peer"
              checked={filters.verified}
              onChange={e => onChange({ ...filters, verified: e.target.checked })} />
            <div className="w-8 h-4 bg-slate-200 rounded-full peer
              peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full
              peer-checked:translate-x-4 transition-transform" />
          </div>
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs font-medium text-slate-700">Derivatized</span>
          <div className="relative">
            <input type="checkbox" className="sr-only peer"
              checked={filters.derivatized}
              onChange={e => onChange({ ...filters, derivatized: e.target.checked })} />
            <div className="w-8 h-4 bg-slate-200 rounded-full peer
              peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full
              peer-checked:translate-x-4 transition-transform" />
          </div>
        </label>
      </div>

      {/* Checkbox groups */}
      <CheckGroup id="matrix" label="Matrix"
        counts={matrixCounts} selected={filters.matrix} />
      <CheckGroup id="vendor" label="Vendor"
        counts={vendorCounts} selected={filters.vendor} />
      <CheckGroup id="app" label="Application"
        counts={appCounts} selected={filters.app} searchKey />
      <CheckGroup id="ionization" label="Ionization"
        counts={ionCounts} selected={filters.ionization} />
    </div>
  )
}
