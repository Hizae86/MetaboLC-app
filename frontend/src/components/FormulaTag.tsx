import { useState, useEffect } from 'react'

const cache: Record<string, { formula: string; exactMass: number } | null> = {}

export default function FormulaTag({ compoundName }: { compoundName: string }) {
  const [data, setData] = useState<{ formula: string; exactMass: number } | null>(
    cache[compoundName] ?? undefined as any
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cache[compoundName] !== undefined) {
      setData(cache[compoundName])
      return
    }
    setLoading(true)
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compoundName)}/property/MolecularFormula,ExactMass/JSON`)
      .then(r => r.json())
      .then(d => {
        const props = d.PropertyTable?.Properties?.[0]
        const result = props ? { formula: props.MolecularFormula, exactMass: parseFloat(props.ExactMass) } : null
        cache[compoundName] = result
        setData(result)
      })
      .catch(() => { cache[compoundName] = null; setData(null) })
      .finally(() => setLoading(false))
  }, [compoundName])

  if (loading) return <span className="text-xs text-slate-300 font-mono animate-pulse">…</span>
  if (!data) return null

  return (
    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md
      ring-1 ring-slate-200 shrink-0">
      {data.formula}
    </span>
  )
}
