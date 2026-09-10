import { useState } from 'react'
import { Download, ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  method: any
  onExport?: () => void
}

const MFR_HEADERS: Record<string, { label: string; field: string }[]> = {
  'Sciex':        [{ label: 'DP (V)', field: 'declustering_potential' }, { label: 'CXP (V)', field: 'cell_exit_potential' }],
  'Waters':       [{ label: 'Cone (V)', field: 'cone_voltage' }],
  'Agilent':      [{ label: 'Frag (V)', field: 'declustering_potential' }, { label: 'Cell Acc', field: 'cell_accelerator_voltage' }],
  'Shimadzu':     [{ label: 'Q1 Bias', field: 'q1_pre_bias' }, { label: 'Q3 Bias', field: 'q3_pre_bias' }],
  'Thermo Fisher':[{ label: 'RF Lens', field: 'rf_lens_v' }, { label: 'Res', field: 'ms_resolution' }],
  'PerkinElmer':  [{ label: 'EV (V)', field: 'declustering_potential' }, { label: 'CCL2 (V)', field: 'cell_exit_potential' }],
  'Bruker':       [],
  'Other':        [{ label: 'DP (V)', field: 'declustering_potential' }],
}

export default function MRMView({ method, onExport }: Props) {
  const transitions = method.mrm_transitions || []
  const mfrCols = MFR_HEADERS[method.instrument_manufacturer] || MFR_HEADERS['Other']
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Group by compound name
  type Group = {
    name: string
    isIS: boolean
    rows: any[]
    isCompanions: any[] // IS rows that match this compound
  }

  const groups: Group[] = []
  const isRows = transitions.filter((t: any) => t.is_internal_standard)
  const analytes = transitions.filter((t: any) => !t.is_internal_standard)

  // Group analytes
  analytes.forEach((t: any) => {
    const name = t.compound_name?.trim() || ''
    const last = groups[groups.length - 1]
    if (last && last.name === name) {
      last.rows.push(t)
    } else {
      groups.push({ name, isIS: false, rows: [t], isCompanions: [] })
    }
  })

  // Group IS
  const isGroups: Group[] = []
  isRows.forEach((t: any) => {
    const name = t.compound_name?.trim() || ''
    const last = isGroups[isGroups.length - 1]
    if (last && last.name === name) {
      last.rows.push(t)
    } else {
      isGroups.push({ name, isIS: true, rows: [t], isCompanions: [] })
    }
  })

  // Match IS to analyte — one IS can be shared by multiple analytes
  // Each group gets its own copy of IS companions
  groups.forEach(g => {
    // 1. Manual assignment
    const manualIS = [...new Set(g.rows
      .map((t: any) => t.assigned_is)
      .filter(Boolean))]
    
    if (manualIS.length > 0) {
      manualIS.forEach((isName: string) => {
        const isGroup = isGroups.find(ig => ig.name === isName)
        if (isGroup && !g.isCompanions.some((c: any) => c.compound_name === isName)) {
          g.isCompanions.push(...isGroup.rows)
        }
      })
    } else {
      // 2. Auto match by name similarity
      const aName = g.name.toLowerCase()
      isGroups.forEach(isGroup => {
        const isNameLower = isGroup.name.toLowerCase()
        const stripped = isNameLower.replace(/[-_]?(d\d+|13c\d*|15n\d*|2h\d*)/gi, '').replace(/[-_]+$/, '').trim()
        if (stripped === aName || isNameLower.startsWith(aName)) {
          g.isCompanions.push(...isGroup.rows)
        }
      })
    }
  })



  const toggleCollapse = (name: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const ColHeader = ({ label }: { label: string }) => (
    <th className="text-right px-2 py-2 text-xs font-semibold text-slate-400 whitespace-nowrap">
      {label}
    </th>
  )

  const Cell = ({ val, right = true }: { val: any; right?: boolean }) => (
    <td className={`px-2 py-1.5 text-xs font-mono ${right ? 'text-right' : 'text-left'} text-slate-300`}>
      {val !== null && val !== undefined && val !== '' ? val : <span className="text-slate-600">—</span>}
    </td>
  )

  const TransRow = ({ t, isISrow = false, isName = '' }: { t: any; isISrow?: boolean; isName?: string }) => (
    <tr style={{background: isISrow ? 'rgba(168,85,247,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)'}}>
      <td className="px-3 py-1.5">
        {isISrow ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 ring-1 ring-purple-400/40 shrink-0">IS</span>
            {isName && <span className="text-xs text-purple-300 font-medium truncate max-w-[120px]">{isName}</span>}
          </div>
        ) : t.is_quantifier ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 ring-1 ring-green-400/40">Quan</span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 ring-1 ring-orange-400/30">Qual</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded
          ${(t.polarity || 'ESI+') === 'ESI+' ? 'bg-sky-500/10 text-sky-300' : 'bg-red-500/10 text-red-300'}`}>
          {t.polarity || 'ESI+'}
        </span>
      </td>
      <Cell val={t.precursor_mz != null ? Number(t.precursor_mz).toFixed(4) : null} />
      <Cell val={t.product_mz != null ? Number(t.product_mz).toFixed(4) : null} />
      <Cell val={t.collision_energy_ev} />
      {mfrCols.map(col => <Cell key={col.field} val={t[col.field]} />)}
      <Cell val={t.retention_time_min?.toFixed(3)} />
      <Cell val={t.dwell_time_ms} isIS={isISrow} />
    </tr>
  )

  if (transitions.length === 0) return (
    <div className="text-center py-8 text-slate-500 text-sm">No MRM transitions recorded</div>
  )

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            <strong className="text-slate-100">{transitions.filter((t: any) => !t.is_internal_standard).length}</strong> analyte transitions
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400">
            <strong className="text-slate-100">{transitions.filter((t: any) => t.is_internal_standard).length}</strong> IS transitions
          </span>
          <span className="text-xs text-slate-500">·</span>
          <span className="text-xs text-slate-400">
            <strong className="text-slate-100">{transitions.length}</strong> total
          </span>
        </div>
        {onExport && (
          <button onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 rounded-lg
              hover:bg-indigo-500/20 transition-all">
            <Download size={12} /> Export CSV
          </button>
        )}
      </div>

      {/* Groups */}
      {groups.map((group, gi) => {
        const isOpen = !collapsed.has(group.name)
        const totalRows = group.rows.length + group.isCompanions.length
        return (
          <div key={gi} className={`border rounded-xl overflow-hidden
            ${group.isIS ? 'border-purple-400/30' : 'border-white/10'}`}>

            {/* Group header */}
            <button
              onClick={() => toggleCollapse(group.name)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                ${group.isIS
                  ? 'bg-purple-500/10 hover:bg-purple-500/15'
                  : 'bg-white/5 hover:bg-white/10'}`}>
              {isOpen
                ? <ChevronDown size={14} className="text-slate-500 shrink-0" />
                : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {group.isIS
                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">IS</span>
                  : null}
                <span className="text-sm font-semibold text-slate-100 truncate">{group.name}</span>
                {group.isCompanions.length > 0 && (
                  <span className="text-xs text-purple-300 font-medium shrink-0">+ IS</span>
                )}
              </div>
              <span className="text-xs text-slate-500 shrink-0">{totalRows} transition{totalRows !== 1 ? 's' : ''}</span>
            </button>

            {/* Transitions table */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-400 w-16">Role</th>
                      <th className="text-center px-2 py-2 text-xs font-semibold text-slate-400 w-14">Pol.</th>
                      <ColHeader label="Q1 (m/z)" />
                      <ColHeader label="Q3 (m/z)" />
                      <ColHeader label="CE (eV)" />
                      {mfrCols.map(col => <ColHeader key={col.field} label={col.label} />)}
                      <ColHeader label="RT (min)" />
                      <ColHeader label="Dwell (ms)" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((t, i) => <TransRow key={i} t={t} />)}
                    {group.isCompanions.length > 0 && (
                      <>
                        {group.isCompanions.map((t, i) => (
                          <TransRow key={i} t={t} isISrow isName={i === 0 ? (t.compound_name || 'IS') : ''} />
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
