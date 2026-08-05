import { useState, useRef, useEffect } from 'react'

interface MRMRow {
  compound_name: string
  is_internal_standard: number
  is_quantifier: number
  precursor_mz: string
  product_mz: string
  collision_energy_ev: string
  retention_time_min: string
  dwell_time_ms: string
  [key: string]: any
}

interface MFRParam { headers: string[]; fields: string[] }

interface Props {
  trans: MRMRow[]
  setTrans: (t: MRMRow[]) => void
  mfrParams: MFRParam
  IS?: React.CSSProperties
}

const ALL_BASE = ['compound_name', 'is_internal_standard', 'is_quantifier',
  'precursor_mz', 'product_mz'] as const

export default function MRMEditor({ trans, setTrans, mfrParams, IS }: Props) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [fillMenu, setFillMenu] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCols = [
    { field: 'compound_name', label: 'Compound', numeric: false, width: 140 },
    { field: 'is_internal_standard', label: 'IS', numeric: false, width: 50 },
    { field: 'is_quantifier', label: 'Role', numeric: false, width: 80 },
    { field: 'precursor_mz', label: 'Q1 (m/z)', numeric: true, width: 80 },
    { field: 'product_mz', label: 'Q3 (m/z)', numeric: true, width: 80 },
    ...(mfrParams?.fields || []).map((field, i) => ({ field, label: mfrParams.headers[i] || field, numeric: true, width: 80 })),
    { field: 'retention_time_min', label: 'RT (min)', numeric: true, width: 75 },
    { field: 'dwell_time_ms', label: 'Dwell (ms)', numeric: true, width: 75 },
    { field: 'derivative', label: 'Derivative', numeric: false, width: 90 },
  ]

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 0)
  }, [active])

  useEffect(() => {
    const handler = () => setFillMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const update = (row: number, field: string, val: any) => {
    const s = [...trans]
    s[row] = { ...s[row], [field]: val }
    setTrans(s)
  }

  const fillColumn = (field: string, val: string) => {
    setTrans(trans.map(t => ({ ...t, [field]: val })))
    setFillMenu(null)
  }

  const move = (r: number, c: number, dr: number, dc: number) => {
    const nr = Math.max(0, Math.min(trans.length - 1, r + dr))
    const nc = Math.max(0, Math.min(allCols.length - 1, c + dc))
    setActive({ r: nr, c: nc })
  }

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Tab') { e.preventDefault(); move(r, c, 0, e.shiftKey ? -1 : 1) }
    else if (e.key === 'Enter') { e.preventDefault(); move(r, c, 1, 0) }
    else if (e.key === 'Escape') setActive(null)
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(r, c, 1, 0) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(r, c, -1, 0) }
  }

  const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    const text = e.clipboardData.getData('text')
    const rows = text.trim().split('\n').map(r => r.split('\t'))
    const s = [...trans]
    rows.forEach((row, ri) => {
      const tr = startRow + ri
      if (tr >= s.length) return
      row.forEach((cell, ci) => {
        const tc = startCol + ci
        if (tc >= allCols.length) return
        s[tr] = { ...s[tr], [allCols[tc].field]: cell.trim() }
      })
    })
    setTrans(s)
    e.preventDefault()
  }

  const isActive = (r: number, c: number) => active?.r === r && active?.c === c

  const renderCell = (row: number, col: number, field: string, numeric: boolean) => {
    const t = trans[row]
    const act = isActive(row, col)

    // Special cells
    if (field === 'is_internal_standard') {
      return (
        <div className="flex justify-center items-center h-full">
          <input type="checkbox"
            checked={!!t.is_internal_standard}
            onChange={e => update(row, field, e.target.checked ? 1 : 0)}
            className="w-3.5 h-3.5 accent-purple-600" />
        </div>
      )
    }

    if (field === 'is_quantifier') {
      return (
        <div className="flex justify-center">
          <button
            onClick={() => update(row, field, t.is_quantifier ? 0 : 1)}
            className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors
              ${t.is_quantifier
                ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                : 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'}`}>
            {t.is_quantifier ? 'Quant' : 'Qual'}
          </button>
        </div>
      )
    }

    const val = t[field] ?? ''
    const displayVal = val === '' || val === null || val === undefined
      ? <span className="text-slate-300">—</span>
      : <span>{val}</span>

    if (act) return (
      <input
        ref={inputRef}
        type="text"
        value={val}
        onChange={e => update(row, field, e.target.value)}
        onBlur={() => setActive(null)}
        onKeyDown={e => handleKeyDown(e, row, col)}
        onPaste={e => handlePaste(e, row, col)}
        className={`w-full h-full px-2 py-1.5 text-sm outline-none
          border-2 border-blue-500 rounded bg-blue-50
          ${numeric ? 'text-right font-mono' : 'text-left'}`}
        style={{ fontSize: '12px' }}
      />
    )

    return (
      <div
        onClick={() => setActive({ r: row, c: col })}
        className={`w-full px-2 py-1.5 cursor-text rounded
          hover:bg-slate-50 transition-colors select-none
          ${numeric ? 'text-right font-mono' : 'text-left'}`}
        style={{ fontSize: '12px', minHeight: '32px' }}>
        {displayVal}
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-x-auto mb-3">
      <table className="border-collapse" style={{ minWidth: '900px', width: '100%' }}>
        <thead>
          <tr className="bg-slate-900">
            {allCols.map((col, ci) => (
              <th key={col.field}
                className="py-2.5 px-2 text-slate-400 font-medium text-xs
                  uppercase tracking-wider whitespace-nowrap relative"
                style={{ minWidth: col.width, textAlign: col.numeric ? 'right' : 'left' }}>
                <div className={`flex items-center gap-1 ${col.numeric ? 'justify-end' : ''}`}>
                  <span>{col.label}</span>
                  {col.numeric && (
                    <div className="relative" onMouseDown={e => e.stopPropagation()}>
                      <button
                        onClick={e => { e.stopPropagation(); setFillMenu(fillMenu === col.field ? null : col.field) }}
                        className="text-slate-600 hover:text-white hover:bg-slate-700
                          rounded px-1 transition-colors text-xs leading-none">
                        ⋮
                      </button>
                      {fillMenu === col.field && (
                        <div className="absolute right-0 top-6 z-50 bg-white border border-slate-200
                          rounded-lg shadow-lg py-1 min-w-[130px]"
                          onMouseDown={e => e.stopPropagation()}>
                          <p className="px-3 py-1 text-xs text-slate-400 font-medium uppercase tracking-wider">
                            Fill column
                          </p>
                          {['0', '10', '15', '20', '25', '30', '40'].map(val => (
                            <button key={val}
                              className="w-full text-left px-3 py-1.5 text-sm text-slate-700
                                hover:bg-slate-50 font-mono"
                              onClick={() => fillColumn(col.field, val)}>
                              {val}
                            </button>
                          ))}
                          <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                              className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                const val = prompt(`Fill all ${col.label} with:`)
                                if (val !== null) fillColumn(col.field, val)
                              }}>
                              Custom value…
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </th>
            ))}
            <th className="w-8 bg-slate-900" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {trans.map((t, i) => (
            <tr key={i}
              className={`${t.is_internal_standard ? 'bg-purple-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              style={{ height: '36px' }}>
              {allCols.map((col, ci) => (
                <td key={col.field} className="p-0.5">
                  {renderCell(i, ci, col.field, col.numeric)}
                </td>
              ))}
              <td className="text-center p-0.5 w-8">
                <button
                  onClick={() => setTrans(trans.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 transition-colors text-base leading-none px-1">
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 px-3 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
        <span>Tab / Shift+Tab — next/prev cell</span>
        <span>Enter / ↑↓ — move rows</span>
        <span>Esc — exit cell</span>
        <span>Paste from Excel — Cmd+V</span>
      </div>
    </div>
  )
}
