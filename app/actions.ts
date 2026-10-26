'use server'

import { cookies } from 'next/headers'
import { SESSION_COOKIE, isValidSession } from '@/lib/auth'
import { parseManifest } from '@/lib/games'
import { fetchLibrary, libraryBase } from '@/lib/library'

// Server side: the TMDB key stays here, and only a signed-in browser is told
// the Torrentio URLs (which carry the debrid keys, as its stream links do).

export type Kind = 'movie' | 'tv'

export type Title = { id: number; name: string; year: string; poster: string | null }
export type Season = { number: number; name: string; episodes: number }
export type Episode = { number: number; name: string }
export type Service = 'Real-Debrid' | 'TorBox'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

const TMDB = 'https://api.themoviedb.org/3'
const TORRENTIO = process.env.TORRENTIO_URL || 'https://torrentio.strem.fun'

async function requireSession() {
  const store = await cookies()
  if (!isValidSession(store.get(SESSION_COOKIE)?.value)) throw new Error('Signed out. Reload the page.')
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY
  if (!key) throw new Error('TMDB_API_KEY is not set.')
  const qs = new URLSearchParams({ ...params, api_key: key })
  const res = await fetch(`${TMDB}/${path}?${qs}`, { signal: AbortSignal.timeout(10_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.status_message ?? `TMDB error ${res.status}`)
  return data as T
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await requireSession()
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' }
  }
}

export async function searchTitles(kind: Kind, query: string) {
  return run(async () => {
    const q = query.trim()
    if (!q) return []
    type Row = { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path: string | null }
    const data = await tmdb<{ results?: Row[] }>(`search/${kind}`, { query: q, include_adult: 'false' })
    return (data.results ?? []).map((r): Title => ({
      id: r.id,
      name: r.title ?? r.name ?? 'Untitled',
      year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
      poster: r.poster_path,
    }))
  })
}

export async function getSeasons(showId: number) {
  return run(async () => {
    type Row = { season_number: number; name: string; episode_count: number }
    const data = await tmdb<{ seasons?: Row[] }>(`tv/${showId}`)
    return (data.seasons ?? [])
      .filter(s => s.season_number > 0)
      .map((s): Season => ({ number: s.season_number, name: s.name, episodes: s.episode_count }))
  })
}

export async function getEpisodes(showId: number, season: number) {
  return run(async () => {
    type Row = { episode_number: number; name: string }
    const data = await tmdb<{ episodes?: Row[] }>(`tv/${showId}/season/${season}`)
    return (data.episodes ?? []).map((e): Episode => ({ number: e.episode_number, name: e.name }))
  })
}

export type StreamSource = { service: Service; url: string }

// Torrentio sits behind Cloudflare, which blocks many server IPs, so the
// browser fetches the streams itself. This only hands a signed-in browser
// the URLs to ask.
export async function getStreamSources(kind: Kind, tmdbId: number, season?: number, episode?: number) {
  return run(async () => {
    const rd = process.env.REALDEBRID_API_KEY
    const tb = process.env.TORBOX_API_KEY
    if (!rd && !tb) throw new Error('Set REALDEBRID_API_KEY or TORBOX_API_KEY.')

    const ext = await tmdb<{ imdb_id?: string | null }>(`${kind}/${tmdbId}/external_ids`)
    if (!ext.imdb_id) throw new Error('No IMDb id for this title.')
    const path = kind === 'movie'
      ? `stream/movie/${ext.imdb_id}.json`
      : `stream/series/${ext.imdb_id}:${season}:${episode}.json`

    const sources: StreamSource[] = []
    if (rd) sources.push({ service: 'Real-Debrid', url: `${TORRENTIO}/realdebrid=${encodeURIComponent(rd)}/${path}` })
    if (tb) sources.push({ service: 'TorBox', url: `${TORRENTIO}/torbox=${encodeURIComponent(tb)}/${path}` })
    return sources
  })
}

// Your games library's games.json, read with GAMES_LIBRARY_KEY. Null when no
// library is set up, so the page can offer local files only.
export async function listGames() {
  return run(async () => {
    if (!libraryBase()) return null
    const res = await fetchLibrary('games.json', { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Games library answered ${res.status} for games.json.`)
    return parseManifest(await res.json().catch(() => {
      throw new Error('games.json is not valid JSON.')
    }))
  })
}
