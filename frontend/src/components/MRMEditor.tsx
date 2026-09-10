import { useState, useRef, useEffect } from 'react'

interface MFRParam { headers: string[]; fields: string[] }
interface Trans { [key: string]: any }

interface Props {
  trans: Trans[]
  setTrans: (t: Trans[]) => void
  mfrParams: MFRParam
  IS?: any
}

export default function MRMEditor({ trans, setTrans, mfrParams }: Props) {
  const [active, setActive] = useState<{ r: number; c: number } | null>(null)
  const [fillMenu, setFillMenu] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mfrFields = mfrParams?.fields || []
  const mfrHeaders = mfrParams?.headers || []

  // Fixed columns (excluding compound_name which is shown in group header)
  const dataCols = [
    { field: 'is_quantifier', label: 'Role', width: 64 },
    { field: 'polarity', label: 'Pol.', width: 56 },
    { field: 'precursor_mz', label: 'Q1 (m/z)', width: 82, numeric: true },
    { field: 'product_mz', label: 'Q3 (m/z)', width: 82, numeric: true },
    ...mfrFields.filter(f => f !== 'polarity').map((f, i) => ({
      field: f, label: mfrHeaders[i + (mfrHeaders.includes('Polarity') ? 1 : 0)] || f,
      width: 72, numeric: f !== 'polarity'
    })),
    { field: 'assigned_is', label: 'Assigned IS', width: 120, numeric: false },
    { field: 'retention_time_min', label: 'RT (min)', width: 72, numeric: true },
    { field: 'dwell_time_ms', label: 'Dwell (ms)', width: 72, numeric: true },
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
    const nc = Math.max(0, Math.min(dataCols.length - 1, c + dc))
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
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const rows = text.trim().split('\n').map(r => r.split('\t'))
    const newTrans = [...trans]
    rows.forEach((row, ri) => {
      const targetRow = startRow + ri
      if (targetRow >= newTrans.length) return
      row.forEach((val, ci) => {
        const targetCol = startCol + ci
        if (targetCol >= dataCols.length) return
        const field = dataCols[targetCol].field
        newTrans[targetRow] = { ...newTrans[targetRow], [field]: val }
      })
    })
    setTrans(newTrans)
  }

  // Group transitions by compound name
  type Group = { name: string; isIS: boolean; rows: { t: Trans; idx: number }[] }
  const groups: Group[] = []
  trans.forEach((t, idx) => {
    const name = t.compound_name?.trim() || ''
    const last = groups[groups.length - 1]
    if (last && last.name === name) {
      last.rows.push({ t, idx })
    } else {
      groups.push({ name, isIS: !!t.is_internal_standard, rows: [{ t, idx }] })
    }
  })

  const renderDataCell = (rowIdx: number, colIdx: number, field: string, numeric: boolean) => {
    const t = trans[rowIdx]
    const isAct = active?.r === rowIdx && active?.c === colIdx
    const val = t[field] ?? ''

    if (field === 'is_quantifier') {
      return (
        <button onClick={() => update(rowIdx, field, t.is_quantifier ? 0 : 1)}
          className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all
            ${t.is_quantifier
              ? 'bg-green-500/15 text-green-300 ring-1 ring-green-400/40'
              : 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-400/30'}`}>
          {t.is_quantifier ? 'Quan' : 'Qual'}
        </button>
      )
    }

    if (field === 'assigned_is') {
      const isCompounds = [...new Set(trans
        .filter((t: any) => t.is_internal_standard)
        .map((t: any) => t.compound_name?.trim())
        .filter(Boolean))] as string[]
      if (isCompounds.length === 0) return (
        <div className="px-2 py-1 text-xs text-slate-600">No IS</div>
      )
      const t = trans[rowIdx]
      if (t.is_internal_standard) return null

      // Auto-detect IS by name similarity
      const compoundName = (t.compound_name || '').toLowerCase().trim()
      const autoIS = isCompounds.find((name: string) => {
        const n = name.toLowerCase()
        // Strip isotope labels: -d3, -d6, -13C3, -2H5, etc.
        const stripped = n.replace(/[-_]?(d\d+|\d*13c\d*|\d*15n\d*|\d*2h\d*|13c\d*|d\d+)/gi, '').replace(/[-_]+$/, '').trim()
        return stripped === compoundName || n.startsWith(compoundName)
      }) || ''

      const currentVal = t.assigned_is || autoIS

      return (
        <select
          value={currentVal}
          onChange={e => update(rowIdx, 'assigned_is', e.target.value || null)}
          className="w-full text-xs px-1.5 py-1 border border-white/15 rounded bg-white/5
            focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-300">
          <option value="" style={{background:'#0e1b2e'}}>— none —</option>
          {isCompounds.map((name: string) => (
            <option key={name} value={name} style={{background:'#0e1b2e'}}>{name}</option>
          ))}
        </select>
      )
    }

    if (field === 'polarity') {
      return (
        <button onClick={() => update(rowIdx, field, (t.polarity || 'ESI+') === 'ESI+' ? 'ESI-' : 'ESI+')}
          className={`text-xs font-medium px-1.5 py-0.5 rounded transition-all
            ${(t.polarity || 'ESI+') === 'ESI+'
              ? 'bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/30'
              : 'bg-red-500/10 text-red-300 ring-1 ring-red-400/30'}`}>
          {t.polarity || 'ESI+'}
        </button>
      )
    }

    if (isAct) return (
      <input ref={inputRef} type="text" value={val}
        onChange={e => update(rowIdx, field, e.target.value)}
        onBlur={() => setActive(null)}
        onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
        onPaste={e => handlePaste(e, rowIdx, colIdx)}
        className={`w-full h-full px-1.5 py-1 text-xs outline-none border-2 border-sky-400 rounded bg-sky-500/10 text-slate-100
          ${numeric ? 'text-right font-mono' : 'text-left'}`}
      />
    )

    return (
      <div onClick={() => setActive({ r: rowIdx, c: colIdx })}
        className={`px-1.5 py-1 text-xs rounded cursor-text hover:bg-sky-500/10 transition-colors min-h-[24px]
          ${numeric ? 'text-right font-mono' : 'text-left'}
          ${val === '' || val === null ? 'text-slate-600' : 'text-slate-300'}`}>
        {val === '' || val === null ? '—' : val}
      </div>
    )
  }

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.03]">
      {/* Scrollable container */}
      <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>

          {/* Sticky header */}
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#0e1b2e', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: 600, fontSize: '11px', minWidth: '140px', whiteSpace: 'nowrap' }}>
                Compound
              </th>
              {dataCols.map(col => (
                <th key={col.field}
                  style={{ textAlign: col.field === 'is_quantifier' || col.field === 'polarity' ? 'center' : 'right', padding: '8px 6px', color: '#94a3b8', fontWeight: 600, fontSize: '11px', minWidth: col.width, whiteSpace: 'nowrap' }}>
                  <div className="flex items-center justify-end gap-1">
                    {col.label}
                    {col.field !== 'is_quantifier' && col.field !== 'polarity' && (
                      <div className="relative">
                        <button onClick={() => setFillMenu(fillMenu === col.field ? null : col.field)}
                          className="text-slate-600 hover:text-indigo-400 transition-colors text-xs">▼</button>
                        {fillMenu === col.field && (
                          <div className="absolute right-0 top-5 bg-[#0e1b2e] border border-white/10 rounded-lg shadow-lg z-20 w-36 p-1">
                            <p className="text-xs text-slate-500 px-2 py-1">Fill all with:</p>
                            <input autoFocus className="w-full text-xs px-2 py-1 border-b border-white/10 outline-none bg-transparent text-slate-100"
                              placeholder="value…"
                              onKeyDown={e => {
                                if (e.key === 'Enter') fillColumn(col.field, (e.target as HTMLInputElement).value)
                                if (e.key === 'Escape') setFillMenu(null)
                              }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
              <th style={{ width: 32 }} />
            </tr>
          </thead>

          <tbody>
            {groups.map((group, gi) => (
              <>
                {/* Group separator */}
                {gi > 0 && (
                  <tr key={`sep-${gi}`}>
                    <td colSpan={dataCols.length + 2}
                      style={{ height: '2px', background: 'linear-gradient(to right, rgba(255,255,255,0.15) 60%, transparent)', padding: 0 }} />
                  </tr>
                )}

                {group.rows.map(({ t, idx }, ri) => (
                  <tr key={idx}
                    style={{ height: '34px', background: group.isIS ? 'rgba(168,85,247,0.08)' : gi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>

                    {/* Compound name — only first row of group */}
                    <td style={{ padding: '4px 12px', verticalAlign: 'middle' }}>
                      {ri === 0 ? (
                        <div className="flex items-center gap-2">
                          {group.isIS ? (
                            <span className="text-xs bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded font-medium shrink-0">IS</span>
                          ) : (
                            <span className="text-xs bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-medium shrink-0">Ana</span>
                          )}
                          <input value={t.compound_name || ''}
                            onChange={e => update(idx, 'compound_name', e.target.value)}
                            className="text-xs font-medium text-slate-100 bg-transparent border-none outline-none w-full"
                            placeholder="Compound name" />
                        </div>
                      ) : (
                        <div className="pl-8 text-xs text-slate-600">↳ qualifier</div>
                      )}
                    </td>

                    {/* Data cells */}
                    {dataCols.map((col, ci) => (
                      <td key={col.field} style={{ padding: '2px 4px', textAlign: col.field === 'is_quantifier' || col.field === 'polarity' ? 'center' : 'right', verticalAlign: 'middle' }}>
                        {renderDataCell(idx, ci, col.field, !!col.numeric)}
                      </td>
                    ))}

                    {/* Delete */}
                    <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '2px' }}>
                      <button onClick={() => setTrans(trans.filter((_, i) => i !== idx))}
                        className="text-slate-600 hover:text-red-400 transition-colors text-base leading-none px-1">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Add transition to this group */}
                <tr key={`add-${gi}`}>
                  <td colSpan={dataCols.length + 2} style={{padding: '2px 12px 4px'}}>
                    <button
                      onClick={() => {
                        const lastIdx = group.rows[group.rows.length - 1].idx
                        const newTrans = [...trans]
                        newTrans.splice(lastIdx + 1, 0, {
                          compound_name: group.name,
                          is_internal_standard: group.isIS ? 1 : 0,
                          precursor_mz: '', product_mz: '',
                          is_quantifier: 0,
                          polarity: group.rows[0]?.t?.polarity || 'ESI+'
                        })
                        setTrans(newTrans)
                      }}
                      className="text-xs text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
                      <span className="text-base leading-none">+</span> add transition
                    </button>
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex gap-4 px-3 py-2 bg-white/5 border-t border-white/10 text-xs text-slate-500">
        <span>Tab / Shift+Tab — next/prev</span>
        <span>Enter / ↑↓ — move rows</span>
        <span>Paste TSV from Excel</span>
      </div>
    </div>
  )
}
