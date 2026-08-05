import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MANUFACTURERS = ['Sciex', 'Waters', 'Thermo Fisher', 'Agilent', 'Shimadzu', 'Bruker', 'Other']
const INSTRUMENTS: Record<string, string[]> = {
  'Sciex': ['Triple Quad 3500', 'Triple Quad 4500MD', 'Triple Quad 5500+', 'Triple Quad 6500+', 'Triple Quad 7500', 'QTRAP 4500', 'QTRAP 5500', 'QTRAP 6500+', 'ZenoTOF 7600'],
  'Waters': ['Xevo TQ-S', 'Xevo TQ-S micro', 'Xevo TQ-Absolute', 'Xevo TQ-XS', 'Quattro Premier XE'],
  'Thermo Fisher': ['TSQ Quantis', 'TSQ Quantis Plus', 'TSQ Altis', 'TSQ Altis Plus', 'TSQ Fortis', 'TSQ Endura'],
  'Agilent': ['6470', '6475', '6490', '6495C', '6495D'],
  'Shimadzu': ['LCMS-8040', 'LCMS-8050', 'LCMS-8060', 'LCMS-8060NX', 'LCMS-8090'],
  'Bruker': ['EVOQ Triple Quad', 'EVOQ Cube', 'EVOQ Elite'],
  'Other': ['Other'],
}

const APPLICATIONS = ['Therapeutic Drug Monitoring', 'Endocrinology', 'Toxicology', 'Newborn screening', 'Oncology', 'Metabolomics', 'Other']
const VALIDATION_LEVELS = [
  {code: 'ISO 15189', desc: 'Accredited clinical lab'},
  {code: 'CE-IVD', desc: 'EU regulatory'},
  {code: 'RUO', desc: 'Research use only'},
  {code: 'In development', desc: 'Draft / WIP'},
]
const MATRICES = ['plasma', 'serum', 'urine', 'whole blood', 'dried blood spot', 'CSF', 'saliva', 'tissue', 'other']
const IONIZATION = ['ESI+', 'ESI-', 'ESI+/ESI- (polarity switching 50ms)', 'APCI+', 'APCI-']
const PREP_METHODS = ['Protein Precipitation (PPT)', 'Liquid-Liquid Extraction (LLE)', 'Solid Phase Extraction (SPE)', 'Dilute and Shoot', 'Enzymatic Hydrolysis', 'Derivatization', 'Other']

interface FormData {
  title: string
  analyte: string
  analyte_normalized: string
  matrix: string
  clinical_application: string
  ionization_mode: string
  validation_level: string
  instrument_manufacturer: string
  instrument_model: string
  column_brand: string
  column_name: string
  column_stationary_phase: string
  column_length_mm: string
  column_diameter_mm: string
  column_particle_size_um: string
  column_temperature_c: string
  mobile_phase_a: string
  mobile_phase_b: string
  injection_volume_ul: string
  sample_prep_method: string
  sample_prep_details: string
  lloq: string
  lloq_unit: string
  lloq_unit: string
  uloq: string
  laboratory: string
  country: string
  reference: string
  notes: string
  submitted_by: string
  submitted_by_email: string
}

const empty: FormData = {
  title:'', analyte:'', analyte_normalized:'', matrix:'plasma',
  clinical_application:'', ionization_mode:'ESI+', validation_level:'RUO',
  instrument_manufacturer:'Sciex', instrument_model:'',
  column_brand:'', column_name:'', column_stationary_phase:'',
  column_length_mm:'', column_diameter_mm:'', column_particle_size_um:'',
  column_temperature_c:'', mobile_phase_a:'', mobile_phase_b:'',
  injection_volume_ul:'', sample_prep_method:'', sample_prep_details:'',
  lloq:'', lloq_unit:'ng/mL', uloq:'', laboratory:'', country:'', reference:'', notes:'',
  submitted_by:'', submitted_by_email:'',
}

const IS = {
  width:'100%', padding:'7px 10px',
  border:'0.5px solid #d1d5db', borderRadius:'6px',
  fontSize:'12px', background:'white', color:'#111827',
  fontFamily:'inherit',
} as React.CSSProperties

const LS = {
  display:'block', fontSize:'11px', fontWeight:'500' as const,
  color:'#6b7280', marginBottom:'4px',
}

export default function SubmitMethod() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(empty)
  const [selectedApps, setSelectedApps] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  const u = (field: keyof FormData) => (e: any) =>
    setForm(prev => ({...prev, [field]: e.target.value}))

  const toggleApp = (app: string) =>
    setSelectedApps(prev => prev.includes(app) ? prev.filter(a => a!==app) : [...prev, app])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        clinical_application: selectedApps.join(', '),
        column_length_mm: form.column_length_mm ? parseFloat(form.column_length_mm) : null,
        column_diameter_mm: form.column_diameter_mm ? parseFloat(form.column_diameter_mm) : null,
        column_particle_size_um: form.column_particle_size_um ? parseFloat(form.column_particle_size_um) : null,
        column_temperature_c: form.column_temperature_c ? parseFloat(form.column_temperature_c) : null,
        injection_volume_ul: form.injection_volume_ul ? parseFloat(form.injection_volume_ul) : null,
        lloq: form.lloq ? parseFloat(form.lloq) : null,
        lloq_unit: form.lloq_unit || 'ng/mL',
        lloq_unit: form.lloq_unit || 'ng/mL',
        uloq: form.uloq ? parseFloat(form.uloq) : null,
        status: 'pending',
        gradient_steps: [],
        mrm_transitions: [],
      }
      await axios.post(`${API}/methods/`, payload)
      setSubmitted(true)
    } catch(err) {
      alert('Error submitting. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const Panel = ({children, title, icon}: any) => (
    <div style={{background:'white',border:'0.5px solid #e5e7eb',borderRadius:'12px',
      padding:'1.25rem',marginBottom:'10px'}}>
      <div style={{fontSize:'11px',fontWeight:'500',textTransform:'uppercase',
        letterSpacing:'0.06em',color:'#9ca3af',marginBottom:'14px',
        display:'flex',alignItems:'center',gap:'6px'}}>
        <i className={`ti ${icon}`} aria-hidden="true" />
        {title}
      </div>
      {children}
    </div>
  )

  const progress = (step / 4) * 100

  const StepCircle = ({n}: {n: number}) => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <div style={{width:'28px',height:'28px',borderRadius:'50%',display:'flex',
        alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'500',
        background: n < step ? '#1e3a5f' : n === step ? '#E6F1FB' : '#f3f4f6',
        color: n < step ? 'white' : n === step ? '#0C447C' : '#9ca3af',
        border: n === step ? '1.5px solid #85B7EB' : 'none'}}>
        {n < step ? <i className="ti ti-check" style={{fontSize:'12px'}} aria-hidden="true" /> : n}
      </div>
      <div style={{fontSize:'10px',fontWeight:'500',marginTop:'3px',
        color: n < step ? '#6b7280' : n === step ? '#0C447C' : '#9ca3af'}}>
        {['','General','Parameters','Files','Attribution'][n]}
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{maxWidth:'600px',margin:'0 auto',textAlign:'center',padding:'4rem 1rem'}}>
      <div style={{width:'56px',height:'56px',borderRadius:'50%',background:'#EAF3DE',
        display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem',
        fontSize:'24px',color:'#27500A'}}>
        <i className="ti ti-check" aria-hidden="true" />
      </div>
      <h1 style={{fontSize:'18px',fontWeight:'500',marginBottom:'8px'}}>Method submitted</h1>
      <p style={{fontSize:'13px',color:'#6b7280',maxWidth:'340px',margin:'0 auto 24px',lineHeight:'1.6'}}>
        Thanks for contributing to MetaboLC. The team will review your method and notify you by email once it's published.
      </p>
      <div style={{display:'flex',gap:'8px',justifyContent:'center'}}>
        <button onClick={() => navigate('/')}
          style={{padding:'8px 16px',background:'#1e3a5f',color:'white',border:'none',
            borderRadius:'8px',fontSize:'12px',fontWeight:'500',cursor:'pointer'}}>
          Back to repository
        </button>
        <button onClick={() => {setSubmitted(false);setStep(1);setForm(empty);setSelectedApps([])}}
          style={{padding:'8px 14px',background:'white',color:'#6b7280',
            border:'0.5px solid #d1d5db',borderRadius:'8px',fontSize:'12px',cursor:'pointer'}}>
          Submit another
        </button>
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:'700px',margin:'0 auto'}}>
      <Link to="/" style={{color:'#1d4ed8',fontSize:'12px',textDecoration:'none',
        display:'inline-flex',alignItems:'center',gap:'4px',marginBottom:'16px'}}>
        <i className="ti ti-arrow-left" style={{fontSize:'13px'}} aria-hidden="true" /> Back to repository
      </Link>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}>
        <span style={{fontSize:'16px',fontWeight:'500'}}>Submit a method</span>
        <span style={{fontSize:'11px',color:'#9ca3af'}}>Step {step} of 4</span>
      </div>

      <div style={{height:'3px',background:'#f3f4f6',borderRadius:'2px',marginBottom:'20px',overflow:'hidden'}}>
        <div style={{height:'100%',background:'#1e3a5f',borderRadius:'2px',
          width:`${progress}%`,transition:'width 0.3s'}} />
      </div>

      <div style={{display:'flex',alignItems:'center',marginBottom:'24px'}}>
        {[1,2,3,4].map(n => (
          <div key={n} style={{display:'flex',alignItems:'center',flex: n<4 ? 1 : 0}}>
            <StepCircle n={n} />
            {n < 4 && (
              <div style={{flex:1,height:'1px',background: n < step ? '#1e3a5f' : '#e5e7eb',
                margin:'0 4px',marginBottom:'16px'}} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          <Panel title="General information" icon="ti-info-circle">
            <div style={{marginBottom:'10px'}}>
              <label style={LS}>Method title <span style={{color:'#E24B4A'}}>*</span></label>
              <input style={IS} value={form.title} onChange={u('title')}
                placeholder="e.g. Simultaneous quantitation of immunosuppressants in whole blood" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={LS}>Analyte / Panel <span style={{color:'#E24B4A'}}>*</span></label>
                <input style={IS} value={form.analyte} onChange={u('analyte')}
                  placeholder="e.g. Tacrolimus, Sirolimus, Everolimus" />
              </div>
              <div>
                <label style={LS}>Short name (normalized)</label>
                <input style={IS} value={form.analyte_normalized} onChange={u('analyte_normalized')}
                  placeholder="e.g. immunosuppressants" />
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={LS}>Matrix <span style={{color:'#E24B4A'}}>*</span></label>
                <select style={IS} value={form.matrix} onChange={u('matrix')}>
                  {MATRICES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Ionization mode</label>
                <select style={IS} value={form.ionization_mode} onChange={u('ionization_mode')}>
                  {IONIZATION.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={LS}>Clinical application</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
                {APPLICATIONS.map(app => (
                  <span key={app} onClick={() => toggleApp(app)}
                    style={{padding:'4px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'500',
                      cursor:'pointer',transition:'all 0.15s',userSelect:'none',
                      background: selectedApps.includes(app) ? '#1e3a5f' : '#f3f4f6',
                      color: selectedApps.includes(app) ? 'white' : '#6b7280',
                      border: `0.5px solid ${selectedApps.includes(app) ? '#1e3a5f' : '#d1d5db'}`}}>
                    {app}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label style={LS}>Validation level</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                {VALIDATION_LEVELS.map(v => (
                  <div key={v.code} onClick={() => setForm(prev => ({...prev, validation_level: v.code}))}
                    style={{padding:'8px',border:`0.5px solid ${form.validation_level===v.code ? '#85B7EB' : '#e5e7eb'}`,
                      borderRadius:'8px',cursor:'pointer',textAlign:'center',
                      background: form.validation_level===v.code ? '#E6F1FB' : '#f9fafb',
                      transition:'all 0.15s'}}>
                    <div style={{fontSize:'11px',fontWeight:'500',color:form.validation_level===v.code ? '#0C447C' : '#374151'}}>{v.code}</div>
                    <div style={{fontSize:'9px',color:'#9ca3af',marginTop:'2px'}}>{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </>
      )}

      {step === 2 && (
        <>
          <Panel title="Instrument and source" icon="ti-microscope">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={LS}>Manufacturer <span style={{color:'#E24B4A'}}>*</span></label>
                <select style={IS} value={form.instrument_manufacturer}
                  onChange={e => setForm(prev => ({...prev, instrument_manufacturer: e.target.value, instrument_model:''}))}>
                  {MANUFACTURERS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>Model <span style={{color:'#E24B4A'}}>*</span></label>
                <select style={IS} value={form.instrument_model} onChange={u('instrument_model')}>
                  <option value="">-- Select model --</option>
                  {(INSTRUMENTS[form.instrument_manufacturer] || []).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <div><label style={LS}>Column brand</label><input style={IS} value={form.column_brand} onChange={u('column_brand')} placeholder="e.g. Waters, Phenomenex" /></div>
              <div><label style={LS}>Column name</label><input style={IS} value={form.column_name} onChange={u('column_name')} placeholder="e.g. Acquity UPLC BEH C18" /></div>
              <div><label style={LS}>Stationary phase</label><input style={IS} value={form.column_stationary_phase} onChange={u('column_stationary_phase')} placeholder="e.g. C18, HILIC" /></div>
              <div><label style={LS}>Column temp (°C)</label><input type="number" style={IS} value={form.column_temperature_c} onChange={u('column_temperature_c')} placeholder="40" /></div>
              <div><label style={LS}>Length (mm)</label><input type="number" style={IS} value={form.column_length_mm} onChange={u('column_length_mm')} placeholder="50" /></div>
              <div><label style={LS}>Diameter (mm)</label><input type="number" style={IS} value={form.column_diameter_mm} onChange={u('column_diameter_mm')} placeholder="2.1" /></div>
              <div><label style={LS}>Particle size (µm)</label><input type="number" style={IS} value={form.column_particle_size_um} onChange={u('column_particle_size_um')} placeholder="1.7" /></div>
              <div><label style={LS}>Injection volume (µL)</label><input type="number" style={IS} value={form.injection_volume_ul} onChange={u('injection_volume_ul')} placeholder="10" /></div>
              <div style={{gridColumn:'1/-1'}}><label style={LS}>Mobile phase A</label><input style={IS} value={form.mobile_phase_a} onChange={u('mobile_phase_a')} placeholder="e.g. Water + 0.1% formic acid" /></div>
              <div style={{gridColumn:'1/-1'}}><label style={LS}>Mobile phase B</label><input style={IS} value={form.mobile_phase_b} onChange={u('mobile_phase_b')} placeholder="e.g. Methanol + 0.1% formic acid" /></div>
            </div>
          </Panel>
          <Panel title="Sample preparation" icon="ti-flask">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div>
                <label style={LS}>Method</label>
                <select style={IS} value={form.sample_prep_method} onChange={u('sample_prep_method')}>
                  <option value="">-- Select --</option>
                  {PREP_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={LS}>LLOQ</label>
                <div style={{display:'flex',gap:'6px'}}>
                  <input type="number" style={{...IS,flex:1}} value={form.lloq} onChange={u('lloq')} placeholder="e.g. 1.0" />
                  <select style={{...IS,width:'90px'}} value={form.lloq_unit} onChange={u('lloq_unit')}>
                    <option>ng/mL</option>
                    <option>pg/mL</option>
                    <option>µg/mL</option>
                    <option>nmol/L</option>
                    <option>pmol/L</option>
                    <option>µmol/L</option>
                    <option>ng/dL</option>
                    <option>µg/dL</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label style={LS}>Step-by-step details</label>
              <textarea rows={4} style={{...IS, resize:'vertical' as const}}
                value={form.sample_prep_details} onChange={u('sample_prep_details')}
                placeholder="Write each step on a new line. Include volumes, speeds, times and temperatures." />
            </div>
          </Panel>
        </>
      )}

      {step === 3 && (
        <Panel title="Files and documentation" icon="ti-files">
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {[
              {label:'Native method file (.meth, .xml, .dam…)', hint:'Analyst .dam · MassLynx .raw · Xcalibur .meth', icon:'ti-file-export'},
              {label:'Application note / SOP (PDF)', hint:'Max 20 MB', icon:'ti-file-type-pdf'},
              {label:'Representative chromatogram (optional)', hint:'PNG, JPG or SVG', icon:'ti-photo'},
            ].map(f => (
              <div key={f.label}>
                <label style={LS}>{f.label}</label>
                <div style={{border:'1.5px dashed #d1d5db',borderRadius:'10px',padding:'20px',
                  textAlign:'center',cursor:'pointer',background:'#f9fafb',transition:'all 0.15s'}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='#85B7EB')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='#d1d5db')}>
                  <i className={`ti ${f.icon}`} style={{fontSize:'24px',color:'#9ca3af',display:'block',marginBottom:'6px'}} aria-hidden="true" />
                  <div style={{fontSize:'12px',color:'#6b7280'}}>Drop file here or click to browse</div>
                  <div style={{fontSize:'10px',color:'#9ca3af',marginTop:'3px'}}>{f.hint}</div>
                </div>
              </div>
            ))}
            <div style={{padding:'8px 12px',background:'#f9fafb',borderRadius:'8px',
              fontSize:'11px',color:'#6b7280',display:'flex',alignItems:'flex-start',gap:'6px'}}>
              <i className="ti ti-info-circle" style={{fontSize:'13px',flexShrink:0,marginTop:'1px'}} aria-hidden="true" />
              <span>Native files are optional during beta. If not available, the method will show text parameters with a "file pending review" badge.</span>
            </div>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <>
          <Panel title="Attribution and credit" icon="ti-user-check">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={LS}>Your name <span style={{color:'#E24B4A'}}>*</span></label><input style={IS} value={form.submitted_by} onChange={u('submitted_by')} placeholder="Dr. Anna Schmidt" /></div>
              <div><label style={LS}>Institution / Laboratory <span style={{color:'#E24B4A'}}>*</span></label><input style={IS} value={form.laboratory} onChange={u('laboratory')} placeholder="University Hospital Basel" /></div>
              <div><label style={LS}>Country</label><input style={IS} value={form.country} onChange={u('country')} placeholder="Switzerland" /></div>
              <div><label style={LS}>Contact email (not public)</label><input type="email" style={IS} value={form.submitted_by_email} onChange={u('submitted_by_email')} placeholder="a.schmidt@unibas.ch" /></div>
            </div>
            <div style={{marginBottom:'10px'}}>
              <label style={LS}>Reference / DOI (optional)</label>
              <input style={IS} value={form.reference} onChange={u('reference')} placeholder="10.1016/j.jchromb.2024.xxxxx or application note number" />
            </div>
            <div>
              <label style={LS}>Notes for reviewers (optional)</label>
              <textarea rows={3} style={{...IS, resize:'vertical' as const}} value={form.notes} onChange={u('notes')} placeholder="Any context the MetaboLC team should know before publishing…" />
            </div>
          </Panel>
          <div style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'10px 14px',
            border:'0.5px solid #86efac',borderRadius:'8px',background:'#f0fdf4',marginBottom:'10px'}}>
            <i className="ti ti-shield-check" style={{fontSize:'15px',color:'#15803d',flexShrink:0,marginTop:'1px'}} aria-hidden="true" />
            <div style={{fontSize:'11px',color:'#15803d'}}>
              Your method will be reviewed by the MetaboLC team before publication. You'll receive an email once it's live. Credit will appear publicly in the method detail page.
            </div>
          </div>
        </>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
        paddingTop:'12px',borderTop:'0.5px solid #e5e7eb'}}>
        <button onClick={() => setStep(s => Math.max(1, s-1))}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'8px 14px',
            background:'white',color:'#6b7280',border:'0.5px solid #d1d5db',
            borderRadius:'8px',fontSize:'12px',cursor:'pointer',
            visibility: step === 1 ? 'hidden' : 'visible'}}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Back
        </button>
        {step < 4
          ? <button onClick={() => setStep(s => s+1)}
              style={{display:'flex',alignItems:'center',gap:'5px',padding:'8px 16px',
                background:'#1e3a5f',color:'white',border:'none',borderRadius:'8px',
                fontSize:'12px',fontWeight:'500',cursor:'pointer'}}>
              Continue <i className="ti ti-arrow-right" aria-hidden="true" />
            </button>
          : <button onClick={handleSubmit} disabled={submitting}
              style={{display:'flex',alignItems:'center',gap:'5px',padding:'8px 16px',
                background:'#1e3a5f',color:'white',border:'none',borderRadius:'8px',
                fontSize:'12px',fontWeight:'500',cursor:'pointer',
                opacity: submitting ? 0.6 : 1}}>
              <i className="ti ti-send" aria-hidden="true" />
              {submitting ? 'Submitting…' : 'Submit method'}
            </button>
        }
      </div>
    </div>
  )
}
