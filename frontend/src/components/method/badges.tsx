import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matrixLabel } from '@/lib/format'
import { bandOf, BAND_TEXT } from '../CompletenessScore'

// Fixed mid-tones: used only as small dots, so they read on both themes.
const MATRIX_DOT: Record<string, string> = {
  plasma: '#ef4444', serum: '#f59e0b', urine: '#eab308', 'whole blood': '#b91c1c',
  'dried blood spot': '#ec4899', csf: '#0ea5e9', saliva: '#22c55e', tissue: '#a855f7',
}

const chip = 'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-muted/50 px-1.5 text-xs font-medium text-foreground'

export function MatrixBadge({ matrix, className }: { matrix?: string | null; className?: string }) {
  return (
    <span className={cn(chip, className)}>
      <span className="size-1.5 rounded-full" style={{ background: MATRIX_DOT[(matrix || '').toLowerCase()] || '#94a3b8' }} />
      {matrixLabel(matrix)}
    </span>
  )
}

export function Chip({ children, className, mono, title }: { children: React.ReactNode; className?: string; mono?: boolean; title?: string }) {
  return <span title={title} className={cn(chip, mono && 'num', className)}>{children}</span>
}

export function Verified({ title = 'Verified by a Koiné reviewer', className }: { title?: string; className?: string }) {
  return (
    <span title={title} className={cn('inline-flex text-success', className)}>
      <BadgeCheck size={15} aria-label="Verified" />
    </span>
  )
}

/** Completeness as a compact meter: number in mono + 3-step colour (bands from CompletenessScore). */
export function Score({ value }: { value: number }) {
  const band = bandOf(value)
  const tone = band === 'ready' ? 'bg-success' : band === 'partial' ? 'bg-warning' : 'bg-destructive'
  return (
    <span className="inline-flex items-center gap-1.5" title={`Method completeness: ${value}% · ${BAND_TEXT[band].label}. ${BAND_TEXT[band].meaning}`}>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-muted">
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </span>
      <span className="num w-6 text-right text-xs text-muted-foreground">{value}</span>
    </span>
  )
}

export function TransitionChip({ precursor, product, label }: { precursor: number; product: number; label?: string }) {
  return (
    <span className={cn(chip, 'gap-1')}>
      {label && <span className="max-w-28 truncate text-muted-foreground">{label}</span>}
      <span className="num">{precursor} → {product}</span>
    </span>
  )
}
