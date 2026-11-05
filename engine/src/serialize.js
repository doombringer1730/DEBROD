// Place files: JSON with the terrain, Lighting settings and the instance trees
// of the services that hold place content.
import { Instance, allProps, isNotCreatable, adoptChild } from './instance.js'
import { Vector3, Color3, CFrame } from './math.js'

export const PLACE_FORMAT = 'brickframe-place'
const SERVICES = ['Workspace', 'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'StarterGui']
const SKIP = new Set(['Terrain', 'Camera'])

function encodeValue(v, ids) {
  if (v instanceof Vector3) return { v3: v.toArray() }
  if (v instanceof Color3) return { c3: v.toArray() }
  if (v instanceof CFrame) return { cf: v.toArray() }
  if (v instanceof Instance) return ids.has(v) ? { ref: ids.get(v) } : null
  return v
}
function decodeValue(v) {
  if (v && typeof v === 'object') {
    if (v.v3) return Vector3.fromArray(v.v3)
    if (v.c3) return new Color3(...v.c3)
    if (v.cf) return CFrame.fromArray(v.cf)
  }
  return v
}

export function serializeTree(roots) {
  const ids = new Map()
  const collect = (n) => {
    if (!n._p.Archivable || isNotCreatable(n.constructor) || SKIP.has(n.ClassName)) return
    ids.set(n, ids.size + 1)
    for (const c of n._children) collect(c)
  }
  for (const r of roots) collect(r)
  const enc = (n) => {
    if (!ids.has(n)) return null
    const p = {}
    for (const [k, def] of allProps(n.constructor)) {
      const v = n._p[k]
      if (v === undefined || (v === null && !def.ref)) continue
      p[k] = encodeValue(v, ids)
    }
    const out = { c: n.ClassName, id: ids.get(n), p }
    if (n._attributes.size) out.a = Object.fromEntries([...n._attributes].map(([k, v]) => [k, encodeValue(v, ids)]))
    const kids = n._children.map(enc).filter(Boolean)
    if (kids.length) out.k = kids
    return out
  }
  return roots.map(enc).filter(Boolean)
}

export function deserializeTree(list) {
  const byId = new Map()
  const refs = []
  const dec = (o) => {
    const cls = Instance.classFor(o.c)
    if (!cls || isNotCreatable(cls)) return null
    const inst = new cls()
    byId.set(o.id, inst)
    const props = allProps(cls)
    for (const [k, v] of Object.entries(o.p || {})) {
      const def = props.get(k)
      if (!def) continue
      if (def.ref) refs.push([inst, k, v && v.ref])
      else inst._p[k] = decodeValue(v)
    }
    for (const [k, v] of Object.entries(o.a || {})) inst._attributes.set(k, decodeValue(v))
    if (inst._aabbDirty !== undefined) inst._aabbDirty = true
    for (const k of o.k || []) {
      const c = dec(k)
      if (c) adoptChild(inst, c)
    }
    return inst
  }
  const roots = list.map(dec).filter(Boolean)
  for (const [inst, k, id] of refs) inst._p[k] = id ? byId.get(id) || null : null
  return roots
}

export function savePlace(engine) {
  const g = engine.game
  const services = {}
  for (const s of SERVICES) services[s] = serializeTree(g.GetService(s).GetChildren().filter((c) => !isCharacter(engine, c)))
  const sp = g.GetService('StarterPlayer')
  services.StarterPlayerScripts = serializeTree(sp.FindFirstChildOfClass('StarterPlayerScripts').GetChildren())
  services.StarterCharacterScripts = serializeTree(sp.FindFirstChildOfClass('StarterCharacterScripts').GetChildren())
  const lighting = {}
  const L = g.GetService('Lighting')
  for (const [k] of allProps(L.constructor)) if (k !== 'Name' && k !== 'Archivable') lighting[k] = encodeValue(L._p[k], new Map())
  services.Lighting = serializeTree(L.GetChildren())
  return {
    format: PLACE_FORMAT,
    version: 1,
    terrain: engine.voxels.serialize(),
    lighting,
    workspace: { Gravity: engine.workspace.Gravity, FallenPartsDestroyHeight: engine.workspace.FallenPartsDestroyHeight },
    services,
  }
}

function isCharacter(engine, inst) {
  return engine.players.GetPlayers().some((p) => p.Character === inst)
}

export function loadPlace(engine, data) {
  if (!data || data.format !== PLACE_FORMAT) throw new Error('Not a place file')
  engine.clearPlace()
  if (data.terrain) engine.voxels.deserialize(data.terrain)
  const g = engine.game
  const L = g.GetService('Lighting')
  for (const [k, v] of Object.entries(data.lighting || {})) {
    try { L[k] = decodeValue(v) } catch { /* ignore unknown */ }
  }
  if (data.workspace) Object.assign(engine.workspace, data.workspace)
  const sp = g.GetService('StarterPlayer')
  const target = (name) => name === 'StarterPlayerScripts' || name === 'StarterCharacterScripts' ? sp.FindFirstChildOfClass(name) : g.GetService(name)
  for (const [name, list] of Object.entries(data.services || {})) {
    const parent = target(name)
    for (const inst of deserializeTree(list)) inst.Parent = parent
  }
  engine.voxels.flush()
}
