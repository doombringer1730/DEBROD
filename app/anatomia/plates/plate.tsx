'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../engine'

// A plate: a short explanation in steps, opened from learn mode or results.
// The overview (no step) shows everything at once, as a static figure with
// the full text; "Play explanation" walks through it one step at a time.

export type L = { es: string; en: string }
export type PlateStep = { id: string; label: L; caption: L }
export type PlateDef = {
  title: L
  kicker: L // small line above the title
  disclaimer: L // e.g. "simplified, not to scale"
  sources: L
  steps: PlateStep[]
}

const STEP_MS = 5000

export default function Plate({ def, lang, onClose, visual }: {
  def: PlateDef
  lang: Lang
  onClose: () => void
  /** The figure for a step index, or null for the overview. */
  visual: (step: number | null, goTo: (i: number) => void) => ReactNode
}) {
  const t = (l: L) => l[lang]
  const en = lang === 'en'
  const [step, setStep] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const last = def.steps.length - 1

  const goTo = (i: number) => { setPlaying(false); setStep(Math.max(0, Math.min(last, i))) }
  const play = () => { if (step === null || step === last) setStep(0); setPlaying(true) }

  // Focus the plate on open and give it back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    heading.current?.focus()
    return () => before?.focus?.()
  }, [])

  // Auto-advance while playing; stop at the end and whenever the tab is hidden.
  useEffect(() => {
    if (!playing || step === null) return
    if (step >= last) { setPlaying(false); return }
    const id = window.setTimeout(() => setStep((s) => (s === null ? 0 : s + 1)), STEP_MS)
    return () => window.clearTimeout(id)
  }, [playing, step, last])
  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Keys: Esc closes, arrows step, Tab stays inside the plate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') { e.preventDefault(); return onClose() }
      if (e.key === 'ArrowRight') { e.preventDefault(); return goTo(step === null ? 0 : step + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); return step === null ? undefined : goTo(step - 1) }
      if (e.key === 'Tab' && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled)')]
        if (!f.length) return
        const first = f[0], end = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus() }
        else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const current = step === null ? null : def.steps[step]
  return (
    <div className="an-plate-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="an-plate" role="dialog" aria-modal="true" aria-labelledby="an-plate-title" ref={panel} lang={lang}>
        <header className="an-plate-head">
          <div>
            <p className="an-unit-name">{t(def.kicker)}</p>
            <h2 className="an-plate-title" id="an-plate-title" tabIndex={-1} ref={heading}>{t(def.title)}</h2>
          </div>
          <button type="button" className="an-ghost" onClick={onClose}>{en ? 'Close · Esc' : 'Cerrar · Esc'}</button>
        </header>

        <div className="an-plate-figure">{visual(step, goTo)}</div>
        <p className="an-plate-disclaimer">{t(def.disclaimer)}</p>

        <nav className="an-plate-steps" aria-label={en ? 'Steps' : 'Pasos'}>
          {def.steps.map((s, i) => (
            <button key={s.id} type="button" className={`an-plate-step${step === i ? ' is-on' : ''}${step !== null && i < step ? ' is-past' : ''}`}
              aria-current={step === i ? 'step' : undefined} onClick={() => goTo(i)}>
              <span className="an-num">{i + 1}</span>{t(s.label)}
            </button>
          ))}
        </nav>

        <div className="an-plate-text" aria-live="polite">
          {current ? (
            <p className="an-plate-caption" key={current.id}>{t(current.caption)}</p>
          ) : (
            <ol className="an-plate-all">
              {def.steps.map((s) => <li key={s.id}><strong>{t(s.label)}.</strong> {t(s.caption)}</li>)}
            </ol>
          )}
        </div>

        <div className="an-plate-controls">
          {step === null ? (
            <button type="button" className="an-btn is-primary" onClick={play}>▶ {en ? 'Play explanation' : 'Ver explicación'}</button>
          ) : (
            <>
              <button type="button" className="an-btn" onClick={() => goTo(step - 1)} disabled={step === 0} aria-label={en ? 'Previous step' : 'Paso anterior'}>←</button>
              {playing
                ? <button type="button" className="an-btn" onClick={() => setPlaying(false)}>❚❚ {en ? 'Pause' : 'Pausa'}</button>
                : <button type="button" className="an-btn" onClick={play}>{step === last ? `↺ ${en ? 'Replay' : 'Repetir'}` : `▶ ${en ? 'Play' : 'Seguir'}`}</button>}
              <button type="button" className="an-btn is-primary" onClick={() => goTo(step + 1)} disabled={step === last} aria-label={en ? 'Next step' : 'Paso siguiente'}>→</button>
              <span className="an-plate-count an-num">{step + 1} / {def.steps.length}</span>
              <button type="button" className="an-ghost" onClick={() => { setPlaying(false); setStep(null) }}>{en ? 'Overview' : 'Vista completa'}</button>
            </>
          )}
        </div>
        {playing && <div className="an-plate-timer" key={step} aria-hidden="true" />}

        <p className="an-plate-sources">{t(def.sources)}</p>
      </div>
    </div>
  )
}
