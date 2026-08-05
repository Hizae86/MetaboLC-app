import { useState, useEffect } from 'react'
import FacetFilters from '../components/FacetFilters'
import MethodComparator from '../components/MethodComparator'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const toTitleCase = (s: string) =>
  s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())

const MATRIX_STYLES: Record<string, string> = {
  plasma: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  serum: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  urine: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  'whole blood': 'bg-red-100 text-red-800 ring-1 ring-red-300',
  'dried blood spot': 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
  csf: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  saliva: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  tissue: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  other: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const BAR_COLORS: Record<string, string> = {
  matrix: 'bg-blue-500',
  vendor: 'bg-violet-500',
  app: 'bg-teal-500',
}

export default function MethodsStats() {
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [facets, setFacets] = useState({
    matrix: [] as string[],
    vendor: [] as string[],
    app: [] as string[],
    ionization: [] as string[],
    verified: false,
    derivatized: false,
  })
  const [filterMatrix, setFilterMatrix] = useState<string | null>(null)
  const [filterMfr, setFilterMfr] = useState<string | null>(null)
  const [filterApp, setFilterApp] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('transitions')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [showComparator, setShowComparator] = useState(false)

  const toggleCompare = (id: number) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id)
      : prev.length < 4 ? [...prev, id] : prev
    )
  }
  const compareMethods = methods.filter(m => compareIds.includes(m.id))

  useEffect(() => {
    axios.get(`${API}/methods/all`)
      .then(res => setMethods(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const byMatrix = methods.reduce((acc, m) => {
    const key = m.matrix || 'other'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byManufacturer = methods.reduce((acc, m) => {
    if (m.instrument_manufacturer)
      acc[m.instrument_manufacturer] = (acc[m.instrument_manufacturer] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const byApplication = methods.reduce((acc, m) => {
    const app = m.clinical_application || 'Not specified'
    acc[app] = (acc[app] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filtered = methods
    .filter(m => !filterMatrix || m.matrix === filterMatrix)
    .filter(m => !filterMfr || m.instrument_manufacturer === filterMfr)
    .filter(m => !filterApp || (m.clinical_application || 'Not specified') === filterApp)
    .filter(m => facets.matrix.length === 0 || facets.matrix.includes(m.matrix))
    .filter(m => facets.vendor.length === 0 || facets.vendor.includes(m.instrument_manufacturer))
    .filter(m => facets.app.length === 0 || facets.app.includes(m.clinical_application || 'other'))
    .filter(m => facets.ionization.length === 0 || facets.ionization.includes(m.ionization_mode))
    .filter(m => !facets.verified || m.status === 'verified')
    .filter(m => !facets.derivatized || m.is_derivatized === 1)
    .sort((a, b) => {
      if (sortBy === 'transitions') return b.mrm_transitions.length - a.mrm_transitions.length
      if (sortBy === 'app') return (a.clinical_application || 'zzz').localeCompare(b.clinical_application || 'zzz')
      return (a.analyte || '').localeCompare(b.analyte || '')
    })

  const activeFilters = [
    filterMatrix && { label: `Matrix: ${toTitleCase(filterMatrix)}`, clear: () => setFilterMatrix(null) },
    filterMfr && { label: `Vendor: ${filterMfr}`, clear: () => setFilterMfr(null) },
    filterApp && { label: toTitleCase(filterApp), clear: () => setFilterApp(null) },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  const BarChart = ({
    data, activeFilter, onFilter, colorClass
  }: {
    data: Record<string, number>
    activeFilter: string | null
    onFilter: (v: string | null) => void
    colorClass: string
  }) => {
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
    const max = Math.max(...sorted.map(([, v]) => v), 1)
    const hasActive = activeFilter !== null

    return (
      <div className="space-y-1.5">
        {sorted.map(([key, count]) => {
          const isActive = activeFilter === key
          const isInactive = hasActive && !isActive
          const pct = Math.round((count / max) * 100)

          return (
            <button key={key} onClick={() => onFilter(isActive ? null : key)}
              title={toTitleCase(key)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                transition-all duration-150 cursor-pointer group
                ${isActive ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'}
                ${isInactive ? 'opacity-40' : 'opacity-100'}`}>
              <span className={`w-28 text-xs shrink-0 truncate
                ${isActive ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                {toTitleCase(key)}
              </span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500
                  ${isActive ? 'bg-blue-600' : colorClass}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-xs font-mono font-semibold min-w-[1.5rem] text-right
                ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
      Loading statistics…
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 
            transition-colors flex items-center gap-1 mb-2">
            ← Repository
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Methods statistics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} of {methods.length} methods
            {activeFilters.length > 0 ? ' — filtered' : ''}
          </p>
        </div>
        {activeFilters.length > 0 && (
          <button onClick={() => { setFilterMatrix(null); setFilterMfr(null); setFilterApp(null) }}
            className="text-xs text-red-500 hover:text-red-700 border border-red-200
              hover:border-red-300 px-3 py-1.5 rounded-lg transition-all">
            Clear all filters
          </button>
        )}
      </div>

      {/* Layout: sidebar + content */}
      <div className="flex gap-8 items-start">
      <div className="pt-1">
        <FacetFilters
          methods={methods}
          filters={facets}
          onChange={setFacets}
          onClearAll={() => setFacets({matrix:[],vendor:[],app:[],ionization:[],verified:false,derivatized:false})}
        />
      </div>
      <div className="flex-1 min-w-0">

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeFilters.map((f, i) => (
            <span key={i} onClick={f.clear}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                bg-blue-50 text-blue-700 text-xs font-medium ring-1 ring-blue-200
                cursor-pointer hover:bg-blue-100 transition-colors">
              {f.label}
              <span className="text-blue-400 hover:text-blue-700">×</span>
            </span>
          ))}
        </div>
      )}

      {/* Methods list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Methods
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({filtered.length})
            </span>
          </h2>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-xs text-slate-600 border border-slate-200 rounded-lg
              px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="transitions">Sort by transitions</option>
            <option value="name">Sort by analyte</option>
            <option value="app">Sort by application</option>
          </select>
        </div>

        {/* Table header */}
        <div className="grid gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100"
          style={{gridTemplateColumns:'28px 90px 1fr 140px 130px 60px 80px'}}>
          <span></span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Matrix</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Analyte / Title</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vendor</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Application</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider text-center">Status</span>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider text-right">MRM</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No methods match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(method => {
              const matrixKey = (method.matrix || 'other').toLowerCase()
              const matrixClass = MATRIX_STYLES[matrixKey] || MATRIX_STYLES.other
              const analytes = (method.analyte || '').split(',').map((a: string) => a.trim()).filter(Boolean)
              const isExpanded = expandedId === method.id

              return (
                <div key={method.id}
                  className="grid gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors items-start group"
                  style={{gridTemplateColumns:"28px 90px 1fr 140px 130px 60px 80px", background: compareIds.includes(method.id) ? "#eff6ff" : "", outline: compareIds.includes(method.id) ? "1.5px solid #bfdbfe" : "none", borderRadius:"6px"}}>
                  <div className="flex items-center pt-0.5">
                    <input type="checkbox"
                      checked={compareIds.includes(method.id)}
                      onChange={() => toggleCompare(method.id)}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                      disabled={compareIds.length >= 4 && !compareIds.includes(method.id)}
                    />
                  </div>

                  {/* Matrix */}
                  <div className="pt-0.5">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 
                      rounded-md ${matrixClass}`}>
                      {toTitleCase(method.matrix || 'other')}
                    </span>
                  </div>

                  {/* Analyte */}
                  <div>
                    <Link to={`/method/${method.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-blue-600
                        transition-colors leading-snug block"
                      title={method.analyte}>
                      {analytes.length > 3 && !isExpanded
                        ? analytes.slice(0, 3).join(', ') + ` +${analytes.length - 3} more`
                        : method.analyte}
                    </Link>
                    {analytes.length > 3 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : method.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 
                          mt-1 transition-colors">
                        {isExpanded ? '▲ Collapse' : `▼ Show all ${analytes.length}`}
                      </button>
                    )}
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {analytes.map((a: string, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-md
                            bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vendor */}
                  <div className="pt-0.5">
                    <span className="text-xs font-medium text-slate-600">
                      {method.instrument_manufacturer}
                    </span>
                    {method.instrument_model && (
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {method.instrument_model}
                      </span>
                    )}
                  </div>

                  {/* Clinical Application */}
                  <div className="pt-0.5">
                    {method.clinical_application ? (
                      <span className="text-xs px-2 py-0.5 rounded-full
                        bg-teal-50 text-teal-700 ring-1 ring-teal-200 font-medium
                        whitespace-nowrap overflow-hidden text-ellipsis block max-w-[120px]"
                        title={method.clinical_application}>
                        {method.clinical_application.length > 18
                          ? method.clinical_application.slice(0,18)+'…'
                          : method.clinical_application}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex justify-center pt-0.5">
                    {method.status === 'verified'
                      ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                          bg-green-50 text-green-700 ring-1 ring-green-200"><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'><polyline points='20 6 9 17 4 12'/></svg></span>
                      : <span className="text-xs text-slate-300">—</span>}
                  </div>

                  {/* MRM count */}
                  <div className="text-right pt-0.5">
                    <span className="text-sm font-semibold font-mono text-blue-600">
                      {method.mrm_transitions.length}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">MRM</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {/* Floating compare bar */}
      {compareIds.length >= 2 && !showComparator && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2
          bg-slate-900 text-white rounded-xl px-5 py-3
          flex items-center gap-4 shadow-lg">
          <span className="text-sm font-medium">
            {compareIds.length} method{compareIds.length > 1 ? 's' : ''} selected
          </span>
          <button onClick={() => setShowComparator(true)}
            className="px-4 py-1.5 bg-white text-slate-900 rounded-lg
              text-xs font-semibold hover:bg-slate-100 transition-all">
            Compare →
          </button>
          <button onClick={() => setCompareIds([])}
            className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>
      )}

      {showComparator && (
        <MethodComparator
          methods={compareMethods}
          onClose={() => { setShowComparator(false); setCompareIds([]) }}
        />
      )}
    </div>
      </div>
      </div>
  )
}
