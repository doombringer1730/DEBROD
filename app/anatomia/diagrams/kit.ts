// Schematic diagrams for items that have no 3D structure (the inner ear,
// concepts, anatomy BodyParts3D lacks). Each diagram is plain data: shapes,
// each tagged with the part names it belongs to. An item points at a diagram
// and a part ("a+b" for several); that part is drawn in red. Labels are never
// drawn during a round, so the diagram does not give the answer away.

export type Kind =
  | 'b' // bone or firm context
  | 's' // soft structure
  | 'q' // deep or hidden structure (dashed)
  | 'o' // space or cavity
  | 'c' // cord: nerve, vessel, duct, fibre (stroke only)
  | 'l' // thin line (stroke only)
  | 'a' // arrow
  | 'pl' // plane

export type Shape = {
  k: Kind
  d?: string // path
  c?: [number, number, number] // circle cx cy r
  e?: [number, number, number, number] // ellipse cx cy rx ry
  r?: [number, number, number, number, number?] // rect x y w h rx
  p?: string // part names, space separated
  w?: number // stroke width for cords, lines and arrows
  t?: string // SVG transform, e.g. a mirror
  x?: 1 // drawn only while one of its parts is lit
}

export type Diagram = {
  title: { es: string; en: string }
  view: [number, number] // width, height of the viewBox
  shapes: Shape[]
}

export const P = (k: Kind, d: string, p?: string, w?: number): Shape => ({ k, d, p, w })
export const E = (k: Kind, cx: number, cy: number, rx: number, ry: number, p?: string): Shape => ({ k, e: [cx, cy, rx, ry], p })
export const C = (k: Kind, cx: number, cy: number, r: number, p?: string): Shape => ({ k, c: [cx, cy, r], p })
export const R = (k: Kind, x: number, y: number, w: number, h: number, p?: string, rx = 0): Shape => ({ k, r: [x, y, w, h, rx], p })

/** The same shapes reflected across the vertical line x = axis. */
export const mirror = (axis: number, shapes: Shape[]): Shape[] =>
  shapes.map((s) => ({ ...s, t: `translate(${2 * axis} 0) scale(-1 1)${s.t ? ' ' + s.t : ''}` }))

/** Shapes moved by dx, dy. */
export const move = (dx: number, dy: number, shapes: Shape[]): Shape[] =>
  shapes.map((s) => ({ ...s, t: `translate(${dx} ${dy})${s.t ? ' ' + s.t : ''}` }))

/** An elliptical ring (outer minus inner) as one path. */
export function ring(cx: number, cy: number, rxo: number, ryo: number, rxi: number, ryi: number) {
  const el = (rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`
  return el(rxo, ryo) + el(rxi, ryi)
}

/** Every part name a diagram uses. */
export function partsOf(d: Diagram): Set<string> {
  const out = new Set<string>()
  for (const s of d.shapes) for (const p of (s.p ?? '').split(' ')) if (p) out.add(p)
  return out
}
