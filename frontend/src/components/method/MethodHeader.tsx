import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, BookOpenText, Building2, Check, ClipboardCopy, Cpu, Pencil, Trash2 } from 'lucide-react'
import ExportMenu from './ExportMenu'
import StarButton from '../StarButton'
import ShareCiteButton from '../ShareCiteButton'
import { SectionBadges } from '../CompletenessScore'
import { GreenSummary } from './GreenPanel'
import { CommunityBadge } from '../CommunityReviews'
import { Chip, MatrixBadge } from './badges'
import { Button } from '@/components/ui/button'
import { isNum, num } from '@/lib/format'
import { copyText, methodToText, sortedGradient } from '@/lib/methodText'
import { cn } from '@/lib/utils'

interface Props {
  method: any
  validationStatus: 'complete' | 'partial' | 'missing'
  isAdmin: boolean
  onEdit: () => void
  onVerify: () => void
  onDelete: () => void
}

function Fact({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-2.5">
      <dt className="label-caps truncate">{label}</dt>
      <dd className="mt-0.5 truncate text-sm" title={value || undefined}>
        {value
          ? <><span className="num font-medium text-foreground">{value}</span>{unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}</>
          : <span className="text-xs text-muted-foreground/70">Not reported</span>}
      </dd>
    </div>
  )
}

export default function MethodHeader({ method, validationStatus, isAdmin, onEdit, onVerify, onDelete }: Props) {
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const verified = method.status === 'verified'

  const steps = sortedGradient(method)
  const flows = [...new Set(steps.map((s: any) => s.flow_rate_ml_min).filter(isNum))] as number[]
  const transitions: any[] = method.mrm_transitions || []
  const analytes = new Set(transitions.filter(t => !t.is_internal_standard).map(t => t.compound_name)).size
  const longAnalyte = (method.analyte || '').length > 160

  const copyMethod = async () => {
    const ok = await copyText(methodToText(method, `${window.location.origin}/method/${method.id}`))
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <header className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <MatrixBadge matrix={method.matrix} />
            {method.ionization_mode && <Chip mono>{method.ionization_mode.split(' ')[0]}</Chip>}
            {method.clinical_application && <Chip>{method.clinical_application}</Chip>}
            {method.validation_level && <Chip title="Validation level">{method.validation_level}</Chip>}
            {verified && (
              <Link to="/verification" className="inline-flex h-5 items-center gap-1 rounded-md border border-success/40 bg-success/10 px-1.5 text-xs font-medium text-success no-underline hover:bg-success/20"
                title={method.verified_at ? `Verified by ${method.verified_by || 'a reviewer'} on ${new Date(method.verified_at).toLocaleDateString()}` : 'Verified by a Koiné reviewer'}>
                <BadgeCheck size={13} /> Verified{method.verified_by ? ` · ${method.verified_by}` : ''}
              </Link>
            )}
            <CommunityBadge summary={method.community} href="#community" />
            {method.status === 'pending' && (
              <Link to="/verification" title="Published from its cited source; not yet checked against it"
                className="inline-flex h-5 items-center rounded-md border border-dashed border-border px-1.5 text-xs text-muted-foreground no-underline hover:text-foreground">
                Not yet verified
              </Link>
            )}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">{method.title || method.analyte}</h1>
          {method.analyte && method.analyte !== method.title && (
            <p className={cn('mt-1.5 text-sm leading-relaxed text-muted-foreground', longAnalyte && !showAll && 'line-clamp-2')}>{method.analyte}</p>
          )}
          {longAnalyte && (
            <button type="button" onClick={() => setShowAll(s => !s)} className="mt-0.5 text-xs font-medium text-primary hover:underline">
              {showAll ? 'Show less' : 'Show all analytes'}
            </button>
          )}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Cpu size={13} />{[method.instrument_manufacturer, method.instrument_model].filter(Boolean).join(' ')}</span>
            {method.laboratory && <span className="inline-flex items-center gap-1.5"><Building2 size={13} />{[method.laboratory, method.country].filter(Boolean).join(', ')}</span>}
            {method.analyte_cas && <span>CAS <span className="num">{method.analyte_cas}</span></span>}
            <span>Method <span className="num">#{method.id}</span></span>
          </div>

          {/* Provenance: where the method comes from, and who put it here. */}
          {(method.source_type || method.reference || method.submitted_by) && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {(method.source_type || method.reference) && (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenText size={13} className="shrink-0" />
                  Source: {method.source_type || 'Published method'}
                  {method.source_authors && <> by {method.source_authors}</>}
                  {method.reference && !/^https?:/.test(method.reference) && <> · <span className="num">{method.reference}</span></>}
                </span>
              )}
              {method.source_url && (
                <a href={method.source_url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Open source document</a>
              )}
              {method.submitted_by && <span>Contributed by {method.submitted_by}</span>}
            </p>
          )}
        </div>

        <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
          <Button size="lg" onClick={copyMethod} title="Copy the full method sheet as plain text">
            {copied ? <><Check /> Copied</> : <><ClipboardCopy /> Copy method</>}
          </Button>
          <ExportMenu method={method} />
          <ShareCiteButton method={method} />
          <StarButton methodId={method.id} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Stationary phase" value={method.column_stationary_phase || null} />
        <Fact label="Run time" value={steps.length ? num(steps[steps.length - 1].time_min, 2) : null} unit="min" />
        <Fact label="Flow rate" value={flows.length ? (flows.length === 1 ? num(flows[0]) : `${num(Math.min(...flows))}–${num(Math.max(...flows))}`) : null} unit="mL/min" />
        <Fact label="Column temp" value={isNum(method.column_temperature_c) ? num(method.column_temperature_c) : null} unit="°C" />
        <Fact label="Injection" value={isNum(method.injection_volume_ul) ? num(method.injection_volume_ul) : null} unit="µL" />
        <Fact label="Transitions" value={transitions.length ? `${transitions.length}` : null} unit={transitions.length ? `· ${analytes} analyte${analytes === 1 ? '' : 's'}` : undefined} />
      </dl>

      <GreenSummary method={method} />

      <div className="no-print flex flex-wrap items-center gap-3 border-t border-border px-5 py-2.5">
        <SectionBadges method={method} validationStatus={validationStatus} />
        {isAdmin && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={onEdit}><Pencil /> Edit</Button>
            <Button variant="outline" size="sm" onClick={onVerify}><BadgeCheck /> {verified ? 'Unverify' : 'Mark verified'}</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 /> Delete</Button>
          </div>
        )}
      </div>
    </header>
  )
}
