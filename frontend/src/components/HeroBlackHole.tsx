import { useEffect, useRef } from 'react'

/** Wide animated black hole for the home page hero (the scene of the animated
 *  Koiné logo): an accretion disc seen almost edge-on, particles spiralling in,
 *  the far side of the disc lensed over and under the shadow, the approaching
 *  side brighter. Paused off screen and in background tabs; a still frame for
 *  people who ask their system for reduced motion. */
export default function HeroBlackHole({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const W = 1200, H = 550, CX = 600, CY = 300, RX = 470, K = 0.24, TILT = -0.07, RH = 0.085
    const N = window.innerWidth < 700 ? 500 : 1000
    let scale = 1
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(r.width * dpr))
      canvas.height = Math.max(1, Math.round(r.width * dpr * H / W))
      scale = canvas.width / W
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let seed = 11
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const COLORS = ['56,189,248', '125,211,252', '230,237,247', '251,191,36']
    type P = { r: number; a: number; pr?: number; px: number; fall: number; size: number; col: string; streak: boolean; born: number }
    const spawn = (p: P, fresh: boolean) => {
      p.r = fresh ? 0.12 + 1.0 * Math.pow(rnd(), 0.6) : 0.9 + rnd() * 0.35
      const arm = Math.floor(rnd() * 3)
      p.a = arm * 2.094 + 3.4 * p.r + (rnd() - 0.5) * 0.9
      p.fall = 0.035 + rnd() * 0.05
      p.size = 1.2 + rnd() * 2.4
      const q = rnd()
      p.col = q < 0.04 ? COLORS[3] : q < 0.32 ? COLORS[2] : q < 0.7 ? COLORS[0] : COLORS[1]
      p.streak = p.col === COLORS[2] ? rnd() < 0.8 : rnd() < 0.2
      p.born = fresh ? 1 : 0
      p.pr = undefined
    }
    const pts: P[] = Array.from({ length: N }, () => { const p = {} as P; spawn(p, true); return p })
    const rot = (dx: number, dy: number): [number, number] =>
      [CX + dx * Math.cos(TILT) - dy * Math.sin(TILT), CY + dx * Math.sin(TILT) + dy * Math.cos(TILT)]
    const diskXY = (r: number, a: number): [number, number] => [RX * r * Math.cos(a), RX * r * K * Math.sin(a)]
    const lensed = (r: number, a: number, below: boolean): [number, number] => {
      const rh = RX * RH, ex = RX * r * Math.cos(a)
      const Rl = below ? rh * 1.12 + (RX * r - rh) * 0.12 : rh * 1.3 + (RX * r - rh) * 0.42
      const th = Math.acos(Math.max(-1, Math.min(1, ex / (RX * r))))
      const u = Rl * Math.cos(th), v = Rl * Math.sin(th) * (below ? 0.7 : 0.78)
      return rot(u, below ? v : -v)
    }
    const doppler = (a: number) => 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(a + 0.4))
    const step = (dt: number) => {
      for (const p of pts) {
        const om = 0.55 / Math.pow(p.r, 1.5)
        p.px = p.a; p.pr = p.r
        p.a += om * dt
        p.r -= p.fall * dt * (0.4 + 0.9 / (p.r + 0.15))
        p.born = Math.min(1, p.born + dt * 1.2)
        if (p.r < RH) spawn(p, false)
      }
    }
    const plot = (p: P, x: number, y: number, x0: number, y0: number, al: number, thin: boolean) => {
      if (al <= 0.01) return
      if (p.streak || p.r < 0.3 || thin) {
        ctx.strokeStyle = `rgba(${p.col},${al})`
        ctx.lineWidth = Math.max(0.6, p.size * 0.35 * (0.5 + p.r)) * (thin ? 0.7 : 1)
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke()
      } else {
        const s = p.size * (0.45 + 0.75 * p.r)
        ctx.fillStyle = `rgba(${p.col},${al})`
        ctx.fillRect(x - s / 2, y - s / 2, s, s)
      }
    }
    const drawParticles = (front: boolean) => {
      for (const p of pts) {
        if (p.pr === undefined) continue
        const isFront = Math.sin(p.a) > 0
        const n0 = Math.min(1, Math.max(0, (p.r - RH) / 0.35)), near = n0 * n0 * (3 - 2 * n0)
        const edge = 1 - Math.min(1, Math.max(0, (p.r - 0.7) / 0.5))
        const lb = p.born * edge * 0.8 * doppler(p.a) * (0.3 + 0.7 * near)
        const base = near * p.born * edge * (p.streak ? 0.5 : 0.8) * doppler(p.a)
        const pa = p.px - 0.06 / Math.max(p.r, 0.15)
        if (isFront === front) {
          const [x, y] = rot(...diskXY(p.r, p.a)), [x0, y0] = rot(...diskXY(p.pr, pa))
          plot(p, x, y, x0, y0, base, false)
        }
        if (front && !isFront && p.r < 0.8) {
          const w = Math.pow(1 - p.r / 0.8, 0.6)
          const [x, y] = lensed(p.r, p.a, false), [x0, y0] = lensed(p.pr, pa, false)
          plot(p, x, y, x0, y0, Math.min(1, lb * 1.4 * w), true)
          const [xb, yb] = lensed(p.r, p.a, true), [xb0, yb0] = lensed(p.pr, pa, true)
          plot(p, xb, yb, xb0, yb0, lb * 0.75 * w, true)
        }
      }
    }
    const drawHole = () => {
      const rh = RX * RH, g = ctx.createRadialGradient(CX, CY, 0, CX, CY, rh * 1.45)
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.95)')
      g.addColorStop(0.85, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(CX, CY, rh * 1.45, 0, Math.PI * 2); ctx.fill()
    }
    const draw = (dt: number) => {
      step(dt * 0.2) // overall pace: lower is slower
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.04)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      drawParticles(false)
      ctx.globalCompositeOperation = 'source-over'
      drawHole()
      ctx.globalCompositeOperation = 'lighter'
      drawParticles(true)
      ctx.globalCompositeOperation = 'source-over'
    }

    for (let i = 0; i < 300; i++) step(1 / 60)
    for (let i = 0; i < 60; i++) draw(1 / 60)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return () => ro.disconnect()

    let raf = 0, last = performance.now(), visible = true
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      draw(dt)
      raf = requestAnimationFrame(loop)
    }
    const start = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop) } }
    const stop = () => { cancelAnimationFrame(raf); raf = 0 }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop() })
    io.observe(canvas)
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    start()
    return () => { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className={className} style={{ display: 'block', width: '100%', aspectRatio: '1200 / 550' }} />
}
