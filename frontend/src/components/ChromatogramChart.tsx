import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Peak {
  name: string
  rt: number
  intensity: number
  width: number
  color: string
  adduct?: string
}

interface Props {
  peaks: Peak[]
  runTime?: number
  compact?: boolean
  title?: string
}

// Gaussian function
function gaussian(t: number, rt: number, intensity: number, sigma: number): number {
  return intensity * Math.exp(-Math.pow(t - rt, 2) / (2 * sigma * sigma))
}

// Generate smooth chromatogram data points
function generateChromData(peaks: Peak[], runTime: number, nPoints = 500) {
  const points = []
  for (let i = 0; i <= nPoints; i++) {
    const t = (i / nPoints) * runTime
    const point: any = { t: parseFloat(t.toFixed(3)) }
    let total = 0
    for (const p of peaks) {
      const sigma = p.width / 2.355 // Convert FWHM to sigma
      const val = gaussian(t, p.rt, p.intensity, sigma)
      point[p.name] = parseFloat(val.toFixed(2))
      total += val
    }
    point.total = parseFloat(total.toFixed(2))
    points.push(point)
  }
  return points
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label, peaks }: any) => {
  if (!active || !payload?.length) return null

  const activePeaks = payload
    .filter((p: any) => p.value > 0.5)
    .sort((a: any, b: any) => b.value - a.value)

  if (!activePeaks.length) return null

  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px',
      padding: '10px 14px', fontSize: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
    }}>
      <p style={{ color: '#94a3b8', marginBottom: '6px', fontMono: true }}>
        t = {parseFloat(label).toFixed(3)} min
      </p>
      {activePeaks.slice(0, 3).map((p: any) => {
        const peak = peaks.find((pk: Peak) => pk.name === p.name)
        return (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: peak?.color || p.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</span>
            <span style={{ color: '#64748b', marginLeft: 'auto', fontFamily: 'monospace' }}>
              {p.value.toFixed(1)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function ChromatogramChart({ peaks, runTime, compact = false, title }: Props) {
  const [hoveredPeak, setHoveredPeak] = useState<string | null>(null)

  // Auto-calculate run time if not provided
  const maxRt = Math.max(...peaks.map(p => p.rt + p.width * 3))
  const effectiveRunTime = runTime || Math.ceil(maxRt * 1.2)

  const data = useMemo(() =>
    generateChromData(peaks, effectiveRunTime),
    [peaks, effectiveRunTime]
  )

  if (compact) {
    // Mini version — no axes, just curves
    return (
      <div style={{ width: '100%', height: 60 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              {peaks.map(p => (
                <linearGradient key={p.name} id={`grad-mini-${p.name.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={p.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={p.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {peaks.map(p => (
              <Area key={p.name} type="monotone" dataKey={p.name}
                stroke={p.color} strokeWidth={1.5}
                fill={`url(#grad-mini-${p.name.replace(/\s/g,'')})`}
                dot={false} activeDot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Full detailed version
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px',
      padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }}>
      {title && (
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
          {title}
        </p>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        {peaks.map(p => (
          <button key={p.name}
            onMouseEnter={() => setHoveredPeak(p.name)}
            onMouseLeave={() => setHoveredPeak(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px', border: 'none',
              background: hoveredPeak === p.name ? p.color + '20' : '#f8fafc',
              cursor: 'pointer', transition: 'all 0.15s'
            }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#334155' }}>{p.name}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
              {p.rt.toFixed(2)} min
            </span>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <defs>
              {peaks.map(p => (
                <linearGradient key={p.name} id={`grad-${p.name.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={p.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={p.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="t"
              type="number"
              domain={[0, effectiveRunTime]}
              tickCount={8}
              tickFormatter={v => v.toFixed(1)}
              label={{ value: 'Time (min)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />

            <YAxis
              domain={[0, 105]}
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Relative Intensity', angle: -90, position: 'insideLeft', offset: -25, fontSize: 11, fill: '#94a3b8' }}
            />

            <Tooltip
              content={<CustomTooltip peaks={peaks} />}
              cursor={{ stroke: '#e2e8f0', strokeWidth: 1, strokeDasharray: '4 4' }}
            />

            {/* RT reference lines */}
            {peaks.map(p => (
              <ReferenceLine key={p.name} x={p.rt}
                stroke={p.color} strokeDasharray="3 3" strokeOpacity={0.4}
                strokeWidth={hoveredPeak === p.name ? 1.5 : 0.8}
              />
            ))}

            {/* Peak areas */}
            {peaks.map(p => (
              <Area key={p.name} type="monotone" dataKey={p.name}
                stroke={p.color}
                strokeWidth={hoveredPeak === p.name ? 2.5 : 1.8}
                strokeOpacity={hoveredPeak && hoveredPeak !== p.name ? 0.3 : 1}
                fill={`url(#grad-${p.name.replace(/\s/g,'')})`}
                fillOpacity={hoveredPeak && hoveredPeak !== p.name ? 0.3 : 1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>


    </div>
  )
}
