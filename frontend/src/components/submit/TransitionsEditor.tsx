import { useRef, useState } from 'react'
import { AlertTriangle, ClipboardPaste, FileUp, Plus, Trash2, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { checkTransition, worstLevel } from '@/lib/massSpec'
import { parseTransitions, type DraftTransition, type ImportResult } from '@/lib/transitionImport'
import { transitionParams } from '@/lib/vendors'
import { cn } from '@/lib/utils'
import { inputCls } from './fields'

const cell = 'num h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 text-right text-xs text-foreground outline-none hover:border-input focus:border-ring'
const EXAMPLE = 'Compound\tQ1\tQ3\tCE\tRT\nCortisol\t363.2\t121.1\t30\t2.8\nCortisol\t363.2\t97.1\t35\t2.8\nCortisol-d4\t367.2\t121.1\t30\t2.8'

const roleOf = (t: DraftTransition) => (t.is_internal_standard ? 'IS' : t.is_quantifier ? 'Quant' : 'Qual')

/** Transition table with import. Importing is the main path: nobody should
 *  have to retype an acquisition list that already exists as a file. */
export default function TransitionsEditor({ rows, onChange, manufacturer, ionization }: {
  rows: DraftTransition[]; onChange: (rows: DraftTransition[]) => void; manufacturer: string; ionization?: string
}) {
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [summary, setSummary] = useState<(ImportResult & { failed?: boolean }) | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const vendor = transitionParams(manufacturer)
  const vendorCols = vendor.fields
    .map((field, i) => ({ field, label: vendor.headers[i] }))
    .filter(c => c.field !== 'polarity' && c.field !== 'collision_energy_ev' && c.field !== 'ms_resolution')
  const numeric = [
    { field: 'precursor_mz', label: 'Q1 (m/z)' }, { field: 'product_mz', label: 'Q3 (m/z)' },
    { field: 'retention_time_min', label: 'RT (min)' }, { field: 'collision_energy_ev', label: 'CE (eV)' }, ...vendorCols,
  ]

  const importText = (raw: string) => {
    const result = parseTransitions(raw)
    if (result.rows.length === 0) { setSummary({ ...result, failed: true }); return }
    onChange([...rows, ...result.rows])
    setSummary(result); setPasting(false); setText('')
  }
  const onFile = async (file?: File) => { if (file) importText(await file.text()); if (fileRef.current) fileRef.current.value = '' }
  const set = (i: number, patch: Partial<DraftTransition>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } as DraftTransition : r)))
  const setRole = (i: number, role: string) => set(i, { is_internal_standard: role === 'IS' ? 1 : 0, is_quantifier: role === 'Qual' ? 0 : 1 })
  const blank = (isIS: 0 | 1): DraftTransition => ({ compound_name: '', is_internal_standard: isIS, is_quantifier: 1, precursor_mz: '', product_mz: '', polarity: 'ESI+' })

  // Live checks: product lighter than precursor, polarity coherent with the method.
  const issues = rows.map(t => checkTransition(t, { methodIonization: ionization }).filter(i => i.level !== 'info'))
  const flagged = issues.filter(x => x.length).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => { setPasting(p => !p); setSummary(null) }}><ClipboardPaste /> Paste from Excel or CSV</Button>
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><FileUp /> Upload .csv / .tsv</Button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        <span className="text-xs text-muted-foreground">Skyline transition lists and vendor exports work as they are.</span>
      </div>

      {pasting && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={6} autoFocus spellCheck={false}
            placeholder={EXAMPLE} aria-label="Transition list to import"
            className={cn(inputCls, 'num h-auto py-2 text-xs leading-relaxed')} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" disabled={!text.trim()} onClick={() => importText(text)}>Import rows</Button>
            <Button type="button" variant="ghost" onClick={() => { setPasting(false); setText('') }}>Cancel</Button>
            <span className="text-xs text-muted-foreground">Columns are matched by header name, in any order. Without a header: compound, Q1, Q3, CE, RT.</span>
          </div>
        </div>
      )}

      {summary && (
        <div role="status" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
          summary.failed ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/5')}>
          <div className="flex-1 space-y-0.5 text-foreground">
            {summary.failed ? (
              <p>No transitions found. The list needs a compound name, a precursor (Q1) and a product (Q3) m/z in each row.</p>
            ) : (
              <>
                <p><span className="num font-semibold">{summary.rows.length}</span> transitions imported. Columns read: {summary.recognised.join(', ')}.</p>
                {summary.skipped > 0 && <p className="text-muted-foreground"><span className="num">{summary.skipped}</span> {summary.skipped === 1 ? 'row' : 'rows'} skipped (missing name or m/z).</p>}
                {summary.ignored.length > 0 && <p className="text-muted-foreground">Columns not used: {summary.ignored.join(', ')}.</p>}
                {summary.inferredRoles && <p className="text-muted-foreground">No role column: the first transition of each compound is marked Quant, and labelled names (d3, 13C, IS) as internal standards. Check them below.</p>}
              </>
            )}
          </div>
          <button type="button" onClick={() => setSummary(null)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">Compound</th>
                <th className="px-1 py-2 text-left font-medium">Role</th>
                {numeric.map(c => <th key={c.field} className="whitespace-nowrap px-1.5 py-2 text-right font-medium">{c.label}</th>)}
                <th className="px-1 py-2 text-left font-medium">Pol.</th>
                <th className="w-6"><span className="sr-only">Check</span></th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="min-w-40 px-1 py-0.5">
                    <input value={t.compound_name} onChange={e => set(i, { compound_name: e.target.value })} placeholder="Compound name"
                      aria-label={`Compound, row ${i + 1}`} className={cn(cell, 'text-left font-sans')} />
                  </td>
                  <td className="px-1 py-0.5">
                    <select value={roleOf(t)} onChange={e => setRole(i, e.target.value)} aria-label={`Role, row ${i + 1}`}
                      className={cn(cell, 'w-[4.5rem] text-left font-sans', t.is_internal_standard ? 'text-istd' : t.is_quantifier ? 'text-quant' : 'text-qual')}>
                      {['Quant', 'Qual', 'IS'].map(r => <option key={r} className="bg-popover text-foreground">{r}</option>)}
                    </select>
                  </td>
                  {numeric.map(c => (
                    <td key={c.field} className="w-20 px-0.5 py-0.5">
                      <input inputMode="decimal" value={String(t[c.field] ?? '')} onChange={e => set(i, { [c.field]: e.target.value.replace(',', '.') })}
                        aria-label={`${c.label}, row ${i + 1}`} className={cell} />
                    </td>
                  ))}
                  <td className="px-1 py-0.5">
                    <select value={String(t.polarity ?? 'ESI+')} onChange={e => set(i, { polarity: e.target.value })} aria-label={`Polarity, row ${i + 1}`} className={cn(cell, 'w-16 text-left')}>
                      {['ESI+', 'ESI-', 'APCI+', 'APCI-'].map(p => <option key={p} className="bg-popover">{p}</option>)}
                    </select>
                  </td>
                  <td className="w-6 px-0.5 text-center">
                    {issues[i].length > 0 && (
                      <span title={issues[i].map(x => x.message).join(' ')} aria-label={issues[i].map(x => x.message).join(' ')}
                        className={worstLevel(issues[i]) === 'error' ? 'text-destructive' : 'text-warning'}>
                        {worstLevel(issues[i]) === 'error' ? <XCircle size={13} className="inline" /> : <AlertTriangle size={13} className="inline" />}
                      </span>
                    )}
                  </td>
                  <td className="px-1 text-center">
                    <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} aria-label={`Remove row ${i + 1}`}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, blank(0)])}><Plus /> Add transition</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...rows, blank(1)])}><Plus /> Add internal standard</Button>
        {rows.length > 0 && (
          <>
            {flagged > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-warning" title="Hover the icon in each row for details">
                <AlertTriangle size={12} /> {flagged} to check: product heavier than precursor, or polarity unlike the method
              </span>
            )}
            <span className={cn('num text-xs text-muted-foreground', !flagged && 'ml-auto')}>{rows.length} transitions</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange([]); setSummary(null) }}>Clear all</Button>
          </>
        )}
      </div>
    </div>
  )
}
