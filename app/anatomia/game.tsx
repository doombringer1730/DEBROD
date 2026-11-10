'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { textOf, type Item, type Lang } from './engine'
import Learn from './learn'
import { PlateLinks } from './plates'
import Round, { type RoundResult } from './round'
import { EMPTY, loadProgress, saveProgress, type Progress } from './storage'
import { UNITS, type Unit } from './units'

const SIZES = [5, 15, 30, 0] as const

type Screen =
  | { name: 'home' }
  | { name: 'round'; key: number; title: string; unit: Unit | null; items: Item[]; retry: boolean }
  | { name: 'results'; title: string; unit: Unit | null; result: RoundResult }
  | { name: 'learn'; key: number; unit: Unit; items: Item[] }

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
  const [progress, setProgress] = useState<Progress>(EMPTY)
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

  // Learn mode works through a unit in the order of the notes, unlearned items first.
  const byPage = (a: Item, b: Item) => a.page - b.page || a.id.localeCompare(b.id)
  const unlearned = (u: Unit, learned = progress.learned) => u.items.filter((i) => !learned[i.id]).sort(byPage)
  const learnUnit = (u: Unit, learned = progress.learned) => {
    const left = unlearned(u, learned)
    const pool = left.length ? left : [...u.items].sort(byPage)
    setScreen({ name: 'learn', key: Date.now(), unit: u, items: pool.slice(0, take(pool.length)) })
  }
  const markLearned = useCallback((ids: string[]) => {
    if (!ids.length) return
    update((p) => {
      const learned = { ...p.learned }
      const missed = { ...p.missed }
      for (const id of ids) {
        learned[id] ??= Date.now()
        delete missed[id]
      }
      return { ...p, learned, missed }
    })
  }, [update])

  const missedItems = useMemo(() => UNITS.flatMap((u) => u.items).filter((i) => progress.missed[i.id]), [progress.missed])
  const reviewMissed = () =>
    start(lang === 'en' ? 'Review' : 'Repaso', null, weightedPick(missedItems, take(missedItems.length), progress.missed))

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
  // Results take focus on arrival so the score is read first.
  const focusOnMount = useCallback((el: HTMLElement | null) => el?.focus({ preventScroll: true }), [])

  const learnedCount = useMemo(
    () => Object.fromEntries(UNITS.map((u) => [u.slug, u.items.filter((i) => progress.learned[i.id]).length])),
    [progress.learned],
  )
  const missedCount = useMemo(
    () => Object.fromEntries(UNITS.map((u) => [u.slug, u.items.filter((i) => progress.missed[i.id]).length])),
    [progress.missed],
  )

  if (screen.name === 'round') {
    return <Round key={screen.key} title={screen.title} items={screen.items} lang={lang} onFinish={finish} onQuit={quit} />
  }

  if (screen.name === 'learn') {
    const u = screen.unit
    const sessionIds = new Set(screen.items.map((i) => i.id))
    const more = unlearned(u).some((i) => !sessionIds.has(i.id))
    return <Learn key={screen.key} title={titleOf(u)} items={screen.items} lang={lang}
      onLearned={markLearned} onQuit={quit} onPractice={() => playUnit(u)}
      onMore={more ? () => learnUnit(u) : null} />
  }

  if (screen.name === 'results') {
    const { result, unit, title } = screen
    const next = unit ? UNITS[unit.n % UNITS.length] : null
    const keys = result.correctKeys + result.wrongKeys
    const en = lang === 'en'
    return (
      <main className="an-results">
        <p className="an-unit-name">{title}</p>
        <h1 className="an-score" tabIndex={-1} ref={focusOnMount}>
          {pct(result)}%<span className="an-visually-hidden"> {en ? 'clean' : 'sin fallos'}</span>
        </h1>
        <div className={`an-replay${result.items.length > 60 ? ' is-dense' : ''}`} aria-hidden="true">
          {result.items.map((it, i) => (
            <span key={i} className={`an-tick ${result.missed.includes(it) ? 'is-missed' : 'is-clean'}`}
              style={{ animationDelay: `${Math.min(i * 25, 600)}ms` }} />
          ))}
        </div>
        <dl className="an-stats">
          <div><dt>Accuracy</dt><dd>{result.clean.length} / {result.items.length}</dd></div>
          <div><dt>Time</dt><dd>{clock(result.ms)}</dd></div>
          <div><dt>Keystrokes</dt><dd>{keys ? Math.round((result.correctKeys / keys) * 100) : 100}%</dd></div>
        </dl>
        {result.missed.length > 0 ? (
          <>
            <h2 className="an-h2">Missed <span className="an-num an-muted">{result.missed.length}</span></h2>
            <ul className="an-missed" lang={lang}>
              {result.missed.map((it) => (
                <li key={it.id}>
                  <span className="an-missed-answer"><span className="an-mark" aria-hidden="true">×</span>{textOf(it, lang).answer}</span>
                  <span className="an-missed-prompt">{textOf(it, lang).prompt || (en ? 'Bone in red' : 'Hueso en rojo')}{it.mesh ? ' (3D)' : ''}</span>
                  <span className="an-page">p. {it.page}</span>
                </li>
              ))}
            </ul>
            <PlateLinks items={result.missed} lang={lang} />
          </>
        ) : (
          <p className="an-perfect"><span className="an-mark is-clean" aria-hidden="true">✓</span>No misses.</p>
        )}
        <div className="an-actions">
          {result.missed.length > 0 && (
            <button type="button" className="an-btn is-primary"
              onClick={() => start(title, unit, shuffle(result.missed), true)}>Retry missed</button>
          )}
          {next && <button type="button" className={`an-btn${result.missed.length ? '' : ' is-primary'}`} onClick={() => playUnit(next)}>Next unit</button>}
          <button type="button" className="an-btn" onClick={quit}>Home</button>
        </div>
      </main>
    )
  }

  const learning = progress.mode === 'learn'
  const chips = <T extends string | number>(label: string, options: readonly T[], value: T, name: (v: T) => string,
    set: (v: T) => void, short?: (v: T) => string) => (
    <div className="an-switch" role="group" aria-label={label}>
      <span className="an-switch-label">{label}</span>
      {options.map((o) => (
        <button key={String(o)} type="button" className={`an-chip${value === o ? ' is-on' : ''}`} aria-pressed={value === o}
          aria-label={short ? name(o) : undefined} onClick={() => set(o)}>
          <span className={short ? 'an-wide-only' : undefined}>{name(o)}</span>
          {short && <span className="an-narrow-only" aria-hidden="true">{short(o)}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <main className="an-home">
      <header className="an-masthead">
        <div>
          <h1 className="an-title">Anatomía</h1>
          <p className="an-tagline">{lang === 'en' ? 'Study atlas' : 'Atlas de estudio'} · <span className="an-num">{UNITS.length}</span> {lang === 'en' ? 'units' : 'unidades'} · <span className="an-num">{UNITS.reduce((n, u) => n + u.items.length, 0)}</span> items</p>
        </div>
        <div className="an-controls">
          {chips('Language', ['es', 'en'] as const, lang, (l) => (l === 'es' ? 'Español' : 'English'),
            (l) => update((p) => ({ ...p, lang: l })), (l) => l.toUpperCase())}
          {chips('Mode', ['play', 'learn'] as const, progress.mode, (m) => (m === 'play' ? 'Play' : 'Learn'),
            (m) => update((p) => ({ ...p, mode: m })))}
          {chips('Round', SIZES, size as (typeof SIZES)[number], (n) => (n === 0 ? 'All' : String(n)),
            (n) => update((p) => ({ ...p, size: n })))}
        </div>
      </header>

      <section className="an-review" aria-label="Review">
        {mixing ? (
          <>
            <p className="an-review-head">Mixed review <span className="an-muted">· pick units below</span></p>
            <div className="an-actions">
              <button type="button" className="an-btn is-primary" disabled={!picked.size} onClick={playMixed}>
                Start <span className="an-num">({picked.size})</span>
              </button>
              <button type="button" className="an-btn" onClick={() => setPicked(new Set(UNITS.map((u) => u.slug)))}>All units</button>
              <button type="button" className="an-btn" onClick={() => { setMixing(false); setPicked(new Set()) }}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="an-review-head">
              Review <span className="an-muted">·</span>{' '}
              {missedItems.length ? <><span className="an-num">{missedItems.length}</span> missed</>
                : <span className="an-muted">nothing missed yet</span>}
            </p>
            <div className="an-actions">
              {missedItems.length > 0 && <button type="button" className="an-btn is-primary" onClick={reviewMissed}>Review missed</button>}
              <button type="button" className="an-btn" onClick={() => setMixing(true)}>Mixed review…</button>
            </div>
          </>
        )}
      </section>

      <ol className="an-toc">
        {UNITS.map((u) => {
          const on = picked.has(u.slug)
          const best = progress.best[bestKey(u.slug)]
          const shown = learning ? Math.round((learnedCount[u.slug] / u.items.length) * 100) : best
          const in3d = u.items.filter((i) => i.mesh).length
          return (
            <li key={u.slug}>
              <button type="button" className={`an-entry${mixing && on ? ' is-picked' : ''}`}
                aria-pressed={mixing ? on : undefined}
                onClick={() => {
                  if (!mixing) return learning ? learnUnit(u) : playUnit(u)
                  const s = new Set(picked)
                  if (on) s.delete(u.slug)
                  else s.add(u.slug)
                  setPicked(s)
                }}>
                <img className="an-entry-plate" src={`/anatomia/cards/${u.slug}.webp`} alt="" width={480} height={300} loading="lazy" />
                <span className="an-entry-n an-num">{mixing && on ? '✓' : String(u.n).padStart(2, '0')}</span>
                <span className="an-entry-title" lang={lang}>{titleOf(u)}</span>
                <span className="an-entry-meta">
                  <span className="an-num">{u.items.length}</span> items
                  {in3d > 0 && <> · <span className="an-num">{in3d}</span> in 3D</>}
                  {missedCount[u.slug] > 0 && <> · <span className="an-num">{missedCount[u.slug]}</span> to review</>}
                </span>
                <span className="an-entry-score">
                  {shown != null && (learning ? learnedCount[u.slug] > 0 : true) ? (
                    <>
                      <span className="an-meter" aria-hidden="true"><span style={{ width: `${shown}%` }} /></span>
                      <span className="an-num">{learning ? `${learnedCount[u.slug]}/${u.items.length}` : `${shown}%`}</span>
                      <span className="an-visually-hidden">{learning ? ' learned' : ' best'}</span>
                    </>
                  ) : <span className="an-muted">{learning ? 'Not started' : 'Not played'}</span>}
                </span>
                <span className="an-entry-pages an-num">pp. {u.pages}</span>
              </button>
            </li>
          )
        })}
      </ol>

      <footer className="an-footer">
        Content from my notes (Anatomía 2); the English mode is a translation of them. 3D models: BodyParts3D, © The Database Center for Life Science,
        licensed under <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noreferrer">CC BY-SA 2.1 Japan</a>.
      </footer>
    </main>
  )
}
