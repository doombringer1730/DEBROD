'use client'

import { useState, type FormEvent } from 'react'
import {
  getEpisodes, getSeasons, getStreamSources, searchTitles,
  type Episode, type Kind, type Season, type Title,
} from './actions'
import { fetchStreams, type Stream } from '@/lib/torrentio'
import { newRoomId, roomHref } from '@/lib/room'
import { useRouter } from 'next/navigation'

const IMG = 'https://image.tmdb.org/t/p'
// Browsers can't decode these, so such files play silent or not at all.
const INCOMPAT_AUDIO = /\b(AC3|DTS|TrueHD|EAC3|DDP|DD5\.1|Atmos)\b/i

function ext(s: Stream) {
  return s.filename.includes('.') ? s.filename.split('.').pop()!.toLowerCase() : ''
}

function browserSafe(s: Stream) {
  const e = ext(s)
  if (e && e !== 'mp4') return false
  return !INCOMPAT_AUDIO.test(`${s.quality} ${s.title}`)
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function Browser() {
  const [kind, setKind] = useState<Kind>('movie')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Title[]>([])
  const [title, setTitle] = useState<Title | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [season, setSeason] = useState<Season | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [streams, setStreams] = useState<Stream[] | null>(null)
  const [safeOnly, setSafeOnly] = useState(true)
  const [playing, setPlaying] = useState<Stream | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load<T>(call: Promise<{ ok: true; data: T } | { ok: false; error: string }>, set: (v: T) => void) {
    setLoading(true)
    setError(null)
    const res = await call
    setLoading(false)
    if (res.ok) set(res.data)
    else setError(res.error)
  }

  async function loadStreams(...args: Parameters<typeof getStreamSources>) {
    setLoading(true)
    setError(null)
    try {
      const res = await getStreamSources(...args)
      if (!res.ok) throw new Error(res.error)
      setStreams(await fetchStreams(res.data))
    } catch (e) {
      setStreams([])
      setError(e instanceof Error ? e.message : 'Could not load streams.')
    } finally {
      setLoading(false)
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    load(searchTitles(kind, query), setResults)
  }

  function pickTitle(t: Title) {
    setTitle(t)
    setStreams(null)
    setPlaying(null)
    if (kind === 'movie') loadStreams('movie', t.id)
    else load(getSeasons(t.id), setSeasons)
  }

  function pickSeason(s: Season) {
    setSeason(s)
    setEpisodes([])
    load(getEpisodes(title!.id, s.number), setEpisodes)
  }

  function pickEpisode(ep: Episode) {
    setEpisode(ep)
    setStreams(null)
    setPlaying(null)
    loadStreams('tv', title!.id, season!.number, ep.number)
  }

  function back() {
    setError(null)
    setPlaying(null)
    if (streams !== null) {
      setStreams(null)
      if (kind === 'movie') setTitle(null)
      else setEpisode(null)
    } else if (season) {
      setSeason(null)
      setEpisodes([])
    } else {
      setTitle(null)
      setSeasons([])
    }
  }

  const router = useRouter()

  // A room for this stream, with the next few streams as backups.
  function watchTogether(s: Stream, list: Stream[]) {
    router.push(roomHref(newRoomId(), {
      title: label,
      poster: title?.poster ?? null,
      src: s.url,
      fallbacks: list.filter(o => o.url !== s.url).slice(0, 5).map(o => o.url),
    }))
  }

  async function copy(s: Stream) {
    try {
      await navigator.clipboard.writeText(s.url)
      setCopied(s.url)
      setTimeout(() => setCopied(c => (c === s.url ? null : c)), 1500)
    } catch {
      window.prompt('Copy this link:', s.url)
    }
  }

  const label = title
    ? kind === 'tv' && season && episode
      ? `${title.name} · S${pad(season.number)}E${pad(episode.number)}`
      : title.name
    : ''

  // ── Search ────────────────────────────────────────────────────────────────
  if (!title) {
    return (
      <div className="stack">
        <div className="toggle">
          {(['movie', 'tv'] as const).map(k => (
            <button key={k} type="button" className={kind === k ? 'on' : ''}
              onClick={() => { setKind(k); setResults([]) }}>
              {k === 'movie' ? 'Movies' : 'TV shows'}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} className="row">
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} autoFocus
            placeholder={kind === 'movie' ? 'Search movies…' : 'Search TV shows…'} />
          <button type="submit" className="primary" disabled={loading}>Search</button>
        </form>
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted mono">Scanning the airwaves…</p>}
        <div className="grid">
          {results.map(t => (
            <button key={t.id} type="button" className="poster" onClick={() => pickTitle(t)}>
              {t.poster
                ? <img src={`${IMG}/w342${t.poster}`} alt="" loading="lazy" />
                : <span className="noposter">{t.name}</span>}
              <span className="name">{t.name}</span>
              <span className="muted">{t.year}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const heading = (
    <div className="heading">
      {title.poster && <img src={`${IMG}/w92${title.poster}`} alt="" />}
      <div>
        <p className="name">{label}</p>
        <p className="muted">{title.year}</p>
      </div>
    </div>
  )

  // ── Streams ───────────────────────────────────────────────────────────────
  if (streams !== null || kind === 'movie') {
    const list = (streams ?? []).filter(s => !safeOnly || browserSafe(s))
    return (
      <div className="stack">
        <button type="button" className="link back" onClick={back}>‹ Back</button>
        {heading}
        {playing && (
          <div className="player">
            <video key={playing.url} src={playing.url} controls autoPlay playsInline />
            <p className="muted small">{playing.title}</p>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted mono">Tuning in to cached streams…</p>}
        {streams && streams.length > 0 && (
          <button type="button" className={`chip ${safeOnly ? 'on' : ''}`} onClick={() => setSafeOnly(v => !v)}>
            {safeOnly ? 'Browser-safe only (MP4, AAC)' : 'Showing every format'}
          </button>
        )}
        {streams && streams.length === 0 && !error && <p className="muted">No cached streams found.</p>}
        {streams && streams.length > 0 && list.length === 0 && (
          <p className="muted">No browser-safe streams. Turn the filter off to see all {streams.length}.</p>
        )}
        <div className="stack tight">
          {list.map(s => (
            <div key={s.url} className="stream">
              <div className="info">
                <p>
                  <strong>{s.quality}</strong>
                  {ext(s) && <span className={`tag ${ext(s) === 'mp4' ? 'good' : 'bad'}`}>{ext(s)}</span>}
                  <span className="tag">{s.service}</span>
                </p>
                <p className="muted small truncate">{s.title}{s.size ? ` · ${formatSize(s.size)}` : ''}</p>
              </div>
              <div className="actions">
                <button type="button" className="together" onClick={() => watchTogether(s, list)}>Watch together</button>
                <button type="button" onClick={() => setPlaying(s)}>Play</button>
                <button type="button" onClick={() => copy(s)}>{copied === s.url ? 'Copied' : 'Copy link'}</button>
                <a href={s.url} target="_blank" rel="noreferrer">Open</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Episodes ──────────────────────────────────────────────────────────────
  if (season) {
    return (
      <div className="stack">
        <button type="button" className="link back" onClick={back}>‹ {title.name}</button>
        <p className="name">{season.name}</p>
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted mono">Loading…</p>}
        <div className="stack tight">
          {episodes.map(ep => (
            <button key={ep.number} type="button" className="item" onClick={() => pickEpisode(ep)}>
              <span className="muted mono">E{pad(ep.number)}</span> {ep.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Seasons ───────────────────────────────────────────────────────────────
  return (
    <div className="stack">
      <button type="button" className="link back" onClick={back}>‹ Back</button>
      {heading}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted mono">Loading…</p>}
      <div className="stack tight">
        {seasons.map(s => (
          <button key={s.number} type="button" className="item spread" onClick={() => pickSeason(s)}>
            <span>{s.name}</span>
            <span className="muted">{s.episodes} eps</span>
          </button>
        ))}
      </div>
    </div>
  )
}
