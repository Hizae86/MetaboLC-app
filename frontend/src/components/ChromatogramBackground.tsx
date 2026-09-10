import { useEffect, useRef } from 'react'

export default function ChromatogramBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const gauss = (x: number, c: number, w: number) =>
      Math.exp(-Math.pow((x - c) / w, 2))

    // Two peaks per side (left cluster + mirrored right cluster), close
    // together — like a real retention-time window — instead of spread
    // across the whole edge.
    const LEFT_POS: [number, number] = [0.09, 0.17]
    const RIGHT_POS: [number, number] = [0.83, 0.91]

    type Trace = {
      hL: [number, number]
      hR: [number, number]
      color: string
      alpha: number
      lw: number
      glow: boolean
      core: boolean
      jitter: number
      baseY: number
    }

    // Several overlaid traces per colour family — like multiple MRM
    // transitions of the same compound sharing a retention time but
    // differing in intensity. Only the brightest trace per family gets
    // the glow/fill/white core treatment.
    const TRACES: Trace[] = [
      { hL: [0.55, 1.1],  hR: [0.5, 1.0],   color: '#00f0ff', alpha: 1,    lw: 3,   glow: true,  core: true,  jitter: 0,      baseY: 0.44 },
      { hL: [0.4, 0.8],   hR: [0.35, 0.75], color: '#38bdf8', alpha: 0.5,  lw: 1.6, glow: false, core: false, jitter: 0.004,  baseY: 0.44 },
      { hL: [0.25, 0.55], hR: [0.22, 0.5],  color: '#7dd3fc', alpha: 0.28, lw: 1.2, glow: false, core: false, jitter: -0.006, baseY: 0.44 },
      { hL: [0.15, 0.35], hR: [0.14, 0.32], color: '#a5f3fc', alpha: 0.15, lw: 1,   glow: false, core: false, jitter: 0.008,  baseY: 0.44 },

      { hL: [0.35, 0.85], hR: [0.4, 0.9],   color: '#c084fc', alpha: 0.85, lw: 2.4, glow: true,  core: false, jitter: 0.003,  baseY: 0.58 },
      { hL: [0.25, 0.6],  hR: [0.28, 0.65], color: '#a855f7', alpha: 0.45, lw: 1.4, glow: false, core: false, jitter: -0.005, baseY: 0.58 },
      { hL: [0.15, 0.4],  hR: [0.16, 0.42], color: '#d8b4fe', alpha: 0.22, lw: 1,   glow: false, core: false, jitter: 0.007,  baseY: 0.58 },
    ]

    const tracePeaks = (tr: Trace, drift: number) => [
      { pos: LEFT_POS[0] + tr.jitter + drift,  h: tr.hL[0], w: 0.028 },
      { pos: LEFT_POS[1] + tr.jitter + drift,  h: tr.hL[1], w: 0.026 },
      { pos: RIGHT_POS[0] + tr.jitter - drift, h: tr.hR[0], w: 0.026 },
      { pos: RIGHT_POS[1] + tr.jitter - drift, h: tr.hR[1], w: 0.028 },
    ]

    const curveYAt = (x: number, tr: Trace, drift: number) => {
      let peak = 0
      for (const p of tracePeaks(tr, drift)) peak += gauss(x, p.pos, p.w) * p.h
      const wave = Math.sin(x * 4 + t * 0.35) * 0.006
      return { peak, wave }
    }

    const drawTrace = (tr: Trace, drift: number) => {
      const W = canvas.width
      const H = canvas.height
      const step = 2
      const pts: { x: number; y: number }[] = []

      for (let px = 0; px <= W + step; px += step) {
        const x = px / W
        const { peak, wave } = curveYAt(x, tr, drift)
        const py = tr.baseY * H - (peak + wave) * H * 0.31
        pts.push({ x: px, y: py })
      }

      if (tr.glow) {
        const grad = ctx.createLinearGradient(0, tr.baseY * H - H * 0.4, 0, tr.baseY * H + 30)
        grad.addColorStop(0, tr.color + '38') // ~22% alpha hex suffix
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.globalCompositeOperation = 'screen'
        ctx.beginPath()
        ctx.moveTo(0, tr.baseY * H + 30)
        for (const pt of pts) ctx.lineTo(pt.x, pt.y)
        ctx.lineTo(W, tr.baseY * H + 30)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'screen'
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2
        const yc = (pts[i].y + pts[i + 1].y) / 2
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc)
      }
      ctx.shadowColor = tr.color
      ctx.shadowBlur = tr.glow ? 30 : 6
      ctx.strokeStyle = tr.color
      ctx.globalAlpha = tr.alpha
      ctx.lineWidth = tr.lw
      ctx.stroke()

      if (tr.core) {
        ctx.shadowColor = '#ffffff'
        ctx.shadowBlur = 8
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.globalAlpha = 0.8
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.globalCompositeOperation = 'source-over'
      return pts
    }

    // Dots that ride along the traces, following the lines themselves
    // rather than any independent path.
    const RIDER_TRACES = TRACES
    const riders = Array.from({ length: 130 }, (_, i) => ({
      tr: RIDER_TRACES[i % RIDER_TRACES.length],
      xNorm: Math.random(),
      speed: 0.0003 + Math.random() * 0.0004,
      size: Math.random() * 1.3 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }))

    const frame = () => {
      t += 0.01
      const W = canvas.width
      const H = canvas.height
      const drift = Math.sin(t * 0.15) * 0.004

      ctx.clearRect(0, 0, W, H)

      for (const tr of TRACES) drawTrace(tr, drift)

      ctx.globalCompositeOperation = 'screen'
      for (const r of riders) {
        r.xNorm = (r.xNorm + r.speed) % 1
        const { peak, wave } = curveYAt(r.xNorm, r.tr, drift)
        const py = r.tr.baseY * H - (peak + wave) * H * 0.31
        const px = r.xNorm * W
        const twinkle = 0.5 + Math.sin(t * 3 + r.phase) * 0.5
        ctx.beginPath()
        ctx.arc(px, py, r.size, 0, Math.PI * 2)
        ctx.shadowColor = r.tr.color
        ctx.shadowBlur = 10
        ctx.fillStyle = r.tr.color
        ctx.globalAlpha = twinkle * Math.max(r.tr.alpha, 0.6)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
