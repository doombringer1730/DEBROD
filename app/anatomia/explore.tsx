'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fold, textOf, type Item, type Lang } from './engine'
import { PlateLinks } from './plates'
import { UNITS, type Unit } from './units'

// Explore: browse every term, see it on its figure, read what the notes say
// about it, and click around the figure to move to its neighbours. Nothing is
// scored and nothing is hidden, so names are shown on the figures here.

const ExploreFigure = dynamic(() => import('./figure').then((m) => m.ExploreFigure), { ssr: false })
const DiagramView = dynamic(() => import('./diagrams/view'), { ssr: false })

type Entry = { item: Item; unit: Unit }
const ALL: Entry[] = UNITS.flatMap((unit) => unit.items.map((item) => ({ item, unit })))
// For a structure shown on the model without a description of its own, the
// first clue in the notes about the same structure describes it.
const keyOf = (it: Item) => (it.mesh ? `${it.model ?? 'skull'}:${it.mesh}` : it.diagram ? `${it.diagram}:${it.part}` : '')
const CLUE_FOR = new Map<string, Item>()
for (const { item } of ALL) if (item.type === 'clue' && !item.hint && keyOf(item) && !CLUE_FOR.has(keyOf(item))) CLUE_FOR.set(keyOf(item), item)
const byPage = (a: Entry, b: Entry) => a.unit.n - b.unit.n || a.item.page - b.item.page || a.item.id.localeCompare(b.item.id)

const HINT_TEXT: Record<string, { es: string; en: string }> = {
  region: { es: 'Está en la zona roja', en: 'It is on the part in red' },
  between: { es: 'Está entre las partes en rojo', en: 'It lies between the parts in red' },
  attaches: { es: 'Se une a lo que está en rojo', en: 'It attaches to what is in red' },
  innervates: { es: 'En rojo, lo que inerva', en: 'In red: what this nerve supplies' },
  supplies: { es: 'En rojo, lo que irriga', en: 'In red: what this vessel supplies' },
  passes: { es: 'Pasa por la zona en rojo', en: 'It passes through the part in red' },
  along: { es: 'Está junto a lo que está en rojo', en: 'It lies next to what is in red' },
  source: { es: 'Se produce en la zona en rojo', en: 'It is made in the part in red' },
  example: { es: 'En rojo, un ejemplo', en: 'In red: an example' },
}

/** Items lit by a node of a 3D model, the structure itself first. */
function itemsOnMesh(model: string, node: string): Entry[] {
  const base = node.replace(/__[LR]$/, '')
  return ALL.filter((e) => (e.item.model ?? 'skull') === model && e.item.mesh?.split('+').includes(base))
    .sort((a, b) => rank(a, base) - rank(b, base))
}
/** Items lit by any of these diagram parts, the structure itself first. */
function itemsOnPart(diagram: string, parts: string[]): Entry[] {
  return ALL.filter((e) => e.item.diagram === diagram && e.item.part?.split('+').some((p) => parts.includes(p)))
    .sort((a, b) => rank(a, parts[0]) - rank(b, parts[0]))
}
// The term that *is* the red part beats one that merely relates to it.
const rank = (e: Entry, part: string) =>
  ((e.item.mesh ?? e.item.part) === part ? 0 : 2) + (e.item.hint ? 1 : 0) + (e.item.type === 'identify' ? 0 : 0.5)

export default function Explore({ lang, start, onQuit }: { lang: Lang; start: Unit | null; onQuit: () => void }) {
  const en = lang === 'en'
  const [unit, setUnit] = useState<string>(start?.slug ?? 'all')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const q = fold(query.trim())
    return ALL.filter((e) => unit === 'all' || e.unit.slug === unit)
      .filter((e) => !q || [e.item.answer, e.item.prompt, e.item.en.answer, e.item.en.prompt, ...e.item.accept, ...e.item.en.accept]
        .some((t) => fold(t).includes(q)))
      .sort(byPage)
  }, [unit, query])
  const [selected, setSelected] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false) // phones: list or detail
  const current = ALL.find((e) => e.item.id === selected) ?? list[0] ?? null
  const listRef = useRef<HTMLOListElement>(null)

  const select = (id: string, fromFigure = false) => {
    setSelected(id)
    setShowDetail(true)
    // A pick on the figure can land outside the filtered list: widen it.
    if (fromFigure && !list.some((e) => e.item.id === id)) { setUnit('all'); setQuery('') }
  }

  // Keep the selected row in view.
  useEffect(() => {
    listRef.current?.querySelector('.is-on')?.scrollIntoView({ block: 'nearest' })
  }, [current?.item.id])

  // Arrow keys move through the list; Esc goes home.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT'
      if (e.key === 'Escape') { if (typing) return; e.preventDefault(); return showDetail ? setShowDetail(false) : onQuit() }
      if (typing || !current) return
      const i = list.findIndex((x) => x.item.id === current.item.id)
      if (e.key === 'ArrowDown' && i < list.length - 1) { e.preventDefault(); setSelected(list[i + 1].item.id) }
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); setSelected(list[i - 1].item.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [list, current, showDetail, onQuit])

  const t = (it: Item) => textOf(it, lang)
  const name = (it: Item) => t(it).answer
  const describe = (e: Entry) => {
    const own = t(e.item).prompt
    if (own) return own
    const clue = CLUE_FOR.get(keyOf(e.item))
    return clue ? t(clue).prompt : en ? 'Structure shown on the model' : 'Estructura señalada en el modelo'
  }

  return (
    <main className={`an-explore${showDetail ? ' shows-detail' : ''}`}>
      <header className="an-explore-bar">
        <button type="button" className="an-ghost" onClick={onQuit}>Esc · {en ? 'Home' : 'Inicio'}</button>
        <h1 className="an-explore-title an-title-l">{en ? 'Explore' : 'Explorar'}</h1>
        <select className="an-select" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={en ? 'Unit' : 'Unidad'}>
          <option value="all">{en ? 'All units' : 'Todas las unidades'}</option>
          {UNITS.map((u) => <option key={u.slug} value={u.slug}>{String(u.n).padStart(2, '0')} · {en ? u.titleEn : u.title}</option>)}
        </select>
        <input className="an-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={en ? 'Search terms and descriptions' : 'Buscar términos y descripciones'} aria-label={en ? 'Search' : 'Buscar'} />
      </header>

      <div className="an-explore-body">
        <nav className="an-explore-list" aria-label={en ? 'Terms' : 'Términos'}>
          <p className="an-explore-count an-num">{list.length} {en ? 'terms' : 'términos'}</p>
          <ol ref={listRef}>
            {list.map((e, i) => {
              const head = unit === 'all' && (i === 0 || list[i - 1].unit.slug !== e.unit.slug)
              return (
                <li key={e.item.id}>
                  {head && <p className="an-explore-unit">{String(e.unit.n).padStart(2, '0')} · {en ? e.unit.titleEn : e.unit.title}</p>}
                  <button type="button" className={`an-explore-row${current?.item.id === e.item.id ? ' is-on' : ''}`}
                    aria-current={current?.item.id === e.item.id ? 'true' : undefined} onClick={() => select(e.item.id)}>
                    <span className="an-explore-name" lang={lang}>{name(e.item)}</span>
                    <span className="an-explore-desc" lang={lang}>{describe(e)}</span>
                    <span className="an-explore-page an-num">p. {e.item.page}</span>
                  </button>
                </li>
              )
            })}
            {!list.length && <li className="an-muted an-explore-empty">{en ? 'Nothing matches.' : 'Nada coincide.'}</li>}
          </ol>
        </nav>

        {current ? <Detail key={current.item.id} entry={current} lang={lang} onSelect={(id) => select(id, true)}
          onBack={() => setShowDetail(false)} /> : <section className="an-explore-detail" />}
      </div>
    </main>
  )
}

function Detail({ entry, lang, onSelect, onBack }: { entry: Entry; lang: Lang; onSelect: (id: string) => void; onBack: () => void }) {
  const en = lang === 'en'
  const { item, unit } = entry
  const tx = textOf(item, lang)
  const other = textOf(item, en ? 'es' : 'en')
  const model = item.model ?? 'skull'

  // Everything else the notes say about the same structure, and terms that
  // point at it from elsewhere (landmarks on this bone, what this nerve supplies…).
  const same = ALL.filter((e) => e.item.id !== item.id && (
    (item.mesh && (e.item.model ?? 'skull') === model && e.item.mesh === item.mesh) ||
    (item.diagram && e.item.diagram === item.diagram && e.item.part === item.part))).sort(byPage)
  const parts = (item.mesh ?? item.part ?? '').split('+')
  const related = ALL.filter((e) => e.item.id !== item.id && !same.includes(e) && (
    (item.mesh && (e.item.model ?? 'skull') === model && e.item.mesh?.split('+').some((m) => parts.includes(m))) ||
    (item.diagram && e.item.diagram === item.diagram && e.item.part?.split('+').some((p) => parts.includes(p))))).sort(byPage)

  const nameOfNode = (node: string) => { const hit = itemsOnMesh(model, node)[0]; return hit ? textOf(hit.item, lang).answer : null }
  const nameOfParts = (ps: string[]) => { const hit = item.diagram ? itemsOnPart(item.diagram, ps)[0] : null; return hit ? textOf(hit.item, lang).answer : null }

  return (
    <section className="an-explore-detail" aria-live="polite">
      <button type="button" className="an-ghost an-explore-back" onClick={onBack}>← {en ? 'List' : 'Lista'}</button>
      <div className="an-explore-figure">
        {item.mesh ? (
          <ExploreFigure model={model} mesh={item.mesh}
            label={en ? `3D model with ${tx.answer} in red. Drag to turn; click a structure to open it.` : `Modelo 3D con ${tx.answer} en rojo. Arrastra para girarlo; haz clic en una estructura para abrirla.`}
            nameOf={nameOfNode} onPick={(node) => { const hit = itemsOnMesh(model, node)[0]; if (hit) onSelect(hit.item.id) }} />
        ) : item.diagram ? (
          <div className="an-explore-dg">
            <DiagramView name={item.diagram} part={item.part ?? ''} nameOf={nameOfParts}
              label={en ? `Simplified diagram with ${tx.answer} in red` : `Esquema simplificado con ${tx.answer} en rojo`}
              onPick={(ps) => { const hit = itemsOnPart(item.diagram!, ps)[0]; if (hit) onSelect(hit.item.id) }} />
            <span className="an-figure-2d-note">{en ? 'Simplified diagram' : 'Esquema simplificado'}</span>
          </div>
        ) : null}
        <p className="an-explore-howto">{item.mesh
          ? (en ? 'Drag to turn · hover to name · click to open' : 'Arrastra para girar · pasa el cursor para ver el nombre · haz clic para abrir')
          : (en ? 'Hover to name · click a part to open it' : 'Pasa el cursor para ver el nombre · haz clic en una parte para abrirla')}</p>
      </div>

      <div className="an-explore-info">
        <p className="an-unit-name">{String(unit.n).padStart(2, '0')} · {en ? unit.titleEn : unit.title} · <span className="an-num">p. {item.page}</span></p>
        <h2 className="an-explore-term an-display" lang={lang}>{tx.answer}</h2>
        <p className="an-explore-alt">
          <span lang={en ? 'es' : 'en'}>{en ? 'ES' : 'EN'} · {other.answer}</span>
          {tx.accept.length > 0 && <span lang={lang}> · {en ? 'also' : 'también'}: {tx.accept.join(', ')}</span>}
        </p>
        <p className="an-explore-what" lang={lang}>{tx.prompt || (CLUE_FOR.get(keyOf(item)) ? textOf(CLUE_FOR.get(keyOf(item))!, lang).prompt
          : en ? 'Shown on the model in red.' : 'Señalada en rojo en el modelo.')}</p>
        {item.hint && <p className="an-explore-hint">{HINT_TEXT[item.hint]?.[lang]}</p>}

        {same.length > 0 && (
          <>
            <h3 className="an-explore-h">{en ? 'Also in your notes' : 'También en tus apuntes'}</h3>
            <ul className="an-explore-links">
              {same.map((e) => (
                <li key={e.item.id}><button type="button" onClick={() => onSelect(e.item.id)}>
                  <span lang={lang}>{textOf(e.item, lang).prompt || (en ? 'Structure in red' : 'Estructura en rojo')}</span>
                  <span className="an-num an-muted">p. {e.item.page}</span>
                </button></li>
              ))}
            </ul>
          </>
        )}
        {related.length > 0 && (
          <>
            <h3 className="an-explore-h">{en ? 'Related on this figure' : 'Relacionado en esta figura'}</h3>
            <ul className="an-explore-links">
              {related.map((e) => (
                <li key={e.item.id}><button type="button" onClick={() => onSelect(e.item.id)}>
                  <span><strong lang={lang}>{textOf(e.item, lang).answer}</strong>{' '}
                    <span className="an-muted" lang={lang}>{textOf(e.item, lang).prompt}</span></span>
                  <span className="an-num an-muted">p. {e.item.page}</span>
                </button></li>
              ))}
            </ul>
          </>
        )}
        <PlateLinks items={[item]} lang={lang} />
      </div>
    </section>
  )
}
