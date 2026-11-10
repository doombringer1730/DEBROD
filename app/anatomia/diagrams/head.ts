import { C, E, P, R, mirror, ring, type Diagram } from './kit.ts'

// Head and neck. All schematic: positions and proportions are simplified.

/** Right ear, front (coronal) view: outer, middle and inner ear. */
const oido: Diagram = {
  title: { es: 'Oído', en: 'Ear' },
  view: [600, 360],
  shapes: [
    P('b', 'M232 18H600V342H232Z', 'temporal_hueso'),
    P('s', 'M62 58C18 80 20 282 72 300C104 312 112 282 96 252C82 224 90 204 100 190L100 172C86 150 94 110 110 90C122 70 96 48 62 58Z', 'pabellon externo'),
    P('o', 'M98 166L250 150L252 210L98 200Z', 'conducto externo'),
    P('s', 'M250 146Q256 152 254 158L248 158Q246 152 250 146Z', 'flacida timpano'),
    P('s', 'M248 158L254 158Q262 186 254 214Q246 214 244 186Q244 170 248 158Z', 'tensa timpano'),
    P('o', 'M256 80H345V262H256Z', 'medio caja'),
    P('s', 'M256 80H345V140H256Z', 'epitimpano medio caja'),
    P('c', 'M256 80H345', 'techo', 5),
    P('c', 'M256 262H345', 'piso', 5),
    P('o', 'M290 262L318 262L410 338L386 350Z', 'trompa'),
    // ossicles
    P('s', 'M250 192L256 194L266 142L260 140Z', 'martillo'),
    E('s', 270, 118, 11, 14, 'martillo'),
    E('s', 293, 112, 12, 11, 'yunque'),
    P('s', 'M286 118L300 120L305 166L298 168Z', 'yunque'),
    P('s', 'M304 160L336 150L336 186L304 172Z', 'estribo'),
    R('s', 336, 148, 6, 40, 'platina estribo'),
    C('s', 252, 192, 3.5, 'umbo'),
    // muscles
    E('s', 328, 248, 16, 6, 'tensor_timpano'),
    P('c', 'M318 244L263 150', 'tensor_timpano', 2),
    E('s', 326, 205, 9, 5, 'estapedio'),
    P('c', 'M322 201L314 172', 'estapedio', 2),
    // medial wall: windows and promontory
    P('l', 'M345 80V146M345 190V262', 'medial', 2),
    P('l', 'M338 146H346V190H338Z', 'oval', 2),
    E('o', 344, 226, 4, 10, 'redonda'),
    P('s', 'M345 192Q330 205 345 218Z', 'promontorio'),
    P('c', 'M347 250Q336 205 347 160', 'jacobson', 2),
    // nerves through the middle ear
    P('c', 'M345 124Q282 152 256 132', 'cuerda_timpano', 2.5),
    P('c', 'M560 168L378 74', 'facial_n', 4),
    C('s', 372, 71, 7, 'ganglio_geniculado'),
    P('c', 'M366 76L352 98V330', 'facial_n', 4),
    // inner ear: vestibule, canals, cochlea
    E('b', 393, 156, 27, 32, 'vestibulo interno'),
    E('s', 393, 141, 14, 9, 'utriculo membranoso interno'),
    E('s', 391, 172, 9, 8, 'saculo membranoso interno'),
    P('c', 'M382 128A40 40 0 1 1 440 118', 'canales interno', 10),
    P('c', 'M398 136A34 34 0 1 1 458 160', 'canales interno', 10),
    P('c', 'M412 146A30 20 0 1 1 472 150', 'canales interno', 10),
    P('c', 'M382 128A40 40 0 1 1 440 118M398 136A34 34 0 1 1 458 160M412 146A30 20 0 1 1 472 150', 'membranoso', 3),
    P('c', 'M352 224C360 300 470 322 522 270C560 230 520 180 472 190', 'basal coclea interno', 18),
    P('c', 'M472 190C430 200 430 260 470 262C500 262 506 230 486 222C470 216 462 232 471 240', 'apical coclea interno', 14),
    P('c', 'M352 224C360 300 470 322 522 270C560 230 520 180 472 190C430 200 430 260 470 262C500 262 506 230 486 222', 'membranoso', 4),
    C('o', 472, 238, 4, 'helicotrema'),
    // vestibulocochlear nerve
    P('c', 'M600 176L540 180', 'viii', 7),
    P('c', 'M540 178L408 152', 'vestibular viii', 5),
    P('c', 'M540 182L478 228', 'coclear viii', 5),
  ],
}

/** The tympanic cavity as a box, seen from the outside with the lateral wall open. */
const caja: Diagram = {
  title: { es: 'Caja timpánica', en: 'Tympanic cavity' },
  view: [600, 360],
  shapes: [
    P('s', 'M260 40H490V250H260Z', 'medial laberintica'),
    P('b', 'M170 100L260 40V250L170 310Z', 'posterior mastoidea'),
    P('b', 'M400 100L490 40V250L400 310Z', 'anterior carotidea'),
    P('b', 'M170 310L400 310L490 250L260 250Z', 'piso yugular'),
    P('b', 'M170 100L400 100L490 40L260 40Z', 'techo tegmental'),
    { ...P('s', 'M170 100L260 40L490 40L490 92L400 152L170 152Z', 'epitimpano'), x: 1 },
    E('s', 372, 160, 52, 38, 'promontorio'),
    E('o', 318, 104, 22, 12, 'oval'),
    C('o', 318, 214, 12, 'redonda'),
    P('c', 'M378 250Q360 160 372 66', 'jacobson', 3),
    E('o', 448, 238, 12, 9, 'trompa'),
    E('o', 214, 128, 13, 18, 'aditus'),
    P('q', 'M170 100H400V310H170Z', 'lateral membranosa'),
    E('q', 285, 205, 60, 70, 'timpano lateral membranosa'),
  ],
}

/** One turn of the cochlea in cross-section. */
const coclea: Diagram = {
  title: { es: 'Cóclea en corte', en: 'Cochlea in section' },
  view: [600, 360],
  shapes: [
    C('b', 330, 180, 150),
    P('o', 'M232 172L447 104A140 140 0 0 0 205 117Z', 'perilinfa vestibular_esc'),
    P('o', 'M232 190L468 200A140 140 0 0 1 205 243Z', 'perilinfa timpanica_esc'),
    P('o', 'M447 104L232 172L232 190L468 200A140 140 0 0 0 447 104Z', 'endolinfa media_esc'),
    P('b', 'M180 150L232 176V186L180 212Z', 'modiolo'),
    C('s', 200, 181, 11, 'ganglio_espiral'),
    P('l', 'M232 172L447 104', 'reissner', 2),
    P('l', 'M232 190L468 200', 'basilar', 3),
    P('s', 'M318 195Q350 166 398 197Z', 'corti'),
    C('s', 345, 186, 3, 'corti'), C('s', 360, 184, 3, 'corti'), C('s', 373, 186, 3, 'corti'),
    P('s', 'M248 174Q320 158 388 178L384 185Q320 170 250 184Z', 'tectoria'),
  ],
}

/** The base of the brain with the twelve cranial nerves on both sides. */
const nerve = (n: number, d: string, w = 4) => [P('c', d, `cn${n}`, w), ...mirror(300, [P('c', d, `cn${n}`, w)])]
const nervios: Diagram = {
  title: { es: 'Pares craneales', en: 'Cranial nerves' },
  view: [600, 400],
  shapes: [
    E('b', 222, 118, 108, 88), E('b', 378, 118, 108, 88),
    E('b', 150, 252, 60, 88), E('b', 450, 252, 60, 88),
    E('b', 212, 342, 92, 48), E('b', 388, 342, 92, 48),
    R('s', 270, 190, 60, 26, 'mesencefalo_d', 6),
    E('s', 300, 252, 62, 40, 'puente_d'),
    P('s', 'M270 290H330L318 384H282Z', 'bulbo_d'),
    ...nerve(1, 'M262 168L246 78'), E('s', 244, 62, 9, 20, 'cn1'), E('s', 356, 62, 9, 20, 'cn1'),
    ...nerve(2, 'M294 178L240 136', 5), P('c', 'M286 172L314 184M314 172L286 184', 'cn2', 5),
    ...nerve(3, 'M288 214L246 196'),
    ...nerve(4, 'M272 204Q240 222 216 206', 2.5),
    ...nerve(5, 'M248 246L190 236', 8),
    ...nerve(6, 'M292 290L268 228', 3),
    ...nerve(7, 'M258 284L206 278', 4),
    ...nerve(8, 'M262 294L204 302', 5),
    ...nerve(9, 'M282 306L226 320', 3),
    ...nerve(10, 'M282 318L222 338', 4),
    ...nerve(11, 'M286 378Q240 362 226 350', 3),
    ...nerve(12, 'M292 332L256 354', 3),
  ],
}

/** Face from the front: muscles of expression, nose and lips. */
const caraFrente: Diagram = {
  title: { es: 'Cara de frente', en: 'Face, front' },
  view: [600, 420],
  shapes: [
    E('b', 300, 220, 172, 202),
    P('s', 'M150 152Q206 62 292 52V138Q228 140 170 166Z', 'frontal_m'),
    ...mirror(300, [P('s', 'M150 152Q206 62 292 52V138Q228 140 170 166Z', 'frontal_m')]),
    P('s', ring(235, 192, 62, 40, 42, 18), 'orbicular_ojo'),
    P('s', ring(365, 192, 62, 40, 42, 18), 'orbicular_ojo'),
    E('o', 235, 192, 38, 15), E('o', 365, 192, 38, 15),
    P('s', 'M286 164Q256 148 224 156L227 166Q258 160 286 174Z', 'corrugador'),
    ...mirror(300, [P('s', 'M286 164Q256 148 224 156L227 166Q258 160 286 174Z', 'corrugador')]),
    P('s', 'M290 158H310L308 216H292Z', 'procer'),
    P('s', 'M286 206L280 274Q300 292 320 274L314 206Z', 'nariz'),
    E('o', 288, 282, 8, 5), E('o', 312, 282, 8, 5),
    P('s', 'M296 276H304V290H296Z', 'columela'),
    P('s', 'M294 293H306L304 312H296Z', 'filtrum'),
    P('s', ring(300, 330, 64, 34, 40, 12), 'orbicular_boca'),
    P('s', 'M262 322Q300 310 338 322Q300 332 262 322Z', 'bermellon'),
    P('s', 'M266 334Q300 352 334 334Q300 342 266 334Z', 'bermellon'),
    P('s', 'M362 326L456 312L458 322L364 336Z', 'risorio'),
    ...mirror(300, [P('s', 'M362 326L456 312L458 322L364 336Z', 'risorio')]),
    P('q', 'M372 296Q420 282 442 300V346Q412 362 372 348Z', 'buccinador'),
    ...mirror(300, [P('q', 'M372 296Q420 282 442 300V346Q412 362 372 348Z', 'buccinador')]),
  ],
}

/** Face from the side: chewing muscles, parotid and facial nerve, superficial vessels. */
const caraLado: Diagram = {
  title: { es: 'Cara de lado', en: 'Face, side' },
  view: [600, 420],
  shapes: [
    P('b', 'M330 30C450 20 520 110 510 210C505 260 480 300 470 340L470 420H300L300 360C250 360 200 350 190 330L160 300C150 290 170 280 160 270L150 250C140 240 160 232 150 220L130 200C160 190 150 160 160 120C180 60 240 34 330 30Z'),
    E('s', 455, 192, 22, 36, 'oreja_l'),
    P('s', 'M300 70Q420 58 448 150L362 200L330 180Q290 120 300 70Z', 'temporal_m'),
    P('s', ring(205, 172, 44, 30, 28, 13), 'orbicular_ojo'),
    P('q', 'M300 236Q330 230 360 248Q345 272 310 268Z', 'plexo_pterigoideo'),
    P('q', 'M220 232L298 226L308 300L230 306Z', 'buccinador'),
    P('s', 'M300 210L380 205L396 320L320 330Z', 'masetero'),
    P('s', 'M384 210Q430 214 440 260Q430 322 400 332L384 300Z', 'parotida'),
    P('c', 'M392 246L300 250L268 256', 'stensen', 4),
    P('s', 'M192 276L300 282L300 290L192 286Z', 'risorio'),
    P('c', 'M426 250L404 255', 'facial', 4),
    P('c', 'M404 255L350 140', 'facial', 3),
    P('c', 'M404 255L302 186', 'facial', 3),
    P('c', 'M404 255L260 256', 'facial', 3),
    P('c', 'M404 255Q360 332 260 330', 'facial marginal', 3),
    P('c', 'M404 255L398 384', 'facial', 3),
    P('s', 'M456 226L486 240L332 420H296Z', 'ecm_c'),
    P('c', 'M424 300L402 420', 'yugular_externa', 5),
    P('c', 'M472 410Q452 322 442 262', 'auricular_mayor', 3),
  ],
}

/** Vertex in coronal section: scalp, bone, meninges and the top of the brain. */
const gyri = 'M20 196Q60 180 100 198Q140 216 180 196Q220 180 262 198L292 198V262Q252 272 220 252Q180 234 140 254Q100 272 60 252L20 252Z'
const capas: Diagram = {
  title: { es: 'Cuero cabelludo y meninges', en: 'Scalp and meninges' },
  view: [600, 420],
  shapes: [
    R('s', 0, 18, 600, 26, 'piel_c'),
    R('s', 0, 44, 600, 18, 'conectivo_c'),
    R('s', 0, 62, 600, 12, 'aponeurosis'),
    R('o', 0, 74, 600, 16, 'areolar'),
    R('s', 0, 90, 600, 8, 'pericraneo'),
    R('b', 0, 98, 600, 42, 'hueso_c'),
    R('s', 0, 140, 600, 12, 'duramadre meninges'),
    P('c', 'M0 153H600', 'subdural', 2),
    R('s', 0, 155, 600, 5, 'aracnoides meninges'),
    R('o', 0, 160, 600, 36, 'subaracnoideo'),
    P('l', 'M30 160V196M80 160V196M130 160V196M180 160V196M230 160V196M370 160V196M420 160V196M470 160V196M520 160V196M570 160V196', 'trabeculas', 1),
    P('s', 'M280 140H320L300 176Z', 'sagital_superior senos_c'),
    C('s', 291, 150, 5, 'vellosidades'), C('s', 309, 152, 5, 'vellosidades'),
    P('s', 'M296 176H304V420H296Z', 'hoz_cerebro duramadre meninges'),
    C('s', 120, 146, 5, 'meningea_media'), C('s', 470, 146, 5, 'meningea_media'),
    R('b', 0, 252, 292, 168, 'blanca'), R('b', 308, 252, 292, 168, 'blanca'),
    P('s', gyri, 'gris'),
    ...mirror(300, [P('s', gyri, 'gris')]),
    P('l', 'M20 194Q60 178 100 196Q140 214 180 194Q220 178 262 196L292 196', 'piamadre meninges', 2),
    ...mirror(300, [P('l', 'M20 194Q60 178 100 196Q140 214 180 194Q220 178 262 196L292 196', 'piamadre meninges', 2)]),
  ],
}

/** Inside of the skull from the side: dural folds and venous sinuses. */
const senos: Diagram = {
  title: { es: 'Duramadre y senos venosos', en: 'Dural folds and venous sinuses' },
  view: [600, 400],
  shapes: [
    E('b', 300, 200, 272, 174),
    P('s', 'M80 232Q120 62 300 42Q470 52 520 200L470 240Q330 172 200 202Q120 216 80 232Z', 'hoz_cerebro'),
    P('c', 'M90 212Q120 57 300 38Q470 48 520 196', 'sagital_superior', 8),
    P('c', 'M200 200Q330 170 470 238', 'sagital_inferior', 4),
    P('c', 'M470 238L520 206', 'recto_s', 6),
    P('s', 'M380 232L540 210V262L380 256Z', 'tienda'),
    C('s', 524, 206, 12, 'confluencia'),
    P('s', 'M524 218Q542 280 500 322L494 302Q516 270 514 218Z', 'hoz_cerebelo'),
    P('c', 'M524 212Q470 270 420 286', 'transverso', 7),
    P('c', 'M420 286Q390 300 400 330Q410 356 380 370', 'sigmoides', 7),
    P('c', 'M380 370V400', 'yugular_interna_s', 8),
    R('q', 218, 262, 64, 42, 'cavernoso', 10),
    E('s', 250, 286, 14, 10, 'hipofisis_s'),
    P('c', 'M196 390Q218 304 238 282Q258 262 284 272', 'carotida_cavernosa carotida_interna_s', 5),
  ],
}

/** Upper eyelid in sagittal section, with the lacrimal puncta in a front-view inset. */
const parpado: Diagram = {
  title: { es: 'Párpado en corte', en: 'Eyelid in section' },
  view: [600, 400],
  shapes: [
    P('b', 'M90 36H200L176 86H112Z', 'reborde'),
    C('s', 480, 232, 182, 'globo'),
    P('s', 'M140 86Q126 200 150 322H200Q206 200 240 110L220 86Z', 'parpado_p'),
    P('c', 'M140 84Q128 200 150 322', 'piel_p', 3),
    C('s', 160, 130, 6, 'orbicular_p'), C('s', 160, 160, 6, 'orbicular_p'), C('s', 161, 190, 6, 'orbicular_p'),
    C('s', 162, 220, 6, 'orbicular_p'), C('s', 163, 250, 6, 'orbicular_p'), C('s', 164, 280, 6, 'orbicular_p'),
    R('s', 172, 232, 22, 84, 'tarso_p', 8),
    E('o', 183, 274, 5, 36, 'meibomio'),
    P('s', 'M232 62L252 70L206 206L176 242L170 234L196 200Z', 'elevador_p'),
    P('s', 'M206 206L216 212L196 234L188 230Z', 'muller'),
    P('c', 'M152 86Q160 160 174 228', 'septo', 3),
    P('c', 'M198 320Q206 200 240 112Q262 100 272 130Q292 200 304 320', 'conjuntiva', 3),
    C('s', 250, 108, 8, 'fornix'),
    P('c', 'M160 322L124 346M168 322L136 352M176 322L150 356', 'pestanas', 2),
    C('s', 164, 312, 4.5, 'zeis'),
    C('s', 177, 302, 4, 'moll'),
    E('s', 500, 66, 66, 24, 'ojo_inset'),
    E('o', 500, 66, 30, 14),
    C('s', 440, 58, 4, 'punto_lagrimal'), C('s', 442, 78, 4, 'punto_lagrimal'),
  ],
}

/** Visual pathway from above: nasal fibres cross at the chiasm. */
const via: Diagram = {
  title: { es: 'Vía óptica', en: 'Visual pathway' },
  view: [600, 400],
  shapes: [
    C('s', 200, 70, 46), C('s', 400, 70, 46),
    P('c', 'M200 116A46 46 0 0 1 157 86', 'temporal_r', 6),
    P('c', 'M200 116A46 46 0 0 0 243 86', 'nasal', 6),
    P('c', 'M400 116A46 46 0 0 0 443 86', 'temporal_r', 6),
    P('c', 'M400 116A46 46 0 0 1 357 86', 'nasal', 6),
    P('c', 'M168 104L254 190L240 300L222 368', 'temporal_r', 3),
    P('c', 'M432 104L346 190L360 300L378 368', 'temporal_r', 3),
    P('c', 'M232 108L300 190L360 300L378 368', 'nasal', 3),
    P('c', 'M368 108L300 190L240 300L222 368', 'nasal', 3),
    E('q', 300, 190, 34, 14, 'quiasma_v'),
    E('s', 222, 376, 52, 20, 'occipital_v'), E('s', 378, 376, 52, 20, 'occipital_v'),
  ],
}

/** Eye in horizontal section: chambers with aqueous humour. */
const ojo: Diagram = {
  title: { es: 'Ojo en corte', en: 'Eye in section' },
  view: [600, 360],
  shapes: [
    P('s', ring(330, 180, 140, 140, 126, 126), 'esclera_d'),
    P('s', 'M196 120Q150 180 196 240L204 236Q166 180 204 124Z', 'cornea_d'),
    P('o', 'M204 124Q166 180 204 236L222 232V128Z', 'humor_acuoso camara_anterior'),
    P('s', 'M222 104L230 104V158L222 158ZM222 202L230 202V256L222 256Z', 'iris_d'),
    P('o', 'M230 124L246 132V228L230 236Z', 'humor_acuoso camara_posterior'),
    E('s', 262, 180, 18, 52, 'cristalino_d'),
    P('o', 'M282 70A126 126 0 1 1 282 290Q300 180 282 70Z', 'vitreo_d'),
    P('c', 'M290 64A126 126 0 1 1 290 296', 'retina_d', 4),
    P('s', 'M460 166H560V194H460Z', 'nervio_optico_d'),
  ],
}

/** Head in sagittal section: lateral nasal wall and pharynx. */
const sagital: Diagram = {
  title: { es: 'Cabeza en corte sagital', en: 'Head in sagittal section' },
  view: [600, 420],
  shapes: [
    P('b', 'M40 130Q40 60 120 40H300V110H60L50 240H40Z'),
    P('o', 'M60 110H300V232H60Z', 'cavidad_nasal'),
    R('o', 246, 110, 46, 40, 'seno_esfenoidal', 6),
    E('s', 200, 140, 46, 10, 'cornete_s'),
    P('o', 'M156 152Q200 166 246 152V158Q200 172 156 158Z', 'meato_s'),
    E('s', 176, 172, 62, 13, 'cornete_m'),
    P('o', 'M114 186Q176 202 238 186V193Q176 210 114 193Z', 'meato_m'),
    E('s', 160, 210, 72, 14, 'cornete_i'),
    P('o', 'M88 225Q160 238 232 225V231Q160 244 88 231Z', 'meato_i'),
    C('o', 250, 168, 6, 'esfenopalatina'),
    P('c', 'M250 168L196 150M250 168L190 180M250 168L206 200', 'esfenopalatina', 2),
    P('c', 'M332 172L266 176', 'vidiano', 3),
    P('b', 'M60 234H250V246H60Z', 'paladar_duro'),
    P('s', 'M250 238Q292 250 302 282L292 288Q280 260 250 250Z', 'paladar_blando'),
    P('o', 'M300 110H352V420H300Z', 'faringe'),
    P('o', 'M300 110H352V250H300Z', 'nasofaringe_d faringe'),
    P('o', 'M300 330H352V420H300Z', 'hipofaringe_d faringe'),
    P('s', 'M352 118Q326 140 340 176L352 172Z', 'adenoides waldeyer'),
    E('s', 292, 192, 10, 14, 'trompa_ostium'),
    E('s', 306, 214, 7, 10, 'waldeyer tubarica'),
    P('s', 'M80 260Q180 252 260 284Q300 320 290 370Q200 380 120 330Q80 300 80 260Z', 'lengua_d'),
    E('s', 300, 300, 11, 20, 'amigdala_palatina waldeyer'),
    P('s', 'M262 318Q290 330 290 360L276 362Q270 336 254 330Z', 'amigdala_lingual waldeyer'),
    P('s', 'M300 350L312 330L318 336L306 360Z', 'epiglotis_d'),
  ],
}

/** Thyroid and parathyroids from the front. */
const tiroides: Diagram = {
  title: { es: 'Tiroides y paratiroides', en: 'Thyroid and parathyroids' },
  view: [600, 400],
  shapes: [
    P('b', 'M250 40H350L340 120L300 132L260 120Z', 'laringe_t'),
    R('b', 268, 128, 64, 22, 'cricoides_t', 8),
    ...Array.from({ length: 9 }, (_, i) => R('b', 276, 156 + i * 26, 48, 18, 'traquea_t', 6)),
    E('q', 226, 168, 9, 7, 'paratiroides'), E('q', 226, 262, 9, 7, 'paratiroides'),
    E('q', 374, 168, 9, 7, 'paratiroides'), E('q', 374, 262, 9, 7, 'paratiroides'),
    E('s', 236, 214, 44, 80, 'lobulos tiroides_g'),
    E('s', 364, 214, 44, 80, 'lobulos tiroides_g'),
    R('s', 264, 222, 72, 30, 'istmo tiroides_g', 10),
    P('s', 'M288 224H300L292 130L284 132Z', 'piramidal tiroides_g'),
  ],
}

/** Carotid arteries from the side, with the branches of the external carotid. */
const carotida: Diagram = {
  title: { es: 'Ramas de la carótida externa', en: 'Branches of the external carotid' },
  view: [600, 420],
  shapes: [
    P('c', 'M300 420V252', 'carotida_comun_d', 12),
    P('c', 'M306 250Q322 150 340 30', 'carotida_interna_d', 9),
    P('c', 'M296 250Q276 160 262 70', 'carotida_externa_d', 9),
    P('c', 'M292 236Q250 260 232 300Q226 316 222 332', 'tiroidea_superior', 4),
    P('c', 'M296 228Q306 190 318 150', 'faringea_ascendente', 2.5),
    P('c', 'M288 212Q250 210 200 216', 'lingual_d', 4),
    P('c', 'M284 190Q240 176 190 170Q170 150 168 118', 'facial_a', 4),
    P('c', 'M286 180Q340 160 380 150Q420 142 446 138', 'occipital_a', 4),
    P('c', 'M274 130Q310 116 342 108', 'auricular_posterior', 3),
    P('c', 'M266 92Q220 92 170 96', 'maxilar_a', 5),
    P('c', 'M170 96Q140 92 118 88', 'maxilar_a esfenopalatina_a', 3),
    P('c', 'M262 76Q258 40 254 8', 'temporal_superficial', 4),
  ],
}

export const HEAD = { oido, caja, coclea, nervios, cara_frente: caraFrente, cara_lado: caraLado, capas, senos, parpado, via_optica: via, ojo_corte: ojo, cabeza_sagital: sagital, tiroides, carotida }
