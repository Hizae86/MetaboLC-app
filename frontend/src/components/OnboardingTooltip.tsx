import { useState, useEffect, useRef } from 'react'

interface Props {
  onSearch: (q: string) => void
  onSetMode: (mode: 'search' | 'ai') => void
  firstMethodId?: number
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to MetaboLC 👋',
    desc: 'The largest open repository of clinical LC-MS/MS methods. Let us show you around in 30 seconds.',
    icon: '⚗️',
    targetId: null,
    action: null,
  },
  {
    id: 'search',
    title: 'Search any analyte',
    desc: 'We\'ll search "Testosterone" for you — try typing any compound, matrix, or m/z value.',
    icon: '🔍',
    targetId: 'onboarding-search',
    action: 'search',
  },
  {
    id: 'method',
    title: 'Explore a method',
    desc: 'Each card shows the instrument, matrix, MRM count and LLOQ. Click any card to see full parameters.',
    icon: '📋',
    targetId: 'onboarding-first-card',
    action: null,
  },
  {
    id: 'ai',
    title: 'Ask Dra. Massa',
    desc: 'Our AI advisor searches the repository and recommends the best method for your specific needs.',
    icon: '✨',
    targetId: 'onboarding-ai-btn',
    action: 'switch-ai',
  },
]

export default function OnboardingTooltip({ onSearch, onSetMode, firstMethodId }: Props) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const seen = localStorage.getItem('metabolc_onboarding_v2')
    if (!seen) setTimeout(() => setVisible(true), 800)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    if (!visible) return
    const targetId = STEPS[step].targetId
    cancelAnimationFrame(rafRef.current)

    if (!targetId) { setRect(null); return }

    const track = () => {
      const el = document.getElementById(targetId)
      if (el) setRect(el.getBoundingClientRect())
      rafRef.current = requestAnimationFrame(track)
    }
    rafRef.current = requestAnimationFrame(track)

    // Scroll target into view
    setTimeout(() => {
      const el = document.getElementById(targetId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)

    return () => cancelAnimationFrame(rafRef.current)
  }, [step, visible])

  const handleNext = () => {
    const current = STEPS[step]
    if (current.action === 'search') onSearch('Testosterone')
    if (current.action === 'switch-ai') onSetMode('ai')
    if (step < STEPS.length - 1) {
      // Extra delay after search to let cards render
      const delay = current.action === 'search' ? 1200 : current.action ? 500 : 0
      setTimeout(() => setStep(s => s + 1), delay)
    } else {
      dismiss()
    }
  }

  const dismiss = () => {
    localStorage.setItem('metabolc_onboarding_v2', '1')
    setVisible(false)
    setRect(null)
    cancelAnimationFrame(rafRef.current)
  }

  if (!visible) return null
  const s = STEPS[step]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)' }} />
      <div className="fixed inset-0 z-40" onClick={dismiss} />

      {/* Highlight ring — always fixed relative to viewport */}
      {rect && (() => {
        const colors: Record<string, {border: string, glow: string}> = {
          search: { border: '#818cf8', glow: 'rgba(129,140,248,0.3)' },
          method: { border: '#22c55e', glow: 'rgba(34,197,94,0.3)' },
          ai: { border: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
        }
        const c = colors[STEPS[step].id] || colors.search
        return (
          <div className="fixed z-50 pointer-events-none transition-all duration-200"
            style={{
              top: rect.top - 5,
              left: rect.left - 5,
              width: rect.width + 10,
              height: rect.height + 10,
              borderRadius: 14,
              border: `2px solid ${c.border}`,
              boxShadow: `0 0 0 4px ${c.glow}, 0 0 24px ${c.glow}`,
            }} />
        )
      })()}

      {/* Tooltip — ALWAYS at bottom center, never moves */}
      <div className="fixed z-50 pointer-events-auto"
        style={{ bottom: 32, left: '50%', transform: 'translateX(-50%)', width: 360 }}>
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-400" />
          <div className="p-5">
            {/* Progress */}
            <div className="flex gap-1.5 mb-4">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500
                  ${i <= step ? 'bg-indigo-400' : 'bg-slate-700'}
                  ${i === step ? 'flex-1' : 'w-5'}`} />
              ))}
            </div>

            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div>
                <p className="text-sm font-semibold mb-1">{s.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            </div>

            {/* Contextual previews */}
            {s.id === 'search' && (
              <div className="bg-slate-800 rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2 border border-slate-700">
                <span className="text-slate-500 text-sm">🔍</span>
                <span className="text-sm text-indigo-300 font-mono">Testosterone</span>
                <span className="ml-auto text-xs text-slate-500">→ 21 methods</span>
              </div>
            )}
            {s.id === 'method' && firstMethodId && (
              <a href={`/method/${firstMethodId}`}
                className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2.5 mb-4
                  hover:bg-slate-700 transition-colors no-underline border border-slate-700"
                onClick={dismiss}>
                <span className="text-xs bg-orange-900/50 text-orange-300 px-2 py-0.5 rounded-md font-medium">serum</span>
                <span className="text-xs text-white">Open first result</span>
                <span className="ml-auto text-indigo-400 text-xs">→</span>
              </a>
            )}
            {s.id === 'ai' && (
              <div className="bg-indigo-950 border border-indigo-800 rounded-xl px-3 py-2.5 mb-4">
                <p className="text-xs text-indigo-300 italic">
                  "Which method has the best LLOQ for testosterone in serum?"
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button onClick={dismiss}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{step + 1}/{STEPS.length}</span>
                <button onClick={handleNext}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-xl
                    text-xs font-semibold transition-all active:scale-95">
                  {s.action === 'search' ? '🔍 Search now' :
                   s.action === 'switch-ai' ? '✨ Try AI' :
                   step < STEPS.length - 1 ? 'Next →' : 'Start exploring →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
