import { useId } from 'react'

/** Animated version of the Koiné mark for the assistant: the shadow and photon
 *  ring of a black hole, with streaks of light orbiting the horizon.
 *  `active` speeds the orbit up (the assistant is thinking); `still` freezes it.
 *  The motion stops for people who ask the system for reduced motion. */
export default function EventHorizon({ size = 56, active = false, still = false, backdrop = true, className }: {
  size?: number; active?: boolean; still?: boolean; backdrop?: boolean; className?: string
}) {
  const id = useId().replace(/:/g, '')
  const anim = still ? '' : active ? ' eh-fast' : ''
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`eh${still ? ' eh-still' : ''}${anim} ${className ?? ''}`}>
      <defs>
        <linearGradient id={`eh-ring-${id}`} x1="0.03" y1="0.67" x2="0.97" y2="0.33">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.18" stopColor="#bfeaff" />
          <stop offset="0.55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d6fa3" />
        </linearGradient>
      </defs>
      {backdrop && <circle cx="32" cy="32" r="32" fill="#060d1a" />}
      {/* outer matter falling in, slow, counter-clockwise */}
      <g className="eh-spin eh-spin-slow">
        <circle cx="32" cy="32" r="24.5" fill="none" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="1.1"
          strokeLinecap="round" strokeDasharray="0.1 7 2.5 11 0.1 15" />
      </g>
      {/* photon ring, brighter on the left as in the logo */}
      <circle cx="32" cy="32" r="18" fill="none" stroke={`url(#eh-ring-${id})`} strokeWidth="9" />
      {/* light orbiting the horizon */}
      <g className="eh-spin">
        <circle cx="32" cy="32" r="18" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2.4"
          strokeLinecap="round" strokeDasharray="7 16 2 26 12 50" />
      </g>
      {/* shadow: nothing comes back out */}
      <circle cx="32" cy="32" r="13.5" fill="#000" />
      <style>{`
        .eh .eh-spin { transform-box: view-box; transform-origin: 32px 32px; animation: eh-orbit 6s linear infinite; }
        .eh .eh-spin-slow { animation-duration: 14s; animation-direction: reverse; }
        .eh.eh-fast .eh-spin { animation-duration: 1.4s; }
        .eh.eh-fast .eh-spin-slow { animation-duration: 4s; }
        .eh.eh-still .eh-spin { animation: none; }
        @keyframes eh-orbit { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .eh .eh-spin { animation: none; } }
      `}</style>
    </svg>
  )
}
