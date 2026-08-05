import { useState, useRef } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Props {
  methodId: number
  ionizationMode?: string
}

export default function ChromatogramUpload({ methodId, ionizationMode }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/methods/${methodId}/chromatogram`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useState(() => { load() })

  const upload = async (file: File) => {
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      await axios.post(`${API}/methods/${methodId}/chromatogram`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const formatIntensity = (val: number) => {
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
    return val.toString()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
      Loading chromatogram…
    </div>
  )

  return (
    <div className="space-y-4">
      {!data ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f) }}
          className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center
            cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all">
          <div className="text-3xl mb-3">📈</div>
          <p className="text-sm font-medium text-slate-700 mb-1">
            Upload chromatogram (.cdf)
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Export from Analyst, MassLynx, Xcalibur or any AIA/ANDI compatible software
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {['Analyst (.cdf)', 'MassLynx (.cdf)', 'Xcalibur (.cdf)', 'LabSolutions (.cdf)'].map(s => (
              <span key={s} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">{s}</span>
            ))}
          </div>
          {uploading ? (
            <p className="text-sm text-blue-500 animate-pulse">Uploading and parsing…</p>
          ) : (
            <button className="px-4 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-all">
              Select .cdf file
            </button>
          )}
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'RT range', val: `${data.stats.rt_start}–${data.stats.rt_end} min` },
              { label: 'Apex RT', val: `${data.stats.apex_rt} min` },
              { label: 'Max intensity', val: formatIntensity(data.stats.max_intensity) + ' cps' },
              { label: 'Data points', val: data.stats.total_points.toLocaleString() },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">{s.label}</p>
                <p className="text-sm font-semibold font-mono text-slate-800">{s.val}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Total Ion Chromatogram (TIC)</p>
                <p className="text-xs text-slate-400">{ionizationMode || 'ESI+'} · {data.stats.rt_end} min run</p>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg
                  text-slate-500 hover:bg-slate-50 transition-all">
                Replace file
              </button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.trace} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis
                  dataKey="rt"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={v => `${v.toFixed(1)}`}
                  label={{ value: 'RT (min)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis
                  tickFormatter={formatIntensity}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  width={50}
                />
                <Tooltip
                  formatter={(val: number) => [formatIntensity(val) + ' cps', 'Intensity']}
                  labelFormatter={rt => `RT: ${Number(rt).toFixed(3)} min`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e2e8f0' }}
                />
                <ReferenceLine y={data.stats.baseline} stroke="#e2e8f0" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="intensity"
                  stroke="#4f46e5"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#4f46e5' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Metadata */}
          {data.metadata && Object.keys(data.metadata).length > 0 && (
            <details className="border border-slate-200 rounded-lg">
              <summary className="px-4 py-2.5 text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-50">
                File metadata
              </summary>
              <div className="px-4 pb-3 grid grid-cols-2 gap-1">
                {Object.entries(data.metadata).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-slate-400">{k}: </span>
                    <span className="text-slate-600 font-mono">{String(v).slice(0, 50)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".cdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
    </div>
  )
}
