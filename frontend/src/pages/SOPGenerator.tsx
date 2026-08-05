import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const GUIDELINES = [
  { id: 'clsi', label: 'CLSI EP15-A3 + EP17-A2 + C62-A', checked: true },
  { id: 'fda', label: 'FDA Bioanalytical Method Validation (2018)', checked: false },
  { id: 'ema', label: 'EMA Bioanalytical Method Validation (2011)', checked: false },
  { id: 'ich', label: 'ICH Q2(R1)', checked: false },
]

const EXPERIMENTS = [
  { id: 'precision', label: 'Intra/Inter-day Precision (EP15-A3)', checked: true },
  { id: 'lloq', label: 'LLOQ/LOD Verification (EP17-A2)', checked: true },
  { id: 'linearity', label: 'Linearity & Calibration Curve', checked: true },
  { id: 'matrix', label: 'Matrix Effects (C62-A)', checked: true },
  { id: 'recovery', label: 'Extraction Recovery', checked: true },
  { id: 'carryover', label: 'Carryover', checked: true },
  { id: 'stability', label: 'Stability (bench-top, freeze-thaw, long-term)', checked: true },
  { id: 'dilution', label: 'Dilution Integrity', checked: false },
  { id: 'selectivity', label: 'Selectivity / Specificity', checked: false },
]

export default function SOPGenerator() {
  const { id } = useParams()
  const [method, setMethod] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [sop, setSop] = useState<string | null>(null)

  // Customization fields
  const [author, setAuthor] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [institution, setInstitution] = useState('')
  const [version, setVersion] = useState('1.0')
  const [language, setLanguage] = useState('English')
  const [guidelines, setGuidelines] = useState(GUIDELINES)
  const [experiments, setExperiments] = useState(EXPERIMENTS)
  const [nDays, setNDays] = useState(5)
  const [nReplicates, setNReplicates] = useState(5)
  const [nQCLevels, setNQCLevels] = useState(3)
  const [nMatrixLots, setNMatrixLots] = useState(6)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [lloqOverride, setLloqOverride] = useState('')
  const [uloqOverride, setUloqOverride] = useState('')

  useEffect(() => {
    axios.get(`${API}/methods/${id}`)
      .then(res => {
        setMethod(res.data)
        setLloqOverride(res.data.lloq || '')
        setUloqOverride(res.data.uloq || '')
      })
      .finally(() => setLoading(false))
  }, [id])

  const toggleGuideline = (gid: string) =>
    setGuidelines(gs => gs.map(g => g.id === gid ? { ...g, checked: !g.checked } : g))

  const toggleExperiment = (eid: string) =>
    setExperiments(es => es.map(e => e.id === eid ? { ...e, checked: !e.checked } : e))

  const generate = async () => {
    setGenerating(true)
    setSop(null)
    setProgress('Preparing method data...')

    try {
      const payload = {
        method_id: parseInt(id!),
        author,
        reviewer,
        institution,
        version,
        language,
        guidelines: guidelines.filter(g => g.checked).map(g => g.label),
        experiments: experiments.filter(e => e.checked).map(e => e.label),
        n_days: nDays,
        n_replicates: nReplicates,
        n_qc_levels: nQCLevels,
        n_matrix_lots: nMatrixLots,
        lloq_override: lloqOverride || null,
        uloq_override: uloqOverride || null,
        additional_notes: additionalNotes,
      }

      setProgress('Claude is generating your validation SOP... (30-60 seconds)')
      const res = await axios.post(`${API}/methods/generate-sop`, payload)
      setSop(res.data.sop)
      setProgress('')
    } catch (e) {
      setProgress('Error generating SOP. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const download = (format: 'md' | 'txt') => {
    if (!sop) return
    const blob = new Blob([sop], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SOP_Validation_${method?.analyte?.split(',')[0]?.trim().replace(/\s+/g,'_')}_v${version}.${format}`
    a.click()
  }

  if (loading) return <div className="text-center py-16 text-slate-400">Loading method...</div>
  if (!method) return <div className="text-center py-16 text-slate-400">Method not found</div>

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link to={`/method/${id}`} className="text-xs text-slate-400 hover:text-slate-600 mb-6 block">
        ← Back to method
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200
          flex items-center justify-center text-2xl shrink-0">
          📋
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Validation SOP Generator</h1>
          <p className="text-sm text-slate-500">
            {method.title}
          </p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {method.matrix}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {method.instrument_manufacturer} {method.instrument_model}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {method.mrm_transitions?.length} transitions
            </span>
          </div>
        </div>
      </div>

      {!sop ? (
        <div className="space-y-6">
          {/* Document Control */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">1</span>
              Document Control
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Author', val: author, set: setAuthor, placeholder: 'Dr. Ana García' },
                { label: 'Reviewer', val: reviewer, set: setReviewer, placeholder: 'Dr. Juan López' },
                { label: 'Institution', val: institution, set: setInstitution, placeholder: 'Hospital Vall d\'Hebron' },
                { label: 'Version', val: version, set: setVersion, placeholder: '1.0' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                  <option>Italian</option>
                </select>
              </div>
            </div>
          </div>

          {/* Analytical Range */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">2</span>
              Analytical Range
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  LLOQ ({method.lloq_unit || 'ng/mL'})
                </label>
                <input type="number" value={lloqOverride}
                  onChange={e => setLloqOverride(e.target.value)}
                  placeholder={method.lloq || 'e.g. 0.5'}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  ULOQ ({method.lloq_unit || 'ng/mL'})
                </label>
                <input type="number" value={uloqOverride}
                  onChange={e => setUloqOverride(e.target.value)}
                  placeholder={method.uloq || 'e.g. 1000'}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
              </div>
            </div>
          </div>

          {/* Regulatory Guidelines */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">3</span>
              Regulatory Guidelines
            </h2>
            <div className="space-y-2">
              {guidelines.map(g => (
                <label key={g.id} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={g.checked}
                    onChange={() => toggleGuideline(g.id)}
                    className="w-4 h-4 accent-indigo-600 rounded" />
                  <span className="text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {g.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Validation Experiments */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">4</span>
              Validation Experiments
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {experiments.map(e => (
                <label key={e.id} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={e.checked}
                    onChange={() => toggleExperiment(e.id)}
                    className="w-4 h-4 accent-indigo-600 rounded" />
                  <span className="text-xs text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {e.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Study Design */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">5</span>
              Study Design
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Validation days', val: nDays, set: setNDays, min: 1, max: 10 },
                { label: 'Replicates/day', val: nReplicates, set: setNReplicates, min: 3, max: 10 },
                { label: 'QC levels', val: nQCLevels, set: setNQCLevels, min: 2, max: 5 },
                { label: 'Matrix lots', val: nMatrixLots, set: setNMatrixLots, min: 3, max: 10 },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
                  <input type="number" value={f.val} min={f.min} max={f.max}
                    onChange={e => f.set(parseInt(e.target.value))}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center" />
                </div>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700
                flex items-center justify-center text-xs font-bold">6</span>
              Additional Notes / Special Requirements
            </h2>
            <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Method is intended for TDM use in ICU patients. Samples stored at -80°C. IS added during protein precipitation..."
              rows={3}
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800
                placeholder-slate-400 resize-none" />
          </div>

          {/* Generate button */}
          <button onClick={generate} disabled={generating}
            className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold
              hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-3 text-sm">
            {generating ? (
              <>
                <span className="animate-spin text-lg">⟳</span>
                {progress}
              </>
            ) : (
              <>📋 Generate Full Validation SOP</>
            )}
          </button>
        </div>
      ) : (
        /* SOP Preview */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">SOP Generated ✓</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {sop.split('\n').length} lines · {Math.round(sop.length / 1000)}k characters
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSop(null)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg
                  text-slate-600 hover:bg-slate-50 transition-all">
                ← Edit parameters
              </button>
              <button onClick={() => download('md')}
                className="px-4 py-2 text-xs bg-slate-900 text-white rounded-lg
                  hover:bg-slate-700 transition-all font-medium">
                ⬇ Download .md
              </button>
              <button onClick={() => download('txt')}
                className="px-4 py-2 text-xs border border-slate-200 rounded-lg
                  text-slate-600 hover:bg-slate-50 transition-all">
                ⬇ Download .txt
              </button>
            </div>
          </div>

          {/* Markdown preview */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-slate-400 ml-2 font-mono">
                SOP_Validation_{method.analyte?.split(',')[0]?.trim()}_v{version}.md
              </span>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {sop}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
