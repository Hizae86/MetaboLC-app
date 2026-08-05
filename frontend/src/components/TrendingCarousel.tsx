import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Eye, CheckCircle } from 'lucide-react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MATRIX_CLS: Record<string, { bg: string; text: string; border: string }> = {
  plasma:             { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  serum:              { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urine:              { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
  'whole blood':      { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  'dried blood spot': { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  csf:                { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  saliva:             { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  other:              { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
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

export default function TrendingCarousel() {
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    axios.get(`${API}/methods/trending`)
      .then(res => setMethods(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading || methods.length === 0) return null

  // Duplicate for infinite loop
  const items = [...methods, ...methods]

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-orange-500" />
        <h2 className="text-sm font-semibold text-slate-800">Trending this month</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600
          ring-1 ring-orange-200 font-medium">Most viewed</span>
      </div>

      {/* Ticker container */}
      <div
        className="relative overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}>

        {/* Scrolling track */}
        <div
          ref={trackRef}
          className="flex gap-3"
          style={{
            animation: `ticker ${methods.length * 4}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
            width: 'max-content',
          }}>
          {items.map((m, idx) => {
            const matrixKey = (m.matrix || 'other').toLowerCase()
            const mc = MATRIX_CLS[matrixKey] || MATRIX_CLS.other
            const vc = VENDOR_CLS[m.instrument_manufacturer] || VENDOR_CLS.other

            return (
              <Link
                key={`${m.id}-${idx}`}
                to={`/method/${m.id}`}
                style={{ textDecoration: 'none', flexShrink: 0, width: '200px' }}>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden
                  hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200 h-full">

                  {/* Matrix color bar */}
                  <div style={{ height: '2px', background: mc.border }} />

                  <div className="p-3">
                    {/* Matrix + views */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
                        {m.matrix}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Eye size={11} />
                        {m.view_count}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-xs font-semibold text-slate-800 leading-snug mb-1.5"
                      style={{display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                      {m.title}
                    </p>

                    {/* Analytes */}
                    <p className="text-xs text-slate-400 truncate mb-2">
                      {m.analyte?.split(',').slice(0, 2).join(', ')}
                      {m.analyte?.split(',').length > 2 ? '…' : ''}
                    </p>

                    {/* Vendor + verified */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${vc}`}>
                        {m.instrument_manufacturer}
                      </span>
                      {m.status === 'verified' && (
                        <span className="text-xs text-green-600 flex items-center gap-0.5">
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

      {/* CSS animation */}
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
