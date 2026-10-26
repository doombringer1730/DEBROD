'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { listGames } from '../actions'
import {
  EMULATORJS, SYSTEMS, guessSystem, libraryFileHref, systemName, type Game,
} from '@/lib/games'

type Playing = { name: string; system: string; url: string; gameName: string }

// Safe inside a <script>: JSON, with < escaped so a name can't close the tag.
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

// EmulatorJS works through page globals, so each game gets a fresh document.
// srcdoc keeps it on this origin: it can read blob: URLs and send the session
// cookie to /api/games/file.
function emulatorDoc({ system, url, gameName }: Playing) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#000}#game{width:100%;height:100%}
</style></head><body><div id="game"></div><script>
EJS_player = '#game'
EJS_core = ${js(system)}
EJS_gameUrl = ${js(url)}
EJS_gameName = ${js(gameName)}
EJS_pathtodata = ${js(EMULATORJS)}
EJS_color = '#ff2bd6'
</script><script src="${EMULATORJS}loader.js"></script></body></html>`
}

export default function Games() {
  const [library, setLibrary] = useState<Game[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [system, setSystem] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileSystem, setFileSystem] = useState('')
  const [playing, setPlaying] = useState<Playing | null>(null)

  useEffect(() => {
    listGames().then(res => {
      setLoading(false)
      if (res.ok) setLibrary(res.data)
      else setError(res.error)
    })
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (library ?? [])
      .filter(g => (!system || g.system === system) && (!q || g.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [library, query, system])

  const systemsInLibrary = useMemo(
    () => SYSTEMS.filter(s => library?.some(g => g.system === s.id)),
    [library],
  )

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setFileSystem(f ? guessSystem(f.name) ?? '' : '')
  }

  function playFile() {
    if (!file || !fileSystem) return
    // EmulatorJS revokes the blob URL once it has read it.
    setPlaying({ name: file.name, system: fileSystem, url: URL.createObjectURL(file), gameName: file.name })
  }

  function playGame(g: Game) {
    setPlaying({ name: g.name, system: g.system, url: libraryFileHref(g.file), gameName: g.name })
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  if (playing) {
    return (
      <div className="stack">
        <button type="button" className="link back" onClick={() => setPlaying(null)}>‹ Back to games</button>
        <div className="heading">
          <div>
            <p className="name">{playing.name}</p>
            <p className="muted">{systemName(playing.system)}</p>
          </div>
        </div>
        <iframe
          key={playing.url}
          className="emulator"
          title={playing.name}
          srcDoc={emulatorDoc(playing)}
          allow="fullscreen; gamepad; autoplay"
          allowFullScreen
        />
        <p className="muted small">
          Saves and states stay in this browser. Keys, gamepads and fullscreen are in the player&apos;s menu.
        </p>
      </div>
    )
  }

  // ── Library + local file ──────────────────────────────────────────────────
  return (
    <div className="stack">
      <div className="panel stack tight">
        <p className="name">Play a file</p>
        <p className="muted small">A game you own, from this device. It never leaves your browser.</p>
        <div className="row wrap">
          <input type="file" onChange={pickFile} className="grow" />
          <select value={fileSystem} onChange={e => setFileSystem(e.target.value)} aria-label="System">
            <option value="">System…</option>
            {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className="primary" disabled={!file || !fileSystem} onClick={playFile}>Play</button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted mono">Loading cartridges…</p>}
      {!loading && library === null && !error && (
        <p className="muted small">
          Set GAMES_LIBRARY_URL (and GAMES_LIBRARY_KEY if it&apos;s private) to browse your own library here.
        </p>
      )}

      {library && (
        <>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${library.length} games…`} />
          {systemsInLibrary.length > 1 && (
            <div className="row wrap">
              <button type="button" className={`chip ${system === null ? 'on' : ''}`} onClick={() => setSystem(null)}>All</button>
              {systemsInLibrary.map(s => (
                <button key={s.id} type="button" className={`chip ${system === s.id ? 'on' : ''}`}
                  onClick={() => setSystem(system === s.id ? null : s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {shown.length === 0 && <p className="muted">No games match.</p>}
          <div className="grid">
            {shown.map(g => (
              <button key={g.file} type="button" className="poster" onClick={() => playGame(g)}>
                {g.cover
                  ? <img src={libraryFileHref(g.cover)} alt="" loading="lazy" className="cover" />
                  : <span className="noposter cover">{g.name}</span>}
                <span className="name">{g.name}</span>
                <span className="muted">{systemName(g.system)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
