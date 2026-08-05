import { useState } from 'react'

export default function ChromatographyView({ method }: { method: any }) {
  const [nSamples, setNSamples] = useState(50)
  const [runTime, setRunTime] = useState(
    method.gradient_steps?.length > 0
      ? Math.max(...method.gradient_steps.map((s: any) => s.time_min))
      : 5
  )
  const [flowRate, setFlowRate] = useState(
    method.gradient_steps?.[0]?.flow_rate_ml_min || 0.4
  )
  const [equil, setEquil] = useState(1.0)
  const [avgB, setAvgB] = useState(() => {
    if (!method.gradient_steps?.length) return 40
    const steps = method.gradient_steps
    let total = 0
    for (let i = 0; i < steps.length - 1; i++) {
      const dt = steps[i+1].time_min - steps[i].time_min
      const avgPct = (steps[i].percent_b + steps[i+1].percent_b) / 2
      total += dt * avgPct
    }
    const totalTime = steps[steps.length-1].time_min - steps[0].time_min
    return totalTime > 0 ? Math.round(total / totalTime) : 40
  })

  const totalVol = nSamples * (runTime + equil) * flowRate
  const volB = totalVol * (avgB / 100)
  const volA = totalVol - volB

  const IS = {
    width: '80px', padding: '5px 8px',
    border: '0.5px solid #d1d5db', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'monospace',
    background: 'white', color: '#111827'
  } as React.CSSProperties

  const parseMP = (mp: string) => {
    if (!mp) return { solvent: '—', additives: [] }
    const parts = mp.split(/\+|,/).map((p: string) => p.trim()).filter(Boolean)
    return { solvent: parts[0], additives: parts.slice(1) }
  }

  const mpA = parseMP(method.mobile_phase_a)
  const mpB = parseMP(method.mobile_phase_b)

  if (!method.column_brand && !method.mobile_phase_a && !method.gradient_steps?.length) {
    return (
      <p style={{color:'#9ca3af',fontSize:'0.875rem'}}>
        No chromatography data recorded.
      </p>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>

      {/* Column card */}
      {(method.column_brand || method.column_name) && (
        <div style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.25rem',background:'white'}}>
          <p style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.06em',
            color:'#9ca3af',marginBottom:'12px'}}>Column and hardware</p>
          <div style={{display:'flex',alignItems:'center',gap:'16px',
            marginBottom:'14px',paddingBottom:'14px',borderBottom:'0.5px solid #e5e7eb'}}>
            <div style={{width:'40px',height:'40px',borderRadius:'10px',background:'#E6F1FB',
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
              fontSize:'20px'}}>
              🧪
            </div>
            <div>
              <div style={{fontSize:'12px',color:'#0C447C',marginBottom:'2px'}}>{method.column_brand}</div>
              <div style={{fontSize:'14px',fontWeight:'500',color:'#111827'}}>{method.column_name}</div>
              {method.column_length_mm && (
                <div style={{display:'inline-flex',alignItems:'center',gap:'4px',
                  background:'#E6F1FB',color:'#0C447C',border:'0.5px solid #85B7EB',
                  borderRadius:'20px',padding:'3px 10px',fontSize:'12px',fontWeight:'500',marginTop:'4px'}}>
                  {method.column_length_mm} × {method.column_diameter_mm} mm · {method.column_particle_size_um} µm
                </div>
              )}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
            {method.column_stationary_phase && (
              <div>
                <p style={{fontSize:'11px',color:'#6b7280',marginBottom:'2px'}}>Stationary phase</p>
                <p style={{fontSize:'13px',fontWeight:'500',color:'#111827'}}>{method.column_stationary_phase}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operating parameters */}
      <div style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.25rem',background:'white'}}>
        <p style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.06em',
          color:'#9ca3af',marginBottom:'12px'}}>Operating parameters</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:'8px'}}>
          {[
            {label:'Column temp', value: method.column_temperature_c, unit:'°C'},
            {label:'Injection volume', value: method.injection_volume_ul, unit:'µL'},
            {label:'Flow rate', value: method.gradient_steps?.[0]?.flow_rate_ml_min, unit:'mL/min'},
            {label:'Autosampler temp', value: method.autosampler_temperature_c, unit:'°C'},
          ].map(p => (
            <div key={p.label} style={{background:'#f9fafb',borderRadius:'8px',padding:'10px 12px'}}>
              <p style={{fontSize:'11px',color:'#6b7280',marginBottom:'2px'}}>{p.label}</p>
              {p.value != null
                ? <p style={{fontSize:'16px',fontWeight:'500',color:'#111827'}}>
                    {p.value} <span style={{fontSize:'11px',color:'#6b7280',fontWeight:'400'}}>{p.unit}</span>
                  </p>
                : <p style={{fontSize:'13px',color:'#d1d5db'}}>N/R</p>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Mobile phases */}
      {(method.mobile_phase_a || method.mobile_phase_b) && (
        <div style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.25rem',background:'white'}}>
          <p style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.06em',
            color:'#9ca3af',marginBottom:'12px'}}>Mobile phases</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            {method.mobile_phase_a && (
              <div style={{background:'#E6F1FB',border:'0.5px solid #85B7EB',borderRadius:'10px',padding:'12px 14px'}}>
                <p style={{fontSize:'11px',fontWeight:'500',color:'#0C447C',marginBottom:'6px'}}>Phase A — aqueous</p>
                <p style={{fontSize:'13px',fontWeight:'500',color:'#185FA5',marginBottom:'4px'}}>{mpA.solvent}</p>
                {mpA.additives.map((a: string, i: number) => (
                  <p key={i} style={{fontSize:'11px',color:'#374151'}}>+ {a}</p>
                ))}
              </div>
            )}
            {method.mobile_phase_b && (
              <div style={{background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:'10px',padding:'12px 14px'}}>
                <p style={{fontSize:'11px',fontWeight:'500',color:'#633806',marginBottom:'6px'}}>Phase B — organic</p>
                <p style={{fontSize:'13px',fontWeight:'500',color:'#854F0B',marginBottom:'4px'}}>{mpB.solvent}</p>
                {mpB.additives.map((a: string, i: number) => (
                  <p key={i} style={{fontSize:'11px',color:'#374151'}}>+ {a}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gradient */}
      {method.gradient_steps?.length > 0 && (
        <div style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.25rem',background:'white'}}>
          <p style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.06em',
            color:'#9ca3af',marginBottom:'12px'}}>Gradient program</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',tableLayout:'fixed'}}>
              <thead>
                <tr>
                  {['Time (min)','%A','%B','Composition','Flow (mL/min)'].map(h => (
                    <th key={h} style={{textAlign:'left',padding:'6px 8px',fontSize:'11px',
                      fontWeight:'500',color:'#6b7280',borderBottom:'0.5px solid #e5e7eb'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {method.gradient_steps.map((step: any, i: number) => {
                  const pctB = step.percent_b
                  const pctA = 100 - pctB
                  return (
                    <tr key={i} style={{borderBottom:'0.5px solid #f3f4f6'}}>
                      <td style={{padding:'7px 8px',fontFamily:'monospace'}}>{step.time_min}</td>
                      <td style={{padding:'7px 8px',fontFamily:'monospace'}}>{pctA.toFixed(0)}%</td>
                      <td style={{padding:'7px 8px',fontFamily:'monospace'}}>{pctB}%</td>
                      <td style={{padding:'7px 8px'}}>
                        <div style={{display:'flex',height:'6px',borderRadius:'3px',overflow:'hidden',width:'60px'}}>
                          <div style={{width:`${pctA * 0.6}px`,background:'#85B7EB'}} />
                          <div style={{width:`${pctB * 0.6}px`,background:'#EF9F27'}} />
                        </div>
                      </td>
                      <td style={{padding:'7px 8px',fontFamily:'monospace'}}>{step.flow_rate_ml_min ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calculator */}
      <div style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',padding:'1rem 1.25rem',background:'white'}}>
        <p style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.06em',
          color:'#9ca3af',marginBottom:'12px'}}>Mobile phase consumption calculator</p>

        <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginBottom:'14px'}}>
          {[
            {label:'Samples', val: nSamples, set: setNSamples, step: 1, min: 1},
            {label:'Run time (min)', val: runTime, set: setRunTime, step: 0.5, min: 0.1},
            {label:'Flow (mL/min)', val: flowRate, set: setFlowRate, step: 0.05, min: 0.01},
            {label:'Equilibration (min)', val: equil, set: setEquil, step: 0.5, min: 0},
            {label:'Avg %B', val: avgB, set: setAvgB, step: 1, min: 0, max: 100},
          ].map(p => (
            <div key={p.label} style={{display:'flex',flexDirection:'column',gap:'3px'}}>
              <span style={{fontSize:'11px',color:'#6b7280'}}>{p.label}</span>
              <input type="number" style={IS} value={p.val}
                step={p.step} min={p.min} max={p.max}
                onChange={e => p.set(parseFloat(e.target.value) || 0)} />
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
          <div style={{background:'#E6F1FB',border:'0.5px solid #85B7EB',borderRadius:'10px',padding:'14px 16px'}}>
            <p style={{fontSize:'11px',fontWeight:'500',color:'#0C447C',marginBottom:'4px'}}>Phase A consumed</p>
            <p style={{fontSize:'22px',fontWeight:'500',color:'#185FA5'}}>
              {volA.toFixed(1)} <span style={{fontSize:'12px',color:'#6b7280',fontWeight:'400'}}>mL</span>
            </p>
            <p style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>avg {100-avgB}% per run · {nSamples} samples</p>
          </div>
          <div style={{background:'#FAEEDA',border:'0.5px solid #EF9F27',borderRadius:'10px',padding:'14px 16px'}}>
            <p style={{fontSize:'11px',fontWeight:'500',color:'#633806',marginBottom:'4px'}}>Phase B consumed</p>
            <p style={{fontSize:'22px',fontWeight:'500',color:'#854F0B'}}>
              {volB.toFixed(1)} <span style={{fontSize:'12px',color:'#6b7280',fontWeight:'400'}}>mL</span>
            </p>
            <p style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>avg {avgB}% per run · {nSamples} samples</p>
          </div>
        </div>

        <div style={{padding:'10px 14px',background:'#f9fafb',borderRadius:'8px',
          display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px',color:'#6b7280'}}>
          <span>Total solvent consumed</span>
          <strong style={{fontSize:'14px',color:'#111827'}}>{totalVol.toFixed(1)} mL</strong>
        </div>
      </div>
    </div>
  )
}
