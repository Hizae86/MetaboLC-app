import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Check, Copy, Loader2 } from 'lucide-react'
import axios from 'axios'
import SEO from '../components/SEO'
import { Input } from '@/components/ui/input'
import { API } from '@/lib/api'
import {
  ADDUCTS, ELEMENTS, NEUTRAL_LOSSES, adductMz, checkTransition, ionFormulaMz, matchAdducts, parseFormula,
  type Mode,
} from '@/lib/massSpec'
import { cn } from '@/lib/utils'
import IssueList from '@/components/IssueList'

interface RepoCompound { name: string; exact_mass: number | null; formula: string | null }
interface Structure { formula: string; monoisotopic_mass: number; formal_charge: number; canonical_smiles: string; fragments_removed: number }

const EXAMPLES = [
  { label: 'Cortisol', formula: 'C21H30O5', smiles: 'C[C@]12CCC(=O)C=C1CC[C@@H]1[C@@H]2[C@@H](O)C[C@@]2(C)[C@H]1CC[C@]2(O)C(=O)CO' },
  { label: 'Testosterone', formula: 'C19H28O2', smiles: 'C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@@]43C)[C@@H]1CC[C@@H]2O' },
  { label: 'Clozapine', formula: 'C18H19ClN4', smiles: 'CN1CCN(CC1)C1=Nc2cc(Cl)ccc2Nc2ccccc12' },
  { label: 'Tacrolimus', formula: 'C44H69NO12', smiles: '' },
  { label: 'Valproic acid', formula: 'C8H16O2', smiles: 'CCCC(CCC)C(=O)O' },
  { label: 'Ethyl glucuronide', formula: 'C8H14O7', smiles: 'CCO[C@@H]1O[C@H](C(=O)O)[C@@H](O)[C@H](O)[C@H]1O' },
]

export default function MassCalculator() {
  const [inputMode, setInputMode] = useState<'formula' | 'smiles'>('formula')
  const [formula, setFormula] = useState('C21H30O5')
  const [smiles, setSmiles] = useState('')
  const [structure, setStructure] = useState<Structure | null>(null)
  const [smilesState, setSmilesState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null })
  const [mode, setMode] = useState<Mode>('+')
  const [showAll, setShowAll] = useState(false)
  const [precursorName, setPrecursorName] = useState('[M+H]+')
  const [lossFormula, setLossFormula] = useState('')
  const [fragFormula, setFragFormula] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [reverseInput, setReverseInput] = useState('')
  const [tolerance, setTolerance] = useState(10)
  const [tolUnit, setTolUnit] = useState<'ppm' | 'mDa'>('ppm')
  const [repo, setRepo] = useState<RepoCompound[]>([])
  const [check, setCheck] = useState({ q1: '', q3: '', polarity: 'ESI+' })

  useEffect(() => {
    axios.get(`${API}/methods/compounds`).then(r => setRepo(r.data.filter((c: any) => c.exact_mass))).catch(() => {})
  }, [])

  // Keep a precursor of the current polarity selected.
  useEffect(() => { setPrecursorName(mode === '+' ? '[M+H]+' : '[M-H]-') }, [mode])

  const parsed = useMemo(() => parseFormula(formula), [formula])
  const charged = /\d*[+-]$/.test(formula.trim())

  const convertSmiles = async (value = smiles) => {
    if (!value.trim()) return
    setSmilesState({ loading: true, error: null })
    try {
      const r = await axios.get<Structure>(`${API}/tools/structure`, { params: { smiles: value.trim() } })
      setStructure(r.data); setFormula(r.data.formula); setSmilesState({ loading: false, error: null })
    } catch (e: any) {
      setStructure(null)
      setSmilesState({ loading: false, error: e?.response?.data?.detail || 'Could not reach the structure service.' })
    }
  }

  const copyVal = (val: string, key: string) => {
    navigator.clipboard.writeText(val)
    setCopied(key); setTimeout(() => setCopied(null), 1500)
  }
  const CopyBtn = ({ val, k }: { val: string; k: string }) => (
    <button type="button" onClick={() => copyVal(val, k)} className="text-muted-foreground/60 hover:text-primary" aria-label={`Copy ${val}`}>
      {copied === k ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  )

  const shown = ADDUCTS.filter(a => a.mode === mode && (showAll || a.common || a.name === precursorName))
  const precursor = ADDUCTS.find(a => a.name === precursorName && a.mode === mode) || ADDUCTS.find(a => a.mode === mode)!
  const precursorMz = parsed.valid ? adductMz(parsed.mono, precursor) : null

  // Product ions: neutral losses from the selected precursor (charge kept), a custom loss and a fragment-ion formula.
  const products = useMemo(() => {
    if (precursorMz === null) return []
    const ionMass = precursorMz * precursor.charge
    // Only losses the molecule can actually lose (no HCl from a molecule without Cl).
    const fits = (f: string) => Object.entries(parseFormula(f).elements).every(([el, n]) => (parsed.elements[el] || 0) >= n)
    const list = NEUTRAL_LOSSES.filter(l => fits(l.formula)).map(l => {
      const p = parseFormula(l.formula)
      return { label: `− ${l.label}`, mz: (ionMass - p.mono) / precursor.charge, loss: p.mono }
    })
    const custom = parseFormula(lossFormula)
    if (lossFormula && custom.valid) list.unshift({ label: `− ${lossFormula} (custom)`, mz: (ionMass - custom.mono) / precursor.charge, loss: custom.mono })
    return list.filter(x => x.mz > 15)
  }, [precursorMz, precursor, lossFormula, parsed])
  const fragMz = fragFormula ? ionFormulaMz(fragFormula, 1, mode) : null

  const reverseMz = parseFloat(reverseInput)
  const reverse = useMemo(() => {
    if (isNaN(reverseMz) || reverseMz <= 0) return []
    return ADDUCTS.filter(a => a.mode === mode && a.common).map(a => {
      const neutral = reverseMz * a.charge - a.delta
      const tolDa = tolUnit === 'ppm' ? neutral * tolerance / 1e6 : tolerance / 1000
      const matches = repo
        .map(c => ({ ...c, diff: (c.exact_mass as number) - neutral }))
        .filter(c => Math.abs(c.diff) <= tolDa)
        .sort((x, y) => Math.abs(x.diff) - Math.abs(y.diff))
        .slice(0, 5)
      return { adduct: a.name, neutral, matches }
    })
  }, [reverseMz, mode, tolerance, tolUnit, repo])

  // Transition check against the current compound.
  const checkIssues = useMemo(() => {
    if (!check.q1 || !check.q3) return null
    return checkTransition({ precursor_mz: check.q1, product_mz: check.q3, polarity: check.polarity },
      { exactMass: parsed.valid && !charged ? parsed.mono : null })
  }, [check, parsed, charged])
  const checkMatches = parsed.valid && check.q1 && !isNaN(Number(check.q1)) ? matchAdducts(Number(check.q1), parsed.mono) : []

  const panel = 'rounded-xl border border-border bg-card p-5'
  const tab = (on: boolean) => cn('px-3 py-1.5 text-xs font-medium', on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SEO title="Mass Calculator — Adduct, Precursor and Product m/z for LC-MS/MS"
        description="Monoisotopic mass from a molecular formula or SMILES, adduct and product-ion m/z, and automatic checks of MRM transitions." />
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground"><Calculator size={19} className="text-primary" /> Mass calculator</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">From a formula or SMILES: monoisotopic mass, precursor and product m/z for each adduct, and a check of your transition.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {/* ── Compound ── */}
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Compound</h2>
              <div className="flex overflow-hidden rounded-lg border border-border" role="tablist" aria-label="Input type">
                <button type="button" role="tab" aria-selected={inputMode === 'formula'} onClick={() => setInputMode('formula')} className={tab(inputMode === 'formula')}>Formula</button>
                <button type="button" role="tab" aria-selected={inputMode === 'smiles'} onClick={() => setInputMode('smiles')} className={tab(inputMode === 'smiles')}>SMILES</button>
              </div>
            </div>

            {inputMode === 'formula' ? (
              <>
                <Input value={formula} onChange={e => { setFormula(e.target.value); setStructure(null) }} placeholder="e.g. C21H30O5, C2H3D3O or C5H14NO+"
                  aria-label="Molecular formula" className={cn('num h-11 text-base', !parsed.valid && formula && 'border-destructive')} />
                {!parsed.valid && formula && <p className="mt-1 text-xs text-destructive">{parsed.error || 'Invalid formula'}</p>}
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input value={smiles} onChange={e => setSmiles(e.target.value)} onKeyDown={e => e.key === 'Enter' && convertSmiles()}
                    placeholder="e.g. CCCC(CCC)C(=O)O" aria-label="SMILES" className="num h-11 text-sm" />
                  <button type="button" onClick={() => convertSmiles()} disabled={!smiles.trim() || smilesState.loading}
                    className="inline-flex h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    {smilesState.loading && <Loader2 size={14} className="animate-spin" />} Calculate
                  </button>
                </div>
                {smilesState.error && <p className="mt-1 text-xs text-destructive">{smilesState.error}</p>}
                {structure && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    RDKit: <span className="num font-medium text-foreground">{structure.formula}</span>
                    {structure.fragments_removed > 0 && ` · ${structure.fragments_removed} counter-ion${structure.fragments_removed > 1 ? 's' : ''} removed`}
                    {structure.formal_charge !== 0 && ' · permanently charged: use the [M]+ / [M]− row'}
                  </p>
                )}
              </>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAMPLES.filter(x => inputMode === 'formula' || x.smiles).map(x => (
                <button key={x.label} type="button"
                  onClick={() => { if (inputMode === 'formula') { setFormula(x.formula); setStructure(null) } else { setSmiles(x.smiles); convertSmiles(x.smiles) } }}
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">{x.label}</button>
              ))}
            </div>

            {parsed.valid && (
              <>
                <div className="mt-4 rounded-lg bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">Monoisotopic mass{charged ? ' (neutral atoms; see [M]± for the ion)' : ''}</p>
                  <div className="flex items-center gap-2">
                    <p className="num text-3xl font-bold text-primary">{parsed.mono.toFixed(6)}</p>
                    <span className="text-sm text-muted-foreground">Da</span>
                    <span className="ml-auto"><CopyBtn val={parsed.mono.toFixed(6)} k="mass" /></span>
                  </div>
                  <p className="num mt-1.5 text-xs text-muted-foreground">Average mass: {parsed.avg.toFixed(3)} g/mol</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1.5">
                  {Object.entries(parsed.elements).map(([el, count]) => (
                    <div key={el} className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                      <span className="text-xs font-semibold text-foreground">{el}{count > 1 ? <sub>{count}</sub> : null}</span>
                      <span className="num text-xs text-muted-foreground">{(ELEMENTS[el].mono * count).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Transition check ── */}
          <div className={panel}>
            <h2 className="text-sm font-semibold text-foreground">Check a transition</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Q1 and Q3 of your method against the compound above: the product must be lighter than a singly charged precursor, and the polarity must match the adduct.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={check.q1} onChange={e => setCheck(c => ({ ...c, q1: e.target.value.replace(',', '.') }))} placeholder="Q1" aria-label="Precursor m/z" inputMode="decimal" className="num w-28" />
              <span className="text-muted-foreground">›</span>
              <Input value={check.q3} onChange={e => setCheck(c => ({ ...c, q3: e.target.value.replace(',', '.') }))} placeholder="Q3" aria-label="Product m/z" inputMode="decimal" className="num w-28" />
              <select value={check.polarity} onChange={e => setCheck(c => ({ ...c, polarity: e.target.value }))} aria-label="Transition polarity"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                {['ESI+', 'ESI-', 'APCI+', 'APCI-'].map(p => <option key={p}>{p}</option>)}
              </select>
              {precursorMz !== null && (
                <button type="button" onClick={() => setCheck(c => ({ ...c, q1: precursorMz.toFixed(2), polarity: mode === '+' ? 'ESI+' : 'ESI-' }))}
                  className="text-xs font-medium text-primary hover:underline">Use {precursor.name}</button>
              )}
            </div>
            {checkIssues && (
              <div className="mt-3 space-y-2">
                {checkMatches.length > 0 && (
                  <p className="text-xs text-muted-foreground">Q1 matches {checkMatches.slice(0, 3).map(m => `${m.adduct.name} (${m.mz.toFixed(4)}, Δ ${m.diff >= 0 ? '+' : ''}${m.diff.toFixed(3)})`).join(' · ')}</p>
                )}
                <IssueList issues={checkIssues} okText="Consistent: product below the precursor and polarity matches the adduct." />
                {!parsed.valid && <p className="text-xs text-muted-foreground">Enter the compound to check Q1 against its adducts.</p>}
              </div>
            )}
          </div>

          {/* ── Reverse search ── */}
          <div className={panel}>
            <h2 className="text-sm font-semibold text-foreground">Reverse search</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Observed m/z → neutral mass per adduct, matched against the repository's analytes.</p>
            <div className="flex flex-wrap gap-2">
              <Input value={reverseInput} onChange={e => setReverseInput(e.target.value)} placeholder="e.g. 363.2171" inputMode="decimal" aria-label="Observed m/z" className="num w-36" />
              <Input type="number" value={tolerance} onChange={e => setTolerance(parseFloat(e.target.value) || 0)} aria-label="Tolerance" className="num w-20" />
              <select value={tolUnit} onChange={e => setTolUnit(e.target.value as any)} aria-label="Tolerance unit"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
                <option>ppm</option><option>mDa</option>
              </select>
            </div>
            {reverse.length > 0 && (
              <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
                {reverse.map(r => (
                  <div key={r.adduct} className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="num text-xs font-medium text-primary">{r.adduct}</span>
                      <span className="num text-xs text-foreground">M = {r.neutral.toFixed(4)} Da</span>
                    </div>
                    {r.matches.length > 0 && (
                      <div className="mt-1 space-y-0.5 border-t border-border pt-1">
                        {r.matches.map(c => (
                          <div key={c.name} className="flex items-center justify-between text-xs">
                            <Link to={`/methods?q=${encodeURIComponent(c.name)}`} className="text-foreground hover:text-primary">{c.name}</Link>
                            <span className="num text-muted-foreground">
                              {c.formula} · Δ {tolUnit === 'ppm' ? `${(c.diff / r.neutral * 1e6).toFixed(1)} ppm` : `${(c.diff * 1000).toFixed(1)} mDa`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {reverse.every(r => r.matches.length === 0) && (
                  <p className="text-xs text-muted-foreground">No repository analyte matches within ±{tolerance} {tolUnit}. The neutral masses above may still identify your compound elsewhere.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* ── Precursor ions ── */}
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Precursor ions</h2>
                <p className="text-xs text-muted-foreground">Click a row to use it as the precursor for product ions.</p>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-border" role="tablist" aria-label="Adduct polarity">
                {(['+', '-'] as const).map(m => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={tab(mode === m)}>ESI{m === '+' ? '+' : '−'}</button>
                ))}
              </div>
            </div>
            {parsed.valid ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 text-left font-medium">Adduct</th>
                      <th className="py-2 text-left font-medium">z</th>
                      <th className="py-2 text-right font-medium">m/z</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {shown.map(a => {
                      const mz = adductMz(parsed.mono, a)
                      const sel = a.name === precursor.name
                      return (
                        <tr key={a.name} onClick={() => setPrecursorName(a.name)} aria-selected={sel}
                          className={cn('cursor-pointer hover:bg-accent/40', sel && 'bg-primary/5')}>
                          <td className={cn('num py-2', sel ? 'font-semibold text-primary' : 'text-foreground')}>{sel ? '● ' : ''}{a.name}</td>
                          <td className="num py-2 text-muted-foreground">{a.charge}{a.mode}</td>
                          <td className={cn('num py-2 text-right', sel ? 'font-semibold text-primary' : 'text-foreground')}>{mz.toFixed(4)}</td>
                          <td className="py-2 pl-2 text-right" onClick={e => e.stopPropagation()}><CopyBtn val={mz.toFixed(4)} k={a.name} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <button type="button" onClick={() => setShowAll(s => !s)} className="mt-3 text-xs font-medium text-primary hover:underline">
                  {showAll ? 'Show common only' : `Show all adducts (${ADDUCTS.filter(a => a.mode === mode).length})`}
                </button>
              </>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground/60">
                <Calculator size={30} className="mb-2" />
                <p className="text-sm">Enter a valid formula or SMILES to see adducts</p>
              </div>
            )}
          </div>

          {/* ── Product ions ── */}
          {precursorMz !== null && (
            <div className={panel}>
              <h2 className="text-sm font-semibold text-foreground">Product ions from <span className="num text-primary">{precursor.name} {precursorMz.toFixed(4)}</span></h2>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">Common neutral losses (the charge stays on the fragment), a loss of your own, or the formula of the fragment ion itself.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">Neutral loss formula
                  <Input value={lossFormula} onChange={e => setLossFormula(e.target.value)} placeholder="e.g. C2H6O" className="num mt-1" />
                </label>
                <label className="text-xs text-muted-foreground">Fragment ion formula
                  <Input value={fragFormula} onChange={e => setFragFormula(e.target.value)} placeholder="e.g. C7H7 (tropylium)" className="num mt-1" />
                </label>
              </div>
              {fragFormula && (
                <p className="mt-2 text-xs">
                  {fragMz === null ? <span className="text-destructive">Invalid fragment formula</span> : (
                    <span className="text-muted-foreground">Fragment {fragFormula}{mode === '+' ? '⁺' : '⁻'} m/z <span className="num font-semibold text-foreground">{fragMz.toFixed(4)}</span>
                      {' '}· transition <span className="num text-foreground">{precursorMz.toFixed(2)} › {fragMz.toFixed(2)}</span>
                      {fragMz >= precursorMz && precursor.charge === 1 && <span className="ml-1 text-destructive">heavier than the precursor</span>}
                    </span>
                  )}
                </p>
              )}
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">Loss</th>
                    <th className="py-2 text-right font-medium">Δ mass</th>
                    <th className="py-2 text-right font-medium">Product m/z</th>
                    <th className="py-2 text-right font-medium">Transition</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map(p => (
                    <tr key={p.label}>
                      <td className="py-1.5 text-xs text-foreground">{p.label}</td>
                      <td className="num py-1.5 text-right text-xs text-muted-foreground">{p.loss.toFixed(4)}</td>
                      <td className="num py-1.5 text-right text-foreground">{p.mz.toFixed(4)}</td>
                      <td className="num py-1.5 text-right text-xs text-muted-foreground">{precursorMz.toFixed(1)} › {p.mz.toFixed(1)}</td>
                      <td className="py-1.5 pl-2 text-right"><CopyBtn val={p.mz.toFixed(4)} k={p.label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Predicted from mass arithmetic only: confirm which fragments form with a product-ion scan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
