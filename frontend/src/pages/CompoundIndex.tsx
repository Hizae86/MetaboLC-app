import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, FlaskConical, ExternalLink } from 'lucide-react'
import SEO from '../components/SEO'
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

const MATRIX_CLS: Record<string, { bg: string; text: string; border: string }> = {
  plasma:             { bg: 'rgba(248,113,113,0.12)', text: '#f87171', border: 'rgba(248,113,113,0.3)' },
  serum:              { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', border: 'rgba(251,146,60,0.3)' },
  urine:              { bg: 'rgba(250,204,21,0.12)',  text: '#facc15', border: 'rgba(250,204,21,0.3)' },
  'whole blood':      { bg: 'rgba(192,132,252,0.12)', text: '#c084fc', border: 'rgba(192,132,252,0.3)' },
  'dried blood spot': { bg: 'rgba(244,114,182,0.12)', text: '#f472b6', border: 'rgba(244,114,182,0.3)' },
  csf:                { bg: 'rgba(125,211,252,0.12)', text: '#7dd3fc', border: 'rgba(125,211,252,0.3)' },
  saliva:             { bg: 'rgba(74,222,128,0.12)',  text: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  other:              { bg: 'rgba(255,255,255,0.06)', text: '#94a3b8', border: 'rgba(255,255,255,0.12)' },
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
    <>
    <SEO title="Compound Index — Analytes Across Clinical LC-MS/MS Methods"
      description="Browse every analyte in the MetaboLC repository with formula, exact mass, and the methods that quantify it." />
    <style>{`
      .compounds-page { background: #060d1a; min-height: 100vh; }
      .compounds-page .bg-white { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.08) !important; }
      .compounds-page .border-slate-200 { border-color: rgba(255,255,255,0.08) !important; }
      .compounds-page .text-slate-900, .compounds-page .text-slate-800 { color: #e2e8f0 !important; }
      .compounds-page .text-slate-600 { color: #94a3b8 !important; }
      .compounds-page .text-slate-500 { color: #64748b !important; }
      .compounds-page .text-slate-400 { color: #475569 !important; }
      .compounds-page .bg-slate-50 { background: rgba(255,255,255,0.03) !important; }
      .compounds-page .hover\\:text-slate-600:hover { color: #94a3b8 !important; }
      .compounds-page input { color: #e2e8f0 !important; }
      .compounds-page img { filter: invert(1) hue-rotate(180deg) brightness(0.9); border-radius: 6px; }
    `}</style>
    <div className='compounds-page' style={{maxWidth:'1280px', margin:'0 auto', padding:'1.5rem'}}>
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
                hover:border-indigo-400/40 hover:shadow-md hover:-translate-y-0.5
                transition-all duration-200 flex flex-col">

              {/* Structure image */}
              {(() => {
                const hasImg = !!(c.pubchem_cid && c.pubchem_cid > 0 && !imgErrors.has(c.pubchem_cid))
                return (
                  <div className="flex items-center justify-center p-3"
                    style={{height:'120px', background: hasImg ? '#000000' : 'rgba(255,255,255,0.03)'}}>
                    {hasImg ? (
                      <img
                        src={`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${c.pubchem_cid}/PNG`}
                        alt={c.name}
                        loading="lazy"
                        style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}}
                        onError={() => setImgErrors(prev => new Set([...prev, c.pubchem_cid!]))}
                        onLoad={e => (e.currentTarget.style.opacity = '1')}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <FlaskConical size={24} className="text-slate-600" />
                        {c.formula && (
                          <span className="text-xs font-mono text-slate-500">{c.formula}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Info */}
              <div className="p-3 flex flex-col flex-1">
                {/* Name */}
                <p className="text-xs font-semibold text-slate-900 leading-snug mb-1 truncate" title={c.name}>
                  {c.name}
                </p>

                {/* Formula + mass in one line */}
                <div className="flex items-center gap-1.5 mb-2">
                  {c.formula && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                      style={{background:'rgba(129,140,248,0.12)', color:'#a5b4fc', border:'1px solid rgba(129,140,248,0.25)'}}>
                      {c.formula}
                    </span>
                  )}
                  {c.exact_mass && (
                    <span className="text-xs font-mono text-slate-400">
                      {c.exact_mass.toFixed(3)}
                    </span>
                  )}
                </div>

                {/* Matrix badges — max 2 + overflow */}
                {(() => {
                  const matrices = [...new Set(c.methods.map((m: any) => m.matrix?.toLowerCase()).filter(Boolean))]
                  const visible = matrices.slice(0, 2)
                  const extra = matrices.length - 2
                  return (
                    <div className="flex items-center gap-1 mb-2 flex-1">
                      {visible.map((matrix: any) => {
                        const mc = MATRIX_CLS[matrix] || MATRIX_CLS.other
                        return (
                          <span key={matrix}
                            className="text-xs px-1.5 py-0.5 rounded-md font-medium truncate max-w-[70px]"
                            style={{background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`}} title={matrix}>
                            {matrix}
                          </span>
                        )
                      })}
                      {extra > 0 && (
                        <span className="text-xs text-slate-400 font-medium">+{extra}</span>
                      )}
                    </div>
                  )
                })()}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
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
    </>
  )
}