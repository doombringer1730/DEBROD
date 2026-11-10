'use client'

import { DIAGRAMS, type Shape } from './index.ts'

// Draws a diagram with the given parts in red. No labels: during a round the
// red part is the question, so naming it would give the answer away.

export default function DiagramView({ name, part, label, onPick, nameOf }: {
  name: string; part: string; label: string
  /** Explore: called with the part names of the shape clicked. */
  onPick?: (parts: string[]) => void
  /** Explore: the name to show for a shape, if it is something you can learn. */
  nameOf?: (parts: string[]) => string | null
}) {
  const d = DIAGRAMS[name]
  if (!d) return null
  const on = new Set(part.split('+'))
  const lit = (s: Shape) => (s.p ?? '').split(' ').some((p) => on.has(p))
  return (
    <svg className="an-dg has-focus" viewBox={`0 0 ${d.view[0]} ${d.view[1]}`} role="img" aria-label={label}>
      <defs>
        <marker id="an-dg-ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10Z" fill="rgb(236 235 232 / .6)" />
        </marker>
        <marker id="an-dg-ar-on" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0L10 5L0 10Z" fill="#e0323c" />
        </marker>
      </defs>
      {d.shapes.map((s, i) => {
        const hit = lit(s)
        if (s.x && !hit) return null
        const parts = (s.p ?? '').split(' ').filter(Boolean)
        const name = nameOf && parts.length ? nameOf(parts) : null
        const props = {
          className: `an-dg-${s.k}${hit ? ' is-on' : ''}`,
          transform: s.t,
          style: s.w != null ? { strokeWidth: s.w } : undefined,
          markerEnd: s.k === 'a' ? `url(#an-dg-ar${hit ? '-on' : ''})` : undefined,
          ...(onPick && name ? { onClick: () => onPick(parts), 'data-pick': '' } : {}),
        }
        const tip = name ? <title>{name}</title> : null
        if (s.d) return <path key={i} {...props} d={s.d}>{tip}</path>
        if (s.c) return <circle key={i} {...props} cx={s.c[0]} cy={s.c[1]} r={s.c[2]}>{tip}</circle>
        if (s.e) return <ellipse key={i} {...props} cx={s.e[0]} cy={s.e[1]} rx={s.e[2]} ry={s.e[3]}>{tip}</ellipse>
        if (s.r) return <rect key={i} {...props} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4] ?? 0}>{tip}</rect>
        return null
      })}
    </svg>
  )
}
