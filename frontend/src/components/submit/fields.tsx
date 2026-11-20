import { cn } from '@/lib/utils'

/** Form primitives for the submission wizard. Defined at module level on
 *  purpose: components declared inside a page component are re-created on
 *  every render, which remounts the inputs and drops focus while typing. */

export const inputCls =
  'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors ' +
  'placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive'

export function Field({ label, required, hint, error, className, children }: {
  label: string; required?: boolean; hint?: string; error?: boolean; className?: string; children: React.ReactNode
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-destructive">Required</span>
        : hint ? <span className="mt-1 block text-xs text-muted-foreground/80">{hint}</span> : null}
    </label>
  )
}

export function Text({ value, onChange, invalid, mono, ...rest }: {
  value: string; onChange: (v: string) => void; invalid?: boolean; mono?: boolean
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange'>) {
  return <input value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid || undefined}
    className={cn(inputCls, mono && 'num')} {...rest} />
}

export function Select({ value, onChange, options, placeholder, invalid }: {
  value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string; invalid?: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid || undefined} className={inputCls}>
      {placeholder !== undefined && <option value="" className="bg-popover">{placeholder}</option>}
      {options.map(o => <option key={o} value={o} className="bg-popover">{o}</option>)}
    </select>
  )
}

export function Section({ title, description, actions, children }: {
  title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function Choice({ options, value, onChange, multiple }: {
  options: readonly { value: string; hint?: string }[]; value: string | string[]; onChange: (v: string) => void; multiple?: boolean
}) {
  const on = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v)
  return (
    <div className="flex flex-wrap gap-1.5" role={multiple ? 'group' : 'radiogroup'}>
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          role={multiple ? 'checkbox' : 'radio'} aria-checked={on(o.value)}
          className={cn('rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
            on(o.value) ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground')}>
          {o.value}{o.hint && <span className="ml-1.5 font-normal text-muted-foreground">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}
