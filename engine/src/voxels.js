// The block world: a fixed-size grid of blocks, BLOCK studs on a side,
// meshed per 16x16x16 chunk with hidden faces removed and corner shading.
import * as THREE from 'three'
import { defineEnum } from './enum.js'
import { Vector3 } from './math.js'

export const BLOCK = 4
const CH = 16

export const BLOCKS = [
  { name: 'Air' },
  { name: 'Grass', top: 0x6cbb3c, side: 0x8a6a3f, bottom: 0x8a6a3f },
  { name: 'Dirt', top: 0x8a6a3f },
  { name: 'Stone', top: 0x8d8f93 },
  { name: 'Sand', top: 0xe3d39a },
  { name: 'Wood', top: 0xa37d4a, side: 0x6b4a2b },
  { name: 'Leaves', top: 0x3f8f35 },
  { name: 'Planks', top: 0xc09a5b },
  { name: 'Brick', top: 0xa4483b },
  { name: 'Cobblestone', top: 0x75777a },
  { name: 'Snow', top: 0xf3f6f8 },
  { name: 'Glass', top: 0xcfe9f2, transparent: true },
  { name: 'Water', top: 0x3a7fd0, transparent: true, liquid: true },
  { name: 'Path', top: 0xc8b07a, side: 0x8a6a3f },
  { name: 'Roof', top: 0x8a2f2f },
  { name: 'Whitewash', top: 0xeeeae0 },
]
export const BlockEnum = defineEnum('Block', BLOCKS.map((b) => b.name))
export function blockId(v) {
  if (typeof v === 'number') return v
  const name = typeof v === 'string' ? v : v && v.Name
  const i = BLOCKS.findIndex((b) => b.name === name)
  if (i < 0) throw new Error(`Unknown block "${name}"`)
  return i
}

// Face definitions: normal, origin corner, u and v edges (u x v = normal).
const FACES = [
  { n: [1, 0, 0], o: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], o: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], o: [0, 0, 0], u: [0, 1, 0], v: [1, 0, 0] },
]
const AO = [0.45, 0.65, 0.82, 1]

export class VoxelWorld {
  constructor(engine, { sizeX = 128, sizeY = 48, sizeZ = 128 } = {}) {
    this.engine = engine
    this.sx = sizeX
    this.sy = sizeY
    this.sz = sizeZ
    this.data = new Uint8Array(sizeX * sizeY * sizeZ)
    // World position of block (0,0,0)'s minimum corner. Centered on X and Z.
    this.origin = [(-sizeX / 2) * BLOCK, 0, (-sizeZ / 2) * BLOCK]
    this.group = new THREE.Group()
    this.group.name = 'Terrain'
    this.chunks = new Map()
    this.dirty = new Set()
    this.opaqueMat = new THREE.MeshLambertMaterial({ vertexColors: true })
    this.clearMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })
    this._colors = BLOCKS.map((b) => {
      const c = (hex) => new THREE.Color(hex ?? b.top)
      return { top: c(b.top), side: c(b.side), bottom: c(b.bottom ?? b.side) }
    })
    this.onChange = null
  }

  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz }
  index(x, y, z) { return (y * this.sz + z) * this.sx + x }
  get(x, y, z) { return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : 0 }
  solid(x, y, z) {
    const id = this.get(x, y, z)
    return id !== 0 && !BLOCKS[id].liquid
  }
  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false
    id = blockId(id)
    const i = this.index(x, y, z)
    if (this.data[i] === id) return false
    this.data[i] = id
    const cx = Math.floor(x / CH), cy = Math.floor(y / CH), cz = Math.floor(z / CH)
    this.dirty.add(key(cx, cy, cz))
    if (x % CH === 0) this.dirty.add(key(cx - 1, cy, cz))
    if (x % CH === CH - 1) this.dirty.add(key(cx + 1, cy, cz))
    if (y % CH === 0) this.dirty.add(key(cx, cy - 1, cz))
    if (y % CH === CH - 1) this.dirty.add(key(cx, cy + 1, cz))
    if (z % CH === 0) this.dirty.add(key(cx, cy, cz - 1))
    if (z % CH === CH - 1) this.dirty.add(key(cx, cy, cz + 1))
    if (this.onChange) this.onChange(x, y, z, id)
    return true
  }
  fill(x0, y0, z0, x1, y1, z1, id) {
    id = blockId(id)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, id)
  }
  clear() {
    this.data.fill(0)
    this.markAllDirty()
  }
  markAllDirty() {
    for (let cy = 0; cy < Math.ceil(this.sy / CH); cy++)
      for (let cz = 0; cz < Math.ceil(this.sz / CH); cz++)
        for (let cx = 0; cx < Math.ceil(this.sx / CH); cx++) this.dirty.add(key(cx, cy, cz))
  }

  worldToCell(x, y, z) {
    return [
      Math.floor((x - this.origin[0]) / BLOCK),
      Math.floor((y - this.origin[1]) / BLOCK),
      Math.floor((z - this.origin[2]) / BLOCK),
    ]
  }
  cellToWorld(x, y, z) {
    return [
      this.origin[0] + (x + 0.5) * BLOCK,
      this.origin[1] + (y + 0.5) * BLOCK,
      this.origin[2] + (z + 0.5) * BLOCK,
    ]
  }
  // Height in studs of the top of the highest solid block in a column.
  surfaceY(wx, wz) {
    const [x, , z] = this.worldToCell(wx, 0, wz)
    for (let y = this.sy - 1; y >= 0; y--) if (this.solid(x, y, z)) return this.origin[1] + (y + 1) * BLOCK
    return 0
  }

  // Calls fn(x0,y0,z0,x1,y1,z1) with the world box of every solid block overlapping [min,max].
  forEachSolid(min, max, fn) {
    const a = this.worldToCell(min[0], min[1], min[2])
    const b = this.worldToCell(max[0] - 1e-7, max[1] - 1e-7, max[2] - 1e-7)
    for (let y = Math.max(0, a[1]); y <= Math.min(this.sy - 1, b[1]); y++)
      for (let z = Math.max(0, a[2]); z <= Math.min(this.sz - 1, b[2]); z++)
        for (let x = Math.max(0, a[0]); x <= Math.min(this.sx - 1, b[0]); x++) {
          if (!this.solid(x, y, z)) continue
          const ox = this.origin[0] + x * BLOCK, oy = this.origin[1] + y * BLOCK, oz = this.origin[2] + z * BLOCK
          if (fn(ox, oy, oz, ox + BLOCK, oy + BLOCK, oz + BLOCK, x, y, z) === false) return
        }
  }

  // Voxel ray march. Returns { distance, position:[x,y,z], normal:[x,y,z], cell:[x,y,z], id } or null.
  raycast(origin, dir, maxDist) {
    const len = Math.hypot(dir[0], dir[1], dir[2])
    if (!len) return null
    const d = [dir[0] / len, dir[1] / len, dir[2] / len]
    const p = [(origin[0] - this.origin[0]) / BLOCK, (origin[1] - this.origin[1]) / BLOCK, (origin[2] - this.origin[2]) / BLOCK]
    const cell = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])]
    const step = [], tMax = [], tDelta = []
    for (let i = 0; i < 3; i++) {
      step[i] = d[i] > 0 ? 1 : d[i] < 0 ? -1 : 0
      tDelta[i] = step[i] ? Math.abs(1 / d[i]) : Infinity
      const edge = step[i] > 0 ? cell[i] + 1 - p[i] : p[i] - cell[i]
      tMax[i] = step[i] ? edge * tDelta[i] : Infinity
    }
    const maxT = maxDist / BLOCK
    let t = 0
    let normal = [0, 0, 0]
    for (let n = 0; n < 1024 && t <= maxT; n++) {
      const id = this.get(cell[0], cell[1], cell[2])
      if (id && !BLOCKS[id].liquid) {
        return {
          distance: t * BLOCK,
          position: [origin[0] + d[0] * t * BLOCK, origin[1] + d[1] * t * BLOCK, origin[2] + d[2] * t * BLOCK],
          normal,
          cell: cell.slice(),
          id,
        }
      }
      const axis = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2
      t = tMax[axis]
      tMax[axis] += tDelta[axis]
      cell[axis] += step[axis]
      normal = [0, 0, 0]
      normal[axis] = -step[axis]
    }
    return null
  }

  // Rebuilds up to `budget` dirty chunk meshes.
  update(budget = 8) {
    let n = 0
    for (const k of this.dirty) {
      this.dirty.delete(k)
      const [cx, cy, cz] = k.split(',').map(Number)
      if (cx < 0 || cy < 0 || cz < 0 || cx * CH >= this.sx || cy * CH >= this.sy || cz * CH >= this.sz) continue
      this._buildChunk(cx, cy, cz)
      if (++n >= budget) break
    }
  }
  flush() { while (this.dirty.size) this.update(64) }

  _buildChunk(cx, cy, cz) {
    const k = key(cx, cy, cz)
    const old = this.chunks.get(k)
    if (old) {
      for (const m of old) {
        this.group.remove(m)
        m.geometry.dispose()
      }
      this.chunks.delete(k)
    }
    const bufs = [newBuf(), newBuf()]
    const col = new THREE.Color()
    for (let y = cy * CH; y < Math.min(this.sy, (cy + 1) * CH); y++)
      for (let z = cz * CH; z < Math.min(this.sz, (cz + 1) * CH); z++)
        for (let x = cx * CH; x < Math.min(this.sx, (cx + 1) * CH); x++) {
          const id = this.data[this.index(x, y, z)]
          if (!id) continue
          const def = BLOCKS[id]
          const clear = !!def.transparent
          const buf = bufs[clear ? 1 : 0]
          const jitter = 0.94 + (hash(x, y, z) % 1000) / 1000 * 0.08
          for (let f = 0; f < 6; f++) {
            const F = FACES[f]
            const nb = this.get(x + F.n[0], y + F.n[1], z + F.n[2])
            if (nb) {
              const nd = BLOCKS[nb]
              if (!nd.transparent) continue
              if (clear && nb === id) continue
            }
            const base = f === 2 ? this._colors[id].top : f === 3 ? this._colors[id].bottom : this._colors[id].side
            const ao = []
            for (let c = 0; c < 4; c++) {
              const du = c === 1 || c === 2 ? 1 : -1
              const dv = c === 2 || c === 3 ? 1 : -1
              const bx = x + F.n[0], by = y + F.n[1], bz = z + F.n[2]
              const s1 = this._occ(bx + F.u[0] * du, by + F.u[1] * du, bz + F.u[2] * du)
              const s2 = this._occ(bx + F.v[0] * dv, by + F.v[1] * dv, bz + F.v[2] * dv)
              const cr = this._occ(bx + F.u[0] * du + F.v[0] * dv, by + F.u[1] * du + F.v[1] * dv, bz + F.u[2] * du + F.v[2] * dv)
              ao.push(clear ? 3 : s1 && s2 ? 0 : 3 - (s1 + s2 + cr))
            }
            const start = buf.pos.length / 3
            for (let c = 0; c < 4; c++) {
              const uu = c === 1 || c === 2 ? 1 : 0
              const vv = c === 2 || c === 3 ? 1 : 0
              buf.pos.push(
                this.origin[0] + (x + F.o[0] + F.u[0] * uu + F.v[0] * vv) * BLOCK,
                this.origin[1] + (y + F.o[1] + F.u[1] * uu + F.v[1] * vv) * BLOCK,
                this.origin[2] + (z + F.o[2] + F.u[2] * uu + F.v[2] * vv) * BLOCK,
              )
              buf.nrm.push(F.n[0], F.n[1], F.n[2])
              col.copy(base).multiplyScalar(AO[ao[c]] * jitter)
              buf.col.push(col.r, col.g, col.b)
            }
            if (ao[0] + ao[2] < ao[1] + ao[3]) buf.idx.push(start + 1, start + 2, start + 3, start + 1, start + 3, start)
            else buf.idx.push(start, start + 1, start + 2, start, start + 2, start + 3)
          }
        }
    const meshes = []
    bufs.forEach((b, i) => {
      if (!b.idx.length) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
      g.setIndex(b.idx)
      g.computeBoundingSphere()
      const m = new THREE.Mesh(g, i ? this.clearMat : this.opaqueMat)
      m.castShadow = i === 0
      m.receiveShadow = true
      m.userData.terrain = true
      this.group.add(m)
      meshes.push(m)
    })
    if (meshes.length) this.chunks.set(k, meshes)
  }
  _occ(x, y, z) {
    const id = this.get(x, y, z)
    return id && !BLOCKS[id].transparent ? 1 : 0
  }

  // Compact save format: run-length encoded block ids.
  serialize() {
    const runs = []
    let prev = this.data[0], count = 0
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] === prev && count < 65535) count++
      else {
        runs.push(prev, count)
        prev = this.data[i]
        count = 1
      }
    }
    runs.push(prev, count)
    return { size: [this.sx, this.sy, this.sz], runs }
  }
  deserialize(obj) {
    if (obj.size[0] !== this.sx || obj.size[1] !== this.sy || obj.size[2] !== this.sz) {
      throw new Error('Terrain size does not match this world')
    }
    let i = 0
    for (let r = 0; r < obj.runs.length; r += 2) {
      this.data.fill(obj.runs[r], i, i + obj.runs[r + 1])
      i += obj.runs[r + 1]
    }
    this.markAllDirty()
  }
}

function newBuf() { return { pos: [], nrm: [], col: [], idx: [] } }
function key(x, y, z) { return `${x},${y},${z}` }
export function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}

// Seeded smooth value noise in [0,1].
export function makeNoise(seed = 1) {
  const rnd = (x, z) => (hash(x + seed * 7919, 0, z - seed * 104729) % 100000) / 100000
  const smooth = (t) => t * t * (3 - 2 * t)
  const noise = (x, z) => {
    const x0 = Math.floor(x), z0 = Math.floor(z)
    const fx = smooth(x - x0), fz = smooth(z - z0)
    const a = rnd(x0, z0), b = rnd(x0 + 1, z0), c = rnd(x0, z0 + 1), d = rnd(x0 + 1, z0 + 1)
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz
  }
  return (x, z, octaves = 4) => {
    let sum = 0, amp = 1, freq = 1, norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, z * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}

// Fills the world with rolling hills, beaches, stone and trees.
export function generateHills(world, { seed = 1, base = 8, height = 10, trees = true } = {}) {
  const noise = makeNoise(seed)
  for (let z = 0; z < world.sz; z++)
    for (let x = 0; x < world.sx; x++) {
      const n = noise(x / 40, z / 40)
      const h = Math.max(1, Math.min(world.sy - 8, Math.floor(base + n * height * 1.6 - height * 0.4)))
      for (let y = 0; y < h; y++) {
        let id = 3
        if (y === h - 1) id = h <= base - 1 ? 4 : h > base + height ? 10 : 1
        else if (y >= h - 3) id = h <= base - 1 ? 4 : 2
        world.data[world.index(x, y, z)] = id
      }
      if (trees && h > base && h <= base + height && hash(x, 1, z) % 97 === 0 && x > 2 && z > 2 && x < world.sx - 3 && z < world.sz - 3) {
        plantTree(world, x, h, z)
      }
    }
  world.markAllDirty()
}

export function generateFlat(world, { height = 4, top = 'Grass' } = {}) {
  const t = blockId(top)
  for (let z = 0; z < world.sz; z++)
    for (let x = 0; x < world.sx; x++)
      for (let y = 0; y < height; y++) world.data[world.index(x, y, z)] = y === height - 1 ? t : y >= height - 3 ? 2 : 3
  world.markAllDirty()
}

export function plantTree(world, x, y, z) {
  const trunk = 3 + (hash(x, 2, z) % 2)
  for (let i = 0; i < trunk; i++) world.data[world.index(x, y + i, z)] = 5
  const top = y + trunk
  for (let dy = -1; dy <= 1; dy++)
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) continue
        const X = x + dx, Y = top + dy, Z = z + dz
        if (world.inBounds(X, Y, Z) && !world.data[world.index(X, Y, Z)]) world.data[world.index(X, Y, Z)] = 6
      }
}

export { Vector3 }
