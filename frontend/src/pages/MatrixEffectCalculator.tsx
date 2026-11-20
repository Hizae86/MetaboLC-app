import { useState } from 'react'
import { AlertTriangle, CheckCircle, Download, Plus, TestTubes, Trash2, XCircle } from 'lucide-react'
import SEO from '../components/SEO'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface CompoundData {
  id: number; name: string
  areaA: string; areaB: string; areaC: string
  isAreaA: string; isAreaB: string; isAreaC: string
}

let nextId = 4
const blank = (id: number, name: string): CompoundData => ({ id, name, areaA: '', areaB: '', areaC: '', isAreaA: '', isAreaB: '', isAreaC: '' })

function calcResults(c: CompoundData, useIS: boolean) {
  const A = parseFloat(c.areaA), B = parseFloat(c.areaB), C = parseFloat(c.areaC)
  const iA = parseFloat(c.isAreaA), iB = parseFloat(c.isAreaB), iC = parseFloat(c.isAreaC)
  if (!A || !B || !C) return null
  if (useIS && (!iA || !iB || !iC)) return null
  const nA = useIS ? A / iA : A, nB = useIS ? B / iB : B, nC = useIS ? C / iC : C
  const me = nB / nA * 100, re = nC / nB * 100, pe = nC / nA * 100
  return {
    matrixEffect: +me.toFixed(1), extractionEff: +re.toFixed(1),
    processEff: +pe.toFixed(1), ionSuppression: +(me - 100).toFixed(1),
    normalized: useIS,
  }
}

const tone = (ok: boolean, warn: boolean) => ok ? 'text-success' : warn ? 'text-warning' : 'text-destructive'
const grade = (v: number, type: 'me' | 'er' | 'pe') => {
  if (type === 'me') return { ok: v >= 85 && v <= 115, warn: (v >= 70 && v < 85) || (v > 115 && v <= 130) }
  if (type === 'er') return { ok: v >= 60, warn: v >= 40 && v < 60 }
  return { ok: v >= 50, warn: v >= 30 && v < 50 }
}

function StatusIcon({ v, type }: { v: number; type: 'me' | 'er' | 'pe' }) {
  const g = grade(v, type)
  if (g.ok) return <CheckCircle size={13} className="shrink-0 text-success" />
  if (g.warn) return <AlertTriangle size={13} className="shrink-0 text-warning" />
  return <XCircle size={13} className="shrink-0 text-destructive" />
}

function Bar({ value, type }: { value: number; type: 'me' | 'er' | 'pe' }) {
  const g = grade(value, type)
  const pct = Math.min(Math.max(value, 0), 150)
  return (
    <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-muted">
      <div className="absolute bottom-0 top-0 w-px bg-border" style={{ left: '66.6%' }} title="100%" />
      <div className={cn('h-full rounded-full transition-all', g.ok ? 'bg-success' : g.warn ? 'bg-warning' : 'bg-destructive')}
        style={{ width: `${pct / 150 * 100}%` }} />
    </div>
  )
}

function MetricBlock({ label, value, type, sub }: { label: string; value: number; type: 'me' | 'er' | 'pe'; sub: string }) {
  const g = grade(value, type)
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5"><StatusIcon v={value} type={type} /><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={cn('num text-2xl font-bold', tone(g.ok, g.warn))}>{value}%</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      <Bar value={value} type={type} />
    </div>
  )
}

export default function MatrixEffectCalculator() {
  const [compounds, setCompounds] = useState<CompoundData[]>([blank(1, 'Analyte 1'), blank(2, 'Analyte 2'), blank(3, 'Analyte 3')])
  const [useIS, setUseIS] = useState(false)
  const [nLots, setNLots] = useState(6)

  const update = (id: number, field: keyof CompoundData, val: string) =>
    setCompounds(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c))
  const results = compounds.map(c => ({ compound: c, result: calcResults(c, useIS) }))

  const exportResults = () => {
    const lines = [
      'Koiné — Matrix Effect & Recovery Calculator',
      'Method: Matuszewski et al., Anal Chem 2003;75:3019-3030',
      '===============================================', '',
      'DEFINITIONS:',
      '  Set A: Analyte in neat solvent',
      '  Set B: Post-extraction matrix spike',
      '  Set C: Pre-extraction matrix spike',
      useIS ? '  All responses normalized to the internal standard.' : '  Absolute (non-normalized) responses.', '',
      'RESULTS:',
      'Compound\tMatrix Effect (%)\tIon Suppression (%)\tExtraction Recovery (%)\tProcess Efficiency (%)',
      ...results.filter(r => r.result).map(({ compound, result }) =>
        `${compound.name}\t${result!.matrixEffect}\t${result!.ionSuppression}\t${result!.extractionEff}\t${result!.processEff}`), '',
      'ACCEPTANCE CRITERIA:',
      '  Matrix Effect: 85-115% (IS-normalized)',
      '  Extraction Recovery: >=60% (consistent, CV <=15%)',
      '  Process Efficiency: >=50%',
      '  Reference: CLSI C62, FDA BMV 2018, EMA BMV 2011',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'matrix_effect_recovery.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  const cell = (c: CompoundData, f: keyof CompoundData, ph: string) => (
    <Input type="number" value={c[f] as string} onChange={e => update(c.id, f, e.target.value)} placeholder={ph} className="num h-8 text-xs" />
  )
  const panel = 'rounded-xl border border-border bg-card'

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <SEO title="Matrix Effect & Recovery Calculator — Matuszewski Method"
        description="Ion suppression, extraction recovery and process efficiency from the three-set Matuszewski experiment." />
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground"><TestTubes size={19} className="text-primary" /> Matrix effect &amp; recovery</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Ion suppression and extraction efficiency — Matuszewski three-set design.</p>
      </div>

      <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm">
        <p className="mb-1 font-semibold text-foreground">Three-set experiment (Matuszewski 2003)</p>
        <div className="grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-3">
          <p><span className="font-semibold text-phase-a">Set A</span> — analyte in neat solvent</p>
          <p><span className="font-semibold text-warning">Set B</span> — spiked into extracted blank matrix</p>
          <p><span className="font-semibold text-success">Set C</span> — spiked before extraction</p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Test at least <span className="num text-foreground">{nLots}</span> individual matrix lots (CLSI C62).</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <div className={cn(panel, 'p-5')}>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Settings</h2>
            <label className="block">
              <span className="label-caps mb-1 block text-muted-foreground">Matrix lots</span>
              <Input type="number" min={3} max={20} value={nLots} onChange={e => setNLots(parseInt(e.target.value) || 6)} className="num" />
              <span className="mt-1 block text-xs text-muted-foreground">Minimum 6 per CLSI C62</span>
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={useIS} onChange={e => setUseIS(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
              <span>
                <span className="block text-xs font-medium text-foreground">IS-normalized matrix factor</span>
                <span className="block text-xs text-muted-foreground">Adds IS area columns; each response is divided by its IS response</span>
              </span>
            </label>
          </div>

          <div className={cn(panel, 'p-4')}>
            <p className="label-caps mb-3 text-muted-foreground">Equations</p>
            <div className="num space-y-1.5 text-xs text-foreground">
              <p>ME% = B / A × 100</p>
              <p>RE% = C / B × 100</p>
              <p>PE% = C / A × 100</p>
            </div>
            <p className="label-caps mb-2 mt-4 text-muted-foreground">Acceptance</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>ME <span className="num text-foreground">85–115%</span> (IS-normalized)</p>
              <p>RE <span className="num text-foreground">≥60%</span>, CV ≤15%</p>
              <p>PE <span className="num text-foreground">≥50%</span></p>
            </div>
          </div>

          <Button className="w-full" onClick={exportResults}><Download size={14} /> Export results (.txt)</Button>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className={cn(panel, 'overflow-hidden')}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Peak area data</h2>
              <Button variant="outline" size="sm" onClick={() => setCompounds(cs => [...cs, blank(nextId++, `Analyte ${cs.length + 1}`)])}><Plus size={12} /> Add compound</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Compound</th>
                    <th className="px-2 py-2 text-center font-medium text-phase-a">Set A{useIS && ' · analyte'}</th>
                    <th className="px-2 py-2 text-center font-medium text-warning">Set B{useIS && ' · analyte'}</th>
                    <th className="px-2 py-2 text-center font-medium text-success">Set C{useIS && ' · analyte'}</th>
                    {useIS && <>
                      <th className="px-2 py-2 text-center font-medium text-phase-a">A · IS</th>
                      <th className="px-2 py-2 text-center font-medium text-warning">B · IS</th>
                      <th className="px-2 py-2 text-center font-medium text-success">C · IS</th>
                    </>}
                    <th className="w-9"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {compounds.map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-1.5">
                        <Input value={c.name} onChange={e => update(c.id, 'name', e.target.value)} className="h-8 w-28 text-xs" />
                      </td>
                      <td className="px-2 py-1.5">{cell(c, 'areaA', 'Area A')}</td>
                      <td className="px-2 py-1.5">{cell(c, 'areaB', 'Area B')}</td>
                      <td className="px-2 py-1.5">{cell(c, 'areaC', 'Area C')}</td>
                      {useIS && <>
                        <td className="px-2 py-1.5">{cell(c, 'isAreaA', 'IS A')}</td>
                        <td className="px-2 py-1.5">{cell(c, 'isAreaB', 'IS B')}</td>
                        <td className="px-2 py-1.5">{cell(c, 'isAreaC', 'IS C')}</td>
                      </>}
                      <td className="px-2 py-1.5">
                        <button type="button" onClick={() => setCompounds(cs => cs.filter(x => x.id !== c.id))} aria-label="Remove"
                          className="rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-destructive"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {useIS && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">With IS normalization on, a row needs all six areas before results appear.</p>}
          </div>

          {results.some(r => r.result) && (
            <div className={cn(panel, 'overflow-hidden')}>
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Results{useIS && <span className="ml-2 text-xs font-normal text-muted-foreground">IS-normalized</span>}</h2>
              <div className="space-y-4 p-4">
                {results.map(({ compound, result }) => result && (
                  <div key={compound.id} className="rounded-lg border border-border p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">{compound.name}</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <MetricBlock label="Matrix effect" value={result.matrixEffect} type="me"
                        sub={`${result.ionSuppression > 0 ? '+' : ''}${result.ionSuppression}% ion ${result.ionSuppression > 0 ? 'enhancement' : 'suppression'}`} />
                      <MetricBlock label="Extraction recovery" value={result.extractionEff} type="er" sub="Target: ≥60%" />
                      <MetricBlock label="Process efficiency" value={result.processEff} type="pe" sub="Target: ≥50%" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Matuszewski BK, Constanzer ML, Chavez-Eng CM. <em>Anal Chem.</em> 2003;75(13):3019–3030.
          </p>
        </div>
      </div>
    </div>
  )
}
