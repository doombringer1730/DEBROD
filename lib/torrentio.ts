import type { Service, StreamSource } from '@/app/actions'

// Runs in the browser (see getStreamSources for why).

export type Stream = {
  service: Service
  quality: string
  title: string
  url: string
  filename: string
  size: number | null
}

type Raw = {
  name?: string
  title?: string
  url?: string
  behaviorHints?: { filename?: string; videoSize?: number }
}

async function fetchSource({ service, url }: StreamSource): Promise<Stream[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) throw new Error(`${service}: Torrentio answered ${res.status}`)
  const data = (await res.json()) as { streams?: Raw[] }
  return (data.streams ?? [])
    .filter(s => s.url?.startsWith('https://'))
    .map(s => {
      const lines = (s.name ?? '').split('\n')
      return {
        service,
        quality: lines[1] ?? lines[0] ?? 'Stream',
        title: (s.title ?? '').split('\n')[0],
        url: s.url!,
        filename: s.behaviorHints?.filename ?? '',
        size: s.behaviorHints?.videoSize ?? null,
      }
    })
}

// Every source at once; one failing is fine as long as another answers.
export async function fetchStreams(sources: StreamSource[]): Promise<Stream[]> {
  const settled = await Promise.allSettled(sources.map(fetchSource))
  const streams = settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  const failures = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (!streams.length && failures.length) {
    throw new Error(failures.map(f => (f.reason instanceof Error ? f.reason.message : 'Torrentio failed')).join(' · '))
  }
  return streams
}
