// Joints (Weld, Motor6D), the Humanoid controller and the default character.
import { Instance, P } from './instance.js'
import { Signal } from './signal.js'
import { Vector3, CFrame, Color3 } from './math.js'
import { Part, BasePart, Model } from './parts.js'

// Part1.CFrame = Part0.CFrame * C0 * Transform * C1:Inverse()
export class JointInstance extends Instance {
  static className = 'JointInstance'
  static notCreatable = true
  static props = { Part0: P.ref(), Part1: P.ref(), C0: P.cframe(), C1: P.cframe(), Enabled: P.bool(true) }
  constructor() {
    super()
    this.Transform = new CFrame()
  }
  _contextChanged() { this._joints()?.dirty() }
  _onProp(key) { if (key === 'Part0' || key === 'Part1' || key === 'Enabled') this._joints()?.dirty() }
  _onDestroy() { this._joints()?.dirty() }
  _joints() { return this._engine ? this._engine.joints : this._lastJoints }
}
Instance.register(JointInstance)
for (const name of ['Weld', 'Motor6D', 'ManualWeld', 'Snap', 'Motor']) {
  Instance.register({ [name]: class extends JointInstance { static className = name } }[name])
}
// WeldConstraint keeps the offset the two parts had when it was enabled.
export class WeldConstraint extends JointInstance { static className = 'WeldConstraint' }
Instance.register(WeldConstraint)

export class JointSolver {
  constructor(engine) {
    this.engine = engine
    this.order = []
    this._dirty = true
    this._attached = new Set()
  }
  dirty() { this._dirty = true }
  _rebuild() {
    this._dirty = false
    const joints = []
    for (const d of this.engine.workspace.GetDescendants()) {
      if (d instanceof JointInstance && d._p.Enabled && d._p.Part0 && d._p.Part1 && d._p.Part0 !== d._p.Part1 &&
        d._p.Part0._ws && d._p.Part1._ws) {
        joints.push(d)
        d._lastJoints = this
      }
    }
    // Tree from roots (parts never driven by a joint) outward.
    const byPart0 = new Map()
    const driven = new Set()
    for (const j of joints) {
      if (driven.has(j._p.Part1)) continue
      driven.add(j._p.Part1)
      if (!byPart0.has(j._p.Part0)) byPart0.set(j._p.Part0, [])
      byPart0.get(j._p.Part0).push(j)
    }
    const order = []
    const visit = (part, isStatic, seen) => {
      for (const j of byPart0.get(part) || []) {
        const p1 = j._p.Part1
        if (seen.has(p1)) continue
        seen.add(p1)
        if (j instanceof WeldConstraint && !j._offset) j._offset = part._p.CFrame.ToObjectSpace(p1._p.CFrame)
        p1._assemblyStatic = isStatic
        order.push(j)
        visit(p1, isStatic, seen)
      }
    }
    for (const part of byPart0.keys()) {
      if (driven.has(part)) continue
      visit(part, part._p.Anchored && !part._controlled, new Set([part]))
    }
    const attached = new Set(order.map((j) => j._p.Part1))
    const phys = this.engine.physics
    for (const p of this._attached) if (!attached.has(p)) { p._jointed = false; phys.reclassify(p) }
    for (const p of attached) { p._jointed = true; phys.reclassify(p) }
    this._attached = attached
    this.order = order
  }
  solve() {
    if (this._dirty) this._rebuild()
    for (const j of this.order) {
      const p0 = j._p.Part0, p1 = j._p.Part1
      if (!p0 || !p1 || p0._destroyed || p1._destroyed) { this._dirty = true; continue }
      const cf = j instanceof WeldConstraint
        ? p0._p.CFrame.mul(j._offset)
        : p0._p.CFrame.mul(j._p.C0).mul(j.Transform).mul(j._p.C1.Inverse())
      if (!cf.equals(p1._p.CFrame)) p1._setPhysicsCFrame(cf)
    }
  }
}

const STATES = ['Running', 'Jumping', 'Freefall', 'Landed', 'Dead', 'Physics', 'None']

export class Humanoid extends Instance {
  static className = 'Humanoid'
  static props = {
    Health: P.num(100),
    MaxHealth: P.num(100),
    WalkSpeed: P.num(16),
    JumpPower: P.num(50),
    AutoRotate: P.bool(true),
    Jump: P.bool(false),
    Sit: P.bool(false),
    PlatformStand: P.bool(false),
    DisplayName: P.str(''),
    RequiresNeck: P.bool(true),
    BreakJointsOnDeath: P.bool(true),
  }
  constructor() {
    super()
    this.Died = new Signal()
    this.HealthChanged = new Signal()
    this.Jumping = new Signal()
    this.Running = new Signal()
    this.FreeFalling = new Signal()
    this.StateChanged = new Signal()
    this.MoveToFinished = new Signal()
    this.Touched = new Signal()
    this.MoveDirection = new Vector3()
    this.FloorMaterial = 'Air'
    this.RootPart = null
    this._state = 'Running'
    this._vel = [0, 0, 0]
    this._onGround = false
    this._ground = null
    this._move = new Vector3()
    this._moveTo = null
    this._yaw = 0
    this._faceYaw = null
    this._dead = false
    this._animT = 0
    this._lastRun = 0
    this._body = null
  }
  _contextChanged() {
    const e = this._engine
    if (this._ws && e && this._parent instanceof Model) {
      this._bind(e)
      e.humanoids.add(this)
    } else if (this._boundEngine) {
      this._unbind()
    }
  }
  _bind(e) {
    this._boundEngine = e
    const model = this._parent
    const root = model.FindFirstChild('HumanoidRootPart') || model.PrimaryPart || model.FindFirstChild('Torso')
    if (!root || !(root instanceof BasePart)) return
    this.RootPart = root
    root._controlled = true
    e.physics.reclassify(root)
    const [cf, size] = model.GetBoundingBox()
    const rp = root._p.CFrame.Position
    const below = Math.max(0.5, rp.Y - (cf.Position.Y - size.Y / 2))
    const above = Math.max(0.5, cf.Position.Y + size.Y / 2 - rp.Y)
    const half = Math.min(1.25, Math.max(0.6, Math.max(root._p.Size.X, root._p.Size.Z) / 2))
    const [, yaw] = root._p.CFrame.ToEulerAnglesYXZ()
    this._yaw = yaw
    this._body = { min: [0, 0, 0], max: [0, 0, 0], humanoid: this, root, model, below, above, half }
    this._syncBody()
    e.physics.bodies.add(this._body)
  }
  _unbind() {
    const e = this._boundEngine
    this._boundEngine = null
    e.humanoids.delete(this)
    if (this._body) e.physics.bodies.delete(this._body)
    if (this.RootPart) {
      this.RootPart._controlled = false
      e.physics.reclassify(this.RootPart)
    }
    this._body = null
  }
  _syncBody() {
    const b = this._body
    const p = b.root._p.CFrame.Position
    b.min[0] = p.X - b.half; b.max[0] = p.X + b.half
    b.min[2] = p.Z - b.half; b.max[2] = p.Z + b.half
    b.min[1] = p.Y - b.below; b.max[1] = p.Y + b.above
  }
  _onProp(key, v, old) {
    if (key === 'Health') {
      const h = Math.max(0, Math.min(this._p.MaxHealth, v))
      if (h !== v) { this._p.Health = h }
      this.HealthChanged.Fire(this._p.Health)
      if (this._p.Health <= 0 && !this._dead) this._die()
    }
    void old
  }
  TakeDamage(n) { if (!this._dead) this.Health = this._p.Health - n }
  // dir is a world direction. Pass relativeToCamera=true to treat it as camera-relative.
  Move(dir, relativeToCamera = false) {
    if (relativeToCamera && this._engine) dir = this._engine.cameraController.relative(dir)
    this._move = new Vector3(dir.X, 0, dir.Z)
    if (this._move.Magnitude > 1) this._move = this._move.Unit
    this._moveTo = null
  }
  MoveTo(pos, part) {
    this._moveTo = { pos, part, time: 0 }
  }
  GetState() { return this._state }
  ChangeState(s) { this._setState(typeof s === 'string' ? s : s.Name) }
  _setState(s) {
    if (s === this._state || !STATES.includes(s)) return
    const old = this._state
    this._state = s
    this.StateChanged.Fire(old, s)
  }
  _die() {
    this._dead = true
    this._setState('Dead')
    this.Died.Fire()
    const model = this._parent
    if (!model || !this._p.BreakJointsOnDeath) return
    // Fall apart.
    for (const d of model.GetDescendants()) if (d instanceof JointInstance) d.Enabled = false
    const e = this._boundEngine
    const v = this._vel
    if (this._body && e) e.physics.bodies.delete(this._body)
    for (const d of model.GetDescendants()) {
      if (!(d instanceof BasePart)) continue
      d._controlled = false
      d.CanCollide = true
      d.Anchored = false
      d.AssemblyLinearVelocity = new Vector3(v[0] + (Math.random() - 0.5) * 20, Math.max(v[1], 0) + Math.random() * 20, v[2] + (Math.random() - 0.5) * 20)
      if (e) e.physics.reclassify(d)
    }
  }

  _step(dt) {
    const b = this._body
    if (!b || this._dead || b.root._destroyed) return
    const e = this._boundEngine
    const ws = e.workspace
    this._syncBody()
    if (this._p.PlatformStand) return

    let move = this._move
    if (this._moveTo) {
      const t = this._moveTo
      t.time += dt
      const target = t.part ? t.part.Position.add(t.pos ? t.pos : Vector3.zero) : t.pos
      const rp = b.root._p.CFrame.Position
      const flat = new Vector3(target.X - rp.X, 0, target.Z - rp.Z)
      if (flat.Magnitude < 1) {
        this._moveTo = null
        move = new Vector3()
        this._move = move
        this.MoveToFinished.Fire(true)
      } else if (t.time > 8) {
        this._moveTo = null
        this.MoveToFinished.Fire(false)
      } else move = flat.Unit
    }
    this.MoveDirection = move
    const speed = this._p.Sit ? 0 : this._p.WalkSpeed
    const v = this._vel
    const control = this._onGround ? 1 : 0.6
    const k = Math.min(1, dt * 14 * control)
    v[0] += (move.X * speed - v[0]) * k
    v[2] += (move.Z * speed - v[2]) * k
    if (this._p.Jump) {
      if (this._onGround && !this._p.Sit) {
        v[1] = this._p.JumpPower
        this._onGround = false
        this._setState('Jumping')
        this.Jumping.Fire(true)
      }
      if (!this._holdJump) this._p.Jump = false
    }
    v[1] -= ws.Gravity * dt
    v[1] = Math.max(v[1], -400)

    // Ride moving platforms.
    const g = this._ground
    if (g && g !== 'terrain' && g._moveDelta && (g._moveDelta[0] || g._moveDelta[1] || g._moveDelta[2])) {
      e.physics.moveBox(b, g._moveDelta.slice(), (o) => this._skip(o))
    }
    const res = e.physics.moveBox(b, [v[0] * dt, v[1] * dt, v[2] * dt], (o) => this._skip(o))
    const wasGround = this._onGround
    if (res.hit[1] && v[1] <= 0) {
      this._onGround = true
      this._ground = res.obj[1]
      v[1] = 0
    } else {
      if (res.hit[1]) v[1] = Math.min(0, v[1])
      // Stay grounded when walking down small steps.
      if (wasGround && v[1] <= 0) {
        const probe = { min: b.min.slice(), max: b.max.slice() }
        const r2 = e.physics.moveBox(probe, [0, -0.6, 0], (o) => this._skip(o))
        if (r2.hit[1]) {
          b.min[1] = probe.min[1]; b.max[1] = probe.max[1]
          this._ground = r2.obj[1]
          v[1] = 0
        } else {
          this._onGround = false
          this._ground = null
        }
      } else {
        this._onGround = false
        this._ground = null
      }
    }
    for (const axis of [0, 2]) {
      if (!res.hit[axis]) continue
      const o = res.obj[axis]
      if (o instanceof BasePart && !o._p.Anchored && !o._jointed) {
        const push = o._p.AssemblyLinearVelocity
        const add = [0, 0, 0]
        add[axis] = v[axis] * 0.8
        o.AssemblyLinearVelocity = new Vector3(axis === 0 ? add[0] : push.X, push.Y, axis === 2 ? add[2] : push.Z)
      }
      v[axis] = 0
    }
    this.FloorMaterial = this._onGround ? (this._ground === 'terrain' ? 'Grass' : this._ground && this._ground._p ? this._ground._p.Material : 'Plastic') : 'Air'

    // States and events.
    const hspeed = Math.hypot(v[0], v[2])
    if (this._onGround) {
      if (!wasGround) this._setState('Landed')
      this._setState('Running')
      if (Math.abs(hspeed - this._lastRun) > 0.5 || (hspeed < 0.1 && this._lastRun >= 0.1)) {
        this._lastRun = hspeed
        this.Running.Fire(hspeed)
      }
    } else if (v[1] < 0 && this._state !== 'Freefall') {
      this._setState('Freefall')
      this.FreeFalling.Fire(true)
    }

    // Facing.
    if (this._p.AutoRotate) {
      let target = null
      if (this._faceYaw !== null) target = this._faceYaw
      else if (move.Magnitude > 0.1) target = Math.atan2(-move.X, -move.Z)
      if (target !== null) {
        let d = target - this._yaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        this._yaw += d * Math.min(1, dt * 15)
      }
    }
    const pos = new Vector3((b.min[0] + b.max[0]) / 2, b.min[1] + b.below, (b.min[2] + b.max[2]) / 2)
    b.root._setPhysicsCFrame(new CFrame(pos).mul(CFrame.Angles(0, this._yaw, 0)))
    b.root._p.AssemblyLinearVelocity = new Vector3(v[0], v[1], v[2])

    this._animate(dt, hspeed)
    if (pos.Y < ws.FallenPartsDestroyHeight) this.Health = 0
  }
  _skip(o) {
    const b = this._body
    if (o === b) return true
    return o instanceof BasePart && (o === b.root || o.IsDescendantOf(b.model))
  }

  // Classic limb swing for R6-style rigs (Torso with shoulder and hip Motor6Ds).
  _animate(dt, hspeed) {
    const torso = this._parent && this._parent.FindFirstChild('Torso')
    if (!torso) return
    const rs = torso.FindFirstChild('Right Shoulder'), ls = torso.FindFirstChild('Left Shoulder')
    const rh = torso.FindFirstChild('Right Hip'), lh = torso.FindFirstChild('Left Hip')
    let arm = 0, leg = 0
    if (!this._onGround) {
      arm = Math.PI
      leg = 0
    } else if (hspeed > 0.5) {
      this._animT += dt * hspeed * 0.55
      arm = Math.sin(this._animT) * 0.9
      leg = -arm
    } else {
      this._animT += dt * 2
      arm = Math.sin(this._animT) * 0.05
    }
    const smooth = Math.min(1, dt * 12)
    const set = (j, a) => {
      if (!(j instanceof JointInstance)) return
      j._angle = (j._angle || 0) + (a - (j._angle || 0)) * smooth
      j.Transform = CFrame.Angles(0, 0, j._angle)
    }
    set(rs, arm)
    set(ls, arm)
    set(rh, leg)
    set(lh, leg)
  }
}
Instance.register(Humanoid)

// Builds the default blocky character.
export function buildCharacter(name = 'Player', colors = {}) {
  const c = {
    head: Color3.fromRGB(234, 184, 146),
    torso: Color3.fromRGB(46, 150, 140),
    arms: Color3.fromRGB(234, 184, 146),
    legs: Color3.fromRGB(52, 58, 72),
    ...colors,
  }
  const model = new Model()
  model.Name = name
  const part = (pname, size, color) => {
    const p = new Part()
    p.Name = pname
    p.Size = size
    p.Color = color
    p.CanCollide = false
    p.Parent = model
    return p
  }
  const root = part('HumanoidRootPart', new Vector3(2, 2, 1), c.torso)
  root.Transparency = 1
  const torso = part('Torso', new Vector3(2, 2, 1), c.torso)
  const head = part('Head', new Vector3(2, 1, 1), c.head)
  head.Shape = 'Head'
  const ra = part('Right Arm', new Vector3(1, 2, 1), c.arms)
  const la = part('Left Arm', new Vector3(1, 2, 1), c.arms)
  const rl = part('Right Leg', new Vector3(1, 2, 1), c.legs)
  const ll = part('Left Leg', new Vector3(1, 2, 1), c.legs)
  const face = Instance.new('Decal')
  face.Name = 'face'
  face.Texture = 'builtin://face'
  face.Face = 'Front'
  face.Parent = head

  const R = CFrame.Angles(-Math.PI / 2, 0, Math.PI)
  const joint = (jname, p0, p1, c0, c1) => {
    const j = Instance.new('Motor6D')
    j.Name = jname
    j.Part0 = p0
    j.Part1 = p1
    j.C0 = c0
    j.C1 = c1
    j.Parent = p0 === root ? root : torso
    return j
  }
  const yR = CFrame.Angles(0, Math.PI / 2, 0), yL = CFrame.Angles(0, -Math.PI / 2, 0)
  joint('RootJoint', root, torso, R, R)
  joint('Neck', torso, head, new CFrame(0, 1, 0).mul(R), new CFrame(0, -0.5, 0).mul(R))
  joint('Right Shoulder', torso, ra, new CFrame(1, 0.5, 0).mul(yR), new CFrame(-0.5, 0.5, 0).mul(yR))
  joint('Left Shoulder', torso, la, new CFrame(-1, 0.5, 0).mul(yL), new CFrame(0.5, 0.5, 0).mul(yL))
  joint('Right Hip', torso, rl, new CFrame(1, -1, 0).mul(yR), new CFrame(0.5, 1, 0).mul(yR))
  joint('Left Hip', torso, ll, new CFrame(-1, -1, 0).mul(yL), new CFrame(-0.5, 1, 0).mul(yL))

  // Lay the limbs out once so the bounding box is right before the first solve.
  const at = (p, x, y, z) => { p._p.CFrame = new CFrame(x, y, z); p._aabbDirty = true }
  at(root, 0, 0, 0); at(torso, 0, 0, 0); at(head, 0, 1.5, 0)
  at(ra, 1.5, 0, 0); at(la, -1.5, 0, 0); at(rl, 0.5, -2, 0); at(ll, -0.5, -2, 0)

  const hum = new Humanoid()
  hum.DisplayName = name
  hum.Parent = model
  model.PrimaryPart = root
  return model
}
