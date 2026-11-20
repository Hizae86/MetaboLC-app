import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Beaker, Check, Copy, Download, Plus, Trash2 } from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Mass and molar units are separate families: converting between them needs
 *  the molecular weight, so mixing them here is flagged instead of silently
 *  assumed 1:1 (use the Unit Converter for the bridge). */
const MASS_UNITS = ['ng/mL', 'pg/mL', 'µg/mL', 'mg/mL', 'µg/dL', 'ng/dL'] as const
const MOLAR_UNITS = ['nmol/L', 'pmol/L', 'µmol/L', 'mmol/L'] as const
const CONC_UNITS = [...MASS_UNITS, ...MOLAR_UNITS]
const VOL_UNITS = ['µL', 'mL', 'L'] as const

const toBaseFactor: Record<string, number> = {
  'ng/mL': 1, 'pg/mL': 0.001, 'µg/mL': 1000, 'mg/mL': 1e6, 'µg/dL': 10, 'ng/dL': 0.01,
  'nmol/L': 1, 'pmol/L': 0.001, 'µmol/L': 1000, 'mmol/L': 1e6,
}
const toUL: Record<string, number> = { 'µL': 1, 'mL': 1000, 'L': 1e6 }
const family = (u: string) => (MOLAR_UNITS as readonly string[]).includes(u) ? 'molar' : 'mass'

interface Level { id: number; name: string; conc: string; concUnit: string; volume: string; volUnit: string; replicates: number }

const LEVEL_PRESETS: Record<string, { name: string; concMult: number; replicates: number }[]> = {
  'CLSI 3 QC levels': [
    { name: 'QC Low', concMult: 3, replicates: 5 },
    { name: 'QC Mid', concMult: 15, replicates: 5 },
    { name: 'QC High', concMult: 75, replicates: 5 },
  ],
  'FDA QC set': [
    { name: 'LLOQ QC', concMult: 1, replicates: 5 },
    { name: 'QC Low', concMult: 3, replicates: 5 },
    { name: 'QC Mid', concMult: 30, replicates: 5 },
    { name: 'QC High', concMult: 75, replicates: 5 },
  ],
  'Calibration curve (6pt)': [
    { name: 'Cal 1 (LLOQ)', concMult: 1, replicates: 3 },
    { name: 'Cal 2', concMult: 3, replicates: 3 },
    { name: 'Cal 3', concMult: 10, replicates: 3 },
    { name: 'Cal 4', concMult: 30, replicates: 3 },
    { name: 'Cal 5', concMult: 100, replicates: 3 },
    { name: 'Cal 6 (ULOQ)', concMult: 300, replicates: 3 },
  ],
}

let nextId = 10
const fmtVol = (ul: number) => ul >= 1000 ? `${(ul / 1000).toFixed(2)} mL` : ul >= 10 ? `${ul.toFixed(1)} µL` : `${ul.toFixed(2)} µL`

function UnitSelect({ value, onChange, units }: { value: string; onChange: (v: string) => void; units: readonly string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="h-9 shrink-0 rounded-md border border-input bg-background px-1.5 text-xs text-foreground">
      {units.map(u => <option key={u}>{u}</option>)}
    </select>
  )
}

export default function DilutionCalculator() {
  const [mode, setMode] = useState<'direct' | 'serial' | 'working'>('direct')
  const [copied, setCopied] = useState<string | null>(null)
  const [stock, setStock] = useState({ name: 'Working stock', conc: '1', concUnit: 'µg/mL', volume: '1', volUnit: 'mL' })
  const [diluent, setDiluent] = useState('Water / mobile phase A')
  const [levels, setLevels] = useState<Level[]>([
    { id: 1, name: 'LLOQ', conc: '0.5', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5 },
    { id: 2, name: 'QC Low', conc: '1.5', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5 },
    { id: 3, name: 'QC Mid', conc: '10', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5 },
    { id: 4, name: 'QC High', conc: '75', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 5 },
  ])
  const [serialSteps, setSerialSteps] = useState([
    { id: 1, dilutionFactor: '10', volume: '1', volUnit: 'mL' },
    { id: 2, dilutionFactor: '10', volume: '1', volUnit: 'mL' },
    { id: 3, dilutionFactor: '10', volume: '1', volUnit: 'mL' },
  ])
  const [working, setWorking] = useState({ conc: '100', concUnit: 'ng/mL', volume: '10', volUnit: 'mL' })

  const updateLevel = (id: number, field: keyof Level, val: any) =>
    setLevels(ls => ls.map(l => l.id === id ? { ...l, [field]: val } : l))

  const applyPreset = (key: string) => {
    const base = parseFloat(levels[0]?.conc || '0.5')
    setLevels(LEVEL_PRESETS[key].map(item => ({
      id: nextId++, name: item.name, conc: String(base * item.concMult),
      concUnit: levels[0]?.concUnit || 'ng/mL', volume: levels[0]?.volume || '1',
      volUnit: levels[0]?.volUnit || 'mL', replicates: item.replicates,
    })))
  }

  const stockBase = (parseFloat(stock.conc) || 0) * toBaseFactor[stock.concUnit]
  const stockFam = family(stock.concUnit)
  const stockVolUL = (parseFloat(stock.volume) || 0) * toUL[stock.volUnit]

  const calc = (concStr: string, concUnit: string, volStr: string, volUnit: string, replicates = 1) => {
    const famMismatch = family(concUnit) !== stockFam
    const targetBase = (parseFloat(concStr) || 0) * toBaseFactor[concUnit]
    const totalVolUL = (parseFloat(volStr) || 0) * toUL[volUnit] * replicates
    const stockVol = !famMismatch && stockBase > 0 ? targetBase * totalVolUL / stockBase : 0
    const factor = !famMismatch && targetBase > 0 ? stockBase / targetBase : 0
    let warning: string | undefined
    if (famMismatch) warning = 'mixed-units'
    else if (stockVol > totalVolUL) warning = 'Target exceeds the stock concentration'
    else if (factor > 10000) warning = 'Dilution factor > 10,000 — use a serial dilution'
    else if (stockVol > 0 && stockVol < 1) warning = 'Pipetting under 1 µL — prepare an intermediate dilution'
    return { targetBase, totalVolUL, stockVol, diluentVol: totalVolUL - stockVol, factor, famMismatch, warning }
  }

  const results = levels.map(l => ({ level: l, ...calc(l.conc, l.concUnit, l.volume, l.volUnit, l.replicates) }))
  const totalStockUsed = results.reduce((s, r) => s + (r.famMismatch ? 0 : r.stockVol), 0)
  const w = calc(working.conc, working.concUnit, working.volume, working.volUnit)

  const serialResults = (() => {
    let conc = stockBase
    return serialSteps.map(step => {
      const factor = parseFloat(step.dilutionFactor) || 1
      const volUL = (parseFloat(step.volume) || 0) * toUL[step.volUnit]
      const inputConc = conc
      conc = conc / factor
      return { step, factor, volUL, inputConc, resultConc: conc, stockNeeded: volUL / factor, diluentNeeded: volUL - volUL / factor }
    })
  })()

  const copyVal = (val: string, key: string) => {
    navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(null), 1500)
  }

  const exportProtocol = () => {
    const lines = [
      'Koiné — Dilution Calculator Protocol', '=========================================',
      `Stock: ${stock.name} | ${stock.conc} ${stock.concUnit} | ${stock.volume} ${stock.volUnit}`,
      `Diluent: ${diluent}`, '', 'PREPARATION', '-----------',
    ]
    results.forEach((r, i) => {
      lines.push(`\n${i + 1}. ${r.level.name} (${r.level.conc} ${r.level.concUnit}, ${r.level.replicates}x ${r.level.volume} ${r.level.volUnit})`)
      if (r.famMismatch) { lines.push('   SKIPPED: stock and target are in different unit families (mass vs molar).'); return }
      lines.push(`   Stock volume: ${r.stockVol.toFixed(2)} µL`)
      lines.push(`   Diluent volume: ${r.diluentVol.toFixed(2)} µL`)
      lines.push(`   Dilution factor: 1:${r.factor.toFixed(1)}`)
      if (r.warning) lines.push(`   WARNING: ${r.warning}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'dilution_protocol.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const panel = 'rounded-xl border border-border bg-card'
  const mismatchNote = (
    <span className="text-xs text-warning">
      Mass ↔ molar needs the molecular weight — <Link to="/tools/unit-converter" className="underline">convert first</Link>
    </span>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SEO title="Dilution Calculator — Calibrators, QCs & Working Solutions"
        description="Exact stock and diluent volumes for calibration curves, QC levels and serial dilutions." />
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground"><Beaker size={19} className="text-primary" /> Dilution calculator</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Calibrators, QC samples and working solutions with exact volumes.</p>
      </div>

      <div className="mb-5 flex w-fit gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {([['direct', 'Direct dilution'], ['serial', 'Serial dilution'], ['working', 'Working solution']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setMode(id)}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
        ))}
      </div>

      <div className={cn(panel, 'mb-5 p-4')}>
        <p className="label-caps mb-3 text-muted-foreground">Stock &amp; diluent</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Name</span>
            <Input value={stock.name} onChange={e => setStock(s => ({ ...s, name: e.target.value }))} /></label>
          <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Concentration</span>
            <div className="flex gap-1">
              <Input type="number" value={stock.conc} onChange={e => setStock(s => ({ ...s, conc: e.target.value }))} className="num min-w-0" />
              <UnitSelect value={stock.concUnit} onChange={v => setStock(s => ({ ...s, concUnit: v }))} units={CONC_UNITS} />
            </div></label>
          <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Available volume</span>
            <div className="flex gap-1">
              <Input type="number" value={stock.volume} onChange={e => setStock(s => ({ ...s, volume: e.target.value }))} className="num min-w-0" />
              <UnitSelect value={stock.volUnit} onChange={v => setStock(s => ({ ...s, volUnit: v }))} units={VOL_UNITS} />
            </div></label>
          <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Diluent</span>
            <Input value={diluent} onChange={e => setDiluent(e.target.value)} /></label>
        </div>
      </div>

      {mode === 'direct' && (
        <div className={cn(panel, 'overflow-hidden')}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Target levels</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(LEVEL_PRESETS).map(k => (
                <button key={k} type="button" onClick={() => applyPreset(k)}
                  className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  title="Builds the levels from the first level's concentration">{k}</button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLevels(ls => [...ls, { id: nextId++, name: `Level ${ls.length + 1}`, conc: '', concUnit: 'ng/mL', volume: '1', volUnit: 'mL', replicates: 3 }])}><Plus size={12} /> Add</Button>
              <Button size="sm" onClick={exportProtocol}><Download size={12} /> Export</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Level</th>
                  <th className="px-2 py-2 text-left font-medium">Target conc.</th>
                  <th className="px-2 py-2 text-left font-medium">Vol / replicate</th>
                  <th className="px-2 py-2 text-left font-medium">Repl.</th>
                  <th className="px-2 py-2 text-right font-medium">Stock</th>
                  <th className="px-2 py-2 text-right font-medium">Diluent</th>
                  <th className="px-2 py-2 text-right font-medium">Factor</th>
                  <th className="w-9"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {results.map(r => (
                  <tr key={r.level.id} className={cn(r.warning && !r.famMismatch && 'bg-warning/[0.05]')}>
                    <td className="px-3 py-1.5"><Input value={r.level.name} onChange={e => updateLevel(r.level.id, 'name', e.target.value)} className="h-8 w-28 text-xs" /></td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Input type="number" value={r.level.conc} onChange={e => updateLevel(r.level.id, 'conc', e.target.value)} className="num h-8 w-20 text-xs" />
                        <UnitSelect value={r.level.concUnit} onChange={v => updateLevel(r.level.id, 'concUnit', v)} units={CONC_UNITS} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <Input type="number" value={r.level.volume} onChange={e => updateLevel(r.level.id, 'volume', e.target.value)} className="num h-8 w-16 text-xs" />
                        <UnitSelect value={r.level.volUnit} onChange={v => updateLevel(r.level.id, 'volUnit', v)} units={VOL_UNITS} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5"><Input type="number" min={1} value={r.level.replicates} onChange={e => updateLevel(r.level.id, 'replicates', parseInt(e.target.value) || 1)} className="num h-8 w-14 text-xs" /></td>
                    {r.famMismatch ? (
                      <td colSpan={3} className="px-2 py-1.5 text-center">{mismatchNote}</td>
                    ) : (
                      <>
                        <td className="num px-2 py-1.5 text-right font-semibold text-primary">
                          {r.stockVol > 0 ? fmtVol(r.stockVol) : '—'}
                          {r.stockVol > 0 && (
                            <button type="button" onClick={() => copyVal(r.stockVol.toFixed(2), `s${r.level.id}`)} className="ml-1 align-middle text-muted-foreground/60 hover:text-primary">
                              {copied === `s${r.level.id}` ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                            </button>
                          )}
                        </td>
                        <td className="num px-2 py-1.5 text-right text-foreground">{r.diluentVol > 0 ? fmtVol(r.diluentVol) : '—'}</td>
                        <td className="num px-2 py-1.5 text-right text-muted-foreground">{r.factor > 0 ? `1:${r.factor >= 100 ? r.factor.toFixed(0) : r.factor.toFixed(1)}` : '—'}</td>
                      </>
                    )}
                    <td className="px-2 py-1.5"><button type="button" onClick={() => setLevels(ls => ls.filter(l => l.id !== r.level.id))} aria-label="Remove" className="rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-destructive"><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>Total stock used: <span className={cn('num', totalStockUsed > stockVolUL ? 'font-semibold text-destructive' : 'text-foreground')}>{fmtVol(totalStockUsed)}</span> of {fmtVol(stockVolUL)} available{totalStockUsed > stockVolUL && ' — not enough stock'}</span>
            {results.filter(r => r.warning && !r.famMismatch).map(r => (
              <span key={r.level.id} className="text-warning">{r.level.name}: {r.warning}</span>
            ))}
          </div>
        </div>
      )}

      {mode === 'serial' && (
        <div className={cn(panel, 'overflow-hidden')}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Serial dilution from stock</h2>
            <Button variant="outline" size="sm" onClick={() => setSerialSteps(ss => [...ss, { id: Date.now(), dilutionFactor: '10', volume: '1', volUnit: 'mL' }])}><Plus size={12} /> Add step</Button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Step</th>
                <th className="px-2 py-2 text-left font-medium">Factor (1:x)</th>
                <th className="px-2 py-2 text-left font-medium">Final volume</th>
                <th className="px-2 py-2 text-right font-medium">Previous sol.</th>
                <th className="px-2 py-2 text-right font-medium">Diluent</th>
                <th className="px-2 py-2 text-right font-medium">Result ({stock.concUnit.includes('mol') ? 'nmol/L' : 'ng/mL'} eq.)</th>
                <th className="w-9"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {serialResults.map((r, i) => (
                <tr key={r.step.id}>
                  <td className="num px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5"><Input type="number" value={r.step.dilutionFactor} onChange={e => setSerialSteps(ss => ss.map(s => s.id === r.step.id ? { ...s, dilutionFactor: e.target.value } : s))} className="num h-8 w-20 text-xs" /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Input type="number" value={r.step.volume} onChange={e => setSerialSteps(ss => ss.map(s => s.id === r.step.id ? { ...s, volume: e.target.value } : s))} className="num h-8 w-16 text-xs" />
                      <UnitSelect value={r.step.volUnit} onChange={v => setSerialSteps(ss => ss.map(s => s.id === r.step.id ? { ...s, volUnit: v } : s))} units={VOL_UNITS} />
                    </div>
                  </td>
                  <td className="num px-2 py-1.5 text-right font-semibold text-primary">{fmtVol(r.stockNeeded)}</td>
                  <td className="num px-2 py-1.5 text-right text-foreground">{fmtVol(r.diluentNeeded)}</td>
                  <td className="num px-2 py-1.5 text-right text-foreground">{r.resultConc >= 1 ? r.resultConc.toFixed(2) : r.resultConc.toPrecision(3)}</td>
                  <td className="px-2 py-1.5"><button type="button" onClick={() => setSerialSteps(ss => ss.filter(s => s.id !== r.step.id))} aria-label="Remove" className="rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-destructive"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">Each step takes the listed volume of the previous solution and tops up with diluent to the final volume.</p>
        </div>
      )}

      {mode === 'working' && (
        <div className={cn(panel, 'max-w-xl p-5')}>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Working solution</h2>
          <p className="mb-4 text-xs text-muted-foreground">One solution at a target concentration and volume, straight from the stock.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Target concentration</span>
              <div className="flex gap-1">
                <Input type="number" value={working.conc} onChange={e => setWorking(s => ({ ...s, conc: e.target.value }))} className="num min-w-0" />
                <UnitSelect value={working.concUnit} onChange={v => setWorking(s => ({ ...s, concUnit: v }))} units={CONC_UNITS} />
              </div></label>
            <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Final volume</span>
              <div className="flex gap-1">
                <Input type="number" value={working.volume} onChange={e => setWorking(s => ({ ...s, volume: e.target.value }))} className="num min-w-0" />
                <UnitSelect value={working.volUnit} onChange={v => setWorking(s => ({ ...s, volUnit: v }))} units={VOL_UNITS} />
              </div></label>
          </div>
          <div className="mt-4 rounded-lg bg-primary/5 p-4 text-sm">
            {w.famMismatch ? mismatchNote : w.stockVol > 0 ? (
              <>
                <p className="text-foreground">Pipette <span className="num font-bold text-primary">{fmtVol(w.stockVol)}</span> of {stock.name.toLowerCase()} and add <span className="num font-bold text-foreground">{fmtVol(w.diluentVol)}</span> of {diluent.toLowerCase()}.</p>
                <p className="num mt-1 text-xs text-muted-foreground">Dilution 1:{w.factor >= 100 ? w.factor.toFixed(0) : w.factor.toFixed(1)}</p>
                {w.warning && <p className="mt-1 text-xs text-warning">{w.warning}</p>}
              </>
            ) : <p className="text-muted-foreground">Enter a target below the stock concentration.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
