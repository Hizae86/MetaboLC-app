import { useState } from 'react'

const MFR_PARAMS: Record<string, {label: string, field: string}[]> = {
  'Sciex':         [{label:'CE (eV)',field:'collision_energy_ev'},{label:'DP (V)',field:'declustering_potential'},{label:'CXP (V)',field:'cell_exit_potential'}],
  'Waters':        [{label:'CE (eV)',field:'collision_energy_ev'},{label:'Cone (V)',field:'cone_voltage'}],
  'Agilent':       [{label:'CE (eV)',field:'collision_energy_ev'},{label:'Frag (V)',field:'declustering_potential'},{label:'Cell Acc',field:'cell_accelerator_voltage'}],
  'Shimadzu':      [{label:'CE (eV)',field:'collision_energy_ev'},{label:'Q1 Bias',field:'q1_pre_bias'},{label:'Q3 Bias',field:'q3_pre_bias'}],
  'Thermo Fisher': [{label:'CE (eV)',field:'collision_energy_ev'},{label:'RF Lens (V)',field:'rf_lens_v'},{label:'Resolution',field:'ms_resolution'},{label:'Max IT (ms)',field:'max_inject_time_ms'}],
}

const ND = () => <span style={{color:'#d1d5db',fontSize:'11px'}}>—</span>

const val = (v: any) => (v !== null && v !== undefined && v !== '') ? v : null

const RoleBadge = ({t}: {t: any}) => {
  if (t.is_internal_standard) return (
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'20px',
      fontSize:'11px',fontWeight:'500',background:'#EEEDFE',color:'#3C3489',border:'0.5px solid #AFA9EC'}}>IS</span>
  )
  if (t.is_quantifier) return (
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'20px',
      fontSize:'11px',fontWeight:'500',background:'#EAF3DE',color:'#27500A',border:'0.5px solid #97C459'}}>Quantifier</span>
  )
  return (
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'20px',
      fontSize:'11px',fontWeight:'500',background:'#FAEEDA',color:'#633806',border:'0.5px solid #EF9F27'}}>Qualifier</span>
  )
}

export default function MRMView({ method, onExport }: { method: any, onExport: () => void }) {
  const [viewMode, setViewMode] = useState<'grouped'|'flat'>('grouped')
  const [openGroups, setOpenGroups] = useState<Record<string,boolean>>({})

  const transitions = method.mrm_transitions || []
  const mfrParams = MFR_PARAMS[method.instrument_manufacturer] || MFR_PARAMS['Sciex']

  const grouped = transitions.reduce((acc: any, t: any) => {
    const key = t.compound_name
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  const uniqueCompounds = [...new Set(transitions.filter((t:any) => !t.is_internal_standard).map((t:any) => t.compound_name))].length
  const isCount = [...new Set(transitions.filter((t:any) => t.is_internal_standard).map((t:any) => t.compound_name))].length

  const toggleGroup = (name: string) => {
    setOpenGroups(prev => ({...prev, [name]: !prev[name]}))
  }

  const isOpen = (name: string) => openGroups[name] !== false

  const thStyle = {
    textAlign: 'left' as const,
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: '500' as const,
    color: '#6b7280',
    borderBottom: '0.5px solid #e5e7eb',
    whiteSpace: 'nowrap' as const,
  }

  const tdStyle = {
    padding: '7px 10px',
    borderBottom: '0.5px solid #f3f4f6',
    verticalAlign: 'middle' as const,
  }

  const mono = {fontFamily: 'monospace', fontSize: '12px'}

  if (transitions.length === 0) return (
    <p style={{color:'#9ca3af',fontSize:'0.875rem'}}>No transitions recorded.</p>
  )

  return (
    <div>
      {/* Header row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
        <div style={{display:'flex',gap:'12px'}}>
          {[
            {label:'compounds', val: uniqueCompounds},
            {label:'transitions', val: transitions.length},
            {label:'internal standards', val: isCount},
          ].map(s => (
            <div key={s.label} style={{background:'#f9fafb',borderRadius:'8px',padding:'6px 12px',fontSize:'12px',color:'#6b7280'}}>
              <strong style={{fontSize:'15px',color:'#111827',display:'block'}}>{s.val}</strong>
              {s.label}
            </div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <div style={{display:'flex',border:'0.5px solid #d1d5db',borderRadius:'8px',overflow:'hidden'}}>
            {(['grouped','flat'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                style={{padding:'5px 12px',fontSize:'12px',fontWeight:'500',border:'none',cursor:'pointer',
                  background: viewMode===mode ? '#1e3a5f' : 'white',
                  color: viewMode===mode ? 'white' : '#6b7280'}}>
                {mode === 'grouped' ? '⊞ Grouped' : '≡ Flat'}
              </button>
            ))}
          </div>
          <button onClick={onExport}
            style={{display:'flex',alignItems:'center',gap:'5px',padding:'5px 12px',
              fontSize:'12px',fontWeight:'500',border:'0.5px solid #d1d5db',borderRadius:'8px',
              background:'white',color:'#6b7280',cursor:'pointer'}}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Grouped view */}
      {viewMode === 'grouped' && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {Object.entries(grouped).map(([name, rows]: [string, any]) => {
            const open = isOpen(name)
            const isIS = rows[0]?.is_internal_standard
            return (
              <div key={name} style={{border:'0.5px solid #e5e7eb',borderRadius:'12px',overflow:'hidden'}}>
                <div onClick={() => toggleGroup(name)}
                  style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 14px',
                    background: isIS ? '#EEEDFE' : '#f9fafb',
                    borderBottom: open ? '0.5px solid #e5e7eb' : 'none',cursor:'pointer',userSelect:'none'}}>
                  <span style={{fontSize:'13px',fontWeight:'500',color:'#111827',flex:1}}>{name}</span>
                  {isIS && <span style={{fontSize:'10px',padding:'2px 6px',background:'#EEEDFE',
                    color:'#3C3489',border:'0.5px solid #AFA9EC',borderRadius:'20px'}}>Internal standard</span>}
                  <span style={{fontSize:'11px',color:'#6b7280'}}>{rows.length} transition{rows.length>1?'s':''}</span>
                  <span style={{color:'#9ca3af',fontSize:'12px',transform:open?'rotate(180deg)':'none',transition:'transform 0.15s'}}>▼</span>
                </div>
                {open && (
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                      <thead>
                        <tr style={{background:'white'}}>
                          <th style={{...thStyle,width:'120px'}}>Role</th>
                          <th style={{...thStyle,width:'80px'}}>Adduct</th>
                          <th style={thStyle}>Q1 (m/z)</th>
                          <th style={thStyle}>Q3 (m/z)</th>
                          {mfrParams.map(p => <th key={p.field} style={thStyle}>{p.label}</th>)}
                          <th style={thStyle}>RT (min)</th>
                          <th style={thStyle}>Dwell (ms)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((t: any, i: number) => (
                          <tr key={i} style={{background: i%2===0?'white':'#fafafa'}}>
                            <td style={tdStyle}><RoleBadge t={t} /></td>
                            <td style={tdStyle}>
                              {t.pubchem_adduct
                                ? <span style={{fontSize:'10px',fontFamily:'monospace',fontWeight:'500',
                                    padding:'2px 5px',borderRadius:'5px',
                                    background: t.is_internal_standard ? '#EEEDFE' : '#E1F5EE',
                                    color: t.is_internal_standard ? '#3C3489' : '#085041',
                                    border:`0.5px solid ${t.is_internal_standard ? '#AFA9EC' : '#5DCAA5'}`}}>
                                    {t.pubchem_adduct}
                                  </span>
                                : <span style={{color:'#d1d5db',fontSize:'12px'}}>—</span>}
                            </td>
                            <td style={{...tdStyle,...mono}}>{t.precursor_mz}</td>
                            <td style={{...tdStyle,...mono}}>{t.product_mz}</td>
                            {mfrParams.map(p => (
                              <td key={p.field} style={{...tdStyle,...mono}}>
                                {val(t[p.field]) !== null ? t[p.field] : <ND />}
                              </td>
                            ))}
                            <td style={{...tdStyle,...mono}}>{val(t.retention_time_min) !== null ? t.retention_time_min : <ND />}</td>
                            <td style={{...tdStyle,...mono}}>{val(t.dwell_time_ms) !== null ? t.dwell_time_ms : <ND />}</td>
              {t.derivative && (
                <td style={tdStyle}>
                  <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 6px',
                    borderRadius:'20px',background:'#fef3c7',color:'#92400e',
                    border:'0.5px solid #fcd34d'}}>
                    {t.derivative}
                  </span>
                </td>
              )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Flat view */}
      {viewMode === 'flat' && (
        <div style={{overflowX:'auto',border:'0.5px solid #e5e7eb',borderRadius:'12px'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
            <thead>
              <tr style={{background:'#f9fafb'}}>
                <th style={{...thStyle,width:'160px'}}>Compound</th>
                <th style={{...thStyle,width:'110px'}}>Role</th>
                <th style={thStyle}>Q1 (m/z)</th>
                <th style={thStyle}>Q3 (m/z)</th>
                {mfrParams.map(p => <th key={p.field} style={thStyle}>{p.label}</th>)}
                <th style={thStyle}>RT (min)</th>
                <th style={thStyle}>Dwell (ms)</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((t: any, i: number) => (
                <tr key={i} style={{background: i%2===0?'white':'#fafafa',borderBottom:'0.5px solid #f3f4f6'}}>
                  <td style={{...tdStyle,fontWeight:'500'}}>{t.compound_name}</td>
                  <td style={tdStyle}><RoleBadge t={t} /></td>
                  <td style={{...tdStyle,...mono}}>{t.precursor_mz}</td>
                  <td style={{...tdStyle,...mono}}>{t.product_mz}</td>
                  {mfrParams.map(p => (
                    <td key={p.field} style={{...tdStyle,...mono}}>
                      {val(t[p.field]) !== null ? t[p.field] : <ND />}
                    </td>
                  ))}
                  <td style={{...tdStyle,...mono}}>{val(t.retention_time_min) !== null ? t.retention_time_min : <ND />}</td>
                  <td style={{...tdStyle,...mono}}>{val(t.dwell_time_ms) !== null ? t.dwell_time_ms : <ND />}</td>
              {t.derivative && (
                <td style={tdStyle}>
                  <span style={{fontSize:'10px',fontWeight:'500',padding:'2px 6px',
                    borderRadius:'20px',background:'#fef3c7',color:'#92400e',
                    border:'0.5px solid #fcd34d'}}>
                    {t.derivative}
                  </span>
                </td>
              )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
