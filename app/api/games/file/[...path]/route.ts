import { cookies } from 'next/headers'
import { SESSION_COOKIE, isValidSession } from '@/lib/auth'
import { fetchLibrary } from '@/lib/library'

// Streams a file from your games library, adding the key on the way, so the
// browser never sees GAMES_LIBRARY_KEY.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const store = await cookies()
  if (!isValidSession(store.get(SESSION_COOKIE)?.value)) return new Response('Signed out.', { status: 401 })

  const { path } = await params
  let res: Response
  try {
    res = await fetchLibrary(path.join('/'), { signal: request.signal })
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'Library error.', { status: 400 })
  }
  if (!res.ok || !res.body) return new Response(`Library answered ${res.status}.`, { status: res.status === 404 ? 404 : 502 })

  const headers = new Headers({ 'Cache-Control': 'private, max-age=3600' })
  for (const h of ['content-type', 'content-length', 'last-modified', 'etag']) {
    const v = res.headers.get(h)
    if (v) headers.set(h, v)
  }
  // fetch already decompressed the body, so a compressed length would lie.
  if (res.headers.get('content-encoding')) headers.delete('content-length')
  return new Response(res.body, { headers })
}

export const dynamic = 'force-dynamic'
