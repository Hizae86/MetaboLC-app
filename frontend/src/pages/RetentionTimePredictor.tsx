import { useState } from 'react'
import { Info, Clock, Download } from 'lucide-react'

// LogP ranges for common functional groups
const COMPOUND_CLASSES = [
  { name: 'Amino acids', logP: -3.5, example: 'Phenylalanine, Tyrosine' },
  { name: 'Nucleotides', logP: -3.0, example: 'ATP, AMP, cAMP' },
  { name: 'Sugars / carbohydrates', logP: -2.5, example: 'Glucose, Fructose' },
  { name: 'Catecholamines', logP: -1.5, example: 'Dopamine, Norepinephrine' },
  { name: 'Bile acids', logP: 0.5, example: 'Cholic acid, CDCA' },
  { name: 'Steroids (polar)', logP: 1.5, example: 'Cortisol, Aldosterone' },
  { name: 'Drugs (moderate)', logP: 2.0, example: 'Paracetamol, Caffeine' },
  { name: 'Vitamins (water soluble)', logP: 2.5, example: 'Vitamin B12, Folic acid' },
  { name: 'Steroids (nonpolar)', logP: 3.5, example: 'Testosterone, Progesterone' },
  { name: 'Immunosuppressants', logP: 4.0, example: 'Tacrolimus, Cyclosporine' },
  { name: 'Vitamins (fat soluble)', logP: 5.0, example: 'Vitamin D, Vitamin A' },
  { name: 'Lipids / fatty acids', logP: 6.5, example: 'Palmitic acid, DHA' },
]

const COLUMNS = [
  { name: 'BEH C18 (1.7µm)', brand: 'Waters', length: 50, diameter: 2.1, particle: 1.7, retentionFactor: 1.0 },
  { name: 'HSS T3 (1.8µm)', brand: 'Waters', length: 100, diameter: 2.1, particle: 1.8, retentionFactor: 1.1 },
  { name: 'Kinetex C18 (1.7µm)', brand: 'Phenomenex', length: 50, diameter: 2.1, particle: 1.7, retentionFactor: 0.95 },
  { name: 'Poroshell C18 (2.7µm)', brand: 'Agilent', length: 50, diameter: 2.1, particle: 2.7, retentionFactor: 0.9 },
  { name: 'Acquity UPLC BEH C18', brand: 'Waters', length: 100, diameter: 2.1, particle: 1.7, retentionFactor: 1.05 },
  { name: 'Zorbax Eclipse Plus C18', brand: 'Agilent', length: 50, diameter: 2.1, particle: 1.8, retentionFactor: 0.95 },
  { name: 'SunFire C18 (3.5µm)', brand: 'Waters', length: 150, diameter: 4.6, particle: 3.5, retentionFactor: 1.2 },
  { name: 'Hypercarb (PGC)', brand: 'Thermo', length: 100, diameter: 2.1, particle: 3.0, retentionFactor: 1.4 },
  { name: 'HILIC (BEH Amide)', brand: 'Waters', length: 100, diameter: 2.1, particle: 1.7, retentionFactor: -0.5 },
  { name: 'Kinetex HILIC', brand: 'Phenomenex', length: 100, diameter: 2.1, particle: 1.7, retentionFactor: -0.4 },
]

const MOBILE_PHASES = [
  { name: 'Water / MeOH + 0.1% FA', elutingStrength: 8, typical: 'Steroids, drugs' },
  { name: 'Water / ACN + 0.1% FA', elutingStrength: 7, typical: 'General RP' },
  { name: 'Water / ACN + 10mM NH4FA', elutingStrength: 7.2, typical: 'Basic compounds, ESI-' },
  { name: 'Water / ACN + 10mM NH4Ac', elutingStrength: 7.0, typical: 'Metabolomics' },
  { name: 'Water / MeOH + 2mM NH4FA', elutingStrength: 7.5, typical: 'Vitamin D, lipids' },
  { name: 'ACN / Water (HILIC)', elutingStrength: -5, typical: 'Polar compounds, HILIC' },
  { name: '10mM NH4Ac in ACN/Water HILIC', elutingStrength: -4.5, typical: 'Amino acids, sugars' },
]

function predictRT(
  logP: number,
  column: typeof COLUMNS[0],
  mobilePhase: typeof MOBILE_PHASES[0],
  flowRate: number,
  gradientStart: number,
  gradientEnd: number,
  gradientTime: number
): {
  predictedRT: number
  kPrime: number
  confidence: string
  notes: string[]
} {
  // Simplified LSS (Linear Solvent Strength) model
  // RT prediction based on logP and gradient conditions

  const isHILIC = mobilePhase.elutingStrength < 0
  const notes: string[] = []

  // Adjusted logP for HILIC (reverse retention)
  const effectiveLogP = isHILIC ? -logP : logP

  // Retention factor (k') estimate
  // Based on logP - phi (organic modifier content) relationship
  const avgPhi = (gradientStart + gradientEnd) / 2 / 100
  const S = 4 + effectiveLogP * 0.8 // slope parameter
  const logKw = effectiveLogP * 0.6 + mobilePhase.elutingStrength * 0.1 // retention at 0% organic

  // k' at average mobile phase composition
  const logK = logKw - S * avgPhi
  const kPrime = Math.pow(10, logK) * column.retentionFactor

  // Dead time (t0)
  const vmColumn = (Math.PI / 4) * Math.pow(column.diameter / 10, 2) * (column.length / 10) * 0.65
  const t0 = vmColumn / flowRate

  // Gradient retention time (simplified LSS)
  const tG = gradientTime
  const deltaPhi = (gradientEnd - gradientStart) / 100
  const b = (S * deltaPhi) / tG * (tG / t0) // gradient steepness

  let predictedRT: number

  if (b > 0.1) {
    // Gradient elution
    const kStar = kPrime / (1 + b * kPrime)
    predictedRT = t0 * (1 + kStar)
    notes.push('Gradient elution — using LSS model')
  } else {
    // Isocratic
    predictedRT = t0 * (1 + kPrime)
    notes.push('Near-isocratic conditions')
  }

  // Clamp to reasonable range
  predictedRT = Math.max(t0 * 1.1, Math.min(gradientTime * 0.95, predictedRT))

  // Confidence assessment
  let confidence = 'Medium'
  if (Math.abs(logP) < 1 || Math.abs(logP) > 6) {
    confidence = 'Low'
    notes.push('Extreme logP — prediction less reliable')
  } else if (Math.abs(logP) >= 1 && Math.abs(logP) <= 5) {
    confidence = 'High'
  }

  if (isHILIC) {
    notes.push('HILIC mode — polar compounds elute later')
    confidence = 'Low'
  }

  return {
    predictedRT: parseFloat(predictedRT.toFixed(2)),
    kPrime: parseFloat(kPrime.toFixed(2)),
    confidence,
    notes,
  }
}

export default function RetentionTimePredictor() {
  const [logP, setLogP] = useState('2.5')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [selectedMP, setSelectedMP] = useState(0)
  const [flowRate, setFlowRate] = useState('0.4')
  const [gradStart, setGradStart] = useState('5')
  const [gradEnd, setGradEnd] = useState('95')
  const [gradTime, setGradTime] = useState('5')

  const column = COLUMNS[selectedColumn]
  const mp = MOBILE_PHASES[selectedMP]
  const logPVal = parseFloat(logP) || 0
  const flowVal = parseFloat(flowRate) || 0.4

  const result = logP && !isNaN(logPVal)
    ? predictRT(logPVal, column, mp, flowVal,
        parseFloat(gradStart), parseFloat(gradEnd), parseFloat(gradTime))
    : null

  const confColor = result?.confidence === 'High' ? 'text-green-600'
    : result?.confidence === 'Medium' ? 'text-orange-500' : 'text-red-500'

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1 flex items-center gap-2">
          <Clock size={20} className="text-indigo-500" />
          Retention Time Predictor
        </h1>
        <p className="text-xs text-slate-400">
          Estimate LC retention time from logP using Linear Solvent Strength (LSS) theory — Snyder & Dolan model
        </p>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex gap-2">
        <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          This is a <strong>theoretical estimate</strong> based on logP and gradient conditions.
          Real RT depends on instrument, column batch, temperature and mobile phase additives.
          Use as a starting point for method scouting — always verify experimentally.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — Inputs */}
        <div className="space-y-4">

          {/* LogP input */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Compound Properties</h2>

            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 block mb-1">
                logP (octanol-water partition coefficient)
              </label>
              <input type="number" value={logP} step="0.1"
                onChange={e => { setLogP(e.target.value); setSelectedClass('') }}
                className="w-full text-lg px-4 py-3 border-2 border-indigo-200 rounded-xl
                  font-mono focus:outline-none focus:ring-4 focus:ring-indigo-500/10
                  focus:border-indigo-500 text-indigo-700" />
              <div className="mt-2 h-2 bg-slate-100 rounded-full relative">
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 via-green-400 to-orange-400" />
                </div>
                <div className="absolute top-0 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full -translate-y-0.5 transition-all"
                  style={{ left: `${Math.min(Math.max((logPVal + 4) / 12 * 100, 0), 100)}%`, transform: 'translateX(-50%) translateY(-12.5%)' }} />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>-4 (very polar)</span>
                <span>0</span>
                <span>+8 (very lipophilic)</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-2">
                Or select compound class
              </label>
              <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1">
                {COMPOUND_CLASSES.map(c => (
                  <button key={c.name}
                    onClick={() => { setLogP(c.logP.toString()); setSelectedClass(c.name) }}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-all border
                      ${selectedClass === c.name
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'border-transparent hover:bg-slate-50 text-slate-600'}`}>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-slate-400 ml-2">logP ≈ {c.logP}</span>
                    <span className="text-slate-400 block text-xs">{c.example}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Column</h2>
            <select value={selectedColumn} onChange={e => setSelectedColumn(parseInt(e.target.value))}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 mb-2">
              {COLUMNS.map((c, i) => (
                <option key={i} value={i}>{c.name} ({c.brand})</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="font-mono font-semibold text-slate-700">{column.length} mm</p>
                <p>Length</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="font-mono font-semibold text-slate-700">{column.diameter} mm</p>
                <p>Diameter</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="font-mono font-semibold text-slate-700">{column.particle} µm</p>
                <p>Particle</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — Conditions + Result */}
        <div className="space-y-4">

          {/* Mobile phase + gradient */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4">Chromatographic Conditions</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Mobile phase system</label>
                <select value={selectedMP} onChange={e => setSelectedMP(parseInt(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700">
                  {MOBILE_PHASES.map((m, i) => (
                    <option key={i} value={i}>{m.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Typical use: {mp.typical}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Flow rate (mL/min)</label>
                  <input type="number" value={flowRate} step="0.05"
                    onChange={e => setFlowRate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                      font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Gradient time (min)</label>
                  <input type="number" value={gradTime}
                    onChange={e => setGradTime(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                      font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Gradient (%B)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={gradStart}
                    onChange={e => setGradStart(e.target.value)}
                    className="w-20 text-sm px-3 py-2 border border-slate-200 rounded-lg
                      font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex-1 h-2 bg-gradient-to-r from-blue-200 to-indigo-500 rounded-full" />
                  <input type="number" value={gradEnd}
                    onChange={e => setGradEnd(e.target.value)}
                    className="w-20 text-sm px-3 py-2 border border-slate-200 rounded-lg
                      font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Initial %B</span>
                  <span>Final %B</span>
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                Predicted Retention Time
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-xl p-4 text-center border border-indigo-100">
                  <p className="text-xs text-slate-500 mb-1">Predicted RT</p>
                  <p className="text-4xl font-bold font-mono text-indigo-700">
                    {result.predictedRT}
                  </p>
                  <p className="text-sm text-slate-400">min</p>
                </div>
                <div className="bg-white rounded-xl p-4 text-center border border-indigo-100">
                  <p className="text-xs text-slate-500 mb-1">Retention factor k'</p>
                  <p className="text-4xl font-bold font-mono text-slate-700">
                    {result.kPrime}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {result.kPrime < 1 ? 'Poor retention' : result.kPrime < 2 ? 'Low retention' : result.kPrime < 10 ? 'Good retention' : 'Strong retention'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">Prediction confidence:</span>
                <span className={`text-xs font-semibold ${confColor}`}>{result.confidence}</span>
              </div>

              {result.notes.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-indigo-100">
                  {result.notes.map((note, i) => (
                    <p key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="text-indigo-400">•</span> {note}
                    </p>
                  ))}
                </div>
              )}

              {/* Scout recommendations */}
              <div className="mt-3 pt-3 border-t border-indigo-200">
                <p className="text-xs font-medium text-slate-600 mb-2">Scouting recommendations</p>
                <div className="space-y-1 text-xs text-slate-500">
                  {result.kPrime < 1 && (
                    <p>⚠️ k' &lt; 1 — try lower initial %B or shorter column</p>
                  )}
                  {result.kPrime > 20 && (
                    <p>⚠️ Very high k' — try steeper gradient or higher initial %B</p>
                  )}
                  {result.kPrime >= 2 && result.kPrime <= 10 && (
                    <p>✓ Good retention — suitable for quantification</p>
                  )}
                  <p>→ Start scouting with {Math.max(parseInt(gradStart)-5, 2)}–{Math.min(parseInt(gradEnd)+5, 98)}% gradient over {gradTime} min</p>
                </div>
              </div>
            </div>
          )}

          {/* Reference */}
          <p className="text-xs text-slate-400">
            Model based on: Snyder LR, Dolan JW. High-Performance Gradient Elution. Wiley, 2007.
            Predictions are estimates only — validate experimentally.
          </p>
        </div>
      </div>
    </div>
  )
}
