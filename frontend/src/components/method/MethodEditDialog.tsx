import { useState } from 'react'
import axios from 'axios'
import MRMEditor from '../MRMEditor'
import ValidationEditor from '../ValidationEditor'
import { API } from '@/lib/api'
import { adminConfig } from '@/lib/admin'
import { INSTRUMENTS, ION_MOBILITY_PARAMS, MANUFACTURERS, MS_SOURCE_PARAMS, transitionParams } from '@/lib/vendors'

interface Props {
  method: any
  validation: any[]
  initialTab?: string
  onClose: () => void
  onSaved: () => void
  /** Returns true when the error was an auth failure it already handled. */
  onAuthError: (err: any) => boolean
}

/** Admin-only editor. Moved out of MethodDetail unchanged in behaviour so the
 *  read view stays small; it keeps its original dark styling (admins only)
 *  and is the next candidate for migration to design tokens. */
export default function MethodEditDialog({ method, validation: initialValidation, initialTab = 'basic', onClose, onSaved, onAuthError }: Props) {
  const id = method.id
  const [ef, setEf] = useState<any>(method)
  const [grad, setGrad] = useState<any[]>([...(method.gradient_steps || [])])
  const [trans, setTrans] = useState<any[]>([...(method.mrm_transitions || [])])
  const [validation, setValidation] = useState<any[]>(initialValidation)
  const [saving, setSaving] = useState(false)
  const [editTab, setEditTab] = useState(initialTab)
  const mfrParams = transitionParams(method.instrument_manufacturer)

  const u = (field: string) => (val: any) => setEf((prev: any) => ({ ...prev, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert numeric fields
      const numericFields = ['desolvation_gas_flow_lh','cone_gas_flow_lh','interface_voltage_kv',
        'heating_gas_flow','dl_temperature','interface_temperature','nebulizing_gas','drying_gas',
        'heat_block_temperature','ion_spray_voltage','gas1','gas2','gas_temperature',
        'gas_flow_lmin','nebulizer_pressure_psi','capillary_voltage_v','capillary_voltage_pos_v','capillary_voltage_neg_v','source_temperature_c',
        'desolvation_temperature_c','curtain_gas','column_length_mm','column_diameter_mm',
        'column_particle_size_um','column_temperature_c','injection_volume_ul',
        'lloq','uloq','cv_intra_percent','cv_inter_percent','recovery_percent',
        'aux_gas_flow','sweep_gas_flow','ion_transfer_tube_temp_c','vaporizer_temp_c',
        'sheath_gas_flow_lmin','sheath_gas_heater_c',
        'im_separation_voltage_v','im_compensation_voltage_v','im_offset_v','im_temperature_c']
      const cleanEf = {...ef}
      numericFields.forEach(f => {
        if (cleanEf[f] !== undefined && cleanEf[f] !== '' && cleanEf[f] !== null) {
          const parsed = parseFloat(cleanEf[f])
          cleanEf[f] = isNaN(parsed) ? null : parsed
        } else if (cleanEf[f] === '') {
          cleanEf[f] = null
        }
      })
      await axios.put(`${API}/methods/${id}`, { ...cleanEf, gradient_steps: [], mrm_transitions: [] }, adminConfig())

      const cleanGrad = grad
        .filter(s => s.time_min !== '' && s.percent_b !== '')
        .map(s => ({
          time_min: parseFloat(s.time_min),
          percent_b: parseFloat(s.percent_b),
          flow_rate_ml_min: s.flow_rate_ml_min ? parseFloat(s.flow_rate_ml_min) : null,
          curve: s.curve || 'linear'
        }))
      await axios.put(`${API}/methods/${id}/gradient`, { steps: cleanGrad }, adminConfig())

      const cleanTrans = trans
        .filter(t => t.compound_name && t.precursor_mz && t.product_mz)
        .map(t => ({
          compound_name: t.compound_name,
          is_internal_standard: t.is_internal_standard || 0,
          precursor_mz: parseFloat(t.precursor_mz),
          product_mz: parseFloat(t.product_mz),
          collision_energy_ev: t.collision_energy_ev ? parseFloat(t.collision_energy_ev) : null,
          declustering_potential: t.declustering_potential ? parseFloat(t.declustering_potential) : null,
          cell_exit_potential: t.cell_exit_potential ? parseFloat(t.cell_exit_potential) : null,
          cone_voltage: t.cone_voltage ? parseFloat(t.cone_voltage) : null,
          cell_accelerator_voltage: t.cell_accelerator_voltage ? parseFloat(t.cell_accelerator_voltage) : null,
          q1_pre_bias: t.q1_pre_bias ? parseFloat(t.q1_pre_bias) : null,
          q3_pre_bias: t.q3_pre_bias ? parseFloat(t.q3_pre_bias) : null,
          ms_resolution: t.ms_resolution || null,
          max_inject_time_ms: t.max_inject_time_ms ? parseFloat(t.max_inject_time_ms) : null,
          rf_lens_v: t.rf_lens_v ? parseFloat(t.rf_lens_v) : null,
          retention_time_min: t.retention_time_min ? parseFloat(t.retention_time_min) : null,
          dwell_time_ms: t.dwell_time_ms ? parseFloat(t.dwell_time_ms) : null,
          is_quantifier: t.is_quantifier !== undefined ? t.is_quantifier : 1,
          polarity: t.polarity || 'ESI+',
          assigned_is: t.assigned_is || null,
        }))
      await axios.put(`${API}/methods/${id}/transitions`, { transitions: cleanTrans }, adminConfig())
      await axios.put(`${API}/methods/${id}/validation`, { items: validation.filter((v:any)=>v.compound_name) }, adminConfig())

      onSaved()
    } catch(err) {
      if (!onAuthError(err)) {
        console.error(err)
        alert('Error saving.')
      }
    } finally { setSaving(false) }
  }

  const IS = {width:'100%',padding:'0.4rem 0.6rem',border:'1px solid rgba(255,255,255,0.15)',
    borderRadius:'0.4rem',fontSize:'0.85rem',boxSizing:'border-box' as const,
    background:'rgba(255,255,255,0.05)',color:'#f1f5f9'}
  const LS = {display:'block',fontSize:'0.8rem',fontWeight:'500' as const,color:'#94a3b8',marginBottom:'0.25rem'}

  return (
    <div className="dark">
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:50,
          display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'1rem'}}>
          <div style={{background:'#0e1b2e',borderRadius:'1rem',width:'100%',maxWidth:'1000px',margin:'auto',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>

            {/* Modal Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'1.25rem 1.5rem',borderBottom:'1px solid rgba(255,255,255,0.1)',background:'#0e2138'}}>
              <h2 style={{fontSize:'1.1rem',fontWeight:'700',color:'white'}}>Edit Method</h2>
              <button onClick={()=>onClose()}
                style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer',color:'white'}}>×</button>
            </div>

            {/* Edit Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)',overflowX:'auto'}}>
              {[
                {id:'basic', label:'Basic Info'},
                {id:'chromatography', label:'Column & MP'},
                {id:'gradient', label:'Gradient'},
                {id:'mrm', label:'MRM Transitions'},
                {id:'ms', label:'MS Source'},
                {id:'validation', label:'Validation'},
                {id:'sample', label:'Sample Prep'},
                {id:'notes', label:'Notes'},
              ].map(t=>(
                <button key={t.id} onClick={()=>setEditTab(t.id)} style={{
                  padding:'0.6rem 1rem',fontSize:'0.8rem',fontWeight:'500',whiteSpace:'nowrap',
                  background:'none',border:'none',cursor:'pointer',
                  borderBottom: editTab===t.id ? '2px solid #38bdf8' : '2px solid transparent',
                  color: editTab===t.id ? '#38bdf8' : '#64748b',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div style={{padding:'1.5rem',maxHeight:'65vh',overflowY:'auto'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>

              {editTab==='basic' && <>
                <div style={{gridColumn:'1/-1'}}><label style={LS}>Title</label><input style={IS} value={ef.title||''} onChange={e=>u('title')(e.target.value)} /></div>
                <div><label style={LS}>Analyte</label><input style={IS} value={ef.analyte||''} onChange={e=>u('analyte')(e.target.value)} /></div>
                <div><label style={LS}>CAS Number</label><input style={IS} value={ef.analyte_cas||''} onChange={e=>u('analyte_cas')(e.target.value)} placeholder="e.g. 50-23-7" /></div>
                <div><label style={LS}>Clinical Application</label><input style={IS} value={ef.clinical_application||''} onChange={e=>u('clinical_application')(e.target.value)} /></div>
                <div><label style={LS}>Matrix</label>
                  <select style={IS} value={ef.matrix||''} onChange={e=>u('matrix')(e.target.value)}>
                    {['plasma','serum','urine','whole blood','dried blood spot','CSF','saliva','tissue','other'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Ionization Mode</label>
                  <select style={IS} value={ef.ionization_mode||''} onChange={e=>u('ionization_mode')(e.target.value)}>
                    {['ESI+','ESI-','ESI+/ESI- (polarity switching 50ms)','APCI+','APCI-'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Instrument Manufacturer</label>
                  <select style={IS} value={ef.instrument_manufacturer||''} onChange={e=>{u('instrument_manufacturer')(e.target.value);u('instrument_model')('')}}>
                    {MANUFACTURERS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Instrument Model</label>
                  <select style={IS} value={ef.instrument_model||''} onChange={e=>u('instrument_model')(e.target.value)}>
                    <option value="">-- Select model --</option>
                    {(INSTRUMENTS[ef.instrument_manufacturer||method.instrument_manufacturer]||['Other']).map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={LS}>Laboratory</label><input style={IS} value={ef.laboratory||''} onChange={e=>u('laboratory')(e.target.value)} /></div>
                <div><label style={LS}>Country</label><input style={IS} value={ef.country||''} onChange={e=>u('country')(e.target.value)} /></div>
              </>}

              {editTab==='chromatography' && <>
                <div><label style={LS}>Column Brand</label><input style={IS} value={ef.column_brand||''} onChange={e=>u('column_brand')(e.target.value)} placeholder="e.g. Phenomenex" /></div>
                <div><label style={LS}>Column Name</label><input style={IS} value={ef.column_name||''} onChange={e=>u('column_name')(e.target.value)} placeholder="e.g. Kinetex C18" /></div>
                <div><label style={LS}>Stationary Phase</label><input style={IS} value={ef.column_stationary_phase||''} onChange={e=>u('column_stationary_phase')(e.target.value)} placeholder="e.g. C18, HILIC" /></div>
                <div><label style={LS}>Column Temp (°C)</label><input type="number" style={IS} value={ef.column_temperature_c||''} onChange={e=>u('column_temperature_c')(e.target.value)} /></div>
                <div><label style={LS}>Length (mm)</label><input type="number" style={IS} value={ef.column_length_mm||''} onChange={e=>u('column_length_mm')(e.target.value)} /></div>
                <div><label style={LS}>Diameter (mm)</label><input type="number" style={IS} value={ef.column_diameter_mm||''} onChange={e=>u('column_diameter_mm')(e.target.value)} /></div>
                <div><label style={LS}>Particle Size (μm)</label><input type="number" style={IS} value={ef.column_particle_size_um||''} onChange={e=>u('column_particle_size_um')(e.target.value)} /></div>
                <div><label style={LS}>Injection Volume (μL)</label><input type="number" style={IS} value={ef.injection_volume_ul||''} onChange={e=>u('injection_volume_ul')(e.target.value)} /></div>
                <div style={{gridColumn:'1/-1'}}><label style={LS}>Mobile Phase A</label><input style={IS} value={ef.mobile_phase_a||''} onChange={e=>u('mobile_phase_a')(e.target.value)} placeholder="e.g. Water + 0.1% Formic Acid" /></div>
                <div style={{gridColumn:'1/-1'}}><label style={LS}>Mobile Phase B</label><input style={IS} value={ef.mobile_phase_b||''} onChange={e=>u('mobile_phase_b')(e.target.value)} placeholder="e.g. Methanol + 0.1% Formic Acid" /></div>
                <div><label style={LS}>Autosampler Temp (°C)</label><input type="number" style={IS} value={ef.autosampler_temperature_c||''} onChange={e=>u('autosampler_temperature_c')(e.target.value)} placeholder="10" /></div>
                <div><label style={LS}>Needle Wash Solvent</label><input style={IS} value={ef.needle_wash_solvent||''} onChange={e=>u('needle_wash_solvent')(e.target.value)} placeholder="e.g. MeOH/Water 50:50" /></div>
              </>}

              {editTab==='gradient' && <>
                <div style={{gridColumn:'1/-1'}}>
                  <table style={{width:'100%',fontSize:'0.82rem',borderCollapse:'collapse',marginBottom:'0.5rem'}}>
                    <thead><tr style={{background:'rgba(255,255,255,0.05)'}}>
                      {['Time (min)','%B','Flow (mL/min)','Curve',''].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'0.3rem 0.4rem',fontWeight:'600',color:'#94a3b8',fontSize:'0.75rem'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {grad.map((step,i)=>(
                        <tr key={i}>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="0.0" style={{...IS,fontSize:'0.8rem'}} value={step.time_min||''} onChange={e=>{const s=[...grad];s[i]={...s[i],time_min:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="5" style={{...IS,fontSize:'0.8rem'}} value={step.percent_b||''} onChange={e=>{const s=[...grad];s[i]={...s[i],percent_b:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="0.4" style={{...IS,fontSize:'0.8rem'}} value={step.flow_rate_ml_min||''} onChange={e=>{const s=[...grad];s[i]={...s[i],flow_rate_ml_min:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><select style={{...IS,fontSize:'0.8rem'}} value={step.curve||'linear'} onChange={e=>{const s=[...grad];s[i]={...s[i],curve:e.target.value};setGrad(s)}}><option>linear</option><option>step</option></select></td>
                          <td><button onClick={()=>setGrad(grad.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'1.1rem'}}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={()=>setGrad([...grad,{time_min:'',percent_b:'',flow_rate_ml_min:'',curve:'linear'}])}
                    style={{padding:'0.3rem 0.8rem',border:'1px solid rgba(56,189,248,0.35)',borderRadius:'0.4rem',background:'rgba(255,255,255,0.03)',color:'#38bdf8',cursor:'pointer',fontSize:'0.8rem'}}>
                    + Add Step
                  </button>
                </div>
              </>}

              {editTab==='mrm' && <>
                <div style={{gridColumn:'1/-1'}}>
                  <p style={{fontSize:'0.75rem',color:'#64748b',marginBottom:'0.5rem'}}>
                    {method.instrument_manufacturer} — {mfrParams.headers.join(' · ')}
                  </p>
                                    <MRMEditor
                    trans={trans}
                    setTrans={setTrans}
                    mfrParams={mfrParams}
                    IS={IS}
                    ionization={ef.ionization_mode||method.ionization_mode}
                  />
                  
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    <button onClick={()=>setTrans([...trans,{compound_name:'',is_internal_standard:0,precursor_mz:'',product_mz:'',is_quantifier:1,polarity:'ESI+'}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid rgba(56,189,248,0.35)',borderRadius:'0.4rem',background:'rgba(255,255,255,0.03)',color:'#38bdf8',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Add Transition
                    </button>
                    <button onClick={()=>setTrans([...trans,{compound_name:'',is_internal_standard:1,precursor_mz:'',product_mz:'',is_quantifier:1,polarity:'ESI+'}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid #7c3aed',borderRadius:'0.4rem',background:'rgba(168,85,247,0.15)',color:'#c084fc',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Add IS
                    </button>
                  </div>
                </div>
              </>}

              {editTab==='ms' && <>
                {(() => {
                  const isPolarity = (ef.ionization_mode||method.ionization_mode)?.includes('polarity') ||
                    (ef.ionization_mode||method.ionization_mode)?.includes('+/-')
                  const mfr = ef.instrument_manufacturer || method.instrument_manufacturer
                  let params: any[] = MS_SOURCE_PARAMS[mfr] || [
                    {label:'Capillary Voltage', field:'capillary_voltage_v', unit:'V'},
                    {label:'Source Temperature', field:'source_temperature_c', unit:'°C'},
                  ]
                  if (mfr === 'Sciex' || mfr === 'PerkinElmer') {
                    params = isPolarity
                      ? params.filter((p:any) => p.field !== 'ion_spray_voltage')
                      : params.filter((p:any) => p.field !== 'capillary_voltage_pos_v' && p.field !== 'capillary_voltage_neg_v')
                  }
                  if (mfr === 'Waters' || mfr === 'Thermo Fisher') {
                    params = isPolarity
                      ? params.filter((p:any) => p.field !== 'capillary_voltage_v')
                      : params.filter((p:any) => p.field !== 'capillary_voltage_pos_v' && p.field !== 'capillary_voltage_neg_v')
                  }
                  return params.map((p:any) => (
                    <div key={p.field}>
                      <label style={LS}>{p.label} {p.unit && `(${p.unit})`}</label>
                      <input type={p.field==='collision_gas'?'text':'number'} style={IS}
                        value={ef[p.field]||''} onChange={e=>u(p.field)(e.target.value)} placeholder="—" />
                    </div>
                  ))
                })()}
                <div style={{gridColumn:'1/-1',marginTop:'0.5rem',fontSize:'0.72rem',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',opacity:0.7}}>
                  Ion mobility (optional — SelexION, FAIMS…)
                </div>
                {ION_MOBILITY_PARAMS.map(p => (
                  <div key={p.field}>
                    <label style={LS}>{p.label} {p.unit && `(${p.unit})`}</label>
                    <input type={p.text?'text':'number'} style={IS}
                      value={ef[p.field] ?? ''} onChange={e=>u(p.field)(e.target.value)} placeholder="—" />
                  </div>
                ))}
              </>}

              {editTab==='validation' && <>
                <div style={{gridColumn:'1/-1'}}>
                  {/* Units selector */}
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.75rem',
                    padding:'0.5rem 0.75rem',background:'rgba(56,189,248,0.08)',borderRadius:'0.5rem',border:'1px solid rgba(56,189,248,0.35)'}}>
                    <span style={{fontSize:'0.78rem',fontWeight:'600',color:'#7dd3fc'}}>LOD/LOQ units:</span>
                    <select style={{fontSize:'0.78rem',padding:'0.2rem 0.4rem',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'0.3rem',background:'rgba(255,255,255,0.05)',color:'#f1f5f9'}}
                      value={ef.validation_units||'ng/mL'}
                      onChange={e=>u('validation_units')(e.target.value)}>
                      {['ng/mL','μg/L','nmol/L','pmol/L','pg/mL','μg/mL','mg/L','mmol/L','ng/L','pg/mg','μmol/L','μmol/mol creatinine','mmol/mol creatinine'].map(u=>(
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                    <span style={{fontSize:'0.72rem',color:'#64748b'}}>Applied to all compounds</span>
                  </div>

                  <ValidationEditor
                    validation={validation}
                    setValidation={setValidation}
                    units={ef.validation_units || 'ng/mL'}
                    IS={IS}
                  />
                                    <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                    <button onClick={()=>{
                      const compounds = method.mrm_transitions
                        .filter((t:any)=>!t.is_internal_standard && t.is_quantifier)
                        .map((t:any)=>t.compound_name)
                        .filter((name:string,idx:number,arr:string[])=>arr.indexOf(name)===idx)
                      const existing = validation.map((v:any)=>v.compound_name)
                      const newEntries = compounds
                        .filter((c:string)=>!existing.includes(c))
                        .map((c:string)=>({compound_name:c,lod:'',loq:'',r2:'',cv_percent:'',accuracy_percent:'',notes:''}))
                      setValidation([...validation,...newEntries])
                    }} style={{padding:'0.3rem 0.8rem',border:'1px solid rgba(56,189,248,0.35)',borderRadius:'0.4rem',background:'rgba(255,255,255,0.03)',color:'#38bdf8',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Auto-fill from MRM
                    </button>
                    <button onClick={()=>setValidation([...validation,{compound_name:'',lod:'',loq:'',r2:'',cv_percent:'',accuracy_percent:'',notes:''}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'0.4rem',background:'rgba(255,255,255,0.03)',color:'#94a3b8',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Add Row
                    </button>
                  </div>
                </div>
              </>}

              {editTab==='sample' && <>
                <div>
                  <label style={LS}>Method</label>
                <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:'10px',
                  padding:'10px 14px',background:'rgba(251,191,36,0.15)',borderRadius:'8px',
                  border:'0.5px solid #fcd34d',marginBottom:'4px'}}>
                  <input type="checkbox" id="is_derivatized"
                    checked={!!ef.is_derivatized}
                    onChange={e=>u('is_derivatized')(e.target.checked ? 1 : 0)}
                    style={{width:'16px',height:'16px',accentColor:'#fbbf24',cursor:'pointer'}} />
                  <label htmlFor="is_derivatized" style={{fontSize:'13px',fontWeight:'500',
                    color:'#fbbf24',cursor:'pointer'}}>
                    ⚗️ Derivatized method — Q1/Q3 values correspond to the derivative, not the native compound
                  </label>
                </div>
                  <select style={IS} value={ef.sample_prep_method||''} onChange={e=>u('sample_prep_method')(e.target.value)}>
                    <option value="">-- Select method --</option>
                    {['Protein Precipitation (PPT)','Liquid-Liquid Extraction (LLE)','Solid Phase Extraction (SPE)',
                      'Dilute and Shoot','Enzymatic Hydrolysis','Derivatization','Other'].map(m=>(
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={LS}>Sample Prep Details</label>
                  <textarea rows={6} style={{...IS,resize:'vertical' as const}}
                    value={ef.sample_prep_details||''}
                    onChange={e=>u('sample_prep_details')(e.target.value)}
                    placeholder="Write each step on a new line for best results. E.g.:
Add 300 µL cold ACN to 100 µL serum.
Vortex 30 sec.
Centrifuge at 15,000 rpm for 5 min.
Transfer supernatant to new tube." />
                </div>
              </>}

              {editTab==='notes' && <>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={LS}>Reference / Publication</label>
                  <input style={IS} value={ef.reference||''} onChange={e=>u('reference')(e.target.value)} placeholder="DOI or journal reference" />
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={LS}>Notes</label>
                  <textarea rows={5} style={{...IS,resize:'vertical' as const}}
                    value={ef.notes||''} onChange={e=>u('notes')(e.target.value)} />
                </div>
              </>}

              </div>
            </div>

            {/* Modal Footer */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'1rem 1.5rem',borderTop:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.04)'}}>
              <button onClick={()=>onClose()}
                style={{padding:'0.5rem 1rem',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'0.5rem',
                  background:'rgba(255,255,255,0.03)',color:'#94a3b8',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{background:'#38bdf8',color:'#03131f',padding:'0.5rem 1rem',borderRadius:'0.5rem',fontWeight:600,fontSize:'0.875rem',cursor:'pointer',border:'none'}}>
                {saving ? 'Saving...' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
    </div>
  )
}
