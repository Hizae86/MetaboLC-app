import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, FlaskConical, Users, Sparkles, Plus, Calculator, ArrowRight, ChevronDown } from 'lucide-react'

function ToolsDropdown({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-150
          ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
        <Calculator size={15} />
        Tools
<ChevronDown size={12} style={{opacity:0.5, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.15s'}} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200
            rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tools</p>
            </div>
            <Link to="/tools/method-transfer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700
                hover:bg-indigo-50 hover:text-indigo-700 transition-colors no-underline border-b border-slate-50">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <ArrowRight size={13} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">Method Transfer</p>
                <p className="text-xs text-slate-400">HPLC → UHPLC scaling</p>
              </div>
            </Link>
            <Link to="/tools/mass-calculator"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700
                hover:bg-indigo-50 hover:text-indigo-700 transition-colors no-underline">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Calculator size={13} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold">Mass Calculator</p>
                <p className="text-xs text-slate-400">Monoisotopic mass & adducts</p>
              </div>
            </Link>
              <Link to="/tools/dilution-calculator"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700
                  hover:bg-teal-50 hover:text-teal-700 transition-colors no-underline">
                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                  <FlaskConical size={13} className="text-teal-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Dilution Calculator</p>
                  <p className="text-xs text-slate-400">QC & calibrator preparation</p>
                </div>
              </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const active = (path: string) => path === '/methods' ? location.pathname.startsWith('/methods') || location.pathname.startsWith('/method') : location.pathname === path

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50"
      style={{boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div className="max-w-screen-xl mx-auto px-6 flex justify-between items-center h-16">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="8" fill="#1e3a5f"/>
            <polyline points="4,26 8,26 10,26 12,24 14,10 16,26 18,26 20,22 22,8 24,26 26,26 28,24 30,26 32,26"
              fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="4" y1="28" x2="32" y2="28" stroke="#60a5fa" strokeWidth="1" strokeOpacity="0.4"/>
          </svg>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-900 text-lg tracking-tight">MetaboLC</span>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5
                rounded-full border border-indigo-200">beta</span>
            </div>
            <span className="text-xs text-slate-400 tracking-wide -mt-0.5 block">
              LC-MS/MS Method Repository
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {[
            { to: '/methods', label: 'Methods', icon: BookOpen },
            { to: '/compounds', label: 'Compounds', icon: FlaskConical },
            { to: '/contributors', label: 'Contributors', icon: Users },
          ].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                transition-all duration-150 no-underline
                ${active(to)
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon size={15} />
              {label}
            </Link>
          ))}

          <ToolsDropdown active={location.pathname.startsWith('/tools')} />

          <div className="w-px h-5 bg-slate-200 mx-2" />

          {/* Dra. Massa */}
          <Link to="/advisor"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
              transition-all duration-150 no-underline border
              ${active('/advisor')
                ? 'bg-violet-100 text-violet-700 border-violet-300'
                : 'text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-100'}`}>
            <Sparkles size={15} />
            Dra. Massa
          </Link>

          {/* New Method */}
          <Link to="/submit"
            className="flex items-center gap-1.5 px-4 py-2 ml-1 rounded-lg text-sm font-semibold
              bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-150
              no-underline shadow-sm">
            <Plus size={15} />
            New Method
          </Link>
        </div>
      </div>
    </nav>
  )
}
