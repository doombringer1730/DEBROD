'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { Item, Lang } from '../engine'

// Plates (step-by-step explanations) and the items they explain. Each plate
// loads only when opened.
type Entry = { title: { es: string; en: string }; items: string[]; View: React.ComponentType<{ lang: Lang; onClose: () => void }> }

const PLATES: Record<string, Entry> = {
  suprarrenal: {
    title: { es: 'Corteza suprarrenal', en: 'Adrenal cortex' },
    items: ['abdomen-022', 'abdomen-067', 'abdomen-071', 'abdomen-072', 'abdomen-073', 'abdomen-091'],
    View: dynamic(() => import('./adrenal'), { ssr: false }),
  },
}

/** Plates that explain any of these items, in a stable order. */
export function platesFor(items: Item[]): string[] {
  const ids = new Set(items.map((i) => i.id))
  return Object.keys(PLATES).filter((k) => PLATES[k].items.some((id) => ids.has(id)))
}

/** "Ver lámina" buttons for the plates that explain these items, and the open plate. */
export function PlateLinks({ items, lang, onOpenChange }: { items: Item[]; lang: Lang; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const ids = platesFor(items)
  if (!ids.length) return null
  const show = (id: string | null) => { setOpen(id); onOpenChange?.(id !== null) }
  const Open = open ? PLATES[open].View : null
  return (
    <div className="an-plate-links">
      {ids.map((id) => (
        <button key={id} type="button" className="an-plate-link" onClick={() => show(id)}>
          <span className="an-plate-link-k">{lang === 'en' ? 'Plate' : 'Lámina'}</span>
          {PLATES[id].title[lang]}
          <span aria-hidden="true">→</span>
        </button>
      ))}
      {Open && <Open lang={lang} onClose={() => show(null)} />}
    </div>
  )
}
