import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, FlaskConical, ExternalLink } from 'lucide-react'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Compound {
  name: string
  normalized: string
  pubchem_cid: number | null
  formula: string | null
  exact_mass: number | null
  methods: { id: number; matrix: string; instrument: string; status: string }[]
  method_count: number
}

const MATRIX_CLS: Record<string, { bg: string; text: string }> = {
  plasma:             { bg: '#fef2f2', text: '#b91c1c' },
  serum:              { bg: '#fff7ed', text: '#c2410c' },
  urine:              { bg: '#fefce8', text: '#a16207' },
  'whole blood':      { bg: '#fef2f2', text: '#991b1b' },
  'dried blood spot': { bg: '#fdf4ff', text: '#7e22ce' },
  csf:                { bg: '#eff6ff', text: '#1e40af' },
  saliva:             { bg: '#f0fdf4', text: '#15803d' },
  other:              { bg: '#f8fafc', text: '#475569' },
}

export default function CompoundIndex() {
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set())

  useEffect(() => {
    axios.get(`${API}/methods/compounds`)
      .then(res => setCompounds(res.data))
      .finally(() => setLoading(false))
  }, [])

  const filtered = compounds.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.formula?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{maxWidth:'1280px', margin:'0 auto', padding:'1.5rem'}}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1">
          Compound Index
        </h1>
        <p className="text-xs text-slate-400">
          {compounds.length} unique analytes
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-slate-200
        rounded-xl focus-within:border-indigo-500 focus-within:ring-4
        focus-within:ring-indigo-500/10 transition-all shadow-sm mb-6">
        <Search size={16} className="text-indigo-400 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by compound name or formula…"
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="text-slate-400 hover:text-slate-600">×</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading compounds…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(c => (
            <div key={c.normalized}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden
                hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5
                transition-all duration-200 flex flex-col">

              {/* Structure image */}
              <div className="bg-slate-50 flex items-center justify-center p-3"
                style={{height:'120px'}}>
                {c.pubchem_cid && c.pubchem_cid > 0 && !imgErrors.has(c.pubchem_cid) ? (
                  <img
                    src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${c.pubchem_cid}/PNG`}
                    alt={c.name}
                    loading="lazy"
                    style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain', background:'white'}}
                    onError={() => setImgErrors(prev => new Set([...prev, c.pubchem_cid!]))}
                    onLoad={e => (e.currentTarget.style.opacity = '1')}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <FlaskConical size={24} className="text-slate-300" />
                    {c.formula && (
                      <span className="text-xs font-mono text-slate-400">{c.formula}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex flex-col flex-1">
                <p className="text-xs font-semibold text-slate-900 mb-1 leading-snug">
                  {c.name}
                </p>

                {c.formula && (
                  <p className="text-xs font-mono text-indigo-600 mb-1">{c.formula}</p>
                )}

                {c.exact_mass && (
                  <p className="text-xs text-slate-400 mb-2 font-mono">
                    {c.exact_mass.toFixed(4)} Da
                  </p>
                )}

                {/* Matrix badges */}
                <div className="flex flex-wrap gap-1 mb-2 flex-1">
                  {[...new Set(c.methods.map(m => m.matrix?.toLowerCase()))].slice(0, 3).map(matrix => {
                    const mc = MATRIX_CLS[matrix || 'other'] || MATRIX_CLS.other
                    return (
                      <span key={matrix}
                        className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                        style={{background: mc.bg, color: mc.text}}>
                        {matrix}
                      </span>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    {c.method_count} method{c.method_count !== 1 ? 's' : ''}
                  </span>
                  {c.pubchem_cid && c.pubchem_cid > 0 && (
                    <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${c.pubchem_cid}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-slate-400 hover:text-indigo-500 transition-colors"
                      onClick={e => e.stopPropagation()}>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
