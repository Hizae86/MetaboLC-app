import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Sparkles, LayoutGrid, FlaskConical, Pill, Sun, Beaker, Zap, Heart, Flame } from 'lucide-react'
import { motion } from 'framer-motion'
import axios from 'axios'
import TrendingCarousel from '../components/TrendingCarousel'

const API = 'http://127.0.0.1:8000/api'

const QUICK_CHIPS = [
  { label: 'Steroids in serum', query: 'steroid serum', Icon: FlaskConical },
  { label: 'Immunosuppressants', query: 'immunosuppressant', Icon: Pill },
  { label: 'Vitamin D', query: 'vitamin d', Icon: Sun },
  { label: 'Benzodiazepines', query: 'benzodiazepine', Icon: Beaker },
  { label: 'HILIC', query: 'HILIC', Icon: Zap },
  { label: 'Newborn screening', query: 'newborn screening', Icon: Heart },
]

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) return
    let start = 0
    const duration = 1800
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value])

  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (value === 0) return
    const timer = setTimeout(() => setSettled(true), 2200)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <motion.div
      animate={{
        fontSize: settled ? '28px' : '40px',
        opacity: 1,
      }}
      initial={{ fontSize: '40px', opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      style={{
        fontWeight:'800', lineHeight:'1',
        fontFamily:'monospace', letterSpacing:'-0.04em',
        background: settled ? 'none' : 'linear-gradient(135deg, #60a5fa, #818cf8)',
        WebkitBackgroundClip: settled ? 'unset' : 'text',
        WebkitTextFillColor: settled ? 'white' : 'transparent',
        color: settled ? '#60a5fa' : 'transparent',
        filter: settled ? 'none' : 'drop-shadow(0 0 20px rgba(99,102,241,0.4))'
      }}>
      {display}
    </motion.div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'search' | 'ai'>('search')
  const [aiInput, setAiInput] = useState('')
  const [stats, setStats] = useState({ methods: 0, compounds: 0, transitions: 0, countries: 0, contributors: 0 })

  useEffect(() => {
    axios.get(`${API}/methods/all`).then(res => {
      const methods = res.data
      const compounds = new Set(methods.flatMap((m: any) => (m.analyte || '').split(',').map((a: string) => a.trim().toLowerCase()))).size
      const transitions = methods.reduce((a: number, m: any) => a + (m.mrm_transitions?.length || 0), 0)
      const countries = new Set(methods.map((m: any) => m.country).filter(Boolean)).size
      setStats({ methods: methods.length, compounds, transitions, countries, contributors: 9 })
    }).catch(() => {})
  }, [])

  const handleSearch = (q: string) => {
    if (q.trim()) navigate(`/methods?q=${encodeURIComponent(q.trim())}`)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(search)
  }

  return (
    <div style={{minHeight:'100vh', background:'#f8fafc'}}>
      {/* Hero */}
      <div style={{
        background:'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        padding:'5rem 1.5rem 4rem',
        position:'relative',
        overflow:'hidden'
      }}>
        {/* Grid background */}
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.08}} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>

        <div style={{maxWidth:'640px', margin:'0 auto', position:'relative', textAlign:'center'}}>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{marginBottom:'1.5rem'}}>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:'6px',
              fontSize:'11px', fontWeight:'600', letterSpacing:'0.08em',
              color:'#93c5fd', background:'rgba(59,130,246,0.1)',
              border:'1px solid rgba(59,130,246,0.2)',
              padding:'4px 14px', borderRadius:'20px', textTransform:'uppercase'
            }}>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#60a5fa',display:'inline-block',animation:'pulse 2s infinite'}}/>
              Clinical Mass Spectrometry Database
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{fontSize:'48px', fontWeight:'800', color:'white', marginBottom:'12px',
              letterSpacing:'-0.04em', lineHeight:'1.1', fontFamily:'system-ui'}}>
            MetaboLC
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{fontSize:'16px', color:'#94a3b8', marginBottom:'2.5rem', lineHeight:'1.6'}}>
            The open repository of validated clinical LC-MS/MS methods
          </motion.p>

          {/* KPI row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{display:'flex', justifyContent:'center', gap:'2rem', marginBottom:'2.5rem', flexWrap:'wrap'}}>
            {[
              { val: stats.methods, label: 'Methods', primary: true },
              { val: stats.compounds, label: 'Compounds' },
              { val: stats.transitions.toLocaleString(), label: 'Transitions', primary: true },
              { val: stats.countries, label: 'Countries' },
              { val: stats.contributors, label: 'Contributors' },
            ].map((k, i) => (
              <div key={k.label} style={{textAlign:'center'}}>
                {k.label === 'Methods' ? (
                  <AnimatedNumber value={typeof k.val === 'number' ? k.val : 0} />
                ) : (
                  <div style={{
                    fontSize: '22px',
                    fontWeight:'700', color:'white',
                    fontFamily:'monospace', lineHeight:'1'
                  }}>{k.val}</div>
                )}
                <div style={{
                  fontSize:'11px', marginTop:'4px', textTransform:'uppercase', letterSpacing:'0.08em',
                  color: k.label === 'Methods' ? '#93c5fd' : '#64748b',
                  fontWeight: k.label === 'Methods' ? '600' : '400'
                }}>{k.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Mode toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            style={{display:'flex', gap:'8px', marginBottom:'16px'}}>
            <button onClick={() => setMode('search')}
              style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                padding:'12px', borderRadius:'12px', fontSize:'14px', fontWeight:'500',
                cursor:'pointer', transition:'all 0.2s', border:'none',
                background: mode === 'search' ? 'white' : 'rgba(255,255,255,0.08)',
                color: mode === 'search' ? '#0f172a' : '#94a3b8',
                boxShadow: mode === 'search' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
              }}>
              <LayoutGrid size={16} /> Browse repository
            </button>
            <button onClick={() => setMode('ai')}
              style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
                padding:'12px', borderRadius:'12px', fontSize:'14px', fontWeight:'500',
                cursor:'pointer', transition:'all 0.2s', border:'none',
                background: mode === 'ai' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'rgba(99,102,241,0.15)',
                color: mode === 'ai' ? 'white' : '#a5b4fc',
                boxShadow: mode === 'ai' ? '0 4px 20px rgba(99,102,241,0.4)' : 'none'
              }}>
              <Sparkles size={16} /> Ask Dra. Massa
            </button>
          </motion.div>

          {/* Search bar */}
          {mode === 'search' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}>
              <div style={{
                display:'flex', alignItems:'center', gap:'12px',
                background:'white', borderRadius:'16px', padding:'14px 20px',
                boxShadow:'0 4px 24px rgba(0,0,0,0.2)', marginBottom:'16px'
              }}>
                <Search size={18} style={{color:'#6366f1', flexShrink:0}} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={mode === 'ai' ? "Ask Dra. Massa about a method, analyte or clinical application…" : "Search analytes, matrix or m/z (e.g. 304.2)…"}
                  style={{
                    flex:1, border:'none', outline:'none', fontSize:'15px',
                    color:'#0f172a', background:'transparent'
                  }}
                  autoFocus
                />
                <button onClick={() => handleSearch(search)}
                  style={{
                    background:'#6366f1', color:'white', border:'none',
                    borderRadius:'10px', padding:'8px 18px', fontSize:'13px',
                    fontWeight:'600', cursor:'pointer'
                  }}>
                  Search
                </button>
              </div>

              {/* Quick chips */}
              <div style={{display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center'}}>
                {QUICK_CHIPS.map(({ label, query, Icon }) => (
                  <button key={label} onClick={() => handleSearch(query)}
                    style={{
                      display:'inline-flex', alignItems:'center', gap:'6px',
                      fontSize:'12px', padding:'6px 14px', borderRadius:'20px',
                      border:'1px solid rgba(255,255,255,0.15)',
                      background:'rgba(255,255,255,0.08)', color:'#cbd5e1',
                      cursor:'pointer', transition:'all 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}>
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI mode */}
          {mode === 'ai' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}>
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:'12px',
                background:'rgba(99,102,241,0.1)', borderRadius:'16px', padding:'24px 20px',
                border:'1px solid rgba(99,102,241,0.2)', marginBottom:'16px', textAlign:'center'
              }}>
                <Sparkles size={28} style={{color:'#a5b4fc'}} />
                <p style={{color:'white', fontSize:'15px', fontWeight:'600', margin:0}}>
                  Dra. Massa — Coming Soon
                </p>
                <p style={{color:'#94a3b8', fontSize:'13px', margin:0, lineHeight:'1.6'}}>
                  AI-powered method recommendations are available in the full version.<br/>
                  Contact us at <span style={{color:'#a5b4fc'}}>hello@metabolc.io</span> to get access.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Trending section */}
      <div style={{maxWidth:'1280px', margin:'0 auto', padding:'2.5rem 1.5rem'}}>
        <TrendingCarousel />

        {/* CTA */}
        <div style={{
          marginTop:'3rem', textAlign:'center', padding:'3rem',
          background:'white', borderRadius:'20px', border:'1px solid #e5e7eb',
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <h2 style={{fontSize:'22px', fontWeight:'700', color:'#0f172a', marginBottom:'8px', letterSpacing:'-0.02em'}}>
            Ready to find your method?
          </h2>
          <p style={{fontSize:'14px', color:'#64748b', marginBottom:'24px'}}>
            Browse {stats.methods} validated LC-MS/MS methods from labs worldwide
          </p>
          <div style={{display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap'}}>
            <Link to="/methods"
              style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                background:'#0f172a', color:'white', textDecoration:'none',
                padding:'12px 24px', borderRadius:'12px', fontSize:'14px', fontWeight:'600'
              }}>
              <LayoutGrid size={16} /> Browse all methods
            </Link>
            <Link to="/submit"
              style={{
                display:'inline-flex', alignItems:'center', gap:'8px',
                background:'white', color:'#0f172a', textDecoration:'none',
                padding:'12px 24px', borderRadius:'12px', fontSize:'14px', fontWeight:'600',
                border:'1px solid #e5e7eb'
              }}>
              + Submit a method
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
