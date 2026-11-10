import type { Item } from './engine'
import u01 from './data/units/01-fundamentos.json'
import u02 from './data/units/02-craneo.json'
import u03 from './data/units/03-snc.json'
import u04 from './data/units/04-pares.json'
import u05 from './data/units/05-ojo.json'
import u06 from './data/units/06-oido.json'
import u07 from './data/units/07-cara.json'
import u08 from './data/units/08-cuello.json'
import u09 from './data/units/09-snp.json'
import u10 from './data/units/10-torax.json'
import u11 from './data/units/11-abdomen.json'
import u12 from './data/units/12-pelvis.json'
import u13 from './data/units/13-miembro-superior.json'
import u14 from './data/units/14-miembro-inferior.json'

export type Unit = { slug: string; n: number; title: string; titleEn: string; pages: string; items: Item[] }

const unit = (n: number, slug: string, title: string, titleEn: string, pages: string, items: unknown): Unit => ({
  n, slug, title, titleEn, pages, items: items as Item[],
})

export const UNITS: Unit[] = [
  unit(1, 'fundamentos', 'Fundamentos', 'Foundations', '2–11', u01),
  unit(2, 'craneo', 'Cráneo', 'Skull', '11–23', u02),
  unit(3, 'snc', 'Sistema nervioso central', 'Central nervous system', '24–32', u03),
  unit(4, 'pares', 'Pares craneales', 'Cranial nerves', '33–37', u04),
  unit(5, 'ojo', 'Ojo y órbita', 'Eye and orbit', '38–43', u05),
  unit(6, 'oido', 'Oído', 'Ear', '43–47', u06),
  unit(7, 'cara', 'Cara, nariz y boca', 'Face, nose and mouth', '49–58', u07),
  unit(8, 'cuello', 'Cuello', 'Neck', '59–64', u08),
  unit(9, 'snp', 'SNP, médula y columna', 'PNS, spinal cord and spine', '65–69', u09),
  unit(10, 'torax', 'Tórax', 'Thorax', '70–84', u10),
  unit(11, 'abdomen', 'Abdomen', 'Abdomen', '85–105', u11),
  unit(12, 'pelvis', 'Pelvis y periné', 'Pelvis and perineum', '106–122', u12),
  unit(13, 'miembro-superior', 'Miembro superior', 'Upper limb', '124–130, 134', u13),
  unit(14, 'miembro-inferior', 'Miembro inferior', 'Lower limb', '131–133', u14),
]
