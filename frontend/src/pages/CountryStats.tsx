import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const MEDALS = ['🥇', '🥈', '🥉']

const FLAG: Record<string, string> = {
  'USA': '🇺🇸', 'Germany': '🇩🇪', 'Japan': '🇯🇵', 'Spain': '🇪🇸',
  'France': '🇫🇷', 'UK': '🇬🇧', 'Italy': '🇮🇹', 'China': '🇨🇳',
  'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Netherlands': '🇳🇱',
  'Switzerland': '🇨🇭', 'Belgium': '🇧🇪', 'Sweden': '🇸🇪',
  'Austria': '🇦🇹', 'Denmark': '🇩🇰', 'Norway': '🇳🇴',
  'Finland': '🇫🇮', 'Portugal': '🇵🇹', 'Brazil': '🇧🇷',
  'India': '🇮🇳', 'South Korea': '🇰🇷', 'Singapore': '🇸🇬',
}

export default function CountryStats() {
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/methods/all`)
      .then(res => setMethods(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const byCountry = methods.reduce((acc, m) => {
    const country = m.country || 'Unknown'
    if (!acc[country]) acc[country] = { methods: 0, transitions: 0, matrices: new Set() }
    acc[country].methods += 1
    acc[country].transitions += m.mrm_transitions.length
    acc[country].matrices.add(m.matrix)
    return acc
  }, {})

  const ranked = Object.entries(byCountry)
    .map(([country, data]: any) => ({
      country,
      methods: data.methods,
      transitions: data.transitions,
      matrices: data.matrices.size,
    }))
    .sort((a, b) => b.methods - a.methods)

  const maxMethods = ranked[0]?.methods || 1

  if (loading) return <div style={{textAlign:'center',padding:'4rem',color:'#6b7280'}}>Loading...</div>

  return (
    <div style={{maxWidth:'700px',margin:'0 auto'}}>
      <Link to="/" style={{color:'#1d4ed8',fontSize:'0.875rem',textDecoration:'none',display:'block',marginBottom:'1rem'}}>
        ← Back to repository
      </Link>

      <h1 style={{fontSize:'1.75rem',fontWeight:'700',color:'#111827',marginBottom:'0.25rem'}}>
        🌍 Country Leaderboard
      </h1>
      <p style={{color:'#6b7280',fontSize:'0.875rem',marginBottom:'2rem'}}>
        Which countries contribute the most methods to the repository?
      </p>

      {/* Podium top 3 */}
      {ranked.length >= 3 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:'1rem',marginBottom:'2rem'}}>
          {[ranked[1], ranked[0], ranked[2]].map((entry, i) => {
            const heights = ['5rem', '7rem', '4rem']
            const realRanks = [1, 0, 2]
            const rank = realRanks[i]
            return (
              <div key={entry.country} style={{textAlign:'center',flex:1}}>
                <div style={{fontSize:'1.5rem',marginBottom:'0.25rem'}}>{FLAG[entry.country] || '🏳️'}</div>
                <div style={{fontWeight:'700',fontSize:'0.85rem',color:'#111827',marginBottom:'0.25rem'}}>
                  {entry.country}
                </div>
                <div style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.5rem'}}>
                  {entry.methods} methods
                </div>
                <div style={{
                  height:heights[i],
                  background: rank===0 ? '#fbbf24' : rank===1 ? '#9ca3af' : '#cd7c2f',
                  borderRadius:'0.5rem 0.5rem 0 0',
                  display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'0.5rem',
                  fontSize:'1.5rem'
                }}>
                  {MEDALS[rank]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full ranking */}
      <div style={{background:'white',borderRadius:'0.75rem',border:'1px solid #e5e7eb',overflow:'hidden'}}>
        {ranked.map((entry, i) => (
          <div key={entry.country} style={{
            display:'flex',alignItems:'center',gap:'1rem',padding:'0.875rem 1.25rem',
            borderBottom: i < ranked.length-1 ? '1px solid #f3f4f6' : 'none',
            background: i < 3 ? '#fafafa' : 'white'
          }}>
            <div style={{width:'2rem',textAlign:'center',fontWeight:'700',
              color: i===0?'#f59e0b':i===1?'#6b7280':i===2?'#cd7c2f':'#d1d5db',
              fontSize: i<3 ? '1.1rem' : '0.875rem'}}>
              {i < 3 ? MEDALS[i] : `#${i+1}`}
            </div>
            <div style={{fontSize:'1.25rem'}}>{FLAG[entry.country] || '🏳️'}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:'600',fontSize:'0.9rem',color:'#111827'}}>{entry.country}</div>
              <div style={{display:'flex',gap:'1rem',marginTop:'0.25rem'}}>
                <div style={{flex:1,background:'#f3f4f6',borderRadius:'9999px',height:'0.4rem',overflow:'hidden'}}>
                  <div style={{width:`${(entry.methods/maxMethods)*100}%`,height:'100%',
                    background:'#1d4ed8',borderRadius:'9999px'}} />
                </div>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:'700',fontSize:'0.9rem',color:'#1d4ed8'}}>{entry.methods}</div>
              <div style={{fontSize:'0.7rem',color:'#9ca3af'}}>methods</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:'700',fontSize:'0.9rem',color:'#6b7280'}}>{entry.transitions}</div>
              <div style={{fontSize:'0.7rem',color:'#9ca3af'}}>transitions</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
