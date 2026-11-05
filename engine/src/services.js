// The DataModel (`game`) and its services.
import { Instance, P } from './instance.js'
import { Signal } from './signal.js'
import { Vector3, Color3, CFrame } from './math.js'
import { Enum } from './enum.js'
import { BasePart } from './parts.js'
import { Camera } from './camera.js'
import { BLOCK, blockId, BLOCKS } from './voxels.js'
import { UserInputService } from './input.js'

class Service extends Instance {
  static className = 'Service'
  static notCreatable = true
  constructor() {
    super()
    this._isService = true
  }
}

export class DataModel extends Instance {
  static className = 'DataModel'
  static notCreatable = true
  constructor(engine) {
    super()
    this._engine = engine
    this._isDataModel = true
    this._isService = true
    this._p.Name = 'Game'
    this._dm = this
    this.PlaceId = 0
    this.GameId = 0
    this.JobId = 'local'
  }
  get _engine() { return this.__engine }
  set _engine(e) { this.__engine = e }
  GetService(name) {
    let s = this.FindFirstChildOfClass(name)
    if (s) return s
    const cls = SERVICES[name]
    if (!cls) throw new Error(`'${name}' is not a valid Service name`)
    s = new cls()
    s._setParent(this)
    return s
  }
  FindService(name) { return this.FindFirstChildOfClass(name) }
  IsLoaded() { return true }
  get Workspace() { return this.GetService('Workspace') }
  get Players() { return this.GetService('Players') }
  get Lighting() { return this.GetService('Lighting') }
  get ReplicatedStorage() { return this.GetService('ReplicatedStorage') }
  get ServerStorage() { return this.GetService('ServerStorage') }
  get ServerScriptService() { return this.GetService('ServerScriptService') }
  get StarterPlayer() { return this.GetService('StarterPlayer') }
  get StarterGui() { return this.GetService('StarterGui') }
}
Instance.register(DataModel)

export class Workspace extends Service {
  static className = 'Workspace'
  static aliases = ['WorldRoot', 'Model']
  static props = {
    Gravity: P.num(196.2),
    FallenPartsDestroyHeight: P.num(-500),
    CurrentCamera: P.ref(),
  }
  constructor() {
    super()
    this._isWorkspace = true
  }
  // Raycast(origin: Vector3, direction: Vector3, params?: RaycastParams) -> RaycastResult | null
  Raycast(origin, direction, params) {
    const e = this._engine
    const list = params ? params.FilterDescendantsInstances || [] : []
    const include = params && /Include|Whitelist/.test(String(params.FilterType && params.FilterType.Name || params.FilterType))
    const inList = (o) => list.some((x) => x === o || o.IsDescendantOf(x))
    const filter = (o) => {
      if (o === 'terrain') return include ? list.includes(this.Terrain) : !list.includes(this.Terrain)
      if (!o._p.CanQuery && o._p.CanQuery !== undefined) return false
      return include ? inList(o) : !inList(o)
    }
    const dist = direction.Magnitude
    const hit = e.physics.raycast(origin.toArray(), direction.toArray(), dist, filter)
    return hit ? toResult(hit, this) : null
  }
  GetPartBoundsInBox(cf, size) {
    const h = size.div(2)
    const p = cf.Position
    return this._engine.physics.partsInBox([p.X - h.X, p.Y - h.Y, p.Z - h.Z], [p.X + h.X, p.Y + h.Y, p.Z + h.Z])
  }
  GetPartsInPart(part) { return part.GetTouchingParts() }
  GetServerTimeNow() { return Date.now() / 1000 }
  get Terrain() { return this.FindFirstChildOfClass('Terrain') }
  // A Workspace is also a Model in Roblox; these mirror Model's helpers.
  GetChildrenParts() { return this.GetDescendants().filter((d) => d instanceof BasePart) }
}
Instance.register(Workspace)

function toResult(hit, ws) {
  const inst = hit.instance === 'terrain' ? ws.Terrain : hit.instance
  return {
    Instance: inst,
    Position: Vector3.fromArray(hit.position),
    Normal: Vector3.fromArray(hit.normal),
    Distance: hit.distance,
    Material: hit.instance === 'terrain' ? BLOCKS[hit.id].name : inst._p.Material,
    Cell: hit.cell ? Vector3.fromArray(hit.cell) : undefined,
  }
}

// workspace.Terrain: the block world. Cells are BLOCK (4) studs.
export class Terrain extends Instance {
  static className = 'Terrain'
  static notCreatable = true
  get _vox() { return this._engine.voxels }
  get CellSize() { return BLOCK }
  get Size() { const v = this._vox; return new Vector3(v.sx, v.sy, v.sz) }
  WorldToCell(pos) { return Vector3.fromArray(this._vox.worldToCell(pos.X, pos.Y, pos.Z)) }
  WorldToCellPreferSolid(pos) { return this.WorldToCell(pos) }
  CellCenterToWorld(x, y, z) {
    if (x instanceof Vector3) ({ X: x, Y: y, Z: z } = x)
    return Vector3.fromArray(this._vox.cellToWorld(x, y, z))
  }
  // Returns the block name at a cell ("Air" when empty).
  GetCell(x, y, z) {
    if (x instanceof Vector3) ({ X: x, Y: y, Z: z } = x)
    return BLOCKS[this._vox.get(x, y, z)].name
  }
  SetCell(x, y, z, block) {
    if (x instanceof Vector3) { block = y; ({ X: x, Y: y, Z: z } = x) }
    this._vox.set(x, y, z, blockId(block))
  }
  // Fills every cell whose center lies inside the box (cframe rotation is ignored).
  FillBlock(cf, size, block) {
    const p = cf.Position, h = size.div(2)
    const v = this._vox
    const a = v.worldToCell(p.X - h.X + BLOCK / 2, p.Y - h.Y + BLOCK / 2, p.Z - h.Z + BLOCK / 2)
    const b = v.worldToCell(p.X + h.X - BLOCK / 2, p.Y + h.Y - BLOCK / 2, p.Z + h.Z - BLOCK / 2)
    v.fill(a[0], a[1], a[2], b[0], b[1], b[2], blockId(block))
  }
  FillBall(center, radius, block) {
    const v = this._vox
    const id = blockId(block)
    const a = v.worldToCell(center.X - radius, center.Y - radius, center.Z - radius)
    const b = v.worldToCell(center.X + radius, center.Y + radius, center.Z + radius)
    for (let y = a[1]; y <= b[1]; y++)
      for (let z = a[2]; z <= b[2]; z++)
        for (let x = a[0]; x <= b[0]; x++) {
          const c = v.cellToWorld(x, y, z)
          if (Math.hypot(c[0] - center.X, c[1] - center.Y, c[2] - center.Z) <= radius) v.set(x, y, z, id)
        }
  }
  Clear() { this._vox.clear() }
  SurfaceHeight(x, z) { return this._vox.surfaceY(x, z) }
}
Instance.register(Terrain)

export class Players extends Service {
  static className = 'Players'
  static props = { CharacterAutoLoads: P.bool(true), RespawnTime: P.num(3), MaxPlayers: P.num(1) }
  constructor() {
    super()
    this.PlayerAdded = new Signal()
    this.PlayerRemoving = new Signal()
    this.LocalPlayer = null
  }
  GetPlayers() { return this._children.filter((c) => c.ClassName === 'Player') }
  GetPlayerFromCharacter(model) { return this.GetPlayers().find((p) => p._p.Character === model) || null }
  GetPlayerByUserId(id) { return this.GetPlayers().find((p) => p.UserId === id) || null }
}
Instance.register(Players)

export class Player extends Instance {
  static className = 'Player'
  static notCreatable = true
  static props = { Character: P.ref(), DisplayName: P.str(''), RespawnLocation: P.ref(), Team: P.ref() }
  constructor() {
    super()
    this.UserId = 1
    this.AccountAge = 0
    this.CharacterAdded = new Signal()
    this.CharacterRemoving = new Signal()
    this.CharacterAppearanceLoaded = new Signal()
    this.Chatted = new Signal()
    this._mouse = null
  }
  GetMouse() { return this._engine.input.mouse }
  LoadCharacter() { this._engine.spawnCharacter(this) }
  Kick(message = 'You have been kicked.') { this._engine.kick(message) }
  Chat(msg) { this.Chatted.Fire(msg) }
}
Instance.register(Player)

export class Lighting extends Service {
  static className = 'Lighting'
  static props = {
    ClockTime: { default: 14, coerce: (v) => ((Number(v) % 24) + 24) % 24 },
    Brightness: P.num(2),
    Ambient: P.color(70, 70, 70),
    OutdoorAmbient: P.color(128, 128, 128),
    FogColor: P.color(192, 210, 230),
    FogStart: P.num(0),
    FogEnd: P.num(100000),
    GlobalShadows: P.bool(true),
    ExposureCompensation: P.num(0),
  }
  get TimeOfDay() {
    const t = this._p.ClockTime
    const h = Math.floor(t), m = Math.floor((t - h) * 60), s = Math.floor(((t - h) * 60 - m) * 60)
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
  }
  set TimeOfDay(str) {
    const [h, m = 0, s = 0] = String(str).split(':').map(Number)
    this.ClockTime = h + m / 60 + s / 3600
  }
  GetMinutesAfterMidnight() { return this._p.ClockTime * 60 }
  SetMinutesAfterMidnight(m) { this.ClockTime = m / 60 }
  GetSunDirection() {
    const a = ((this._p.ClockTime - 6) / 12) * Math.PI
    return new Vector3(Math.cos(a) * 0.8, Math.sin(a), 0.45).Unit
  }
}
Instance.register(Lighting)

export class RunService extends Service {
  static className = 'RunService'
  constructor() {
    super()
    this.Heartbeat = new Signal()
    this.Stepped = new Signal()
    this.RenderStepped = new Signal()
    this.PreSimulation = this.Stepped
    this.PostSimulation = this.Heartbeat
    this.PreRender = this.RenderStepped
    this._bound = new Map()
  }
  IsRunning() { return !!(this._engine && this._engine.running) }
  IsClient() { return true }
  IsServer() { return true }
  IsStudio() { return false }
  BindToRenderStep(name, priority, fn) { this._bound.set(name, { priority, fn }) }
  UnbindFromRenderStep(name) { this._bound.delete(name) }
  _render(dt) {
    if (this._bound.size) {
      for (const { fn } of [...this._bound.values()].sort((a, b) => a.priority - b.priority)) {
        try { fn(dt) } catch (e) { this._engine.scripts.report(e) }
      }
    }
    this.RenderStepped.Fire(dt)
  }
}
Instance.register(RunService)

export class LogService extends Service {
  static className = 'LogService'
  constructor() {
    super()
    this.MessageOut = new Signal()
    this._history = []
  }
  GetLogHistory() { return this._history.slice() }
}
Instance.register(LogService)

export class Debris extends Service {
  static className = 'Debris'
  AddItem(inst, lifetime = 10) {
    this._engine.scheduler.wait(lifetime).then(() => { if (!inst._destroyed) inst.Destroy() })
  }
}
Instance.register(Debris)

export class CollectionService extends Service {
  static className = 'CollectionService'
  constructor() {
    super()
    this._tags = new Map()
    this._added = new Map()
    this._removed = new Map()
  }
  _set(tag) { if (!this._tags.has(tag)) this._tags.set(tag, new Set()); return this._tags.get(tag) }
  _sig(map, tag) { if (!map.has(tag)) map.set(tag, new Signal()); return map.get(tag) }
  AddTag(inst, tag) {
    const s = this._set(tag)
    if (s.has(inst)) return
    s.add(inst)
    this._sig(this._added, tag).Fire(inst)
    inst.Destroying.Connect(() => this.RemoveTag(inst, tag))
  }
  RemoveTag(inst, tag) {
    const s = this._set(tag)
    if (!s.delete(inst)) return
    this._sig(this._removed, tag).Fire(inst)
  }
  HasTag(inst, tag) { return this._set(tag).has(inst) }
  GetTagged(tag) { return [...this._set(tag)] }
  GetTags(inst) { return [...this._tags].filter(([, s]) => s.has(inst)).map(([t]) => t) }
  GetInstanceAddedSignal(tag) { return this._sig(this._added, tag) }
  GetInstanceRemovedSignal(tag) { return this._sig(this._removed, tag) }
}
Instance.register(CollectionService)

export class HttpService extends Service {
  static className = 'HttpService'
  JSONEncode(v) { return JSON.stringify(v) }
  JSONDecode(s) { return JSON.parse(s) }
  GenerateGUID(braces = true) {
    const g = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)
    return braces ? `{${g.toUpperCase()}}` : g.toUpperCase()
  }
  UrlEncode(s) { return encodeURIComponent(s) }
}
Instance.register(HttpService)

// Tweens animate numbers, Vector3s, Color3s and CFrames.
const EASE = {
  Linear: (t) => t,
  Sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  Quad: (t) => t * t,
  Cubic: (t) => t * t * t,
  Quart: (t) => t ** 4,
  Quint: (t) => t ** 5,
  Exponential: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  Circular: (t) => 1 - Math.sqrt(1 - t * t),
  Back: (t) => 2.70158 * t ** 3 - 1.70158 * t * t,
  Bounce: (t) => 1 - bounceOut(1 - t),
  Elastic: (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))),
}
function bounceOut(t) {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}
function ease(style, dir, t) {
  const f = EASE[style] || EASE.Quad
  if (dir === 'In') return f(t)
  if (dir === 'Out') return 1 - f(1 - t)
  return t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2
}
function lerpValue(a, b, t) {
  if (typeof a === 'number') return a + (b - a) * t
  if (a && typeof a.Lerp === 'function') return a.Lerp(b, t)
  return t < 1 ? a : b
}

export class Tween extends Instance {
  static className = 'Tween'
  static notCreatable = true
  constructor(svc, inst, info, goals) {
    super()
    this.Instance = inst
    this.TweenInfo = info
    this._goals = goals
    this._svc = svc
    this.PlaybackState = 'Begin'
    this.Completed = new Signal()
  }
  Play() {
    if (this.PlaybackState === 'Playing') return
    this._from = {}
    for (const k of Object.keys(this._goals)) this._from[k] = this.Instance[k]
    this._t = -this.TweenInfo.DelayTime
    this._loop = 0
    this._back = false
    this.PlaybackState = 'Playing'
    this._svc._active.add(this)
  }
  Pause() { if (this.PlaybackState === 'Playing') { this.PlaybackState = 'Paused'; this._svc._active.delete(this) } }
  Cancel() { this._svc._active.delete(this); this.PlaybackState = 'Cancelled'; this.Completed.Fire('Cancelled') }
  _step(dt) {
    const info = this.TweenInfo
    this._t += dt
    if (this._t < 0) return
    const dur = Math.max(1e-6, info.Time)
    let t = Math.min(1, this._t / dur)
    const a = ease(info.EasingStyle, info.EasingDirection, this._back ? 1 - t : t)
    for (const [k, goal] of Object.entries(this._goals)) {
      if (this.Instance._destroyed) break
      this.Instance[k] = lerpValue(this._from[k], goal, a)
    }
    if (t < 1) return
    if (info.Reverses && !this._back) { this._back = true; this._t = 0; return }
    if (info.RepeatCount < 0 || this._loop < info.RepeatCount) { this._loop++; this._back = false; this._t = 0; return }
    this._svc._active.delete(this)
    this.PlaybackState = 'Completed'
    this.Completed.Fire('Completed')
  }
}
Instance.register(Tween)

export class TweenService extends Service {
  static className = 'TweenService'
  constructor() {
    super()
    this._active = new Set()
  }
  Create(inst, info, goals) { return new Tween(this, inst, info, goals) }
  GetValue(alpha, style, dir) { return ease(style && style.Name || style, dir && dir.Name || dir, alpha) }
  _step(dt) { for (const t of [...this._active]) t._step(dt) }
}
Instance.register(TweenService)

const plain = (name, base = Service) => {
  const cls = { [name]: class extends base { static className = name } }[name]
  Instance.register(cls)
  return cls
}
export const SERVICES = {
  Workspace, Players, Lighting, RunService, LogService, Debris, CollectionService, HttpService, TweenService,
  UserInputService,
  ReplicatedStorage: plain('ReplicatedStorage'),
  ReplicatedFirst: plain('ReplicatedFirst'),
  ServerStorage: plain('ServerStorage'),
  ServerScriptService: plain('ServerScriptService'),
  StarterGui: plain('StarterGui'),
  StarterPack: plain('StarterPack'),
  StarterPlayer: plain('StarterPlayer'),
  SoundService: plain('SoundService'),
  Teams: plain('Teams'),
  Chat: plain('Chat'),
}
export class StarterPlayerScripts extends Instance { static className = 'StarterPlayerScripts' }
Instance.register(StarterPlayerScripts)
export class StarterCharacterScripts extends Instance { static className = 'StarterCharacterScripts' }
Instance.register(StarterCharacterScripts)

export { Camera, Color3, CFrame, Enum }
