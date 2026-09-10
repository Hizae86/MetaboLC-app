import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Eye, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

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

const VENDOR_CLS: Record<string, string> = {
  'Sciex': 'bg-blue-500/10 text-blue-300 border-blue-400/30',
  'Waters': 'bg-teal-500/10 text-teal-300 border-teal-400/30',
  'Thermo Fisher': 'bg-orange-500/10 text-orange-300 border-orange-400/30',
  'Agilent': 'bg-purple-500/10 text-purple-300 border-purple-400/30',
  'Shimadzu': 'bg-rose-500/10 text-rose-300 border-rose-400/30',
  'Bruker': 'bg-amber-500/10 text-amber-300 border-amber-400/30',
  'other': 'bg-white/5 text-slate-400 border-white/10',
}

export default function TrendingCarousel() {
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    axios.get(`${API}/methods/trending`)
      .then(res => setMethods(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const updateScrollState = () => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    updateScrollState()
  }, [methods])

  const scrollByAmount = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * 320, behavior: 'smooth' })
    setTimeout(updateScrollState, 300)
  }

  if (loading || methods.length === 0) return null

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-slate-100">Trending this month</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300
          ring-1 ring-orange-400/30 font-medium">Most viewed</span>
      </div>

      {/* Scroll container */}
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollByAmount(-1)}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full
              flex items-center justify-center transition-all"
            style={{ background: '#0e1b2e', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <ChevronLeft size={16} className="text-slate-300" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollByAmount(1)}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full
              flex items-center justify-center transition-all"
            style={{ background: '#0e1b2e', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <ChevronRight size={16} className="text-slate-300" />
          </button>
        )}

        <div
          ref={trackRef}
          onScroll={updateScrollState}
          className="flex gap-3 overflow-x-auto"
          style={{
            scrollSnapType: 'x proximity',
            scrollbarWidth: 'none',
            maskImage: canScrollRight || canScrollLeft
              ? 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)'
              : undefined,
            WebkitMaskImage: canScrollRight || canScrollLeft
              ? 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)'
              : undefined,
          }}>
          {methods.map((m) => {
            const matrixKey = (m.matrix || 'other').toLowerCase()
            const mc = MATRIX_CLS[matrixKey] || MATRIX_CLS.other
            const vc = VENDOR_CLS[m.instrument_manufacturer] || VENDOR_CLS.other

            return (
              <Link
                key={m.id}
                to={`/method/${m.id}`}
                style={{ textDecoration: 'none', flexShrink: 0, width: '200px', scrollSnapAlign: 'start' }}>
                <div
                  className="border rounded-xl overflow-hidden hover:border-indigo-400/40
                    hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 h-full"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>

                  <div className="p-3">
                    {/* Matrix + views */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
                        {m.matrix}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Eye size={11} />
                        {m.view_count}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-xs font-semibold text-slate-100 leading-snug mb-1.5"
                      style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                      {m.title}
                    </p>

                    {/* Analytes */}
                    <p className="text-xs text-slate-500 truncate mb-2">
                      {m.analyte?.split(',').slice(0, 2).join(', ')}
                      {m.analyte?.split(',').length > 2 ? '…' : ''}
                    </p>

                    {/* Vendor + verified */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${vc}`}>
                        {m.instrument_manufacturer}
                      </span>
                      {m.status === 'verified' && (
                        <span className="text-xs text-green-400 flex items-center gap-0.5">
                          <CheckCircle size={11} /> verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <style>{`
        .flex.overflow-x-auto::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
