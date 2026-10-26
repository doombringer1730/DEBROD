// Retro games: EmulatorJS in the browser, playing either a file you pick or
// one from your own library (GAMES_LIBRARY_URL). The library's key stays on
// the server; the browser fetches files through /api/games/file/….

// Pinned so an EmulatorJS release can't change the player under you.
export const EMULATORJS = 'https://cdn.emulatorjs.org/4.2.3/data/'

export type System = { id: string; name: string; exts: string[] }

// EmulatorJS core names. PSP and DOS are left out: their cores need
// SharedArrayBuffer, which needs cross-origin isolation this site doesn't have.
export const SYSTEMS: System[] = [
  { id: 'nes', name: 'NES', exts: ['nes', 'fds', 'unf', 'unif'] },
  { id: 'snes', name: 'SNES', exts: ['sfc', 'smc', 'fig', 'swc'] },
  { id: 'n64', name: 'Nintendo 64', exts: ['n64', 'z64', 'v64'] },
  { id: 'gb', name: 'Game Boy / Color', exts: ['gb', 'gbc', 'dmg'] },
  { id: 'gba', name: 'Game Boy Advance', exts: ['gba'] },
  { id: 'nds', name: 'Nintendo DS', exts: ['nds'] },
  { id: 'vb', name: 'Virtual Boy', exts: ['vb', 'vboy'] },
  { id: 'segaMS', name: 'Master System', exts: ['sms'] },
  { id: 'segaMD', name: 'Genesis / Mega Drive', exts: ['md', 'gen', 'smd'] },
  { id: 'segaGG', name: 'Game Gear', exts: ['gg'] },
  { id: 'segaCD', name: 'Sega CD', exts: [] },
  { id: 'sega32x', name: '32X', exts: ['32x'] },
  { id: 'segaSaturn', name: 'Saturn', exts: [] },
  { id: 'psx', name: 'PlayStation', exts: ['pbp'] },
  { id: 'pce', name: 'TurboGrafx-16', exts: ['pce'] },
  { id: 'atari2600', name: 'Atari 2600', exts: ['a26'] },
  { id: 'atari7800', name: 'Atari 7800', exts: ['a78'] },
  { id: 'lynx', name: 'Atari Lynx', exts: ['lnx'] },
  { id: 'jaguar', name: 'Atari Jaguar', exts: ['j64', 'jag'] },
  { id: 'ws', name: 'WonderSwan', exts: ['ws', 'wsc'] },
  { id: 'ngp', name: 'Neo Geo Pocket', exts: ['ngp', 'ngc'] },
  { id: 'coleco', name: 'ColecoVision', exts: ['col'] },
  { id: '3do', name: '3DO', exts: [] },
  { id: 'arcade', name: 'Arcade (FBNeo)', exts: [] },
]

export const systemName = (id: string) => SYSTEMS.find(s => s.id === id)?.name ?? id

// A guess from the extension; .zip, .bin, .iso, .cue and .chd could be anything.
export function guessSystem(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return SYSTEMS.find(s => s.exts.includes(ext))?.id ?? null
}

export type Game = { name: string; system: string; file: string; cover: string | null }

// Library paths are relative to GAMES_LIBRARY_URL and never climb out of it.
export function isLibraryPath(p: unknown): p is string {
  return typeof p === 'string' && p.length > 0 && p.length < 512 &&
    !p.startsWith('/') && !p.includes('\\') && !/^[a-z][a-z0-9+.-]*:/i.test(p) &&
    p.split('/').every(seg => seg !== '' && seg !== '.' && seg !== '..')
}

// The address the browser asks for a library file. It ends in the real file
// name because EmulatorJS reads the extension (and save names) off the URL.
export function libraryFileHref(path: string) {
  return '/api/games/file/' + path.split('/').map(encodeURIComponent).join('/')
}

export function parseManifest(data: unknown): Game[] {
  const rows = Array.isArray(data) ? data : (data as { games?: unknown })?.games
  if (!Array.isArray(rows)) throw new Error('games.json should be a list of games.')
  const known = new Set(SYSTEMS.map(s => s.id))
  return rows.flatMap((r): Game[] => {
    if (!r || typeof r !== 'object') return []
    const { name, system, file, cover } = r as Record<string, unknown>
    if (typeof system !== 'string' || !known.has(system) || !isLibraryPath(file)) return []
    return [{
      name: typeof name === 'string' && name.trim() ? name.trim() : file.split('/').pop()!,
      system,
      file,
      cover: isLibraryPath(cover) ? cover : null,
    }]
  })
}
