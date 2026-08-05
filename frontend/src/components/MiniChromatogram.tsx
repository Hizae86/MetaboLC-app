interface Peak {
  rt: number      // retention time 0-100 (normalized)
  height: number  // 0-1 normalized intensity
  sigma: number   // peak width (gaussian sigma)
  isIS?: boolean  // internal standard
}

interface Props {
  transitions: any[]
  matrix?: string
  height?: number
}

const MATRIX_COLOR: Record<string, string> = {
  plasma: '#ef4444',
  serum: '#f97316',
  urine: '#eab308',
  'whole blood': '#dc2626',
  'dried blood spot': '#ec4899',
  csf: '#3b82f6',
  saliva: '#22c55e',
  other: '#8b5cf6',
}

// Gaussian function: y = height * exp(-((x-rt)^2) / (2*sigma^2))
function gaussian(x: number, rt: number, height: number, sigma: number): number {
  return height * Math.exp(-((x - rt) ** 2) / (2 * sigma * sigma))
}

// Generate SVG path for continuous chromatogram baseline + all peaks
function buildChromPath(
  peaks: Peak[],
  W: number,
  H: number,
  baseline: number,
  nPoints = 300
): string {
  const maxPeakH = H - 8 // max pixel height for peaks

  const points: [number, number][] = []

  for (let i = 0; i <= nPoints; i++) {
    const xNorm = (i / nPoints) * 100 // 0..100 normalized RT
    let intensity = 0

    for (const p of peaks) {
      intensity += gaussian(xNorm, p.rt, p.height, p.sigma)
    }

    // Add subtle noise to baseline
    const noise = Math.sin(i * 0.8 + 3.7) * 0.005 + Math.cos(i * 1.3) * 0.003

    const xPx = (xNorm / 100) * W
    const yPx = baseline - Math.min(intensity + noise, 1.05) * maxPeakH
    points.push([xPx, yPx])
  }

  // Build smooth path using line segments (enough points = smooth appearance)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  return d
}

function seededVal(seed: number, i: number): number {
  return Math.abs(Math.sin(seed * 127.1 + i * 311.7 + 74.9)) % 1
}

function generatePeaks(transitions: any[], seed: number): Peak[] {
  const quantifiers = transitions.filter((t: any) => t.is_quantifier && !t.is_internal_standard)
  const isList = transitions.filter((t: any) => t.is_internal_standard)

  const nPeaks = Math.max(2, Math.min(quantifiers.length || Math.ceil(transitions.length * 0.6), 9))
  const peaks: Peak[] = []

  // Spread peaks across RT space with realistic clustering
  const rtPositions: number[] = []
  for (let i = 0; i < nPeaks; i++) {
    const t = quantifiers[i]
    if (t?.retention_time_min) {
      // Use real RT, normalized to 0-100 assuming max 15 min run
      rtPositions.push(Math.min(Math.max((t.retention_time_min / 15) * 90 + 5, 5), 93))
    } else {
      // Spread evenly with jitter
      const base = 8 + (i / (nPeaks - 1 || 1)) * 82
      const jitter = (seededVal(seed, i * 3) - 0.5) * 10
      rtPositions.push(Math.min(Math.max(base + jitter, 5), 93))
    }
  }
  rtPositions.sort((a, b) => a - b)

  for (let i = 0; i < nPeaks; i++) {
    peaks.push({
      rt: rtPositions[i],
      height: 0.3 + seededVal(seed, i * 7 + 1) * 0.7,
      sigma: 1.8 + seededVal(seed, i * 5 + 2) * 2.5,
      isIS: false,
    })
  }

  // IS peak — slightly narrower, moderate height
  if (isList.length > 0) {
    const isT = isList[0]
    const rt = isT.retention_time_min
      ? Math.min(Math.max((isT.retention_time_min / 15) * 90 + 5, 5), 93)
      : 45 + seededVal(seed, 999) * 20
    peaks.push({ rt, height: 0.35 + seededVal(seed, 888) * 0.25, sigma: 1.5, isIS: true })
  }

  return peaks
}

export default function MiniChromatogram({ transitions, matrix = 'other', height = 48 }: Props) {
  const color = MATRIX_COLOR[matrix?.toLowerCase()] || '#8b5cf6'
  const seed = transitions.reduce((a: number, t: any) => a + (t.id || 0), 1)
  const W = 300
  const H = height
  const baseline = H - 3

  const peaks = generatePeaks(transitions, seed)

  // Separate IS from analyte peaks for rendering
  const analytePeaks = peaks.filter(p => !p.isIS)
  const isPeaks = peaks.filter(p => p.isIS)

  const analytePathD = buildChromPath(analytePeaks, W, H, baseline)
  const isPathD = isPeaks.length > 0 ? buildChromPath(isPeaks, W, H, baseline) : null

  const gradId = `cg${seed}`
  const isGradId = `ig${seed}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.03"/>
        </linearGradient>
        <linearGradient id={isGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Baseline */}
      <line x1="0" y1={baseline} x2={W} y2={baseline}
        stroke={color} strokeWidth="0.4" strokeOpacity="0.25"/>

      {/* Analyte peaks fill */}
      <path
        d={`${analytePathD} L ${W},${baseline} L 0,${baseline} Z`}
        fill={`url(#${gradId})`}/>

      {/* Analyte peaks stroke */}
      <path
        d={analytePathD}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeOpacity="0.9"
        strokeLinejoin="round"
        strokeLinecap="round"/>

      {/* IS peaks fill */}
      {isPathD && (
        <path
          d={`${isPathD} L ${W},${baseline} L 0,${baseline} Z`}
          fill={`url(#${isGradId})`}/>
      )}

      {/* IS peaks stroke */}
      {isPathD && (
        <path
          d={isPathD}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="0.9"
          strokeOpacity="0.6"
          strokeDasharray="3,2"
          strokeLinejoin="round"
          strokeLinecap="round"/>
      )}
    </svg>
  )
}
