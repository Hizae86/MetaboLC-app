import { Activity, BookOpen, ClipboardCheck, FlaskConical, History, Package, ScanLine, type LucideIcon } from 'lucide-react'

/**
 * Koiné's three modules, defined once and used by the home page, the navbar and /modules.
 *
 *   Library   find a published method (free, live)
 *   Validate  validate it your way and get the dossier (early access)
 *   Routine   run it: traceability, QC statistics, stock (next)
 *
 * Every module works from the same method ID, which is what links them.
 * The audit trail is not a module: it comes with Validate and Routine.
 */

export type ModuleStatus = 'live' | 'early' | 'next'

export interface Feature {
  title: string
  icon: LucideIcon
  points: string[]
}

export interface KoineModule {
  id: string
  n: string            // '01'…'03'
  verb: string         // FIND, PROVE, RUN
  title: string
  icon: LucideIcon
  status: ModuleStatus
  to?: string          // only modules that exist have a page
  price: string        // how it is charged, never an amount
  who: string
  summary: string      // one or two sentences: cards and menu
  hint: string         // a few words: navbar menu
  rules?: string[]     // what it does, for the /modules page
  features?: Feature[] // Routine: its parts, each with what it does
  handoff?: string     // what it passes to the next module
  cta: string
}

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  live: 'Free · Live',
  early: 'Early access',
  next: 'Next',
}

export const MODULES: KoineModule[] = [
  {
    id: 'library', n: '01', verb: 'Find', title: 'Library', icon: BookOpen, status: 'live', to: '/methods',
    price: 'Free', who: 'For anyone setting up a method',
    hint: 'Published methods, free',
    summary: 'Published LC-MS/MS methods, checked against their source and reviewed by the labs that ran them.',
    rules: [
      'Each method is transcribed from its publication and stays as published: it is the reference, not a working copy.',
      'Community reviewed: laboratories that ran a method say whether it worked as published, with changes, or not at all, and on which instrument. A moderator checks each review before it appears.',
      'Search, compare and export transitions, gradients and columns.',
      'Panel builder: choose the analytes you want to measure together, or start from a method, and Koiné combines their transitions, flags isobaric conflicts and estimates the dwell time.',
      'Adopting a method creates your laboratory’s own copy, version v1.0, linked to the original.',
    ],
    handoff: 'Your v1.0 copy goes to Validate.',
    cta: 'Browse methods',
  },
  {
    id: 'validate', n: '02', verb: 'Prove', title: 'Validate', icon: ClipboardCheck, status: 'early', to: '/validation',
    price: 'Per validation', who: 'For the person who signs the validation',
    hint: 'Design, preparation, calculations, dossier',
    summary: 'The complete validation, designed for your laboratory: the experimental design, how to prepare every solution and sample, and the calculations. If it passes, Koiné writes the dossier.',
    rules: [
      'Your validation, your way: choose the experiments and acceptance criteria you want, or start from a profile such as Clinical (CLSI C62) or Bioanalysis (ICH M10).',
      'The complete experimental design: runs, days, levels, replicates, matrix lots and the injection sequence.',
      'How to prepare everything: the mobile phases, stock and working standards, calibrators and QCs, how to spike your matrices, and each validation sample.',
      'Every sample gets a coded name. Import the results from your quantitation software and each one is matched to its experiment by that name.',
      'Koiné does the calculations and tells you, experiment by experiment, whether the method meets your criteria.',
      'If it passes, Koiné writes the validation dossier for review and approval.',
      'CE-IVD kits too: verify the manufacturer’s performance claims under your own conditions.',
      'Link the instrument and the lots used, so the evidence points to real equipment and materials.',
      'Already validated the method? Import your existing report instead of repeating the work; it is recorded as imported.',
      'Change control: change the column, internal standard or instrument and Koiné lists which experiments to repeat. A partial revalidation makes a new minor version (v1.1); a full one, a new major version (v2.0).',
      'The method goes into Routine once the dossier is approved.',
    ],
    handoff: 'The approved version goes to Routine.',
    cta: 'Join early access',
  },
  {
    id: 'routine', n: '03', verb: 'Run', title: 'Routine', icon: Activity, status: 'next',
    price: 'Subscription', who: 'For the laboratory running the method every day',
    hint: 'Traceability, QC statistics, stock',
    summary: 'Run the method every day with everything traced, and advanced statistics that show the state of your routine so you can act in time.',
    features: [
      {
        title: 'Trace', icon: ScanLine, points: [
          'Each mobile phase, standard and column gets a printed QR label and a short ID you can also type, such as FM-884 or COL-012.',
          'The label shows reagent lots, who prepared it and its expiry date; injections per column are counted in Koiné against the ID.',
          'Works with any vendor’s columns and instruments: no chips or readers to buy.',
        ],
      },
      {
        title: 'QC & statistics', icon: FlaskConical, points: [
          'Advanced statistics on your routine: Levey-Jennings charts, Westgard rules, trend and shift detection, running CV% and bias, and measurement uncertainty from your QC data.',
          'Each QC result is linked to the mobile phase and column IDs of its run.',
          'When a rule fails, Koiné lists what changed since the last in-control run as candidates, and closing the event requires the corrective action (CAPA) and the cause you confirmed.',
          'Works alongside the QC software you already use.',
        ],
      },
      {
        title: 'Stock & costs', icon: Package, points: [
          'Scanning or typing an ID deducts it from stock and watches expiry dates.',
          'Cost per injection and per sample, from reagents and the column’s cost spread over its injections.',
        ],
      },
    ],
    cta: 'Tell me when it opens',
  },
]

/** Not a module: part of Validate and Routine from the first step. */
export const AUDIT_TRAIL = {
  title: 'Audit trail included', icon: History,
  text: 'Every action in Validate and Routine is recorded and cannot be edited: who did it, what changed and when. Export the complete history of a method in one file for an ISO 15189 assessment.',
}

/** Module ids people can join a waitlist for. Must match MODULES in backend/routes/validation.py. */
export const WAITLIST_IDS = MODULES.filter(m => m.status === 'next').map(m => m.id)

/** Titles for ids stored before the modules were merged into Routine. */
const LEGACY_TITLES: Record<string, string> = { trace: 'Trace (now Routine)', stock: 'Stock & costs (now Routine)', qc: 'QC (now Routine)', benchmark: 'Peer benchmark (dropped)' }
export const moduleTitle = (id: string) => MODULES.find(m => m.id === id)?.title ?? LEGACY_TITLES[id] ?? id

/** What the quality manager gets, worded as evidence, never as compliance. */
export const QUALITY_POINTS = [
  { title: 'Evidence an assessor can follow', text: 'Validation or verification report, instrument, lots, columns and corrective actions, all linked to the same method version.' },
  { title: 'In-house methods under IVDR', text: 'Article 5(5) asks health institutions to document their in-house devices. Koiné keeps that documentation with the method from the first day.' },
  { title: 'Hours back', text: 'The design and the preparation instructions are generated, results are imported by sample name, and the calculations and the dossier are prepared for you to review.' },
]
