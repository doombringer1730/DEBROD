# Items with no 3D structure get a schematic diagram instead:
# item id -> (diagram, part, hint). Diagrams live in app/anatomia/diagrams/;
# "a+b" lights several parts; hints as in mapping.py.
X, R, B, AT, INN, SUP, PAS, AL, SRC, EX = None, 'region', 'between', 'attaches', 'innervates', 'supplies', 'passes', 'along', 'source', 'example'

D = {
    # Fundamentos
    'fundamentos-001': ('planos', 'sagital', X), 'fundamentos-002': ('planos', 'coronal', X), 'fundamentos-003': ('planos', 'transversal', X),
    'fundamentos-004': ('terminos', 'ipsilateral', X), 'fundamentos-005': ('terminos', 'contralateral', X),
    'fundamentos-006': ('terminos', 'proximal', X), 'fundamentos-007': ('terminos', 'distal', X),
    'fundamentos-008': ('terminos', 'visceral_t', X), 'fundamentos-009': ('terminos', 'parietal_t', X),
    'fundamentos-010': ('movimientos', 'flexion', X), 'fundamentos-011': ('movimientos', 'extension', X),
    'fundamentos-012': ('movimientos', 'abduccion', X), 'fundamentos-013': ('movimientos', 'aduccion', X),
    'fundamentos-016': ('movimientos', 'inversion', X), 'fundamentos-017': ('movimientos', 'eversion', X),
    'fundamentos-018': ('movimientos', 'oposicion', X),
    'fundamentos-020': ('organizacion', 'celula', X), 'fundamentos-021': ('organizacion', 'sistema', X), 'fundamentos-022': ('organizacion', 'aparato', X),
    'fundamentos-023': ('tejidos', 'epitelial', X), 'fundamentos-024': ('tejidos', 'mesenquima', X), 'fundamentos-025': ('tejidos', 'fibroblastos', X),
    'fundamentos-026': ('tejidos', 'metaplasia', X), 'fundamentos-027': ('hueso_largo', 'medula_roja', R),
    'fundamentos-028': ('tejidos', 'hialino', X), 'fundamentos-029': ('tejidos', 'fibrocartilago', X),
    'fundamentos-031': ('tejidos', 'miocito', X), 'fundamentos-032': ('tejidos', 'liso', X), 'fundamentos-033': ('tejidos', 'esqueletico', X),
    'fundamentos-034': ('tejidos', 'neurona', X), 'fundamentos-035': ('tejidos', 'glia', X),
    'fundamentos-036': ('esqueleto', 'axial', X), 'fundamentos-037': ('esqueleto', 'apendicular', X),
    'fundamentos-038': ('hueso_largo', 'cortical', X), 'fundamentos-039': ('hueso_largo', 'esponjoso', X),
    'fundamentos-040': ('hueso_largo', 'periostio', X), 'fundamentos-041': ('hueso_largo', 'nutricia', X),
    'fundamentos-045': ('articulaciones', 'sinartrosis', X), 'fundamentos-046': ('articulaciones', 'anfiartrosis', X),
    'fundamentos-047': ('articulaciones', 'diartrosis', X), 'fundamentos-049': ('articulaciones', 'sincondrosis', X),
    'fundamentos-051': ('articulaciones', 'troclear', X), 'fundamentos-054': ('articulaciones', 'artrodia', X),
    'fundamentos-057': ('tejido_denso', 'tendon', X), 'fundamentos-058': ('tejido_denso', 'ligamento', X),
    'fundamentos-060': ('tejido_denso', 'fusiforme', X), 'fundamentos-062': ('tejido_denso', 'aponeurosis_f', X),
    'fundamentos-063': ('tejido_denso', 'bursa', X), 'fundamentos-064': ('tejido_denso', 'fascia', X),
    'fundamentos-065': ('vasos', 'capilares', X), 'fundamentos-066': ('vasos', 'adventicia', X), 'fundamentos-067': ('vasos', 'intima', X),
    'fundamentos-068': ('linfa', 'conducto_toracico', X), 'fundamentos-069': ('linfa', 'quilo', X),

    # Cráneo
    'craneo-037': ('capas', 'meningea_media', X), 'craneo-052': ('senos', 'sigmoides', X), 'craneo-072': ('cara_lado', 'parotida', X),

    # SNC
    'snc-001': ('capas', 'meninges', X), 'snc-002': ('capas', 'duramadre', X), 'snc-003': ('capas', 'piamadre', X),
    'snc-004': ('capas', 'subaracnoideo', X), 'snc-005': ('capas', 'subdural', X), 'snc-006': ('senos', 'hoz_cerebro', X),
    'snc-008': ('senos', 'hoz_cerebelo', X), 'snc-010': ('capas', 'meningea_media', X), 'snc-011': ('capas', 'aracnoides', X),
    'snc-012': ('capas', 'vellosidades', X), 'snc-019': ('capas', 'gris', X), 'snc-020': ('capas', 'blanca', X),
    'snc-048': ('senos', 'carotida_cavernosa', X), 'snc-053': ('senos', 'sagital_superior', X), 'snc-055': ('senos', 'confluencia', X),

    # Pares craneales
    'pares-001': ('nervios', 'cn1', X), 'pares-006': ('nervios', 'cn6', X), 'pares-007': ('nervios', 'cn7', X),
    'pares-008': ('nervios', 'cn8', X), 'pares-009': ('nervios', 'cn9', X), 'pares-010': ('nervios', 'cn10', X),
    'pares-011': ('nervios', 'cn11', X), 'pares-012': ('nervios', 'cn12', X),
    'pares-013': ('nervios', 'cn5', X), 'pares-014': ('nervios', 'cn6', X), 'pares-015': ('nervios', 'cn7', X),
    'pares-016': ('nervios', 'cn9', X), 'pares-017': ('nervios', 'cn10', X), 'pares-018': ('nervios', 'cn12', X),
    'pares-032': ('nervios', 'cn5+cn7+cn9+cn10', EX), 'pares-034': ('cara_lado', 'facial', X),
    'pares-036': ('cara_lado', 'parotida', X), 'pares-037': ('oido', 'cuerda_timpano', X),
    'pares-038': ('cara_lado', 'marginal', X), 'pares-039': ('oido', 'ganglio_geniculado', X),
    'pares-040': ('oido', 'viii', X), 'pares-041': ('oido', 'vestibular', X), 'pares-042': ('oido', 'coclear', X),

    # Ojo
    'ojo-001': ('cara_frente', 'orbicular_ojo', X), 'ojo-003': ('parpado', 'septo', X), 'ojo-004': ('parpado', 'moll', X),
    'ojo-005': ('parpado', 'zeis', X), 'ojo-007': ('parpado', 'punto_lagrimal', X), 'ojo-009': ('parpado', 'muller', X),
    'ojo-010': ('parpado', 'conjuntiva', X), 'ojo-011': ('parpado', 'fornix', X), 'ojo-035': ('via_optica', 'nasal', X),
    'ojo-038': ('ojo_corte', 'humor_acuoso', X),

    # Oído
    'oido-001': ('oido', 'trompa', X), 'oido-002': ('oido', 'interno', X), 'oido-003': ('oido', 'medio', X),
    'oido-005': ('carotida', 'temporal_superficial', X), 'oido-006': ('carotida', 'auricular_posterior', X),
    'oido-007': ('cara_lado', 'auricular_mayor', X), 'oido-008': ('oido', 'conducto', R),
    'oido-009': ('oido', 'timpano', X), 'oido-010': ('oido', 'tensa', X), 'oido-011': ('oido', 'flacida', X),
    'oido-012': ('oido', 'martillo', X), 'oido-013': ('oido', 'umbo', X), 'oido-014': ('caja', 'promontorio', X),
    'oido-015': ('caja', 'epitimpano', X), 'oido-016': ('caja', 'techo', X), 'oido-017': ('caja', 'piso', X),
    'oido-018': ('caja', 'posterior', X), 'oido-019': ('caja', 'medial', X), 'oido-020': ('caja', 'jacobson', X),
    'oido-021': ('caja', 'oval', X), 'oido-022': ('caja', 'redonda', X), 'oido-023': ('oido', 'yunque', X),
    'oido-024': ('oido', 'estribo', X), 'oido-025': ('oido', 'platina', X), 'oido-026': ('oido', 'estapedio', X),
    'oido-027': ('oido', 'tensor_timpano', X), 'oido-028': ('cara_lado', 'plexo_pterigoideo', X),
    'oido-029': ('oido', 'utriculo', X), 'oido-030': ('oido', 'saculo', X), 'oido-031': ('oido', 'canales', X),
    'oido-032': ('coclea', 'endolinfa', X), 'oido-033': ('coclea', 'perilinfa', X), 'oido-034': ('oido', 'basal', X),
    'oido-035': ('oido', 'apical', X), 'oido-036': ('coclea', 'corti', X), 'oido-037': ('coclea', 'tectoria', X),
    'oido-038': ('oido', 'helicotrema', X), 'oido-039': ('oido', 'membranoso', X), 'oido-040': ('oido', 'coclea', X),

    # Cara
    'cara-001': ('capas', 'aponeurosis', X), 'cara-002': ('capas', 'pericraneo', X), 'cara-003': ('cara_frente', 'frontal_m', X),
    'cara-004': ('cara_frente', 'corrugador', X), 'cara-005': ('cara_frente', 'procer', X), 'cara-006': ('cara_frente', 'risorio', X),
    'cara-007': ('cara_frente', 'buccinador', X), 'cara-008': ('cara_frente', 'orbicular_boca', X), 'cara-009': ('cara_frente', 'columela', X),
    'cara-017': ('cabeza_sagital', 'esfenopalatina', X), 'cara-018': ('cabeza_sagital', 'vidiano', X),
    'cara-020': ('cabeza_sagital', 'meato_m', X), 'cara-021': ('cabeza_sagital', 'meato_s', X),
    'cara-022': ('cara_frente', 'bermellon', X), 'cara-023': ('cara_frente', 'filtrum', X),
    'cara-038': ('cara_lado', 'parotida', X), 'cara-039': ('cara_lado', 'stensen', X), 'cara-044': ('cara_lado', 'masetero', X),
    'cara-049': ('cabeza_sagital', 'adenoides', X), 'cara-050': ('cabeza_sagital', 'waldeyer', X), 'cara-051': ('cabeza_sagital', 'amigdala_palatina', X),

    # Cuello
    'cuello-028': ('tiroides', 'istmo', X), 'cuello-029': ('tiroides', 'piramidal', X), 'cuello-030': ('tiroides', 'tiroides_g', SRC),
    'cuello-031': ('tiroides', 'tiroides_g', SRC), 'cuello-032': ('tiroides', 'tiroides_g', SRC), 'cuello-034': ('tiroides', 'paratiroides', SRC),
    'cuello-037': ('carotida', 'tiroidea_superior', X), 'cuello-038': ('carotida', 'maxilar_a', X), 'cuello-044': ('cara_lado', 'yugular_externa', X),

    # SNP, médula y columna
    'snp-001': ('autonomo', 'somatico', X), 'snp-002': ('autonomo', 'autonomo', X), 'snp-003': ('autonomo', 'ach_somatico', R),
    'snp-004': ('autonomo', 'simpatico', X), 'snp-005': ('autonomo', 'parasimpatico', X), 'snp-006': ('autonomo', 'simpatico', X),
    'snp-007': ('autonomo', 'parasimpatico', X), 'snp-008': ('autonomo', 'vago_a', X), 'snp-009': ('autonomo', 'postganglionar', X),
    'snp-012': ('columna', 'filum', X), 'snp-016': ('plexo_braquial', 'plexo_braquial', X), 'snp-022': ('columna', 'foramen_iv', X),
    'snp-034': ('columna', 'coxis', X), 'snp-035': ('columna', 'amarillo', X), 'snp-036': ('columna', 'nucal', X),
    'snp-037': ('columna', 'interespinoso', X), 'snp-038': ('columna', 'llp', X),

    # Tórax
    'torax-023': ('pleura', 'parietal', X), 'torax-036': ('linfa', 'conducto_toracico', X), 'torax-041': ('espalda', 'dorsal_ancho', X),
    'torax-043': ('mama', 'cooper', X), 'torax-044': ('mama', 'galactoforos', X), 'torax-045': ('mama', 'spence', X),
    'torax-046': ('mama', 'areola', X), 'torax-062': ('conduccion', 'his', X), 'torax-063': ('conduccion', 'purkinje', X),
    'torax-064': ('ciclo', 'sistole', X), 'torax-065': ('ciclo', 'diastole', X),

    # Abdomen
    'abdomen-001': ('pared_abdominal', 'hipocondrio', X), 'abdomen-002': ('pared_corte', 'transverso', X),
    'abdomen-003': ('pared_abdominal', 'piramidal_a', X), 'abdomen-004': ('pared_corte', 'camper', X), 'abdomen-005': ('pared_corte', 'scarpa', X),
    'abdomen-007': ('pared_abdominal', 'oblicuo_int', X), 'abdomen-008': ('pared_abdominal', 'recto_abd', X),
    'abdomen-010': ('pared_abdominal', 'semilunar', X), 'abdomen-011': ('pared_abdominal', 'douglas', X),
    'abdomen-012': ('pared_abdominal', 'canal_inguinal', X), 'abdomen-013': ('pared_abdominal', 'lig_inguinal', X),
    'abdomen-015': ('pared_abdominal', 'subcostal', X), 'abdomen-018': ('pared_corte', 'cuadrado_lumbar', X),
    'abdomen-019': ('peritoneo', 'peritoneo', X), 'abdomen-023': ('peritoneo', 'winslow', X), 'abdomen-024': ('peritoneo', 'epiplon_menor', X),
    'abdomen-048': ('colon', 'sigmoide', X), 'abdomen-053': ('pared_intestinal', 'auerbach', X), 'abdomen-054': ('pared_intestinal', 'meissner', X),
    'abdomen-075': ('linfa', 'cisterna', X),

    # Pelvis y periné
    'pelvis-010': ('pelvis_comparada', 'femenina', X), 'pelvis-015': ('plexo_sacro', 'ciatico', X), 'pelvis-019': ('iliaca_interna', 'umbilical', X),
    'pelvis-028': ('masculino', 'pampiniforme', X), 'pelvis-029': ('masculino', 'deferente', X), 'pelvis-033': ('masculino', 'cowper', X),
    'pelvis-034': ('masculino', 'dartos', X), 'pelvis-036': ('masculino', 'rafe', X), 'pelvis-038': ('masculino', 'prepucio', X),
    'pelvis-040': ('masculino', 'colles', X), 'pelvis-041': ('femenino', 'ovario', X), 'pelvis-042': ('femenino', 'ovario', SRC),
    'pelvis-043': ('femenino', 'mesometrio', X), 'pelvis-044': ('femenino', 'mesosalpinx', X), 'pelvis-045': ('femenino', 'mesovario', X),
    'pelvis-046': ('femenino', 'trompa', X), 'pelvis-047': ('femenino', 'fimbrias', X), 'pelvis-048': ('femenino', 'ampolla', X),
    'pelvis-049': ('femenino', 'infundibulo', X), 'pelvis-050': ('femenino', 'cervix', X), 'pelvis-051': ('femenino_sagital', 'anteversion', X),
    'pelvis-052': ('femenino_sagital', 'anteflexion', X), 'pelvis-053': ('femenino_sagital', 'douglas_f', X),
    'pelvis-054': ('femenino', 'ligamento_ancho', X), 'pelvis-055': ('femenino', 'endometrio', X), 'pelvis-056': ('femenino', 'miometrio', X),
    'pelvis-057': ('femenino', 'perimetrio', X), 'pelvis-058': ('vulva', 'himen', X), 'pelvis-059': ('vulva', 'monte_venus', X),
    'pelvis-060': ('vulva', 'clitoris', X), 'pelvis-061': ('vulva', 'labios_mayores', X), 'pelvis-062': ('vulva', 'bartholin', X),
    'pelvis-065': ('conducto_anal', 'pectinea', X), 'pelvis-066': ('conducto_anal', 'esfinter_interno', X), 'pelvis-076': ('plexo_sacro', 'plexo_sacro', X),

    # Miembro superior
    'miembro-superior-056': ('plexo_braquial', 'plexo_braquial', X),
}
