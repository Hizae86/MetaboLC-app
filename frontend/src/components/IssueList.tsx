import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { TransitionIssue } from '@/lib/massSpec'
import { cn } from '@/lib/utils'

const LEVEL_ICON = { error: XCircle, warning: AlertTriangle, info: Info }
const LEVEL_CLS = { error: 'text-destructive', warning: 'text-warning', info: 'text-muted-foreground' }

export default function IssueList({ issues, okText }: { issues: TransitionIssue[]; okText?: string }) {
  if (!issues.length) return okText ? <p className="flex items-center gap-1.5 text-xs text-success"><CheckCircle2 size={13} /> {okText}</p> : null
  return (
    <ul className="space-y-1">
      {issues.map((i, k) => {
        const Icon = LEVEL_ICON[i.level]
        return <li key={k} className={cn('flex items-start gap-1.5 text-xs', LEVEL_CLS[i.level])}><Icon size={13} className="mt-px shrink-0" /><span>{i.message}</span></li>
      })}
    </ul>
  )
}

