import { useState } from 'react'
import ChromatogramChart from './ChromatogramChart'

function GradientChart({ steps, phaseA, phaseB }: { steps: any[], phaseA?: string, phaseB?: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const W = 560, H = 140
  const padL = 44, padR = 16, padT = 12, padB = 32

  const maxTime = Math.max(...steps.map((s: any) => s.time_min))

  const toX = (t: number) => padL + (t / maxTime) * (W - padL - padR)
  const toY = (pct: number) => padT + (1 - pct / 100) * (H - padT - padB)

  // Build line paths
  const ptsB = steps.map((s: any) => ({ x: toX(s.time_min), y: toY(s.percent_b), pct: s.percent_b, t: s.time_min }))
  const ptsA = steps.map((s: any) => ({ x: toX(s.time_min), y: toY(100 - s.percent_b), pct: 100 - s.percent_b, t: s.time_min }))

  const lineB = ptsB.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const lineA = ptsA.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Fill only under %B
  const fillB = `M ${ptsB[0].x.toFixed(1)},${H - padB} ${ptsB.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L ${ptsB[ptsB.length-1].x.toFixed(1)},${H-padB} Z`

  // Smart X ticks — avoid overlap
  const minTickGap = 28 // px
  const allTicks = steps.map((s: any) => s.time_min)
  const visibleTicks: number[] = []
  let lastX = -999
  allTicks.forEach(t => {
    const x = toX(t)
    if (x - lastX >= minTickGap) {
      visibleTicks.push(t)
      lastX = x
    }
  })

  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
        <defs>
          <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* Y grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} y1={toY(t)} x2={W-padR} y2={toY(t)} stroke="#f1f5f9" strokeWidth="0.8"/>
            <text x={padL-5} y={toY(t)+3} textAnchor="end" fontSize="8" fill="#94a3b8" fontFamily="monospace">{t}%</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={H-padB} stroke="#e2e8f0" strokeWidth="0.8"/>
        <line x1={padL} y1={H-padB} x2={W-padR} y2={H-padB} stroke="#e2e8f0" strokeWidth="0.8"/>

        {/* X ticks — smart spacing */}
        {visibleTicks.map(t => (
          <g key={t}>
            <line x1={toX(t)} y1={H-padB} x2={toX(t)} y2={H-padB+3} stroke="#cbd5e1" strokeWidth="0.8"/>
            <text x={toX(t)} y={H-padB+11} textAnchor="middle" fontSize="8" fill="#94a3b8" fontFamily="monospace">{t}</text>
          </g>
        ))}

        {/* X label */}
        <text x={(W-padL-padR)/2+padL} y={H-1} textAnchor="middle" fontSize="8" fill="#94a3b8">Time (min)</text>

        {/* Hover vertical line */}
        {hoveredIdx !== null && (
          <line x1={ptsB[hoveredIdx].x} y1={padT} x2={ptsB[hoveredIdx].x} y2={H-padB}
            stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3,2"/>
        )}

        {/* Fill %B */}
        <path d={fillB} fill="url(#fillB)"/>

        {/* Line %A */}
        <path d={lineA} fill="none" stroke="#3b82f6" strokeWidth="1.8"
          strokeLinejoin="round" strokeLinecap="round"/>

        {/* Line %B */}
        <path d={lineB} fill="none" stroke="#f97316" strokeWidth="1.8"
          strokeLinejoin="round" strokeLinecap="round"/>

        {/* Data points */}
        {ptsB.map((p, i) => (
          <g key={i} style={{cursor:'pointer'}}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}>
            {/* Hover target */}
            <circle cx={p.x} cy={p.y} r="10" fill="transparent"/>
            {/* %B point */}
            <circle cx={p.x} cy={p.y} r={hoveredIdx === i ? 4 : 2.5}
              fill="white" stroke="#f97316" strokeWidth="1.5"
              style={{transition:'r 0.15s'}}/>
            {/* %A point */}
            <circle cx={ptsA[i].x} cy={ptsA[i].y} r={hoveredIdx === i ? 4 : 2.5}
              fill="white" stroke="#3b82f6" strokeWidth="1.5"
              style={{transition:'r 0.15s'}}/>

            {/* Tooltip */}
            {hoveredIdx === i && (
              <g>
                <rect x={p.x + 6} y={p.y - 22}
                  width="80" height="36" rx="4"
                  fill="white" stroke="#e2e8f0" strokeWidth="0.8"
                  style={{filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.08))'}}/>
                <text x={p.x + 10} y={p.y - 10} fontSize="8" fill="#64748b" fontFamily="monospace">
                  t = {p.t} min
                </text>
                <text x={p.x + 10} y={p.y - 1} fontSize="8" fill="#3b82f6" fontFamily="monospace">
                  %A = {ptsA[i].pct.toFixed(0)}%
                </text>
                <text x={p.x + 10} y={p.y + 8} fontSize="8" fill="#f97316" fontFamily="monospace">
                  %B = {p.pct.toFixed(0)}%
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div style={{display:'flex',gap:'20px',justifyContent:'center',margin:'6px 0 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <div style={{width:'18px',height:'2px',background:'#3b82f6',borderRadius:'1px'}}/>
          <span style={{fontSize:'10px',color:'#64748b'}}>%A — {phaseA?.split('+')[0]?.trim() || 'Aqueous'}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <div style={{width:'18px',height:'2px',background:'#f97316',borderRadius:'1px'}}/>
          <span style={{fontSize:'10px',color:'#64748b'}}>%B — {phaseB?.split('+')[0]?.trim() || 'Organic'}</span>
        </div>
      </div>

      {/* Synchronized table */}
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
        <thead>
          <tr>
            {['Time (min)','%A','%B','Flow (mL/min)'].map(h => (
              <th key={h} style={{textAlign:'left',padding:'5px 8px',
                color:'#94a3b8',fontWeight:'500',borderBottom:'0.5px solid #e5e7eb'}}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((step: any, i: number) => (
            <tr key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                borderBottom:'0.5px solid #f8fafc',
                background: hoveredIdx === i ? '#fff7ed' : 'transparent',
                cursor: 'default',
                transition: 'background 0.15s'
              }}>
              <td style={{padding:'5px 8px',fontFamily:'monospace',
                color: hoveredIdx === i ? '#f97316' : '#334155',fontWeight: hoveredIdx === i ? 600 : 400}}>
                {step.time_min}
              </td>
              <td style={{padding:'5px 8px',fontFamily:'monospace',color:'#3b82f6'}}>
                {(100-step.percent_b).toFixed(0)}%
              </td>
              <td style={{padding:'5px 8px',fontFamily:'monospace',color:'#f97316'}}>
                {step.percent_b}%
              </td>
              <td style={{padding:'5px 8px',fontFamily:'monospace',color:'#64748b'}}>
                {step.flow_rate_ml_min ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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

      {/* Simulated chromatogram */}
      {(() => {
        const COLORS = ['#6366f1','#ec4899','#f97316','#22c55e','#eab308','#14b8a6','#8b5cf6','#f43f5e','#0ea5e9']
        const quantifiers = (method.mrm_transitions || [])
          .filter((t: any) => t.is_quantifier && !t.is_internal_standard && t.retention_time_min)
          .slice(0, 10)
          .map((t: any, i: number) => ({
            name: t.compound_name || `Compound ${i+1}`,
            rt: parseFloat(t.retention_time_min),
            intensity: 100 - (i * 6),
            width: 0.08 + (i * 0.01),
            color: COLORS[i % COLORS.length],
            adduct: t.pubchem_adduct,
          }))
        if (quantifiers.length === 0) return null
        return (
          <ChromatogramChart
            peaks={quantifiers}
            title="Simulated Chromatogram (based on MRM retention times)"
          />
        )
      })()}

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

          <GradientChart steps={method.gradient_steps} phaseA={method.mobile_phase_a} phaseB={method.mobile_phase_b} />
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
