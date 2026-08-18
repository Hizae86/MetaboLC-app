import { useState } from 'react'
import { Download, Plus, Trash2, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface CompoundData {
  id: number
  name: string
  // Set A: Standard in neat solvent
  areaA: string
  // Set B: Post-extraction spike (matrix)
  areaB: string
  // Set C: Pre-extraction spike
  areaC: string
  // IS normalized (optional)
  isAreaA: string
  isAreaB: string
  isAreaC: string
}

let nextId = 4

function calcResults(c: CompoundData, useIS: boolean) {
  const A = parseFloat(c.areaA)
  const B = parseFloat(c.areaB)
  const C = parseFloat(c.areaC)
  const isA = parseFloat(c.isAreaA)
  const isB = parseFloat(c.isAreaB)
  const isC = parseFloat(c.isAreaC)

  if (!A || !B || !C) return null

  // Normalize by IS if available
  const normA = useIS && isA ? A / isA : A
  const normB = useIS && isB ? B / isB : B
  const normC = useIS && isC ? C / isC : C

  // Matuszewski equations
  const matrixEffect = (normB / normA) * 100          // % Matrix Factor
  const extractionEff = (normC / normB) * 100          // % Extraction Recovery  
  const processEff = (normC / normA) * 100             // % Process Efficiency

  // Ion suppression/enhancement
  const ionSuppression = matrixEffect - 100

  return {
    matrixEffect: parseFloat(matrixEffect.toFixed(1)),
    extractionEff: parseFloat(extractionEff.toFixed(1)),
    processEff: parseFloat(processEff.toFixed(1)),
    ionSuppression: parseFloat(ionSuppression.toFixed(1)),
  }
}

function StatusBadge({ value, type }: { value: number; type: 'me' | 'er' | 'pe' }) {
  let ok = false
  let warn = false

  if (type === 'me') {
    ok = value >= 85 && value <= 115
    warn = (value >= 70 && value < 85) || (value > 115 && value <= 130)
  } else if (type === 'er') {
    ok = value >= 60
    warn = value >= 40 && value < 60
  } else {
    ok = value >= 50
    warn = value >= 30 && value < 50
  }

  if (ok) return <CheckCircle size={14} className="text-green-500 shrink-0" />
  if (warn) return <AlertTriangle size={14} className="text-orange-400 shrink-0" />
  return <XCircle size={14} className="text-red-400 shrink-0" />
}

function Bar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 150)
  return (
    <div className="relative h-1.5 bg-slate-100 rounded-full w-full mt-1">
      {/* 100% marker */}
      <div className="absolute top-0 bottom-0 w-px bg-slate-300" style={{ left: '66.6%' }} />
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(pct / 150) * 100}%`, background: color }} />
    </div>
  )
}

export default function MatrixEffectCalculator() {
  const [compounds, setCompounds] = useState<CompoundData[]>([
    { id: 1, name: 'Analyte 1', areaA: '', areaB: '', areaC: '', isAreaA: '', isAreaB: '', isAreaC: '' },
    { id: 2, name: 'Analyte 2', areaA: '', areaB: '', areaC: '', isAreaA: '', isAreaB: '', isAreaC: '' },
    { id: 3, name: 'IS', areaA: '', areaB: '', areaC: '', isAreaA: '', isAreaB: '', isAreaC: '' },
  ])
  const [useIS, setUseIS] = useState(false)
  const [nLots, setNLots] = useState(6)
  const [copied, setCopied] = useState(false)

  const addCompound = () => setCompounds(cs => [...cs, {
    id: nextId++, name: `Analyte ${cs.length + 1}`,
    areaA: '', areaB: '', areaC: '', isAreaA: '', isAreaB: '', isAreaC: ''
  }])

  const removeCompound = (id: number) => setCompounds(cs => cs.filter(c => c.id !== id))

  const updateCompound = (id: number, field: keyof CompoundData, val: string) =>
    setCompounds(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c))

  const results = compounds.map(c => ({ compound: c, result: calcResults(c, useIS) }))

  const exportResults = () => {
    const lines = [
      'MetaboLC — Matrix Effect & Recovery Calculator',
      'Method: Matuszewski et al. (2003)',
      '===============================================',
      '',
      'DEFINITIONS:',
      '  Set A: Analyte in neat solvent (post-extraction blank + analyte)',
      '  Set B: Post-extraction matrix spike (extracted blank + post-spike)',
      '  Set C: Pre-extraction matrix spike (extracted with analyte)',
      '',
      'RESULTS:',
      'Compound\tMatrix Effect (%)\tIon Suppression (%)\tExtraction Recovery (%)\tProcess Efficiency (%)',
    ]

    results.forEach(({ compound, result }) => {
      if (result) {
        lines.push(`${compound.name}\t${result.matrixEffect}\t${result.ionSuppression}\t${result.extractionEff}\t${result.processEff}`)
      }
    })

    lines.push('')
    lines.push('ACCEPTANCE CRITERIA:')
    lines.push('  Matrix Effect: 85-115% (IS-normalized)')
    lines.push('  Extraction Recovery: ≥60% (consistent, CV ≤15%)')
    lines.push('  Process Efficiency: ≥50%')
    lines.push('  Reference: CLSI C62-A, FDA BMV 2018, EMA BMV 2011')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'matrix_effect_recovery.txt'; a.click()
  }

  const Input = ({ val, onChange, placeholder = '' }: any) => (
    <input type="number" value={val} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg font-mono
        focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800" />
  )

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
          <span className="text-2xl">⚗️</span>
          Matrix Effect & Recovery Calculator
        </h1>
        <p className="text-xs text-slate-400">
          Ion suppression & extraction efficiency — Matuszewski et al. (2003) method
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Three-set experiment design (Matuszewski 2003)</p>
            <p><strong>Set A:</strong> Analyte spiked into neat solvent at working concentration</p>
            <p><strong>Set B:</strong> Analyte spiked into post-extraction blank matrix (post-extraction spike)</p>
            <p><strong>Set C:</strong> Analyte spiked into blank matrix before extraction (pre-extraction spike)</p>
            <p className="text-blue-500 mt-1">Test minimum <strong>{nLots} individual matrix lots</strong> per CLSI C62-A</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — Settings */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Number of matrix lots
                </label>
                <input type="number" value={nLots} min={3} max={20}
                  onChange={e => setNLots(parseInt(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-slate-400 mt-1">Min 6 per CLSI C62-A</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useIS} onChange={e => setUseIS(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600" />
                <div>
                  <p className="text-xs font-medium text-slate-700">IS-normalized matrix factor</p>
                  <p className="text-xs text-slate-400">Divide by internal standard response</p>
                </div>
              </label>
            </div>
          </div>

          {/* Formulas */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">Matuszewski equations</p>
            <div className="space-y-2 text-xs font-mono text-slate-600">
              <div className="bg-white rounded-lg p-2 border border-slate-100">
                <p className="text-slate-400 text-xs mb-0.5">Matrix Effect</p>
                <p>ME% = (B / A) × 100</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-slate-100">
                <p className="text-slate-400 text-xs mb-0.5">Extraction Recovery</p>
                <p>RE% = (C / B) × 100</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-slate-100">
                <p className="text-slate-400 text-xs mb-0.5">Process Efficiency</p>
                <p>PE% = (C / A) × 100</p>
              </div>
            </div>
          </div>

          {/* Acceptance criteria */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 mb-3">Acceptance criteria</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-green-500 shrink-0" />
                <span className="text-slate-600">ME: <strong>85–115%</strong> (IS-normalized)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-green-500 shrink-0" />
                <span className="text-slate-600">RE: <strong>≥60%</strong>, CV ≤15%</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-green-500 shrink-0" />
                <span className="text-slate-600">PE: <strong>≥50%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={12} className="text-orange-400 shrink-0" />
                <span className="text-slate-500">Borderline — investigate</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle size={12} className="text-red-400 shrink-0" />
                <span className="text-slate-500">Fails criteria</span>
              </div>
            </div>
          </div>

          <button onClick={exportResults}
            className="w-full flex items-center justify-center gap-2 px-4 py-3
              bg-slate-900 text-white rounded-xl text-sm font-medium
              hover:bg-slate-700 transition-all">
            <Download size={15} /> Export Results (.txt)
          </button>
        </div>

        {/* Right — Data entry + Results */}
        <div className="lg:col-span-2 space-y-4">

          {/* Data entry table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Peak Area Data</h2>
              <button onClick={addCompound}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                  border border-indigo-200 rounded-lg bg-indigo-50 text-indigo-700
                  hover:bg-indigo-100 transition-all">
                <Plus size={12} /> Add compound
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-slate-400 font-medium">Compound</th>
                    <th className="text-center px-3 py-2.5 text-slate-400 font-medium bg-blue-50">
                      Set A<br/><span className="font-normal text-slate-400">Neat solvent</span>
                    </th>
                    <th className="text-center px-3 py-2.5 text-slate-400 font-medium bg-orange-50">
                      Set B<br/><span className="font-normal text-slate-400">Post-extraction</span>
                    </th>
                    <th className="text-center px-3 py-2.5 text-slate-400 font-medium bg-green-50">
                      Set C<br/><span className="font-normal text-slate-400">Pre-extraction</span>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {compounds.map(c => (
                    <tr key={c.id} className="border-b border-slate-50">
                      <td className="px-4 py-2">
                        <input value={c.name}
                          onChange={e => updateCompound(c.id, 'name', e.target.value)}
                          className="text-xs font-medium w-28 px-2 py-1 border border-slate-200
                            rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      </td>
                      <td className="px-3 py-2 bg-blue-50/30">
                        <Input val={c.areaA} onChange={(v: string) => updateCompound(c.id, 'areaA', v)} placeholder="Area A" />
                      </td>
                      <td className="px-3 py-2 bg-orange-50/30">
                        <Input val={c.areaB} onChange={(v: string) => updateCompound(c.id, 'areaB', v)} placeholder="Area B" />
                      </td>
                      <td className="px-3 py-2 bg-green-50/30">
                        <Input val={c.areaC} onChange={(v: string) => updateCompound(c.id, 'areaC', v)} placeholder="Area C" />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeCompound(c.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Results */}
          {results.some(r => r.result) && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Results</h2>
              </div>

              <div className="p-5 space-y-4">
                {results.map(({ compound, result }) => {
                  if (!result) return null
                  return (
                    <div key={compound.id} className="border border-slate-100 rounded-xl p-4">
                      <p className="text-sm font-semibold text-slate-800 mb-3">{compound.name}</p>
                      <div className="grid grid-cols-3 gap-4">

                        {/* Matrix Effect */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <StatusBadge value={result.matrixEffect} type="me" />
                            <span className="text-xs text-slate-500">Matrix Effect</span>
                          </div>
                          <p className={`text-2xl font-bold font-mono
                            ${result.matrixEffect >= 85 && result.matrixEffect <= 115
                              ? 'text-green-600' : result.matrixEffect >= 70 && result.matrixEffect <= 130
                              ? 'text-orange-500' : 'text-red-500'}`}>
                            {result.matrixEffect}%
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {result.ionSuppression > 0 ? '+' : ''}{result.ionSuppression}% ion {result.ionSuppression > 0 ? 'enhancement' : 'suppression'}
                          </p>
                          <Bar value={result.matrixEffect}
                            color={result.matrixEffect >= 85 && result.matrixEffect <= 115 ? '#22c55e' : result.matrixEffect >= 70 ? '#f97316' : '#ef4444'} />
                        </div>

                        {/* Extraction Recovery */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <StatusBadge value={result.extractionEff} type="er" />
                            <span className="text-xs text-slate-500">Extraction Recovery</span>
                          </div>
                          <p className={`text-2xl font-bold font-mono
                            ${result.extractionEff >= 60 ? 'text-green-600'
                              : result.extractionEff >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                            {result.extractionEff}%
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">Target: ≥60%</p>
                          <Bar value={result.extractionEff}
                            color={result.extractionEff >= 60 ? '#22c55e' : result.extractionEff >= 40 ? '#f97316' : '#ef4444'} />
                        </div>

                        {/* Process Efficiency */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <StatusBadge value={result.processEff} type="pe" />
                            <span className="text-xs text-slate-500">Process Efficiency</span>
                          </div>
                          <p className={`text-2xl font-bold font-mono
                            ${result.processEff >= 50 ? 'text-green-600'
                              : result.processEff >= 30 ? 'text-orange-500' : 'text-red-500'}`}>
                            {result.processEff}%
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">Target: ≥50%</p>
                          <Bar value={result.processEff}
                            color={result.processEff >= 50 ? '#22c55e' : result.processEff >= 30 ? '#f97316' : '#ef4444'} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reference */}
          <p className="text-xs text-slate-400 text-center">
            Matuszewski BK, Constanzer ML, Chavez-Eng CM. Strategies for the Assessment of Matrix Effect in Quantitative Bioanalytical Methods Based on HPLC-MS/MS. <em>Anal Chem.</em> 2003;75(13):3019-3030.
          </p>
        </div>
      </div>
    </div>
  )
}
