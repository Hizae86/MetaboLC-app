import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const cache: Record<string, any> = {}

const ADDUCTS = [
  { name: 'M+H',    delta: 1.007276,  mode: '+' },
  { name: 'M+Na',   delta: 22.989218, mode: '+' },
  { name: 'M+NH4',  delta: 18.034164, mode: '+' },
  { name: 'M-H',    delta: -1.007276, mode: '-' },
  { name: 'M+Cl',   delta: 34.969402, mode: '-' },
  { name: 'M+FA-H', delta: 44.997655, mode: '-' },
]

function formatFormula(formula: string) {
  const parts: JSX.Element[] = []
  let i = 0
  while (i < formula.length) {
    if (!isNaN(Number(formula[i])) && formula[i] !== ' ') {
      let num = ''
      while (i < formula.length && !isNaN(Number(formula[i])) && formula[i] !== ' ') {
        num += formula[i++]
      }
      parts.push(<sub key={i} style={{ fontSize: '0.75em', lineHeight: 0 }}>{num}</sub>)
    } else {
      parts.push(<span key={i}>{formula[i++]}</span>)
    }
  }
  return parts
}

function getBestAdduct(exactMass: number, precursorMz: number, ionMode?: string) {
  const mode = ionMode?.includes('-') ? '-' : '+'
  return ADDUCTS
    .filter(a => a.mode === mode)
    .map(a => ({ name: a.name, diff: Math.abs(exactMass + a.delta - precursorMz) }))
    .sort((a, b) => a.diff - b.diff)
    .find(a => a.diff < 0.1) || null
}

const MATRIX_CLS: Record<string, string> = {
  plasma: 'bg-red-50 text-red-700',
  serum: 'bg-orange-50 text-orange-700',
  urine: 'bg-yellow-50 text-yellow-700',
  'whole blood': 'bg-red-100 text-red-800',
  'dried blood spot': 'bg-pink-50 text-pink-700',
  other: 'bg-slate-100 text-slate-500',
}

interface Props {
  compound: {
    key: string
    displayName: string
    entries: { method: any; transitions: any[] }[]
  }
}

export default function CompoundCard({ compound }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Read PubChem data directly from transitions — no state needed
  const richTrans = compound.entries
    .flatMap((e: any) => e.transitions)
    .find((t: any) => t.pubchem_formula && t.pubchem_cid > 0)

  const formula = richTrans?.pubchem_formula || null
  const exactMass = richTrans?.pubchem_exact_mass || null
  const cid = richTrans?.pubchem_cid || null
  const matrices = [...new Set(compound.entries.map((e: any) => e.method.matrix))] as string[]
  const firstQuant = compound.entries[0]?.transitions.find((t: any) => t.is_quantifier && !t.is_internal_standard)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-slate-300 transition-all">

      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-3.5 flex items-center gap-4 cursor-pointer">

        <div className="flex-1 min-w-0">
          {/* Row 1: name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 truncate">
              {compound.displayName}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200 shrink-0">
              {compound.entries.length} method{compound.entries.length > 1 ? 's' : ''}
            </span>
            {compound.entries.length > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-200 font-medium shrink-0">
                ✓ Benchmark
              </span>
            )}
          </div>

          {/* Row 2: PubChem data inline */}
          {formula ? (
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded ring-1 ring-slate-200">
                {formatFormula(formula)}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {exactMass ? parseFloat(exactMass).toFixed(4) + ' Da' : ''}
              </span>
              {(() => {
                // Use DB adduct if available, otherwise calculate
                const dbAdduct = richTrans?.pubchem_adduct
                if (dbAdduct) return (
                  <span className="text-xs font-mono px-2 py-0.5 rounded font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
                    {dbAdduct}
                  </span>
                )
                if (!firstQuant || !pubchem) return null
                const adduct = getBestAdduct(parseFloat(pubchem.ExactMass), firstQuant.precursor_mz, compound.entries[0]?.method.ionization_mode)
                return adduct ? (
                  <span className="text-xs font-mono px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                    {adduct.name}
                  </span>
                ) : null
              })()}
              
                href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-xs text-blue-400 hover:text-blue-600 transition-colors no-underline">
                CID:{pubchem.CID} ↗
              </a>
            </div>
          ) : loading ? (
            <span className="text-xs text-slate-300 animate-pulse mt-1 block">Looking up…</span>
          ) : null}
        </div>

        {/* Matrix badges + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1">
            {matrices.slice(0, 3).map(m => (
              <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${MATRIX_CLS[m] || MATRIX_CLS.other}`}>
                {m}
              </span>
            ))}
          </div>
          <span className={`text-slate-300 text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Methods */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {compound.entries.map(({ method, transitions }: any, i: number) => {
            const quant = transitions.find((t: any) => t.is_quantifier && !t.is_internal_standard)
            const quals = transitions.filter((t: any) => !t.is_quantifier && !t.is_internal_standard)
            const adduct = exactMass && quant
              ? getBestAdduct(parseFloat(exactMass), quant.precursor_mz, method.ionization_mode)
              : null

            return (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">
                      {method.instrument_manufacturer} {method.instrument_model}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                      {method.matrix}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 line-clamp-1">{method.title}</p>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {quant && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-md bg-green-50 text-green-700 ring-1 ring-green-200">
                        <span>{quant.precursor_mz}→{quant.product_mz}</span>
                        <span className="text-green-500 font-medium text-xs">Q1</span>
                        {adduct && !method.is_derivatized && (
                      <span className="text-green-400 text-xs">[{adduct.name}]</span>
                    )}
                    {method.is_derivatized && (
                      <span className="text-yellow-500 text-xs" title="Derivatized method — m/z corresponds to derivative">⚗️</span>
                    )}
                      </span>
                    )}
                    {quals.slice(0, 2).map((t: any, ti: number) => (
                      <span key={ti} className="text-xs font-mono px-2 py-0.5 rounded-md bg-orange-50 text-orange-600 ring-1 ring-orange-200">
                        {t.precursor_mz}→{t.product_mz} <span className="text-orange-400">Q{ti + 2}</span>
                      </span>
                    ))}
                    {quant?.retention_time_min && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                        RT {quant.retention_time_min} min
                      </span>
                    )}
                  </div>
                </div>
                <Link to={`/method/${method.id}`}
                  className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors shrink-0 no-underline mt-0.5">
                  View →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
