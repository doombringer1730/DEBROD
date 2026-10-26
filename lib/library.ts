import { isLibraryPath } from './games'

// Server only: talks to your games library with its key.

export function libraryBase() {
  const raw = process.env.GAMES_LIBRARY_URL?.trim()
  if (!raw) return null
  const url = new URL(raw.endsWith('/') ? raw : raw + '/')
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('GAMES_LIBRARY_URL must be an http(s) URL.')
  return url
}

// Sent as both headers so it works with a plain bearer-token server and with
// Supabase Storage (which wants apikey as well).
function authHeaders(): Record<string, string> {
  const key = process.env.GAMES_LIBRARY_KEY?.trim()
  return key ? { Authorization: `Bearer ${key}`, apikey: key } : {}
}

export async function fetchLibrary(path: string, init: { signal?: AbortSignal } = {}) {
  const base = libraryBase()
  if (!base) throw new Error('Set GAMES_LIBRARY_URL to use a games library.')
  if (!isLibraryPath(path)) throw new Error('Bad library path.')
  const url = new URL(path.split('/').map(encodeURIComponent).join('/'), base)
  if (!url.href.startsWith(base.href)) throw new Error('Bad library path.')
  return fetch(url, { headers: authHeaders(), signal: init.signal, cache: 'no-store' })
}
