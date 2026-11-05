// Parts, models, values, scripts and a few small helper instances.
import { Instance, P } from './instance.js'
import { Signal } from './signal.js'
import { Vector3, CFrame, DEG2RAD } from './math.js'
import { enumName } from './enum.js'

export class BasePart extends Instance {
  static className = 'BasePart'
  static notCreatable = true
  static props = {
    Size: P.vec(4, 1, 2),
    CFrame: P.cframe(),
    Color: P.color(163, 162, 165),
    Material: { default: 'Plastic', coerce: enumName },
    Transparency: P.num(0),
    Reflectance: P.num(0),
    Anchored: P.bool(false),
    CanCollide: P.bool(true),
    CanTouch: P.bool(true),
    CastShadow: P.bool(true),
    Locked: P.bool(false),
    AssemblyLinearVelocity: P.vec(0, 0, 0),
  }
  constructor() {
    super()
    this.Touched = new Signal()
    this.TouchEnded = new Signal()
    this._aabbDirty = true
    this._aabb = { min: [0, 0, 0], max: [0, 0, 0] }
    this._lastPos = null
    this._moveDelta = [0, 0, 0]
    this._sleep = 0
    this._grounded = false
    this._localTransparency = 0
  }
  get Position() { return this._p.CFrame.Position }
  set Position(v) { this.CFrame = new CFrame(v instanceof Vector3 ? v : Vector3.fromArray(v), null, null, this._p.CFrame.q.clone()) }
  get Orientation() { return this._p.CFrame.OrientationDegrees }
  set Orientation(v) {
    const r = CFrame.fromEulerAnglesYXZ(v.X * DEG2RAD, v.Y * DEG2RAD, v.Z * DEG2RAD)
    this.CFrame = new CFrame(this.Position, null, null, r.q)
  }
  get Rotation() { return this.Orientation }
  get Velocity() { return this._p.AssemblyLinearVelocity }
  set Velocity(v) { this.AssemblyLinearVelocity = v }
  get BrickColor() { return this._p.Color }
  set BrickColor(v) { this.Color = v }
  get Mass() { return this.GetMass() }
  GetMass() {
    const s = this._p.Size
    return s.X * s.Y * s.Z * 0.7
  }
  ApplyImpulse(impulse) {
    this.AssemblyLinearVelocity = this._p.AssemblyLinearVelocity.add(impulse.div(this.GetMass()))
    this._sleep = 0
  }
  GetTouchingParts() {
    const e = this._engine
    return e ? e.physics.touchingParts(this) : []
  }
  // World-space axis-aligned box: { min:[x,y,z], max:[x,y,z] }.
  getAABB() {
    if (this._aabbDirty) {
      const cf = this._p.CFrame
      const s = this._p.Size
      const r = cf.RightVector, u = cf.UpVector, b = cf.ZVector
      const hx = s.X / 2, hy = s.Y / 2, hz = s.Z / 2
      const ex = Math.abs(r.X) * hx + Math.abs(u.X) * hy + Math.abs(b.X) * hz
      const ey = Math.abs(r.Y) * hx + Math.abs(u.Y) * hy + Math.abs(b.Y) * hz
      const ez = Math.abs(r.Z) * hx + Math.abs(u.Z) * hy + Math.abs(b.Z) * hz
      const p = cf.Position
      this._aabb.min[0] = p.X - ex; this._aabb.min[1] = p.Y - ey; this._aabb.min[2] = p.Z - ez
      this._aabb.max[0] = p.X + ex; this._aabb.max[1] = p.Y + ey; this._aabb.max[2] = p.Z + ez
      this._aabbDirty = false
    }
    return this._aabb
  }
  get shapeName() { return 'Block' }
  _onProp(key) {
    if (key === 'CFrame' || key === 'Size') {
      this._aabbDirty = true
      this._sleep = 0
    }
    if (key === 'AssemblyLinearVelocity' || key === 'Anchored') this._sleep = 0
    const e = this._ws && this._engine
    if (e) e.partChanged(this, key)
  }
  _enterWorkspace() { this._engine.addPart(this) }
  _leaveWorkspace(ws) { (ws._dm && ws._dm._engine).removePart(this) }
  _afterClone() { this._aabbDirty = true }
}
Instance.register(BasePart)

export class Part extends BasePart {
  static className = 'Part'
  static props = { Shape: { default: 'Block', coerce: enumName } }
  get shapeName() { return this._p.Shape }
}
Instance.register(Part)

export class WedgePart extends BasePart {
  static className = 'WedgePart'
  get shapeName() { return 'Wedge' }
}
Instance.register(WedgePart)

export class SpawnLocation extends Part {
  static className = 'SpawnLocation'
  static props = { Enabled: P.bool(true) }
  constructor() {
    super()
    this._p.Size = new Vector3(12, 1, 12)
    this._p.Anchored = true
  }
}
Instance.register(SpawnLocation)

export class Model extends Instance {
  static className = 'Model'
  static props = { PrimaryPart: P.ref() }
  _parts() { return this.GetDescendants().filter((d) => d instanceof BasePart) }
  GetBoundingBox() {
    const parts = this._parts()
    if (!parts.length) return [new CFrame(), new Vector3()]
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const p of parts) {
      const b = p.getAABB()
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], b.min[i])
        max[i] = Math.max(max[i], b.max[i])
      }
    }
    return [
      new CFrame((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2),
      new Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
    ]
  }
  GetExtentsSize() { return this.GetBoundingBox()[1] }
  GetPivot() {
    const pp = this._p.PrimaryPart
    if (pp && pp.IsDescendantOf(this)) return pp.CFrame
    return this.GetBoundingBox()[0]
  }
  PivotTo(cf) {
    const delta = cf.mul(this.GetPivot().Inverse())
    for (const p of this._parts()) p.CFrame = delta.mul(p.CFrame)
  }
  SetPrimaryPartCFrame(cf) { this.PivotTo(cf) }
  MoveTo(pos) {
    const piv = this.GetPivot()
    this.TranslateBy(pos.sub(piv.Position))
  }
  TranslateBy(v) {
    for (const p of this._parts()) p.CFrame = p.CFrame.add(v)
  }
}
Instance.register(Model)

// Value objects: IntValue, StringValue, ... Their Changed passes the new value.
export class ValueBase extends Instance {
  static className = 'ValueBase'
  static notCreatable = true
  _propChanged(key, v, old) {
    this._onProp(key, v, old)
    if (key === 'Value') this.Changed.Fire(v)
    const s = this._propSignals.get(key)
    if (s) s.Fire()
  }
}
Instance.register(ValueBase)
const valueTypes = {
  IntValue: { default: 0, coerce: (v) => Math.trunc(Number(v)) },
  NumberValue: P.num(0),
  StringValue: P.str(''),
  BoolValue: P.bool(false),
  ObjectValue: P.ref(),
  Vector3Value: P.vec(0, 0, 0),
  Color3Value: P.color(0, 0, 0),
  CFrameValue: P.cframe(),
}
export const Values = {}
for (const [name, def] of Object.entries(valueTypes)) {
  const cls = { [name]: class extends ValueBase { static className = name; static props = { Value: def } } }[name]
  Instance.register(cls)
  Values[name] = cls
}

export class ClickDetector extends Instance {
  static className = 'ClickDetector'
  static props = { MaxActivationDistance: P.num(32) }
  constructor() {
    super()
    this.MouseClick = new Signal()
    this.MouseHoverEnter = new Signal()
    this.MouseHoverLeave = new Signal()
  }
}
Instance.register(ClickDetector)

// Classic on-screen text. A Hint is a bar at the top, a Message covers the middle.
export class Hint extends Instance {
  static className = 'Hint'
  static props = { Text: P.str('') }
  _contextChanged() {
    const e = this._engine
    if (this._ws && e) e.ui.showText(this, this._p.Text, this.ClassName)
    else if (this._shownOn) this._shownOn.ui.hideText(this)
    this._shownOn = this._ws ? e : null
  }
  _onProp(key) {
    if (key === 'Text' && this._shownOn) this._shownOn.ui.showText(this, this._p.Text, this.ClassName)
  }
}
Instance.register(Hint)
export class Message extends Hint { static className = 'Message' }
Instance.register(Message)

// Scripts. Source is JavaScript (see engine/README.md). Script and LocalScript
// run while they sit in Workspace, ServerScriptService or StarterPlayerScripts.
export class BaseScript extends Instance {
  static className = 'BaseScript'
  static notCreatable = true
  static aliases = ['LuaSourceContainer']
  static props = { Source: P.str(''), Enabled: P.bool(true) }
  get Disabled() { return !this._p.Enabled }
  set Disabled(v) { this.Enabled = !v }
  _contextChanged() { this._syncRun() }
  _onProp(key) { if (key === 'Enabled') this._syncRun() }
  _syncRun() {
    const e = this._engine || this._runner
    if (e) e.scripts.sync(this)
  }
  _onDestroy() { if (this._runner) this._runner.scripts.stop(this) }
}
Instance.register(BaseScript)
export class Script extends BaseScript { static className = 'Script' }
Instance.register(Script)
export class LocalScript extends Script { static className = 'LocalScript' }
Instance.register(LocalScript)
export class ModuleScript extends Instance {
  static className = 'ModuleScript'
  static aliases = ['LuaSourceContainer']
  static props = { Source: P.str('') }
}
Instance.register(ModuleScript)

// Plain containers so imported places keep their structure.
for (const name of ['Configuration', 'RemoteEvent', 'RemoteFunction', 'BindableEvent']) {
  Instance.register({ [name]: class extends Instance { static className = name } }[name])
}
