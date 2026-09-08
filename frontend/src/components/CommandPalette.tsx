import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FlaskConical, LayoutGrid, Calculator, ArrowRightLeft, Beaker } from 'lucide-react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MATRICES = ['plasma','serum','urine','whole blood','dried blood spot','csf','saliva']

const QUICK_ACTIONS = [
  { label: 'Browse all methods', icon: LayoutGrid, path: '/methods' },
  { label: 'Compound Index', icon: FlaskConical, path: '/compounds' },
  { label: 'Mass Calculator', icon: Calculator, path: '/tools/mass-calculator' },
  { label: 'Method Transfer', icon: ArrowRightLeft, path: '/tools/method-transfer' },
  { label: 'Dilution Calculator', icon: Beaker, path: '/tools/dilution-calculator' },
]

function highlight(text: string, query: string) {
  if (!query || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', borderRadius: '2px', padding: '0 2px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [methods, setMethods] = useState<any[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    axios.get(`${API}/methods/summary`).then(r => setMethods(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setSelected(0)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = query.length > 1
    ? methods.filter(m => [m.analyte, m.title, m.matrix, m.clinical_application]
        .some(f => f?.toLowerCase().includes(query.toLowerCase()))).slice(0, 6)
    : methods.slice(0, 5)

  const matrixCounts = MATRICES.map(mx => ({
    name: mx,
    count: methods.filter(m => m.matrix?.toLowerCase() === mx).length
  })).filter(m => m.count > 0)

  const handleSelect = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (filtered[selected]) handleSelect(`/method/${filtered[selected].id}`)
      else if (query) handleSelect(`/methods?q=${encodeURIComponent(query)}`)
    }
    if (e.key === 'ArrowDown') setSelected(s => Math.min(s + 1, filtered.length - 1))
    if (e.key === 'ArrowUp') setSelected(s => Math.max(s - 1, 0))
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      title="Open command palette (⌘K)"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#64748b', fontSize: '12px', cursor: 'pointer'
      }}>
      <Search size={12} />
      <span>Search</span>
      <kbd style={{ fontSize: '10px', opacity: 0.6 }}>⌘K</kbd>
    </button>
  )

  return (
    <div onClick={() => setOpen(false)} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '740px', maxWidth: '95vw',
        background: '#0d1424',
        borderRadius: '16px',
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 0 0 1px rgba(99,102,241,0.1), 0 25px 60px rgba(0,0,0,0.7), 0 0 80px rgba(99,102,241,0.08)',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(99,102,241,0.12)',
          background: 'rgba(99,102,241,0.03)'
        }}>
          <Search size={16} color="#6366f1" style={{ flexShrink: 0 }} />
          <input ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKey}
            placeholder="Search analytes, matrix or m/z…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'white',
              fontSize: '15px', fontFamily: 'inherit'
            }}
          />
          <kbd style={{
            padding: '3px 8px', borderRadius: '6px', fontSize: '11px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#475569', fontFamily: 'monospace', flexShrink: 0
          }}>Esc</kbd>
        </div>

        {/* 3-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 1fr' }}>

          {/* Col 1 — Methods */}
          <div style={{ padding: '16px', borderRight: '1px solid rgba(99,102,241,0.08)' }}>
            <div style={{ fontSize: '10px', color: '#334155', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Methods {query.length > 1 && <span style={{ color: '#6366f1' }}>({filtered.length})</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {filtered.map((m, i) => (
                <button key={m.id}
                  onClick={() => handleSelect(`/method/${m.id}`)}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 10px', borderRadius: '8px', border: 'none',
                    background: selected === i ? 'rgba(99,102,241,0.15)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s'
                  }}>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {highlight(m.analyte?.split(',')[0] || m.title?.slice(0,40) || '', query)}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {m.matrix && (
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: selected === i ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                        {m.matrix}
                      </span>
                    )}
                    {m.instrument_manufacturer && (
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#475569' }}>
                        {m.instrument_manufacturer}
                      </span>
                    )}
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)', color: '#334155' }}>
                      {m.mrm_count} MRM
                    </span>
                  </div>
                </button>
              ))}
              {query.length > 1 && filtered.length > 0 && (
                <button onClick={() => handleSelect(`/methods?q=${encodeURIComponent(query)}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px',
                    padding: '7px 10px', borderRadius: '8px',
                    border: '1px dashed rgba(99,102,241,0.2)',
                    background: 'transparent', color: '#6366f1',
                    fontSize: '11px', cursor: 'pointer', width: '100%'
                  }}>
                  View all results →
                </button>
              )}
              {filtered.length === 0 && query.length > 1 && (
                <div style={{ fontSize: '12px', color: '#334155', padding: '8px 10px' }}>No results for "{query}"</div>
              )}
            </div>
          </div>

          {/* Col 2 — Matrices */}
          <div style={{ padding: '16px', borderRight: '1px solid rgba(99,102,241,0.08)' }}>
            <div style={{ fontSize: '10px', color: '#334155', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Filter by Matrix
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {matrixCounts.map(m => (
                <button key={m.name}
                  onClick={() => handleSelect(`/methods?matrix=${encodeURIComponent(m.name)}`)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 8px', borderRadius: '8px', border: 'none',
                    background: 'transparent', cursor: 'pointer', width: '100%'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>{m.name}</span>
                  <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '4px' }}>{m.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Col 3 — Quick actions */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', color: '#334155', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label}
                  onClick={() => handleSelect(a.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '8px', border: 'none',
                    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <a.icon size={13} color="#475569" />
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{a.label}</span>
                </button>
              ))}
            </div>

            {/* Keyboard hints */}
            <div style={{
              marginTop: '16px', paddingTop: '12px',
              borderTop: '1px solid rgba(99,102,241,0.08)',
              display: 'flex', gap: '10px', flexWrap: 'wrap'
            }}>
              {['[↑↓] Navigate', '[↵] Select', '[Esc] Close'].map(h => (
                <span key={h} style={{ fontSize: '10px', color: '#1e293b', fontFamily: 'monospace' }}>{h}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
