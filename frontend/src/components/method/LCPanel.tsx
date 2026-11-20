import { ArrowRightLeft, Droplets } from 'lucide-react'
import { Link } from 'react-router-dom'
import GradientChart from './GradientChart'
import { Block, Panel, Specs } from './parts'
import { isNum, num } from '@/lib/format'
import { sortedGradient } from '@/lib/methodText'

function Phase({ id, text, tone }: { id: 'A' | 'B'; text?: string | null; tone: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="num mt-px flex size-5 shrink-0 items-center justify-center rounded text-xs font-semibold"
        style={{ color: tone, background: `color-mix(in srgb, ${tone} 14%, transparent)` }}>{id}</span>
      <span className={text ? 'text-sm text-foreground' : 'text-xs text-muted-foreground/70'}>{text || 'Not reported'}</span>
    </div>
  )
}

export default function LCPanel({ method }: { method: any }) {
  const steps = sortedGradient(method)
  const flows = [...new Set(steps.map((s: any) => s.flow_rate_ml_min).filter(isNum))] as number[]
  const dims = isNum(method.column_length_mm) && isNum(method.column_diameter_mm)
    ? `${num(method.column_length_mm)} × ${num(method.column_diameter_mm)} mm` : ''
  const retentionTimes = (method.mrm_transitions || [])
    .filter((t: any) => t.is_quantifier && !t.is_internal_standard && isNum(t.retention_time_min))
    .map((t: any) => ({ name: t.compound_name, rt: Number(t.retention_time_min) }))

  return (
    <Panel title="Liquid chromatography" icon={Droplets} accent="var(--phase-a)">
      <Block label="Column">
        <p className="mb-2.5 text-sm font-medium text-foreground">
          {[method.column_brand, method.column_name].filter(Boolean).join(' ') || <span className="text-muted-foreground">Not reported</span>}
        </p>
        <Specs items={[
          { label: 'Stationary phase', value: method.column_stationary_phase, text: true },
          { label: 'Dimensions (L × ID)', value: dims, text: true },
          { label: 'Particle size', value: method.column_particle_size_um, unit: 'µm' },
          { label: 'Column temperature', value: method.column_temperature_c, unit: '°C' },
        ]} />
      </Block>

      <Block label="Mobile phases">
        <div className="space-y-2">
          <Phase id="A" text={method.mobile_phase_a} tone="var(--phase-a)" />
          <Phase id="B" text={method.mobile_phase_b} tone="var(--phase-b)" />
        </div>
      </Block>

      <Block label="Gradient" aside={flows.length > 0 && (
        <span className="text-xs text-muted-foreground">
          Flow <span className="num text-foreground">{flows.length === 1 ? num(flows[0]) : `${num(Math.min(...flows))}–${num(Math.max(...flows))}`}</span> mL/min
        </span>
      )}>
        {steps.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">No gradient program reported.</p>
        ) : (
          <div className="space-y-3">
            {steps.length > 1 && <GradientChart steps={steps} retentionTimes={retentionTimes} />}
            <Link to={`/tools/method-transfer?method=${method.id}`}
              className="no-print inline-flex items-center gap-1.5 text-xs font-medium text-primary no-underline hover:underline">
              <ArrowRightLeft size={12} /> Scale this method to another column
            </Link>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {['Time (min)', '%A', '%B', 'Flow (mL/min)', 'Curve'].map((h, i) => (
                    <th key={h} className={`py-1.5 font-medium ${i < 4 ? 'text-right' : 'pl-4 text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="num">
                {steps.map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/60 last:border-b-0">
                    <td className="py-1.5 text-right">{Number(s.time_min).toFixed(2)}</td>
                    <td className="py-1.5 text-right text-phase-a">{num(100 - s.percent_b, 1)}</td>
                    <td className="py-1.5 text-right text-phase-b">{num(s.percent_b, 1)}</td>
                    <td className="py-1.5 text-right">{isNum(s.flow_rate_ml_min) ? Number(s.flow_rate_ml_min).toFixed(3) : '—'}</td>
                    <td className="py-1.5 pl-4 font-sans text-xs text-muted-foreground">{s.curve || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>

      <Block label="Injection">
        <Specs items={[
          { label: 'Injection volume', value: method.injection_volume_ul, unit: 'µL' },
          { label: 'Autosampler temperature', value: method.autosampler_temperature_c, unit: '°C' },
          { label: 'Needle wash', value: method.needle_wash_solvent, text: true },
        ]} />
      </Block>
    </Panel>
  )
}
