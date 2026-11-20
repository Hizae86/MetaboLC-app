/** Parses transition lists pasted or uploaded by a contributor.
 *
 *  Accepts what people already have: a Skyline transition list, a vendor
 *  acquisition table exported to CSV, a range copied from Excel, or the
 *  table copied from a Koiné method sheet. Columns are recognised by
 *  header name (many aliases), in any order; without a header row the
 *  columns are read as: compound, Q1, Q3, CE, RT.
 *
 *  Nothing is guessed about values. Only the role is inferred when the
 *  file has no role column, and the summary says so. */

export interface DraftTransition {
  compound_name: string
  is_internal_standard: 0 | 1
  is_quantifier: 0 | 1
  precursor_mz: string
  product_mz: string
  [field: string]: string | number
}

export interface ImportResult {
  rows: DraftTransition[]
  recognised: string[]
  ignored: string[]
  skipped: number
  inferredRoles: boolean
  hadHeader: boolean
}

const ALIASES: Record<string, string[]> = {
  compound_name: ['compound', 'compoundname', 'name', 'analyte', 'molecule', 'moleculename', 'precursorname', 'component', 'componentname', 'id'],
  precursor_mz: ['q1', 'q1mz', 'q1mass', 'precursor', 'precursormz', 'precursorion', 'parent', 'parentmz', 'parention', 'ms1'],
  product_mz: ['q3', 'q3mz', 'q3mass', 'product', 'productmz', 'production', 'fragment', 'fragmentmz', 'daughter', 'ms2'],
  retention_time_min: ['rt', 'retentiontime', 'explicitretentiontime', 'expectedrt', 'tr', 'time'],
  collision_energy_ev: ['ce', 'collisionenergy', 'explicitcollisionenergy'],
  declustering_potential: ['dp', 'declusteringpotential', 'explicitdeclusteringpotential', 'fragmentor', 'frag', 'ev'],
  cell_exit_potential: ['cxp', 'cellexitpotential', 'ccl2'],
  cone_voltage: ['cone', 'conevoltage', 'explicitconevoltage', 'cv'],
  cell_accelerator_voltage: ['cellacc', 'cellacceleratorvoltage', 'cav'],
  q1_pre_bias: ['q1bias', 'q1prebias'],
  q3_pre_bias: ['q3bias', 'q3prebias'],
  rf_lens_v: ['rflens', 'rflensv', 'tubelens'],
  dwell_time_ms: ['dwell', 'dwelltime'],
  polarity: ['polarity', 'pol', 'ionmode', 'ionizationmode'],
  assigned_is: ['internalstandard', 'istd', 'assignedis', 'isname'],
  role: ['role', 'type', 'transitiontype', 'quantqual'],
}
const LABELS: Record<string, string> = {
  compound_name: 'Compound', precursor_mz: 'Q1', product_mz: 'Q3', retention_time_min: 'RT', collision_energy_ev: 'CE',
  declustering_potential: 'DP / fragmentor', cell_exit_potential: 'CXP', cone_voltage: 'Cone', cell_accelerator_voltage: 'Cell acc.',
  q1_pre_bias: 'Q1 bias', q3_pre_bias: 'Q3 bias', rf_lens_v: 'RF lens', dwell_time_ms: 'Dwell', polarity: 'Polarity',
  assigned_is: 'Internal standard', role: 'Role',
}
const LOOKUP = new Map<string, string>()
Object.entries(ALIASES).forEach(([field, names]) => names.forEach(n => LOOKUP.set(n, field)))

// "Q1 (m/z)" → "q1", "CE [eV]" → "ce", "Dwell (ms)" → "dwell"
const normaliseHeader = (h: string) => h.toLowerCase().replace(/[([].*?[)\]]/g, '').replace(/m\/z|\bmz\b|\bmin\b|\bev\b$|\bms\b$|\bv\b$/g, '').replace(/[^a-z0-9]/g, '')

const splitLine = (line: string, delimiter: string) => {
  if (delimiter !== ',') return line.split(delimiter).map(c => c.trim())
  // Minimal CSV: commas inside double quotes stay in the cell.
  const cells: string[] = []
  let cell = '', quoted = false
  for (const ch of line) {
    if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { cells.push(cell.trim()); cell = '' }
    else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

const detectDelimiter = (line: string) =>
  line.includes('\t') ? '\t' : line.includes(';') ? ';' : ','

const looksInternalStandard = (name: string) =>
  /(^|[\s\-_(])(d\d{1,2}|13c\d*|15n\d*|2h\d*|istd|i\.?s\.?)($|[\s\-_)])/i.test(name)

export function parseTransitions(text: string): ImportResult {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  const empty: ImportResult = { rows: [], recognised: [], ignored: [], skipped: 0, inferredRoles: false, hadHeader: false }
  if (lines.length === 0) return empty

  const delimiter = detectDelimiter(lines[0])
  // With ";" or tab as separator a comma is a decimal mark (European exports).
  const toNumber = (raw: string) => {
    const s = (delimiter === ',' ? raw : raw.replace(',', '.')).replace(/\s/g, '')
    return s !== '' && Number.isFinite(Number(s)) ? String(Number(s)) : ''
  }

  const table = lines.map(l => splitLine(l, delimiter))
  const first = table[0]
  const hadHeader = first.filter(c => toNumber(c) !== '').length < 2

  let columns: (string | null)[]
  const ignored: string[] = []
  if (hadHeader) {
    const taken = new Set<string>()
    columns = first.map(h => {
      const field = LOOKUP.get(normaliseHeader(h)) ?? null
      if (!field || taken.has(field)) { if (h) ignored.push(h); return null }
      taken.add(field)
      return field
    })
  } else {
    columns = ['compound_name', 'precursor_mz', 'product_mz', 'collision_energy_ev', 'retention_time_min']
  }
  if (!columns.includes('compound_name') || !columns.includes('precursor_mz') || !columns.includes('product_mz')) {
    return { ...empty, ignored, hadHeader }
  }

  const hasRole = columns.includes('role')
  const rows: DraftTransition[] = []
  const seen = new Set<string>()
  let skipped = 0

  table.slice(hadHeader ? 1 : 0).forEach(cells => {
    const get = (field: string) => { const i = columns.indexOf(field); return i >= 0 ? (cells[i] ?? '').replace(/^"|"$/g, '') : '' }
    const name = get('compound_name')
    const q1 = toNumber(get('precursor_mz'))
    const q3 = toNumber(get('product_mz'))
    if (!name || !q1 || !q3) { skipped++; return }

    const role = get('role').toLowerCase()
    let isIS: 0 | 1, isQuant: 0 | 1
    if (hasRole && role) {
      isIS = /^(is|istd|internal)/.test(role) ? 1 : 0
      isQuant = isIS || /^(quan|q1$|target|primary)/.test(role) ? 1 : 0
    } else {
      isIS = looksInternalStandard(name) ? 1 : 0
      isQuant = seen.has(name) ? 0 : 1   // first transition listed for a compound
    }
    seen.add(name)

    const row: DraftTransition = { compound_name: name, is_internal_standard: isIS, is_quantifier: isQuant, precursor_mz: q1, product_mz: q3 }
    columns.forEach(field => {
      if (!field || ['compound_name', 'precursor_mz', 'product_mz', 'role'].includes(field)) return
      const raw = get(field)
      if (field === 'polarity') {
        if (/^(\+|pos|esi\+|positive)/i.test(raw)) row.polarity = 'ESI+'
        else if (/^(-|−|neg|esi-|negative)/i.test(raw)) row.polarity = 'ESI-'
      } else if (field === 'assigned_is') row.assigned_is = raw
      else row[field] = toNumber(raw)
    })
    rows.push(row)
  })

  return {
    rows, skipped, hadHeader, ignored,
    inferredRoles: !hasRole && rows.length > 0,
    recognised: (columns.filter(Boolean) as string[]).map(f => LABELS[f] || f),
  }
}

export interface DraftStep { time_min: string; percent_b: string; flow_rate_ml_min: string; curve: string }

/** Gradient table pasted from a document or spreadsheet: time, %B, flow (optional), one step per line. */
export function parseGradient(text: string): DraftStep[] {
  return text.replace(/\r/g, '').split('\n')
    .map(line => (line.match(/-?\d+(?:[.,]\d+)?/g) || []).map(n => String(Number(n.replace(',', '.')))))
    .filter(nums => nums.length >= 2)
    .map(nums => ({ time_min: nums[0], percent_b: nums[1], flow_rate_ml_min: nums[2] ?? '', curve: 'linear' }))
}
