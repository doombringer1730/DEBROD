'use client'

import { useEffect, useState } from 'react'
import { textOf, type Item, type Lang } from './engine'
import { PlateLinks } from './plates'
import Round, { type RoundResult } from './round'

// Learn mode: items in the order of the notes, a few at a time. Each group is
// first typed out with the answer showing, then typed from memory in a new
// order; whatever is missed comes back until it is recalled cleanly.
const GROUP = 5
const MAX_PASSES = 4 // recall passes per group before moving on anyway

type Stage =
  | { name: 'copy'; group: number; key: number }
  | { name: 'ready'; group: number } // pause before typing from memory
  | { name: 'recall'; group: number; pass: number; items: Item[]; key: number }
  | { name: 'summary' }

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export default function Learn({ title, items, lang, onLearned, onPractice, onMore, onQuit }: {
  title: string
  items: Item[]
  lang: Lang
  onLearned: (ids: string[]) => void
  onPractice: () => void
  onMore: (() => void) | null // another session of unlearned items, if any are left
  onQuit: () => void
}) {
  const en = lang === 'en'
  const groups = Array.from({ length: Math.ceil(items.length / GROUP) }, (_, g) => items.slice(g * GROUP, g * GROUP + GROUP))
  const [stage, setStage] = useState<Stage>({ name: 'copy', group: 0, key: Date.now() })
  const [firstTry, setFirstTry] = useState<string[]>([]) // recalled on the first pass
  const [later, setLater] = useState<string[]>([]) // took more than one pass
  const [notYet, setNotYet] = useState<string[]>([]) // still missed after every pass

  const nextGroup = (group: number) =>
    setStage(group + 1 < groups.length ? { name: 'copy', group: group + 1, key: Date.now() } : { name: 'summary' })

  const recall = (group: number) =>
    setStage({ name: 'recall', group, pass: 1, items: shuffle(groups[group]), key: Date.now() })

  const afterRecall = (r: RoundResult) => {
    if (stage.name !== 'recall') return
    const clean = r.clean.map((i) => i.id)
    onLearned(clean)
    if (stage.pass === 1) setFirstTry((a) => [...a, ...clean])
    else setLater((a) => [...a, ...clean])
    if (r.missed.length && stage.pass < MAX_PASSES)
      return setStage({ ...stage, pass: stage.pass + 1, items: shuffle(r.missed), key: Date.now() })
    if (r.missed.length) setNotYet((a) => [...a, ...r.missed.map((i) => i.id)])
    nextGroup(stage.group)
  }

  // Enter (or Space) continues from the pause screen; Esc quits.
  useEffect(() => {
    if (stage.name !== 'ready') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onQuit()
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); recall(stage.group) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, onQuit])

  const head = (group: number) => `${title} · ${en ? 'Learn' : 'Aprender'} ${group + 1}/${groups.length}`

  if (stage.name === 'copy') {
    return <Round key={stage.key} copy title={`${head(stage.group)} · ${en ? 'type it out' : 'cópiala'}`}
      items={groups[stage.group]} lang={lang} onQuit={onQuit} onFinish={() => setStage({ name: 'ready', group: stage.group })} />
  }

  if (stage.name === 'recall') {
    const label = stage.pass === 1 ? (en ? 'from memory' : 'de memoria') : (en ? 'once more' : 'otra vez')
    return <Round key={stage.key} title={`${head(stage.group)} · ${label}`} items={stage.items} lang={lang}
      onQuit={onQuit} onFinish={afterRecall} />
  }

  if (stage.name === 'ready') {
    const group = groups[stage.group]
    return (
      <main className="an-results an-learn">
        <p className="an-unit-name">{head(stage.group)}</p>
        <h1 className="an-learn-title">{en ? 'Now from memory' : 'Ahora de memoria'}</h1>
        <p className="an-learn-lede">
          {en ? `The same ${group.length} come back in a new order, without the answer.`
            : `Las mismas ${group.length} vuelven en otro orden, sin la respuesta.`}
        </p>
        <ul className="an-missed an-learn-list" lang={lang}>
          {group.map((it) => (
            <li key={it.id}>
              <span className="an-missed-answer is-plain">{textOf(it, lang).answer}</span>
              <span className="an-missed-prompt">{textOf(it, lang).prompt || (en ? 'Structure in red' : 'Estructura en rojo')}{it.mesh ? ' (3D)' : ''}</span>
              <span className="an-page">p. {it.page}</span>
            </li>
          ))}
        </ul>
        <PlateLinks items={group} lang={lang} />
        <div className="an-actions">
          <button type="button" className="an-btn is-primary" onClick={() => recall(stage.group)}>
            {en ? 'Start · Enter' : 'Empezar · Enter'}
          </button>
          <button type="button" className="an-btn" onClick={() => nextGroup(stage.group)}>{en ? 'Skip this group' : 'Saltar este grupo'}</button>
          <button type="button" className="an-btn" onClick={onQuit}>{en ? 'Home' : 'Inicio'}</button>
        </div>
      </main>
    )
  }

  const byId = new Map(items.map((i) => [i.id, i]))
  const learned = firstTry.length + later.length
  return (
    <main className="an-results an-learn">
      <p className="an-unit-name">{title} · {en ? 'Learn' : 'Aprender'}</p>
      <h1 className="an-score">{learned}<span className="an-score-of"> / {items.length}</span></h1>
      <dl className="an-stats">
        <div><dt>{en ? 'First try' : 'A la primera'}</dt><dd>{firstTry.length}</dd></div>
        <div><dt>{en ? 'Second try or later' : 'Tras repasar'}</dt><dd>{later.length}</dd></div>
        <div><dt>{en ? 'Not yet' : 'Aún no'}</dt><dd>{notYet.length}</dd></div>
      </dl>
      {notYet.length > 0 && (
        <>
          <h2 className="an-h2">{en ? 'Still to learn' : 'Por aprender'}</h2>
          <ul className="an-missed" lang={lang}>
            {notYet.map((id) => byId.get(id)!).map((it) => (
              <li key={it.id}>
                <span className="an-missed-answer">{textOf(it, lang).answer}</span>
                <span className="an-missed-prompt">{textOf(it, lang).prompt || (en ? 'Structure in red' : 'Estructura en rojo')}{it.mesh ? ' (3D)' : ''}</span>
                <span className="an-page">p. {it.page}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="an-actions">
        {onMore && <button type="button" className="an-btn is-primary" onClick={onMore}>{en ? 'Keep learning' : 'Seguir aprendiendo'}</button>}
        <button type="button" className={`an-btn${onMore ? '' : ' is-primary'}`} onClick={onPractice}>{en ? 'Practice this unit' : 'Practicar la unidad'}</button>
        <button type="button" className="an-btn" onClick={onQuit}>{en ? 'Home' : 'Inicio'}</button>
      </div>
    </main>
  )
}
