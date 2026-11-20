import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SearchCheck } from 'lucide-react'
import axios from 'axios'
import SEO from '../components/SEO'
import { MatrixBadge, Verified } from '@/components/method/badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mz, num } from '@/lib/format'
import { cn } from '@/lib/utils'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'
const TOLS = [0.1, 0.2, 0.5, 1.0]

interface Hit {
  compound_name: string; is_internal_standard: boolean; is_quantifier: boolean
  precursor_mz: number; product_mz: number; collision_energy_ev: number | null
  retention_time_min: number | null; polarity: string | null
  method_id: number; method_title: string; matrix: string; status: string
}

/** Isobaric-interference check: your Q1 (and optionally Q3) against every
 *  transition stored in the repository. Unlike a generic calculator, this
 *  only exists because the repository data exists. */
export default function InterferenceChecker() {
  const [sp] = useSearchParams()
  const [q1, setQ1] = useState(sp.get('q1') || '')
  const [q3, setQ3] = useState(sp.get('q3') || '')
  const [tol, setTol] = useState(parseFloat(sp.get('tol') || '0.5') || 0.5)
  const exclude = sp.get('exclude')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')

  const run = (p1 = q1, p3 = q3, t = tol) => {
    const v1 = parseFloat(p1)
    if (isNaN(v1)) return
    setState('loading')
    const params: Record<string, string> = { q1: String(v1), tol: String(t) }
    const v3 = parseFloat(p3); if (!isNaN(v3)) params.q3 = String(v3)
    if (exclude) params.exclude = exclude
    axios.get(`${API}/methods/transitions/match`, { params })
      .then(r => { setHits(r.data); setState('done') })
      .catch(() => setState('error'))
  }

  useEffect(() => { if (sp.get('q1')) run(sp.get('q1')!, sp.get('q3') || '', tol) }, [])  // prefill from a method sheet

  const groups = useMemo(() => {
    if (!hits) return []
    const map = new Map<string, Hit[]>()
    hits.forEach(h => map.set(h.compound_name, [...(map.get(h.compound_name) || []), h]))
    return [...map.entries()]
  }, [hits])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <SEO title="MRM Interference Checker — Isobaric Overlaps Across Clinical LC-MS/MS Methods"
        description="Check a Q1/Q3 transition against every method in the repository to spot isobaric interferences." />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Interference checker</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Enter a transition and see every analyte in the repository that shares it within the tolerance.
        Same Q1/Q3 on a co-eluting compound means your peak may not be what you think it is —
        that's what chromatographic separation and qualifier ratios are for.
      </p>

      <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); run() }}>
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Q1 (precursor m/z)</span>
          <Input required inputMode="decimal" value={q1} onChange={e => setQ1(e.target.value)} placeholder="309.1" className="num w-36" />
        </label>
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Q3 (product m/z, optional)</span>
          <Input inputMode="decimal" value={q3} onChange={e => setQ3(e.target.value)} placeholder="281.1" className="num w-36" />
        </label>
        <label className="block">
          <span className="label-caps mb-1 block text-muted-foreground">Tolerance (±)</span>
          <div className="flex gap-1">
            {TOLS.map(t => (
              <button key={t} type="button" onClick={() => setTol(t)}
                className={cn('num rounded-md border px-2.5 py-2 text-xs', t === tol ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {t}
              </button>
            ))}
          </div>
        </label>
        <Button type="submit" disabled={state === 'loading'}><SearchCheck size={15} /> {state === 'loading' ? 'Checking…' : 'Check'}</Button>
      </form>

      {state === 'error' && <p className="mt-6 text-sm text-destructive">Couldn't reach the backend. Is it running?</p>}

      {state === 'done' && hits && (
        hits.length === 0 ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            No stored transition falls within ±{tol} of {q1}{q3 && <> → {q3}</>}. That's no guarantee of selectivity — the repository only knows the analytes it holds — but nothing here collides.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              <span className="num text-foreground">{hits.length}</span> transition{hits.length === 1 ? '' : 's'} from{' '}
              <span className="num text-foreground">{groups.length}</span> compound{groups.length === 1 ? '' : 's'} within ±{tol}.
              {groups.length > 1 && ' Different compounds sharing your transition are the ones to worry about.'}
            </p>
            {groups.map(([name, rows]) => (
              <section key={name} className="overflow-hidden rounded-lg border border-border">
                <h2 className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">{name}
                  {rows[0].is_internal_standard && <span className="ml-2 rounded border border-istd/40 bg-istd/10 px-1.5 text-[11px] font-semibold text-istd">IS</span>}
                </h2>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {rows.map((h, i) => (
                      <tr key={i} className="hover:bg-accent/40">
                        <td className="num w-40 px-3 py-2 text-foreground">{mz(h.precursor_mz)} → {mz(h.product_mz)}</td>
                        <td className="num w-20 px-2 py-2 text-muted-foreground">{h.polarity?.replace('ESI', '') || ''}</td>
                        <td className="num w-24 px-2 py-2 text-muted-foreground">{h.collision_energy_ev != null ? `CE ${num(h.collision_energy_ev)}` : '—'}</td>
                        <td className="num w-28 px-2 py-2 text-muted-foreground">{h.retention_time_min != null ? `RT ${num(h.retention_time_min, 2)}` : 'RT —'}</td>
                        <td className="px-2 py-2">
                          <Link to={`/method/${h.method_id}`} className="line-clamp-1 text-foreground hover:text-primary" title={h.method_title}>{h.method_title}</Link>
                        </td>
                        <td className="w-28 px-2 py-2"><MatrixBadge matrix={h.matrix} /></td>
                        <td className="w-10 px-2 py-2">{h.status === 'verified' && <Verified />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  )
}
