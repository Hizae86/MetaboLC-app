import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { API } from './api'

const ADMIN_KEY_STORAGE = 'metabolc_admin_key'
const EVENT = 'metabolc:admin'

const hasKey = () => { try { return !!sessionStorage.getItem(ADMIN_KEY_STORAGE) } catch { return false } }

/** Sends the admin key (if one was entered this session) on requests.
 *  The backend verifies it; this is not a client-side gate. */
export const adminConfig = () => {
  let key: string | null = null
  try { key = sessionStorage.getItem(ADMIN_KEY_STORAGE) } catch { /* storage unavailable */ }
  return key ? { headers: { 'X-Admin-Key': key } } : {}
}

/** Shared across components (navbar, method page, review queue) through a window event. */
export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(hasKey)

  useEffect(() => {
    const sync = () => setIsAdmin(hasKey())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])

  /** Checks the key against the backend (no side effects) before unlocking reviewer tools. */
  const login = useCallback(async (key: string): Promise<LoginResult> => {
    try {
      await axios.get(`${API}/methods/admin/ping`, { headers: { 'X-Admin-Key': key.trim() } })
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim())
      window.dispatchEvent(new Event(EVENT))
      return 'ok'
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 401) return 'invalid'
      if (status === 503) return 'not-configured'
      return 'unreachable'
    }
  }, [])

  const logout = useCallback(() => {
    try { sessionStorage.removeItem(ADMIN_KEY_STORAGE) } catch { /* nothing to clear */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { isAdmin, login, logout }
}

/** Fired when a method changes moderation state, so the navbar count can refresh. */
export const REVIEW_EVENT = 'metabolc:review-changed'

/** Why a sign-in failed, so the dialog can say what to fix. */
export type LoginResult = 'ok' | 'invalid' | 'not-configured' | 'unreachable'

export type MethodStatus = 'submitted' | 'pending' | 'verified' | 'rejected'

export const setMethodStatus = (id: number, status: MethodStatus) =>
  axios.put(`${API}/methods/${id}/status`, { status }, adminConfig()).then(r => r.data)
