import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowRight, Download, Plus, X } from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Column { length: number; diameter: number; particle: number; flow: number; injection: number }
interface GradientStep { time: number; pctB: number }

const DEFAULT_COL: Column = { length: 150, diameter: 4.6, particle: 5, flow: 1.0, injection: 10 }
const DEFAULT_NEW: Column = { length: 50, diameter: 2.1, particle: 1.7, flow: 0, injection: 0 }

function calcVoidVolume(length: number, diameter: number, particle: number): number {
  // Vm = (π/4) * d² * L * 0.68 (interstitial fraction ~0.68 for packed columns)
  void particle
  return (Math.PI / 4) * Math.pow(diameter / 10, 2) * (length / 10) * 0.68
}

function calcPressure(flow: number, length: number, diameter: number, particle: number, viscosityCp = 1.0): number {
  // ΔP = φ·η·u·L / dp² (Darcy / simplified Kozeny-Carman), computed in SI.
  if (flow <= 0 || diameter <= 0 || particle <= 0) return 0
  const q = (flow * 1e-6) / 60                       // mL/min → m³/s
  const area = Math.PI * Math.pow((diameter * 1e-3) / 2, 2) // m²
  const u = q / area                                 // superficial velocity, m/s
  const phi = 500                                    // flow resistance factor, porous particles
  const eta = viscosityCp * 1e-3                     // cP → Pa·s
  const dp = particle * 1e-6                         // µm → m
  const pa = (phi * eta * u * (length * 1e-3)) / (dp * dp)
  return pa / 1e5                                    // Pa → bar
}

function ColInput({ label, val, onChange, unit }: { label: string; val: number; onChange: (v: number) => void; unit: string }) {
  return (
    <label className="block">
      <span className="label-caps mb-1 block text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input type="number" value={val} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="num" />
        <span className="w-12 shrink-0 text-xs text-muted-foreground">{unit}</span>
      </div>
    </label>
  )
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'success' | 'primary' | 'destructive' }) {
  const cls = tone === 'success' ? 'border-success/30 bg-success/10 text-success'
    : tone === 'destructive' ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : tone === 'primary' ? 'border-primary/30 bg-primary/10 text-primary'
    : 'border-border bg-muted/40 text-foreground'
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-center', cls)}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="num mt-0.5 text-2xl font-bold">{value}</p>
    </div>
  )
}

export default function MethodTransfer() {
  const [sp] = useSearchParams()
  const [methods, setMethods] = useState<any[]>([])
  const [selectedMethod, setSelectedMethod] = useState<any>(null)
  const [orig, setOrig] = useState<Column>(DEFAULT_COL)
  const [dest, setDest] = useState<Column>(DEFAULT_NEW)
  const [origGrad, setOrigGrad] = useState<GradientStep[]>([
    { time: 0, pctB: 5 }, { time: 4, pctB: 95 }, { time: 5, pctB: 95 }, { time: 5.5, pctB: 5 }, { time: 7, pctB: 5 },
  ])
  const [maxPressure, setMaxPressure] = useState(200)

  useEffect(() => {
    axios.get(`${API}/methods/all`).then(res => {
      setMethods(res.data)
      const id = parseInt(sp.get('method') || '', 10)
      const pre = res.data.find((m: any) => m.id === id)
      if (pre) loadMethod(pre)
    })
  }, [])

  const loadMethod = (m: any) => {
    setSelectedMethod(m)
    if (m.column_length_mm) setOrig(o => ({ ...o, length: m.column_length_mm }))
    if (m.column_diameter_mm) setOrig(o => ({ ...o, diameter: m.column_diameter_mm }))
    if (m.column_particle_size_um) setOrig(o => ({ ...o, particle: m.column_particle_size_um }))
    if (m.flow_rate_ml_min) setOrig(o => ({ ...o, flow: m.flow_rate_ml_min }))
    if (m.injection_volume_ul) setOrig(o => ({ ...o, injection: m.injection_volume_ul }))
    if (m.gradient_steps?.length > 0) {
      setOrigGrad(m.gradient_steps.map((s: any) => ({ time: s.time_min, pctB: s.percent_b })))
    }
  }

  const vmOrig = calcVoidVolume(orig.length, orig.diameter, orig.particle)
  const vmDest = calcVoidVolume(dest.length, dest.diameter, dest.particle)
  const ratio = vmDest / vmOrig

  const scaledFlow = orig.flow > 0 ? parseFloat((orig.flow * Math.pow(dest.diameter / orig.diameter, 2)).toFixed(3)) : 0
  const scaledInjection = orig.injection > 0 ? parseFloat((orig.injection * ratio).toFixed(2)) : 0
  const scaledGrad = origGrad.map(s => ({ time: parseFloat((s.time * ratio).toFixed(2)), pctB: s.pctB }))

  const origPressure = calcPressure(orig.flow, orig.length, orig.diameter, orig.particle)
  const destPressure = calcPressure(scaledFlow, dest.length, dest.diameter, dest.particle)
  const pressureRatio = destPressure / origPressure
  const overPressure = destPressure > maxPressure

  const origRunTime = origGrad.length > 0 ? origGrad[origGrad.length - 1].time : 0
  const destRunTime = scaledGrad.length > 0 ? scaledGrad[scaledGrad.length - 1].time : 0
  const timeSaving = origRunTime > 0 ? ((origRunTime - destRunTime) / origRunTime * 100) : 0
  const origSolvent = orig.flow * origRunTime
  const destSolvent = scaledFlow * destRunTime
  const solventSaving = origSolvent > 0 ? ((origSolvent - destSolvent) / origSolvent * 100) : 0

  const exportResults = () => {
    const lines = [
      'Koiné — LC Method Transfer Calculator',
      '==========================================', '',
      'ORIGINAL COLUMN',
      `Length: ${orig.length} mm | Diameter: ${orig.diameter} mm | Particle: ${orig.particle} µm`,
      `Flow: ${orig.flow} mL/min | Injection: ${orig.injection} µL`, '',
      'DESTINATION COLUMN',
      `Length: ${dest.length} mm | Diameter: ${dest.diameter} mm | Particle: ${dest.particle} µm`,
      `Scaled Flow: ${scaledFlow} mL/min | Scaled Injection: ${scaledInjection} µL`, '',
      'SCALED GRADIENT', 'Time (min)\t%B',
      ...scaledGrad.map(s => `${s.time}\t${s.pctB}`), '',
      'SAVINGS',
      `Time saving: ${timeSaving.toFixed(1)}%`,
      `Solvent saving: ${solventSaving.toFixed(1)}%`,
      `Estimated pressure: ${destPressure.toFixed(0)} bar`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'method_transfer.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const panel = 'rounded-xl border border-border bg-card p-5'
  const badge = (txt: string, primary?: boolean) => (
    <span className={cn('num flex size-5 items-center justify-center rounded-full text-xs font-semibold',
      primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>{txt}</span>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SEO title="LC Method Transfer Calculator — HPLC to UHPLC Scaling"
        description="Scale gradient, flow rate and injection volume between column geometries, with pressure estimates." />
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">LC method transfer</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Scale a method between column geometries — gradient, flow, injection volume and an estimated pressure.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 p-4">
        <p className="label-caps mb-2 text-primary">Load from the repository</p>
        <select value={selectedMethod?.id ?? ''}
          onChange={e => { const m = methods.find(x => x.id === parseInt(e.target.value)); if (m) loadMethod(m) }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">
          <option value="">Select a method to pre-fill parameters…</option>
          {methods.filter(m => m.column_length_mm && m.gradient_steps?.length > 0).map(m => (
            <option key={m.id} value={m.id}>{m.analyte?.slice(0, 40)} — {m.instrument_manufacturer} {m.column_name || ''}</option>
          ))}
        </select>
        {selectedMethod && <p className="mt-2 text-xs text-muted-foreground">Loaded: <span className="text-foreground">{selectedMethod.title?.slice(0, 70)}</span></p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={panel}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">{badge('A')} Original column</h2>
          <div className="space-y-3">
            <ColInput label="Length" val={orig.length} onChange={v => setOrig(o => ({ ...o, length: v }))} unit="mm" />
            <ColInput label="Diameter" val={orig.diameter} onChange={v => setOrig(o => ({ ...o, diameter: v }))} unit="mm" />
            <ColInput label="Particle size" val={orig.particle} onChange={v => setOrig(o => ({ ...o, particle: v }))} unit="µm" />
            <ColInput label="Flow rate" val={orig.flow} onChange={v => setOrig(o => ({ ...o, flow: v }))} unit="mL/min" />
            <ColInput label="Injection volume" val={orig.injection} onChange={v => setOrig(o => ({ ...o, injection: v }))} unit="µL" />
            <ColInput label="Max pressure" val={maxPressure} onChange={setMaxPressure} unit="bar" />
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>Void volume: <span className="num text-foreground">{vmOrig.toFixed(3)} mL</span></p>
            <p>Est. pressure: <span className="num text-foreground">{origPressure.toFixed(0)} bar</span></p>
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="flex flex-col items-center gap-3">
            <ArrowRight size={26} className="text-primary" />
            <div className="w-44 space-y-2">
              <Metric label="Time saving" value={`${timeSaving.toFixed(0)}%`} tone="success" />
              <Metric label="Solvent saving" value={`${solventSaving.toFixed(0)}%`} tone="primary" />
              <Metric label="Pressure ratio" value={<>{pressureRatio.toFixed(1)}×{overPressure && <span className="block text-xs font-medium">exceeds limit</span>}</>}
                tone={overPressure ? 'destructive' : undefined} />
            </div>
          </div>
        </div>

        <div className={cn(panel, 'border-primary/30')}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">{badge('B', true)} Destination column</h2>
          <div className="space-y-3">
            <ColInput label="Length" val={dest.length} onChange={v => setDest(d => ({ ...d, length: v }))} unit="mm" />
            <ColInput label="Diameter" val={dest.diameter} onChange={v => setDest(d => ({ ...d, diameter: v }))} unit="mm" />
            <ColInput label="Particle size" val={dest.particle} onChange={v => setDest(d => ({ ...d, particle: v }))} unit="µm" />
            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Scaled flow rate</p>
              <p className="num text-lg font-bold text-primary">{scaledFlow} <span className="text-xs font-normal">mL/min</span></p>
              <p className="mt-2 text-xs text-muted-foreground">Scaled injection volume</p>
              <p className="num text-lg font-bold text-primary">{scaledInjection} <span className="text-xs font-normal">µL</span></p>
            </div>
          </div>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>Void volume: <span className="num text-foreground">{vmDest.toFixed(3)} mL</span></p>
            <p>Est. pressure: <span className={cn('num', overPressure ? 'font-semibold text-destructive' : 'text-foreground')}>{destPressure.toFixed(0)} bar</span></p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={panel}>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Original gradient</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-medium">Step</th>
                <th className="py-2 text-left font-medium">Time (min)</th>
                <th className="py-2 text-left font-medium">%B</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {origGrad.map((s, i) => (
                <tr key={i}>
                  <td className="num py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" value={s.time} className="num h-8 w-24 text-xs"
                      onChange={e => { const g = [...origGrad]; g[i] = { ...g[i], time: parseFloat(e.target.value) || 0 }; setOrigGrad(g) }} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input type="number" value={s.pctB} className="num h-8 w-24 text-xs"
                      onChange={e => { const g = [...origGrad]; g[i] = { ...g[i], pctB: parseFloat(e.target.value) || 0 }; setOrigGrad(g) }} />
                  </td>
                  <td className="py-1.5">
                    <button type="button" onClick={() => setOrigGrad(origGrad.filter((_, j) => j !== i))} aria-label="Remove step"
                      className="rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-destructive"><X size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="ghost" size="sm" className="mt-3 text-primary" onClick={() => setOrigGrad([...origGrad, { time: 0, pctB: 0 }])}>
            <Plus size={13} /> Add step
          </Button>
        </div>

        <div className={cn(panel, 'border-primary/30')}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Scaled gradient</h2>
            <Button variant="outline" size="sm" onClick={exportResults}><Download size={13} /> Export</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-medium">Step</th>
                <th className="py-2 text-left font-medium">Time (min)</th>
                <th className="py-2 text-left font-medium">%B</th>
                <th className="py-2 text-left font-medium">Δ time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {scaledGrad.map((s, i) => (
                <tr key={i}>
                  <td className="num py-2 text-muted-foreground">{i + 1}</td>
                  <td className="num py-2 font-semibold text-primary">{s.time}</td>
                  <td className="num py-2 text-foreground">{s.pctB}%</td>
                  <td className="num py-2 text-xs text-muted-foreground">{origGrad[i] ? (s.time - origGrad[i].time).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <p>Run time: <span className="num text-foreground">{num(origRunTime)} min</span> → <span className="num font-semibold text-success">{destRunTime.toFixed(2)} min</span></p>
            <p>Solvent: <span className="num text-foreground">{origSolvent.toFixed(1)} mL</span> → <span className="num text-success">{destSolvent.toFixed(2)} mL</span></p>
            <p>Vm ratio: <span className="num text-foreground">{ratio.toFixed(3)}</span></p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Calculations are based on geometric scaling (void volume ratio). Results are estimates — always verify experimentally.
        Pressure estimates use a simplified Kozeny-Carman equation.
      </p>
    </div>
  )
}
