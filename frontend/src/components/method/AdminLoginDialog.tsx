import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { LoginResult } from '@/lib/admin'

const MESSAGES: Record<Exclude<LoginResult, 'ok'>, string> = {
  invalid: 'That key wasn’t accepted. Check it and try again.',
  'not-configured': 'The server has no admin key set. Add ADMIN_API_KEY to the .env file and restart the backend.',
  unreachable: 'The backend didn’t respond. Check that it is running.',
}

export default function AdminLoginDialog({ open, onOpenChange, onLogin }: {
  open: boolean; onOpenChange: (open: boolean) => void; onLogin: (key: string) => Promise<LoginResult>
}) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<Exclude<LoginResult, 'ok'> | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key) return
    setBusy(true)
    const result = await onLogin(key)
    setBusy(false)
    if (result === 'ok') { setKey(''); setError(null); onOpenChange(false) } else setError(result)
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setKey(''); setError(null) } }}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Reviewer sign-in</DialogTitle>
            <DialogDescription>Enter the admin key to edit, verify or delete methods. It is kept for this browser tab only.</DialogDescription>
          </DialogHeader>
          <div>
            <Input type="password" autoFocus value={key} onChange={e => { setKey(e.target.value); setError(null) }}
              placeholder="Admin key" aria-label="Admin key" aria-invalid={error === 'invalid'} />
            {error && <p role="alert" className="mt-1.5 text-xs text-destructive">{MESSAGES[error]}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!key || busy}>{busy ? 'Checking…' : 'Sign in'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
