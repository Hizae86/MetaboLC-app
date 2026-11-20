import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { num } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Step { time_min: number; percent_b: number; flow_rate_ml_min?: number | null; curve?: string | null }
interface Mark { name: string; rt: number }

const COLLAPSED = 14

/** %B over time. "step" segments are drawn as true steps. Reported retention
 *  times (quantifier transitions) are marked on the chart and listed below it
 *  in elution order; hovering either one highlights the other. */
export default function GradientChart({ steps, retentionTimes = [] }: { steps: Step[]; retentionTimes?: Mark[] }) {
  const [active, setActive] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const points: { t: number; b: number }[] = []
  steps.forEach((s, i) => {
    if (i > 0 && s.curve === 'step') points.push({ t: s.time_min, b: steps[i - 1].percent_b })
    points.push({ t: s.time_min, b: s.percent_b })
  })
  const end = steps[steps.length - 1].time_min

  // One mark per compound, in elution order.
  const marks = useMemo(() => {
    const seen = new Map<string, Mark>()
    retentionTimes.forEach(r => { if (r.rt >= 0 && r.rt <= end && !seen.has(r.name)) seen.set(r.name, r) })
    return [...seen.values()].sort((a, b) => a.rt - b.rt)
  }, [retentionTimes, end])

  // Axis ticks at the programmed step times: those are the numbers you type into the pump table.
  const ticks = [...new Set([0, ...steps.map(s => s.time_min)])].sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || i === arr.length - 1 || (t - arr[i - 1] > end * 0.07 && end - t > end * 0.07))

  const activeMark = marks.find(m => m.name === active)
  const listed = showAll ? marks : marks.slice(0, COLLAPSED)

  return (
    <div>
      <div className="h-44 w-full" role="img" aria-label={`Gradient profile: ${steps.map(s => `${s.percent_b}% B at ${s.time_min} min`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 14, right: 14, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, end]} ticks={ticks} tickFormatter={t => num(t, 2)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={false} tickLine={false} />
            {marks.map(r => r.name !== active && (
              <ReferenceLine key={r.name} x={r.rt} stroke="var(--muted-foreground)" strokeOpacity={active ? 0.2 : 0.45} strokeDasharray="2 3" />
            ))}
            {activeMark && (
              <ReferenceLine x={activeMark.rt} stroke="var(--primary)" strokeWidth={2}
                label={{ value: `${activeMark.name} · ${num(activeMark.rt, 2)}`, position: activeMark.rt > end * 0.6 ? 'insideTopRight' : 'insideTopLeft',
                  fill: 'var(--primary)', fontSize: 11, dy: -12 }} />
            )}
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
              content={({ active: on, payload }) => {
                if (!on || !payload?.length) return null
                const p = payload[0].payload as { t: number; b: number }
                // Compounds eluting around the cursor; if none is close, the nearest one.
                const win = Math.max(end * 0.04, 0.05)
                let near = marks.filter(r => Math.abs(r.rt - p.t) <= win).slice(0, 6)
                const fallback = near.length === 0 && marks.length > 0
                if (fallback) near = [marks.reduce((a, b) => (Math.abs(b.rt - p.t) < Math.abs(a.rt - p.t) ? b : a))]
                return (
                  <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg">
                    <div className="num">{num(p.t, 2)} min · <span className="text-phase-b">{num(p.b, 1)}% B</span> · <span className="text-phase-a">{num(100 - p.b, 1)}% A</span></div>
                    {near.length > 0 && <div className="mt-1 border-t border-border pt-1 text-muted-foreground">{fallback ? 'Nearest peak' : 'Eluting here'}</div>}
                    {near.map(r => <div key={r.name} className="flex justify-between gap-4"><span>{r.name}</span><span className="num text-muted-foreground">{num(r.rt, 2)}</span></div>)}
                  </div>
                )
              }}
            />
            <Area type="linear" dataKey="b" stroke="var(--phase-b)" strokeWidth={2} fill="var(--phase-b)" fillOpacity={0.12}
              dot={{ r: 2.5, fill: 'var(--phase-b)', strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        %B vs. time (min).
        {marks.length > 0 && <> Dashed lines: reported retention times of <span className="num">{marks.length}</span> analyte{marks.length === 1 ? '' : 's'}.</>}
      </p>

      {marks.length > 0 && (
        <div className="mt-2.5">
          <p className="label-caps mb-1.5 text-muted-foreground">Elution order · RT (min)</p>
          <div className="flex flex-wrap gap-1" onMouseLeave={() => setActive(null)}>
            {listed.map(r => (
              <button key={r.name} type="button" onMouseEnter={() => setActive(r.name)} onFocus={() => setActive(r.name)} onBlur={() => setActive(null)}
                className={cn('inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs transition-colors',
                  active === r.name ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40 text-foreground')}>
                <span className="num text-muted-foreground">{num(r.rt, 2)}</span>{r.name}
              </button>
            ))}
            {marks.length > COLLAPSED && (
              <button type="button" onClick={() => setShowAll(s => !s)} className="no-print px-1.5 py-0.5 text-xs font-medium text-primary hover:underline">
                {showAll ? 'Show fewer' : `Show all ${marks.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
