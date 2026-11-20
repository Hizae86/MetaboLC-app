import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight, ArrowRightLeft, Beaker, BookOpen, Calculator, ChevronDown, ClipboardCheck, FlaskConical,
  GitCompareArrows, Inbox, Layers, Library, Menu, Plus, Scale, SearchCheck, TestTubes, Users, X, type LucideIcon } from 'lucide-react'
import CommandPalette from './CommandPalette'
import ThemeToggle from './ThemeToggle'
import { isThemedRoute } from '@/lib/theme'
import { REVIEW_EVENT, adminConfig, useAdmin } from '@/lib/admin'
import { API } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MODULES, STATUS_LABEL } from '@/lib/modules'

const TOOLS: Item[] = [
  { to: '/tools/method-transfer', label: 'Method Transfer', hint: 'HPLC → UHPLC scaling', icon: ArrowRightLeft },
  { to: '/tools/mass-calculator', label: 'Mass Calculator', hint: 'Monoisotopic mass & adducts', icon: Calculator },
  { to: '/tools/dilution-calculator', label: 'Dilution Calculator', hint: 'QC & calibrator preparation', icon: Beaker },
  { to: '/tools/matrix-effect', label: 'Matrix Effect & Recovery', hint: 'Ion suppression & extraction efficiency', icon: TestTubes },
  { to: '/tools/interference', label: 'Interference Checker', hint: 'Isobaric overlaps across the repository', icon: SearchCheck },
  { to: '/tools/unit-converter', label: 'Unit Converter', hint: 'ng/mL ↔ nmol/L', icon: Scale },
]

type Item = { to?: string; label: string; hint: string; icon: LucideIcon; badge?: string; muted?: boolean }

/** The reference library: everything that is free and live today. */
const LIBRARY: Item[] = [
  { to: '/methods', label: 'Methods', hint: 'Search and filter every method', icon: BookOpen },
  { to: '/compounds', label: 'Analytes', hint: 'Browse by compound', icon: FlaskConical },
  { to: '/compare', label: 'Compare methods', hint: 'Side by side, gradients overlaid', icon: GitCompareArrows },
  { to: '/panel-builder', label: 'Panel builder', hint: 'Combine transitions, check isobaric conflicts', icon: Layers },
  { to: '/contributors', label: 'Contributors', hint: 'Who shared the methods', icon: Users },
]

/** Modules menu, built from the shared definitions. The library has its own menu. */
const MODULE_ITEMS: Item[] = MODULES.filter(m => m.id !== 'library').map(m => ({
  to: m.to ?? `/modules#${m.id}`, label: m.title, hint: m.hint, icon: m.icon, badge: STATUS_LABEL[m.status],
}))

const linkCls = (active: boolean) => cn(
  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium no-underline transition-colors',
  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
)

/** Reviewer-only link with the number of submissions waiting. */
function ReviewLink({ active }: { active: boolean }) {
  const { isAdmin } = useAdmin()
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!isAdmin) { setCount(null); return }
    const load = () => axios.get(`${API}/methods/review-queue/count`, adminConfig())
      .then(r => setCount((r.data.submitted ?? 0) + (r.data.community_pending ?? 0))).catch(() => setCount(null))
    load()
    window.addEventListener(REVIEW_EVENT, load)
    return () => window.removeEventListener(REVIEW_EVENT, load)
  }, [isAdmin])
  if (!isAdmin) return null
  return (
    <Link to="/review" className={linkCls(active)} title="Review queue">
      <Inbox size={15} />
      Review
      {!!count && <span className="num rounded-full bg-warning px-1.5 text-[11px] font-semibold text-background">{count}</span>}
    </Link>
  )
}

function NavMenu({ label, icon: Icon, items, active, footer }: { label: string; icon: LucideIcon; items: Item[]; active: boolean; footer?: { to: string; label: string } }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true" className={linkCls(active)}>
        <Icon size={15} />
        {label}
        <ChevronDown size={12} className={cn('opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
            {items.map(item => <MenuRow key={item.label} item={item} onPick={() => setOpen(false)} />)}
            {footer && (
              <Link to={footer.to} onClick={() => setOpen(false)}
                className="flex items-center justify-between bg-muted/40 px-3.5 py-2.5 text-xs font-semibold text-primary no-underline hover:bg-accent">
                {footer.label} <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuRow({ item: { to, label, hint, icon: Icon, badge, muted }, onPick }: { item: Item; onPick?: () => void }) {
  const body = (
    <>
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', to && !muted ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/60')}>
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', to && !muted ? 'text-foreground' : 'text-muted-foreground')}>
          {label}
          {badge && <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold',
            to && !muted ? 'border border-primary/35 bg-primary/10 text-primary' : 'border border-border text-muted-foreground')}>{badge}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </>
  )
  const cls = 'flex items-center gap-3 border-b border-border px-3.5 py-2.5 no-underline last:border-b-0'
  return to
    ? <Link to={to} onClick={onPick} className={cn(cls, 'transition-colors hover:bg-accent')}>{body}</Link>
    : <div className={cn(cls, 'cursor-default')} aria-disabled="true">{body}</div>
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const active = (path: string) =>
    path === '/methods' ? pathname.startsWith('/method') : pathname === path

  return (
    <nav className={cn(
      'sticky top-0 z-50 border-b transition-colors',
      scrolled || menuOpen ? 'border-border bg-background/95 backdrop-blur-lg' : 'border-transparent bg-transparent',
    )}>
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="Koiné home">
          {/* Logo with the name underneath, BETA beside it */}
          <span className="flex flex-col items-center leading-none">
            <img src="/koine-mark.svg" width={30} height={30} alt="" aria-hidden="true" className="hidden size-[30px] dark:block" />
            <img src="/koine-icon.svg" width={30} height={30} alt="" aria-hidden="true" className="size-[30px] dark:hidden" />
            <span className="mt-1 text-[13px] font-semibold tracking-tight text-foreground">Koiné</span>
          </span>
          <span className="flex flex-col items-start gap-1">
            <span className="rounded-full border border-primary/35 bg-primary/10 px-1.5 py-px text-[10px] font-semibold tracking-wider text-primary">
              BETA
            </span>
            <span className="hidden whitespace-nowrap text-xs tracking-wide text-muted-foreground 2xl:block">
              LC-MS/MS Method Reference Library
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <NavMenu label="Library" icon={Library} items={LIBRARY}
            active={pathname.startsWith('/method') || ['/compounds', '/compare', '/panel-builder', '/contributors'].includes(pathname)} />
          <NavMenu label="Modules" icon={ClipboardCheck} items={MODULE_ITEMS} footer={{ to: '/modules', label: 'How the modules work' }}
            active={pathname.startsWith('/validation') || pathname === '/modules'} />
          <NavMenu label="Tools" icon={Calculator} items={TOOLS} active={pathname.startsWith('/tools')} />
          <ReviewLink active={pathname === '/review'} />

          <div className="ml-1"><CommandPalette /></div>
          <div className="mx-2 h-5 w-px bg-border" />

          <Link to="/advisor" className={linkCls(active('/advisor'))}>
            <img src="/koine-mark.svg" width={17} height={17} alt="" aria-hidden="true" className="hidden size-[17px] dark:block" /><img src="/koine-icon.svg" width={17} height={17} alt="" aria-hidden="true" className="size-[17px] dark:hidden" />
            Assistant
          </Link>
          <Link to="/submit"
            className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/85">
            <Plus size={15} />
            New Method
          </Link>
          {/* Only on pages that already support both themes. */}
          {isThemedRoute(pathname) && <div className="ml-1"><ThemeToggle /></div>}
        </div>

        {/* Small screens: primary action + a menu with everything else. */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <Link to="/submit" aria-label="New method"
            className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-2 text-sm font-semibold text-primary-foreground no-underline">
            <Plus size={15} /> <span className="hidden sm:inline">New Method</span>
          </Link>
          {isThemedRoute(pathname) && <ThemeToggle />}
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-label="Menu"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border px-4 py-3 lg:hidden">
          {([['Library', LIBRARY], ['Modules', MODULE_ITEMS], ['Tools', TOOLS]] as const).map(([title, items], i) => (
            <div key={title}>
              <p className={cn('label-caps mb-1 px-2.5 text-muted-foreground', i > 0 && 'mt-3')}>{title}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {items.map(({ to, label, icon: Icon, badge, muted }) => to
                  ? <Link key={label} to={to} className={linkCls(pathname === to || (to === '/methods' && pathname.startsWith('/method')))}>
                      <Icon size={15} /> {label}
                      {badge && <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold',
                        muted ? 'border border-border text-muted-foreground' : 'border border-primary/35 bg-primary/10 text-primary')}>{badge}</span>}
                    </Link>
                  : <span key={label} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground/70">
                      <Icon size={15} /> {label}
                      <span className="rounded-full border border-border px-1.5 py-px text-[10px] font-semibold">{badge}</span>
                    </span>)}
              </div>
            </div>
          ))}
          <Link to="/modules" className="mt-1 flex items-center gap-1 px-2.5 text-xs font-semibold text-primary no-underline">How the modules work <ArrowRight size={12} /></Link>
          <div className="mt-3 grid gap-1 border-t border-border pt-3">
            <Link to="/advisor" className={linkCls(active('/advisor'))}><img src="/koine-mark.svg" width={17} height={17} alt="" aria-hidden="true" className="hidden size-[17px] dark:block" /><img src="/koine-icon.svg" width={17} height={17} alt="" aria-hidden="true" className="size-[17px] dark:hidden" /> Assistant</Link>
            <ReviewLink active={pathname === '/review'} />
          </div>
        </div>
      )}
    </nav>
  )
}
