'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, safeEqual, sessionToken, sitePassword } from '@/lib/auth'

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = sitePassword()
  const given = String(formData.get('password') ?? '')
  if (!password || !safeEqual(given, password)) return 'Wrong password.'

  const store = await cookies()
  store.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  const next = String(formData.get('next') ?? '')
  // Only same-site paths, never //host or /\host.
  redirect(/^\/(?![/\\])/.test(next) ? next : '/')
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
