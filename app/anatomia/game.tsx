'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { textOf, type Item, type Lang } from './engine'
import Round, { type RoundResult } from './round'
import { loadProgress, saveProgress, type Progress } from './storage'
import { UNITS, type Unit } from './units'

const SIZES = [5, 15, 30, 0] as const

type Screen =
  | { name: 'home' }
  | { name: 'round'; key: number; title: string; unit: Unit | null; items: Item[]; retry: boolean }
  | { name: 'results'; title: string; unit: Unit | null; result: RoundResult }

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** Weighted sample without replacement: items missed before come up more often. */
function weightedPick(items: Item[], n: number, missed: Record<string, number>): Item[] {
  const pool = items.map((it) => ({ it, w: 1 + 3 * Math.min(missed[it.id] ?? 0, 3) }))
  const out: Item[] = []
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, p) => s + p.w, 0)
    let i = 0
    while ((r -= pool[i].w) > 0) i++
    out.push(pool.splice(i, 1)[0].it)
  }
  return out
}

const pct = (r: RoundResult) => Math.round((r.clean.length / Math.max(1, r.items.length)) * 100)
const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Game() {
  const [progress, setProgress] = useState<Progress>({ best: {}, missed: {}, size: 15, lang: 'es' })
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [mixing, setMixing] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => setProgress(loadProgress()), [])
  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((p) => {
      const next = fn(p)
      saveProgress(next)
      return next
    })
  }, [])

  const size = progress.size
  const lang: Lang = progress.lang
  const titleOf = (u: Unit) => (lang === 'en' ? u.titleEn : u.title)
  // Best scores are kept per language; Spanish keeps the original keys.
  const bestKey = (slug: string) => (lang === 'en' ? `${slug}:en` : slug)
  const take = (n: number) => (size === 0 ? n : Math.min(size, n))

  const start = (title: string, unit: Unit | null, items: Item[], retry = false) =>
    setScreen({ name: 'round', key: Date.now(), title, unit, items, retry })

  const playUnit = (u: Unit) => start(titleOf(u), u, shuffle(u.items).slice(0, take(u.items.length)))

  const playMixed = () => {
    const all = UNITS.filter((u) => picked.has(u.slug)).flatMap((u) => u.items)
    if (!all.length) return
    start(lang === 'en' ? 'Mixed review' : 'Repaso mixto', null, weightedPick(all, take(all.length), progress.missed))
  }

  const finish = useCallback((result: RoundResult) => {
    setScreen((sc) => {
      if (sc.name !== 'round') return sc
      update((p) => {
        const missed = { ...p.missed }
        for (const it of result.missed) missed[it.id] = (missed[it.id] ?? 0) + 1
        for (const it of result.clean) delete missed[it.id]
        const best = { ...p.best }
        // Only a full unit round sets the unit's best score.
        if (sc.unit && !sc.retry) {
          const k = bestKey(sc.unit.slug)
          best[k] = Math.max(best[k] ?? 0, pct(result))
        }
        return { ...p, best, missed }
      })
      return { name: 'results', title: sc.title, unit: sc.unit, result }
    })
  }, [update, lang])

  const quit = useCallback(() => setScreen({ name: 'home' }), [])

  const missedCount = useMemo(
    () => Object.fromEntries(UNITS.map((u) => [u.slug, u.items.filter((i) => progress.missed[i.id]).length])),
    [progress.missed],
  )

  if (screen.name === 'round') {
    return <Round key={screen.key} title={screen.title} items={screen.items} lang={lang} onFinish={finish} onQuit={quit} />
  }

  if (screen.name === 'results') {
    const { result, unit, title } = screen
    const next = unit ? UNITS[unit.n % UNITS.length] : null
    const keys = result.correctKeys + result.wrongKeys
    return (
      <main className="an-results">
        <p className="an-unit-name">{title}</p>
        <h1 className="an-score">{pct(result)}%</h1>
        <dl className="an-stats">
          <div><dt>Accuracy</dt><dd>{result.clean.length} / {result.items.length}</dd></div>
          <div><dt>Time</dt><dd>{clock(result.ms)}</dd></div>
          <div><dt>Keystrokes</dt><dd>{keys ? Math.round((result.correctKeys / keys) * 100) : 100}%</dd></div>
        </dl>
        {result.missed.length > 0 ? (
          <>
            <h2 className="an-h2">Missed</h2>
            <ul className="an-missed" lang={lang}>
              {result.missed.map((it) => (
                <li key={it.id}>
                  <span className="an-missed-answer">{textOf(it, lang).answer}</span>
                  <span className="an-missed-prompt">{textOf(it, lang).prompt || (lang === 'en' ? 'Bone in red' : 'Hueso en rojo')}{it.type === 'identify' ? ' (3D)' : ''}</span>
                  <span className="an-page">p. {it.page}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="an-perfect">No misses.</p>
        )}
        <div className="an-actions">
          {result.missed.length > 0 && (
            <button type="button" className="an-btn is-primary"
              onClick={() => start(title, unit, shuffle(result.missed), true)}>Retry missed</button>
          )}
          {next && <button type="button" className="an-btn" onClick={() => playUnit(next)}>Next unit</button>}
          <button type="button" className="an-btn" onClick={quit}>Home</button>
        </div>
      </main>
    )
  }

  return (
    <main className="an-home">
      <header className="an-home-top">
        <h1 className="an-title">Anatomía</h1>
        <div className="an-controls">
        <div className="an-sizes" role="group" aria-label="Language">
          <span>Language</span>
          {(['es', 'en'] as const).map((l) => (
            <button key={l} type="button" className={`an-chip${lang === l ? ' is-on' : ''}`} aria-pressed={lang === l}
              onClick={() => update((p) => ({ ...p, lang: l }))}>{l === 'es' ? 'Español' : 'English'}</button>
          ))}
        </div>
        <div className="an-sizes" role="group" aria-label="Round size">
          <span>Round</span>
          {SIZES.map((n) => (
            <button key={n} type="button" className={`an-chip${size === n ? ' is-on' : ''}`}
              onClick={() => update((p) => ({ ...p, size: n }))}>{n === 0 ? 'All' : n}</button>
          ))}
        </div>
        </div>
      </header>

      <div className="an-grid">
        {UNITS.map((u) => {
          const on = picked.has(u.slug)
          return (
            <button key={u.slug} type="button" className={`an-card${mixing && on ? ' is-picked' : ''}`}
              onClick={() => {
                if (!mixing) return playUnit(u)
                const s = new Set(picked)
                if (on) s.delete(u.slug)
                else s.add(u.slug)
                setPicked(s)
              }}>
              <span className="an-card-n">{u.n}</span>
              <span className="an-card-title" lang={lang}>{titleOf(u)}</span>
              <span className="an-card-meta">
                {u.items.length} items · pp. {u.pages}
                {u.items.some((i) => i.type === 'identify') && ' · 3D'}
              </span>
              <span className="an-card-best">
                {progress.best[bestKey(u.slug)] != null ? `Best ${progress.best[bestKey(u.slug)]}%` : 'Not played'}
                {missedCount[u.slug] > 0 && ` · ${missedCount[u.slug]} to review`}
              </span>
            </button>
          )
        })}
      </div>

      <section className="an-mixed">
        {mixing ? (
          <>
            <p>Pick units above, then start. Items you missed before come up more often.</p>
            <div className="an-actions">
              <button type="button" className="an-btn is-primary" disabled={!picked.size} onClick={playMixed}>
                Start mixed review ({picked.size})
              </button>
              <button type="button" className="an-btn" onClick={() => setPicked(new Set(UNITS.map((u) => u.slug)))}>All units</button>
              <button type="button" className="an-btn" onClick={() => { setMixing(false); setPicked(new Set()) }}>Cancel</button>
            </div>
          </>
        ) : (
          <button type="button" className="an-btn is-primary" onClick={() => setMixing(true)}>Mixed review</button>
        )}
      </section>

      <footer className="an-footer">
        Content from my notes (Anatomía 2); the English mode is a translation of them. 3D models: BodyParts3D, © The Database Center for Life Science,
        licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noreferrer">CC BY-SA 2.1 Japan</a>.
      </footer>
    </main>
  )
}
