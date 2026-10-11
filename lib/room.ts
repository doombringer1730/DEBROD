// A watch-together room is just a link: a random id plus what's playing.
// Nothing is stored; everyone who opens the link joins the same channel.

export type RoomSource = {
  title: string
  poster: string | null
  src: string
  fallbacks: string[]
}

export function newRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 14)
}

export function roomHref(room: string, { title, poster, src, fallbacks }: RoomSource) {
  const q = new URLSearchParams({ t: title, s: src })
  if (poster) q.set('p', poster)
  for (const f of fallbacks) q.append('f', f)
  return `/watch/${room}?${q}`
}

const isHttps = (u: unknown): u is string => typeof u === 'string' && u.startsWith('https://')

export function parseRoom(q: Record<string, string | string[] | undefined>): RoomSource | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const src = one(q.s)
  if (!isHttps(src)) return null
  const f = q.f === undefined ? [] : Array.isArray(q.f) ? q.f : [q.f]
  const poster = one(q.p)
  return {
    title: one(q.t) || 'Watching together',
    poster: poster && /^\/[\w./-]+$/.test(poster) ? poster : null,
    src,
    fallbacks: f.filter(isHttps).slice(0, 5),
  }
}
