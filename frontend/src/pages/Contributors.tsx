import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000') + '/api'

const COUNTRY_FLAG: Record<string, string> = {
  'Switzerland': '🇨🇭', 'France': '🇫🇷', 'Spain': '🇪🇸', 'UK': '🇬🇧',
  'Sweden': '🇸🇪', 'Italy': '🇮🇹', 'Japan': '🇯🇵', 'USA': '🇺🇸',
  'Germany': '🇩🇪', 'Qatar': '🇶🇦',
}

const getInitial = (name: string) => {
  const parts = name.replace(/^(Dr\.|Prof\.|Dr)\s+/i, '').trim().split(' ')
  return parts[0]?.[0]?.toUpperCase() || '?'
}

const PODIUM_STYLES = [
  // 2nd place - left
  {
    order: 'order-1',
    height: 'h-32',
    bg: 'from-slate-400 to-slate-500',
    avatarBg: 'bg-slate-200 text-slate-700',
    badge: '🥈',
    badgeBg: 'bg-slate-100 text-slate-600',
    rank: 2,
  },
  // 1st place - center
  {
    order: 'order-2',
    height: 'h-44',
    bg: 'from-yellow-400 to-amber-500',
    avatarBg: 'bg-yellow-100 text-yellow-800',
    badge: '🥇',
    badgeBg: 'bg-yellow-100 text-yellow-700',
    rank: 1,
  },
  // 3rd place - right
  {
    order: 'order-3',
    height: 'h-24',
    bg: 'from-orange-300 to-orange-400',
    avatarBg: 'bg-orange-100 text-orange-700',
    badge: '🥉',
    badgeBg: 'bg-orange-100 text-orange-700',
    rank: 3,
  },
]

export default function Contributors() {
  const [contributors, setContributors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`${API}/methods/contributors`)
      .then(res => setContributors(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const max = contributors[0]?.method_count || 1
  const top3 = [contributors[1], contributors[0], contributors[2]]

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors mb-6 block">
        ← Repository
      </Link>

      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 mb-1">Top Contributors</h1>
        <p className="text-sm text-slate-500">
          Researchers and laboratories sharing LC-MS/MS methods with the community
        </p>
      </div>

      {/* Podium */}
      {!loading && contributors.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-10 px-4">
          {PODIUM_STYLES.map((style, i) => {
            const c = top3[i]
            if (!c) return null
            return (
              <div key={i} className={`flex-1 flex flex-col items-center ${style.order}`}>
                {/* Medal badge */}
                <div className="text-2xl mb-2">{style.badge}</div>

                {/* Avatar */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center
                  text-xl font-bold mb-2 ring-4 ring-white shadow-lg ${style.avatarBg}`}>
                  {getInitial(c.name)}
                </div>

                {/* Name */}
                <p className="text-xs font-semibold text-slate-800 text-center leading-tight mb-1 px-1">
                  {c.name.replace(/^(Dr\.|Prof\.)\s+/i, '')}
                </p>

                {/* Podium block */}
                <div className={`w-full ${style.height} rounded-t-xl bg-gradient-to-b ${style.bg}
                  flex flex-col items-center justify-center shadow-md mt-2`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${style.badgeBg}`}>
                    #{style.rank}
                  </span>
                  <span className="text-white font-bold text-lg">{c.method_count}</span>
                  <span className="text-white/80 text-xs">methods</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Leaderboard table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Ranking</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading contributors…</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contributors.map((c, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                {/* Rank */}
                <div className="w-8 shrink-0 text-center">
                  {i < 3 ? (
                    <span className="text-lg">{['🥇','🥈','🥉'][i]}</span>
                  ) : (
                    <span className="text-sm font-mono text-slate-400">#{i+1}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center
                  text-sm font-bold shrink-0
                  ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-slate-100 text-slate-600' :
                    i === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-indigo-50 text-indigo-600'}`}>
                  {getInitial(c.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <span className="text-base shrink-0">{COUNTRY_FLAG[c.country] || '🌍'}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{c.laboratory}</p>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden w-full max-w-[200px]">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(c.method_count / max) * 100}%`,
                        background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#818cf8'
                      }} />
                  </div>
                </div>

                {/* Count */}
                <div className="text-right shrink-0">
                  <span className={`text-xl font-bold font-mono
                    ${i === 0 ? 'text-yellow-500' :
                      i === 1 ? 'text-slate-500' :
                      i === 2 ? 'text-orange-500' :
                      'text-indigo-500'}`}>
                    {c.method_count}
                  </span>
                  <p className="text-xs text-slate-400">methods</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-slate-500 mb-3">Want to appear on this leaderboard?</p>
        <Link to="/submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white
            rounded-xl text-sm font-medium hover:bg-slate-700 transition-all no-underline">
          + Submit a method
        </Link>
      </div>
    </div>
  )
}
