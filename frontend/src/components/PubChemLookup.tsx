import { useState } from 'react'
import { usePubChem } from '../hooks/usePubChem'

interface Props {
  compoundName: string
  observedMz?: number
}

export default function PubChemLookup({ compoundName, observedMz }: Props) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const { lookup, loading, error } = usePubChem()

  const handleLookup = async () => {
    setOpen(true)
    if (!data) {
      const result = await lookup(compoundName, observedMz)
      setData(result)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleLookup}
        className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-500
          hover:bg-blue-50 hover:text-blue-600 ring-1 ring-slate-200
          hover:ring-blue-200 transition-all font-medium"
        title="Look up in PubChem">
        PubChem ↗
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white border border-slate-200
            rounded-xl shadow-lg p-4 w-80"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{compoundName}</p>
                <a href={data ? `https://pubchem.ncbi.nlm.nih.gov/compound/${data.cid}` : '#'}
                  target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline">
                  {data ? `CID: ${data.cid}` : 'PubChem'}
                </a>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            {loading && (
              <div className="text-center py-6 text-sm text-slate-400">
                Looking up in PubChem…
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg p-3">
                {error}
              </div>
            )}

            {data && !loading && (
              <div className="space-y-3">
                {/* Formula and mass */}
                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Formula</span>
                    <span className="text-sm font-mono font-semibold text-slate-800">
                      {data.formula}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Exact mass</span>
                    <span className="text-sm font-mono text-slate-700">
                      {data.exactMass.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Adducts */}
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                    Adducts
                    {observedMz && <span className="ml-1 normal-case text-blue-500">
                      — observed Q1: {observedMz}
                    </span>}
                  </p>
                  <div className="space-y-1">
                    {data.adducts.slice(0, 6).map((a: any, i: number) => (
                      <div key={a.name}
                        className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg text-xs
                          ${i === 0 && observedMz && a.diff < 0.02
                            ? 'bg-green-50 ring-1 ring-green-200'
                            : 'hover:bg-slate-50'}`}>
                        <span className="font-mono font-medium text-slate-700">{a.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-slate-600">{a.mz}</span>
                          {observedMz && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-mono
                              ${a.diff < 0.02
                                ? 'bg-green-100 text-green-700'
                                : a.diff < 0.1
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'text-slate-400'}`}>
                              {a.diff < 0.001 ? '✓ match' : `Δ${a.diff}`}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best match */}
                {observedMz && data.adducts[0]?.diff < 0.02 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-green-700 font-medium">
                      ✓ Best match: <span className="font-mono">{data.adducts[0].name}</span>
                      <span className="ml-1 text-green-500">(Δ{data.adducts[0].diff} m/z)</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
