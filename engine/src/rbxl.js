// Imports Roblox place and model files: binary (.rbxl, .rbxm) and XML
// (.rbxlx, .rbxmx). Geometry, colors, materials, names, hierarchy, joints,
// values and lights come across. Script sources are kept as text but
// disabled, since they are Lua and this engine runs JavaScript. Assets
// referenced by rbxassetid (meshes, images, sounds) only load inside Roblox,
// so mesh parts and unions render as boxes of their size.
import * as THREE from 'three'
import { Instance, allProps, isNotCreatable, adoptChild } from './instance.js'
import { Vector3, Color3, CFrame } from './math.js'
import { BasePart } from './parts.js'

// ---------- generic decoded form ----------
// { className, props: Map<name, {t, v}>, children: [], ref }

export function parseRoblox(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const head = new TextDecoder().decode(u8.subarray(0, 16))
  if (head.startsWith('<roblox!')) return parseBinary(u8)
  const text = new TextDecoder().decode(u8)
  if (/^\s*<roblox[\s>]/.test(text)) return parseXml(text)
  throw new Error('Not a Roblox place or model file')
}

// ---------- binary ----------
function lz4(src, size) {
  const dst = new Uint8Array(size)
  let i = 0, o = 0
  while (i < src.length) {
    const tok = src[i++]
    let lit = tok >> 4
    if (lit === 15) { let b; do { b = src[i++]; lit += b } while (b === 255) }
    dst.set(src.subarray(i, i + lit), o)
    i += lit
    o += lit
    if (i >= src.length) break
    const off = src[i] | (src[i + 1] << 8)
    i += 2
    let ml = tok & 15
    if (ml === 15) { let b; do { b = src[i++]; ml += b } while (b === 255) }
    ml += 4
    let s = o - off
    for (let k = 0; k < ml; k++) dst[o++] = dst[s++]
  }
  return dst
}

class Reader {
  constructor(u8) {
    this.u8 = u8
    this.dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
    this.o = 0
  }
  u8_() { return this.u8[this.o++] }
  u32() { const v = this.dv.getUint32(this.o, true); this.o += 4; return v }
  f32() { const v = this.dv.getFloat32(this.o, true); this.o += 4; return v }
  f64() { const v = this.dv.getFloat64(this.o, true); this.o += 8; return v }
  bytes(n) { const b = this.u8.subarray(this.o, this.o + n); this.o += n; return b }
  str() { return new TextDecoder().decode(this.bytes(this.u32())) }
  // n big-endian u32s stored as 4 byte planes
  interleaved(n) {
    const b = this.bytes(n * 4)
    const out = new Uint32Array(n)
    for (let i = 0; i < n; i++) out[i] = ((b[i] << 24) | (b[n + i] << 16) | (b[2 * n + i] << 8) | b[3 * n + i]) >>> 0
    return out
  }
  ints(n) { return Array.from(this.interleaved(n), (v) => (v >>> 1) ^ -(v & 1)) }
  floats(n) {
    const raw = this.interleaved(n)
    const f = new Float32Array(1), u = new Uint32Array(f.buffer)
    return Array.from(raw, (v) => { u[0] = (v >>> 1) | ((v & 1) << 31); return f[0] })
  }
  refs(n) {
    const d = this.ints(n)
    for (let i = 1; i < n; i++) d[i] += d[i - 1]
    return d
  }
}

const NORMALS = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]]

function parseBinary(u8) {
  const magic = u8.subarray(8, 14)
  if (magic[0] !== 0x89 || magic[1] !== 0xff) throw new Error('Damaged Roblox binary file')
  const head = new Reader(u8)
  head.o = 32
  const classes = new Map() // id -> { name, refs }
  const inst = new Map() // ref -> node
  const chunks = []
  while (head.o < u8.length) {
    const name = new TextDecoder().decode(head.bytes(4))
    const clen = head.u32(), ulen = head.u32()
    head.u32()
    let data
    if (clen === 0) data = head.bytes(ulen)
    else {
      const raw = head.bytes(clen)
      if (raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd) {
        throw new Error('This file uses Zstandard compression, which the importer does not read yet. Re-save it as XML (.rbxlx or .rbxmx) from Roblox Studio and import that.')
      }
      data = lz4(raw, ulen)
    }
    chunks.push([name, data])
    if (name === 'END\0') break
  }
  const sstrings = []
  for (const [name, data] of chunks) {
    if (name === 'SSTR') {
      const r = new Reader(data)
      r.u32()
      const n = r.u32()
      for (let i = 0; i < n; i++) { r.bytes(16); sstrings.push(r.str()) }
    }
  }
  for (const [name, data] of chunks) {
    if (name !== 'INST') continue
    const r = new Reader(data)
    const id = r.u32()
    const cname = r.str()
    r.u8_()
    const n = r.u32()
    const refs = r.refs(n)
    classes.set(id, { name: cname, refs })
    for (const ref of refs) inst.set(ref, { className: cname, props: new Map(), children: [], ref, parent: null })
  }
  for (const [name, data] of chunks) {
    if (name !== 'PROP') continue
    const r = new Reader(data)
    const cls = classes.get(r.u32())
    const prop = r.str()
    const type = r.u8_()
    const n = cls.refs.length
    let vals
    try {
      vals = readValues(r, type, n, sstrings)
    } catch {
      continue
    }
    if (!vals) continue
    for (let i = 0; i < n; i++) inst.get(cls.refs[i]).props.set(prop, vals[i])
  }
  const roots = []
  for (const [name, data] of chunks) {
    if (name !== 'PRNT') continue
    const r = new Reader(data)
    r.u8_()
    const n = r.u32()
    const kids = r.refs(n), parents = r.refs(n)
    for (let i = 0; i < n; i++) {
      const c = inst.get(kids[i])
      if (!c) continue
      const p = parents[i] >= 0 ? inst.get(parents[i]) : null
      if (p) { p.children.push(c); c.parent = p } else roots.push(c)
    }
  }
  return { roots, byRef: inst }
}

function readValues(r, type, n, sstrings) {
  const out = new Array(n)
  switch (type) {
    case 0x01: for (let i = 0; i < n; i++) out[i] = { t: 'string', v: r.str() }; return out
    case 0x02: for (let i = 0; i < n; i++) out[i] = { t: 'bool', v: r.u8_() !== 0 }; return out
    case 0x03: return r.ints(n).map((v) => ({ t: 'num', v }))
    case 0x04: return r.floats(n).map((v) => ({ t: 'num', v }))
    case 0x05: for (let i = 0; i < n; i++) out[i] = { t: 'num', v: r.f64() }; return out
    case 0x0b: return Array.from(r.interleaved(n), (v) => ({ t: 'brick', v }))
    case 0x0c: {
      const R = r.floats(n), G = r.floats(n), B = r.floats(n)
      for (let i = 0; i < n; i++) out[i] = { t: 'color', v: new Color3(R[i], G[i], B[i]) }
      return out
    }
    case 0x0e: {
      const X = r.floats(n), Y = r.floats(n), Z = r.floats(n)
      for (let i = 0; i < n; i++) out[i] = { t: 'vec3', v: new Vector3(X[i], Y[i], Z[i]) }
      return out
    }
    case 0x10: case 0x1e: {
      const rots = []
      for (let i = 0; i < n; i++) {
        const id = r.u8_()
        if (id === 0) {
          const m = []
          for (let k = 0; k < 9; k++) m.push(r.f32())
          rots.push(m)
        } else {
          const x = NORMALS[Math.floor((id - 1) / 6)], y = NORMALS[(id - 1) % 6]
          const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]
          // rows of the rotation matrix; x, y, z are its columns
          rots.push([x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]])
        }
      }
      const X = r.floats(n), Y = r.floats(n), Z = r.floats(n)
      for (let i = 0; i < n; i++) out[i] = { t: 'cframe', v: cframeFromRows([X[i], Y[i], Z[i]], rots[i]) }
      return out
    }
    case 0x12: return Array.from(r.interleaved(n), (v) => ({ t: 'enum', v }))
    case 0x13: return r.refs(n).map((v) => ({ t: 'ref', v }))
    case 0x1a: {
      const R = r.bytes(n), G = r.bytes(n), B = r.bytes(n)
      for (let i = 0; i < n; i++) out[i] = { t: 'color', v: Color3.fromRGB(R[i], G[i], B[i]) }
      return out
    }
    case 0x1c: return Array.from(r.interleaved(n), (v) => ({ t: 'string', v: sstrings[v] || '' }))
    default: return null
  }
}

const _m = new THREE.Matrix4()
function cframeFromRows(p, m) {
  _m.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
  const q = new THREE.Quaternion().setFromRotationMatrix(_m).normalize()
  return CFrame.fromQuat(new Vector3(p[0], p[1], p[2]), q)
}

// ---------- XML ----------
function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not read the XML file')
  const byRef = new Map()
  const num = (el, tag) => parseFloat(el.getElementsByTagName(tag)[0]?.textContent || '0')
  const node = (item, parent) => {
    const n = { className: item.getAttribute('class'), props: new Map(), children: [], ref: item.getAttribute('referent'), parent }
    if (n.ref) byRef.set(n.ref, n)
    for (const el of item.children) {
      if (el.tagName === 'Properties') {
        for (const p of el.children) {
          const name = p.getAttribute('name')
          const v = xmlValue(p, num)
          if (v) n.props.set(name, v)
        }
      } else if (el.tagName === 'Item') n.children.push(node(el, n))
    }
    return n
  }
  const roots = [...doc.documentElement.children].filter((e) => e.tagName === 'Item').map((e) => node(e, null))
  return { roots, byRef }
}

function xmlValue(p, num) {
  const t = p.tagName
  const s = p.textContent
  switch (t) {
    case 'string': case 'ProtectedString': case 'Content': case 'BinaryString':
      return { t: 'string', v: t === 'Content' ? (p.getElementsByTagName('url')[0]?.textContent || s.trim()) : s }
    case 'bool': return { t: 'bool', v: s.trim() === 'true' }
    case 'int': case 'float': case 'double': case 'int64': return { t: 'num', v: parseFloat(s) }
    case 'token': return { t: 'enum', v: parseInt(s, 10) }
    case 'BrickColor': return { t: 'brick', v: parseInt(s, 10) }
    case 'Color3uint8': {
      const v = parseInt(s, 10) >>> 0
      return { t: 'color', v: Color3.fromRGB((v >> 16) & 255, (v >> 8) & 255, v & 255) }
    }
    case 'Color3': {
      if (!p.children.length) {
        const v = parseInt(s, 10) >>> 0
        return { t: 'color', v: Color3.fromRGB((v >> 16) & 255, (v >> 8) & 255, v & 255) }
      }
      return { t: 'color', v: new Color3(num(p, 'R'), num(p, 'G'), num(p, 'B')) }
    }
    case 'Vector3': return { t: 'vec3', v: new Vector3(num(p, 'X'), num(p, 'Y'), num(p, 'Z')) }
    case 'CoordinateFrame': case 'CFrame': case 'OptionalCoordinateFrame': {
      const el = t === 'OptionalCoordinateFrame' ? p.getElementsByTagName('CFrame')[0] : p
      if (!el) return null
      const rows = ['R00', 'R01', 'R02', 'R10', 'R11', 'R12', 'R20', 'R21', 'R22'].map((k) => num(el, k))
      return { t: 'cframe', v: cframeFromRows([num(el, 'X'), num(el, 'Y'), num(el, 'Z')], rows) }
    }
    case 'Ref': return { t: 'ref', v: s.trim() === 'null' ? null : s.trim() }
    default: return null
  }
}

// ---------- building instances ----------
const MATERIALS = {
  256: 'Plastic', 272: 'SmoothPlastic', 288: 'Neon', 512: 'Wood', 528: 'WoodPlanks', 784: 'Marble',
  800: 'Slate', 816: 'Concrete', 832: 'Granite', 848: 'Brick', 864: 'Pebble', 880: 'Cobblestone',
  1040: 'CorrodedMetal', 1056: 'DiamondPlate', 1072: 'Foil', 1088: 'Metal', 1280: 'Grass',
  1296: 'Sand', 1312: 'Fabric', 1536: 'Ice', 1568: 'Glass', 1584: 'ForceField',
}
const PART_SHAPES = ['Ball', 'Block', 'Cylinder']
const MESH_TYPES = ['Head', 'Torso', 'Wedge', 'Sphere', 'Cylinder', 'FileMesh', 'Brick', 'Prism', 'Pyramid', 'ParallelRamp', 'RightAngleRamp', 'CornerWedge']
const FACES = ['Right', 'Top', 'Back', 'Left', 'Bottom', 'Front']
// Common BrickColor numbers (older files store these instead of Color3uint8).
const BRICK = {
  1: [242, 243, 243], 5: [215, 197, 154], 9: [232, 186, 200], 18: [204, 142, 105], 21: [196, 40, 28],
  23: [13, 105, 172], 24: [245, 205, 48], 25: [98, 71, 50], 26: [27, 42, 53], 28: [40, 127, 71],
  29: [161, 196, 140], 37: [75, 151, 75], 38: [160, 95, 53], 45: [180, 210, 228], 101: [218, 134, 122],
  102: [110, 153, 202], 104: [107, 50, 124], 105: [226, 155, 64], 106: [218, 133, 65], 107: [0, 143, 156],
  119: [164, 189, 71], 125: [234, 184, 146], 135: [116, 134, 157], 141: [39, 70, 45], 151: [120, 144, 130],
  153: [149, 121, 119], 192: [105, 64, 40], 194: [163, 162, 165], 199: [99, 95, 98], 208: [229, 228, 223],
  217: [124, 92, 70], 226: [253, 234, 141], 1001: [248, 248, 248], 1002: [205, 205, 205], 1003: [17, 17, 17],
  1004: [255, 0, 0], 1005: [255, 175, 0], 1006: [180, 128, 255], 1007: [163, 75, 75], 1008: [193, 190, 66],
  1009: [255, 255, 0], 1010: [0, 0, 255], 1011: [0, 32, 96], 1012: [33, 84, 185], 1013: [4, 175, 236],
  1014: [170, 85, 0], 1015: [170, 0, 170], 1016: [255, 102, 204], 1017: [255, 175, 0], 1018: [18, 238, 212],
  1019: [0, 255, 255], 1020: [0, 255, 0], 1021: [58, 125, 21], 1022: [127, 142, 100], 1023: [140, 91, 159],
  1024: [175, 221, 255], 1025: [255, 201, 201], 1026: [177, 167, 255], 1027: [159, 243, 233], 1028: [204, 255, 204],
  1029: [255, 255, 204], 1030: [255, 204, 153], 1031: [98, 37, 209], 1032: [255, 0, 191],
}

// Engine property name for a file property name, by class.
const RENAME = {
  size: 'Size', Size: 'Size', Color3uint8: 'Color', shape: 'Shape', Shape: 'Shape',
  formFactorRaw: null, Elasticity: null, Friction: null,
}

// Builds engine instances from a parsed file. Returns { roots, scripts, unknownClasses, counts }.
export function buildInstances(parsed) {
  const made = new Map()
  const refs = []
  const unknown = new Map()
  const counts = {}
  let scripts = 0
  const make = (n) => {
    let cls = Instance.classFor(n.className)
    if (!cls || isNotCreatable(cls)) {
      cls = placeholderClass(n.className)
      unknown.set(n.className, (unknown.get(n.className) || 0) + 1)
    }
    counts[n.className] = (counts[n.className] || 0) + 1
    const inst = new cls()
    made.set(n, inst)
    const props = allProps(cls)
    const p = n.props
    for (const [name, val] of p) {
      let key = name in RENAME ? RENAME[name] : name
      if (!key) continue
      if (key === 'BrickColor' && !p.has('Color3uint8') && !p.has('Color')) key = 'Color'
      if (key === 'Disabled' && props.has('Enabled')) { inst._p.Enabled = !val.v; continue }
      const def = props.get(key)
      if (!def) continue
      if (def.ref) { refs.push([inst, key, val.v]); continue }
      const v = convert(key, val, n.className)
      if (v === undefined) continue
      try { inst._p[key] = def.coerce && !(v instanceof Object) ? def.coerce(v) : v } catch { /* skip bad values */ }
    }
    if (inst instanceof BasePart) inst._aabbDirty = true
    if ('Source' in inst._p) {
      scripts++
      inst._attributes.set('SourceLanguage', 'Lua')
      if ('Enabled' in inst._p) inst._p.Enabled = false
    }
    for (const c of n.children) {
      adoptChild(inst, make(c))
    }
    return inst
  }
  const roots = parsed.roots.map((r) => ({ node: r, inst: SERVICE_NAMES.has(r.className) ? null : make(r) }))
  // Services: build their children, remember which service they belong to.
  const serviceChildren = []
  for (const r of roots) {
    if (r.inst) continue
    for (const c of r.node.children) serviceChildren.push([r.node.className, make(c), r.node])
  }
  const nodeByRef = parsed.byRef
  for (const [inst, key, ref] of refs) {
    const n = ref === null || ref === undefined || ref === -1 ? null : nodeByRef.get(ref)
    inst._p[key] = n ? made.get(n) || null : null
  }
  return {
    roots: roots.filter((r) => r.inst).map((r) => r.inst),
    services: serviceChildren,
    serviceNodes: roots.filter((r) => !r.inst).map((r) => r.node),
    unknownClasses: Object.fromEntries(unknown),
    counts,
    scripts,
  }
}

const SERVICE_NAMES = new Set([
  'Workspace', 'Lighting', 'ReplicatedStorage', 'ReplicatedFirst', 'ServerStorage', 'ServerScriptService',
  'StarterGui', 'StarterPack', 'StarterPlayer', 'SoundService', 'Teams', 'Chat', 'Players', 'TestService',
  'MaterialService', 'TextChatService', 'VoiceChatService', 'HttpService', 'InsertService', 'LocalizationService',
  'CSGDictionaryService', 'NonReplicatedCSGDictionaryService', 'Debris', 'TweenService', 'RunService',
  'CollectionService', 'ProximityPromptService', 'PhysicsService', 'GamePassService', 'BadgeService',
])

function convert(key, val, className) {
  const { t, v } = val
  if (key === 'Material' && t === 'enum') return MATERIALS[v] || 'Plastic'
  if (key === 'Shape' && t === 'enum') return PART_SHAPES[v] || 'Block'
  if (key === 'MeshType' && t === 'enum') return MESH_TYPES[v] || 'Brick'
  if (key === 'Face' && t === 'enum') return FACES[v] || 'Front'
  if (t === 'brick') {
    const c = BRICK[v] || [163, 162, 165]
    return Color3.fromRGB(c[0], c[1], c[2])
  }
  if (t === 'enum') return undefined
  void className
  return v
}

const placeholders = new Map()
function placeholderClass(name) {
  let cls = placeholders.get(name)
  if (cls) return cls
  cls = { [name]: class extends Instance { static className = name } }[name]
  cls.__placeholder = true
  placeholders.set(name, cls)
  return cls
}

// Imports into a running engine. options.target: an Instance to put model
// roots in (defaults to Workspace). Place files fill their services.
export function importRoblox(engine, bytes, options = {}) {
  const parsed = parseRoblox(bytes)
  const built = buildInstances(parsed)
  const g = engine.game
  const sp = g.GetService('StarterPlayer')
  const where = (svc) => {
    if (svc === 'Workspace') return engine.workspace
    if (svc === 'StarterPlayer') return sp
    try { return g.GetService(svc) } catch { return null }
  }
  let added = 0
  for (const [svc, inst] of built.services) {
    if (inst.ClassName === 'Terrain' || inst.ClassName === 'Camera') continue
    if (svc === 'StarterPlayer') {
      const existing = sp.FindFirstChildOfClass(inst.ClassName)
      if (existing) {
        for (const c of inst.GetChildren()) { c._parent = null; inst._children.splice(inst._children.indexOf(c), 1); c.Parent = existing }
        continue
      }
    }
    const parent = where(svc)
    if (!parent) continue
    inst.Parent = parent
    added++
  }
  // Lighting settings on the service itself.
  for (const node of built.serviceNodes) {
    if (node.className !== 'Lighting') continue
    const L = g.GetService('Lighting')
    for (const k of ['ClockTime', 'Brightness', 'FogStart', 'FogEnd', 'Ambient', 'OutdoorAmbient', 'FogColor', 'GlobalShadows']) {
      const v = node.props.get(k)
      if (v && v.t !== 'enum') { try { L[k] = v.v } catch { /* ignore */ } }
    }
  }
  const target = options.target || engine.workspace
  for (const r of built.roots) { r.Parent = target; added++ }
  engine.voxels.flush()
  return {
    roots: built.roots,
    added,
    counts: built.counts,
    scripts: built.scripts,
    unknownClasses: built.unknownClasses,
  }
}
