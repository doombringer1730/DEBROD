// Collision and movement. Everything collides as axis-aligned boxes: block
// cells, the world-space bounds of each part, and each character's body.
// Unanchored parts fall and slide but do not rotate.
import { Vector3, CFrame } from './math.js'

const EPS = 1e-4
const CELL = 16
const key3 = (x, y, z) => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)
const LARGE = 400 // parts spanning more grid cells than this are checked directly
let stamp = 0 // shared by every grid so a query over two grids never skips a part

class Grid {
  constructor() {
    this.cells = new Map()
    this.large = new Set()
    this.keys = new Map()
  }
  clear() {
    this.cells.clear()
    this.large.clear()
    this.keys.clear()
  }
  // margin widens the cells a part is filed under, for parts that move during a step.
  insert(p, margin = 0) {
    const a = p.getAABB()
    const x0 = Math.floor((a.min[0] - margin) / CELL), x1 = Math.floor((a.max[0] + margin) / CELL)
    const y0 = Math.floor((a.min[1] - margin) / CELL), y1 = Math.floor((a.max[1] + margin) / CELL)
    const z0 = Math.floor((a.min[2] - margin) / CELL), z1 = Math.floor((a.max[2] + margin) / CELL)
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > LARGE) {
      this.large.add(p)
      this.keys.set(p, null)
      return
    }
    const keys = []
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const k = key3(x, y, z)
          let c = this.cells.get(k)
          if (!c) this.cells.set(k, (c = []))
          c.push(p)
          keys.push(k)
        }
    this.keys.set(p, keys)
  }
  remove(p) {
    if (!this.keys.has(p)) return
    const keys = this.keys.get(p)
    this.keys.delete(p)
    if (!keys) {
      this.large.delete(p)
      return
    }
    for (const k of keys) {
      const c = this.cells.get(k)
      const i = c.indexOf(p)
      if (i >= 0) c.splice(i, 1)
      if (!c.length) this.cells.delete(k)
    }
  }
  query(min, max, fn) {
    const s = ++stamp
    for (const p of this.large) fn(p)
    const x0 = Math.floor(min[0] / CELL), x1 = Math.floor(max[0] / CELL)
    const y0 = Math.floor(min[1] / CELL), y1 = Math.floor(max[1] / CELL)
    const z0 = Math.floor(min[2] / CELL), z1 = Math.floor(max[2] / CELL)
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const c = this.cells.get(key3(x, y, z))
          if (!c) continue
          for (const p of c) {
            if (p._qstamp === s) continue
            p._qstamp = s
            fn(p)
          }
        }
  }
}

export function overlaps(amin, amax, bmin, bmax, e = EPS) {
  return amin[0] < bmax[0] - e && amax[0] > bmin[0] + e &&
    amin[1] < bmax[1] - e && amax[1] > bmin[1] + e &&
    amin[2] < bmax[2] - e && amax[2] > bmin[2] + e
}

export class Physics {
  constructor(engine) {
    this.engine = engine
    this.parts = new Set()
    this.staticGrid = new Grid() // anchored parts
    this.dynamic = new Set() // unanchored parts
    this.dynGrid = new Grid() // unanchored parts, refiled every step
    this.bodies = new Set() // humanoid bodies: { min, max, humanoid }
    this.contacts = new Map() // mover part -> Set<part>
    this.moved = new Set() // anchored parts moved this step
  }

  add(part) {
    this.parts.add(part)
    this._classify(part)
  }
  remove(part) {
    this.parts.delete(part)
    this.staticGrid.remove(part)
    this.dynamic.delete(part)
    this.dynGrid.remove(part)
    const c = this.contacts.get(part)
    if (c) {
      for (const o of c) o.TouchEnded.Fire(part)
      this.contacts.delete(part)
    }
    for (const set of this.contacts.values()) set.delete(part)
  }
  _classify(part) {
    this.staticGrid.remove(part)
    this.dynamic.delete(part)
    this.dynGrid.remove(part)
    // Humanoid roots move with their body; welded parts move with their
    // assembly and only collide when that assembly is anchored.
    if (part._controlled) return
    if (part._jointed) {
      if (part._assemblyStatic) this.staticGrid.insert(part)
    } else if (part._p.Anchored) this.staticGrid.insert(part)
    else {
      this.dynamic.add(part)
      this.dynGrid.insert(part, 2)
    }
  }
  _refileDynamic() {
    this.dynGrid.clear()
    for (const p of this.dynamic) this.dynGrid.insert(p, 2)
  }
  reclassify(part) { if (this.parts.has(part)) this._classify(part) }
  // A part's CFrame was moved by the engine (not by a script).
  movedSilently(part) {
    if (this.staticGrid.keys.has(part)) {
      this.staticGrid.remove(part)
      this.staticGrid.insert(part)
    }
  }
  changed(part, key) {
    if (!this.parts.has(part)) return
    if (key === 'Anchored') this._classify(part)
    else if ((key === 'CFrame' || key === 'Size') && this.staticGrid.keys.has(part)) {
      const before = part._lastPos
      this.staticGrid.remove(part)
      this.staticGrid.insert(part)
      if (key === 'CFrame') {
        const p = part._p.CFrame.Position
        if (before) {
          part._moveDelta[0] += p.X - before[0]
          part._moveDelta[1] += p.Y - before[1]
          part._moveDelta[2] += p.Z - before[2]
          this.moved.add(part)
        }
        part._lastPos = [p.X, p.Y, p.Z]
      }
    }
  }

  // Calls fn(min, max, obj) for each solid thing overlapping the box.
  // obj is a part, a body, or the string 'terrain'. skip(obj) excludes things.
  obstacles(min, max, skip, fn) {
    const vox = this.engine.voxels
    if (vox) vox.forEachSolid(min, max, (x0, y0, z0, x1, y1, z1) => fn([x0, y0, z0], [x1, y1, z1], 'terrain'))
    const test = (p) => {
      if (!p._p.CanCollide || (skip && skip(p))) return
      const a = p.getAABB()
      if (overlaps(min, max, a.min, a.max)) fn(a.min, a.max, p)
    }
    this.staticGrid.query(min, max, test)
    this.dynGrid.query(min, max, test)
    for (const b of this.bodies) {
      if (skip && skip(b)) continue
      if (overlaps(min, max, b.min, b.max)) fn(b.min, b.max, b)
    }
  }

  // Moves box {min,max} by delta, stopping at obstacles. Returns which axes hit and what.
  moveBox(box, delta, skip) {
    const res = { hit: [false, false, false], obj: [null, null, null] }
    const dist = Math.max(Math.abs(delta[0]), Math.abs(delta[1]), Math.abs(delta[2]))
    const steps = Math.max(1, Math.ceil(dist / 1.5))
    const order = [1, 0, 2]
    for (let s = 0; s < steps; s++) {
      for (const axis of order) {
        if (res.hit[axis]) continue
        const d = delta[axis] / steps
        if (d) this._sweep(box, axis, d, skip, res)
      }
    }
    return res
  }
  _sweep(box, axis, d, skip, res) {
    box.min[axis] += d
    box.max[axis] += d
    let push = 0
    let hitObj = null
    const lim = Math.abs(d) + EPS * 10
    this.obstacles(box.min, box.max, skip, (omin, omax, obj) => {
      if (d > 0) {
        const corr = omin[axis] - box.max[axis]
        if (corr < push && -corr <= lim) { push = corr; hitObj = obj }
      } else {
        const corr = omax[axis] - box.min[axis]
        if (corr > push && corr <= lim) { push = corr; hitObj = obj }
      }
    })
    if (hitObj) {
      box.min[axis] += push
      box.max[axis] += push
      res.hit[axis] = true
      res.obj[axis] = hitObj
    }
  }

  step(dt) {
    const ws = this.engine.workspace
    const g = ws.Gravity
    const fallY = ws.FallenPartsDestroyHeight
    for (const h of this.engine.humanoids) h._step(dt)
    for (const p of this.moved) p._moveDelta = [0, 0, 0]
    this.moved.clear()
    this._refileDynamic()

    for (const p of [...this.dynamic]) {
      if (p._destroyed) continue
      if (p._sleep > 0.5) {
        p._sleep += dt
        if (p._sleep < 1) continue
        p._sleep = 0.4 // wake briefly to check support
      }
      const v = p._p.AssemblyLinearVelocity
      let vx = v.X, vy = v.Y - g * dt, vz = v.Z
      const a = p.getAABB()
      const box = { min: a.min.slice(), max: a.max.slice() }
      const res = this.moveBox(box, [vx * dt, vy * dt, vz * dt], (o) => o === p)
      if (res.hit[1]) {
        if (vy < 0) {
          p._grounded = true
          const f = Math.exp(-8 * dt)
          vx *= f
          vz *= f
        }
        vy = 0
      } else p._grounded = false
      if (res.hit[0]) vx = 0
      if (res.hit[2]) vz = 0
      const moved = box.min[0] - a.min[0] || box.min[1] - a.min[1] || box.min[2] - a.min[2]
      if (moved) {
        const pos = p._p.CFrame.Position
        p._setPhysicsCFrame(new CFrame(
          new Vector3(pos.X + box.min[0] - a.min[0], pos.Y + box.min[1] - a.min[1], pos.Z + box.min[2] - a.min[2]),
          null, null, p._p.CFrame.q,
        ))
      }
      p._p.AssemblyLinearVelocity = new Vector3(vx, vy, vz)
      if (p._grounded && Math.abs(vx) + Math.abs(vy) + Math.abs(vz) < 0.05) p._sleep = (p._sleep || 0) + dt
      else p._sleep = 0
      if (p._p.CFrame.Position.Y < fallY) p.Destroy()
    }
    this._touches()
  }

  // Fires Touched / TouchEnded for moving things.
  _touches() {
    const movers = []
    for (const p of this.dynamic) if (p._sleep <= 0.5 && p._p.CanTouch) movers.push([p, p.getAABB(), p])
    for (const b of this.bodies) if (b.root) movers.push([b.root, b, b])
    const seen = new Set()
    for (const [part, box, self] of movers) {
      seen.add(part)
      const min = [box.min[0] - 0.05, box.min[1] - 0.05, box.min[2] - 0.05]
      const max = [box.max[0] + 0.05, box.max[1] + 0.05, box.max[2] + 0.05]
      const now = new Set()
      const test = (o) => {
        if (o === part || o === self || !o._p.CanTouch || (self.model && o.IsDescendantOf(self.model))) return
        const a = o.getAABB()
        if (overlaps(min, max, a.min, a.max, 0)) now.add(o)
      }
      this.staticGrid.query(min, max, test)
      this.dynGrid.query(min, max, test)
      const before = this.contacts.get(part) || new Set()
      for (const o of now) {
        if (before.has(o)) continue
        o.Touched.Fire(part)
        part.Touched.Fire(o)
      }
      for (const o of before) {
        if (now.has(o)) continue
        o.TouchEnded.Fire(part)
        part.TouchEnded.Fire(o)
      }
      if (now.size) this.contacts.set(part, now)
      else this.contacts.delete(part)
    }
    for (const k of this.contacts.keys()) if (!seen.has(k)) this.contacts.delete(k)
  }

  touchingParts(part) {
    const a = part.getAABB()
    const out = []
    const min = a.min.map((v) => v - 0.05), max = a.max.map((v) => v + 0.05)
    const test = (o) => {
      if (o === part) return
      const b = o.getAABB()
      if (overlaps(min, max, b.min, b.max, 0)) out.push(o)
    }
    this.staticGrid.query(min, max, test)
    this.dynGrid.query(min, max, test)
    return out
  }

  partsInBox(min, max) {
    const out = []
    const test = (o) => {
      const b = o.getAABB()
      if (overlaps(min, max, b.min, b.max, 0)) out.push(o)
    }
    this.staticGrid.query(min, max, test)
    this.dynGrid.query(min, max, test)
    return out
  }

  // Ray against parts (exact for blocks and balls) and terrain.
  raycast(origin, dir, maxDist, filter) {
    let best = null
    const len = Math.hypot(dir[0], dir[1], dir[2])
    if (!len) return null
    const d = [dir[0] / len, dir[1] / len, dir[2] / len]
    const vox = this.engine.voxels
    if (vox && (!filter || filter('terrain'))) {
      const h = vox.raycast(origin, d, maxDist)
      if (h) best = { distance: h.distance, position: h.position, normal: h.normal, instance: 'terrain', cell: h.cell, id: h.id }
    }
    const limit = () => (best ? best.distance : maxDist)
    for (const p of this.parts) {
      if (filter && !filter(p)) continue
      const a = p.getAABB()
      const t0 = slab(origin, d, a.min, a.max)
      if (t0 === null || t0 > limit()) continue
      const hit = rayPart(p, origin, d)
      if (hit && hit.distance <= limit()) best = { ...hit, instance: p }
    }
    return best
  }
}

function slab(o, d, min, max) {
  let tmin = 0, tmax = Infinity
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < min[i] || o[i] > max[i]) return null
      continue
    }
    let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i]
    if (t1 > t2) [t1, t2] = [t2, t1]
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  return tmin
}

function rayPart(p, o, d) {
  const cf = p._p.CFrame
  const s = p._p.Size
  const lo = cf.PointToObjectSpace(new Vector3(o[0], o[1], o[2]))
  const ld = cf.VectorToObjectSpace(new Vector3(d[0], d[1], d[2]))
  const shape = p.shapeName
  if (shape === 'Ball') {
    const r = Math.min(s.X, s.Y, s.Z) / 2
    const b = lo.Dot(ld)
    const c = lo.Dot(lo) - r * r
    const disc = b * b - c
    if (disc < 0) return null
    let t = -b - Math.sqrt(disc)
    if (t < 0) t = -b + Math.sqrt(disc)
    if (t < 0) return null
    const lp = lo.add(ld.mul(t))
    const n = cf.VectorToWorldSpace(lp.Unit)
    const wp = cf.PointToWorldSpace(lp)
    return { distance: t, position: [wp.X, wp.Y, wp.Z], normal: [n.X, n.Y, n.Z] }
  }
  const h = [s.X / 2, s.Y / 2, s.Z / 2]
  const lov = [lo.X, lo.Y, lo.Z], ldv = [ld.X, ld.Y, ld.Z]
  let tmin = 0, tmax = Infinity, axis = -1, sign = 0
  for (let i = 0; i < 3; i++) {
    if (Math.abs(ldv[i]) < 1e-12) {
      if (lov[i] < -h[i] || lov[i] > h[i]) return null
      continue
    }
    let t1 = (-h[i] - lov[i]) / ldv[i], t2 = (h[i] - lov[i]) / ldv[i]
    let s1 = -1
    if (t1 > t2) { [t1, t2] = [t2, t1]; s1 = 1 }
    if (t1 > tmin) { tmin = t1; axis = i; sign = s1 }
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  if (axis < 0) {
    // Origin is inside the part.
    return { distance: 0, position: o.slice(), normal: [-d[0], -d[1], -d[2]] }
  }
  const nl = [0, 0, 0]
  nl[axis] = sign
  const n = cf.VectorToWorldSpace(new Vector3(nl[0], nl[1], nl[2]))
  const wp = cf.PointToWorldSpace(lo.add(ld.mul(tmin)))
  return { distance: tmin, position: [wp.X, wp.Y, wp.Z], normal: [n.X, n.Y, n.Z] }
}
