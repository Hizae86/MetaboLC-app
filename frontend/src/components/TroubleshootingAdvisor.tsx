import { useState } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const PROBLEMS = [
  'Peak tailing', 'Peak fronting', 'Low signal / sensitivity',
  'High background noise', 'Matrix effects / ion suppression',
  'Poor retention time reproducibility', 'Ghost peaks',
  'Poor linearity', 'High carryover', 'Split peaks',
  'Co-elution / poor resolution', 'High CV between injections',
]

const PHASES = ['C18 RP', 'C8 RP', 'HILIC', 'Phenyl', 'Mixed mode']
const IONIZATIONS = ['ESI+', 'ESI-', 'APCI+', 'APCI-']
const MATRICES = ['Plasma', 'Serum', 'Urine', 'Whole blood', 'DBS', 'CSF']

export default function TroubleshootingAdvisor() {
  const [problem, setProblem] = useState('')
  const [analyte, setAnalyte] = useState('')
  const [phase, setPhase] = useState('')
  const [ionization, setIonization] = useState('')
  const [matrix, setMatrix] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const troubleshoot = async () => {
    if (!problem) return
    setLoading(true)
    setResult(null)
    try {
      const prompt = `You are Dra. Massa, an expert LC-MS/MS troubleshooting specialist.
A laboratory scientist is experiencing this problem:

Problem: ${problem}
Analyte: ${analyte || 'not specified'}
Stationary phase: ${phase || 'not specified'}
Ionization: ${ionization || 'not specified'}
Matrix: ${matrix || 'not specified'}
Additional details: ${details || 'none'}

Provide a structured troubleshooting guide. Format as:

**Most likely causes:**
[list 2-3 most probable root causes]

**Diagnostic steps:**
[step-by-step approach to identify the cause]

**Solutions:**
[specific solutions for each cause]

**Prevention:**
[how to avoid this issue in the future]

Be practical, specific, and concise. Focus on actionable advice.`

      const res = await axios.post(`${API}/methods/chat`, { message: prompt })
      setResult(res.data.response)
    } catch {
      setResult('Could not get troubleshooting advice. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Problem */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Problem <span className="text-red-400">*</span>
          </label>
          <select value={problem} onChange={e => setProblem(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800">
            <option value="">Select the problem…</option>
            {PROBLEMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Analyte</label>
          <input value={analyte} onChange={e => setAnalyte(e.target.value)}
            placeholder="e.g. Tacrolimus"
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400
              text-slate-800 placeholder-slate-400" />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Matrix</label>
          <select value={matrix} onChange={e => setMatrix(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800">
            <option value="">Select…</option>
            {MATRICES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Stationary phase</label>
          <select value={phase} onChange={e => setPhase(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800">
            <option value="">Select…</option>
            {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Ionization</label>
          <select value={ionization} onChange={e => setIonization(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-slate-800">
            <option value="">Select…</option>
            {IONIZATIONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Additional details</label>
        <textarea value={details} onChange={e => setDetails(e.target.value)}
          placeholder="e.g. Problem started after column change, affects only high-concentration samples…"
          rows={2}
          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
            bg-white focus:outline-none focus:ring-2 focus:ring-orange-400
            text-slate-800 placeholder-slate-400 resize-none" />
      </div>

      <button onClick={troubleshoot}
        disabled={!problem || loading}
        className="w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl
          hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2">
        {loading ? (
          <><span className="animate-spin">⟳</span> Analyzing problem…</>
        ) : (
          <>🔬 Get troubleshooting advice</>
        )}
      </button>

      {result && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🔧</span>
            <p className="text-xs font-semibold text-orange-800">Troubleshooting: {problem}</p>
            <button onClick={() => navigator.clipboard.writeText(result)}
              className="ml-auto text-xs px-2 py-1 border border-orange-200 rounded-lg
                text-orange-600 hover:bg-orange-100 transition-all">
              Copy
            </button>
          </div>
          {result.split('\n').map((line, i) => {
            if (line.startsWith('**') && line.endsWith('**')) {
              return <p key={i} className="text-xs font-semibold text-orange-800 mt-2">
                {line.replace(/\*\*/g, '')}
              </p>
            }
            if (line.trim()) return <p key={i} className="text-xs text-slate-700">{line}</p>
            return null
          })}
        </div>
      )}
    </div>
  )
}
