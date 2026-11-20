import { useState } from 'react'

const ND = () => <span style={{color:'var(--muted-foreground)',fontSize:'14px',display:'block',textAlign:'right'}}>—</span>

const fmtNum = (v: any, dec: number = 2) => {
  if (v === null || v === undefined) return <ND />
  return <span style={{fontFamily:'monospace'}}>{Number(v).toFixed(dec)}</span>
}

const r2Style = (v: any): React.CSSProperties => {
  if (v === null || v === undefined) return {}
  if (v >= 0.999) return {color:'var(--success)', fontWeight:'500'}
  if (v >= 0.995) return {color:'var(--warning)'}
  return {color:'var(--destructive)'}
}

const cvStyle = (v: any): React.CSSProperties => {
  if (v === null || v === undefined) return {}
  if (v < 10) return {color:'var(--success)', fontWeight:'500'}
  if (v <= 15) return {color:'var(--warning)'}
  return {color:'var(--destructive)', fontWeight:'500'}
}

export default function ValidationView({ validation, units, onEdit }: {
  validation: any[], units?: string, onEdit?: () => void
}) {
  const [openMenu, setOpenMenu] = useState<number|null>(null)

  const thStyle: React.CSSProperties = {
    padding:'9px 12px', fontSize:'11px', fontWeight:'500',
    color:'var(--foreground)', textAlign:'left', whiteSpace:'nowrap',
  }
  const thNum: React.CSSProperties = {...thStyle, textAlign:'right'}
  const tdStyle: React.CSSProperties = {
    padding:'8px 12px', verticalAlign:'middle', color:'var(--foreground)'
  }
  const tdNum: React.CSSProperties = {
    ...tdStyle, textAlign:'right', fontFamily:'monospace', fontSize:'12px'
  }

  if (!validation || validation.length === 0) return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <span style={{fontSize:'15px',fontWeight:'500',color:'var(--foreground)'}}>Validation parameters</span>
        {onEdit && <button onClick={onEdit}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',fontSize:'12px',
            fontWeight:'500',border:'0.5px solid var(--border)',borderRadius:'6px',
            background:'var(--muted)',color:'var(--muted-foreground)',cursor:'pointer'}}>
          ✏️ Edit
        </button>}
      </div>
      <p style={{color:'var(--muted-foreground)',fontSize:'0.875rem'}}>No per-compound validation data has been submitted for this method.</p>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
        <span style={{fontSize:'15px',fontWeight:'500',color:'var(--foreground)'}}>Validation parameters</span>
        {onEdit && <button onClick={onEdit}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'4px 10px',fontSize:'12px',
            fontWeight:'500',border:'0.5px solid var(--border)',borderRadius:'6px',
            background:'var(--muted)',color:'var(--muted-foreground)',cursor:'pointer'}}>
          ✏️ Edit
        </button>}
      </div>

      {units && (
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px',
          fontSize:'12px',color:'var(--muted-foreground)'}}>
          <span>LOD and LOQ units:</span>
          <span style={{background:'color-mix(in srgb, var(--primary) 10%, transparent)',color:'var(--primary)',border:'0.5px solid rgba(56,189,248,0.35)',
            borderRadius:'6px',padding:'2px 8px',fontSize:'11px',fontWeight:'500'}}>
            {units}
          </span>
        </div>
      )}

      <div style={{overflowX:'auto',border:'0.5px solid var(--border)',borderRadius:'12px'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:'var(--muted)'}}>
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
              <tr key={i} style={{borderBottom:'0.5px solid var(--border)',
                background:i%2===0?'transparent':'var(--muted)'}}>
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
                <td style={{...tdStyle,fontSize:'11px',color:'var(--muted-foreground)',
                  maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {row.notes || ''}
                </td>
                <td style={{...tdStyle,textAlign:'center',position:'relative'}}>
                  {onEdit && <button
                    onClick={e => { e.stopPropagation(); setOpenMenu(openMenu===i?null:i) }}
                    style={{background:'none',border:'none',cursor:'pointer',
                      color:'var(--muted-foreground)',fontSize:'16px',padding:'2px 6px',
                      borderRadius:'4px',lineHeight:1}}>
                    ⋮
                  </button>}
                  {onEdit && openMenu === i && (
                    <div onClick={e=>e.stopPropagation()}
                      style={{position:'absolute',right:'8px',top:'100%',
                        background:'var(--popover)',border:'0.5px solid var(--border)',
                        borderRadius:'8px',padding:'4px 0',minWidth:'140px',
                        zIndex:20,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
                      <div onClick={()=>{setOpenMenu(null);onEdit()}}
                        style={{display:'flex',alignItems:'center',gap:'8px',
                          padding:'7px 12px',cursor:'pointer',color:'var(--foreground)',fontSize:'12px'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--border)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        ✏️ Edit row
                      </div>
                      <div onClick={()=>setOpenMenu(null)}
                        style={{display:'flex',alignItems:'center',gap:'8px',
                          padding:'7px 12px',cursor:'pointer',color:'var(--destructive)',fontSize:'12px'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='color-mix(in srgb, var(--destructive) 12%, transparent)')}
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

      <div style={{display:'flex',gap:'12px',marginTop:'10px',fontSize:'11px',color:'var(--muted-foreground)',flexWrap:'wrap'}}>
        {[
          {color:'var(--success)', label:'R² ≥ 0.999 / CV < 10%'},
          {color:'var(--warning)', label:'R² 0.995–0.999 / CV 10–15%'},
          {color:'var(--destructive)', label:'R² < 0.995 / CV > 15%'},
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
