import { useEffect, useState } from 'react'
import axios from 'axios'
import { ChevronDown, Download, FileJson, FileSpreadsheet, Layers, Printer, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { API } from '@/lib/api'
import { downloadText } from '@/lib/methodText'
import { cn } from '@/lib/utils'

interface ExportFormat {
  key: string
  label: string
  software: string
  extension: string
  status: 'documented' | 'untested'
  tested_in: string | null
  vendor: string | null
  note: string
}

// The list changes only with a deploy: fetch it once per page load.
let formatsCache: Promise<ExportFormat[]> | null = null
const loadFormats = () => {
  if (!formatsCache) {
    formatsCache = axios.get<ExportFormat[]>(`${API}/export-formats`).then(r => r.data)
      .catch(err => { formatsCache = null; throw err })
  }
  return formatsCache
}

/** Honest status, shown on every format: whether it has been confirmed by importing a real file. */
function Status({ f }: { f: ExportFormat }) {
  if (f.tested_in) return <span className="text-[11px] font-medium text-success">Tested in {f.tested_in}</span>
  if (f.status === 'documented') return <span className="text-[11px] text-muted-foreground">Documented format</span>
  return <span className="text-[11px] text-warning">Not yet verified: check columns on import</span>
}

const itemCls = 'flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm text-foreground no-underline hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'

function FormatItem({ f, methodId, icon: Icon, onPick }: { f: ExportFormat; methodId: number; icon: LucideIcon; onPick: () => void }) {
  return (
    <a role="menuitem" className={itemCls} href={`${API}/methods/${methodId}/export/${f.key}`} download title={f.note} onClick={onPick}>
      <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span>{f.label}</span>
          <span className="num shrink-0 text-xs text-muted-foreground">.{f.extension}</span>
        </span>
        <span className="block text-xs text-muted-foreground">{f.software}</span>
        <Status f={f} />
      </span>
    </a>
  )
}

function Simple({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <>
      <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {hint && <span className="num text-xs text-muted-foreground">{hint}</span>}
    </>
  )
}

/** Transition tables, not native methods: closed acquisition-method formats
 *  cannot be written reliably from outside the vendor software. */
export default function ExportMenu({ method }: { method: any }) {
  const [open, setOpen] = useState(false)
  const [formats, setFormats] = useState<ExportFormat[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const hasTransitions = (method.mrm_transitions || []).length > 0
  // Deferred so the browser starts the download before the link unmounts.
  const close = () => setTimeout(() => setOpen(false), 0)

  useEffect(() => {
    if (!open || formats) return
    loadFormats().then(setFormats).catch(() => setFailed(true))
  }, [open, formats])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const skyline = formats?.find(f => f.key === 'skyline')
  const generic = formats?.find(f => f.key === 'generic')
  const vendorTables = (formats || []).filter(f => f.vendor)
  const own = vendorTables.find(f => f.vendor === method.instrument_manufacturer)
  const others = vendorTables.filter(f => f !== own)

  return (
    <div className="relative">
      <Button variant="outline" size="lg" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu">
        <Download /> Export <ChevronDown className={cn('opacity-60 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-popover py-1 shadow-xl">
            {hasTransitions && (
              <>
                <p className="label-caps px-3 pb-1 pt-2">Transition list</p>
                {!formats && !failed && <p className="px-3 py-2 text-xs text-muted-foreground">Loading formats…</p>}
                {failed && <p className="px-3 py-2 text-xs text-destructive">Export formats could not be loaded.</p>}
                {skyline && <FormatItem f={skyline} methodId={method.id} icon={Layers} onPick={close} />}
                {own && <FormatItem f={own} methodId={method.id} icon={FileSpreadsheet} onPick={close} />}
                {others.length > 0 && (
                  <>
                    <button type="button" className={cn(itemCls, 'text-muted-foreground')} onClick={() => setShowOthers(s => !s)} aria-expanded={showOthers}>
                      <ChevronDown size={15} className={cn('mt-0.5 shrink-0 transition-transform', !showOthers && '-rotate-90')} />
                      <span className="flex-1">Tables for other instruments</span>
                    </button>
                    {showOthers && (
                      <div className="ml-4 border-l-2 border-border">
                        {others.map(f => <FormatItem key={f.key} f={f} methodId={method.id} icon={FileSpreadsheet} onPick={close} />)}
                        <p className="px-3 pb-2 text-xs text-muted-foreground">
                          Vendor-specific voltages ({method.instrument_manufacturer} terms) do not carry over; optimise them on your instrument.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {generic && <FormatItem f={generic} methodId={method.id} icon={FileSpreadsheet} onPick={close} />}
                <p className="px-3 pb-2 pt-1 text-xs leading-relaxed text-muted-foreground">
                  Import the table into your acquisition method. Source, LC and gradient settings are in Copy method.
                </p>
                <div className="my-1 border-t border-border" />
              </>
            )}
            <p className="label-caps px-3 pb-1 pt-2">Whole method</p>
            <button type="button" role="menuitem" className={itemCls} onClick={() => { downloadText(`metabolc-method-${method.id}.json`, JSON.stringify(method, null, 2), 'application/json'); setOpen(false) }}>
              <Simple icon={FileJson} label="Full method record" hint=".json" />
            </button>
            <button type="button" role="menuitem" className={itemCls} onClick={() => { setOpen(false); setTimeout(() => window.print(), 50) }}>
              <Simple icon={Printer} label="Print or save as PDF" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
