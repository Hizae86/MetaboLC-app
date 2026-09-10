import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ChromatogramBackground from '../components/ChromatogramBackground'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MATRICES = ['plasma','serum','urine','whole blood','dried blood spot','csf','saliva']
const AREAS = ['Steroids','Vitamins','Immunosuppressants','Catecholamines','Antiepileptic Drugs','Toxicology','Antipsychotic Drugs','TDM']
const PLACEHOLDERS = [
  'Search cortisol in saliva…',
  'Try testosterone plasma…',
  'Search m/z 304.2…',
  'Try tacrolimus whole blood…',
  'Search vitamin D serum…',
  'Try dopamine urine…',
]

function useCountUp(target: number, duration = 1500) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(e * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

function HL({ text, query }: { text: string; query: string }) {
  if (!text || query.length < 2) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return <span>{text.slice(0,idx)}<mark style={{background:'rgba(56,189,248,0.2)',color:'#38bdf8',borderRadius:'2px',padding:'0 2px',fontWeight:600}}>{text.slice(idx,idx+query.length)}</mark>{text.slice(idx+query.length)}</span>
}

export default function Home() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [allMethods, setAllMethods] = useState<any[]>([])
  const [stats, setStats] = useState({ methods: 0, transitions: 0, contributors: 9 })
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0])
  const [phIndex, setPhIndex] = useState(0)
  const [showAllAreas, setShowAllAreas] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const methodCount = useCountUp(stats.methods)
  const transCount = useCountUp(stats.transitions)

  useEffect(() => {
    axios.get(`${API}/methods/summary`).then(res => {
      const methods = res.data
      setAllMethods(methods)
      const transitions = methods.reduce((a: number, m: any) => a + (m.mrm_count || 0), 0)
      setStats({ methods: methods.length, transitions, contributors: 9 })
    }).catch(() => {})

    // Rotate placeholders
    const interval = setInterval(() => {
      setPhIndex(i => (i + 1) % PLACEHOLDERS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setPlaceholder(PLACEHOLDERS[phIndex])
  }, [phIndex])

  const filtered = search.length > 1
    ? allMethods.filter(m =>
        [m.analyte, m.title, m.matrix, m.clinical_application]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 7)
    : []

  const handleSearch = (q: string) => {
    if (q.trim()) { setShowResults(false); navigate(`/methods?q=${encodeURIComponent(q.trim())}`) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#060d1a',
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
    }}>

      <ChromatogramBackground />

      {/* Grid SVG */}
      <svg style={{position:'fixed',inset:0,width:'100%',height:'100%',opacity:0.07,pointerEvents:'none'}} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>

      {/* Cyan radial glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '700px', height: '350px',
        background: 'radial-gradient(ellipse, rgba(56,189,248,0.06) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '620px', position: 'relative', zIndex: 1 }}>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '4px 16px', borderRadius: '20px',
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
            color: '#38bdf8', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase'
          }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
            Clinical Mass Spectrometry Database
          </span>
        </motion.div>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '68px', fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1, marginBottom: '12px',
            background: 'linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>MetaboLC</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px', marginBottom: '24px' }}>
            The open reference library of clinical LC-MS/MS methods
          </p>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
            {[
              { value: methodCount, label: 'Methods' },
              { value: transCount.toLocaleString(), label: 'Transitions' },
              { value: stats.contributors, label: 'Contributors' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '3px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ position: 'relative', marginBottom: '20px' }}>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${showResults && filtered.length > 0 ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: showResults && filtered.length > 0 ? '14px 14px 0 0' : '14px',
            padding: '14px 20px',
            boxShadow: showResults && filtered.length > 0 ? '0 0 30px rgba(56,189,248,0.1)' : 'none',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)',
          }}>
            <Search size={17} style={{ color: '#38bdf8', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearch(search)
                if (e.key === 'Escape') { setShowResults(false); setSearch('') }
              }}
              placeholder={placeholder}
              style={{
                flex: 1, border: 'none', outline: 'none',
                fontSize: '15px', color: 'white', background: 'transparent',
              }}
              autoFocus
            />
            {search ? (
              <button onClick={() => { setSearch(''); setShowResults(false); inputRef.current?.focus() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155' }}>
                <X size={14} />
              </button>
            ) : (
              <kbd style={{
                padding: '2px 8px', borderRadius: '6px', fontSize: '10px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#334155', fontFamily: 'monospace'
              }}>⌘K</kbd>
            )}
          </div>

          {/* Dropdown */}
          <AnimatePresence>
            {showResults && filtered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'absolute', left: 0, right: 0,
                  background: '#0d1829',
                  border: '1px solid rgba(56,189,248,0.3)',
                  borderTop: 'none',
                  borderRadius: '0 0 14px 14px',
                  overflow: 'hidden', zIndex: 100,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}>
                <div style={{ padding: '6px 20px', fontSize: '10px', color: '#334155', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </div>
                {filtered.map((m, i) => (
                  <button key={m.id}
                    onMouseDown={() => { setShowResults(false); navigate(`/method/${m.id}`) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      width: '100%', padding: '11px 20px', border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      borderBottom: i < filtered.length-1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: 'rgba(56,189,248,0.4)', border: '1px solid #38bdf8' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <HL text={m.analyte?.split(',')[0] || m.title?.slice(0,55) || ''} query={search} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {m.matrix && <span style={{ fontSize: '11px', color: '#38bdf8', textTransform: 'capitalize' }}>{m.matrix}</span>}
                        {m.instrument_manufacturer && <><span style={{ color: '#1e293b' }}>·</span><span style={{ fontSize: '11px', color: '#334155' }}>{m.instrument_manufacturer}</span></>}
                        {m.mrm_count > 0 && <><span style={{ color: '#1e293b' }}>·</span><span style={{ fontSize: '11px', color: '#334155', fontFamily: 'monospace' }}>{m.mrm_count} MRM</span></>}
                      </div>
                    </div>
                    <span style={{ color: '#1e293b', flexShrink: 0 }}>→</span>
                  </button>
                ))}
                <button onMouseDown={() => handleSearch(search)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '10px', border: 'none',
                    background: 'rgba(56,189,248,0.05)', cursor: 'pointer',
                    fontSize: '12px', color: '#38bdf8', fontWeight: 600,
                    borderTop: '1px solid rgba(255,255,255,0.04)'
                  }}>
                  View all results for "{search}" →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Matrices + Areas */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.35 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '10px' }}>
            {MATRICES.map(mx => {
              const count = allMethods.filter(m => m.matrix?.toLowerCase() === mx).length
              if (!count) return null
              return (
                <button key={mx} onClick={() => navigate(`/methods?matrix=${encodeURIComponent(mx)}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '5px 13px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#64748b', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'; e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.transform = 'translateY(0)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{mx}</span>
                  <span style={{ color: '#1e293b', fontSize: '10px' }}>{count}</span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {(() => {
              const visibleAreas = AREAS
                .map(area => ({ area, count: allMethods.filter(m => m.clinical_application === area).length }))
                .filter(a => a.count > 0)
              const shown = showAllAreas ? visibleAreas : visibleAreas.slice(0, 6)
              const hidden = visibleAreas.length - shown.length
              return (
                <>
                  {shown.map(({ area }) => (
                    <button key={area} onClick={() => navigate(`/methods?q=${encodeURIComponent(area)}`)}
                      style={{
                        padding: '4px 11px', borderRadius: '12px',
                        background: 'transparent', border: '1px solid rgba(56,189,248,0.12)',
                        color: '#64748b', fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.12)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.transform = 'translateY(0)' }}>
                      {area}
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button onClick={() => setShowAllAreas(true)}
                      style={{
                        padding: '4px 11px', borderRadius: '12px',
                        background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)',
                        color: '#38bdf8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                      }}>
                      +{hidden} more
                    </button>
                  )}
                </>
              )
            })()}
          </div>
        </motion.div>

        {/* Disclaimer */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
          style={{ textAlign: 'center', color: '#1e293b', fontSize: '11px', marginTop: '28px' }}>
          Reference library — methods require independent validation before clinical use.
        </motion.p>
      </div>
    </div>
  )
}
