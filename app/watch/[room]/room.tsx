'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import type { RoomSource } from '@/lib/room'
import Backdrop from '../../backdrop'

// Watch-together sync: heartbeats plus explicit play/pause/seek actions over
// a Supabase Realtime broadcast channel, with a rolling-median clock offset
// against /api/time so a "playing" position can be projected forward by its
// travel time. Nothing is stored: chat and emotes are broadcast too, and
// vanish on reload.

const EMOTES = ['🍿', '❤️', '😂', '😱', '👏', '💀', '🔥', '🎬']

const HEARTBEAT_MS    = 4000   // broadcast interval
const NTP_INTERVAL_MS = 30000  // re-sync clock every 30s
const NTP_SAMPLES     = 5      // rolling window size
const DRIFT_THRESHOLD = 1.5    // seconds — correct heartbeats above this drift
const DRIFT_ACTION    = 0.8    // seconds — lower threshold for explicit actions
const ALONE_AFTER_MS  = 2000   // nobody answered hello: we lead from here

type SyncPayload = {
  kind: 'heartbeat' | 'action'
  state: 'playing' | 'paused'
  position: number  // video.currentTime when sent
  sentAt: number    // Date.now() - clockOffset, i.e. server time
  src: string       // which link is playing (fallbacks can switch it)
  from: string
}

type ChatMsg = { id: string; from: string; name: string; body?: string; emote?: string }
type FloatingEmote = { id: string; emote: string; x: number }
type Viewer = { id: string; name: string; device: 'phone' | 'tablet' | 'desktop' }

const NAME_KEY = 'ds_name'

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

function detectDevice(): Viewer['device'] {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|phone/i.test(ua)) return 'phone'
  return 'desktop'
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

type Props = { room: string; source: RoomSource; supabaseUrl: string; supabaseKey: string }

export default function Room({ room, source, supabaseUrl, supabaseKey }: Props) {
  const [name, setName] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [nameLoaded, setNameLoaded] = useState(false)

  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem(NAME_KEY) } catch { /* private mode */ }
    if (stored) setName(stored)
    setNameLoaded(true)
  }, [])

  function saveName(e: FormEvent) {
    e.preventDefault()
    const n = nameDraft.trim().slice(0, 24)
    if (!n) return
    try { localStorage.setItem(NAME_KEY, n) } catch { /* private mode */ }
    setName(n)
  }

  if (!nameLoaded) return <main className="room" />
  if (!name) {
    return (
      <>
        <Backdrop />
        <main className="login">
          <form onSubmit={saveName} className="card stack">
            <div>
              <p className="tagline">Now showing</p>
              <h1 className="wordmark">{source.title}</h1>
            </div>
            <label className="field">
              <span>Your call sign</span>
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus maxLength={24} />
            </label>
            <button type="submit" className="primary" disabled={!nameDraft.trim()}>Join</button>
          </form>
        </main>
      </>
    )
  }
  return <Player room={room} source={source} name={name} supabaseUrl={supabaseUrl} supabaseKey={supabaseKey} />
}

function Player({ room, source, name, supabaseUrl, supabaseKey }: Props & { name: string }) {
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseKey), [supabaseUrl, supabaseKey])
  const [clientId] = useState(randomId)
  const urls = useMemo(() => [source.src, ...source.fallbacks.filter(f => f !== source.src)], [source])

  const videoRef = useRef<HTMLVideoElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const applyingRemote = useRef(false)
  // Until we've heard from someone (or found we're alone) our heartbeats stay
  // quiet, so a late joiner at 0:00 doesn't drag everyone back to the start.
  const synced = useRef(false)
  const hasFirstSync = useRef(false)

  const rttSamples = useRef<number[]>([])
  const offsetSamples = useRef<number[]>([])
  const clockOffset = useRef(0)  // localTime - serverTime

  const [currentUrl, setCurrentUrl] = useState(source.src)
  const currentUrlRef = useRef(source.src)
  const [streamError, setStreamError] = useState(false)
  const [connected, setConnected] = useState(false)
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [partner, setPartner] = useState<{ name: string; position: number; playing: boolean } | null>(null)
  const [needsUserPlay, setNeedsUserPlay] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [floating, setFloating] = useState<FloatingEmote[]>([])
  const [chatInput, setChatInput] = useState('')
  const [copied, setCopied] = useState(false)
  const namesRef = useRef<Record<string, string>>({})

  function pushSample(ref: React.RefObject<number[]>, val: number) {
    ref.current.push(val)
    if (ref.current.length > NTP_SAMPLES) ref.current.splice(0, ref.current.length - NTP_SAMPLES)
  }

  // ── Clock sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function syncClock() {
      try {
        const sentAt = Date.now()
        const res = await fetch('/api/time', { cache: 'no-store' })
        const { t } = (await res.json()) as { t: number }
        const now = Date.now()
        pushSample(rttSamples, now - sentAt)
        pushSample(offsetSamples, now - Math.round(median(rttSamples.current) / 2) - t)
        clockOffset.current = median(offsetSamples.current)
      } catch { /* keep the previous estimate */ }
    }
    syncClock()
    const id = setInterval(syncClock, NTP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const sentAt = () => Date.now() - clockOffset.current

  function reconstructPos(p: SyncPayload) {
    if (p.state !== 'playing' || !p.sentAt) return p.position
    return p.position + Math.max(0, sentAt() - p.sentAt) / 1000
  }

  function switchSource(src: string) {
    if (src === currentUrlRef.current) return
    currentUrlRef.current = src
    setCurrentUrl(src)
    setStreamError(false)
  }

  function broadcast(event: string, payload: object) {
    channelRef.current?.send({ type: 'broadcast', event, payload })
  }

  function snapshot(kind: SyncPayload['kind']): SyncPayload | null {
    const video = videoRef.current
    if (!video) return null
    return {
      kind,
      state: video.paused ? 'paused' : 'playing',
      position: video.currentTime,
      sentAt: sentAt(),
      src: currentUrlRef.current,
      from: clientId,
    }
  }

  const pushState = useCallback((state: 'playing' | 'paused', position: number) => {
    if (applyingRemote.current) return
    synced.current = true
    broadcast('sync', { kind: 'action', state, position, sentAt: sentAt(), src: currentUrlRef.current, from: clientId })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // ── Apply a remote payload ────────────────────────────────────────────────
  function applySync(p: SyncPayload) {
    const video = videoRef.current
    if (!video) return
    setPartner({ name: namesRef.current[p.from] ?? 'Someone', position: p.position, playing: p.state === 'playing' })

    if (p.src !== currentUrlRef.current) {
      // Links only ever move forward when one dies. If they're further down
      // the list, follow and line up on the next beat; if we are, they'll
      // follow us.
      if (urls.indexOf(p.src) <= urls.indexOf(currentUrlRef.current)) return
      switchSource(p.src)
      hasFirstSync.current = false
      return
    }

    const expected = reconstructPos(p)
    const drift = Math.abs(video.currentTime - expected)
    const threshold = p.kind === 'action' ? DRIFT_ACTION : DRIFT_THRESHOLD
    if (!hasFirstSync.current || drift > threshold) {
      hasFirstSync.current = true
      applyingRemote.current = true
      video.currentTime = expected
      // onSeeked clears applyingRemote
    }
    synced.current = true

    if (p.state === 'playing' && video.paused) {
      applyingRemote.current = true
      setNeedsUserPlay(false)
      video.play().catch(() => {
        setNeedsUserPlay(true)
        applyingRemote.current = false
      })
      setTimeout(() => { applyingRemote.current = false }, 200)
    } else if (p.state === 'paused' && !video.paused) {
      applyingRemote.current = true
      video.pause()
      setTimeout(() => { applyingRemote.current = false }, 200)
    }
  }

  function showChat(msg: ChatMsg) {
    if (msg.emote) {
      const fe = { id: msg.id, emote: msg.emote, x: 10 + Math.random() * 80 }
      setFloating(prev => [...prev, fe])
      setTimeout(() => setFloating(prev => prev.filter(e => e.id !== fe.id)), 3200)
    } else {
      setMessages(prev => [...prev.slice(-4), msg])
      setTimeout(() => setMessages(prev => prev.filter(m => m.id !== msg.id)), 6000)
    }
  }

  // ── Channel: sync, hello, chat, presence ──────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`ds-watch:${room}`, {
      config: { presence: { key: clientId }, broadcast: { self: false } },
    })
    let aloneTimer: ReturnType<typeof setTimeout> | undefined

    channel
      .on('broadcast', { event: 'sync' }, ({ payload }) => applySync(payload as SyncPayload))
      .on('broadcast', { event: 'hello' }, () => {
        // Someone new: tell them where we are right away.
        if (!synced.current) return
        const p = snapshot('heartbeat')
        if (p) broadcast('sync', p)
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => showChat(payload as ChatMsg))
      .on('presence', { event: 'sync' }, () => {
        const list = Object.values(channel.presenceState<Viewer>()).flat()
        namesRef.current = Object.fromEntries(list.map(v => [v.id, v.name]))
        setViewers(list)
      })
      .subscribe(async status => {
        setConnected(status === 'SUBSCRIBED')
        if (status !== 'SUBSCRIBED') return
        await channel.track({ id: clientId, name, device: detectDevice() })
        channel.send({ type: 'broadcast', event: 'hello', payload: { from: clientId } })
        aloneTimer = setTimeout(() => { synced.current = true }, ALONE_AFTER_MS)
      })

    channelRef.current = channel
    return () => {
      clearTimeout(aloneTimer)
      channelRef.current = null
      channel.untrack()
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, room, clientId, name])

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!synced.current) return
      const p = snapshot('heartbeat')
      if (p) broadcast('sync', p)
    }, HEARTBEAT_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // ── Source ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const at = video.currentTime
    video.src = currentUrl
    if (at) video.currentTime = at
  }, [currentUrl])

  function tryNextStream() {
    const next = urls[urls.indexOf(currentUrlRef.current) + 1]
    if (!next) { setStreamError(true); return }
    switchSource(next)
    // Others follow via the src on our next heartbeat or action.
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  function send(msg: Omit<ChatMsg, 'id' | 'from' | 'name'>) {
    const full: ChatMsg = { id: randomId(), from: clientId, name, ...msg }
    broadcast('chat', full)
    showChat(full)
  }

  function sendMessage(e: FormEvent) {
    e.preventDefault()
    const body = chatInput.trim().slice(0, 300)
    if (!body) return
    setChatInput('')
    send({ body })
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Send this link:', window.location.href)
    }
  }

  const others = viewers.filter(v => v.id !== clientId)

  return (
    <main className="room">
      <header className="room-top">
        <Link href="/" className="link" aria-label="Back to search">‹</Link>
        <p className="name truncate">{source.title}</p>
        <div className="viewers">
          {viewers.map(v => (
            <span key={v.id} className="viewer" title={`${v.name} · ${v.device}`}>
              <span className="dot" /> {v.id === clientId ? 'You' : v.name}
            </span>
          ))}
        </div>
        <button type="button" className="invite" onClick={copyInvite}>{copied ? 'Copied' : 'Invite'}</button>
      </header>

      <div className="stage">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="auto"
          onPlay={e => pushState('playing', e.currentTarget.currentTime)}
          onPause={e => pushState('paused', e.currentTarget.currentTime)}
          onSeeked={e => {
            if (applyingRemote.current) { applyingRemote.current = false; return }
            const v = e.currentTarget
            pushState(v.paused ? 'paused' : 'playing', v.currentTime)
          }}
          onError={tryNextStream}
        />

        {streamError && (
          <div className="overlay">
            <p>None of the links for this one play in the browser.</p>
            <Link href="/">‹ Pick another stream</Link>
          </div>
        )}

        {needsUserPlay && (
          <button type="button" className="overlay tap" onClick={() => { videoRef.current?.play().catch(() => {}); setNeedsUserPlay(false) }}>
            <span className="primary">▶ Tap to play</span>
          </button>
        )}

        {!streamError && currentUrl !== source.src && (
          <p className="pill fallback">That link died, trying backup {urls.indexOf(currentUrl)}/{urls.length - 1}…</p>
        )}

        {floating.map(fe => (
          <span key={fe.id} className="emote-float" style={{ left: `${fe.x}%` }}>{fe.emote}</span>
        ))}

        <div className="chat-overlay">
          {messages.map(m => (
            <p key={m.id} className="chat-line"><strong>{m.from === clientId ? 'You' : m.name}</strong> {m.body}</p>
          ))}
        </div>

        <div className="sync-status">
          <span className="pill"><span className={`dot ${connected ? '' : 'wait'}`} />{connected ? (others.length ? 'Synced' : 'Waiting for others') : 'Connecting…'}</span>
          {partner && others.length > 0 && (
            <span className="pill">{partner.name} <span className="mono">{formatTime(partner.position)}</span> {partner.playing ? '▶' : '⏸'}</span>
          )}
        </div>
      </div>

      <footer className="room-bottom">
        <div className="emotes">
          {EMOTES.map(emote => (
            <button key={emote} type="button" onClick={() => send({ emote })}>{emote}</button>
          ))}
        </div>
        <form onSubmit={sendMessage} className="row">
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Say something…" maxLength={300} />
          <button type="submit" className="primary" disabled={!chatInput.trim()}>Send</button>
        </form>
      </footer>
    </main>
  )
}
