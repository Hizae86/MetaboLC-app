import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ExternalLink, Search } from 'lucide-react'
import axios from 'axios'
import SEO from '../components/SEO'
import { MatrixBadge, Verified } from '@/components/method/badges'
import { Skeleton } from '@/components/ui/skeleton'
import { mz, num } from '@/lib/format'
import { cn } from '@/lib/utils'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

interface Compound {
  name: string
  normalized: string
  pubchem_cid: number | null
  formula: string | null
  exact_mass: number | null
  method_count: number
  verified_count: number
  matrices: string[]
  applications: string[]
  common_transition: { precursor_mz: number; product_mz: number } | null
  polarity: string | null
  rt_min: number | null
  rt_max: number | null
}

type SortKey = 'name' | 'mass' | 'methods'

/** Analyte-first entry point: find the compound, see at a glance how it is
 *  usually measured (consensus quant transition, matrices), then jump to the
 *  explorer already filtered on it. */
export default function CompoundIndex() {
  const [compounds, setCompounds] = useState<Compound[] | null>(null)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [matrix, setMatrix] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('methods')
  const [asc, setAsc] = useState(false)

  useEffect(() => {
    axios.get(`${API}/methods/compounds`)
      .then(res => setCompounds(res.data))
      .catch(() => setError(true))
  }, [])

  const matrices = useMemo(() => {
    const count = new Map<string, number>()
    compounds?.forEach(c => c.matrices.forEach(m => count.set(m, (count.get(m) || 0) + 1)))
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [compounds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = (compounds || []).filter(c =>
      (!q || c.name.toLowerCase().includes(q) || c.formula?.toLowerCase().includes(q)
        || c.applications.some(a => a.toLowerCase().includes(q)))
      && (!matrix || c.matrices.includes(matrix)))
    const dir = asc ? 1 : -1
    list = [...list].sort((a, b) => {
      if (sort === 'name') return dir * a.name.localeCompare(b.name)
      if (sort === 'mass') return dir * ((a.exact_mass ?? Infinity) - (b.exact_mass ?? Infinity))
      return dir * (a.method_count - b.method_count) || a.name.localeCompare(b.name)
    })
    return list
  }, [compounds, search, matrix, sort, asc])

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn('px-3 py-2 text-left font-medium', className)}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => { if (sort === key) setAsc(!asc); else { setSort(key); setAsc(key === 'name') } }}>
        {label}
        {sort === key && (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <SEO title="Analyte Index — Clinical LC-MS/MS Methods by Compound"
        description="Every analyte in Koiné with its usual quantifier transition, matrices, and the methods that measure it." />

      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Analyte index</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {compounds ? <><span className="num">{compounds.length}</span> analytes across the repository. The transition shown is the quantifier most methods agree on.</> : 'Loading…'}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring sm:max-w-sm">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, formula, or application…"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          {search && <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">×</button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {matrices.slice(0, 7).map(([m, n]) => (
            <button key={m} type="button" onClick={() => setMatrix(matrix === m ? null : m)}
              className={cn('rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                matrix === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground')}>
              {m} <span className="num opacity-70">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">Couldn't load the analyte index. Is the backend running?</div>
      ) : !compounds ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                {header('name', 'Analyte')}
                {header('mass', 'Exact mass', 'w-28')}
                <th className="w-40 px-3 py-2 text-left font-medium">Usual quant (m/z)</th>
                <th className="w-24 px-3 py-2 text-left font-medium">RT (min)</th>
                <th className="px-3 py-2 text-left font-medium">Matrices</th>
                {header('methods', 'Methods', 'w-24')}
                <th className="w-10 px-3 py-2"><span className="sr-only">PubChem</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.normalized} className="group hover:bg-accent/50">
                  <td className="px-3 py-2">
                    <Link to={`/methods?q=${encodeURIComponent(c.name)}`} className="font-medium text-foreground group-hover:text-primary">
                      {c.name}
                    </Link>
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                      {c.formula && <span className="num">{c.formula}</span>}
                      {c.applications.length > 0 && <span className="ml-2">{c.applications.join(' · ')}</span>}
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-muted-foreground">{c.exact_mass ? num(c.exact_mass, 4) : '—'}</td>
                  <td className="px-3 py-2">
                    {c.common_transition ? (
                      <span className="num text-foreground">
                        {mz(c.common_transition.precursor_mz)} → {mz(c.common_transition.product_mz)}
                        {c.polarity && <span className="ml-1.5 text-xs text-muted-foreground">{c.polarity.replace('ESI', '')}</span>}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="num px-3 py-2 text-muted-foreground">
                    {c.rt_min == null ? '—' : c.rt_max != null && c.rt_max - c.rt_min > 0.05 ? `${num(c.rt_min, 2)}–${num(c.rt_max, 2)}` : num(c.rt_min, 2)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {c.matrices.slice(0, 3).map(m => <MatrixBadge key={m} matrix={m} />)}
                      {c.matrices.length > 3 && <span className="text-xs text-muted-foreground">+{c.matrices.length - 3}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="num text-foreground">{c.method_count}</span>
                    {c.verified_count > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-success" title={`${c.verified_count} verified`}>
                        <Verified /> {c.verified_count}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.pubchem_cid && (
                      <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${c.pubchem_cid}`} target="_blank" rel="noopener noreferrer"
                        title="Open in PubChem" className="text-muted-foreground hover:text-primary">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No analytes match {search && <>“{search}”</>}{matrix && <> in {matrix}</>}.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
