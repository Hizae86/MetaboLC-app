import { useState, useEffect } from 'react'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const FLAG: Record<string,string> = {
  'USA':'🇺🇸','Germany':'🇩🇪','Spain':'🇪🇸','France':'🇫🇷','UK':'🇬🇧',
  'Italy':'🇮🇹','Japan':'🇯🇵','Switzerland':'🇨🇭','Netherlands':'🇳🇱',
  'Belgium':'🇧🇪','Sweden':'🇸🇪','Australia':'🇦🇺','Canada':'🇨🇦',
  'China':'🇨🇳','Brazil':'🇧🇷','Portugal':'🇵🇹','Austria':'🇦🇹',
}

export default function ConfirmationsPanel({ methodId }: { methodId: number }) {
  const [confs, setConfs] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    laboratory: '', country: '', instrument: '', comment: '', rating: 5
  })

  useEffect(() => {
    axios.get(`${API}/methods/${methodId}/confirmations`)
      .then(res => setConfs(res.data))
      .catch(console.error)
  }, [methodId])

  const submit = async () => {
    if (!form.laboratory) return
    setSubmitting(true)
    try {
      await axios.post(`${API}/methods/${methodId}/confirmations`, form)
      const res = await axios.get(`${API}/methods/${methodId}/confirmations`)
      setConfs(res.data)
      setSubmitted(true)
      setShowForm(false)
      setForm({laboratory:'',country:'',instrument:'',comment:'',rating:5})
    } catch(err) {
      alert('Error submitting. Please try again.')
    } finally { setSubmitting(false) }
  }

  const IS = {
    width:'100%',padding:'6px 10px',border:'0.5px solid rgba(255,255,255,0.15)',
    borderRadius:'6px',fontSize:'12px',fontFamily:'inherit',
    background:'rgba(255,255,255,0.05)',color:'#f1f5f9'
  } as React.CSSProperties

  const Stars = ({rating, onChange}: {rating:number, onChange?:(n:number)=>void}) => (
    <div style={{display:'flex',gap:'2px'}}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n)}
          style={{fontSize:'14px',cursor:onChange?'pointer':'default',
            color: n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.15)'}}>★</span>
      ))}
    </div>
  )

  return (
    <div style={{background:'rgba(255,255,255,0.03)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:'12px',
      padding:'1.25rem',marginTop:'10px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <div>
          <h3 style={{fontSize:'13px',fontWeight:'500',color:'#f1f5f9',marginBottom:'2px',
            display:'flex',alignItems:'center',gap:'6px'}}>
            🧪 Replicated by labs
            {confs.length > 0 && (
              <span style={{fontSize:'11px',fontWeight:'500',padding:'1px 7px',borderRadius:'20px',
                background:'rgba(74,222,128,0.15)',color:'#4ade80',border:'0.5px solid rgba(74,222,128,0.4)'}}>
                {confs.length} lab{confs.length>1?'s':''}
              </span>
            )}
          </h3>
          <p style={{fontSize:'11px',color:'#94a3b8'}}>
            Labs that have successfully run this method
          </p>
        </div>
        {!showForm && !submitted && (
          <button onClick={() => setShowForm(true)}
            style={{display:'flex',alignItems:'center',gap:'5px',padding:'6px 12px',
              background:'#38bdf8',color:'#03131f',border:'none',borderRadius:'8px',
              fontSize:'12px',fontWeight:'500',cursor:'pointer',flexShrink:0}}>
            ✓ I've run this method
          </button>
        )}
        {submitted && (
          <span style={{fontSize:'12px',color:'#4ade80',background:'rgba(74,222,128,0.15)',
            padding:'5px 10px',borderRadius:'8px'}}>
            ✓ Thanks for confirming!
          </span>
        )}
      </div>

      {/* Confirmation form */}
      {showForm && (
        <div style={{background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.1)',borderRadius:'10px',
          padding:'1rem',marginBottom:'14px'}}>
          <p style={{fontSize:'12px',fontWeight:'500',color:'#f1f5f9',marginBottom:'12px'}}>
            Share your experience with this method
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
            <div>
              <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'3px'}}>
                Laboratory / Institution <span style={{color:'#f87171'}}>*</span>
              </label>
              <input style={IS} value={form.laboratory}
                onChange={e => setForm(p => ({...p, laboratory: e.target.value}))}
                placeholder="e.g. University Hospital Basel" />
            </div>
            <div>
              <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'3px'}}>Country</label>
              <input style={IS} value={form.country}
                onChange={e => setForm(p => ({...p, country: e.target.value}))}
                placeholder="e.g. Switzerland" />
            </div>
          </div>
          <div style={{marginBottom:'8px'}}>
            <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'3px'}}>
              Instrument used
            </label>
            <input style={IS} value={form.instrument}
              onChange={e => setForm(p => ({...p, instrument: e.target.value}))}
              placeholder="e.g. Sciex QTRAP 6500+" />
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'3px'}}>
              Comments (optional)
            </label>
            <textarea rows={2} style={{...IS,resize:'vertical' as const}}
              value={form.comment}
              onChange={e => setForm(p => ({...p, comment: e.target.value}))}
              placeholder="Any notes about your experience running this method..." />
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'11px',color:'#94a3b8'}}>Rating:</span>
              <Stars rating={form.rating} onChange={n => setForm(p => ({...p, rating: n}))} />
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <button onClick={() => setShowForm(false)}
                style={{padding:'6px 12px',border:'0.5px solid rgba(255,255,255,0.15)',borderRadius:'6px',
                  background:'rgba(255,255,255,0.05)',color:'#94a3b8',fontSize:'12px',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={submit} disabled={!form.laboratory || submitting}
                style={{padding:'6px 12px',background:'#38bdf8',color:'#03131f',border:'none',
                  borderRadius:'6px',fontSize:'12px',fontWeight:'500',cursor:'pointer',
                  opacity: !form.laboratory || submitting ? 0.5 : 1}}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmations list */}
      {confs.length === 0 && !showForm ? (
        <div style={{textAlign:'center',padding:'1.5rem',color:'#64748b',fontSize:'12px'}}>
          No confirmations yet — be the first lab to confirm this method works!
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {confs.map((c, i) => (
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'10px',
              padding:'10px 12px',background:'rgba(255,255,255,0.04)',borderRadius:'8px',
              border:'0.5px solid rgba(255,255,255,0.1)'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#38bdf8',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'12px',color:'#03131f',fontWeight:'500',flexShrink:0}}>
                {c.laboratory?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'12px',fontWeight:'500',color:'#f1f5f9'}}>
                    {c.laboratory}
                  </span>
                  {c.country && (
                    <span style={{fontSize:'11px',color:'#94a3b8'}}>
                      {FLAG[c.country] || '🏳️'} {c.country}
                    </span>
                  )}
                  {c.rating && (
                    <div style={{display:'flex',gap:'1px'}}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{fontSize:'11px',
                          color: n <= c.rating ? '#fbbf24' : 'rgba(255,255,255,0.15)'}}>★</span>
                      ))}
                    </div>
                  )}
                </div>
                {c.instrument && (
                  <p style={{fontSize:'11px',color:'#94a3b8',marginBottom:'2px'}}>
                    🔬 {c.instrument}
                  </p>
                )}
                {c.comment && (
                  <p style={{fontSize:'11px',color:'#94a3b8',lineHeight:'1.4'}}>
                    "{c.comment}"
                  </p>
                )}
                <p style={{fontSize:'10px',color:'#64748b',marginTop:'2px'}}>
                  {new Date(c.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
