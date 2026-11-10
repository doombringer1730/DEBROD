import { C, E, P, R, mirror, ring, type Diagram, type Shape } from './kit.ts'

// Trunk, pelvis, nerves of the limbs. All schematic.

/** Somatic versus autonomic pathways, and where each autonomic division leaves the CNS. */
const autonomo: Diagram = {
  title: { es: 'Sistema nervioso periférico', en: 'Peripheral nervous system' },
  view: [600, 400],
  shapes: [
    R('s', 92, 14, 56, 30, 'craneal parasimpatico tronco_e', 10),
    R('s', 106, 44, 28, 340, 'medula_a', 12),
    P('l', 'M100 112H140M100 232H140M100 300H140', 'segmentos', 1),
    R('s', 142, 112, 14, 140, 'simpatico', 4),
    ...[124, 152, 180, 208, 236].map((y): Shape => C('s', 176, y, 7, 'simpatico')),
    P('c', 'M176 118V244', 'simpatico', 2),
    R('s', 142, 312, 14, 46, 'parasimpatico sacro_a', 4),
    P('c', 'M148 30Q230 120 300 210', 'vago_a parasimpatico', 3),
    // somatic: one neuron to skeletal muscle
    C('s', 250, 86, 10, 'somatico'),
    P('c', 'M260 86H500', 'somatico', 3),
    R('s', 500, 66, 74, 40, 'somatico musculo_esq', 6),
    P('l', 'M514 66V106M528 66V106M542 66V106M556 66V106', 'somatico musculo_esq', 1),
    C('s', 500, 86, 5, 'ach_somatico somatico'),
    // autonomic: two neurons, a ganglion between them
    C('s', 250, 206, 10, 'autonomo'),
    P('c', 'M260 206H384', 'autonomo preganglionar', 3),
    C('s', 396, 206, 13, 'autonomo ganglio_a postganglionar'),
    P('c', 'M409 206H500', 'autonomo postganglionar', 3),
    E('s', 532, 206, 34, 22, 'autonomo organo'),
  ],
}

/** Whole spine from the side, with a lumbar segment enlarged on the right. */
const vert: Shape[] = []
for (let i = 0; i < 24; i++) {
  const y = 40 + i * 12.5, w = 16 + i * 0.9
  vert.push(R('b', 90 - w / 2 + Math.sin(i / 3.6) * 10, y, w, 10, i < 7 ? 'cervical_v' : i < 19 ? 'toracica_v' : 'lumbar_v', 2))
}
const columna: Diagram = {
  title: { es: 'Columna y ligamentos', en: 'Spine and ligaments' },
  view: [600, 420],
  shapes: [
    P('b', 'M30 14Q60 4 110 14L104 34H40Z', 'occipital_c'),
    ...vert,
    P('b', 'M76 342H118L104 384H88Z', 'sacro_c'),
    P('s', 'M88 386H104L98 410H94Z', 'coxis'),
    P('c', 'M40 32Q20 80 78 120', 'nucal', 4),
    P('c', 'M110 40V265', 'medula_c', 5),
    P('c', 'M110 265V405', 'filum', 1.5),
    // enlarged lumbar segment
    R('b', 300, 70, 110, 90, 'cuerpo_v', 10), R('b', 300, 190, 110, 90, 'cuerpo_v', 10),
    R('s', 302, 160, 106, 30, 'disco_v', 8),
    P('c', 'M298 66V286', 'lla', 4),
    P('o', 'M412 66H452V286H412Z', 'canal_v'),
    P('c', 'M414 66V286', 'llp', 4),
    P('b', 'M452 80H500L560 110L556 140L500 132H452Z', 'lamina_v'),
    P('b', 'M452 200H500L560 230L556 260L500 252H452Z', 'lamina_v'),
    P('s', 'M462 134H496L492 198H466Z', 'amarillo'),
    P('s', 'M540 140L556 140L556 230L540 230Z', 'interespinoso'),
    P('c', 'M562 104V266', 'supraespinoso', 3),
    E('o', 430, 176, 14, 18, 'foramen_iv'),
    P('c', 'M430 176Q390 184 360 200', 'foramen_iv nervio_espinal', 4),
  ],
}

/** Brachial plexus: roots C5–T1 to the nerves of the arm (simplified). */
const plexo: Diagram = {
  title: { es: 'Plexo braquial', en: 'Brachial plexus' },
  view: [600, 360],
  shapes: [
    ...[60, 110, 160, 210, 260].map((y): Shape => R('b', 40, y - 16, 50, 30, 'vertebras_p', 6)),
    P('c', 'M90 60L220 110M90 110L220 110M90 160L220 170M90 210L220 230M90 260L220 230', 'plexo_braquial', 5),
    P('c', 'M220 110L340 120M220 110L340 180M220 170L340 180M220 230L340 180M220 230L340 240', 'plexo_braquial', 4),
    P('c', 'M340 120L560 70M340 120L560 130M340 180L560 190M340 180L560 230M340 240L560 280M340 240L560 130', 'plexo_braquial', 3),
  ],
}

/** Breast: front view with the axillary tail, and a section with ducts and ligaments. */
const mama: Diagram = {
  title: { es: 'Mama', en: 'Breast' },
  view: [600, 380],
  shapes: [
    P('s', 'M70 230Q70 140 160 130Q210 90 250 60L268 74Q236 120 226 150Q260 190 250 240Q236 320 160 322Q70 320 70 230Z', 'mama_f'),
    P('s', 'M210 116Q236 86 252 62L268 74Q246 108 232 134Z', 'spence'),
    C('s', 160, 230, 32, 'areola'), C('s', 160, 230, 9, 'pezon'),
    R('b', 540, 40, 40, 300, 'pared_t', 6),
    P('s', 'M540 60Q400 70 360 190Q350 240 380 270Q440 320 540 320Z', 'mama_s'),
    ...[[470, 110], [500, 170], [480, 240], [440, 290]].map(([x, y]): Shape => E('s', x, y, 22, 16, 'lobulos_m')),
    P('c', 'M470 110L372 196M500 170L372 200M480 240L372 204M440 290L372 208', 'galactoforos', 3),
    P('c', 'M400 110L540 100M380 160L540 150M380 250L540 260M410 300L540 310', 'cooper', 1.5),
    E('s', 366, 202, 8, 12, 'pezon'),
  ],
}

/** Heart conduction system, front view. */
const conduccion: Diagram = {
  title: { es: 'Sistema de conducción', en: 'Conduction system' },
  view: [600, 400],
  shapes: [
    P('s', 'M150 120Q150 60 230 60H370Q450 60 450 130Q470 240 300 380Q130 240 150 120Z', 'corazon_d'),
    P('l', 'M300 100V370M160 180H440', 'tabiques', 1.5),
    C('s', 190, 104, 10, 'sinusal_d'),
    P('c', 'M196 110Q240 150 286 186', 'internodal', 2),
    C('s', 290, 192, 9, 'av_d'),
    P('c', 'M292 200L300 236', 'his', 5),
    P('c', 'M300 236Q286 300 296 360M300 236Q318 300 306 360', 'ramas_his', 3),
    P('c', 'M296 340Q230 320 190 240M296 350Q240 330 210 290M306 340Q370 320 410 240M306 350Q360 330 392 290M296 360Q300 372 306 360', 'purkinje', 1.5),
  ],
}

/** Ventricles contracted (systole) and relaxed (diastole). */
const heart = (x: number, small: boolean, p: string): Shape[] => [
  P('s', small
    ? `M${x - 80} 120Q${x - 80} 70 ${x - 20} 70H${x + 20}Q${x + 80} 70 ${x + 80} 130Q${x + 90} 220 ${x} 300Q${x - 90} 220 ${x - 80} 120Z`
    : `M${x - 100} 120Q${x - 100} 60 ${x - 20} 60H${x + 20}Q${x + 100} 60 ${x + 100} 130Q${x + 110} 250 ${x} 340Q${x - 110} 250 ${x - 100} 120Z`, p),
  P('l', `M${x} 90V${small ? 290 : 330}`, p, 1.5),
]
const ciclo: Diagram = {
  title: { es: 'Ciclo cardíaco', en: 'Cardiac cycle' },
  view: [600, 380],
  shapes: [
    ...heart(160, true, 'sistole'),
    { k: 'a', d: 'M150 70V20', p: 'sistole', w: 3 }, { k: 'a', d: 'M180 70L210 24', p: 'sistole', w: 3 },
    ...heart(440, false, 'diastole'),
    { k: 'a', d: 'M380 20L400 80', p: 'diastole', w: 3 }, { k: 'a', d: 'M500 20L480 80', p: 'diastole', w: 3 },
  ],
}

/** Main lymph drainage: cisterna chyli and thoracic duct. */
const linfa: Diagram = {
  title: { es: 'Drenaje linfático', en: 'Lymph drainage' },
  view: [600, 420],
  shapes: [
    P('b', 'M180 20H420L440 400H160Z', 'tronco_l'),
    P('l', 'M170 250Q300 220 430 250', 'diafragma_l', 2),
    P('c', 'M300 30V400', 'aorta_l', 10),
    P('c', 'M240 40V110M360 40V110M240 110L190 120M360 110L410 120', 'venas_l', 6),
    E('s', 312, 300, 16, 26, 'cisterna'),
    P('c', 'M312 276Q330 200 316 150Q306 110 340 96Q356 92 360 108', 'conducto_toracico', 4),
    P('c', 'M248 108Q256 96 240 92', 'linfatico_derecho', 4),
    P('s', 'M230 350Q300 320 380 350Q400 390 300 396Q210 392 230 350Z', 'intestino_l'),
    P('c', 'M260 360Q290 340 306 322M340 362Q326 340 318 324', 'quilo', 2.5),
  ],
}

/** Anterior abdominal wall from the front, with the nine regions. */
const pared: Diagram = {
  title: { es: 'Pared abdominal anterior', en: 'Anterior abdominal wall' },
  view: [600, 420],
  shapes: [
    P('b', 'M120 30Q300 70 480 30L500 300Q460 380 300 410Q140 380 100 300Z', 'pared_a'),
    { ...P('s', 'M120 30Q190 50 236 60V130H112Z', 'hipocondrio'), x: 1 },
    { ...P('s', 'M480 30Q410 50 364 60V130H488Z', 'hipocondrio'), x: 1 },
    P('l', 'M236 40V400M364 40V400M110 130H490M104 250H496', 'regiones', 1),
    // the right side of the drawing (the person's left) shows the external oblique
    P('l', 'M380 80L470 200M400 70L480 170M420 60L486 140M380 140L440 250', 'oblicuo_externo_d', 1.5),
    // the left side is cut away to show the deeper muscles
    P('s', 'M120 140L230 110V250L130 290Z', 'oblicuo_int'),
    P('l', 'M130 280L226 160M126 240L220 132', 'oblicuo_int', 1),
    { ...P('s', 'M112 150H200V280H120Z', 'transverso'), x: 1 },
    P('s', 'M246 66Q270 72 296 74V380H254Q246 380 246 370Z', 'recto_abd'),
    P('s', 'M304 74Q330 72 354 66V370Q354 380 346 380H304Z', 'recto_abd'),
    P('l', 'M246 130H296M246 190H296M246 250H296M304 130H354M304 190H354M304 250H354', 'recto_abd', 2),
    P('c', 'M300 70V390', 'linea_alba', 3),
    P('c', 'M244 66Q232 220 254 382M356 66Q368 220 346 382', 'semilunar', 2.5),
    { ...P('c', 'M248 290Q275 280 296 292M304 292Q325 280 352 290', 'douglas', 3), x: 1 },
    P('s', 'M276 352L296 352L296 390L284 392Z', 'piramidal_a'),
    P('s', 'M324 352L304 352L304 390L316 392Z', 'piramidal_a'),
    P('c', 'M110 300L270 396M490 300L330 396', 'lig_inguinal', 3),
    P('s', 'M180 330L262 380L256 390L172 340Z', 'canal_inguinal'),
    P('s', 'M420 330L338 380L344 390L428 340Z', 'canal_inguinal'),
    P('c', 'M116 140Q160 150 200 190', 'subcostal', 2),
  ],
}

/** Abdomen in transverse section at the lumbar level: the layers of the wall. */
const corte: Diagram = {
  title: { es: 'Pared abdominal en corte', en: 'Abdominal wall in section' },
  view: [600, 420],
  shapes: [
    P('s', ring(300, 210, 280, 190, 266, 176), 'piel_a'),
    P('s', ring(300, 210, 266, 176, 248, 160), 'camper'),
    P('s', ring(300, 210, 248, 160, 243, 155), 'scarpa'),
    P('s', 'M100 120Q60 210 100 300L116 290Q82 210 118 130Z', 'oblicuo_ext_c'),
    P('s', 'M118 130Q82 210 116 290L130 280Q100 210 132 140Z', 'oblicuo_int'),
    P('s', 'M132 140Q100 210 130 280L144 272Q118 210 146 148Z', 'transverso'),
    ...mirror(300, [
      P('s', 'M100 120Q60 210 100 300L116 290Q82 210 118 130Z', 'oblicuo_ext_c'),
      P('s', 'M118 130Q82 210 116 290L130 280Q100 210 132 140Z', 'oblicuo_int'),
      P('s', 'M132 140Q100 210 130 280L144 272Q118 210 146 148Z', 'transverso'),
    ]),
    R('s', 250, 52, 44, 22, 'recto_abd', 8), R('s', 306, 52, 44, 22, 'recto_abd', 8),
    P('c', 'M150 150Q300 60 450 150Q470 210 450 270', 'peritoneo', 2),
    R('b', 262, 300, 76, 56, 'vertebra_a', 12),
    E('s', 232, 312, 24, 30, 'psoas_a'), E('s', 368, 312, 24, 30, 'psoas_a'),
    E('s', 190, 316, 22, 20, 'cuadrado_lumbar'), E('s', 410, 316, 22, 20, 'cuadrado_lumbar'),
    E('s', 250, 372, 36, 18, 'erector_a'), E('s', 350, 372, 36, 18, 'erector_a'),
  ],
}

/** Abdomen in sagittal section: peritoneum and omenta. */
const peritoneo: Diagram = {
  title: { es: 'Peritoneo', en: 'Peritoneum' },
  view: [600, 420],
  shapes: [
    P('s', 'M120 40Q260 20 330 70L300 110Q200 120 120 90Z', 'higado_p'),
    E('s', 330, 150, 60, 34, 'estomago_p'),
    E('s', 470, 170, 40, 30, 'pancreas_p'),
    E('s', 330, 232, 70, 22, 'colon_p'),
    E('s', 330, 320, 80, 40, 'intestino_p'),
    P('o', 'M380 132Q440 120 470 140V190Q440 196 386 176Z', 'bolsa_omental'),
    P('s', 'M300 104Q312 112 320 120L310 124Q300 116 292 110Z', 'epiplon_menor'),
    P('c', 'M300 100Q306 112 316 118', 'epiplon_menor', 6),
    C('s', 376, 128, 7, 'winslow'),
    P('s', 'M280 180Q240 260 260 300L280 300Q262 260 300 184Z', 'epiplon_mayor'),
    P('c', 'M520 300Q450 310 410 320', 'mesenterio', 6),
    P('c', 'M100 30Q300 0 560 60V400Q300 420 80 390', 'peritoneo', 2),
    P('c', 'M560 60Q520 100 510 140', 'peritoneo', 2),
  ],
}

/** Lungs and pleura in frontal section. */
const pleura: Diagram = {
  title: { es: 'Pleura', en: 'Pleura' },
  view: [600, 400],
  shapes: [
    P('s', 'M150 330Q120 200 190 60Q240 50 262 100L262 330Z', 'pulmon_p'),
    P('s', 'M450 330Q480 200 410 60Q360 50 338 100L338 300L360 330Z', 'pulmon_p'),
    P('c', 'M150 330Q120 200 190 60Q240 50 262 100L262 330', 'visceral', 2),
    P('c', 'M450 330Q480 200 410 60Q360 50 338 100V300L360 330', 'visceral', 2),
    P('c', 'M136 340Q104 200 184 44Q244 30 274 92V340M464 340Q496 200 416 44Q356 30 326 92V340', 'parietal', 3),
    P('c', 'M136 340Q300 300 464 340', 'parietal', 3),
    E('s', 300, 270, 46, 60, 'corazon_p'),
  ],
}

/** The layers of the gut wall. */
const intestinal: Diagram = {
  title: { es: 'Pared intestinal', en: 'Gut wall' },
  view: [600, 360],
  shapes: [
    P('s', 'M40 40H560V100H40Z', 'mucosa'),
    ...Array.from({ length: 13 }, (_, i): Shape => P('s', `M${50 + i * 40} 40V16Q${60 + i * 40} 8 ${70 + i * 40} 16V40Z`, 'mucosa')),
    R('s', 40, 100, 520, 70, 'submucosa'),
    ...[100, 220, 340, 460].map((x): Shape => C('s', x, 135, 8, 'meissner')),
    R('s', 40, 170, 520, 60, 'circular'),
    ...[130, 250, 370, 490].map((x): Shape => C('s', x, 236, 8, 'auerbach')),
    R('s', 40, 242, 520, 50, 'longitudinal'),
    R('s', 40, 292, 520, 16, 'serosa'),
  ],
}

/** The large intestine from the front. */
const colon: Diagram = {
  title: { es: 'Colon', en: 'Colon' },
  view: [600, 400],
  shapes: [
    E('s', 150, 320, 34, 30, 'ciego_c'),
    P('c', 'M150 290V110', 'ascendente_c', 40),
    P('c', 'M150 100Q300 70 450 100', 'transverso_c', 40),
    P('c', 'M450 110V280', 'descendente_c', 40),
    P('c', 'M450 290Q460 340 400 340Q340 340 360 300Q370 280 320 300Q300 330 300 360', 'sigmoide', 34),
    P('c', 'M300 360V400', 'recto_c', 34),
  ],
}

/** Back muscles. */
const espalda: Diagram = {
  title: { es: 'Músculos de la espalda', en: 'Back muscles' },
  view: [600, 420],
  shapes: [
    P('b', 'M180 30H420L460 400H140Z', 'espalda_e'),
    P('s', 'M300 20L180 90L300 250L420 90Z', 'trapecio_e'),
    P('s', 'M180 200Q220 380 300 390L300 260L220 190Z', 'dorsal_ancho'),
    P('s', 'M420 200Q380 380 300 390L300 260L380 190Z', 'dorsal_ancho'),
    P('l', 'M300 20V400', 'columna_e', 2),
  ],
}

/** Uterus, tubes and ovaries from the front, with the broad ligament. */
const tube = (p: string, d: string, w: number): Shape[] => [P('c', d, p, w), ...mirror(300, [P('c', d, p, w)])]
const femenino: Diagram = {
  title: { es: 'Útero, trompas y ovarios', en: 'Uterus, tubes and ovaries' },
  view: [600, 400],
  shapes: [
    P('s', 'M70 160Q300 100 530 160L520 300Q300 320 80 300Z', 'ligamento_ancho'),
    { ...P('s', 'M230 210Q300 200 370 210L372 300H228Z', 'mesometrio ligamento_ancho'), x: 1 },
    { ...P('s', 'M100 150Q160 132 228 140V176Q160 168 104 186Z', 'mesosalpinx ligamento_ancho'), x: 1 },
    { ...mirror(300, [P('s', 'M100 150Q160 132 228 140V176Q160 168 104 186Z', 'mesosalpinx ligamento_ancho')])[0], x: 1 },
    { ...P('s', 'M120 196Q150 186 172 206L160 226Q136 220 120 206Z', 'mesovario ligamento_ancho'), x: 1 },
    { ...mirror(300, [P('s', 'M120 196Q150 186 172 206L160 226Q136 220 120 206Z', 'mesovario ligamento_ancho')])[0], x: 1 },
    P('s', 'M230 140Q300 110 370 140Q380 230 330 290H270Q220 230 230 140Z', 'perimetrio utero'),
    P('s', 'M240 146Q300 122 360 146Q368 226 324 280H276Q232 226 240 146Z', 'miometrio utero'),
    P('o', 'M268 160Q300 150 332 160Q330 220 304 262H296Q270 220 268 160Z', 'endometrio utero'),
    R('s', 278, 288, 44, 46, 'cervix', 10),
    R('s', 270, 334, 60, 60, 'vagina_f', 8),
    ...tube('trompa istmo', 'M232 148L196 140', 6),
    ...tube('trompa ampolla', 'M196 140Q160 128 130 146', 12),
    ...tube('trompa infundibulo', 'M130 146Q110 160 104 176', 18),
    ...tube('trompa fimbrias', 'M104 176L84 186M106 180L92 200M110 182L104 206', 3),
    E('s', 150, 214, 30, 18, 'ovario'),
    E('s', 450, 214, 30, 18, 'ovario'),
  ],
}

/** Female pelvis in sagittal section: uterine angles and the rectouterine pouch. */
const femeninoSag: Diagram = {
  title: { es: 'Pelvis femenina en corte', en: 'Female pelvis in section' },
  view: [600, 400],
  shapes: [
    P('b', 'M60 260Q80 250 100 260L96 330Q76 336 60 326Z', 'pubis_f'),
    E('s', 160, 250, 60, 40, 'vejiga_f'),
    P('s', 'M200 150Q260 110 300 150Q300 200 270 236L240 230Q210 190 200 150Z', 'cuerpo_u'),
    P('s', 'M246 228L274 236L290 290L264 296Z', 'cervix_s'),
    P('s', 'M262 296L292 290L230 380L210 372Z', 'vagina_s'),
    P('b', 'M420 20Q520 140 470 380H430Q470 160 380 20Z', 'sacro_f'),
    P('s', 'M380 120Q420 200 400 300Q390 360 350 390L330 380Q360 340 368 290Q380 200 350 130Z', 'recto_f'),
    P('o', 'M300 250Q330 300 360 290Q370 250 352 236Q320 236 300 250Z', 'douglas_f'),
    { ...P('l', 'M220 160L272 236M276 262L300 300M276 262L214 360', 'ejes', 1.5), x: 1 },
    { ...P('c', 'M262 248A20 20 0 0 0 290 276', 'anteflexion', 3), x: 1 },
    { ...P('l', 'M220 160L272 236M276 262L300 300', 'anteflexion', 1.5), x: 1 },
    { ...P('c', 'M286 280A24 24 0 0 1 252 300', 'anteversion', 3), x: 1 },
    { ...P('l', 'M276 262L300 300M276 262L214 360', 'anteversion', 1.5), x: 1 },
  ],
}

/** External female genitalia. */
const vulva: Diagram = {
  title: { es: 'Genitales externos femeninos', en: 'External female genitalia' },
  view: [600, 420],
  shapes: [
    P('s', 'M180 40Q300 0 420 40Q440 90 380 110H220Q160 90 180 40Z', 'monte_venus'),
    P('s', 'M220 110Q160 220 240 380Q300 410 360 380Q440 220 380 110Q300 140 220 110Z', 'labios_mayores'),
    P('o', 'M260 140Q230 240 276 350Q300 362 324 350Q370 240 340 140Q300 156 260 140Z', 'vestibulo'),
    P('s', 'M268 150Q246 240 284 340L292 338Q260 240 282 156Z', 'labios_menores'),
    P('s', 'M332 150Q354 240 316 340L308 338Q340 240 318 156Z', 'labios_menores'),
    E('s', 300, 150, 10, 14, 'clitoris'),
    C('o', 300, 214, 5, 'uretra_v'),
    E('o', 300, 282, 20, 30, 'orificio_v'),
    P('s', ring(300, 282, 23, 33, 18, 27), 'himen'),
    E('q', 266, 322, 9, 12, 'bartholin'), E('q', 334, 322, 9, 12, 'bartholin'),
  ],
}

/** Pelvic inlet from above: female and male. */
const pelvisComp: Diagram = {
  title: { es: 'Pelvis femenina y masculina', en: 'Female and male pelvis' },
  view: [600, 320],
  shapes: [
    P('b', 'M20 160Q20 40 150 50Q280 40 280 160Q280 280 150 290Q20 280 20 160Z', 'femenina'),
    E('o', 150, 170, 92, 78, 'femenina'),
    P('b', 'M330 160Q330 50 450 50Q570 50 570 160Q570 280 450 290Q330 280 330 160Z', 'masculina'),
    P('o', 'M450 110Q420 90 396 110Q370 140 390 190Q420 240 450 262Q480 240 510 190Q530 140 504 110Q480 90 450 110Z', 'masculina'),
  ],
}

/** Male pelvis and scrotum in sagittal section. */
const masculino: Diagram = {
  title: { es: 'Aparato genital masculino', en: 'Male genital tract' },
  view: [600, 420],
  shapes: [
    P('b', 'M120 120Q140 110 160 120L156 190Q136 196 120 186Z', 'pubis_m'),
    E('s', 250, 110, 60, 44, 'vejiga_m'),
    E('s', 330, 150, 18, 30, 'vesicula_m'),
    E('s', 260, 180, 30, 24, 'prostata_m'),
    P('c', 'M260 156V200', 'uretra_m', 5),
    P('c', 'M318 168Q290 186 268 196', 'eyaculador', 3),
    C('s', 236, 226, 7, 'cowper'),
    P('c', 'M260 204L252 236Q180 250 120 250L60 270', 'uretra_m', 5),
    P('s', 'M150 236Q100 240 50 262L56 282Q110 262 156 258Z', 'pene_m'),
    P('s', 'M56 262Q30 266 28 276Q32 290 58 284Z', 'glande'),
    P('l', 'M60 258Q36 260 30 272', 'prepucio', 3),
    P('s', 'M140 270Q120 330 160 380Q210 410 240 360Q250 300 200 270Z', 'escroto'),
    P('c', 'M140 272Q118 330 160 382Q210 412 242 360', 'dartos', 3),
    P('l', 'M190 300V404', 'rafe', 2),
    E('s', 196, 336, 24, 30, 'testiculo_m'),
    E('s', 224, 330, 8, 24, 'epididimo_m'),
    P('c', 'M226 310Q240 270 260 250Q300 220 330 160Q336 140 320 126', 'deferente', 3),
    P('c', 'M218 312Q232 272 252 252M222 316Q238 276 258 256', 'pampiniforme', 2),
    P('c', 'M160 262Q200 252 250 262', 'colles', 2),
  ],
}

/** Sacral plexus and sciatic nerve, from behind. */
const sacro: Diagram = {
  title: { es: 'Plexo sacro', en: 'Sacral plexus' },
  view: [600, 400],
  shapes: [
    P('b', 'M240 40H360L330 220H270Z', 'sacro_p'),
    R('b', 252, 0, 96, 36, 'l5_p', 6),
    P('s', 'M120 120Q200 100 260 140L250 170Q190 150 130 160Z', 'piriforme_p'),
    P('c', 'M270 20Q240 80 210 180M276 60Q246 110 214 182M282 100Q250 140 218 184M288 140Q258 170 222 186M292 180Q262 190 226 188', 'plexo_sacro', 4),
    P('c', 'M218 186Q200 260 190 400', 'ciatico', 12),
  ],
}

/** Internal iliac artery: the umbilical artery and the superior vesical. */
const iliaca: Diagram = {
  title: { es: 'Arteria ilíaca interna', en: 'Internal iliac artery' },
  view: [600, 400],
  shapes: [
    P('c', 'M300 10V80', 'aorta_i', 14),
    P('c', 'M300 80L220 150', 'iliaca_comun', 11),
    P('c', 'M220 150L130 260', 'iliaca_externa', 9),
    P('c', 'M220 150L260 230', 'iliaca_interna_d', 8),
    P('c', 'M260 230Q320 250 380 240Q440 220 470 160', 'umbilical', 5),
    P('c', 'M380 240L400 290', 'vesical_superior', 3),
    E('s', 420, 320, 60, 40, 'vejiga_i'),
    P('c', 'M260 230L250 320M262 236L300 330', 'ramas_i', 3),
  ],
}

/** Rectum and anal canal in frontal section. */
const anal: Diagram = {
  title: { es: 'Recto y conducto anal', en: 'Rectum and anal canal' },
  view: [600, 400],
  shapes: [
    P('o', 'M230 20H370V200Q340 240 320 260V380H280V260Q260 240 230 200Z', 'recto_a'),
    P('s', 'M200 210Q240 230 270 290L270 330L250 330Q220 260 190 236Z', 'elevador_a'),
    ...mirror(300, [P('s', 'M200 210Q240 230 270 290L270 330L250 330Q220 260 190 236Z', 'elevador_a')]),
    P('s', 'M268 262H280V370H268Z', 'esfinter_interno'), P('s', 'M320 262H332V370H320Z', 'esfinter_interno'),
    P('s', 'M244 290H266V384H244Z', 'esfinter_externo_d'), P('s', 'M334 290H356V384H334Z', 'esfinter_externo_d'),
    P('c', 'M280 318Q290 310 300 318Q310 326 320 318', 'pectinea', 3),
  ],
}

export const BODY = { autonomo, columna, plexo_braquial: plexo, mama, conduccion, ciclo, linfa, pared_abdominal: pared, pared_corte: corte, peritoneo, pleura, pared_intestinal: intestinal, colon, espalda, femenino, femenino_sagital: femeninoSag, vulva, pelvis_comparada: pelvisComp, masculino, plexo_sacro: sacro, iliaca_interna: iliaca, conducto_anal: anal }
