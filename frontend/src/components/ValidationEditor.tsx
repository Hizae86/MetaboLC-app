import { useState, useRef, useCallback, useEffect } from 'react'

const FIELDS = ['lod', 'loq', 'r2', 'cv_percent', 'accuracy_percent'] as const
type Field = typeof FIELDS[number]

const COL_LABELS: Record<Field, string> = {
  lod: 'LOD', loq: 'LOQ', r2: 'R²', cv_percent: 'CV (%)', accuracy_percent: 'Accuracy (%)'
}

const ALL_COLS = ['compound_name', ...FIELDS, 'notes'] as const
const NUM_COLS = FIELDS.length + 2

interface ValidationRow {
  compound_name: string
  lod: string; loq: string; r2: string
  cv_percent: string; accuracy_percent: string
  notes: string
}

interface Props {
  validation: ValidationRow[]
  setValidation: (v: ValidationRow[]) => void
  units: string
  IS?: React.CSSProperties
}

export default function ValidationEditor({ validation, setValidation, units }: Props) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [fillMenu, setFillMenu] = useState<Field | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  useEffect(() => {
    if (active) setTimeout(() => inputRef.current?.focus(), 0)
  }, [active])

  // Close fill menu on outside click
  useEffect(() => {
    const handler = () => setFillMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const update = (row: number, field: string, val: string) => {
    const s = [...validation]
    s[row] = { ...s[row], [field]: val }
    setValidation(s)
  }

  const fillColumn = (field: Field, val: string) => {
    setValidation(validation.map(v => ({ ...v, [field]: val })))
    setFillMenu(null)
  }

  const move = (r: number, c: number, dr: number, dc: number) => {
    const nr = Math.max(0, Math.min(validation.length - 1, r + dr))
    const nc = Math.max(0, Math.min(ALL_COLS.length - 1, c + dc))
    setActive({ r: nr, c: nc })
  }

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Tab') { e.preventDefault(); move(r, c, 0, e.shiftKey ? -1 : 1) }
    else if (e.key === 'Enter') { e.preventDefault(); move(r, c, 1, 0) }
    else if (e.key === 'Escape') setActive(null)
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(r, c, 1, 0) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(r, c, -1, 0) }
  }

  // Paste from Excel/CSV
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    const text = e.clipboardData.getData('text')
    const rows = text.trim().split('\n').map(r => r.split('\t'))
    const s = [...validation]
    rows.forEach((row, ri) => {
      const targetRow = startRow + ri
      if (targetRow >= s.length) return
      row.forEach((cell, ci) => {
        const targetCol = startCol + ci
        if (targetCol >= ALL_COLS.length) return
        const field = ALL_COLS[targetCol]
        s[targetRow] = { ...s[targetRow], [field]: cell.trim() }
      })
    })
    setValidation(s)
    e.preventDefault()
  }

  const isActive = (r: number, c: number) => active?.r === r && active?.c === c

  const renderCell = (row: number, col: number, field: string, numeric = false) => {
    const val = (validation[row] as any)[field] ?? ''
    const act = isActive(row, col)

    const displayVal = val === '' || val === null || val === undefined
      ? <span className="text-slate-300">—</span>
      : val === 'N/A'
      ? <span className="text-slate-400 italic text-xs">N/A</span>
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
        className={`w-full h-full px-2.5 py-1.5 text-sm outline-none
          border-2 border-blue-500 rounded bg-blue-50
          ${numeric ? 'text-right font-mono' : 'text-left'}`}
        style={{ fontSize: '13px' }}
        placeholder="—"
      />
    )

    return (
      <div
        onClick={() => setActive({ r: row, c: col })}
        onPaste={e => { setActive({ r: row, c: col }); handlePaste(e, row, col) }}
        className={`w-full px-2.5 py-1.5 text-sm cursor-text rounded
          hover:bg-slate-50 transition-colors select-none
          ${numeric ? 'text-right font-mono' : 'text-left'}`}
        style={{ fontSize: '13px', minHeight: '32px' }}>
        {displayVal}
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-x-auto mb-3">
      <table ref={tableRef} className="w-full border-collapse" style={{ minWidth: '680px' }}>
        <thead>
          <tr className="bg-slate-900">
            {/* Compound */}
            <th className="text-left px-3 py-2.5 text-slate-400 font-medium text-xs
              uppercase tracking-wider whitespace-nowrap" style={{ minWidth: '140px' }}>
              Compound
            </th>

            {/* Numeric columns with fill menu */}
            {FIELDS.map(field => (
              <th key={field}
                className="text-right px-3 py-2.5 text-slate-400 font-medium text-xs
                  uppercase tracking-wider whitespace-nowrap relative"
                style={{ minWidth: '90px' }}>
                <div className="flex items-center justify-end gap-1">
                  <span>
                    {COL_LABELS[field]}
                    {field !== 'r2' && field !== 'cv_percent' && field !== 'accuracy_percent'
                      ? ` (${units})` : ''}
                  </span>
                  {/* Fill menu trigger */}
                  <div className="relative" onMouseDown={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); setFillMenu(fillMenu === field ? null : field) }}
                      className="text-slate-600 hover:text-white hover:bg-slate-700
                        rounded px-1 transition-colors text-xs leading-none">
                      ⋮
                    </button>
                    {fillMenu === field && (
                      <div className="absolute right-0 top-6 z-50 bg-white border border-slate-200
                        rounded-lg shadow-lg py-1 min-w-[140px]"
                        onMouseDown={e => e.stopPropagation()}>
                        <p className="px-3 py-1 text-xs text-slate-400 font-medium uppercase tracking-wider">
                          Fill column
                        </p>
                        {['0', '0.5', '1', '5', '10', 'N/A'].map(val => (
                          <button key={val}
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-700
                              hover:bg-slate-50 transition-colors font-mono"
                            onClick={() => fillColumn(field, val)}>
                            {val}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button
                            className="w-full text-left px-3 py-1.5 text-sm text-slate-700
                              hover:bg-slate-50 transition-colors"
                            onClick={() => {
                              const val = prompt(`Fill all ${COL_LABELS[field]} with:`)
                              if (val !== null) fillColumn(field, val)
                            }}>
                            Custom value…
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>
            ))}

            {/* Notes */}
            <th className="text-left px-3 py-2.5 text-slate-400 font-medium text-xs
              uppercase tracking-wider" style={{ minWidth: '100px' }}>
              Notes
            </th>
            <th className="w-8" />
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {validation.map((v, i) => (
            <tr key={i}
              className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
              style={{ height: '36px' }}>
              <td className="p-0.5">
                {renderCell(i, 0, 'compound_name', false)}
              </td>
              {FIELDS.map((field, fi) => (
                <td key={field} className="p-0.5">
                  {renderCell(i, fi + 1, field, true)}
                </td>
              ))}
              <td className="p-0.5">
                {renderCell(i, 6, 'notes', false)}
              </td>
              <td className="text-center p-0.5 w-8">
                <button
                  onClick={() => setValidation(validation.filter((_, idx) => idx !== i))}
                  className="text-slate-300 hover:text-red-500 transition-colors
                    text-base leading-none px-1">
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Keyboard hints */}
      <div className="flex gap-4 px-3 py-2 bg-slate-50 border-t border-slate-100
        text-xs text-slate-400">
        <span>Tab / Shift+Tab — next/prev cell</span>
        <span>Enter / ↑↓ — move rows</span>
        <span>Esc — exit cell</span>
        <span>Paste from Excel — Cmd+V</span>
      </div>
    </div>
  )
}
