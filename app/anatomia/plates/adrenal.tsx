'use client'

import type { Lang } from '../engine'
import Plate, { type PlateDef } from './plate'

// Plate: zones of the adrenal cortex. Every statement is from the notes
// (pp. 89, 101, 103); the order of the layers and the medulla at the centre
// are checked against OpenStax Anatomy & Physiology 2e, §17.6 "The Adrenal
// Glands". The section is a simplified drawing: bands are equal on purpose,
// because no source here gives their relative thickness.

export const ADRENAL: PlateDef = {
  kicker: { es: 'Lámina · Abdomen · p. 103', en: 'Plate · Abdomen · p. 103' },
  title: { es: 'Corteza suprarrenal: qué capa produce qué', en: 'Adrenal cortex: which layer makes what' },
  disclaimer: { es: 'Esquema simplificado, no a escala. Las capas se dibujan iguales a propósito.', en: 'Simplified drawing, not to scale. The layers are drawn equal on purpose.' },
  sources: {
    es: 'Fuente: tus apuntes, pp. 89, 101 y 103. Orden de las capas y médula central: OpenStax, Anatomy & Physiology 2e, §17.6 (CC BY 4.0). Modelo 3D: BodyParts3D (CC BY-SA 2.1 JP).',
    en: 'Source: your notes, pp. 89, 101 and 103. Order of the layers and central medulla: OpenStax, Anatomy & Physiology 2e, §17.6 (CC BY 4.0). 3D model: BodyParts3D (CC BY-SA 2.1 JP).',
  },
  steps: [
    { id: 'locate', label: { es: 'Ubicación', en: 'Where' },
      caption: { es: 'Las glándulas suprarrenales están encima de los riñones, en posición retroperitoneal (p. 89), dentro de la fascia renal de Gerota (p. 101).',
        en: 'The adrenal glands sit on top of the kidneys, retroperitoneal (p. 89), inside Gerota’s renal fascia (p. 101).' } },
    { id: 'section', label: { es: 'Corte', en: 'Section' },
      caption: { es: 'En un corte se ven la corteza, por fuera y en tres capas, y la médula, en el centro.',
        en: 'A section shows the cortex, outside and in three layers, and the medulla at the centre.' } },
    { id: 'glomerular', label: { es: 'Zona glomerular', en: 'Zona glomerulosa' },
      caption: { es: 'La capa más externa, la zona glomerular, produce aldosterona: una hormona mineralocorticoide (p. 103).',
        en: 'The outermost layer, the zona glomerulosa, makes aldosterone: a mineralocorticoid hormone (p. 103).' } },
    { id: 'fascicular', label: { es: 'Zona fascicular', en: 'Zona fasciculata' },
      caption: { es: 'La capa intermedia, la zona fascicular, produce cortisol: una hormona glucocorticoide (p. 103).',
        en: 'The middle layer, the zona fasciculata, makes cortisol: a glucocorticoid hormone (p. 103).' } },
    { id: 'reticular', label: { es: 'Zona reticular', en: 'Zona reticularis' },
      caption: { es: 'La capa más profunda de la corteza, la zona reticular, produce andrógenos (p. 103).',
        en: 'The deepest layer of the cortex, the zona reticularis, makes androgens (p. 103).' } },
  ],
}

// --- the section drawing ---
const C = { x: 300, y: 240 } // centre the bands are scaled about
// A rounded cap: apex up, base dipping where it sits on the kidney.
const SHAPE: [number, number][] = [[300, 62], [436, 196], [522, 334], [300, 300], [78, 334], [164, 196]]
const at = (p: [number, number], s: number): [number, number] => [C.x + (p[0] - C.x) * s, C.y + (p[1] - C.y) * s]
function cap(s: number) {
  const pts = SHAPE.map((p) => at(p, s))
  const mid = (a: [number, number], b: [number, number]) => `${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2}`
  let d = `M${mid(pts[pts.length - 1], pts[0])}`
  pts.forEach((p, i) => { d += ` Q${p[0]},${p[1]} ${mid(p, pts[(i + 1) % pts.length])}` })
  return d + 'Z'
}

// Outside in: three cortex bands, then the medulla.
const LAYERS = [
  { id: 'glomerular', n: '1', s: 1, mid: 0.9, tone: 0.34, label: { es: 'Zona glomerular', en: 'Zona glomerulosa' }, made: { es: 'aldosterona', en: 'aldosterone' }, y: 96 },
  { id: 'fascicular', n: '2', s: 0.8, mid: 0.71, tone: 0.24, label: { es: 'Zona fascicular', en: 'Zona fasciculata' }, made: { es: 'cortisol', en: 'cortisol' }, y: 160 },
  { id: 'reticular', n: '3', s: 0.62, mid: 0.53, tone: 0.16, label: { es: 'Zona reticular', en: 'Zona reticularis' }, made: { es: 'andrógenos', en: 'androgens' }, y: 224 },
  { id: 'medula', n: 'M', s: 0.44, mid: 0.2, tone: 0.08, label: { es: 'Médula', en: 'Medulla' }, made: null, y: 288 },
] as const

function Section({ lang, focus, overview, goTo }: { lang: Lang; focus: string | null; overview: boolean; goTo: (i: number) => void }) {
  const en = lang === 'en'
  const stepOf = (id: string) => ADRENAL.steps.findIndex((s) => s.id === id)
  const desc = focus
    ? `${en ? 'Section of the adrenal gland with' : 'Corte de la glándula suprarrenal con'} ${LAYERS.find((l) => l.id === focus)?.label[lang]} ${en ? 'in red' : 'en rojo'}.`
    : en ? 'Section of the adrenal gland: three cortex layers around the medulla.' : 'Corte de la glándula suprarrenal: tres capas de corteza alrededor de la médula.'
  return (
    <div className={`an-adrenal${focus ? ' has-focus' : ''}`}>
      <svg viewBox="0 0 600 400" role="img" aria-label={desc}>
        <defs>
          <radialGradient id="an-adr-light" cx="38%" cy="28%" r="80%">
            <stop offset="0" stopColor="#fff" stopOpacity=".22" />
            <stop offset=".6" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".25" />
          </radialGradient>
          <linearGradient id="an-adr-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ef4b54" />
            <stop offset="1" stopColor="#b3242d" />
          </linearGradient>
          <filter id="an-adr-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity=".55" />
          </filter>
        </defs>
        {/* top of the kidney the gland sits on */}
        <path className="an-adr-kidney" d="M40 400 C60 318 180 292 300 292 C420 292 540 318 560 400" />
        <g filter="url(#an-adr-shadow)">
          {/* Each zone is a ring (its outline minus the next one in), so a
              highlighted zone never shows through the ones inside it. */}
          {LAYERS.map((l, i) => (
            <path key={l.id} d={cap(l.s) + (LAYERS[i + 1] ? ' ' + cap(LAYERS[i + 1].s) : '')} fillRule="evenodd"
              className={`an-adr-layer${focus === l.id ? ' is-focus' : ''}`} style={{ ['--tone' as string]: l.tone }} />
          ))}
          <path d={cap(1)} fill="url(#an-adr-light)" pointerEvents="none" />
        </g>
        {LAYERS.map((l) => {
          // Numbers stack on the vertical axis, where the bands are widest;
          // leaders start from the right flank of each band.
          // The rounded apex peaks 144.5 above the centre at full size.
          const nx = C.x, ny = C.y - 144.5 * l.mid
          const [px, py] = at([436, 196], l.mid)
          const med = l.id === 'medula'
          return (
            <g key={l.id} className={`an-adr-mark${focus === l.id ? ' is-focus' : ''}`}>
              <text x={nx} y={(med ? C.y + 18 : ny) + 4} textAnchor="middle">{l.n}</text>
              <polyline className="an-adr-leader" points={`${med ? C.x + 40 : px},${med ? C.y + 22 : py} 548,${l.y} 600,${l.y}`} />
            </g>
          )
        })}
      </svg>
      <ul className="an-adr-labels">
        {LAYERS.map((l) => {
          const step = stepOf(l.id)
          const showMade = l.made && (overview || focus === l.id)
          const body = (
            <>
              <span className="an-num an-adr-n">{l.n}</span>
              <span className="an-adr-name">{l.label[lang]}</span>
              {showMade && <span className="an-adr-made">{l.made![lang]}</span>}
            </>
          )
          return (
            <li key={l.id} style={{ top: `${(l.y / 400) * 100}%` }} className={focus === l.id ? 'is-focus' : ''}>
              {step >= 0 ? <button type="button" onClick={() => goTo(step)}>{body}</button> : <span className="an-adr-static">{body}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function AdrenalPlate({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <Plate def={ADRENAL} lang={lang} onClose={onClose} visual={(step, goTo) => {
      const id = step === null ? null : ADRENAL.steps[step].id
      return (
        <div className="an-plate-stack">
          <figure className={`an-plate-layer${id === 'locate' ? ' is-on' : ''}`} aria-hidden={id !== 'locate'}>
            <img src="/anatomia/plates/suprarrenal-locator.webp" width={800} height={500}
              alt={lang === 'en' ? 'Both kidneys with the adrenal glands in red on top of them, aorta and inferior vena cava between them.'
                : 'Los dos riñones con las glándulas suprarrenales en rojo encima, y la aorta y la cava inferior entre ellos.'} />
          </figure>
          <div className={`an-plate-layer${id !== 'locate' ? ' is-on' : ''}`} aria-hidden={id === 'locate'}>
            <Section lang={lang} overview={id === null} focus={id && id !== 'locate' && id !== 'section' ? id : null} goTo={goTo} />
          </div>
        </div>
      )
    }} />
  )
}
