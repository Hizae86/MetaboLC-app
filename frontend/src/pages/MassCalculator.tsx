import { useState } from 'react'
import { Calculator, Copy, CheckCircle } from 'lucide-react'

// Monoisotopic masses of elements
const ELEMENTS: Record<string, { mass: number; name: string }> = {
  H:  { mass: 1.0078250319, name: 'Hydrogen' },
  He: { mass: 4.0026032, name: 'Helium' },
  Li: { mass: 7.0160035, name: 'Lithium' },
  Be: { mass: 9.0121831, name: 'Beryllium' },
  B:  { mass: 11.0093055, name: 'Boron' },
  C:  { mass: 12.0000000, name: 'Carbon' },
  N:  { mass: 14.0030740052, name: 'Nitrogen' },
  O:  { mass: 15.9949146221, name: 'Oxygen' },
  F:  { mass: 18.99840322, name: 'Fluorine' },
  Na: { mass: 22.9897692, name: 'Sodium' },
  Mg: { mass: 23.9850417, name: 'Magnesium' },
  Al: { mass: 26.9815385, name: 'Aluminium' },
  Si: { mass: 27.9769265, name: 'Silicon' },
  P:  { mass: 30.97376151, name: 'Phosphorus' },
  S:  { mass: 31.97207069, name: 'Sulfur' },
  Cl: { mass: 34.96885268, name: 'Chlorine' },
  K:  { mass: 38.9637069, name: 'Potassium' },
  Ca: { mass: 39.9625912, name: 'Calcium' },
  Fe: { mass: 55.9349375, name: 'Iron' },
  Cu: { mass: 62.9295975, name: 'Copper' },
  Zn: { mass: 63.9291420, name: 'Zinc' },
  Br: { mass: 78.9183376, name: 'Bromine' },
  Se: { mass: 79.9165218, name: 'Selenium' },
  I:  { mass: 126.9044719, name: 'Iodine' },
}

const ELECTRON_MASS = 0.0005485799

// Common adducts for LC-MS/MS
const ADDUCTS = [
  // Positive mode
  { name: '[M+H]+',       mode: '+', formula: '+H',    charge: 1,  delta: +1.007276,  common: true },
  { name: '[M+Na]+',      mode: '+', formula: '+Na',   charge: 1,  delta: +22.989218, common: true },
  { name: '[M+K]+',       mode: '+', formula: '+K',    charge: 1,  delta: +38.963158, common: true },
  { name: '[M+NH4]+',     mode: '+', formula: '+NH4',  charge: 1,  delta: +18.034164, common: true },
  { name: '[M+2H]2+',     mode: '+', formula: '+2H',   charge: 2,  delta: +2.014552,  common: false },
  { name: '[M+H+Na]2+',   mode: '+', formula: '+H+Na', charge: 2,  delta: +23.996494, common: false },
  { name: '[M+2Na]2+',    mode: '+', formula: '+2Na',  charge: 2,  delta: +45.978436, common: false },
  { name: '[M+Li]+',      mode: '+', formula: '+Li',   charge: 1,  delta: +7.016003,  common: false },
  { name: '[M+ACN+H]+',   mode: '+', formula: '+ACN+H',charge: 1,  delta: +42.033825, common: false },
  { name: '[M+2ACN+H]+',  mode: '+', formula: '',      charge: 1,  delta: +83.060399, common: false },
  { name: '[M+MeOH+H]+',  mode: '+', formula: '',      charge: 1,  delta: +33.034164, common: false },
  // Negative mode
  { name: '[M-H]-',       mode: '-', formula: '-H',    charge: 1,  delta: -1.007276,  common: true },
  { name: '[M+Cl]-',      mode: '-', formula: '+Cl',   charge: 1,  delta: +34.969402, common: true },
  { name: '[M+HCOO]-',    mode: '-', formula: '+HCOO', charge: 1,  delta: +44.997655, common: true },
  { name: '[M+CH3COO]-',  mode: '-', formula: '+OAc',  charge: 1,  delta: +59.013305, common: true },
  { name: '[M-2H]2-',     mode: '-', formula: '-2H',   charge: 2,  delta: -2.014552,  common: false },
  { name: '[M+Na-2H]-',   mode: '-', formula: '',      charge: 1,  delta: +20.974666, common: false },
  { name: '[M+K-2H]-',    mode: '-', formula: '',      charge: 1,  delta: +36.948606, common: false },
  { name: '[M+Br]-',      mode: '-', formula: '+Br',   charge: 1,  delta: +78.918338, common: false },
  // Neutral losses
  { name: '[M-H2O+H]+',   mode: '+', formula: '-H2O',  charge: 1,  delta: -16.987484, common: false },
  { name: '[M+H-NH3]+',   mode: '+', formula: '-NH3',  charge: 1,  delta: -16.018724, common: false },
]

interface ParsedFormula {
  elements: Record<string, number>
  mass: number
  valid: boolean
  error?: string
}

function parseFormula(formula: string): ParsedFormula {
  const elements: Record<string, number> = {}
  let mass = 0

  if (!formula.trim()) return { elements, mass: 0, valid: false }

  // Handle brackets e.g. Ca(OH)2
  const expanded = expandFormula(formula)
  if (!expanded.valid) return { elements, mass: 0, valid: false, error: expanded.error }

  const regex = /([A-Z][a-z]?)(\d*)/g
  let match

  while ((match = regex.exec(expanded.formula)) !== null) {
    if (!match[1]) continue
    const el = match[1]
    const count = match[2] ? parseInt(match[2]) : 1

    if (!ELEMENTS[el]) {
      return { elements, mass: 0, valid: false, error: `Unknown element: ${el}` }
    }

    elements[el] = (elements[el] || 0) + count
    mass += ELEMENTS[el].mass * count
  }

  return { elements, mass, valid: true }
}

function expandFormula(formula: string): { formula: string; valid: boolean; error?: string } {
  // Expand parentheses like Ca(OH)2 → CaO2H2
  let result = formula
  const bracketRegex = /\(([^()]+)\)(\d*)/g

  let maxIter = 10
  while (bracketRegex.test(result) && maxIter-- > 0) {
    result = result.replace(/\(([^()]+)\)(\d*)/g, (_, inner, mult) => {
      const m = mult ? parseInt(mult) : 1
      return inner.replace(/([A-Z][a-z]?)(\d*)/g, (__, el, n) => {
        return el + ((n ? parseInt(n) : 1) * m)
      })
    })
  }

  return { formula: result, valid: true }
}

function formatMass(mass: number, decimals = 6): string {
  return mass.toFixed(decimals)
}

export default function MassCalculator() {
  const [formula, setFormula] = useState('C21H30O5')
  const [mode, setMode] = useState<'+' | '-'>('+')
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [reverseInput, setReverseInput] = useState('')
  const [tolerance, setTolerance] = useState(5)
  const [toleranceUnit, setToleranceUnit] = useState<'ppm' | 'mDa'>('ppm')

  const parsed = parseFormula(formula)

  const copyVal = (val: string, key: string) => {
    navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const displayedAdducts = showAll
    ? ADDUCTS.filter(a => a.mode === mode)
    : ADDUCTS.filter(a => a.mode === mode && a.common)

  // Reverse search — find formula from m/z
  const reverseMz = parseFloat(reverseInput)
  const reverseMatches = !isNaN(reverseMz) && reverseMz > 0
    ? ADDUCTS.filter(a => a.mode === mode).map(a => {
        const neutralMass = (reverseMz * a.charge) - a.delta
        return { adduct: a.name, neutralMass, mz: reverseMz }
      })
    : []

  return (
    <div style={{maxWidth:'1000px', margin:'0 auto', padding:'1.5rem'}}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
          <Calculator size={20} className="text-indigo-500" />
          Mass Calculator
        </h1>
        <p className="text-xs text-slate-400">
          Monoisotopic mass from molecular formula + adduct m/z prediction for LC-MS/MS
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Formula input */}
        <div className="space-y-4">

          {/* Formula input */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Molecular Formula</h2>

            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1">Enter formula</label>
              <input
                value={formula}
                onChange={e => setFormula(e.target.value)}
                placeholder="e.g. C21H30O5 or Ca(OH)2"
                className={`w-full text-base px-4 py-3 border-2 rounded-xl font-mono
                  focus:outline-none transition-all
                  ${parsed.valid
                    ? 'border-indigo-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                    : formula ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
              {!parsed.valid && formula && (
                <p className="text-xs text-red-500 mt-1">{parsed.error || 'Invalid formula'}</p>
              )}
            </div>

            {/* Quick formulas */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['C21H30O5', 'C19H28O2', 'C27H44O', 'C17H20N4S', 'C22H28N2O', 'C16H13ClN2O'].map(f => (
                <button key={f} onClick={() => setFormula(f)}
                  className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600
                    hover:bg-indigo-50 hover:text-indigo-700 transition-all font-mono">
                  {f}
                </button>
              ))}
            </div>

            {parsed.valid && (
              <>
                {/* Result */}
                <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-1">Monoisotopic mass</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold font-mono text-indigo-700">
                      {formatMass(parsed.mass)}
                    </p>
                    <span className="text-sm text-slate-400">Da</span>
                    <button onClick={() => copyVal(formatMass(parsed.mass), 'mass')}
                      className="ml-auto text-slate-400 hover:text-indigo-600 transition-colors">
                      {copied === 'mass' ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-mono">
                    Average mass ≈ {(parsed.mass * 1.000335).toFixed(4)} Da
                  </p>
                </div>

                {/* Element breakdown */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Element composition</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(parsed.elements).map(([el, count]) => (
                      <div key={el} className="flex items-center justify-between
                        bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-semibold text-slate-700">{el}<sub>{count > 1 ? count : ''}</sub></span>
                        <span className="text-xs font-mono text-slate-400">
                          {formatMass(ELEMENTS[el].mass * count, 4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reverse search */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-1">Reverse Search</h2>
            <p className="text-xs text-slate-400 mb-3">Enter observed m/z → calculate neutral mass for each adduct</p>
            <div className="flex gap-2 mb-3">
              <input
                value={reverseInput}
                onChange={e => setReverseInput(e.target.value)}
                placeholder="e.g. 363.2171"
                className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg
                  font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-1">
                <input type="number" value={tolerance} onChange={e => setTolerance(parseFloat(e.target.value))}
                  className="w-16 text-sm px-2 py-2 border border-slate-200 rounded-lg font-mono
                    focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={toleranceUnit} onChange={e => setToleranceUnit(e.target.value as any)}
                  className="text-xs px-2 py-2 border border-slate-200 rounded-lg bg-white
                    focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>ppm</option>
                  <option>mDa</option>
                </select>
              </div>
            </div>
            {reverseMatches.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {reverseMatches.map(r => (
                  <div key={r.adduct} className="flex items-center justify-between
                    bg-slate-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-mono text-indigo-600 font-medium">{r.adduct}</span>
                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-700">
                        M = {r.neutralMass.toFixed(6)} Da
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — Adduct table */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Adduct m/z Prediction</h2>
            <div className="flex gap-1 border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setMode('+')}
                className={`px-3 py-1.5 text-xs font-medium transition-all
                  ${mode === '+' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                ESI+
              </button>
              <button onClick={() => setMode('-')}
                className={`px-3 py-1.5 text-xs font-medium transition-all border-l border-slate-200
                  ${mode === '-' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                ESI−
              </button>
            </div>
          </div>

          {parsed.valid ? (
            <>
              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-400 font-medium">Adduct</th>
                    <th className="text-left py-2 text-slate-400 font-medium">z</th>
                    <th className="text-right py-2 text-slate-400 font-medium">m/z</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAdducts.map(a => {
                    const mz = (parsed.mass + a.delta) / a.charge
                    const isMain = a.name === '[M+H]+' || a.name === '[M-H]-'
                    return (
                      <tr key={a.name}
                        className={`border-b border-slate-50 ${isMain ? 'bg-indigo-50' : ''}`}>
                        <td className={`py-2 font-mono ${isMain ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                          {a.name}
                        </td>
                        <td className="py-2 text-slate-400">{a.charge}{a.mode}</td>
                        <td className={`py-2 font-mono text-right ${isMain ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                          {mz.toFixed(6)}
                        </td>
                        <td className="py-2 pl-2">
                          <button onClick={() => copyVal(mz.toFixed(4), a.name)}
                            className="text-slate-300 hover:text-indigo-500 transition-colors">
                            {copied === a.name
                              ? <CheckCircle size={12} className="text-green-500" />
                              : <Copy size={12} />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <button onClick={() => setShowAll(s => !s)}
                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                {showAll ? '▲ Show common only' : `▼ Show all adducts (${ADDUCTS.filter(a => a.mode === mode).length})`}
              </button>

              {/* MRM helper */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">MRM Q1 helper</p>
                <p className="text-xs text-slate-400 mb-2">
                  Select precursor for MRM method setup
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {displayedAdducts.slice(0, 4).map(a => {
                    const mz = (parsed.mass + a.delta) / a.charge
                    return (
                      <button key={a.name}
                        onClick={() => copyVal(mz.toFixed(4), `mrm-${a.name}`)}
                        className="text-left p-2 rounded-lg border border-slate-200
                          hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                        <p className="text-xs text-slate-500">{a.name}</p>
                        <p className="text-sm font-mono font-semibold text-slate-900">
                          {mz.toFixed(4)}
                        </p>
                        {copied === `mrm-${a.name}` && (
                          <p className="text-xs text-green-500">Copied!</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
              <Calculator size={32} className="mb-2" />
              <p className="text-sm">Enter a valid formula to see adducts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
