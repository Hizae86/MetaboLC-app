import { motion } from 'framer-motion'
import { Pencil, CheckCircle, Circle, Download, FileText, FileCode, FileSpreadsheet, Trash2, Hospital, Package } from 'lucide-react'
import ChromatogramChart from '../components/ChromatogramChart'
import React, { useState, useEffect } from 'react'
import StarButton from '../components/StarButton'
import ConfirmationsPanel from '../components/ConfirmationsPanel'
import SimilarMethods from '../components/SimilarMethods'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import ShareCiteButton from '../components/ShareCiteButton'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import ChromatographyView from '../components/ChromatographyView'
import MRMView from '../components/MRMView'
import ValidationView from '../components/ValidationView'
import ValidationEditor from '../components/ValidationEditor'
import MRMEditor from '../components/MRMEditor'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'


const INSTRUMENTS: Record<string, string[]> = {
  'Sciex': [
    'QTRAP 3200', 'Citrine Triple Quad', 'Triple Quad 3500', 'Triple Quad 4500', 'Triple Quad 4500MD',
    'Triple Quad 5500', 'Triple Quad 5500+', 'Triple Quad 6500',
    'Triple Quad 6500+', 'Triple Quad 7500',
    'QTRAP 4500', 'QTRAP 5500', 'QTRAP 6500+',
    'ZenoTOF 7600', 'Other'
  ],
  'Waters': [
    'Xevo TQ-S', 'Xevo TQ-S micro', 'Xevo TQ-Absolute', 'Xevo TQ-XS',
    'Xevo TQD', 'Quattro Premier XE', 'Quattro Micro',
    'Xevo G3 Q-TOF', 'SELECT SERIES MRT', 'SYNAPT XS', 'Other'
  ],
  'Thermo Fisher': [
    'TSQ Vantage', 'TSQ Quantis', 'TSQ Quantis Plus', 'TSQ Altis', 'TSQ Altis Plus',
    'TSQ Fortis', 'TSQ Endura', 'TSQ Quantiva',
    'Q Exactive', 'Q Exactive Plus', 'Q Exactive HF',
    'Orbitrap Exploris 120', 'Orbitrap Exploris 240', 'Orbitrap Exploris 480',
    'Orbitrap Astral', 'Orbitrap Fusion Lumos', 'Other'
  ],
  'Agilent': [
    '6410', '6420', '6430', '6460', '6470', '6475', '6490', '6495C', '6495D',
    '6545', '6546', '6560 Ion Mobility Q-TOF', 'Other'
  ],
  'Shimadzu': [
    'LCMS-8040', 'LCMS-8045', 'LCMS-8050', 'LCMS-8060', 'LCMS-8060NX',
    'LCMS-8090', 'LCMS-9030', 'LCMS-9050', 'Other'
  ],
  'Bruker': [
    'EVOQ Triple Quad', 'EVOQ Cube', 'EVOQ Elite',
    'timsTOF', 'timsTOF Pro', 'timsTOF Pro 2', 'timsTOF HT',
    'timsTOF Flex', 'impact II', 'Other'
  ],
  'Other': ['Other']
}

const MANUFACTURERS = ['Sciex', 'Waters', 'Thermo Fisher', 'Agilent', 'Shimadzu', 'Bruker', 'Other']

const MS_SOURCE_PARAMS: Record<string, {label: string, field: string, unit: string}[]> = {
  'Sciex': [
    {label: 'IonSpray Voltage ESI+ (IS+)', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'IonSpray Voltage ESI- (IS-)', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'IonSpray Voltage (IS)', field: 'ion_spray_voltage', unit: 'V'},
    {label: 'Curtain Gas (CUR)', field: 'curtain_gas', unit: 'psi'},
    {label: 'Collision Gas (CAD)', field: 'collision_gas', unit: ''},
    {label: 'Source Temp (TEM)', field: 'source_temperature_c', unit: '°C'},
    {label: 'Ion Source Gas 1 (GS1)', field: 'gas1', unit: 'psi'},
    {label: 'Ion Source Gas 2 (GS2)', field: 'gas2', unit: 'psi'},
  ],
  'Waters': [
    {label: 'Capillary Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'kV'},
    {label: 'Capillary Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'kV'},
    {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'kV'},
    {label: 'Desolvation Temperature', field: 'desolvation_temperature_c', unit: '°C'},
    {label: 'Desolvation Gas', field: 'desolvation_gas_flow_lh', unit: 'L/h'},
    {label: 'Cone Gas', field: 'cone_gas_flow_lh', unit: 'L/h'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
  ],
  'Shimadzu': [
    {label: 'Interface Voltage', field: 'interface_voltage_kv', unit: 'kV'},
    {label: 'Heating Gas', field: 'heating_gas_flow', unit: 'L/min'},
    {label: 'DL Temperature', field: 'dl_temperature', unit: '°C'},
    {label: 'Interface Temperature', field: 'interface_temperature', unit: '°C'},
    {label: 'Nebulizing Gas', field: 'nebulizing_gas', unit: 'L/min'},
    {label: 'Drying Gas', field: 'drying_gas', unit: 'L/min'},
    {label: 'Heat Block', field: 'heat_block_temperature', unit: '°C'},
  ],
  'Agilent': [
    {label: 'Capillary Voltage ESI+', field: 'capillary_voltage_pos_v', unit: 'V'},
    {label: 'Capillary Voltage ESI-', field: 'capillary_voltage_neg_v', unit: 'V'},
    {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'V'},
    {label: 'Gas Temperature', field: 'gas_temperature', unit: '°C'},
    {label: 'Gas Flow', field: 'gas_flow_lmin', unit: 'L/min'},
    {label: 'Nebulizer Pressure', field: 'nebulizer_pressure_psi', unit: 'psi'},
    {label: 'Sheath Gas Heater', field: 'sheath_gas_heater_c', unit: '°C'},
    {label: 'Sheath Gas Flow', field: 'sheath_gas_flow_lmin', unit: 'L/min'},
    {label: 'Nozzle Voltage', field: 'nozzle_voltage_v', unit: 'V'},
  ],
  'Thermo Fisher': [
    {label: 'Spray Voltage ESI+ (kV)', field: 'capillary_voltage_pos_v', unit: 'kV'},
    {label: 'Spray Voltage ESI- (kV)', field: 'capillary_voltage_neg_v', unit: 'kV'},
    {label: 'Spray Voltage (kV)', field: 'capillary_voltage_v', unit: 'kV'},
    {label: 'Sheath Gas Flow', field: 'sheath_gas_flow_lmin', unit: 'Arb'},
    {label: 'Aux Gas Flow', field: 'aux_gas_flow', unit: 'Arb'},
    {label: 'Sweep Gas Flow', field: 'sweep_gas_flow', unit: 'Arb'},
    {label: 'Ion Transfer Tube Temp', field: 'ion_transfer_tube_temp_c', unit: '°C'},
    {label: 'Vaporizer Temp', field: 'vaporizer_temp_c', unit: '°C'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
    {label: 'Desolvation Temperature', field: 'desolvation_temperature_c', unit: '°C'},
  ],
  'Bruker': [
    {label: 'Capillary Voltage', field: 'capillary_voltage_v', unit: 'V'},
    {label: 'Source Temperature', field: 'source_temperature_c', unit: '°C'},
  ],
}

const MFR_PARAMS: Record<string, {headers: string[], fields: string[]}> = {
  'Sciex':         { headers: ['CE (eV)', 'DP (V)', 'CXP (V)'],           fields: ['collision_energy_ev', 'declustering_potential', 'cell_exit_potential'] },
  'Waters':        { headers: ['CE (eV)', 'Cone (V)'],                     fields: ['collision_energy_ev', 'cone_voltage'] },
  'Agilent':       { headers: ['CE (eV)', 'Frag (V)', 'Cell Acc'],         fields: ['collision_energy_ev', 'declustering_potential', 'cell_accelerator_voltage'] },
  'Shimadzu':      { headers: ['CE (eV)', 'Q1 Bias', 'Q3 Bias'],           fields: ['collision_energy_ev', 'q1_pre_bias', 'q3_pre_bias'] },
  'Thermo Fisher': { headers: ['CE (eV)', 'RF Lens (V)', 'Resolution', 'Max IT (ms)'], fields: ['collision_energy_ev', 'rf_lens_v', 'ms_resolution', 'max_inject_time_ms'] },
  'Bruker':        { headers: ['CE (eV)'],                                 fields: ['collision_energy_ev'] },
  'Other':         { headers: ['CE (eV)', 'DP (V)'],                       fields: ['collision_energy_ev', 'declustering_potential'] },
}

const NR = () => <span style={{color:'#d1d5db',fontSize:'0.7rem'}}>N/R</span>

const val = (v: any) => v !== null && v !== undefined ? v : <NR />

export default function MethodDetail() {
  const { id } = useParams()
  const [method, setMethod] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('chromatography')
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState<any>({})
  const [grad, setGrad] = useState<any[]>([])
  const [trans, setTrans] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [editTab, setEditTab] = useState('basic')
  const [validation, setValidation] = useState<any[]>([])

  useEffect(() => { fetchMethod() }, [id])

  const fetchMethod = () => {
    setLoading(true)
    axios.get(`${API}/methods/${id}`)
      .then(res => {
        setMethod(res.data)
        setEf(res.data)
        setGrad(res.data.gradient_steps || [])
        setTrans(res.data.mrm_transitions || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
    axios.get(`${API}/methods/${id}/validation`)
      .then(res => {
        const data = res.data.map((v: any) => ({
          ...v,
          lod: v.lod_na ? 'N/A' : v.lod,
          loq: v.loq_na ? 'N/A' : v.loq,
          r2: v.r2_na ? 'N/A' : v.r2,
          cv_percent: v.cv_percent_na ? 'N/A' : v.cv_percent,
          accuracy_percent: v.accuracy_percent_na ? 'N/A' : v.accuracy_percent,
        }))
        setValidation(data)
      })
      .catch(() => setValidation([]))
  }

  const u = (field: string) => (val: any) => setEf((prev: any) => ({ ...prev, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert numeric fields
      const numericFields = ['desolvation_gas_flow_lh','cone_gas_flow_lh','interface_voltage_kv',
        'heating_gas_flow','dl_temperature','interface_temperature','nebulizing_gas','drying_gas',
        'heat_block_temperature','ion_spray_voltage','gas1','gas2','gas_temperature',
        'gas_flow_lmin','nebulizer_pressure_psi','capillary_voltage_v','source_temperature_c',
        'desolvation_temperature_c','curtain_gas','column_length_mm','column_diameter_mm',
        'column_particle_size_um','column_temperature_c','injection_volume_ul',
        'lloq','uloq','cv_intra_percent','cv_inter_percent','recovery_percent']
      const cleanEf = {...ef}
      numericFields.forEach(f => {
        if (cleanEf[f] !== undefined && cleanEf[f] !== '') {
          cleanEf[f] = parseFloat(cleanEf[f]) || null
        }
      })
      await axios.put(`${API}/methods/${id}`, { ...cleanEf, gradient_steps: [], mrm_transitions: [] })

      const cleanGrad = grad
        .filter(s => s.time_min !== '' && s.percent_b !== '')
        .map(s => ({
          time_min: parseFloat(s.time_min),
          percent_b: parseFloat(s.percent_b),
          flow_rate_ml_min: s.flow_rate_ml_min ? parseFloat(s.flow_rate_ml_min) : null,
          curve: s.curve || 'linear'
        }))
      await axios.put(`${API}/methods/${id}/gradient`, { steps: cleanGrad })

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
        }))
      await axios.put(`${API}/methods/${id}/transitions`, { transitions: cleanTrans })
      await axios.put(`${API}/methods/${id}/validation`, { items: validation.filter((v:any)=>v.compound_name) })

      await fetchMethod()
      setEditing(false)
    } catch(err) {
      console.error(err)
      alert('Error saving.')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this method? This cannot be undone.')) return
    try {
      await axios.delete(`${API}/methods/${id}`)
      window.location.href = '/'
    } catch(err) {
      alert('Error deleting method.')
    }
  }

  const handleVerify = async () => {
    try {
      const res = await axios.put(`${API}/methods/${id}/verify`)
      setMethod((prev: any) => ({...prev, status: res.data.status,
        verified_by: res.data.verified_by, verified_at: res.data.verified_at}))
    } catch(err) { console.error(err) }
  }

  const exportMRM = async () => {
    const res = await axios.get(`${API}/methods/${id}/export-mrm`)
    const blob = new Blob([res.data.content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = res.data.filename; a.click()
  }

  if (loading) return <div style={{textAlign:'center',padding:'4rem',color:'#6b7280'}}>Loading...</div>
  if (!method) return <div style={{textAlign:'center',padding:'4rem',color:'#6b7280'}}>Method not found.</div>

  const mfrParams = MFR_PARAMS[method.instrument_manufacturer] || MFR_PARAMS['Other']

  const tabs = [
    {id:'chromatography', label:'Chromatography'},

    {id:'mrm', label:`MRM (${method.mrm_transitions.length} transitions)`},
    {id:'ms', label:'MS Source'},
    {id:'validation', label:'Validation Parameters'},
    {id:'sample_prep', label:'Sample Prep'},
  ]

  const F = ({label, value}: any) => !value ? null : (
    <div>
      <p style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.2rem'}}>{label}</p>
      <p style={{fontSize:'0.875rem',fontWeight:'500',color:'#111827'}}>{value}</p>
    </div>
  )

  const IS = {width:'100%',padding:'0.4rem 0.6rem',border:'1px solid #d1d5db',
    borderRadius:'0.4rem',fontSize:'0.85rem',boxSizing:'border-box' as const}
  const LS = {display:'block',fontSize:'0.8rem',fontWeight:'500' as const,color:'#374151',marginBottom:'0.25rem'}
  const SS = {gridColumn:'1/-1' as const,borderBottom:'1px solid #e5e7eb',paddingBottom:'0.5rem',marginTop:'0.75rem',marginBottom:'0.25rem'}

  const mfrEditFields = () => {
    const mfr = ef.instrument_manufacturer || method.instrument_manufacturer
    if (mfr === 'Sciex') return (
      <>
        <div><label style={LS}>DP (V)</label><input type="number" style={{...IS,fontSize:'0.75rem'}} value={trans[0]?.declustering_potential||''} placeholder="80" onChange={()=>{}} disabled /></div>
        <div><label style={LS}>CXP (V)</label><input type="number" style={{...IS,fontSize:'0.75rem'}} value={trans[0]?.cell_exit_potential||''} placeholder="12" onChange={()=>{}} disabled /></div>
      </>
    )
    return null
  }

  return (
    <div style={{maxWidth:'900px',margin:'0 auto'}}>
      <Link to="/" style={{color:'#1d4ed8',fontSize:'0.875rem',textDecoration:'none',display:'block',marginBottom:'1.5rem'}}>
        ← Back to repository
      </Link>

      {/* Header redesigned */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{background:'white',border:'1px solid #e5e7eb',borderRadius:'16px',
          padding:'1.5rem',marginBottom:'12px',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {/* Badges row */}
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
            {(() => {
              const MS: Record<string,{bg:string,color:string}> = {
                plasma:{bg:'#fee2e2',color:'#b91c1c'},serum:{bg:'#ffedd5',color:'#c2410c'},
                urine:{bg:'#fef9c3',color:'#a16207'},'whole blood':{bg:'#fecaca',color:'#991b1b'},
                'dried blood spot':{bg:'#fce7f3',color:'#9d174d'},CSF:{bg:'#dbeafe',color:'#1e40af'},
                saliva:{bg:'#dcfce7',color:'#15803d'},tissue:{bg:'#f3e8ff',color:'#6b21a8'},other:{bg:'#f3f4f6',color:'#374151'}
              }
              const ms = MS[method.matrix?.toLowerCase()] || MS.other
              return <span style={{fontSize:'11px',fontWeight:'600',padding:'3px 10px',borderRadius:'20px',
                background:ms.bg,color:ms.color}}>{method.matrix}</span>
            })()}
            <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'20px',
              background:'#f1f5f9',color:'#475569',fontFamily:'monospace',fontWeight:'500'}}>
              {method.ionization_mode?.split('/')[0] || 'ESI+'}
            </span>
            {method.clinical_application && (
              <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'20px',
                background:'#E1F5EE',color:'#085041',border:'0.5px solid #5DCAA5'}}>
                {method.clinical_application}
              </span>
            )}
            {method.status==='verified' && (
              <span className="flex items-center gap-1" style={{fontSize:'11px',fontWeight:'500',padding:'3px 10px',borderRadius:'20px',
                background:'#EAF3DE',color:'#27500A',border:'0.5px solid #97C459'}}>
                <CheckCircle size={11} /> Verified
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <StarButton methodId={method.id} size="sm" />
              <ShareCiteButton method={method} />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 style={{fontSize:'26px',fontWeight:'700',color:'#0f172a',marginBottom:'6px',letterSpacing:'-0.03em',lineHeight:'1.2'}}>
              {method.analyte}
            </h1>
            <p style={{fontSize:'13px',color:'#64748b',marginBottom:'10px',lineHeight:'1.5'}}>
              {method.title}
            </p>
            <div style={{display:'flex',gap:'16px',fontSize:'12px',color:'#94a3b8',flexWrap:'wrap'}}>
              <span style={{display:'flex',alignItems:'center',gap:'5px',color:'#64748b'}}>
                <Package size={13} />
                {method.instrument_manufacturer} {method.instrument_model}
              </span>
              {method.laboratory && (
                <span style={{display:'flex',alignItems:'center',gap:'4px',color:'#64748b'}}>
                  <Hospital size={13} /> {method.laboratory}{method.country && `, ${method.country}`}
                </span>
              )}
              {method.analyte_cas && <span style={{color:'#94a3b8'}}>CAS: {method.analyte_cas}</span>}
            </div>
          </div>

          {/* Action buttons — horizontal row */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
            <button onClick={() => { setEf(method); setGrad([...method.gradient_steps]); setTrans([...method.mrm_transitions]); setEditing(true); setEditTab('basic') }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-all">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={handleVerify}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all
                ${method.status==='verified' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {method.status==='verified' ? <><CheckCircle size={12} /> Verified</> : <><Circle size={12} /> Mark verified</>}
            </button>
            {method.mrm_transitions.length > 0 && (
              <button onClick={exportMRM}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all">
                <Download size={12} /> Export MRM
              </button>
            )}
            <a href={`/method/${id}/sop`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all no-underline">
              <FileText size={12} /> Validation SOP
            </a>
            {method.instrument_manufacturer === 'Sciex' && (
              <a href={`http://127.0.0.1:8000/api/methods/${id}/export/analyst`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all no-underline"
                download>
                <FileCode size={12} /> .qmf (Analyst)
              </a>
            )}
            {method.instrument_manufacturer === 'Waters' && (
              <a href={`http://127.0.0.1:8000/api/methods/${id}/export/masslynx`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all no-underline"
                download>
                <FileSpreadsheet size={12} /> .csv (MassLynx)
              </a>
            )}
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all ml-auto">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </motion.div>

      {/* Download block */}
      <div style={{border:'1px solid #f1f5f9',borderRadius:'12px',padding:'0.875rem 1.25rem',
        background:'#fafafa',marginBottom:'10px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexWrap:'wrap'}}>
          <div style={{flex:1}}>
            <p style={{fontSize:'11px',fontWeight:'500',color:'#64748b',marginBottom:'3px'}}>
              ⬇ Download method package
            </p>
            <p style={{fontSize:'11px',color:'#94a3b8',marginBottom:'8px'}}>
              Native acquisition files + SOP + parameter tables
            </p>
            <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
              {['Analyst 1.7','MultiQuant 3.0','MassLynx 4.2','Xcalibur 4.3','LabSolutions'].map(sw => (
                <span key={sw} style={{fontSize:'10px',fontWeight:'500',padding:'2px 8px',
                  borderRadius:'6px',background:'rgba(255,255,255,0.6)',color:'#0C447C',
                  border:'0.5px solid #85B7EB'}}>{sw}</span>
              ))}
            </div>
          </div>
          <button style={{display:'flex',alignItems:'center',gap:'5px',padding:'8px 14px',
            background:'#1e3a5f',color:'white',border:'none',borderRadius:'8px',
            fontSize:'12px',fontWeight:'500',cursor:'pointer',flexShrink:0}}>
            📦 Download .zip
          </button>
        </div>
        <div style={{marginTop:'8px',padding:'6px 10px',background:'rgba(255,255,255,0.5)',
          borderRadius:'6px',fontSize:'10px',color:'#185FA5'}}>
          ℹ Beta: parameters available as text. Native files pending peer review.
        </div>
      </div>

      <div className="border-b border-slate-200 mb-6 flex overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab==='chromatography' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
            <h2 style={{fontWeight:'600'}}>Chromatographic Conditions</h2>
            <button onClick={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true);setEditTab('chromatography')}}
              style={{fontSize:'0.8rem',color:'#1d4ed8',background:'none',border:'1px solid #1d4ed8',
                borderRadius:'0.4rem',padding:'0.3rem 0.75rem',cursor:'pointer'}}>
              Edit
            </button>
          </div>
          <ChromatographyView method={method} />
        </div>
      )}

            {activeTab==='chromatography' && method && (
        <SimilarMethods
          methodId={method.id}
          analyte={method.analyte || ''}
          matrix={method.matrix || ''}
        />
      )}

      {activeTab==='mrm' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
            <h2 style={{fontWeight:'600'}}>MRM Transitions</h2>
            <button onClick={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true);setEditTab('mrm')}}
              style={{fontSize:'0.8rem',color:'#1d4ed8',background:'none',border:'1px solid #1d4ed8',
                borderRadius:'0.4rem',padding:'0.3rem 0.75rem',cursor:'pointer'}}>
              Edit
            </button>
          </div>
          <MRMView method={method} onExport={exportMRM} />
        </div>
      )}

      {activeTab==='ms' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
            <h2 style={{fontWeight:'600'}}>MS Source Parameters</h2>
            <span style={{fontSize:'0.75rem',color:'#6b7280',background:'#f3f4f6',
              padding:'0.25rem 0.75rem',borderRadius:'9999px'}}>
              {method.instrument_manufacturer}
            </span>
          </div>
          {(() => {
            const params = MS_SOURCE_PARAMS[method.instrument_manufacturer] || [
              {label:'Capillary Voltage', field:'capillary_voltage_v', unit:'V'},
              {label:'Source Temperature', field:'source_temperature_c', unit:'°C'},
            ]
            const hasAny = params.some(p => method[p.field] !== null && method[p.field] !== undefined)
            if (!hasAny) return <button onClick={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true)}} style={{color:'#1d4ed8',fontSize:'0.875rem',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>+ Add MS source parameters</button>
            return (
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem'}}>
                {params.map(p => {
                  const v = method[p.field]
                  if (v === null || v === undefined) return null
                  return (
                    <div key={p.field} style={{background:'#f9fafb',borderRadius:'0.5rem',padding:'0.75rem'}}>
                      <p style={{fontSize:'0.7rem',color:'#6b7280',marginBottom:'0.25rem'}}>{p.label}</p>
                      <p style={{fontSize:'1rem',fontWeight:'700',color:'#1e3a5f'}}>
                        {v} <span style={{fontSize:'0.7rem',fontWeight:'400',color:'#9ca3af'}}>{p.unit}</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab==='validation' && (
        <div className="card">
          <ValidationView
            validation={validation}
            units={ef.validation_units || 'ng/mL'}
            onEdit={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true);setEditTab('validation')}}
          />
        </div>
      )}

      {activeTab==='sample_prep' && (
        <div className="card">
          {!method.sample_prep_method && !method.sample_prep_details
            ? <button onClick={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true);setEditTab('sample')}}
                style={{color:'#1d4ed8',fontSize:'0.875rem',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
                + Add sample preparation details
              </button>
            : <SamplePrepView method={method} onEdit={()=>{setEf(method);setGrad([...method.gradient_steps]);setTrans([...method.mrm_transitions]);setEditing(true);setEditTab('sample')}} />
          }
        </div>
      )}

      {(method.reference || method.notes) && (
        <div className="card" style={{marginTop:'1.5rem'}}>
          {method.reference && <F label="Reference" value={method.reference} />}
          {method.notes && <div style={{marginTop:'0.75rem'}}><F label="Notes" value={method.notes} /></div>}
        </div>
      )}


      <ConfirmationsPanel methodId={Number(id)} />

      {/* Trust & Compliance */}
      <div style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'10px 14px',
        background:'#f9fafb',border:'0.5px solid #e5e7eb',borderRadius:'8px',marginTop:'10px',marginBottom:'8px'}}>
        <span style={{fontSize:'13px',flexShrink:0}}>⚠️</span>
        <p style={{fontSize:'11px',color:'#6b7280',lineHeight:'1.5'}}>
          For research and method development reference only. Clinical use requires local validation
          per ISO 15189 or equivalent accreditation standard. MetaboLC does not guarantee analytical
          performance in your specific laboratory conditions.
        </p>
      </div>

      {/* Feedback button */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'10px 14px',border:'0.5px solid #e5e7eb',borderRadius:'8px',
        background:'white',marginBottom:'10px'}}>
        <div>
          <p style={{fontSize:'12px',fontWeight:'500',color:'#111827',marginBottom:'2px'}}>
            Have you run this method?
          </p>
          <p style={{fontSize:'11px',color:'#6b7280'}}>
            Share your experience — help other labs calibrate their expectations
          </p>
        </div>
        <a href={`mailto:metabolc@lab.com?subject=Feedback method ${method.id}: ${method.analyte}`}
          style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 14px',
            background:'#1e3a5f',color:'white',borderRadius:'8px',
            fontSize:'12px',fontWeight:'500',cursor:'pointer',textDecoration:'none',whiteSpace:'nowrap',flexShrink:0}}>
          💬 Leave a note
        </a>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:50,
          display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'1rem'}}>
          <div style={{background:'white',borderRadius:'1rem',width:'100%',maxWidth:'1000px',margin:'auto',overflow:'hidden'}}>

            {/* Modal Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'1.25rem 1.5rem',borderBottom:'1px solid #e5e7eb',background:'#1e3a5f'}}>
              <h2 style={{fontSize:'1.1rem',fontWeight:'700',color:'white'}}>Edit Method</h2>
              <button onClick={()=>setEditing(false)}
                style={{background:'none',border:'none',fontSize:'1.5rem',cursor:'pointer',color:'white'}}>×</button>
            </div>

            {/* Edit Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid #e5e7eb',background:'#f9fafb',overflowX:'auto'}}>
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
                  borderBottom: editTab===t.id ? '2px solid #1d4ed8' : '2px solid transparent',
                  color: editTab===t.id ? '#1d4ed8' : '#6b7280',
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
                    <thead><tr style={{background:'#f3f4f6'}}>
                      {['Time (min)','%B','Flow (mL/min)','Curve',''].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'0.3rem 0.4rem',fontWeight:'600',color:'#374151',fontSize:'0.75rem'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {grad.map((step,i)=>(
                        <tr key={i}>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="0.0" style={{...IS,fontSize:'0.8rem'}} value={step.time_min||''} onChange={e=>{const s=[...grad];s[i]={...s[i],time_min:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="5" style={{...IS,fontSize:'0.8rem'}} value={step.percent_b||''} onChange={e=>{const s=[...grad];s[i]={...s[i],percent_b:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><input type="number" placeholder="0.4" style={{...IS,fontSize:'0.8rem'}} value={step.flow_rate_ml_min||''} onChange={e=>{const s=[...grad];s[i]={...s[i],flow_rate_ml_min:e.target.value};setGrad(s)}} /></td>
                          <td style={{padding:'0.2rem'}}><select style={{...IS,fontSize:'0.8rem'}} value={step.curve||'linear'} onChange={e=>{const s=[...grad];s[i]={...s[i],curve:e.target.value};setGrad(s)}}><option>linear</option><option>step</option></select></td>
                          <td><button onClick={()=>setGrad(grad.filter((_,idx)=>idx!==i))} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:'1.1rem'}}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={()=>setGrad([...grad,{time_min:'',percent_b:'',flow_rate_ml_min:'',curve:'linear'}])}
                    style={{padding:'0.3rem 0.8rem',border:'1px solid #1d4ed8',borderRadius:'0.4rem',background:'white',color:'#1d4ed8',cursor:'pointer',fontSize:'0.8rem'}}>
                    + Add Step
                  </button>
                </div>
              </>}

              {editTab==='mrm' && <>
                <div style={{gridColumn:'1/-1'}}>
                  <p style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.5rem'}}>
                    {method.instrument_manufacturer} — {mfrParams.headers.join(' · ')}
                  </p>
                                    <MRMEditor
                    trans={trans}
                    setTrans={setTrans}
                    mfrParams={mfrParams}
                    IS={IS}
                  />
                  
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    <button onClick={()=>setTrans([...trans,{compound_name:'',is_internal_standard:0,precursor_mz:'',product_mz:'',is_quantifier:1}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid #1d4ed8',borderRadius:'0.4rem',background:'white',color:'#1d4ed8',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Add Transition
                    </button>
                    <button onClick={()=>setTrans([...trans,{compound_name:'',is_internal_standard:1,precursor_mz:'',product_mz:'',is_quantifier:1}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid #7c3aed',borderRadius:'0.4rem',background:'#f3e8ff',color:'#7c3aed',cursor:'pointer',fontSize:'0.8rem'}}>
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
                  if (mfr === 'Sciex') {
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
              </>}

              {editTab==='validation' && <>
                <div style={{gridColumn:'1/-1'}}>
                  {/* Units selector */}
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'0.75rem',
                    padding:'0.5rem 0.75rem',background:'#f0f9ff',borderRadius:'0.5rem',border:'1px solid #bae6fd'}}>
                    <span style={{fontSize:'0.78rem',fontWeight:'600',color:'#0369a1'}}>LOD/LOQ units:</span>
                    <select style={{fontSize:'0.78rem',padding:'0.2rem 0.4rem',border:'1px solid #d1d5db',borderRadius:'0.3rem'}}
                      value={ef.validation_units||'ng/mL'}
                      onChange={e=>u('validation_units')(e.target.value)}>
                      {['ng/mL','μg/L','nmol/L','pmol/L','pg/mL','μg/mL','mg/L','mmol/L','ng/L','pg/mg'].map(u=>(
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                    <span style={{fontSize:'0.72rem',color:'#6b7280'}}>Applied to all compounds</span>
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
                    }} style={{padding:'0.3rem 0.8rem',border:'1px solid #1d4ed8',borderRadius:'0.4rem',background:'white',color:'#1d4ed8',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Auto-fill from MRM
                    </button>
                    <button onClick={()=>setValidation([...validation,{compound_name:'',lod:'',loq:'',r2:'',cv_percent:'',accuracy_percent:'',notes:''}])}
                      style={{padding:'0.3rem 0.8rem',border:'1px solid #6b7280',borderRadius:'0.4rem',background:'white',color:'#6b7280',cursor:'pointer',fontSize:'0.8rem'}}>
                      + Add Row
                    </button>
                  </div>
                </div>
              </>}

              {editTab==='sample' && <>
                <div>
                  <label style={LS}>Method</label>
                <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:'10px',
                  padding:'10px 14px',background:'#fef3c7',borderRadius:'8px',
                  border:'0.5px solid #fcd34d',marginBottom:'4px'}}>
                  <input type="checkbox" id="is_derivatized"
                    checked={!!ef.is_derivatized}
                    onChange={e=>u('is_derivatized')(e.target.checked ? 1 : 0)}
                    style={{width:'16px',height:'16px',accentColor:'#d97706',cursor:'pointer'}} />
                  <label htmlFor="is_derivatized" style={{fontSize:'13px',fontWeight:'500',
                    color:'#92400e',cursor:'pointer'}}>
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
              padding:'1rem 1.5rem',borderTop:'1px solid #e5e7eb',background:'#f9fafb'}}>
              <button onClick={()=>setEditing(false)}
                style={{padding:'0.5rem 1rem',border:'1px solid #d1d5db',borderRadius:'0.5rem',
                  background:'white',color:'#374151',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SamplePrepView({ method, onEdit }: { method: any, onEdit: () => void }) {
  const parseSteps = (text: string) => {
    if (!text) return []
    const lines = text.split(/\n+/).map((s: string) => s.trim()).filter((s: string) => s.length > 8)
    if (lines.length > 1) return lines.map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
    return text
      .split(/(?<=\.)\s+(?=[A-Z])|(?<=,)\s+(?=the supernatant|the pellet|samples were|reconstitut)/i)
      .map((s: string) => s.replace(/^\d+\.\s*/, '').trim())
      .filter((s: string) => s.length > 8)
  }

  const extractParams = (text: string) => {
    const params: {label: string, type: string}[] = []
    const vol = [...text.matchAll(/(\d+[\s.]?\d*)\s*(µL|mL|uL)/gi)]
    vol.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'vol'}))
    const time = [...text.matchAll(/(\d+[\s.]?\d*)\s*(min|sec|h\b|hours?)/gi)]
    time.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'time'}))
    const speed = [...text.matchAll(/(\d[\d,]*)\s*(rpm|×\s*g|x\s*g|xg)/gi)]
    speed.forEach(m => params.push({label: `${m[1]} ${m[2]}`, type: 'speed'}))
    const temp = [...text.matchAll(/(\d+)\s*°?C|room\s*temp|RT\b/gi)]
    temp.forEach(m => params.push({label: m[0].trim(), type: 'temp'}))
    return params.slice(0, 4)
  }

  const actionWords: Record<string,string> = {
    'pipette':'Pipette','aliquot':'Aliquot','add':'Add','transfer':'Transfer',
    'vortex':'Vortex','centrifuge':'Centrifuge','mix':'Mix','dilute':'Dilute',
    'evaporate':'Evaporate','reconstitute':'Reconstitute','wash':'Wash',
    'load':'Load','elute':'Elute','inject':'Inject','incubate':'Incubate',
    'filter':'Filter','shake':'Shake','dry':'Dry','dissolve':'Dissolve',
    'dispense':'Dispense','cool':'Cool','heat':'Heat','remove':'Remove',
    'collect':'Collect','aspirate':'Aspirate','resuspend':'Resuspend',
    'to':'Step','synthetic':'Prepare','samples':'Process',
  }

  const steps = parseSteps(method.sample_prep_details || '')

  const paramStyle = (type: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      vol:   {background:'#E6F1FB', color:'#0C447C'},
      time:  {background:'#EAF3DE', color:'#27500A'},
      speed: {background:'#FAEEDA', color:'#633806'},
      temp:  {background:'#FCEBEB', color:'#A32D2D'},
    }
    return {
      display:'inline-flex', alignItems:'center', gap:'4px',
      fontSize:'11px', fontWeight:'500', padding:'3px 6px',
      borderRadius:'6px', whiteSpace:'nowrap',
      ...(map[type] || map.vol)
    }
  }

  const MATRIX_COLOR: Record<string,{bg:string,text:string,border:string}> = {
    plasma:            {bg:'#fee2e2', text:'#b91c1c', border:'#fca5a5'},
    serum:             {bg:'#ffedd5', text:'#c2410c', border:'#fdba74'},
    urine:             {bg:'#fef9c3', text:'#a16207', border:'#fde047'},
    'whole blood':     {bg:'#fecaca', text:'#991b1b', border:'#f87171'},
    'dried blood spot':{bg:'#fce7f3', text:'#9d174d', border:'#f9a8d4'},
    CSF:               {bg:'#dbeafe', text:'#1e40af', border:'#93c5fd'},
    saliva:            {bg:'#dcfce7', text:'#15803d', border:'#86efac'},
    tissue:            {bg:'#f3e8ff', text:'#6b21a8', border:'#d8b4fe'},
  }
  const mc = MATRIX_COLOR[method.matrix] || {bg:'#f3f4f6', text:'#374151', border:'#d1d5db'}

  return (
    <div>
      {/* Compact header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <span style={{fontSize:'14px',fontWeight:'500',color:'#111827'}}>Sample preparation</span>
          {method.sample_prep_method && (
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:'#E6F1FB',color:'#0C447C',border:'0.5px solid #85B7EB'}}>
              {method.sample_prep_method}
            </span>
          )}
          {method.matrix && (
            <span style={{fontSize:'11px',fontWeight:'500',padding:'2px 8px',borderRadius:'20px',
              background:mc.bg, color:mc.text, border:`0.5px solid ${mc.border}`}}>
              {method.matrix}
            </span>
          )}
        </div>
        <button onClick={onEdit}
          style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 10px',
            fontSize:'12px',fontWeight:'500',border:'0.5px solid #d1d5db',borderRadius:'6px',
            background:'white',color:'#6b7280',cursor:'pointer'}}>
          Edit
        </button>
      </div>

      {/* Step cards */}
      {steps.length > 0 ? (
        <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
          {steps.map((step: string, i: number) => {
            const firstWord = step.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g,'')
            const action = actionWords[firstWord] || `Step ${i+1}`
            const params = extractParams(step)

            return (
              <div key={i}>
                <div style={{display:'grid',gridTemplateColumns:'28px 1fr auto',
                  border:'0.5px solid #e5e7eb',borderRadius:'10px',overflow:'hidden',
                  background:'white'}}>
                  {/* Step number sidebar */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',
                    background:'#1e3a5f',color:'white',fontSize:'12px',fontWeight:'500',
                    writingMode:'vertical-rl',textOrientation:'mixed',
                    width:'28px',minHeight:'52px'}}>
                    {i+1}
                  </div>
                  {/* Content */}
                  <div style={{padding:'9px 12px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
                    <p style={{fontSize:'13px',fontWeight:'500',color:'#111827',marginBottom:'2px'}}>{action}</p>
                    <p style={{fontSize:'11px',color:'#6b7280',lineHeight:'1.4'}}>{step}</p>
                  </div>
                  {/* Params column */}
                  {params.length > 0 && (
                    <div style={{display:'flex',flexDirection:'column',justifyContent:'center',
                      gap:'4px',padding:'8px 10px',borderLeft:'0.5px solid #e5e7eb',
                      minWidth:'110px',background:'#fafafa'}}>
                      {params.map((p, pi) => (
                        <span key={pi} style={paramStyle(p.type)}>
                          {p.type==='vol' ? '💧' : p.type==='time' ? '⏱' : p.type==='speed' ? '🔄' : '🌡'} {p.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Connector */}
                {i < steps.length - 1 && (
                  <div style={{display:'grid',gridTemplateColumns:'28px 1fr',height:'6px'}}>
                    <div style={{display:'flex',justifyContent:'center'}}>
                      <div style={{width:'1px',height:'100%',background:'#e5e7eb'}} />
                    </div>
                    <div />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : method.sample_prep_details ? (
        <div style={{background:'#f9fafb',borderRadius:'0.5rem',padding:'1rem',
          fontSize:'0.875rem',color:'#374151',whiteSpace:'pre-wrap'}}>
          {method.sample_prep_details}
        </div>
      ) : (
        <button onClick={onEdit}
          style={{color:'#1d4ed8',fontSize:'0.875rem',background:'none',border:'none',
            cursor:'pointer',padding:0,textDecoration:'underline'}}>
          + Add sample preparation details
        </button>
      )}
    </div>
  )
}

function F({ label, value }: { label: string; value: any }) {
  if (!value) return null
  return (
    <div>
      <p style={{fontSize:'0.75rem',color:'#6b7280',marginBottom:'0.2rem'}}>{label}</p>
      <p style={{fontSize:'0.875rem',fontWeight:'500',color:'#111827'}}>{value}</p>
    </div>
  )
}
