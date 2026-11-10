import { BASICS } from './basics.ts'
import { BODY } from './body.ts'
import { HEAD } from './head.ts'
import { partsOf, type Diagram } from './kit.ts'

export type { Diagram, Shape } from './kit.ts'
export const DIAGRAMS: Record<string, Diagram> = { ...HEAD, ...BODY, ...BASICS }
export { partsOf }
