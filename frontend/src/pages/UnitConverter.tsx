import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRightLeft } from 'lucide-react'
import axios from 'axios'
import SEO from '../components/SEO'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

/** Average atomic weights (IUPAC 2021, conventional). Average — not
 *  monoisotopic — is the right mass for concentration conversions. */
const AW: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, S: 32.06, P: 30.974, F: 18.998,
  Cl: 35.45, Br: 79.904, I: 126.904, Na: 22.99, K: 39.098, Li: 6.94, Ca: 40.078,
  Mg: 24.305, Fe: 55.845, Zn: 65.38, Se: 78.971, B: 10.81, Si: 28.085, D: 2.014,
}

function mwFromFormula(formula: string): number | null {
  let total = 0
  const re = /([A-Z][a-z]?)(\d*)/g
  let m: RegExpExecArray | null, matched = 0
  while ((m = re.exec(formula)) !== null) {
    if (!m[0]) break
    const w = AW[m[1]]
    if (!w) return null
    total += w * (m[2] ? parseInt(m[2], 10) : 1)
    matched += m[0].length
  }
  return matched === formula.replace(/\s/g, '').length && total > 0 ? total : null
}

// Everything is converted through ng/mL (mass) and nmol/L (molar).
const MASS_UNITS: { key: string; label: string; toNgMl: number }[] = [
  { key: 'pg/mL', label: 'pg/mL', toNgMl: 0.001 },
  { key: 'ng/mL', label: 'ng/mL (= µg/L)', toNgMl: 1 },
  { key: 'ng/dL', label: 'ng/dL', toNgMl: 0.01 },
  { key: 'ug/dL', label: 'µg/dL', toNgMl: 10 },
  { key: 'ug/mL', label: 'µg/mL (= mg/L)', toNgMl: 1000 },
]
const MOLAR_UNITS: { key: string; label: string; toNmolL: number }[] = [
  { key: 'pmol/L', label: 'pmol/L', toNmolL: 0.001 },
  { key: 'nmol/L', label: 'nmol/L', toNmolL: 1 },
  { key: 'umol/L', label: 'µmol/L', toNmolL: 1000 },
  { key: 'mmol/L', label: 'mmol/L', toNmolL: 1e6 },
]

interface Compound { name: string; formula: string | null }

export default function UnitConverter() {
  const [sp] = useSearchParams()
  const [value, setValue] = useState(sp.get('value') || '')
  const VALID = new Set(['pg/mL','ng/mL','ng/dL','ug/dL','ug/mL','pmol/L','nmol/L','umol/L','mmol/L'])
  const raw = (sp.get('unit') || '').replace('µ','u')
  const [unit, setUnit] = useState(VALID.has(raw) ? raw : 'ng/mL')
  const [mw, setMw] = useState(sp.get('mw') || '')
  const [query, setQuery] = useState(sp.get('analyte') || '')
  const [compounds, setCompounds] = useState<Compound[]>([])
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`${API}/methods/compounds`)
      .then(r => setCompounds(r.data.filter((c: any) => c.formula).map((c: any) => ({ name: c.name, formula: c.formula }))))
      .catch(() => {})
  }, [])

  // Prefill: analyte name from a method sheet → look its formula up once loaded.
  useEffect(() => {
    const target = sp.get('analyte')?.trim().toLowerCase()
    if (!target || mw || compounds.length === 0) return
    const hit = compounds.find(c => c.name.trim().toLowerCase() === target)
    if (hit?.formula) { const w = mwFromFormula(hit.formula); if (w) { setMw(w.toFixed(2)); setPicked(`${hit.name} (${hit.formula})`) } }
  }, [compounds])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2 || picked) return []
    return compounds.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, compounds, picked])

  const pick = (c: Compound) => {
    const w = c.formula ? mwFromFormula(c.formula) : null
    if (w) setMw(w.toFixed(2))
    setPicked(`${c.name} (${c.formula})`)
    setQuery(c.name)
  }

  const mwNum = parseFloat(mw)
  const valNum = parseFloat(value)
  const allUnits = [...MASS_UNITS.map(u => ({ ...u, kind: 'mass' as const })), ...MOLAR_UNITS.map(u => ({ ...u, kind: 'molar' as const }))]
  const current = allUnits.find(u => u.key === unit)

  const results = useMemo(() => {
    if (isNaN(valNum) || isNaN(mwNum) || mwNum <= 0 || !current) return null
    // to canonical
    const ngml = current.kind === 'mass' ? valNum * (current as any).toNgMl : (valNum * (current as any).toNmolL) * mwNum / 1000
    const nmoll = ngml / mwNum * 1000
    return allUnits.map(u => ({
      unit: u, value: u.kind === 'mass' ? ngml / (u as any).toNgMl : nmoll / (u as any).toNmolL,
    }))
  }, [valNum, mwNum, unit, current])

  const fmt = (v: number) => {
    if (v === 0) return '0'
    if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 1 })
    if (Math.abs(v) >= 0.01) return String(Number(v.toPrecision(4)))
    return v.toExponential(2)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <SEO title="Concentration Unit Converter — ng/mL ↔ nmol/L for Clinical LC-MS/MS"
        description="Convert between mass and molar concentration units using the analyte's molecular weight." />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Unit converter</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mass ↔ molar concentration. Clinicians report nmol/L; methods report ng/mL. The molecular weight does the bridging —
        pick an analyte from the repository or type a MW.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <span className="label-caps mb-1 block text-muted-foreground">Analyte (from the repository)</span>
          <Input value={query} onChange={e => { setQuery(e.target.value); setPicked(null) }} placeholder="Start typing… e.g. cortisol" />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {suggestions.map(c => (
                <li key={c.name}>
                  <button type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent">
                    {c.name} <span className="num text-xs text-muted-foreground">{c.formula}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked && <p className="mt-1 text-xs text-muted-foreground">Using {picked}, average MW.</p>}
        </div>
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Molecular weight (g/mol)</span>
          <Input inputMode="decimal" value={mw} onChange={e => { setMw(e.target.value); setPicked(null) }} placeholder="362.46" className="num" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Value</span>
          <Input inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder="25" className="num w-36" />
        </label>
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Unit</span>
          <select value={unit} onChange={e => setUnit(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            <optgroup label="Mass">{MASS_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}</optgroup>
            <optgroup label="Molar">{MOLAR_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}</optgroup>
          </select>
        </label>
        <span className="pb-2 text-muted-foreground"><ArrowRightLeft size={16} /></span>
      </div>

      {results ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(['mass', 'molar'] as const).map(kind => (
            <div key={kind} className="overflow-hidden rounded-lg border border-border">
              <h2 className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kind === 'mass' ? 'Mass units' : 'Molar units'}</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {results.filter(r => r.unit.kind === kind).map(r => (
                    <tr key={r.unit.key} className={cn(r.unit.key === unit && 'bg-primary/5')}>
                      <td className="px-3 py-2 text-muted-foreground">{r.unit.label}</td>
                      <td className="num px-3 py-2 text-right text-foreground">{fmt(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground/70">Enter a value and a molecular weight to convert.</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Average (not monoisotopic) molecular weight is used, computed from the molecular formula — the right mass for amount-of-substance conversions.</p>
    </div>
  )
}
