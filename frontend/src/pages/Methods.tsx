import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, Grid3X3, List } from 'lucide-react'
import axios from 'axios'
import TrendingCarousel from '../components/TrendingCarousel'
import ChromatogramChart from '../components/ChromatogramChart'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const MATRIX_CLS: Record<string, string> = {
  plasma: 'bg-red-50 text-red-700 border-red-200',
  serum: 'bg-orange-50 text-orange-700 border-orange-200',
  urine: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'whole blood': 'bg-red-100 text-red-900 border-red-300',
  'dried blood spot': 'bg-pink-50 text-pink-700 border-pink-200',
  csf: 'bg-blue-50 text-blue-700 border-blue-200',
  saliva: 'bg-green-50 text-green-700 border-green-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
}

const VENDOR_CLS: Record<string, string> = {
  'Sciex': 'bg-blue-50 text-blue-700 border-blue-200',
  'Waters': 'bg-teal-50 text-teal-700 border-teal-200',
  'Thermo Fisher': 'bg-orange-50 text-orange-700 border-orange-200',
  'Agilent': 'bg-purple-50 text-purple-700 border-purple-200',
  'Shimadzu': 'bg-rose-50 text-rose-700 border-rose-200',
  'Bruker': 'bg-amber-50 text-amber-700 border-amber-200',
  'other': 'bg-slate-50 text-slate-600 border-slate-200',
}

const MATRIX_PILLS = ['plasma', 'serum', 'urine', 'whole blood', 'dried blood spot', 'csf']

export default function Methods() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [methods, setMethods] = useState<any[]>([])
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [matrixFilter, setMatrixFilter] = useState('')
  const [page, setPage] = useState(20)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    axios.get(`${API}/methods/summary`)
      .then(res => setMethods(res.data))
      .finally(() => setLoading(false))
  }, [])

  // Filter methods
  const filtered = methods.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || [m.analyte, m.title, m.matrix, m.instrument_manufacturer,
      m.column_name, m.clinical_application].some(f => f?.toLowerCase().includes(q))
    const matchMatrix = !matrixFilter || m.matrix?.toLowerCase() === matrixFilter
    return matchSearch && matchMatrix
  })

  return (
    <div style={{maxWidth:'1280px', margin:'0 auto', padding:'1.5rem'}} className="space-y-4 pb-12">

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-slate-200
            rounded-xl hover:border-indigo-400 focus-within:border-indigo-500
            focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">
            <Search size={18} className="text-indigo-400 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search analytes, matrix or m/z (e.g. 304.2)…"
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <button onClick={() => setViewMode('grid')}
            className={`px-3 py-2 flex items-center gap-1 text-xs transition-all
              ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Grid3X3 size={13} /> Grid
          </button>
          <button onClick={() => setViewMode('list')}
            className={`px-3 py-2 flex items-center gap-1 text-xs border-l border-slate-200 transition-all
              ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
            <List size={13} /> List
          </button>
        </div>
      </div>

      {/* Trending - only when no filters active */}
      {!search && !matrixFilter && <TrendingCarousel />}

      {/* Matrix filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setMatrixFilter('')}
          className={`text-xs px-3 py-1 rounded-full border font-medium transition-all
            ${!matrixFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
          All ({methods.length})
        </button>
        {MATRIX_PILLS.map(m => (
          <button key={m} onClick={() => setMatrixFilter(matrixFilter === m ? '' : m)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-all capitalize
              ${matrixFilter === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading methods…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No methods found</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, page).map(m => {
            const matrixKey = (m.matrix || 'other').toLowerCase()
            const matrixCls = MATRIX_CLS[matrixKey] || MATRIX_CLS.other
            const vendorCls = VENDOR_CLS[m.instrument_manufacturer] || VENDOR_CLS.other
            return (
              <Link key={m.id} to={`/method/${m.id}`} style={{textDecoration:'none'}}>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden
                  hover:-translate-y-1 hover:shadow-lg hover:border-indigo-200
                  transition-all duration-200 flex flex-col h-full group shadow-sm">
                  {/* Color bar */}
                  <div className={`h-0.5 w-full border-b ${matrixCls}`} />
                  <div className="p-3 flex flex-col flex-1">
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${matrixCls}`}>
                        {m.matrix}
                      </span>
                      {m.status === 'verified' && (
                        <span className="text-xs text-green-600 font-medium">✓</span>
                      )}
                    </div>
                    {/* Title */}
                    <p className="text-sm font-semibold text-slate-900 mb-1 leading-snug tracking-tight flex-1">
                      {m.title?.length > 60 ? m.title.slice(0, 60) + '…' : m.title}
                    </p>
                    {/* Analytes */}
                    <p className="text-xs text-slate-400 mb-2 truncate">
                      {m.analyte?.split(',').slice(0, 3).join(', ')}
                      {m.analyte?.split(',').length > 3 ? '…' : ''}
                    </p>

                    {/* Cached chromatogram */}
                    {m.chromatogram_svg && (
                      <div className="rounded-lg overflow-hidden bg-slate-50 mb-2"
                        style={{height:'40px', lineHeight:0}}
                        dangerouslySetInnerHTML={{__html: m.chromatogram_svg}} />
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${vendorCls}`}>
                        {m.instrument_manufacturer}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {m.mrm_count || 0} MRM
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filtered.map(m => {
            const matrixKey = (m.matrix || 'other').toLowerCase()
            const matrixCls = MATRIX_CLS[matrixKey] || MATRIX_CLS.other
            const vendorCls = VENDOR_CLS[m.instrument_manufacturer] || VENDOR_CLS.other
            return (
              <Link key={m.id} to={`/method/${m.id}`} style={{textDecoration:'none'}}>
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3
                  hover:border-indigo-200 hover:shadow-sm transition-all flex items-center gap-4">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md border shrink-0 ${matrixCls}`}>
                    {m.matrix}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.title}</p>
                    <p className="text-xs text-slate-400 truncate">{m.analyte}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium shrink-0 ${vendorCls}`}>
                    {m.instrument_manufacturer}
                  </span>
                  <span className="text-xs text-slate-400 font-mono shrink-0">
                    {m.mrm_count || 0} MRM
                  </span>
                  {m.status === 'verified' && (
                    <span className="text-xs text-green-600 shrink-0">✓</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
