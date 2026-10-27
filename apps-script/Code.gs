/**
 * @OnlyCurrentDoc
 *
 * DEBROD for Google Docs: Study (with the school homework pilot), chat and
 * the arcade, opened from a DEBROD menu in this doc. The movie and TV
 * streaming is only on the Next.js site, not in this version.
 *
 * Who can use it is whoever can edit the doc, or whoever the web app
 * deployment allows (there's no site password).
 * Keys live in Script Properties, set from DEBROD → Settings.
 */

// Built-in Supabase project for accounts, chat, Study and the games, used when
// Settings leaves those blank. Fill these in to ship a copy that works for
// everyone without setup. The publishable key is meant for browsers, but
// keep a filled-in copy out of public repos anyway.
const DEFAULT_SUPABASE_URL = 'https://zppygyfzbwbusidmqlru.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_2VMZtA9aTYsUv9qvFTDA0Q_qFhIHHAD'
const BUILT_IN = { SUPABASE_URL: DEFAULT_SUPABASE_URL, SUPABASE_ANON_KEY: DEFAULT_SUPABASE_ANON_KEY }

const SECRET_KEYS = ['SUPABASE_ANON_KEY', 'GAMES_LIBRARY_KEY']
const PLAIN_KEYS = ['SUPABASE_URL', 'SITE_NAME', 'GAMES_LIBRARY_URL']

// ── Menu and dialogs ────────────────────────────────────────────────────────

// The doc's UI, or null when there isn't one: run from the Apps Script
// editor, from a trigger, or in a script that isn't attached to a doc.
function docUi_() {
  try { return DocumentApp.getUi() } catch (e) { return null }
}

// The menu doesn't read settings: onOpen runs with limited access, and a
// storage read there can fail before anything is authorized. Google runs
// it when the doc opens; run from the editor there's no menu to add to.
function onOpen() {
  const ui = docUi_()
  if (!ui) {
    console.log('onOpen only adds the DEBROD menu when the Google Doc opens. To try it, reload the doc. To approve permissions, run setup instead.')
    return
  }
  ui.createMenu('DEBROD')
    .addItem('Open', 'openDebrod')
    .addSeparator()
    .addItem('Settings', 'openSettings')
    .addToUi()
}

// Run this once from the editor (pick "setup", then Run): it asks for the
// permissions DEBROD needs and says what to do next.
function setup() {
  PropertiesService.getScriptProperties().getKeys()
  CacheService.getScriptCache().get('setup')
  UrlFetchApp.getRequest(DEFAULT_SUPABASE_URL || 'https://supabase.com')
  const url = appUrl_()
  console.log(docUi_() === null && DocumentApp.getActiveDocument() === null
    ? 'Permissions approved. This script isn\'t attached to a Google Doc, so there\'s no DEBROD menu: deploy it as a web app (Deploy → New deployment → Web app) and open that URL.'
    : `Permissions approved. Reload the Google Doc and use the DEBROD menu.${url ? ` Or open the web app: ${url}` : ''}`)
}

function onInstall() {
  onOpen()
}

function openDebrod() {
  const t = HtmlService.createTemplateFromFile('Index')
  t.scribble = ''
  t.showdown = ''
  t.cards = ''
  t.sea = ''
  t.punch = ''
  t.web = ''
  const html = t.evaluate()
    .setWidth(1200)
    .setHeight(780)
  const ui = docUi_()
  if (!ui) throw new Error('Open DEBROD from the DEBROD menu in the Google Doc, or from the web app, not from the editor.')
  ui.showModalDialog(html, siteName_())
}

function openSettings() {
  const t = HtmlService.createTemplateFromFile('Settings')
  t.web = ''
  const html = t.evaluate()
    .setWidth(460)
    .setHeight(620)
  const ui = docUi_()
  if (!ui) throw new Error('Open Settings from the DEBROD menu in the Google Doc, or open the web app with ?page=settings.')
  ui.showModalDialog(html, `${siteName_()} settings`)
}

// Run as a web app (Deploy → Web app): the same page full screen, with
// ?page=settings for the keys and ?scribble=CODE, ?showdown=CODE, ?cards=CODE, ?sea=CODE and ?punch=CODE
// for Scribble, Pokémon Showdown, Color Clash, Sea Battle and Punchline ones.
function doGet(e) {
  const params = (e && e.parameter) || {}
  const page = params.page === 'settings' ? 'Settings' : 'Index'
  const t = HtmlService.createTemplateFromFile(page)
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

// The settings hold keys (the games library's, say), so only the account
// the script runs as can read or change them. From the doc
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

// ── Games library ───────────────────────────────────────────────────────────

// The arcade's Retro consoles can play from your own folder of games
// (GAMES_LIBRARY_URL, with a games.json at its top). The key is added here,
// on the server, and never goes back to the page.
const GAME_SYSTEMS = ['nes', 'snes', 'n64', 'gb', 'gba', 'nds', 'vb', 'segaMS', 'segaMD', 'segaGG', 'segaCD',
  'sega32x', 'segaSaturn', 'psx', 'pce', 'atari2600', 'atari7800', 'lynx', 'jaguar', 'ws', 'ngp', 'coleco', '3do', 'arcade']
// google.script.run carries the file as base64, so keep it to cartridge sizes.
const MAX_GAME_BYTES = 40 * 1024 * 1024

// Paths are relative to the library and never climb out of it.
function isLibraryPath_(p) {
  return typeof p === 'string' && p.length > 0 && p.length < 512 &&
    p.charAt(0) !== '/' && p.indexOf('\\') === -1 && !/^[a-z][a-z0-9+.-]*:/i.test(p) &&
    p.split('/').every(seg => seg !== '' && seg !== '.' && seg !== '..')
}

function fetchLibrary_(path) {
  let base = prop_('GAMES_LIBRARY_URL')
  if (!base) throw new Error('Set a games library URL in DEBROD → Settings.')
  if (!/^https?:[/][/]/i.test(base)) throw new Error('The games library URL must start with https://.')
  if (!/[/]$/.test(base)) base += '/'
  if (!isLibraryPath_(path)) throw new Error('Bad library path.')
  const key = prop_('GAMES_LIBRARY_KEY')
  // Sent both ways so it works with a plain bearer-token server and with
  // Supabase Storage, which wants apikey as well.
  const headers = key ? { Authorization: `Bearer ${key}`, apikey: key } : {}
  const url = base + path.split('/').map(encodeURIComponent).join('/')
  const res = UrlFetchApp.fetch(url, { headers, muteHttpExceptions: true, followRedirects: true })
  if (res.getResponseCode() >= 400) throw new Error(`The games library answered ${res.getResponseCode()} for ${path}.`)
  return res
}

// The library's games, or null when there's no library set up.
function listGames(token) {
  requireMember_(token)
  if (!prop_('GAMES_LIBRARY_URL')) return null
  let data
  try { data = JSON.parse(fetchLibrary_('games.json').getContentText()) } catch (e) {
    throw new Error(/answered|URL|Settings/.test(e.message) ? e.message : 'games.json is not valid JSON.')
  }
  const rows = Array.isArray(data) ? data : data && data.games
  if (!Array.isArray(rows)) throw new Error('games.json should be a list of games.')
  const out = []
  for (const r of rows) {
    if (!r || typeof r !== 'object' || GAME_SYSTEMS.indexOf(r.system) === -1 || !isLibraryPath_(r.file)) continue
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 120) : r.file.split('/').pop()
    out.push({ name, system: r.system, file: r.file })
  }
  return out
}

// One game file, as base64, for the emulator to unpack in the browser.
function getGameFile(token, path) {
  requireMember_(token)
  const bytes = fetchLibrary_(path).getContent()
  if (bytes.length > MAX_GAME_BYTES) throw new Error('That file is too big to send through Apps Script (40 MB at most).')
  return { name: String(path).split('/').pop(), data: Utilities.base64Encode(bytes) }
}
