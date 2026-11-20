import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, BadgeCheck, Gauge, Leaf, Upload, Users } from 'lucide-react'
import axios from 'axios'
import SEO from '../components/SEO'
import HeroBlackHole from '../components/HeroBlackHole'
import SearchBox from '@/components/explore/SearchBox'
import { API, searchMethods, type FacetValue } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ModuleCards } from './Modules'

interface Stats { methods: number; verified: number; analytes: number; vendors: number }

const TRUST = [
  { icon: BadgeCheck, title: 'Verified against the source', text: 'A reviewer checks column, gradient, transitions and sample preparation against the publication.' },
  { icon: Users, title: 'Community reviewed', text: 'Labs that ran a method say whether it worked as published, with changes, or not.' },
  { icon: Gauge, title: 'Ready-to-run score', text: 'Shows at a glance whether a method has what you need to set it up.' },
  { icon: Leaf, title: 'Environmental impact', text: 'Organic solvent per injection and a green score for every method.' },
]


/** Fades the disc out before the screen edge, so on phones it never ends in a hard cut. */
const EDGE_FADE = (() => {
  const m = 'linear-gradient(90deg, transparent calc(50% - 50vw + 4px), #000 calc(50% - 50vw + 56px), #000 calc(50% + 50vw - 56px), transparent calc(50% + 50vw - 4px))'
  return { maskImage: m, WebkitMaskImage: m } as const
})()


export default function Home() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [matrices, setMatrices] = useState<FacetValue[]>([])
  const [areas, setAreas] = useState<FacetValue[]>([])

  useEffect(() => {
    Promise.all([
      searchMethods(new URLSearchParams({ limit: '1' })),
      searchMethods(new URLSearchParams({ limit: '1', verified: '1' })),
      axios.get(`${API}/methods/compounds`).then(r => r.data.length as number).catch(() => 0),
    ]).then(([all, verified, analytes]) => {
      setStats({ methods: all.catalogue_total, verified: verified.total, analytes, vendors: all.facets.vendor.filter(v => v.count > 0).length })
      setMatrices(all.facets.matrix.filter(m => m.count > 0 && m.value !== 'other').slice(0, 6))
      setAreas([...all.facets.application].filter(a => a.count > 0).sort((a, b) => b.count - a.count).slice(0, 8))
    }).catch(() => {})
  }, [])

  // Hint that the page continues, shown only while nothing below the hero is on screen.
  const [atTop, setAtTop] = useState(false)
  useEffect(() => {
    const check = () => {
      const next = document.getElementById('life')
      setAtTop(!!next && window.scrollY < 60 && next.getBoundingClientRect().top > window.innerHeight - 40)
    }
    check()
    // Re-check whenever the page changes height: stats and chips arrive after the first paint
    // and push the next section down.
    const ro = new ResizeObserver(check)
    ro.observe(document.body)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { ro.disconnect(); window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])
  const toLifecycle = () => document.getElementById('life')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const go = (params: Record<string, string>) => navigate(`/methods?${new URLSearchParams(params)}`)
  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary'
  const eyebrow = 'label-caps text-primary'

  return (
    <>
      <SEO title="The Common Language of LC-MS/MS Methods"
        description="Search, compare and export clinical LC-MS/MS methods by analyte, matrix, column and MRM transition. Free, open, every method cites its source." />

      {/* Hero: the Koiné black hole behind the name */}
      <section className="relative z-10 overflow-hidden px-4 pb-8 pt-6 sm:pt-8">

        <div className="relative mx-auto w-full max-w-2xl text-center">
          <span className="label-caps inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3.5 py-1 text-primary backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-primary" /> The common language of LC-MS/MS
          </span>
          {/* The name sits on the black hole; the disc has its own band so it never runs under text */}
          <div className="relative flex h-[170px] items-center justify-center sm:h-[230px]">
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(980px, 150vw)', ...EDGE_FADE }} aria-hidden="true">
              <HeroBlackHole />
            </div>
            <h1 className="relative flex justify-center">
              <span className="sr-only">Koiné</span>
              <img src="/koine-wordmark.svg" alt="" aria-hidden="true" className="hidden h-16 w-auto drop-shadow-[0_2px_18px_rgba(6,13,26,0.9)] dark:block sm:h-24" />
              <img src="/koine-wordmark-light.svg" alt="" aria-hidden="true" className="h-16 w-auto dark:hidden sm:h-24" />
            </h1>
          </div>
          <p className="mx-auto mt-0 max-w-3xl text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Don’t start your next method from a blank page.
          </p>

          <form className="mt-6 text-left" onSubmit={e => { e.preventDefault(); if (text.trim()) go({ q: text.trim() }) }}>
            <SearchBox value={text} onChange={setText}
              onPickCompound={name => go({ q: name })}
              onPickFilter={(facet, value) => go({ [facet]: value })}
              onPickMz={mz => go({ mz: String(mz) })} />
          </form>

          <dl className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-2">
            {[
              ['Methods', stats?.methods], ['Verified', stats?.verified],
              ['Analytes', stats?.analytes], ['Vendors', stats?.vendors],
            ].map(([label, value]) => (
              <div key={label as string} className="flex flex-col-reverse">
                <dt className="label-caps mt-0.5 text-muted-foreground">{label}</dt>
                <dd className="num text-2xl font-bold text-primary sm:text-3xl">{value ?? '–'}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {matrices.map(m => (
              <button key={m.value} type="button" className={chip} onClick={() => go({ matrix: m.value })}>
                {m.label} <span className="num opacity-70">{m.count}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 hidden flex-wrap justify-center gap-1.5 sm:flex [@media(max-height:760px)]:!hidden">
            {areas.map(a => (
              <button key={a.value} type="button" className={chip} onClick={() => go({ application: a.value })}>
                {a.label} <span className="num opacity-70">{a.count}</span>
              </button>
            ))}
          </div>
          <Link to="/methods" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary no-underline hover:underline">
            Browse all methods <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* The first screen fades out at the bottom, with an arrow: the usual sign that the page goes on. */}
      <div aria-hidden={!atTop}
        className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-40 flex h-28 items-end justify-center bg-gradient-to-b from-transparent via-background/80 to-background pb-4 transition-opacity duration-500',
          atTop ? 'opacity-100' : 'opacity-0')}>
        <button type="button" onClick={toLifecycle} tabIndex={atTop ? 0 : -1}
          className={cn('flex flex-col items-center gap-0.5 text-xs font-medium text-primary', atTop && 'pointer-events-auto')}>
          See the modules
          <ChevronDown size={18} className="motion-safe:animate-bounce" />
        </button>
      </div>

      <div className="relative z-10 bg-background">
        {/* The method's life: one module per step */}
        <section id="life" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 pt-8 sm:px-6" aria-labelledby="life-title">
          <p className={eyebrow}>Three modules, one method</p>
          <h2 id="life-title" className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Find it, validate it, run it.</h2>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Each module picks up where the last one left off: the method you choose in the library is the one you validate, and the one you validate is the one you run.
          </p>
          <div className="mt-8"><ModuleCards compact /></div>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
            <Link to="/modules" className="inline-flex items-center gap-1.5 text-primary no-underline hover:underline">How each module works <ArrowRight size={14} /></Link>
            <Link to="/modules#quality" className="inline-flex items-center gap-1.5 text-muted-foreground no-underline hover:text-primary hover:underline">For quality managers <ArrowRight size={14} /></Link>
          </div>
        </section>

        {/* Why trust a method here */}
        <section className="border-y border-border bg-muted/30" aria-labelledby="trust-title">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row">
            <div className="lg:w-1/3">
              <p className={eyebrow}>Why trust a method here</p>
              <h2 id="trust-title" className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Every method cites its source.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Every method is transcribed from a public application note, article or poster, and links back to it.
              </p>
              <Link to="/verification" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary no-underline hover:underline">
                What “verified” means <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              {TRUST.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-border bg-card p-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={18} /></span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contribute */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start gap-4 border-t border-border pt-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Published a method? Put it where people will run it.</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Paste your transition table and gradient, cite the source, and it joins the review queue. Your name and paper go on the method page.
              </p>
            </div>
            <Link to="/submit" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary no-underline hover:bg-primary/10">
              <Upload size={15} /> Submit a method
            </Link>
          </div>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Reference library — methods require independent validation in your laboratory before clinical use.
          </p>
        </section>
      </div>
    </>
  )
}
