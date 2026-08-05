import { useState } from 'react'
import { Plus, Trash2, Download, Copy, CheckCircle, FlaskConical } from 'lucide-react'

// Unit conversions to ng/mL base
const CONC_UNITS = ['ng/mL', 'pg/mL', 'µg/mL', 'mg/mL', 'µg/dL', 'ng/dL', 'nmol/L', 'pmol/L', 'µmol/L', 'mmol/L']
const VOL_UNITS = ['µL', 'mL', 'L']

const toNgmL: Record<string, number> = {
  'ng/mL': 1, 'pg/mL': 0.001, 'µg/mL': 1000, 'mg/mL': 1e6,
  'µg/dL': 10, 'ng/dL': 0.1,
  'nmol/L': 1, 'pmol/L': 0.001, 'µmol/L': 1000, 'mmol/L': 1e6,
}
const toUL: Record<string, number> = { 'µL': 1, 'mL': 1000, 'L': 1e6 }

function fromBase(val: number, unit: string): number {
  return val / toNgmL[unit]
}
function toBase(val: number, unit: string): number {
  return val * toNgmL[unit]
}
function volToUL(val: number, unit: string): number {
  return val * toUL[unit]
}
function ulToVol(val: number, unit: string): number {
  return val / toUL[unit]
}

interface Level {
  id: number
  name: string
  conc: string
  concUnit: string
  volume: string
  volUnit: string
  replicates: number
  color: string
}

interface Stock {
  conc: string
  concUnit: string
  volume: string
  volUnit: string
  name: string
}

interface SerialStep {
  id: number
  name: string
  dilutionFactor: string
  volume: string
  volUnit: string
}

const COLORS = ['#6366f1','#f97316','#22c55e','#eab308','#ec4899','#14b8a6','#8b5cf6','#f43f5e']

const LEVEL_PRESETS = {
  'CLSI EP15 (5×5)': [
    { name: 'QC Low', concMult: 3, replicates: 5 },
    { name: 'QC Mid', concMult: 15, replicates: 5 },
    { name: 'QC High', concMult: 75, replicates: 5 },
  ],
  'FDA 3 QC levels': [
    { name: 'LLOQ QC', concMult: 1, replicates: 5 },
    { name: 'QC Low', concMult: 3, replicates: 5 },
    { name: 'QC Mid', concMult: 30, replicates: 5 },
    { name: 'QC High', concMult: 75, replicates: 5 },
  ],
  'Calibration curve (6pt)': [
    { name: 'Cal 1 (LLOQ)', concMult: 1, replicates: 3 },
    { name: 'Cal 2', concMult: 3, replicates: 3 },
    { name: 'Cal 3', concMult: 10, replicates: 3 },
    { name: 'Cal 4', concMult: 30, replicates: 3 },
    { name: 'Cal 5', concMult: 100, replicates: 3 },
    { name: 'Cal 6 (ULOQ)', concMult: 300, replicates: 3 },
  ],
}

let nextId = 10

export default function DilutionCalculator() {
  const [mode, setMode] = useState<'direct' | 'serial' | 'working'>('direct')
  const [copied, setCopied] = useState<string | null>(null)

  // Stock solution
  const [stock, setStock] = useState<Stock>({
    name: 'Stock solution',
    conc: '1000', concUnit: 'µg/mL',
    volume: '1', volUnit: 'mL',
  })

  // Diluent
  const [diluent, setDiluent] = useState('Water / mobile phase A')

  // Target levels
  const [levels, setLevels] = useState<Level[]>([
    { id: 1, name: 'LLOQ', conc: '0.5', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5, color: COLORS[0] },
    { id: 2, name: 'QC Low', conc: '1.5', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5, color: COLORS[1] },
    { id: 3, name: 'QC Mid', conc: '10', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5, color: COLORS[2] },
    { id: 4, name: 'QC High', conc: '75', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5, color: COLORS[3] },
  ])

  // Serial dilution
  const [serialSteps, setSerialSteps] = useState<SerialStep[]>([
    { id: 1, name: 'Step 1', dilutionFactor: '10', volume: '1', volUnit: 'mL' },
    { id: 2, name: 'Step 2', dilutionFactor: '10', volume: '1', volUnit: 'mL' },
    { id: 3, name: 'Step 3', dilutionFactor: '10', volume: '1', volUnit: 'mL' },
  ])

  const addLevel = () => {
    setLevels(ls => [...ls, {
      id: nextId++, name: `Level ${ls.length + 1}`,
      conc: '', concUnit: 'ng/mL', volume: '1', volUnit: 'mL',
      replicates: 3, color: COLORS[ls.length % COLORS.length]
    }])
  }

  const removeLevel = (id: number) => setLevels(ls => ls.filter(l => l.id !== id))

  const updateLevel = (id: number, field: keyof Level, val: any) => {
    setLevels(ls => ls.map(l => l.id === id ? {...l, [field]: val} : l))
  }

  const applyPreset = (preset: keyof typeof LEVEL_PRESETS) => {
    const lloq = parseFloat(levels[0]?.conc || '0.5')
    const lloqUnit = levels[0]?.concUnit || 'ng/mL'
    const volVal = levels[0]?.volume || '1'
    const volUnit = levels[0]?.volUnit || 'mL'
    const items = LEVEL_PRESETS[preset]
    setLevels(items.map((item, i) => ({
      id: nextId++,
      name: item.name,
      conc: (lloq * item.concMult).toString(),
      concUnit: lloqUnit,
      volume: volVal,
      volUnit: volUnit,
      replicates: item.replicates,
      color: COLORS[i % COLORS.length],
    })))
  }

  // Calculate dilutions
  const stockConcBase = toBase(parseFloat(stock.conc) || 0, stock.concUnit) // ng/mL equiv
  const stockVolUL = volToUL(parseFloat(stock.volume) || 0, stock.volUnit)

  interface CalcResult {
    level: Level
    targetConcBase: number
    totalVolUL: number
    stockVolNeeded: number
    diluentVol: number
    dilutionFactor: number
    valid: boolean
    warning?: string
  }

  const results: CalcResult[] = levels.map(l => {
    const targetBase = toBase(parseFloat(l.conc) || 0, l.concUnit)
    const totalVolUL = volToUL(parseFloat(l.volume) || 0, l.volUnit) * l.replicates
    const stockVolNeeded = stockConcBase > 0 ? (targetBase * totalVolUL) / stockConcBase : 0
    const diluentVol = totalVolUL - stockVolNeeded
    const dilutionFactor = stockConcBase > 0 ? stockConcBase / targetBase : 0
    const valid = stockVolNeeded > 0 && stockVolNeeded <= totalVolUL && diluentVol >= 0
    let warning = undefined
    if (stockVolNeeded > totalVolUL) warning = 'Target concentration exceeds stock'
    if (stockVolNeeded < 0.1 && stockVolNeeded > 0) warning = 'Very small volume — consider intermediate dilution'
    if (dilutionFactor > 10000) warning = 'Large dilution factor — use serial dilution'

    return { level: l, targetConcBase: targetBase, totalVolUL, stockVolNeeded, diluentVol, dilutionFactor, valid, warning }
  })

  // Serial dilution calculation
  const serialResults = (() => {
    let currentConc = stockConcBase
    return serialSteps.map((step, i) => {
      const factor = parseFloat(step.dilutionFactor) || 1
      const volUL = volToUL(parseFloat(step.volume) || 0, step.volUnit)
      const resultConc = currentConc / factor
      const stockNeeded = volUL / factor
      const diluentNeeded = volUL - stockNeeded
      const prev = currentConc
      currentConc = resultConc
      return { step, factor, volUL, resultConc, stockNeeded, diluentNeeded, inputConc: prev }
    })
  })()

  const copyVal = (val: string, key: string) => {
    navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const exportProtocol = () => {
    const lines = [
      'MetaboLC — Dilution Calculator Protocol',
      '=========================================',
      `Stock: ${stock.name} | ${stock.conc} ${stock.concUnit} | ${stock.volume} ${stock.volUnit}`,
      `Diluent: ${diluent}`,
      '',
      'PREPARATION INSTRUCTIONS',
      '------------------------',
    ]

    results.forEach((r, i) => {
      lines.push(`\n${i+1}. ${r.level.name} (${r.level.conc} ${r.level.concUnit})`)
      lines.push(`   Total volume needed: ${r.totalVolUL.toFixed(1)} µL (${r.level.replicates} replicates)`)
      lines.push(`   Stock volume: ${r.stockVolNeeded.toFixed(2)} µL`)
      lines.push(`   Diluent volume: ${r.diluentVol.toFixed(2)} µL`)
      lines.push(`   Dilution factor: 1:${r.dilutionFactor.toFixed(1)}`)
      if (r.warning) lines.push(`   ⚠ ${r.warning}`)
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'dilution_protocol.txt'; a.click()
  }

  const InputRow = ({ label, val, onChange, unit, onUnitChange, units, placeholder = '' }: any) => (
    <div>
      <label className="text-xs text-slate-500 block mb-1">{label}</label>
      <div className="flex gap-1">
        <input type="number" value={val} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg
            font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0" />
        {unit && (
          <select value={unit} onChange={e => onUnitChange(e.target.value)}
            className="text-xs px-2 py-2 border border-slate-200 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0">
            {units.map((u: string) => <option key={u}>{u}</option>)}
          </select>
        )}
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:'1200px', margin:'0 auto', padding:'1.5rem'}}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
          <FlaskConical size={20} className="text-teal-500" />
          Dilution Calculator
        </h1>
        <p className="text-xs text-slate-400">
          Prepare calibrators, QC samples and working solutions with exact volumes
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50 mb-6 w-fit">
        {[
          { id: 'direct', label: 'Direct Dilution' },
          { id: 'serial', label: 'Serial Dilution' },
          { id: 'working', label: 'Working Solution' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${mode === m.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — Stock + Settings */}
        <div className="space-y-4">
          {/* Stock solution */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Stock Solution</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Name</label>
                <input value={stock.name} onChange={e => setStock(s => ({...s, name: e.target.value}))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <InputRow label="Concentration" val={stock.conc}
                onChange={(v: string) => setStock(s => ({...s, conc: v}))}
                unit={stock.concUnit} onUnitChange={(u: string) => setStock(s => ({...s, concUnit: u}))}
                units={CONC_UNITS} />
              <InputRow label="Available volume" val={stock.volume}
                onChange={(v: string) => setStock(s => ({...s, volume: v}))}
                unit={stock.volUnit} onUnitChange={(u: string) => setStock(s => ({...s, volUnit: u}))}
                units={VOL_UNITS} />
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Base concentration: <span className="font-mono text-slate-700">{stockConcBase.toExponential(3)} ng/mL equiv.</span>
              </p>
            </div>
          </div>

          {/* Diluent */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Diluent</h2>
            <input value={diluent} onChange={e => setDiluent(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Matrix (blank)', 'Water', 'ACN:Water (50:50)', 'MeOH:Water (80:20)', 'Mobile phase A'].map(d => (
                <button key={d} onClick={() => setDiluent(d)}
                  className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600
                    hover:bg-teal-50 hover:text-teal-700 transition-all">
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          {mode === 'direct' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Apply preset</h2>
              <div className="space-y-2">
                {Object.keys(LEVEL_PRESETS).map(p => (
                  <button key={p} onClick={() => applyPreset(p as any)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-slate-200
                      hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-all">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Export */}
          <button onClick={exportProtocol}
            className="w-full flex items-center justify-center gap-2 px-4 py-3
              bg-slate-900 text-white rounded-xl text-sm font-medium
              hover:bg-slate-700 transition-all">
            <Download size={15} /> Export Protocol (.txt)
          </button>
        </div>

        {/* Right — Levels + Results */}
        <div className="lg:col-span-2 space-y-4">

          {mode === 'direct' && (
            <>
              {/* Level inputs */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-800">Target Levels</h2>
                  <button onClick={addLevel}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                      border border-teal-200 rounded-lg bg-teal-50 text-teal-700
                      hover:bg-teal-100 transition-all">
                    <Plus size={12} /> Add level
                  </button>
                </div>

                <div className="space-y-3">
                  {levels.map(l => (
                    <div key={l.id} className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="w-2 h-10 rounded-full shrink-0" style={{background: l.color}} />
                      <input value={l.name} onChange={e => updateLevel(l.id, 'name', e.target.value)}
                        className="text-xs font-medium w-28 px-2 py-1.5 border border-slate-200 rounded-lg
                          bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <div className="flex gap-1 flex-1">
                        <input type="number" value={l.conc}
                          onChange={e => updateLevel(l.id, 'conc', e.target.value)}
                          placeholder="Conc."
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg
                            font-mono bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0" />
                        <select value={l.concUnit} onChange={e => updateLevel(l.id, 'concUnit', e.target.value)}
                          className="text-xs px-1 py-1.5 border border-slate-200 rounded-lg bg-white
                            focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          {CONC_UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-1">
                        <input type="number" value={l.volume}
                          onChange={e => updateLevel(l.id, 'volume', e.target.value)}
                          placeholder="Vol."
                          className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg
                            font-mono bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        <select value={l.volUnit} onChange={e => updateLevel(l.id, 'volUnit', e.target.value)}
                          className="text-xs px-1 py-1.5 border border-slate-200 rounded-lg bg-white
                            focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          {VOL_UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">×</span>
                        <input type="number" value={l.replicates} min={1} max={20}
                          onChange={e => updateLevel(l.id, 'replicates', parseInt(e.target.value))}
                          className="w-12 text-xs px-2 py-1.5 border border-slate-200 rounded-lg
                            font-mono bg-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        <span className="text-xs text-slate-400">rep</span>
                      </div>
                      <button onClick={() => removeLevel(l.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Preparation Instructions</h2>
                  <button onClick={() => {
                    const text = results.map(r =>
                      `${r.level.name}: ${r.stockVolNeeded.toFixed(2)} µL stock + ${r.diluentVol.toFixed(2)} µL diluent`
                    ).join('\n')
                    copyVal(text, 'all')
                  }} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                    {copied === 'all' ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
                    Copy all
                  </button>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Level</th>
                      <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Target</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Total vol.</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Stock (µL)</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Diluent (µL)</th>
                      <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Factor</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.level.id}
                        className={`border-b border-slate-50 ${!r.valid && r.level.conc ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{background: r.level.color}} />
                            <span className="font-medium text-slate-800">{r.level.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {r.level.conc} {r.level.concUnit}
                        </td>
                        <td className="px-4 py-3 font-mono text-right text-slate-600">
                          {r.totalVolUL.toFixed(1)} µL
                        </td>
                        <td className="px-4 py-3 font-mono text-right">
                          {r.valid ? (
                            <span className="font-semibold text-indigo-700">
                              {r.stockVolNeeded.toFixed(2)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-right text-slate-600">
                          {r.valid ? r.diluentVol.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-right text-slate-500">
                          {r.valid ? `1:${r.dilutionFactor.toFixed(0)}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {r.warning ? (
                            <span className="text-orange-500 text-xs">⚠</span>
                          ) : r.valid ? (
                            <button onClick={() => copyVal(
                              `${r.stockVolNeeded.toFixed(2)} µL stock + ${r.diluentVol.toFixed(2)} µL diluent`,
                              `row-${i}`
                            )} className="text-slate-300 hover:text-indigo-500 transition-colors">
                              {copied === `row-${i}` ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Warnings */}
                {results.some(r => r.warning) && (
                  <div className="px-5 py-3 bg-orange-50 border-t border-orange-100">
                    {results.filter(r => r.warning).map(r => (
                      <p key={r.level.id} className="text-xs text-orange-600">
                        ⚠ {r.level.name}: {r.warning}
                      </p>
                    ))}
                  </div>
                )}

                {/* Summary */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Total stock needed</p>
                      <p className="text-sm font-mono font-semibold text-indigo-700">
                        {results.reduce((a, r) => a + (r.valid ? r.stockVolNeeded : 0), 0).toFixed(2)} µL
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total diluent needed</p>
                      <p className="text-sm font-mono font-semibold text-slate-700">
                        {results.reduce((a, r) => a + (r.valid ? r.diluentVol : 0), 0).toFixed(2)} µL
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total volume</p>
                      <p className="text-sm font-mono font-semibold text-slate-700">
                        {results.reduce((a, r) => a + (r.valid ? r.totalVolUL : 0), 0).toFixed(1)} µL
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'serial' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-800">Serial Dilution Steps</h2>
                <button onClick={() => setSerialSteps(s => [...s, { id: nextId++, name: `Step ${s.length+1}`, dilutionFactor: '10', volume: '1', volUnit: 'mL' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    border border-teal-200 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all">
                  <Plus size={12} /> Add step
                </button>
              </div>

              <div className="space-y-3 mb-6">
                {serialSteps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs
                      flex items-center justify-center font-bold shrink-0">{i+1}</div>
                    <input value={step.name} onChange={e => setSerialSteps(s => s.map(x => x.id === step.id ? {...x, name: e.target.value} : x))}
                      className="text-xs w-24 px-2 py-1.5 border border-slate-200 rounded-lg bg-white
                        focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">1:</span>
                      <input type="number" value={step.dilutionFactor}
                        onChange={e => setSerialSteps(s => s.map(x => x.id === step.id ? {...x, dilutionFactor: e.target.value} : x))}
                        className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg font-mono bg-white
                          focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                    <div className="flex gap-1">
                      <input type="number" value={step.volume}
                        onChange={e => setSerialSteps(s => s.map(x => x.id === step.id ? {...x, volume: e.target.value} : x))}
                        className="w-16 text-xs px-2 py-1.5 border border-slate-200 rounded-lg font-mono bg-white
                          focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      <select value={step.volUnit}
                        onChange={e => setSerialSteps(s => s.map(x => x.id === step.id ? {...x, volUnit: e.target.value} : x))}
                        className="text-xs px-1 py-1.5 border border-slate-200 rounded-lg bg-white
                          focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        {VOL_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <button onClick={() => setSerialSteps(s => s.filter(x => x.id !== step.id))}
                      className="text-slate-300 hover:text-red-400 transition-colors ml-auto">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Serial results */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Step</th>
                    <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Input conc.</th>
                    <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Take (µL)</th>
                    <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Add diluent (µL)</th>
                    <th className="text-right px-3 py-2.5 text-slate-400 font-medium">Result conc.</th>
                  </tr>
                </thead>
                <tbody>
                  {serialResults.map((r, i) => (
                    <tr key={r.step.id} className="border-b border-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-700">{r.step.name}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{r.inputConc.toExponential(3)}</td>
                      <td className="px-3 py-2.5 font-mono text-right font-semibold text-indigo-700">
                        {r.stockNeeded.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-slate-600">
                        {r.diluentNeeded.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right font-semibold text-teal-700">
                        {r.resultConc.toExponential(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'working' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Working Solution Preparation</h2>
              <p className="text-xs text-slate-400 mb-4">
                Calculate how to prepare a working solution at a specific concentration and volume from your stock.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <InputRow label="Target concentration" val={levels[0]?.conc || ''}
                  onChange={(v: string) => updateLevel(levels[0]?.id, 'conc', v)}
                  unit={levels[0]?.concUnit} onUnitChange={(u: string) => updateLevel(levels[0]?.id, 'concUnit', u)}
                  units={CONC_UNITS} placeholder="e.g. 100" />
                <InputRow label="Target volume" val={levels[0]?.volume || ''}
                  onChange={(v: string) => updateLevel(levels[0]?.id, 'volume', v)}
                  unit={levels[0]?.volUnit} onUnitChange={(u: string) => updateLevel(levels[0]?.id, 'volUnit', u)}
                  units={VOL_UNITS} placeholder="e.g. 1" />
              </div>

              {results[0]?.valid && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
                  <p className="text-sm font-semibold text-teal-800 mb-3">Preparation</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-teal-600 mb-1">Take from stock</p>
                      <p className="text-2xl font-bold font-mono text-teal-800">
                        {results[0].stockVolNeeded.toFixed(2)}
                        <span className="text-sm font-normal ml-1">µL</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 mb-1">Add diluent</p>
                      <p className="text-2xl font-bold font-mono text-teal-800">
                        {results[0].diluentVol.toFixed(2)}
                        <span className="text-sm font-normal ml-1">µL</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 mb-1">Dilution factor</p>
                      <p className="text-2xl font-bold font-mono text-teal-800">
                        1:{results[0].dilutionFactor.toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-teal-600 mt-3 pt-3 border-t border-teal-200">
                    Mix {results[0].stockVolNeeded.toFixed(2)} µL of {stock.name} with {results[0].diluentVol.toFixed(2)} µL of {diluent}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
