import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

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
    width:'100%',padding:'6px 10px',border:'0.5px solid #d1d5db',
    borderRadius:'6px',fontSize:'12px',fontFamily:'inherit',
    background:'white',color:'#111827'
  } as React.CSSProperties

  const Stars = ({rating, onChange}: {rating:number, onChange?:(n:number)=>void}) => (
    <div style={{display:'flex',gap:'2px'}}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n)}
          style={{fontSize:'14px',cursor:onChange?'pointer':'default',
            color: n <= rating ? '#EF9F27' : '#d1d5db'}}>★</span>
      ))}
    </div>
  )

  return (
    <div style={{background:'white',border:'0.5px solid #e5e7eb',borderRadius:'12px',
      padding:'1.25rem',marginTop:'10px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
        <div>
          <h3 style={{fontSize:'13px',fontWeight:'500',color:'#111827',marginBottom:'2px',
            display:'flex',alignItems:'center',gap:'6px'}}>
            🧪 Replicated by labs
            {confs.length > 0 && (
              <span style={{fontSize:'11px',fontWeight:'500',padding:'1px 7px',borderRadius:'20px',
                background:'#EAF3DE',color:'#27500A',border:'0.5px solid #97C459'}}>
                {confs.length} lab{confs.length>1?'s':''}
              </span>
            )}
          </h3>
          <p style={{fontSize:'11px',color:'#6b7280'}}>
            Labs that have successfully run this method
          </p>
        </div>
        {!showForm && !submitted && (
          <button onClick={() => setShowForm(true)}
            style={{display:'flex',alignItems:'center',gap:'5px',padding:'6px 12px',
              background:'#1e3a5f',color:'white',border:'none',borderRadius:'8px',
              fontSize:'12px',fontWeight:'500',cursor:'pointer',flexShrink:0}}>
            ✓ I've run this method
          </button>
        )}
        {submitted && (
          <span style={{fontSize:'12px',color:'#27500A',background:'#EAF3DE',
            padding:'5px 10px',borderRadius:'8px'}}>
            ✓ Thanks for confirming!
          </span>
        )}
      </div>

      {/* Confirmation form */}
      {showForm && (
        <div style={{background:'#f9fafb',border:'0.5px solid #e5e7eb',borderRadius:'10px',
          padding:'1rem',marginBottom:'14px'}}>
          <p style={{fontSize:'12px',fontWeight:'500',color:'#111827',marginBottom:'12px'}}>
            Share your experience with this method
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
            <div>
              <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>
                Laboratory / Institution <span style={{color:'#E24B4A'}}>*</span>
              </label>
              <input style={IS} value={form.laboratory}
                onChange={e => setForm(p => ({...p, laboratory: e.target.value}))}
                placeholder="e.g. University Hospital Basel" />
            </div>
            <div>
              <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>Country</label>
              <input style={IS} value={form.country}
                onChange={e => setForm(p => ({...p, country: e.target.value}))}
                placeholder="e.g. Switzerland" />
            </div>
          </div>
          <div style={{marginBottom:'8px'}}>
            <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>
              Instrument used
            </label>
            <input style={IS} value={form.instrument}
              onChange={e => setForm(p => ({...p, instrument: e.target.value}))}
              placeholder="e.g. Sciex QTRAP 6500+" />
          </div>
          <div style={{marginBottom:'10px'}}>
            <label style={{fontSize:'11px',color:'#6b7280',display:'block',marginBottom:'3px'}}>
              Comments (optional)
            </label>
            <textarea rows={2} style={{...IS,resize:'vertical' as const}}
              value={form.comment}
              onChange={e => setForm(p => ({...p, comment: e.target.value}))}
              placeholder="Any notes about your experience running this method..." />
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'11px',color:'#6b7280'}}>Rating:</span>
              <Stars rating={form.rating} onChange={n => setForm(p => ({...p, rating: n}))} />
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <button onClick={() => setShowForm(false)}
                style={{padding:'6px 12px',border:'0.5px solid #d1d5db',borderRadius:'6px',
                  background:'white',color:'#6b7280',fontSize:'12px',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={submit} disabled={!form.laboratory || submitting}
                style={{padding:'6px 12px',background:'#1e3a5f',color:'white',border:'none',
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
        <div style={{textAlign:'center',padding:'1.5rem',color:'#9ca3af',fontSize:'12px'}}>
          No confirmations yet — be the first lab to confirm this method works!
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {confs.map((c, i) => (
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'10px',
              padding:'10px 12px',background:'#f9fafb',borderRadius:'8px',
              border:'0.5px solid #e5e7eb'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#1e3a5f',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'12px',color:'white',fontWeight:'500',flexShrink:0}}>
                {c.laboratory?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'12px',fontWeight:'500',color:'#111827'}}>
                    {c.laboratory}
                  </span>
                  {c.country && (
                    <span style={{fontSize:'11px',color:'#6b7280'}}>
                      {FLAG[c.country] || '🏳️'} {c.country}
                    </span>
                  )}
                  {c.rating && (
                    <div style={{display:'flex',gap:'1px'}}>
                      {[1,2,3,4,5].map(n => (
                        <span key={n} style={{fontSize:'11px',
                          color: n <= c.rating ? '#EF9F27' : '#e5e7eb'}}>★</span>
                      ))}
                    </div>
                  )}
                </div>
                {c.instrument && (
                  <p style={{fontSize:'11px',color:'#6b7280',marginBottom:'2px'}}>
                    🔬 {c.instrument}
                  </p>
                )}
                {c.comment && (
                  <p style={{fontSize:'11px',color:'#374151',lineHeight:'1.4'}}>
                    "{c.comment}"
                  </p>
                )}
                <p style={{fontSize:'10px',color:'#9ca3af',marginTop:'2px'}}>
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
