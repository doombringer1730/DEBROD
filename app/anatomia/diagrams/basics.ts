import { C, E, P, R, mirror, ring, type Diagram, type Shape } from './kit.ts'

// Fundamentals: planes, terms, movements, tissues. Conceptual drawings.

/** A plain figure standing in anatomical position, centred on x. */
function figure(x = 300, y = 0, p = 'figura'): Shape[] {
  const half: Shape[] = [
    P('s', `M${x} ${y + 92}H${x - 52}Q${x - 66} ${y + 96} ${x - 66} ${y + 116}L${x - 60} ${y + 236}H${x}Z`, p),
    P('s', `M${x - 70} ${y + 104}Q${x - 84} ${y + 110} ${x - 86} ${y + 130}L${x - 96} ${y + 250}H${x - 80}L${x - 66} ${y + 130}Z`, `${p} brazo_f`),
    P('s', `M${x - 96} ${y + 250}H${x - 78}L${x - 76} ${y + 290}H${x - 98}Z`, `${p} mano_f`),
    P('s', `M${x - 58} ${y + 236}H${x - 4}L${x - 10} ${y + 400}H${x - 44}Z`, `${p} pierna_f`),
    P('s', `M${x - 44} ${y + 400}H${x - 10}V${y + 414}H${x - 54}Z`, `${p} pie_f`),
  ]
  return [C('s', x, y + 52, 32, p), R('s', x - 12, y + 80, 24, 16, p), ...half, ...mirror(x, half)]
}

const planos: Diagram = {
  title: { es: 'Planos anatómicos', en: 'Anatomical planes' },
  view: [600, 440],
  shapes: [
    ...figure(300, 10),
    P('pl', 'M282 20L330 0V420L282 440Z', 'sagital'),
    P('pl', 'M168 60L190 44H470L448 60ZM168 60H448V428H168Z', 'coronal'),
    P('pl', 'M190 250H430L470 220H230Z', 'transversal'),
  ],
}

/** Terms of position: sides, near and far, wall and organ. */
const terminos: Diagram = {
  title: { es: 'Términos de posición', en: 'Terms of position' },
  view: [600, 440],
  shapes: [
    ...figure(210, 10),
    P('l', 'M210 10V430', 'linea_media', 1.5),
    { ...C('s', 123, 290, 11, 'ipsilateral'), x: 1 }, { ...C('s', 186, 418, 11, 'ipsilateral'), x: 1 },
    { ...C('s', 297, 290, 11, 'contralateral'), x: 1 }, { ...C('s', 186, 418, 11, 'contralateral'), x: 1 },
    { ...P('c', 'M140 114L130 190', 'proximal', 8), x: 1 },
    { ...P('c', 'M118 220L112 290', 'distal', 8), x: 1 },
    // a body cavity: wall (parietal) and organ (visceral)
    P('s', ring(470, 300, 104, 94, 94, 84), 'parietal_t'),
    E('o', 470, 300, 94, 84),
    E('s', 470, 304, 50, 40, 'organo_t'),
    P('s', ring(470, 304, 56, 46, 50, 40), 'visceral_t'),
  ],
}

/** Movements, one small panel each; the arrow shows the direction. */
const arrow = (d: string, p: string): Shape => ({ k: 'a', d, p, w: 4 })
const movimientos: Diagram = {
  title: { es: 'Movimientos', en: 'Movements' },
  view: [600, 420],
  shapes: [
    // flexion and extension at the elbow
    R('s', 40, 30, 22, 110, 'brazo_m', 10), P('s', 'M51 134L140 70L152 86L62 150Z', 'antebrazo_m'),
    arrow('M150 120Q120 72 84 60', 'flexion'), arrow('M120 150Q170 150 180 110', 'extension'),
    // abduction and adduction at the shoulder
    C('s', 300, 40, 18), R('s', 280, 60, 40, 90, undefined, 8), P('s', 'M320 66L390 120L380 132L316 90Z', 'brazo_m'),
    arrow('M360 150Q400 120 396 80', 'abduccion'), arrow('M412 112Q404 150 350 160', 'aduccion'),
    // pronation and supination: forearm seen end-on
    C('s', 500, 90, 34, 'antebrazo_m'), R('s', 470, 84, 60, 12, 'palma', 4),
    arrow('M530 46A48 48 0 0 1 548 120', 'pronacion'), arrow('M470 134A48 48 0 0 1 452 60', 'supinacion'),
    // inversion and eversion: foot from behind
    R('s', 86, 230, 30, 90, 'pierna_m', 10), P('s', 'M70 330H134L126 352H78Z', 'pie_m'),
    arrow('M64 380Q100 400 128 374', 'inversion'), arrow('M150 330Q160 290 140 266', 'eversion'),
    // opposition: thumb to little finger
    P('s', 'M260 260H340V340H260Z', 'mano_m'),
    ...[268, 288, 308, 328].map((x): Shape => R('s', x - 6, 214, 12, 46, 'dedo_m', 6)),
    P('s', 'M260 300L226 270L236 260L268 288Z', 'pulgar_m'),
    arrow('M226 250Q270 190 330 206', 'oposicion'),
    // protrusion of the mandible
    P('s', 'M450 230Q520 220 540 260L520 300Q470 300 450 280Z', 'craneo_m'),
    P('s', 'M460 300Q510 304 520 330L470 340Q456 320 460 300Z', 'mandibula_m'),
    arrow('M490 360H560', 'protrusion'),
  ],
}

/** Skeleton: axial and appendicular. */
const bone = (d: string, p: string) => P('s', d, p)
const esqueleto: Diagram = {
  title: { es: 'Esqueleto axial y apendicular', en: 'Axial and appendicular skeleton' },
  view: [600, 440],
  shapes: [
    E('s', 300, 44, 32, 36, 'axial'),
    R('s', 293, 82, 14, 210, 'axial', 6),
    P('s', ring(300, 150, 64, 56, 50, 44), 'axial'),
    R('s', 296, 104, 8, 80, 'axial', 3),
    bone('M230 96H296V106H230Z', 'apendicular'), bone('M304 96H370V106H304Z', 'apendicular'),
    ...[[222, 110, 214, 220], [214, 222, 200, 320], [378, 110, 386, 220], [386, 222, 400, 320]].map(([x1, y1, x2, y2]): Shape =>
      P('c', `M${x1} ${y1}L${x2} ${y2}`, 'apendicular', 10)),
    P('s', 'M250 290Q300 270 350 290L340 326H260Z', 'apendicular'),
    P('c', 'M270 326L262 420M330 326L338 420', 'apendicular', 12),
  ],
}

/** Levels of organisation. */
const cellAt = (x: number, y: number, p: string, r = 14): Shape[] => [C('s', x, y, r, p), C('b', x, y, r / 3, p)]
const organizacion: Diagram = {
  title: { es: 'Niveles de organización', en: 'Levels of organisation' },
  view: [600, 400],
  shapes: [
    ...cellAt(60, 90, 'celula', 22),
    ...[[150, 76], [178, 76], [206, 76], [150, 104], [178, 104], [206, 104]].flatMap(([x, y]) => cellAt(x, y, 'tejido')),
    E('s', 330, 90, 56, 40, 'organo'), E('o', 330, 90, 30, 18),
    // system: organs made of the same kind of tissue
    ...[[110, 270], [190, 290], [150, 340]].flatMap(([x, y]): Shape[] => [E('s', x, y, 34, 24, 'sistema'), P('l', `M${x - 24} ${y}H${x + 24}M${x} ${y - 16}V${y + 16}`, 'sistema', 2)]),
    // apparatus: organs made of different tissues
    E('s', 400, 270, 34, 24, 'aparato'), P('l', 'M376 270H424', 'aparato', 2),
    R('s', 456, 266, 60, 40, 'aparato', 10), C('b', 486, 286, 8, 'aparato'),
    P('s', 'M420 320L470 360L380 360Z', 'aparato'),
  ],
}

/** Basic tissues, one panel each. */
const panel = (x: number, y: number): Shape => R('b', x, y, 130, 110, undefined, 10)
const tejidos: Diagram = {
  title: { es: 'Tejidos', en: 'Tissues' },
  view: [600, 420],
  shapes: [
    panel(10, 10), panel(155, 10), panel(300, 10), panel(445, 10),
    panel(10, 150), panel(155, 150), panel(300, 150), panel(445, 150),
    panel(10, 290), panel(155, 290), panel(300, 290), panel(445, 290),
    // epithelium: continuous cells on a line
    ...[0, 1, 2, 3, 4].map((i): Shape => R('s', 20 + i * 22, 50, 20, 30, 'epitelial', 3)), P('l', 'M18 82H134', 'epitelial', 2),
    // mesenchyme: loose star-shaped cells
    ...[[190, 40], [240, 50], [210, 90], [260, 92]].map(([x, y]): Shape => P('s', `M${x} ${y}l10 -14l4 14l14 -4l-12 10l10 12l-14 -6l-6 14l-4 -14l-14 4z`, 'mesenquima')),
    // connective tissue: spindle fibroblasts among fibres
    P('l', 'M310 40Q360 30 420 46M310 70Q370 60 420 80M310 100Q360 90 420 104', 'conectivo', 1.5),
    ...[[340, 54], [390, 64], [360, 92]].map(([x, y]): Shape => E('s', x, y, 16, 5, 'fibroblastos')),
    // metaplasia: tall cells become flat cells
    ...[0, 1, 2].map((i): Shape => R('s', 455 + i * 16, 40, 14, 40, 'metaplasia', 3)),
    { k: 'a', d: 'M508 60H526', p: 'metaplasia', w: 3 },
    ...[0, 1].map((i): Shape => R('s', 530 + i * 18, 64, 16, 10, 'metaplasia', 2)),
    // cartilage: hyaline, fibrocartilage, elastic
    ...[[40, 190], [90, 200], [60, 230], [110, 240]].map(([x, y]): Shape => E('o', x, y, 9, 7, 'hialino')),
    R('s', 14, 154, 122, 102, 'hialino', 8),
    ...[[40, 190], [90, 200], [60, 230], [110, 240]].map(([x, y]): Shape => C('b', x, y, 4, 'hialino')),
    P('l', 'M160 180H280M160 205H280M160 230H280', 'fibrocartilago', 4),
    ...[[190, 192], [230, 192], [210, 218], [250, 218]].map(([x, y]): Shape => C('s', x, y, 5, 'fibrocartilago')),
    P('l', 'M305 170Q340 200 330 250M330 160Q370 210 360 250M360 165Q400 190 420 240M310 210Q370 220 420 200', 'elastico', 2),
    ...[[340, 190], [380, 230], [320, 230]].map(([x, y]): Shape => C('s', x, y, 6, 'elastico')),
    // smooth and skeletal muscle
    ...[0, 1, 2].map((i): Shape => E('s', 510, 180 + i * 28, 52, 9, i === 1 ? 'liso miocito' : 'liso')),
    ...[0, 1, 2].map((i): Shape => C('b', 510, 180 + i * 28, 3, 'liso')),
    ...[0, 1].map((i): Shape => R('s', 20, 304 + i * 40, 110, 30, 'esqueletico', 8)),
    P('l', 'M30 304V334M44 304V334M58 304V334M72 304V334M86 304V334M100 304V334M114 304V334M30 344V374M44 344V374M58 344V374M72 344V374M86 344V374M100 344V374M114 344V374', 'esqueletico', 1),
    // neuron and glia
    C('s', 210, 340, 14, 'neurona'),
    P('c', 'M196 330L170 306M200 352L172 376M224 340H282', 'neurona', 3),
    ...[[176, 330], [240, 372], [262, 316]].map(([x, y]): Shape => C('s', x, y, 7, 'glia')),
    // cardiac muscle, for comparison
    ...[0, 1].map((i): Shape => R('s', 310, 306 + i * 40, 110, 28, 'cardiaco', 6)),
    P('l', 'M350 306V334M380 346V374', 'cardiaco', 3),
    // blood cells
    ...[[480, 320], [510, 340], [540, 316], [500, 372], [552, 366]].map(([x, y]): Shape => P('s', ring(x, y, 14, 14, 5, 5), 'sangre')),
  ],
}

/** Long bone in longitudinal section. */
const hueso: Diagram = {
  title: { es: 'Hueso largo', en: 'Long bone' },
  view: [600, 420],
  shapes: [
    P('s', 'M220 20Q300 0 380 20Q400 60 360 100V320Q400 360 380 400Q300 420 220 400Q200 360 240 320V100Q200 60 220 20Z', 'cortical'),
    P('s', 'M228 30Q300 12 372 30Q384 60 350 96H250Q216 60 228 30Z', 'esponjoso epifisis medula_roja'),
    P('s', 'M250 324H350Q384 360 372 390Q300 406 228 390Q216 360 250 324Z', 'esponjoso epifisis medula_roja'),
    P('l', 'M240 40L300 80L360 40M250 60L330 90M244 340L310 380L364 350M260 360L340 340', 'esponjoso', 1.5),
    P('o', 'M262 104H338V316H262Z', 'cavidad_medular'),
    P('c', 'M222 16Q300 -4 378 16', 'cartilago_art', 5), P('c', 'M222 404Q300 424 378 404', 'cartilago_art', 5),
    P('c', 'M236 100V320M364 100V320', 'periostio', 3),
    P('c', 'M140 200Q200 196 240 206L282 212', 'nutricia', 4),
    { ...R('pl', 236, 100, 128, 220, 'diafisis'), x: 1 },
  ],
}

/** Joints: by tissue, and the shapes of synovial joints. */
const joint = (x: number, y: number, kind: string, p: string): Shape[] => {
  const a = R('s', x, y, 60, 30, p, 8), b = R('s', x, y + 52, 60, 30, p, 8)
  if (kind === 'fibrosa') return [a, b, P('l', `M${x} ${y + 41}l10 -8l10 8l10 -8l10 8l10 -8l10 8`, p, 3)]
  if (kind === 'cartilaginosa') return [a, b, R('s', x + 4, y + 32, 52, 18, p, 6)]
  return [a, b, P('l', `M${x - 6} ${y + 20}Q${x - 14} ${y + 41} ${x - 6} ${y + 62}M${x + 66} ${y + 20}Q${x + 74} ${y + 41} ${x + 66} ${y + 62}`, p, 3), R('o', x + 4, y + 34, 52, 14, p, 6)]
}
const articulaciones: Diagram = {
  title: { es: 'Articulaciones', en: 'Joints' },
  view: [600, 400],
  shapes: [
    ...joint(40, 30, 'fibrosa', 'sinartrosis'),
    ...joint(170, 30, 'cartilaginosa', 'anfiartrosis'),
    ...joint(300, 30, 'sinovial', 'diartrosis'),
    // synchondrosis: a plate of hyaline cartilage joined straight to bone
    R('s', 430, 30, 130, 30, 'sincondrosis', 8), R('s', 430, 62, 130, 12, 'sincondrosis', 2), R('s', 430, 76, 130, 30, 'sincondrosis', 8),
    // synovial shapes
    R('s', 40, 220, 80, 26, 'troclear', 13), P('s', 'M30 250Q80 290 130 250V270Q80 310 30 270Z', 'troclear'),
    C('s', 230, 250, 18, 'trocoide'), P('s', ring(230, 250, 34, 34, 22, 22), 'trocoide'),
    C('s', 370, 236, 26, 'enartrosis'), P('s', 'M330 250Q370 300 410 250V268Q370 320 330 268Z', 'enartrosis'),
    R('s', 470, 220, 90, 22, 'artrodia', 4), R('s', 480, 246, 90, 22, 'artrodia', 4),
    P('s', 'M40 340Q80 320 120 340V360Q80 340 40 360Z', 'silla'), P('s', 'M60 326Q80 370 100 326V310H60Z', 'silla'),
    E('s', 210, 330, 16, 12, 'bicondilea'), E('s', 250, 330, 16, 12, 'bicondilea'), R('s', 190, 346, 80, 18, 'bicondilea', 6),
  ],
}

/** Muscle, tendon, ligament and their coverings. */
const denso: Diagram = {
  title: { es: 'Músculo, tendón y ligamento', en: 'Muscle, tendon and ligament' },
  view: [600, 400],
  shapes: [
    R('b', 60, 60, 200, 50, 'hueso_d', 16), R('b', 290, 60, 200, 50, 'hueso_d', 16),
    P('s', 'M240 66Q275 50 310 66V104Q275 120 240 104Z', 'ligamento'),
    E('s', 150, 220, 90, 38, 'musculo_d'),
P('s', ring(150, 220, 98, 46, 92, 40), 'fascia'),
    P('c', 'M236 214Q260 160 270 112', 'tendon', 7),
    E('s', 258, 140, 12, 9, 'bursa'),
    // a flat muscle with its aponeurosis
    R('s', 340, 170, 90, 80, 'musculo_plano', 8),
    P('s', 'M430 176H520V244H430Z', 'aponeurosis_f'),
    P('l', 'M440 186H510M440 210H510M440 234H510', 'aponeurosis_f', 1.5),
    // muscle shapes
    E('s', 90, 340, 50, 16, 'fusiforme'), P('c', 'M30 340H40M140 340H150', 'fusiforme', 3),
    R('s', 200, 326, 100, 28, 'paralelo', 6),
    P('s', 'M340 340L420 320L420 360Z', 'convergente'),
    P('s', ring(510, 340, 40, 30, 24, 16), 'circular_m'),
  ],
}

/** Blood vessel wall and a capillary bed. */
const vasos: Diagram = {
  title: { es: 'Vasos sanguíneos', en: 'Blood vessels' },
  view: [600, 360],
  shapes: [
    P('s', ring(150, 180, 120, 120, 96, 96), 'adventicia'),
    P('s', ring(150, 180, 96, 96, 58, 58), 'media_v'),
    P('s', ring(150, 180, 58, 58, 50, 50), 'intima'),
    C('o', 150, 180, 50),
    P('c', 'M320 120H400', 'arteriola', 10), P('c', 'M320 260H400', 'venula', 14),
    P('c', 'M400 120Q440 120 450 150Q460 190 440 220Q430 250 400 260M400 120Q480 110 500 160Q520 210 480 250Q450 262 400 260M400 120Q520 90 560 150Q580 210 540 250Q500 270 400 260', 'capilares', 2.5),
  ],
}

export const BASICS = { planos, terminos, movimientos, esqueleto, organizacion, tejidos, hueso_largo: hueso, articulaciones, tejido_denso: denso, vasos }
