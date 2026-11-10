'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { alive, candidates, fold, glyphs, isComplete, textOf, type Candidate, type Hint, type Item, type Lang } from './engine'

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

// What the red means when it is not the answer itself.
const HINTS: Record<Hint, { es: string; en: string }> = {
  region: { es: 'La respuesta está en la zona roja', en: 'The answer is on the part in red' },
  between: { es: 'Está entre las partes en rojo', en: 'It lies between the parts in red' },
  attaches: { es: 'Se une a lo que está en rojo', en: 'It attaches to what is in red' },
  innervates: { es: 'En rojo, lo que inerva', en: 'In red: what this nerve supplies' },
  supplies: { es: 'En rojo, lo que irriga', en: 'In red: what this vessel supplies' },
  passes: { es: 'Pasa por la zona en rojo', en: 'It passes through the part in red' },
  along: { es: 'Está junto a lo que está en rojo', en: 'It lies next to what is in red' },
  source: { es: 'Se produce en la zona en rojo', en: 'It is made in the part in red' },
  example: { es: 'En rojo, un ejemplo', en: 'In red: an example' },
}
const HINT_AFTER = 2
const REVEAL_MS = 1500
const NEXT_MS = 450
const READY_MS = 900

type State = {
  index: number
  typed: string
  missesHere: number // wrong keys on the current letter
  struggled: boolean // this item needed a hint or was skipped
  phase: 'typing' | 'done' | 'reveal' | 'finished'
  ready: boolean // an accepted answer is complete but a longer one could still follow
  missed: number[]
  correctKeys: number
  wrongKeys: number
  lastKey: { key: string; ok: boolean; n: number } | null
}

type Action = { type: 'key'; key: string } | { type: 'skip' } | { type: 'next' } | { type: 'accept' }

const initial: State = {
  index: 0, typed: '', missesHere: 0, struggled: false, phase: 'typing', ready: false,
  missed: [], correctKeys: 0, wrongKeys: 0, lastKey: null,
}

function reducer(cands: Candidate[][]) {
  return (s: State, a: Action): State => {
    const n = (s.lastKey?.n ?? 0) + 1
    if (a.type === 'next') {
      if (s.phase !== 'done' && s.phase !== 'reveal') return s
      const missed = s.struggled ? [...s.missed, s.index] : s.missed
      if (s.index + 1 >= cands.length) return { ...s, missed, phase: 'finished' }
      return { ...s, missed, index: s.index + 1, typed: '', missesHere: 0, struggled: false, phase: 'typing', ready: false, lastKey: null }
    }
    if (s.phase !== 'typing') return s
    if (a.type === 'accept') return s.ready ? { ...s, ready: false, phase: 'done' } : s
    // Enter accepts a finished short answer; otherwise it skips.
    if (a.type === 'skip') return s.ready ? { ...s, ready: false, phase: 'done' } : { ...s, struggled: true, phase: 'reveal' }
    const typed = s.typed + a.key
    if (alive(cands[s.index], typed).length === 0) {
      const missesHere = s.missesHere + 1
      return {
        ...s, missesHere, wrongKeys: s.wrongKeys + 1,
        struggled: s.struggled || missesHere >= HINT_AFTER,
        lastKey: { key: a.key, ok: false, n },
      }
    }
    const complete = isComplete(cands[s.index], typed)
    const longer = complete && alive(cands[s.index], typed).some((c) => c.norm.length > typed.length)
    return {
      ...s, typed, missesHere: 0, correctKeys: s.correctKeys + 1,
      phase: complete && !longer ? 'done' : 'typing',
      ready: longer,
      lastKey: { key: a.key, ok: true, n },
    }
  }
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Round({ title, items, lang, onFinish, onQuit, copy = false }: {
  title: string
  copy?: boolean // learning: the whole answer is shown and you type it out
  lang: Lang
  items: Item[]
  onFinish: (r: RoundResult) => void
  onQuit: () => void
}) {
  const cands = useMemo(() => items.map((it) => candidates(it, lang)), [items, lang])
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

  // A complete short answer is accepted after a pause unless more letters follow.
  useEffect(() => {
    if (!s.ready) return
    const t = window.setTimeout(() => dispatch({ type: 'accept' }), READY_MS)
    return () => window.clearTimeout(t)
  }, [s.ready, s.typed])

  // Move on after the finished word, or the revealed answer, has been seen.
  useEffect(() => {
    if (s.phase !== 'done' && s.phase !== 'reveal') return
    const t = window.setTimeout(() => dispatch({ type: 'next' }), s.phase === 'reveal' ? REVEAL_MS : NEXT_MS)
    return () => window.clearTimeout(t)
  }, [s.phase, s.index])

  // The 3D target to show: the current item, else the next 3D item so it is ready.
  const figure = useMemo(() => {
    for (let i = s.index; i < items.length; i++) {
      const it = items[i]
      if (it.mesh) return { model: it.model ?? 'skull', mesh: it.mesh }
    }
    return null
  }, [items, s.index])

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
  const live = alive(cands[s.index], s.typed)
  // While a short answer waits to be accepted, show it complete rather than the longer one's dots.
  const shown = reveal ? cands[s.index][0]
    : (s.ready && live.find((c) => c.norm.length === s.typed.length)) || live[0] || cands[s.index][0]
  const word = glyphs(shown, reveal || copy ? shown.norm.length : s.typed.length)
  // In copy mode the letters still to type are shown faintly instead of as dots.
  let letter = 0
  const ghost = word.map((g) => g.state !== 'gap' && copy && !reveal && letter++ >= s.typed.length)
  const hint = s.phase === 'typing' && s.missesHere >= HINT_AFTER ? shown.norm[s.typed.length] : null
  const skull = (item.model ?? 'skull') === 'skull'
  const fallback = lang === 'en'
    ? skull ? 'Which bone is in red?' : 'Which structure is in red?'
    : skull ? '¿Qué hueso está en rojo?' : '¿Qué estructura está en rojo?'
  const prompt = textOf(item, lang).prompt || (item.type === 'identify' ? fallback : '')
  const has3d = !!item.mesh
  const hintNote = item.hint ? HINTS[item.hint][lang] : null

  const en = lang === 'en'
  // One tick per item: clean, missed, the current one, or still to come.
  const missedSet = new Set(s.missed)
  const tick = (i: number) => {
    if (i < s.index) return missedSet.has(i) ? 'is-missed' : 'is-clean'
    if (i > s.index) return ''
    if (reveal || (s.phase === 'done' && s.struggled)) return 'is-missed'
    return s.phase === 'done' ? 'is-clean' : 'is-now'
  }
  const missedSoFar = s.missed.length + (reveal ? 1 : 0)
  const letters = shown.norm.length
  const spoken = reveal ? `${en ? 'Skipped' : 'Saltada'}: ${shown.display}`
    : s.phase === 'done' ? shown.display
    : en ? `${s.typed.length} of ${letters} letters` : `${s.typed.length} de ${letters} letras`

  const keyClass = (k: string) => {
    if (flash?.key === k) return flash.ok ? 'an-key is-ok' : 'an-key is-bad'
    if (hint === k) return 'an-key is-hint'
    return 'an-key'
  }

  return (
    <div className="an-round" data-item={item.id}>
      <header className="an-bar">
        <button type="button" className="an-ghost" onClick={onQuit}>Esc · Quit</button>
        <div className={`an-ticks${items.length > 60 ? ' is-dense' : ''}`} role="progressbar"
          aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={s.index}
          aria-valuetext={`${en ? 'Item' : 'Pregunta'} ${s.index + 1} / ${items.length}, ${missedSoFar} ${en ? 'missed' : 'falladas'}`}>
          {items.map((_, i) => <span key={i} className={`an-tick ${tick(i)}`} />)}
        </div>
        <span className="an-count an-num">{s.index + 1} / {items.length}</span>
        {missedSoFar > 0 && <span className="an-count-missed"><span className="an-mark" aria-hidden="true">×</span><span className="an-num">{missedSoFar}</span></span>}
        <span className="an-timer an-num">{clock(elapsed)}</span>
      </header>

      <p className="an-unit-name">{title}</p>

      <div className={`an-stage${has3d ? ' has-figure' : ''}`}>
        {/* One set of 3D views lives for the whole round and is hidden on items
            without a figure, so WebGL contexts aren't created and thrown away per item. */}
        {figure && (
          <div className="an-figure-3d" hidden={!has3d} role="img"
            aria-label={en ? '3D model, one structure highlighted in red' : 'Modelo 3D, una estructura resaltada en rojo'}>
            <Figure model={figure.model} mesh={figure.mesh} paused={!has3d} />
          </div>
        )}
        {item.type === 'identify' ? (
          <p className="an-prompt" lang={lang}>{prompt}</p>
        ) : (
          <div className={`an-clue-block${has3d ? ' is-under' : ''}`}>
            <p className="an-clue" lang={lang}>
              {prompt}
              {hintNote && <span className="an-region-note">{hintNote}</span>}
            </p>
            <span className="an-margin-page an-num" aria-label={`${en ? 'page' : 'página'} ${item.page}`}>p. {item.page}</span>
          </div>
        )}

        <div className={`an-word${reveal ? ' is-reveal' : ''}${s.phase === 'done' ? ' is-done' : ''}`} lang={lang} aria-hidden="true">
          {word.map((g, i) => (
            <span key={i} className={`an-glyph is-${ghost[i] ? 'ghost' : g.state}`}>{g.ch === ' ' ? '\u00a0' : g.ch}</span>
          ))}
        </div>
        <p className="an-visually-hidden" aria-live="polite">{spoken}</p>
        <p className="an-status">
          {reveal ? <><span className="an-mark" aria-hidden="true">×</span>{en ? 'Skipped' : 'Saltada'} · <span className="an-num">p. {item.page}</span></>
            : hint ? 'Hint: the yellow key is next'
            : s.ready ? 'Enter to accept, or keep typing'
            : copy ? <>{en ? 'Type it out to learn it' : 'Escríbela para aprenderla'}{item.type === 'identify' && <> · <span className="an-num">p. {item.page}</span></>}</>
            : '\u00a0'}
        </p>
      </div>

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
