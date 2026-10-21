/**
 * @OnlyCurrentDoc
 *
 * DEBROD for Google Docs: the same movie and TV search, player and watch
 * together as the Next.js site, opened from a DEBROD menu in this doc.
 *
 * Who can use it is whoever can edit the doc, or whoever the web app
 * deployment allows (there's no site password).
 * Keys live in Script Properties, set from DEBROD → Settings.
 */

const TMDB = 'https://api.themoviedb.org/3'
const YOUTUBE = 'https://www.googleapis.com/youtube/v3'
const DEFAULT_TORRENTIO = 'https://torrentio.strem.fun'
const ROOM_TTL_SECONDS = 6 * 60 * 60 // CacheService's maximum

// Built-in Supabase project for watch together and Scribble, used when
// Settings leaves those blank. Fill these in to ship a copy that works for
// everyone without setup. The publishable key is meant for browsers, but
// keep a filled-in copy out of public repos anyway.
const DEFAULT_SUPABASE_URL = 'https://zppygyfzbwbusidmqlru.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_2VMZtA9aTYsUv9qvFTDA0Q_qFhIHHAD'
// Built-in YouTube Data API key for Search, used when Settings leaves it
// blank, so members never need their own. It stays on the server (the page
// only learns whether there is one), but unlike the Supabase key it's a real
// secret: fill it in only in your Apps Script copy, never in a public repo.
const DEFAULT_YOUTUBE_API_KEY = ''
const BUILT_IN = { SUPABASE_URL: DEFAULT_SUPABASE_URL, SUPABASE_ANON_KEY: DEFAULT_SUPABASE_ANON_KEY, YOUTUBE_API_KEY: DEFAULT_YOUTUBE_API_KEY }

const SECRET_KEYS = ['TMDB_API_KEY', 'REALDEBRID_API_KEY', 'TORBOX_API_KEY', 'YOUTUBE_API_KEY', 'SUPABASE_ANON_KEY']
const PLAIN_KEYS = ['SUPABASE_URL', 'TORRENTIO_URL', 'SITE_NAME']

// ── Menu and dialogs ────────────────────────────────────────────────────────

// The menu doesn't read settings: onOpen runs with limited access, and a
// storage read there can fail before anything is authorized.
function onOpen() {
  DocumentApp.getUi()
    .createMenu('DEBROD')
    .addItem('Open', 'openDebrod')
    .addSeparator()
    .addItem('Settings', 'openSettings')
    .addToUi()
}

function onInstall() {
  onOpen()
}

function openDebrod() {
  const t = HtmlService.createTemplateFromFile('Index')
  t.room = ''
  t.scribble = ''
  t.showdown = ''
  t.cards = ''
  t.sea = ''
  t.punch = ''
  t.web = ''
  const html = t.evaluate()
    .setWidth(1200)
    .setHeight(780)
  DocumentApp.getUi().showModalDialog(html, siteName_())
}

function openSettings() {
  const t = HtmlService.createTemplateFromFile('Settings')
  t.web = ''
  const html = t.evaluate()
    .setWidth(460)
    .setHeight(620)
  DocumentApp.getUi().showModalDialog(html, `${siteName_()} settings`)
}

// Run as a web app (Deploy → Web app): the same page full screen, with
// ?page=settings for the keys, ?room=CODE for a watch-together invite and
// ?scribble=CODE, ?showdown=CODE, ?cards=CODE, ?sea=CODE and ?punch=CODE
// for Scribble, Pokémon Showdown, Color Clash, Sea Battle and Punchline ones.
function doGet(e) {
  const params = (e && e.parameter) || {}
  const page = params.page === 'settings' ? 'Settings' : 'Index'
  const t = HtmlService.createTemplateFromFile(page)
  t.room = String(params.room || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 32)
  t.scribble = String(params.scribble || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  t.showdown = String(params.showdown || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  t.cards = String(params.cards || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  t.sea = String(params.sea || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  t.punch = String(params.punch || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  t.web = 'web'
  return t.evaluate()
    .setTitle(page === 'Settings' ? `${siteName_()} settings` : siteName_())
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}

function appUrl_() {
  try { return ScriptApp.getService().getUrl() || '' } catch (e) { return '' }
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent()
}

// ── Settings ────────────────────────────────────────────────────────────────

function prop_(key) {
  return (PropertiesService.getScriptProperties().getProperty(key) || '').trim()
}

function siteName_() {
  return prop_('SITE_NAME') || 'DEBROD'
}

// The settings decide where the debrid keys get sent (TORRENTIO_URL), so
// only the account the script runs as can read or change them. From the doc
// menu that's whoever opened it; in a web app run as you, it's only you.
function requireOwner_() {
  const owner = Session.getEffectiveUser().getEmail()
  if (!owner || Session.getActiveUser().getEmail() !== owner) {
    throw new Error('Only the owner can change these settings.')
  }
}

// Secrets never go back to the page; it only learns whether each is set.
function getSettings() {
  requireOwner_()
  const out = {}
  for (const k of SECRET_KEYS) out[k] = { set: !!prop_(k), builtIn: !!BUILT_IN[k] }
  for (const k of PLAIN_KEYS) out[k] = { set: !!prop_(k), value: prop_(k), builtIn: !!BUILT_IN[k] }
  return out
}

// A blank secret keeps the stored one; `clear` lists keys to remove.
function saveSettings(values, clear) {
  requireOwner_()
  const props = PropertiesService.getScriptProperties()
  for (const k of SECRET_KEYS.concat(PLAIN_KEYS)) {
    const v = String((values || {})[k] || '').trim()
    if ((clear || []).indexOf(k) !== -1) props.deleteProperty(k)
    else if (v) props.setProperty(k, v)
    else if (PLAIN_KEYS.indexOf(k) !== -1) props.deleteProperty(k)
  }
  return getSettings()
}

// What the page needs to run. The Supabase anon key is meant for browsers.
function getConfig() {
  return {
    siteName: siteName_(),
    hasTmdb: !!prop_('TMDB_API_KEY'),
    hasDebrid: !!(prop_('REALDEBRID_API_KEY') || prop_('TORBOX_API_KEY')),
    hasYoutube: !!(prop_('YOUTUBE_API_KEY') || DEFAULT_YOUTUBE_API_KEY),
    supabaseUrl: prop_('SUPABASE_URL') || DEFAULT_SUPABASE_URL,
    supabaseKey: prop_('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY,
    appUrl: appUrl_(),
  }
}

// ── Members ─────────────────────────────────────────────────────────────────

// Everything past the sign-in screen sends the caller's Supabase session,
// and only an approved member's gets an answer, so a copied web app link
// alone gets nobody in. A yes is remembered for five minutes per session.
function requireMember_(token) {
  const t = String(token || '')
  if (!t) throw new Error('Sign in first.')
  const cache = CacheService.getScriptCache()
  const key = 'member:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t))
  if (cache.get(key)) return
  const url = (prop_('SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, '')
  const anon = prop_('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase is not set up. Open DEBROD → Settings.')
  const res = UrlFetchApp.fetch(`${url}/rest/v1/rpc/debrod_approved`, {
    method: 'post', contentType: 'application/json', payload: '{}',
    headers: { apikey: anon, Authorization: `Bearer ${t}` }, muteHttpExceptions: true,
  })
  const code = res.getResponseCode()
  if (code === 401) throw new Error('Your session ran out. Sign in again.')
  if (code >= 400) throw new Error(`Could not check your account (Supabase answered ${code}).`)
  if (res.getContentText().trim() !== 'true') throw new Error('Your account is waiting for Huddy to approve it.')
  cache.put(key, '1', 300)
}

// ── TMDB ────────────────────────────────────────────────────────────────────

function tmdb_(path, params) {
  const key = prop_('TMDB_API_KEY')
  if (!key) throw new Error('TMDB_API_KEY is not set. Open DEBROD → Settings.')
  const all = Object.assign({}, params || {}, { api_key: key })
  const qs = Object.keys(all).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(all[k])}`).join('&')
  const res = UrlFetchApp.fetch(`${TMDB}/${path}?${qs}`, { muteHttpExceptions: true })
  let data = {}
  try { data = JSON.parse(res.getContentText()) } catch (e) { /* not JSON */ }
  if (res.getResponseCode() >= 400) throw new Error(data.status_message || `TMDB error ${res.getResponseCode()}`)
  return data
}

function kind_(kind) {
  if (kind !== 'movie' && kind !== 'tv') throw new Error('Unknown kind.')
  return kind
}

function searchTitles(token, kind, query) {
  requireMember_(token)
  const q = String(query || '').trim()
  if (!q) return []
  const data = tmdb_(`search/${kind_(kind)}`, { query: q, include_adult: 'false' })
  return (data.results || []).map(r => ({
    id: r.id,
    name: r.title || r.name || 'Untitled',
    year: (r.release_date || r.first_air_date || '').slice(0, 4),
    poster: r.poster_path || null,
  }))
}

function getSeasons(token, showId) {
  requireMember_(token)
  const data = tmdb_(`tv/${Number(showId)}`)
  return (data.seasons || [])
    .filter(s => s.season_number > 0)
    .map(s => ({ number: s.season_number, name: s.name, episodes: s.episode_count }))
}

function getEpisodes(token, showId, season) {
  requireMember_(token)
  const data = tmdb_(`tv/${Number(showId)}/season/${Number(season)}`)
  return (data.episodes || []).map(e => ({ number: e.episode_number, name: e.name }))
}

// ── YouTube ─────────────────────────────────────────────────────────────────

// The Data API sends titles HTML-escaped; the page sets them as text.
function unescape_(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

// Embeddable videos only, since they play inside DEBROD. Each search costs
// 100 of the key's 10,000 daily quota units.
function searchYouTube(token, query) {
  requireMember_(token)
  const q = String(query || '').trim()
  if (!q) return []
  const key = prop_('YOUTUBE_API_KEY') || DEFAULT_YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY is not set. Open DEBROD → Settings.')
  const params = { part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: 24, safeSearch: 'moderate', q, key }
  const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&')
  const res = UrlFetchApp.fetch(`${YOUTUBE}/search?${qs}`, { muteHttpExceptions: true })
  let data = {}
  try { data = JSON.parse(res.getContentText()) } catch (e) { /* not JSON */ }
  if (res.getResponseCode() >= 400) {
    throw new Error((data.error && data.error.message) || `YouTube error ${res.getResponseCode()}`)
  }
  return (data.items || []).filter(r => r.id && r.id.videoId).map(r => {
    const sn = r.snippet || {}
    const th = sn.thumbnails || {}
    return {
      id: r.id.videoId,
      name: unescape_(sn.title) || 'Untitled',
      channel: unescape_(sn.channelTitle),
      year: (sn.publishedAt || '').slice(0, 4),
      thumb: (th.high || th.medium || th.default || {}).url || null,
    }
  })
}

// Torrentio sits behind Cloudflare, which blocks many server IPs (Google's
// included), so the page fetches the streams itself. This only hands it the
// URLs to ask.
function getStreamSources(token, kind, tmdbId, season, episode) {
  requireMember_(token)
  const rd = prop_('REALDEBRID_API_KEY')
  const tb = prop_('TORBOX_API_KEY')
  if (!rd && !tb) throw new Error('Set a Real-Debrid or TorBox key in DEBROD → Settings.')

  const ext = tmdb_(`${kind_(kind)}/${Number(tmdbId)}/external_ids`)
  if (!ext.imdb_id) throw new Error('No IMDb id for this title.')
  const path = kind === 'movie'
    ? `stream/movie/${ext.imdb_id}.json`
    : `stream/series/${ext.imdb_id}:${Number(season)}:${Number(episode)}.json`

  const torrentio = (prop_('TORRENTIO_URL') || DEFAULT_TORRENTIO).replace(/\/+$/, '')
  const sources = []
  if (rd) sources.push({ service: 'Real-Debrid', url: `${torrentio}/realdebrid=${encodeURIComponent(rd)}/${path}` })
  if (tb) sources.push({ service: 'TorBox', url: `${torrentio}/torbox=${encodeURIComponent(tb)}/${path}` })
  return sources
}

// ── Watch together ──────────────────────────────────────────────────────────

// The site put what's playing in the invite link. Here the room is kept in
// the cache for six hours under a short code: friends type it into DEBROD in
// the doc, or open the web app link with ?room=CODE.

const isHttps_ = u => typeof u === 'string' && u.indexOf('https://') === 0

const isYoutubeId_ = id => typeof id === 'string' && /^[\w-]{11}$/.test(id)

function createRoom(token, source) {
  requireMember_(token)
  if (source && isYoutubeId_(source.youtube)) {
    return putRoom_({ title: String(source.title || 'Watching together').slice(0, 200), poster: null, youtube: source.youtube, src: '', fallbacks: [] })
  }
  if (!source || !isHttps_(source.src)) throw new Error('That stream link is not usable.')
  return putRoom_({
    title: String(source.title || 'Watching together').slice(0, 200),
    poster: source.poster && /^\/[\w./-]+$/.test(source.poster) ? source.poster : null,
    src: source.src,
    fallbacks: (source.fallbacks || []).filter(isHttps_).slice(0, 5),
  })
}

function putRoom_(clean) {
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase()
  CacheService.getScriptCache().put(`room:${id}`, JSON.stringify(clean), ROOM_TTL_SECONDS)
  return id
}

function getRoom(token, id) {
  requireMember_(token)
  const code = String(id || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6,32}$/.test(code)) throw new Error('That room code looks wrong.')
  const raw = CacheService.getScriptCache().get(`room:${code}`)
  if (!raw) throw new Error('That room has ended or the code is wrong. Rooms last six hours.')
  return { id: code, source: JSON.parse(raw) }
}

// The clock the watch-together sync measures itself against.
function getTime() {
  return Date.now()
}
