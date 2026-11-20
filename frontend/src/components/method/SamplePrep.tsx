import { Chip } from './badges'
import { extractParams, parseSteps } from '@/lib/samplePrep'

export default function SamplePrep({ method }: { method: any }) {
  const details: string = method.sample_prep_details || ''
  const steps = parseSteps(details)

  if (!method.sample_prep_method && !details) {
    return <p className="text-sm text-muted-foreground">No sample preparation protocol has been submitted for this method.</p>
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {method.sample_prep_method && <Chip>{method.sample_prep_method}</Chip>}
        {!!method.is_derivatized && (
          <Chip className="border-warning/40 bg-warning/10 text-warning">Derivatized: Q1/Q3 refer to the derivative</Chip>
        )}
      </div>
      {steps.length > 1 ? (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-foreground">{step}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {extractParams(step).map((p, pi) => <Chip key={pi} mono className="text-muted-foreground">{p.label}</Chip>)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : details ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{details}</p>
      ) : null}
    </div>
  )
}
