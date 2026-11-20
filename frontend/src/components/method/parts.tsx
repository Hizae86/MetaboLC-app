import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isNum, num } from '@/lib/format'

/** Building blocks shared by the method sheet panels. */

export function Panel({ title, icon: Icon, accent, actions, children, className }: {
  title: string; icon?: LucideIcon; accent?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        {accent && <span className="h-4 w-1 rounded-full" style={{ background: accent }} />}
        {Icon && <Icon size={15} className="text-muted-foreground" />}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function Block({ label, children, aside }: { label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="label-caps">{label}</h3>
        {aside}
      </div>
      {children}
    </div>
  )
}

/** Label / value pairs in a dense grid. Missing values are shown as
 *  "Not reported" so a gap is never mistaken for a zero. */
export function Specs({ items, columns = 2 }: {
  items: { label: string; value: unknown; unit?: string; text?: boolean }[]; columns?: 2 | 3
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-2.5', columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {items.map(it => {
        const has = it.text ? !!it.value : isNum(it.value)
        return (
          <div key={it.label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground" title={it.label}>{it.label}</dt>
            <dd className={cn('text-sm', has ? 'text-foreground' : 'text-muted-foreground/70')}>
              {has
                ? <><span className={cn('font-medium', !it.text && 'num')}>{it.text ? String(it.value) : num(it.value)}</span>
                    {it.unit && <span className="ml-1 text-xs text-muted-foreground">{it.unit}</span>}</>
                : <span className="text-xs">Not reported</span>}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
