'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginForm({ next, siteName }: { next: string; siteName: string }) {
  const [error, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="card stack">
      <div>
        <h1 className="wordmark big">{siteName}</h1>
        <p className="tagline">Authorized viewers only</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Access code</span>
        <input type="password" name="password" autoFocus required autoComplete="current-password" />
      </label>
      <button type="submit" className="primary" disabled={pending}>{pending ? 'Verifying…' : 'Engage'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
