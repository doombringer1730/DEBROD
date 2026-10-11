import { createHmac, timingSafeEqual } from 'node:crypto'

// One shared password (SITE_PASSWORD). The session cookie holds an HMAC of
// it, so changing the password signs everyone out.
export const SESSION_COOKIE = 'ds_session'

export function sitePassword() {
  return process.env.SITE_PASSWORD ?? ''
}

export function sessionToken() {
  const password = sitePassword()
  if (!password) return ''
  return createHmac('sha256', password).update('debrid-search session').digest('hex')
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function isValidSession(value: string | undefined) {
  const token = sessionToken()
  return !!token && !!value && safeEqual(value, token)
}
