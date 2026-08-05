import { useState } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MATRICES = ['Plasma', 'Serum', 'Urine', 'Whole blood', 'Dried blood spot', 'CSF', 'Saliva']
const APPLICATIONS = [
  'Therapeutic Drug Monitoring', 'Endocrinology', 'Toxicology',
  'Newborn screening', 'Oncology', 'Immunosuppressants', 'Vitamins',
  'Catecholamines', 'Steroids', 'Drugs of abuse'
]
const VENDORS = ['Sciex', 'Waters', 'Thermo Fisher', 'Agilent', 'Shimadzu']
const IONIZATIONS = ['ESI+', 'ESI-', 'APCI+', 'APCI-']

interface DraftResult {
  column: string
  mobile_phase_a: string
  mobile_phase_b: string
  gradient: string
  flow_rate: string
  ionization: string
  source_temp: string
  sample_prep: string
  lloq_estimate: string
  notes: string
}

export default function MethodDraftGenerator() {
  const [matrix, setMatrix] = useState('')
  const [analytes, setAnalytes] = useState('')
  const [application, setApplication] = useState('')
  const [vendor, setVendor] = useState('')
  const [ionization, setIonization] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!matrix || !analytes.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const prompt = `You are Dra. Massa, an expert LC-MS/MS clinical laboratory scientist.
A user wants to develop a new LC-MS/MS method with these parameters:
- Matrix: ${matrix}
- Target analytes: ${analytes}
- Clinical application: ${application || 'not specified'}
- Preferred vendor: ${vendor || 'any'}
- Ionization mode: ${ionization || 'not specified'}

Based on the MetaboLC repository knowledge and analytical chemistry best practices, suggest a complete method draft. Format your response as:

**Column:** [recommendation]
**Mobile phase A:** [recommendation]
**Mobile phase B:** [recommendation]
**Gradient:** [brief description, e.g. 0-1min 5%B, 1-4min 5-95%B, 4-5min 95%B]
**Flow rate:** [recommendation]
**Ionization:** [mode and key parameters]
**Source temperature:** [recommendation]
**Sample prep:** [recommended approach with rationale]
**Estimated LLOQ:** [typical range for these analytes]
**Key notes:** [2-3 practical tips for this method]

Be specific and practical. Base recommendations on analytical chemistry principles for the specific matrix and analytes.`

      const res = await axios.post(`${API}/methods/chat`, { message: prompt })
      setResult(res.data.response)
    } catch {
      setError('Could not generate draft. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const renderResult = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.includes(':**')) {
        const [label, ...rest] = line.replace(/\*\*/g, '').split(':')
        return (
          <div key={i} className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider w-32 shrink-0 pt-0.5">
              {label}
            </span>
            <span className="text-xs text-slate-800 flex-1">{rest.join(':').trim()}</span>
          </div>
        )
      }
      if (line.trim()) {
        return <p key={i} className="text-xs text-slate-600 mt-1">{line}</p>
      }
      return null
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Matrix */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">
            Matrix <span className="text-red-400">*</span>
          </label>
          <select value={matrix} onChange={e => setMatrix(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800">
            <option value="">Select matrix…</option>
            {MATRICES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Application */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Application</label>
          <select value={application} onChange={e => setApplication(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800">
            <option value="">Select application…</option>
            {APPLICATIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Vendor */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Preferred vendor</label>
          <select value={vendor} onChange={e => setVendor(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800">
            <option value="">Any vendor</option>
            {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Ionization */}
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Ionization mode</label>
          <select value={ionization} onChange={e => setIonization(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
              bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800">
            <option value="">Not specified</option>
            {IONIZATIONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* Analytes */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">
          Target analytes <span className="text-red-400">*</span>
        </label>
        <textarea
          value={analytes}
          onChange={e => setAnalytes(e.target.value)}
          placeholder="e.g. Testosterone, Estradiol, DHEA-S, Progesterone"
          rows={2}
          className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg
            bg-white focus:outline-none focus:ring-2 focus:ring-teal-500
            text-slate-800 placeholder-slate-400 resize-none"
        />
      </div>

      {/* Generate button */}
      <button onClick={generate}
        disabled={!matrix || !analytes.trim() || loading}
        className="w-full py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl
          hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2">
        {loading ? (
          <>
            <span className="animate-spin text-base">⟳</span>
            Generating method draft…
          </>
        ) : (
          <>✨ Generate method draft</>
        )}
      </button>

      {/* Result */}
      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}

      {result && (
        <div className="border border-teal-200 bg-teal-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🧪</span>
            <p className="text-xs font-semibold text-teal-800">
              Method draft for {analytes.split(',')[0].trim()} in {matrix}
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="ml-auto text-xs px-2 py-1 border border-teal-200 rounded-lg
                text-teal-600 hover:bg-teal-100 transition-all">
              Copy
            </button>
          </div>
          <div className="space-y-0">
            {renderResult(result)}
          </div>
        </div>
      )}
    </div>
  )
}
