import { useEffect, useRef } from 'react'

/** Animated black hole for the assistant, a small version of the animated Koiné logo:
 *  particles spiral into the horizon (faster the closer they get), the far side of the
 *  disc is bent over and under the shadow by gravity, and the side moving towards us is
 *  brighter. Drawn on a canvas, paused when off screen or in a background tab, and shown
 *  as a still frame to people who ask their system for reduced motion.
 *
 *  `active` makes everything spin faster (the assistant is thinking). */
export default function BlackHole({ size = 56, active = false, particles, className }: {
  size?: number; active?: boolean; particles?: number; className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Logical 100 × 100 scene
    const S = 100, CX = 50, CY = 52
    const RX = 42, K = 0.42, TILT = -0.32, RH = 0.2
    const N = particles ?? Math.round(Math.min(520, Math.max(160, size * 5)))
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const scale = canvas.width / S

    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const COLORS = ['56,189,248', '125,211,252', '230,237,247', '251,191,36']
    type P = { r: number; a: number; pr?: number; px: number; fall: number; size: number; col: string; streak: boolean; born: number }
    const spawn = (p: P, fresh: boolean) => {
      p.r = fresh ? 0.22 + 0.95 * Math.pow(rnd(), 0.6) : 0.95 + rnd() * 0.3
      const arm = Math.floor(rnd() * 3)
      p.a = arm * 2.094 + 3.4 * p.r + (rnd() - 0.5) * 0.9
      p.fall = 0.04 + rnd() * 0.05
      p.size = 0.45 + rnd() * 0.9
      const q = rnd()
      p.col = q < 0.05 ? COLORS[3] : q < 0.34 ? COLORS[2] : q < 0.7 ? COLORS[0] : COLORS[1]
      p.streak = p.col === COLORS[2] ? rnd() < 0.92 : rnd() < 0.55
      p.born = fresh ? 1 : 0
      p.pr = undefined
    }
    const pts: P[] = Array.from({ length: N }, () => { const p = {} as P; spawn(p, true); return p })

    const rot = (dx: number, dy: number): [number, number] =>
      [CX + dx * Math.cos(TILT) - dy * Math.sin(TILT), CY + dx * Math.sin(TILT) + dy * Math.cos(TILT)]
    const diskXY = (r: number, a: number): [number, number] => [RX * r * Math.cos(a), RX * r * K * Math.sin(a)]
    // Gravitational lensing: the far side of the disc appears as an arc over (and, fainter, under) the shadow
    const lensed = (r: number, a: number, below: boolean): [number, number] => {
      const rh = RX * RH, ex = RX * r * Math.cos(a)
      const Rl = below ? rh * 1.12 + (RX * r - rh) * 0.12 : rh * 1.3 + (RX * r - rh) * 0.42
      const th = Math.acos(Math.max(-1, Math.min(1, ex / (RX * r))))
      const u = Rl * Math.cos(th), v = Rl * Math.sin(th) * (below ? 0.7 : 0.8)
      return rot(u, below ? v : -v)
    }
    const doppler = (a: number) => 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(a + 0.4))

    const step = (dt: number) => {
      for (const p of pts) {
        const omega = 0.55 / Math.pow(p.r, 1.5)
        p.px = p.a; p.pr = p.r
        p.a += omega * dt
        p.r -= p.fall * dt * (0.4 + 0.9 / (p.r + 0.15))
        p.born = Math.min(1, p.born + dt * 1.2)
        if (p.r < RH) spawn(p, false)
      }
    }
    const plot = (p: P, x: number, y: number, x0: number, y0: number, alpha: number, thin: boolean) => {
      if (alpha <= 0.01) return
      if (p.streak || p.r < 0.35 || thin) {
        ctx.strokeStyle = `rgba(${p.col},${alpha})`
        ctx.lineWidth = Math.max(0.35, p.size * 0.42 * (0.5 + p.r)) * (thin ? 0.75 : 1)
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke()
      } else {
        const sz = p.size * (0.5 + 0.7 * p.r)
        ctx.fillStyle = `rgba(${p.col},${alpha})`
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz)
      }
    }
    const drawParticles = (front: boolean) => {
      for (const p of pts) {
        if (p.pr === undefined) continue
        const isFront = Math.sin(p.a) > 0
        const n0 = Math.min(1, Math.max(0, (p.r - RH) / 0.3))
        const near = n0 * n0 * (3 - 2 * n0)
        const edge = 1 - Math.min(1, Math.max(0, (p.r - 0.75) / 0.45))
        const lensBase = p.born * edge * 0.85 * doppler(p.a) * (0.3 + 0.7 * near)
        const base = near * p.born * edge * (p.streak ? 0.6 : 0.9) * doppler(p.a)
        const prevA = p.px - 0.06 / Math.max(p.r, 0.15)
        if (isFront === front) {
          const [x, y] = rot(...diskXY(p.r, p.a)), [x0, y0] = rot(...diskXY(p.pr, prevA))
          plot(p, x, y, x0, y0, base, false)
        }
        if (front && !isFront && p.r < 0.85) {
          const w = Math.pow(1 - p.r / 0.85, 0.6)
          const [x, y] = lensed(p.r, p.a, false), [x0, y0] = lensed(p.pr, prevA, false)
          plot(p, x, y, x0, y0, Math.min(1, lensBase * 1.5 * w), true)
          const [xb, yb] = lensed(p.r, p.a, true), [xb0, yb0] = lensed(p.pr, prevA, true)
          plot(p, xb, yb, xb0, yb0, lensBase * 0.8 * w, true)
        }
      }
    }
    const drawHole = () => {
      const rh = RX * RH
      // photon ring: a thin bright edge around the shadow
      ctx.strokeStyle = 'rgba(191,234,255,0.55)'
      ctx.lineWidth = 0.9
      ctx.beginPath(); ctx.arc(CX, CY, rh * 1.08, 0, Math.PI * 2); ctx.stroke()
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, rh * 1.4)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.62, 'rgba(0,0,0,0.97)')
      g.addColorStop(0.82, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(CX, CY, rh * 1.4, 0, Math.PI * 2); ctx.fill()
    }
    const draw = (dt: number) => {
      step(dt * (activeRef.current ? 1.6 : 0.45))
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.075)'
      ctx.fillRect(0, 0, S, S)
      ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(CX, CY, RX * RH, CX, CY, RX * 0.75)
      glow.addColorStop(0, 'rgba(56,189,248,0.05)'); glow.addColorStop(1, 'rgba(56,189,248,0)')
      ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S)
      drawParticles(false)
      ctx.globalCompositeOperation = 'source-over'
      drawHole()
      ctx.globalCompositeOperation = 'lighter'
      drawParticles(true)
      ctx.globalCompositeOperation = 'source-over'
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Warm up so the disc is already formed on the first frame
    for (let i = 0; i < 200; i++) step(1 / 60)
    for (let i = 0; i < 30; i++) draw(1 / 60)
    if (reduce) return

    let raf = 0, last = performance.now(), visible = true
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      draw(dt)
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [size, particles])

  return (
    <canvas ref={ref} aria-hidden="true" className={className}
      style={{ width: size, height: size, display: 'block', borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 52%, #0d2340 0%, #060d1a 62%, #04080f 100%)' }} />
  )
}
