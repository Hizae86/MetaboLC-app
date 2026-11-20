import { Link } from 'react-router-dom'
import { BadgeCheck, CircleDashed, Inbox } from 'lucide-react'
import SEO from '../components/SEO'

const STATES = [
  {
    icon: BadgeCheck, tone: 'text-success', name: 'Verified',
    text: 'A reviewer has compared the method in Koiné with its cited source document: column, mobile phases, gradient, MRM transitions and sample preparation. The method page shows who verified it.',
  },
  {
    icon: CircleDashed, tone: 'text-muted-foreground', name: 'Not yet verified',
    text: 'The method is published and cites its source, but nobody has yet checked the transcription against that document. Use the source link to check the values you rely on.',
  },
  {
    icon: Inbox, tone: 'text-muted-foreground', name: 'Under review',
    text: 'Methods sent by contributors are not public until a reviewer has read them. They are then published as verified or not yet verified, or rejected.',
  },
]

/** Public page: what the verification badge means and what it does not. */
export default function Verification() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 pb-16">
      <SEO title="What “verified” means" description="How Koiné reviews and verifies the LC-MS/MS methods in its library." />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">What “verified” means</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified means the method was checked against its source. It does not mean the method was validated by Koiné.
        </p>
      </header>

      <ul className="space-y-3">
        {STATES.map(({ icon: Icon, tone, name, text }) => (
          <li key={name} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <Icon size={18} className={`mt-0.5 shrink-0 ${tone}`} />
            <div>
              <h2 className="text-sm font-semibold text-foreground">{name}</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <section className="space-y-2 text-sm leading-relaxed text-foreground">
        <h2 className="text-base font-semibold">What verification does not cover</h2>
        <p>
          Koiné does not run the methods. The performance figures come from the source and were obtained in the authors’
          laboratory, on their instrument. Every method must be validated locally before clinical use, for example under
          ISO 15189 or CLSI C62.
        </p>
        <p>
          Found a value that does not match its source? Use “Report an error in this method” at the bottom of the method page.
        </p>
      </section>

      <p className="text-sm"><Link to="/methods" className="font-medium text-primary hover:underline">Browse the methods</Link></p>
    </article>
  )
}
