// DEBROD for Google Apps Script: the same app as the Next.js version, served
// as an Apps Script web app. Settings live in Script Properties (Project
// Settings → Script properties) under the same names as the Next.js
// environment variables.
//
// Apps Script web apps can't set cookies, so signing in returns a token (an
// HMAC of SITE_PASSWORD) that the page keeps and sends with every call.
// Changing the password still signs everyone out.

const TMDB = 'https://api.themoviedb.org/3'

function settings_() {
  const p = PropertiesService.getScriptProperties().getProperties()
  const v = name => (p[name] || '').trim()
  return {
    password: p.SITE_PASSWORD || '',
    tmdbKey: v('TMDB_API_KEY'),
    realDebrid: v('REALDEBRID_API_KEY'),
    torBox: v('TORBOX_API_KEY'),
    supabaseUrl: v('SUPABASE_URL'),
    supabaseKey: v('SUPABASE_ANON_KEY'),
    siteName: v('SITE_NAME') || 'DEBROD',
    torrentio: (v('TORRENTIO_URL') || 'https://torrentio.strem.fun').replace(/\/+$/, ''),
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

function doGet(e) {
  const s = settings_()
  if (!s.password) return ContentService.createTextOutput('Set SITE_PASSWORD in Script properties to use this site.')
  const page = HtmlService.createTemplateFromFile('Index')
  page.siteName = s.siteName
  page.boot = json_({ siteName: s.siteName, appUrl: ScriptApp.getService().getUrl(), params: e.parameters || {} })
  return page.evaluate()
    .setTitle(s.siteName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent()
}

// JSON that is safe to print inside a <script> tag.
function json_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// ── Session ──────────────────────────────────────────────────────────────────

function sessionToken_(password) {
  if (!password) return ''
  return Utilities.computeHmacSha256Signature('debrid-search session', password)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('')
}

function safeEqual_(a, b) {
  a = String(a)
  b = String(b)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isValidSession_(token) {
  const expected = sessionToken_(settings_().password)
  return !!expected && !!token && safeEqual_(token, expected)
}

class SignedOut extends Error {}

// Every call the page makes goes through here: check the token, then run.
function run_(token, fn) {
  try {
    if (!isValidSession_(token)) throw new SignedOut('Signed out. Sign in again.')
    return { ok: true, data: fn(settings_()) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.', signedOut: e instanceof SignedOut }
  }
}

function login(password) {
  const expected = settings_().password
  if (!expected || !safeEqual_(String(password || ''), expected)) {
    Utilities.sleep(1000) // slows down guessing
    return { ok: false, error: 'Wrong password.' }
  }
  return { ok: true, data: sessionToken_(expected) }
}

function checkSession(token) {
  return isValidSession_(token)
}

// The clock the watch-together sync measures itself against.
function serverTime() {
  return Date.now()
}

// ── TMDB ─────────────────────────────────────────────────────────────────────

function tmdb_(s, path, params) {
  if (!s.tmdbKey) throw new Error('TMDB_API_KEY is not set.')
  const qs = Object.entries(Object.assign({}, params, { api_key: s.tmdbKey }))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  const res = UrlFetchApp.fetch(`${TMDB}/${path}?${qs}`, { muteHttpExceptions: true })
  let data = {}
  try { data = JSON.parse(res.getContentText()) } catch (e) { /* not JSON */ }
  const code = res.getResponseCode()
  if (code < 200 || code >= 300) throw new Error(data.status_message || `TMDB error ${code}`)
  return data
}

function searchTitles(token, kind, query) {
  return run_(token, s => {
    const q = String(query || '').trim()
    if (!q) return []
    const data = tmdb_(s, `search/${kind === 'tv' ? 'tv' : 'movie'}`, { query: q, include_adult: 'false' })
    return (data.results || []).map(r => ({
      id: r.id,
      name: r.title || r.name || 'Untitled',
      year: (r.release_date || r.first_air_date || '').slice(0, 4),
      poster: r.poster_path || null,
    }))
  })
}

function getSeasons(token, showId) {
  return run_(token, s => {
    const data = tmdb_(s, `tv/${Number(showId)}`)
    return (data.seasons || [])
      .filter(x => x.season_number > 0)
      .map(x => ({ number: x.season_number, name: x.name, episodes: x.episode_count }))
  })
}

function getEpisodes(token, showId, season) {
  return run_(token, s => {
    const data = tmdb_(s, `tv/${Number(showId)}/season/${Number(season)}`)
    return (data.episodes || []).map(e => ({ number: e.episode_number, name: e.name }))
  })
}

// ── Torrentio ────────────────────────────────────────────────────────────────

// Torrentio sits behind Cloudflare, which blocks many server IPs, so the
// browser fetches the streams itself. This only hands a signed-in browser
// the URLs to ask (which carry the debrid keys, as its stream links do).
function getStreamSources(token, kind, tmdbId, season, episode) {
  return run_(token, s => {
    if (!s.realDebrid && !s.torBox) throw new Error('Set REALDEBRID_API_KEY or TORBOX_API_KEY.')
    const movie = kind === 'movie'
    const ext = tmdb_(s, `${movie ? 'movie' : 'tv'}/${Number(tmdbId)}/external_ids`)
    if (!ext.imdb_id) throw new Error('No IMDb id for this title.')
    const path = movie
      ? `stream/movie/${ext.imdb_id}.json`
      : `stream/series/${ext.imdb_id}:${Number(season)}:${Number(episode)}.json`

    const sources = []
    if (s.realDebrid) sources.push({ service: 'Real-Debrid', url: `${s.torrentio}/realdebrid=${encodeURIComponent(s.realDebrid)}/${path}` })
    if (s.torBox) sources.push({ service: 'TorBox', url: `${s.torrentio}/torbox=${encodeURIComponent(s.torBox)}/${path}` })
    return sources
  })
}

// Fallback for when the browser can't reach Torrentio itself. Only the
// configured Torrentio instance, so this never becomes an open proxy.
function fetchTorrentio(token, url) {
  return run_(token, s => {
    if (typeof url !== 'string' || !url.startsWith(`${s.torrentio}/`)) throw new Error('Not a Torrentio link.')
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true })
    const code = res.getResponseCode()
    if (code < 200 || code >= 300) throw new Error(`Torrentio answered ${code}`)
    return res.getContentText()
  })
}

// ── Watch together ───────────────────────────────────────────────────────────

// The Supabase keys only reach browsers that are signed in.
function getRoomConfig(token) {
  return run_(token, s => {
    if (!s.supabaseUrl || !s.supabaseKey) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY to watch together.')
    return { url: s.supabaseUrl, key: s.supabaseKey }
  })
}
