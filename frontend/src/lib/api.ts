import axios from 'axios'

export const API = (import.meta.env.VITE_API_URL || '') + '/api'

export interface MatchedTransition {
  compound: string
  precursor_mz: number
  product_mz: number
  is_is: boolean
  is_quantifier: boolean
}

/** Published community review counts for a method. */
export interface CommunitySummary { as_published: number; with_changes: number; failed: number; total: number }

export interface MethodHit {
  id: number
  title: string
  analyte: string
  matrix: string
  clinical_application: string | null
  ionization_mode: string | null
  instrument_manufacturer: string
  instrument_model: string | null
  column_brand: string | null
  column_name: string | null
  column_stationary_phase: string | null
  mobile_phase_a: string | null
  mobile_phase_b: string | null
  sample_prep_method: string | null
  lloq: number | null
  lloq_unit: string | null
  laboratory: string | null
  source_type: string | null
  country: string | null
  status: string
  is_derivatized: boolean
  run_time_min: number | null
  mrm_count: number
  compound_count: number
  completeness_score: number
  community?: CommunitySummary | null
  completeness?: { score: number; raw_score: number; band: 'ready' | 'partial' | 'reference'; capped_by: string[]; sections: { key: string; label: string; earned: number; max: number; status: 'complete' | 'partial' | 'missing'; missing: string[] }[] }
  chromatogram_svg: string | null
  matched_transitions: MatchedTransition[]
  compounds_preview: string[]
}

export interface FacetValue { value: string; label: string; count: number }

export const FACETS = [
  { key: 'matrix', label: 'Matrix' },
  { key: 'vendor', label: 'Instrument' },
  { key: 'phase', label: 'Stationary phase' },
  { key: 'organic', label: 'Organic modifier (B)' },
  { key: 'additive', label: 'Mobile phase additive' },
  { key: 'prep', label: 'Sample prep' },
  { key: 'ionization', label: 'Ionization' },
  { key: 'application', label: 'Clinical area' },
] as const
export type FacetKey = (typeof FACETS)[number]['key']

export interface SearchResponse {
  total: number
  catalogue_total: number
  offset: number
  limit: number
  mz_tolerance: number
  items: MethodHit[]
  facets: Record<FacetKey, FacetValue[]>
}

export interface Suggestions {
  compounds: { name: string; count: number }[]
  filters: { facet: FacetKey; value: string; label: string; count: number }[]
  mz: { value: number; count: number; tolerance: number } | null
}

export const searchMethods = (params: URLSearchParams, signal?: AbortSignal) =>
  axios.get<SearchResponse>(`${API}/methods/search`, { params, signal }).then(r => r.data)

export const suggest = (q: string, signal?: AbortSignal) =>
  axios.get<Suggestions>(`${API}/methods/suggest`, { params: { q }, signal }).then(r => r.data)

export const isCancel = (err: unknown) => axios.isCancel(err)
