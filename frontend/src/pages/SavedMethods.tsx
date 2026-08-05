import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import StarButton from '../components/StarButton'

const API = 'http://127.0.0.1:8000/api'

const MATRIX_STYLE: Record<string,{bg:string,color:string}> = {
  plasma:{bg:'#fee2e2',color:'#b91c1c'},serum:{bg:'#ffedd5',color:'#c2410c'},
  urine:{bg:'#fef9c3',color:'#a16207'},'whole blood':{bg:'#fecaca',color:'#991b1b'},
  'dried blood spot':{bg:'#fce7f3',color:'#9d174d'},CSF:{bg:'#dbeafe',color:'#1e40af'},
  saliva:{bg:'#dcfce7',color:'#15803d'},tissue:{bg:'#f3e8ff',color:'#6b21a8'},
  other:{bg:'#f3f4f6',color:'#374151'}
}

export default function SavedMethods() {
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [starredIds, setStarredIds] = useState<number[]>([])

  useEffect(() => {
    const ids: number[] = JSON.parse(localStorage.getItem('metabolc_stars') || '[]')
    setStarredIds(ids)
    if (ids.length === 0) { setLoading(false); return }
    axios.get(`${API}/methods/all`)
      .then(res => setMethods(res.data.filter((m: any) => ids.includes(m.id))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const remove = (id: number) => {
    const newIds = starredIds.filter(i => i !== id)
    localStorage.setItem('metabolc_stars', JSON.stringify(newIds))
    setStarredIds(newIds)
    setMethods(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div style={{maxWidth:'900px',margin:'0 auto'}}>
      <Link to="/" style={{color:'#1d4ed8',fontSize:'12px',textDecoration:'none',
        display:'inline-flex',alignItems:'center',gap:'4px',marginBottom:'16px'}}>
        ← Back to repository
      </Link>

      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'4px'}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF9F27" stroke="#EF9F27" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <h1 style={{fontSize:'18px',fontWeight:'500',color:'#111827'}}>Saved methods</h1>
      </div>
      <p style={{fontSize:'12px',color:'#6b7280',marginBottom:'20px'}}>
        {methods.length} method{methods.length!==1?'s':''} saved in this browser
      </p>

      {loading ? (
        <p style={{color:'#9ca3af',textAlign:'center',padding:'3rem'}}>Loading...</p>
      ) : methods.length === 0 ? (
        <div style={{textAlign:'center',padding:'4rem 1rem',border:'0.5px solid #e5e7eb',
          borderRadius:'12px',background:'white'}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"
            style={{margin:'0 auto 12px',display:'block'}}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <p style={{fontSize:'13px',color:'#9ca3af',marginBottom:'12px'}}>No saved methods yet</p>
          <Link to="/" style={{color:'#1d4ed8',fontSize:'12px'}}>Browse methods →</Link>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {methods.map(m => {
            const ms = MATRIX_STYLE[m.matrix] || MATRIX_STYLE.other
            return (
              <div key={m.id} style={{background:'white',border:'0.5px solid #e5e7eb',
                borderRadius:'12px',padding:'1rem 1.25rem',
                display:'flex',alignItems:'center',gap:'12px'}}>
                <Link to={`/method/${m.id}`} style={{textDecoration:'none',flex:1}}>
                  <div style={{display:'flex',gap:'5px',marginBottom:'5px',flexWrap:'wrap'}}>
                    <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 7px',
                      borderRadius:'20px',background:ms.bg,color:ms.color}}>{m.matrix}</span>
                    <span style={{fontSize:'10px',padding:'2px 7px',borderRadius:'20px',
                      background:'#f3f4f6',color:'#374151',fontFamily:'monospace'}}>
                      {m.ionization_mode?.split('/')[0]}
                    </span>
                    {m.status==='verified' && (
                      <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 7px',
                        borderRadius:'20px',background:'#EAF3DE',color:'#27500A'}}>✓ Verified</span>
                    )}
                  </div>
                  <p style={{fontSize:'13px',fontWeight:'500',color:'#111827',marginBottom:'2px'}}>
                    {m.analyte?.length > 60 ? m.analyte.slice(0,60)+'…' : m.analyte}
                  </p>
                  <p style={{fontSize:'11px',color:'#6b7280'}}>
                    {m.instrument_manufacturer} {m.instrument_model}
                    {m.laboratory && ` · ${m.laboratory}`}
                  </p>
                </Link>
                <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>
                    {m.mrm_transitions?.length} MRM
                  </span>
                  <button onClick={() => remove(m.id)}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:'#9ca3af',fontSize:'16px',lineHeight:1,padding:'2px'}}
                    title="Remove from saved">
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
