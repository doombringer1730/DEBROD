'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { alive, candidates, fold, glyphs, isComplete, type Candidate, type Item } from './engine'

const Figure = dynamic(() => import('./figure'), { ssr: false })

export type RoundResult = {
  items: Item[]
  missed: Item[]
  clean: Item[]
  correctKeys: number
  wrongKeys: number
  ms: number
}

const ROWS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm']
const HINT_AFTER = 2
const REVEAL_MS = 1500
const NEXT_MS = 450

type State = {
  index: number
  typed: string
  missesHere: number // wrong keys on the current letter
  struggled: boolean // this item needed a hint or was skipped
  phase: 'typing' | 'done' | 'reveal' | 'finished'
  missed: number[]
  correctKeys: number
  wrongKeys: number
  lastKey: { key: string; ok: boolean; n: number } | null
}

type Action = { type: 'key'; key: string } | { type: 'skip' } | { type: 'next' }

const initial: State = {
  index: 0, typed: '', missesHere: 0, struggled: false, phase: 'typing',
  missed: [], correctKeys: 0, wrongKeys: 0, lastKey: null,
}

function reducer(cands: Candidate[][]) {
  return (s: State, a: Action): State => {
    const n = (s.lastKey?.n ?? 0) + 1
    if (a.type === 'next') {
      if (s.phase !== 'done' && s.phase !== 'reveal') return s
      const missed = s.struggled ? [...s.missed, s.index] : s.missed
      if (s.index + 1 >= cands.length) return { ...s, missed, phase: 'finished' }
      return { ...s, missed, index: s.index + 1, typed: '', missesHere: 0, struggled: false, phase: 'typing', lastKey: null }
    }
    if (s.phase !== 'typing') return s
    if (a.type === 'skip') return { ...s, struggled: true, phase: 'reveal' }
    const typed = s.typed + a.key
    if (alive(cands[s.index], typed).length === 0) {
      const missesHere = s.missesHere + 1
      return {
        ...s, missesHere, wrongKeys: s.wrongKeys + 1,
        struggled: s.struggled || missesHere >= HINT_AFTER,
        lastKey: { key: a.key, ok: false, n },
      }
    }
    return {
      ...s, typed, missesHere: 0, correctKeys: s.correctKeys + 1,
      phase: isComplete(cands[s.index], typed) ? 'done' : 'typing',
      lastKey: { key: a.key, ok: true, n },
    }
  }
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Round({ title, items, onFinish, onQuit }: {
  title: string
  items: Item[]
  onFinish: (r: RoundResult) => void
  onQuit: () => void
}) {
  const cands = useMemo(() => items.map(candidates), [items])
  const [s, dispatch] = useReducer(useMemo(() => reducer(cands), [cands]), initial)
  const started = useRef(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    started.current = Date.now()
    const t = window.setInterval(() => setElapsed(Date.now() - started.current), 250)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') return onQuit()
      if (e.key === 'Enter') { e.preventDefault(); return dispatch({ type: 'skip' }) }
      if (e.key === ' ') return e.preventDefault() // spaces are filled in for you
      if ([...e.key].length !== 1) return // Shift, Dead, arrows…
      const key = fold(e.key)
      if (/^[a-z0-9ñ]$/.test(key)) dispatch({ type: 'key', key })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onQuit])

  // Move on after the finished word, or the revealed answer, has been seen.
  useEffect(() => {
    if (s.phase !== 'done' && s.phase !== 'reveal') return
    const t = window.setTimeout(() => dispatch({ type: 'next' }), s.phase === 'reveal' ? REVEAL_MS : NEXT_MS)
    return () => window.clearTimeout(t)
  }, [s.phase, s.index])

  const finished = s.phase === 'finished'
  useEffect(() => {
    if (!finished) return
    const missedSet = new Set(s.missed)
    onFinish({
      items,
      missed: items.filter((_, i) => missedSet.has(i)),
      clean: items.filter((_, i) => !missedSet.has(i)),
      correctKeys: s.correctKeys,
      wrongKeys: s.wrongKeys,
      ms: Date.now() - started.current,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  // A wrong key flashes red briefly; the flash is keyed so repeats restart it.
  const [flash, setFlash] = useState<State['lastKey']>(null)
  useEffect(() => {
    setFlash(s.lastKey)
    if (!s.lastKey) return
    const t = window.setTimeout(() => setFlash(null), 260)
    return () => window.clearTimeout(t)
  }, [s.lastKey])

  if (finished) return null

  const item = items[s.index]
  const reveal = s.phase === 'reveal'
  const shown = reveal ? cands[s.index][0] : alive(cands[s.index], s.typed)[0] ?? cands[s.index][0]
  const word = glyphs(shown, reveal ? shown.norm.length : s.typed.length)
  const hint = s.phase === 'typing' && s.missesHere >= HINT_AFTER ? shown.norm[s.typed.length] : null
  const prompt = item.prompt || (item.type === 'identify' ? (item.model ?? 'skull') === 'skull' ? '¿Qué hueso está en rojo?' : '¿Qué estructura está en rojo?' : '')

  const keyClass = (k: string) => {
    if (flash?.key === k) return flash.ok ? 'an-key is-ok' : 'an-key is-bad'
    if (hint === k) return 'an-key is-hint'
    return 'an-key'
  }

  return (
    <div className="an-round" data-item={item.id}>
      <header className="an-bar">
        <button type="button" className="an-ghost" onClick={onQuit}>Esc · Quit</button>
        <div className="an-progress" aria-label={`Item ${s.index + 1} of ${items.length}`}>
          <div className="an-progress-fill" style={{ width: `${(s.index / items.length) * 100}%` }} />
        </div>
        <span className="an-count">{s.index + 1} / {items.length}</span>
        <span className="an-timer">{clock(elapsed)}</span>
      </header>

      <p className="an-unit-name">{title}</p>

      <div className="an-figure">
        {item.type === 'identify' && item.mesh ? (
          <Figure model={item.model ?? 'skull'} mesh={item.mesh} />
        ) : (
          <p className="an-clue" lang="es">{prompt}</p>
        )}
      </div>
      {item.type === 'identify' && <p className="an-prompt" lang="es">{prompt}</p>}

      <div className={`an-word${reveal ? ' is-reveal' : ''}${s.phase === 'done' ? ' is-done' : ''}`} lang="es" aria-live="polite">
        {word.map((g, i) => (
          <span key={i} className={`an-glyph is-${g.state}`}>{g.ch === ' ' ? ' ' : g.ch}</span>
        ))}
      </div>
      <p className="an-status">
        {reveal ? `Skipped · p. ${item.page}` : hint ? 'Hint: the yellow key is next' : ' '}
      </p>

      <div className="an-keyboard">
        {ROWS.map((row) => (
          <div className="an-keyrow" key={row}>
            {[...row].map((k) => (
              <button type="button" key={k} className={keyClass(k)} tabIndex={-1}
                onClick={() => dispatch({ type: 'key', key: k })}>{k}</button>
            ))}
          </div>
        ))}
        <div className="an-keyrow">
          <button type="button" className="an-key an-key-wide" tabIndex={-1} onClick={() => dispatch({ type: 'skip' })}>
            Enter · Skip
          </button>
        </div>
      </div>
    </div>
  )
}
