import { useState, useEffect } from 'react'
import axios from 'axios'
import { ArrowRight, RefreshCw, Download } from 'lucide-react'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Column {
  length: number
  diameter: number
  particle: number
  flow: number
  injection: number
}

interface GradientStep {
  time: number
  pctB: number
}

const DEFAULT_COL: Column = { length: 150, diameter: 4.6, particle: 5, flow: 1.0, injection: 10 }
const DEFAULT_NEW: Column = { length: 50, diameter: 2.1, particle: 1.7, flow: 0, injection: 0 }

function calcVoidVolume(length: number, diameter: number, particle: number): number {
  // Vm = (π/4) * d² * L * 0.68 (interstitial fraction ~0.68 for packed columns)
  return (Math.PI / 4) * Math.pow(diameter / 10, 2) * (length / 10) * 0.68
}

function calcPressure(flow: number, length: number, diameter: number, particle: number, viscosity = 1.0): number {
  // ΔP = φ * η * u * L / dp² (Kozeny-Carman, simplified)
  const u = flow / (Math.PI * Math.pow(diameter / 20, 2)) // linear velocity cm/s
  const phi = 500 // column resistance factor
  return phi * viscosity * u * (length / 10) / Math.pow(particle / 10000, 2) / 100000 // bar
}

export default function MethodTransfer() {
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [orig, setOrig] = useState<Column>(DEFAULT_COL)
  const [dest, setDest] = useState<Column>(DEFAULT_NEW)
  const [origGrad, setOrigGrad] = useState<GradientStep[]>([
    { time: 0, pctB: 5 },
    { time: 4, pctB: 95 },
    { time: 5, pctB: 95 },
    { time: 5.5, pctB: 5 },
    { time: 7, pctB: 5 },
  ])
  const [maxPressure, setMaxPressure] = useState(200)

  useEffect(() => {
    axios.get(`${API}/methods/all`).then(res => setMethods(res.data))
  }, [])

  // Load method into form
  const loadMethod = (m: any) => {
    setSelectedMethod(m)
    if (m.column_length_mm) setOrig(o => ({ ...o, length: m.column_length_mm }))
    if (m.column_diameter_mm) setOrig(o => ({ ...o, diameter: m.column_diameter_mm }))
    if (m.column_particle_size_um) setOrig(o => ({ ...o, particle: m.column_particle_size_um }))
    if (m.flow_rate_ml_min) setOrig(o => ({ ...o, flow: m.flow_rate_ml_min }))
    if (m.injection_volume_ul) setOrig(o => ({ ...o, injection: m.injection_volume_ul }))
    if (m.gradient_steps?.length > 0) {
      setOrigGrad(m.gradient_steps.map((s: any) => ({
        time: s.time_min,
        pctB: s.percent_b,
      })))
    }
  }

  // Calculate scaled values
  const vmOrig = calcVoidVolume(orig.length, orig.diameter, orig.particle)
  const vmDest = calcVoidVolume(dest.length, dest.diameter, dest.particle)
  const ratio = vmDest / vmOrig

  const scaledFlow = orig.flow > 0
    ? parseFloat((orig.flow * Math.pow(dest.diameter / orig.diameter, 2)).toFixed(3))
    : 0

  const scaledInjection = orig.injection > 0
    ? parseFloat((orig.injection * ratio).toFixed(2))
    : 0

  const scaledGrad = origGrad.map(s => ({
    time: parseFloat((s.time * ratio).toFixed(2)),
    pctB: s.pctB,
  }))

  const origPressure = calcPressure(orig.flow, orig.length, orig.diameter, orig.particle)
  const destPressure = calcPressure(scaledFlow, dest.length, dest.diameter, dest.particle)
  const pressureRatio = destPressure / origPressure

  const origRunTime = origGrad.length > 0 ? origGrad[origGrad.length - 1].time : 0
  const destRunTime = scaledGrad.length > 0 ? scaledGrad[scaledGrad.length - 1].time : 0
  const timeSaving = origRunTime > 0 ? ((origRunTime - destRunTime) / origRunTime * 100) : 0

  const origSolvent = orig.flow * origRunTime
  const destSolvent = scaledFlow * destRunTime
  const solventSaving = origSolvent > 0 ? ((origSolvent - destSolvent) / origSolvent * 100) : 0

  const ColInput = ({ label, val, onChange, unit }: any) => (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" value={val}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
        <span className="text-xs text-slate-400 shrink-0">{unit}</span>
      </div>
    </div>
  )

  const exportResults = () => {
    const lines = [
      'MetaboLC — LC Method Transfer Calculator',
      '==========================================',
      '',
      'ORIGINAL COLUMN',
      `Length: ${orig.length} mm | Diameter: ${orig.diameter} mm | Particle: ${orig.particle} µm`,
      `Flow: ${orig.flow} mL/min | Injection: ${orig.injection} µL`,
      '',
      'DESTINATION COLUMN',
      `Length: ${dest.length} mm | Diameter: ${dest.diameter} mm | Particle: ${dest.particle} µm`,
      `Scaled Flow: ${scaledFlow} mL/min | Scaled Injection: ${scaledInjection} µL`,
      '',
      'SCALED GRADIENT',
      'Time (min)\t%B',
      ...scaledGrad.map(s => `${s.time}\t${s.pctB}`),
      '',
      'SAVINGS',
      `Time saving: ${timeSaving.toFixed(1)}%`,
      `Solvent saving: ${solventSaving.toFixed(1)}%`,
      `Estimated pressure: ${destPressure.toFixed(0)} bar`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'method_transfer.txt'
    a.click()
  }

  return (
    <div style={{maxWidth:'1100px', margin:'0 auto', padding:'1.5rem'}}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1">
          LC Method Transfer Calculator
        </h1>
        <p className="text-xs text-slate-400">
          Scale HPLC methods to UHPLC conditions — gradient, flow rate, injection volume and pressure
        </p>
      </div>

      {/* Load from repository */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-indigo-700 mb-2">
          Load from MetaboLC repository
        </p>
        <select
          onChange={e => {
            const m = methods.find(x => x.id === parseInt(e.target.value))
            if (m) loadMethod(m)
          }}
          className="w-full text-sm px-3 py-2 border border-indigo-200 rounded-lg
            bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800">
          <option value="">Select a method to pre-fill parameters…</option>
          {methods
            .filter(m => m.column_length_mm && m.gradient_steps?.length > 0)
            .map(m => (
              <option key={m.id} value={m.id}>
                {m.analyte?.slice(0, 40)} — {m.instrument_manufacturer} {m.column_name || ''}
              </option>
            ))}
        </select>
        {selectedMethod && (
          <p className="text-xs text-indigo-600 mt-2">
            ✓ Loaded: {selectedMethod.title?.slice(0, 60)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Original column */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center">A</span>
            Original Column
          </h2>
          <div className="space-y-3">
            <ColInput label="Length" val={orig.length} onChange={(v: number) => setOrig(o => ({...o, length: v}))} unit="mm" />
            <ColInput label="Diameter" val={orig.diameter} onChange={(v: number) => setOrig(o => ({...o, diameter: v}))} unit="mm" />
            <ColInput label="Particle size" val={orig.particle} onChange={(v: number) => setOrig(o => ({...o, particle: v}))} unit="µm" />
            <ColInput label="Flow rate" val={orig.flow} onChange={(v: number) => setOrig(o => ({...o, flow: v}))} unit="mL/min" />
            <ColInput label="Injection volume" val={orig.injection} onChange={(v: number) => setOrig(o => ({...o, injection: v}))} unit="µL" />
            <ColInput label="Max pressure" val={maxPressure} onChange={setMaxPressure} unit="bar" />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Void volume: <span className="font-mono text-slate-700">{vmOrig.toFixed(3)} mL</span></p>
            <p className="text-xs text-slate-400">Est. pressure: <span className="font-mono text-slate-700">{origPressure.toFixed(0)} bar</span></p>
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <ArrowRight size={28} className="text-indigo-400" />
            <div className="text-center space-y-2">
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-xs text-green-600 font-medium">Time saving</p>
                <p className="text-2xl font-bold text-green-700 font-mono">{timeSaving.toFixed(0)}%</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-600 font-medium">Solvent saving</p>
                <p className="text-2xl font-bold text-blue-700 font-mono">{solventSaving.toFixed(0)}%</p>
              </div>
              <div className={`border rounded-xl px-4 py-3 ${destPressure > maxPressure ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs text-slate-500 font-medium">Pressure ratio</p>
                <p className={`text-xl font-bold font-mono ${destPressure > maxPressure ? 'text-red-600' : 'text-slate-700'}`}>
                  {pressureRatio.toFixed(1)}×
                </p>
                {destPressure > maxPressure && (
                  <p className="text-xs text-red-500 mt-1">⚠ Exceeds limit</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Destination column */}
        <div className="bg-white border border-indigo-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">B</span>
            Destination Column
          </h2>
          <div className="space-y-3">
            <ColInput label="Length" val={dest.length} onChange={(v: number) => setDest(d => ({...d, length: v}))} unit="mm" />
            <ColInput label="Diameter" val={dest.diameter} onChange={(v: number) => setDest(d => ({...d, diameter: v}))} unit="mm" />
            <ColInput label="Particle size" val={dest.particle} onChange={(v: number) => setDest(d => ({...d, particle: v}))} unit="µm" />
            <div className="bg-indigo-50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-slate-500">Scaled flow rate</p>
              <p className="text-lg font-bold font-mono text-indigo-700">{scaledFlow} <span className="text-xs font-normal">mL/min</span></p>
              <p className="text-xs text-slate-500 mt-2">Scaled injection volume</p>
              <p className="text-lg font-bold font-mono text-indigo-700">{scaledInjection} <span className="text-xs font-normal">µL</span></p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Void volume: <span className="font-mono text-slate-700">{vmDest.toFixed(3)} mL</span></p>
            <p className="text-xs text-slate-400">Est. pressure: <span className={`font-mono ${destPressure > maxPressure ? 'text-red-600 font-semibold' : 'text-slate-700'}`}>{destPressure.toFixed(0)} bar</span></p>
          </div>
        </div>
      </div>

      {/* Gradient tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

        {/* Original gradient */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Original Gradient</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-slate-400 font-medium">Step</th>
                <th className="text-left py-2 text-slate-400 font-medium">Time (min)</th>
                <th className="text-left py-2 text-slate-400 font-medium">%B</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {origGrad.map((s, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-400">{i + 1}</td>
                  <td className="py-1.5">
                    <input type="number" value={s.time}
                      onChange={e => {
                        const g = [...origGrad]
                        g[i] = {...g[i], time: parseFloat(e.target.value) || 0}
                        setOrigGrad(g)
                      }}
                      className="w-20 px-2 py-1 border border-slate-200 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </td>
                  <td className="py-1.5">
                    <input type="number" value={s.pctB}
                      onChange={e => {
                        const g = [...origGrad]
                        g[i] = {...g[i], pctB: parseFloat(e.target.value) || 0}
                        setOrigGrad(g)
                      }}
                      className="w-20 px-2 py-1 border border-slate-200 rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </td>
                  <td className="py-1.5">
                    <button onClick={() => setOrigGrad(origGrad.filter((_, j) => j !== i))}
                      className="text-slate-300 hover:text-red-400 transition-colors">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setOrigGrad([...origGrad, { time: 0, pctB: 0 }])}
            className="mt-3 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
            + Add step
          </button>
        </div>

        {/* Scaled gradient */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center justify-between">
            Scaled Gradient
            <button onClick={exportResults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                bg-white border border-indigo-200 rounded-lg text-indigo-600
                hover:bg-indigo-100 transition-all">
              <Download size={12} /> Export
            </button>
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-indigo-200">
                <th className="text-left py-2 text-slate-400 font-medium">Step</th>
                <th className="text-left py-2 text-slate-400 font-medium">Time (min)</th>
                <th className="text-left py-2 text-slate-400 font-medium">%B</th>
                <th className="text-left py-2 text-slate-400 font-medium">Δ time</th>
              </tr>
            </thead>
            <tbody>
              {scaledGrad.map((s, i) => (
                <tr key={i} className="border-b border-indigo-100">
                  <td className="py-2 text-slate-400">{i + 1}</td>
                  <td className="py-2 font-mono font-semibold text-indigo-700">{s.time}</td>
                  <td className="py-2 font-mono text-slate-700">{s.pctB}%</td>
                  <td className="py-2 font-mono text-xs text-slate-400">
                    {origGrad[i] ? `${(s.time - origGrad[i].time).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-3 border-t border-indigo-200 space-y-1">
            <p className="text-xs text-slate-500">
              Run time: <span className="font-mono font-semibold text-indigo-700">{origRunTime} min</span>
              {' → '}
              <span className="font-mono font-semibold text-green-600">{destRunTime.toFixed(2)} min</span>
            </p>
            <p className="text-xs text-slate-500">
              Solvent: <span className="font-mono text-slate-700">{origSolvent.toFixed(1)} mL</span>
              {' → '}
              <span className="font-mono text-green-600">{destSolvent.toFixed(2)} mL</span>
            </p>
            <p className="text-xs text-slate-500">
              Vm ratio: <span className="font-mono text-slate-700">{ratio.toFixed(3)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 mt-6 text-center">
        Calculations are based on geometric scaling (void volume ratio). 
        Results are estimates — always verify experimentally. 
        Pressure estimates use simplified Kozeny-Carman equation.
      </p>
    </div>
  )
}
