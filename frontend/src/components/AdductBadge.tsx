import { useState, useEffect } from 'react'

const ADDUCTS = [
  { name: 'M+H',     delta: 1.007276,   mode: '+' },
  { name: 'M+Na',    delta: 22.989218,  mode: '+' },
  { name: 'M+K',     delta: 38.963158,  mode: '+' },
  { name: 'M+NH4',   delta: 18.034164,  mode: '+' },
  { name: 'M+2H',    delta: 1.007276,   mode: '+', charge: 2 },
  { name: 'M-H',     delta: -1.007276,  mode: '-' },
  { name: 'M+Cl',    delta: 34.969402,  mode: '-' },
  { name: 'M+FA-H',  delta: 44.997655,  mode: '-' },
  { name: 'M+OAc-H', delta: 59.013305,  mode: '-' },
  { name: 'M-2H',    delta: -1.007276,  mode: '-', charge: 2 },
]

const massCache: Record<string, number | null> = {}

export default function AdductBadge({
  compoundName, precursorMz, ionMode
}: {
  compoundName: string
  precursorMz: number
  ionMode?: string
}) {
  const [best, setBest] = useState<{ name: string; diff: number } | null>(null)

  useEffect(() => {
    const run = async () => {
      let exactMass = massCache[compoundName]
      if (exactMass === undefined) {
        try {
          const r = await fetch(
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(compoundName)}/property/ExactMass/JSON`
          )
          const d = await r.json()
          exactMass = parseFloat(d.PropertyTable.Properties[0].ExactMass)
          massCache[compoundName] = exactMass
        } catch {
          massCache[compoundName] = null
          return
        }
      }
      if (!exactMass) return

      const mode = ionMode?.includes('-') ? '-' : '+'
      const candidates = ADDUCTS
        .filter((a: any) => a.mode === mode)
        .map((a: any) => {
          const mz = a.charge ? (exactMass! + a.delta * a.charge) / a.charge : exactMass! + a.delta
          const diff = Math.abs(mz - precursorMz)
          return { name: a.name, diff: parseFloat(diff.toFixed(4)) }
        })
        .sort((a, b) => a.diff - b.diff)

      if (candidates[0]?.diff < 0.05) setBest(candidates[0])
    }
    run()
  }, [compoundName, precursorMz, ionMode])

  if (!best) return null

  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded font-medium
      ${best.diff < 0.01
        ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
        : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'}`}
      title={`Δ ${best.diff} m/z from theoretical`}>
      {best.name}
    </span>
  )
}
