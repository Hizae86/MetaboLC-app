import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

const MATRIX_CLS: Record<string, string> = {
  plasma: 'bg-red-50 text-red-700',
  serum: 'bg-orange-50 text-orange-700',
  urine: 'bg-yellow-50 text-yellow-700',
  'whole blood': 'bg-red-100 text-red-800',
  'dried blood spot': 'bg-pink-50 text-pink-700',
  csf: 'bg-blue-50 text-blue-700',
  other: 'bg-slate-100 text-slate-500',
}

interface Props {
  methodId: number
  analyte: string
  matrix: string
}

function normalizeCompound(name: string): string {
  return name.toLowerCase()
    .replace(/[-\s_]+/g, ' ')
    .replace(/\s*\(.*?\)/g, '')
    .trim()
}

export default function SimilarMethods({ methodId, analyte, matrix }: Props) {
  const [similar, setSimilar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sharedCompounds, setSharedCompounds] = useState<Record<number, string[]>>({})

  useEffect(() => {
    axios.get(`${API}/methods/all`).then(res => {
      const all = res.data

      // Parse current method analytes into normalized list
      const currentAnalytes = analyte
        .split(',')
        .map(a => normalizeCompound(a))
        .filter(Boolean)

      const scored: any[] = []
      const shared: Record<number, string[]> = {}

      all
        .filter((m: any) => m.id !== methodId)
        .forEach((m: any) => {
          const mAnalytes = (m.analyte || '')
            .split(',')
            .map((a: string) => normalizeCompound(a))
            .filter(Boolean)

          // Find exact compound matches
          const matches = currentAnalytes.filter(a =>
            mAnalytes.some((ma: string) =>
              ma === a ||
              ma.includes(a) && a.length > 4 ||
              a.includes(ma) && ma.length > 4
            )
          )

          if (matches.length > 0) {
            shared[m.id] = matches
            scored.push({ m, matchCount: matches.length })
          }
        })

      // Sort by number of shared compounds desc, then by same matrix
      scored.sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount
        const aMatrix = a.m.matrix === matrix ? 1 : 0
        const bMatrix = b.m.matrix === matrix ? 1 : 0
        return bMatrix - aMatrix
      })

      setSharedCompounds(shared)
      setSimilar(scored.slice(0, 4).map(s => s.m))
    }).finally(() => setLoading(false))
  }, [methodId, analyte, matrix])

  if (loading || similar.length === 0) return null

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-slate-800 tracking-tight">Similar methods</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600
          ring-1 ring-indigo-200 font-medium">{similar.length} with shared compounds</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {similar.map(m => {
          const mc = MATRIX_CLS[(m.matrix||'other').toLowerCase()] || MATRIX_CLS.other
          const shared = sharedCompounds[m.id] || []
          return (
            <Link key={m.id} to={`/method/${m.id}`} className="no-underline">
              <div className="border border-slate-100 rounded-xl p-3 hover:border-indigo-200
                hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 bg-white">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${mc}`}>
                    {m.matrix}
                  </span>
                  {m.status === 'verified' && (
                    <span className="text-xs text-green-600">✓</span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug mb-1.5">
                  {m.title?.slice(0, 55)}{m.title?.length > 55 ? '…' : ''}
                </p>
                {/* Shared compounds badges */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {shared.slice(0, 3).map(c => (
                    <span key={c} className="text-xs px-2 py-0.5 rounded-full
                      bg-indigo-50 text-indigo-600 border border-indigo-200 font-medium capitalize">
                      {c}
                    </span>
                  ))}
                  {shared.length > 3 && (
                    <span className="text-xs text-slate-400">+{shared.length - 3}</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {m.instrument_manufacturer} · {m.mrm_transitions?.length} MRM
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
