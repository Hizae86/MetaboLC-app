import { useState } from 'react'

const ND = () => <span style={{color:'#d1d5db',fontSize:'14px',display:'block',textAlign:'right'}}>—</span>

const fmtNum = (v: any, dec: number = 2) => {
  if (v === null || v === undefined) return <ND />
  return <span style={{fontFamily:'monospace'}}>{Number(v).toFixed(dec)}</span>
}

const r2Style = (v: any): React.CSSProperties => {
  if (v === null || v === undefined) return {}
  if (v >= 0.999) return {color:'#27500A', fontWeight:'500'}
  if (v >= 0.995) return {color:'#633806'}
  return {color:'#A32D2D'}
}

const cvStyle = (v: any): React.CSSProperties => {
  if (v === null || v === undefined) return {}
  if (v < 10) return {color:'#27500A', fontWeight:'500'}
  if (v <= 15) return {color:'#633806'}
  return {color:'#A32D2D', fontWeight:'500'}
}

export default function ValidationView({ validation, units, onEdit }: {
  validation: any[], units?: string, onEdit: () => void
}) {
  const [openMenu, setOpenMenu] = useState<number|null>(null)

  const thStyle: React.CSSProperties = {
    padding:'9px 12px', fontSize:'11px', fontWeight:'500',
    color:'#e2e8f0', textAlign:'left', whiteSpace:'nowrap',
  }
  const thNum: React.CSSProperties = {...thStyle, textAlign:'right'}
  const tdStyle: React.CSSProperties = {
    padding:'8px 12px', verticalAlign:'middle', color:'#111827'
  }
  const tdNum: React.CSSProperties = {
    ...tdStyle, textAlign:'right', fontFamily:'monospace', fontSize:'12px'
  }

  if (!validation || validation.length === 0) return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <span style={{fontSize:'15px',fontWeight:'500',color:'#111827'}}>Validation parameters</span>
        <button onClick={onEdit}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',fontSize:'12px',
            fontWeight:'500',border:'0.5px solid #d1d5db',borderRadius:'6px',
            background:'white',color:'#6b7280',cursor:'pointer'}}>
          ✏️ Edit
        </button>
      </div>
      <p style={{color:'#9ca3af',fontSize:'0.875rem'}}>No validation data. Click Edit to add.</p>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
        <span style={{fontSize:'15px',fontWeight:'500',color:'#111827'}}>Validation parameters</span>
        <button onClick={onEdit}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',fontSize:'12px',
            fontWeight:'500',border:'0.5px solid #d1d5db',borderRadius:'6px',
            background:'white',color:'#6b7280',cursor:'pointer'}}>
          ✏️ Edit
        </button>
      </div>

      {units && (
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px',
          fontSize:'12px',color:'#6b7280'}}>
          <span>LOD and LOQ units:</span>
          <span style={{background:'#E6F1FB',color:'#0C447C',border:'0.5px solid #85B7EB',
            borderRadius:'6px',padding:'2px 8px',fontSize:'11px',fontWeight:'500'}}>
            {units}
          </span>
        </div>
      )}

      <div style={{overflowX:'auto',border:'0.5px solid #e5e7eb',borderRadius:'12px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:'#1e3a5f'}}>
              <th style={{...thStyle,width:'180px'}}>Compound</th>
              <th style={thNum}>LOD</th>
              <th style={thNum}>LOQ</th>
              <th style={thNum}>R²</th>
              <th style={thNum}>CV (%)</th>
              <th style={thNum}>Accuracy (%)</th>
              <th style={{...thStyle,maxWidth:'120px'}}>Notes</th>
              <th style={{...thStyle,textAlign:'center',width:'36px'}}>⋮</th>
            </tr>
          </thead>
          <tbody>
            {validation.map((row: any, i: number) => (
              <tr key={i} style={{borderBottom:'0.5px solid #e5e7eb',
                background:i%2===0?'white':'#fafafa'}}>
                <td style={tdStyle}>
                  <span style={{fontSize:'13px',fontWeight:'500'}}>{row.compound_name}</span>
                </td>
                <td style={tdNum}>{fmtNum(row.lod, 2)}</td>
                <td style={tdNum}>{fmtNum(row.loq, 2)}</td>
                <td style={{...tdNum, ...r2Style(row.r2)}}>
                  {row.r2 !== null && row.r2 !== undefined
                    ? <span style={{fontFamily:'monospace'}}>{Number(row.r2).toFixed(4)}</span>
                    : <ND />}
                </td>
                <td style={{...tdNum, ...cvStyle(row.cv_percent)}}>
                  {fmtNum(row.cv_percent, 1)}
                </td>
                <td style={tdNum}>{fmtNum(row.accuracy_percent, 1)}</td>
                <td style={{...tdStyle,fontSize:'11px',color:'#9ca3af',
                  maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {row.notes || ''}
                </td>
                <td style={{...tdStyle,textAlign:'center',position:'relative'}}>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenMenu(openMenu===i?null:i) }}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:'#9ca3af',fontSize:'16px',padding:'2px 6px',
                      borderRadius:'4px',lineHeight:1}}>
                    ⋮
                  </button>
                  {openMenu === i && (
                    <div onClick={e=>e.stopPropagation()}
                      style={{position:'absolute',right:'8px',top:'100%',
                        background:'white',border:'0.5px solid #e5e7eb',
                        borderRadius:'8px',padding:'4px 0',minWidth:'140px',
                        zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
                      <div onClick={()=>{setOpenMenu(null);onEdit()}}
                        style={{display:'flex',alignItems:'center',gap:'8px',
                          padding:'7px 12px',cursor:'pointer',color:'#111827',fontSize:'12px'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#f5f5f5')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        ✏️ Edit row
                      </div>
                      <div onClick={()=>setOpenMenu(null)}
                        style={{display:'flex',alignItems:'center',gap:'8px',
                          padding:'7px 12px',cursor:'pointer',color:'#A32D2D',fontSize:'12px'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#fef2f2')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        🗑 Delete
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:'flex',gap:'12px',marginTop:'10px',fontSize:'11px',color:'#6b7280',flexWrap:'wrap'}}>
        {[
          {color:'#97C459', label:'R² ≥ 0.999 / CV < 10%'},
          {color:'#EF9F27', label:'R² 0.995–0.999 / CV 10–15%'},
          {color:'#E24B4A', label:'R² < 0.995 / CV > 15%'},
        ].map(l => (
          <span key={l.label} style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <span style={{width:'8px',height:'8px',borderRadius:'50%',background:l.color,display:'inline-block'}} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}
