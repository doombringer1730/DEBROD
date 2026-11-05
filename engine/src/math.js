// Value types: Vector3, Color3, CFrame. They are immutable: every method
// returns a new value, like their Roblox counterparts. JavaScript has no
// operator overloading, so `a + b` is written `a.add(b)`.
import * as THREE from 'three'

const DEG = Math.PI / 180

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.X = +x
    this.Y = +y
    this.Z = +z
  }
  static new(x, y, z) { return new Vector3(x, y, z) }
  static fromThree(v) { return new Vector3(v.x, v.y, v.z) }
  static fromArray(a) { return new Vector3(a[0], a[1], a[2]) }

  get x() { return this.X }
  get y() { return this.Y }
  get z() { return this.Z }
  get Magnitude() { return Math.hypot(this.X, this.Y, this.Z) }
  get Unit() {
    const m = this.Magnitude
    return m > 0 ? new Vector3(this.X / m, this.Y / m, this.Z / m) : new Vector3()
  }

  add(v) { return new Vector3(this.X + v.X, this.Y + v.Y, this.Z + v.Z) }
  sub(v) { return new Vector3(this.X - v.X, this.Y - v.Y, this.Z - v.Z) }
  mul(s) {
    return typeof s === 'number'
      ? new Vector3(this.X * s, this.Y * s, this.Z * s)
      : new Vector3(this.X * s.X, this.Y * s.Y, this.Z * s.Z)
  }
  div(s) {
    return typeof s === 'number'
      ? new Vector3(this.X / s, this.Y / s, this.Z / s)
      : new Vector3(this.X / s.X, this.Y / s.Y, this.Z / s.Z)
  }
  neg() { return new Vector3(-this.X, -this.Y, -this.Z) }
  Dot(v) { return this.X * v.X + this.Y * v.Y + this.Z * v.Z }
  Cross(v) {
    return new Vector3(
      this.Y * v.Z - this.Z * v.Y,
      this.Z * v.X - this.X * v.Z,
      this.X * v.Y - this.Y * v.X,
    )
  }
  Lerp(v, t) {
    return new Vector3(this.X + (v.X - this.X) * t, this.Y + (v.Y - this.Y) * t, this.Z + (v.Z - this.Z) * t)
  }
  Abs() { return new Vector3(Math.abs(this.X), Math.abs(this.Y), Math.abs(this.Z)) }
  Min(v) { return new Vector3(Math.min(this.X, v.X), Math.min(this.Y, v.Y), Math.min(this.Z, v.Z)) }
  Max(v) { return new Vector3(Math.max(this.X, v.X), Math.max(this.Y, v.Y), Math.max(this.Z, v.Z)) }
  FuzzyEq(v, eps = 1e-5) {
    return Math.abs(this.X - v.X) <= eps && Math.abs(this.Y - v.Y) <= eps && Math.abs(this.Z - v.Z) <= eps
  }
  equals(v) { return v instanceof Vector3 && v.X === this.X && v.Y === this.Y && v.Z === this.Z }
  toThree(out = new THREE.Vector3()) { return out.set(this.X, this.Y, this.Z) }
  toArray() { return [this.X, this.Y, this.Z] }
  toString() { return `${round(this.X)}, ${round(this.Y)}, ${round(this.Z)}` }
}
Vector3.zero = new Vector3(0, 0, 0)
Vector3.one = new Vector3(1, 1, 1)
Vector3.xAxis = new Vector3(1, 0, 0)
Vector3.yAxis = new Vector3(0, 1, 0)
Vector3.zAxis = new Vector3(0, 0, 1)

export class Color3 {
  constructor(r = 0, g = 0, b = 0) {
    this.R = +r
    this.G = +g
    this.B = +b
  }
  static new(r, g, b) { return new Color3(r, g, b) }
  static fromRGB(r, g, b) { return new Color3(r / 255, g / 255, b / 255) }
  static fromHex(hex) {
    const h = String(hex).replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
    return Color3.fromRGB((n >> 16) & 255, (n >> 8) & 255, n & 255)
  }
  static fromHSV(h, s, v) {
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]
    return new Color3(m[0], m[1], m[2])
  }
  get r() { return this.R }
  get g() { return this.G }
  get b() { return this.B }
  Lerp(c, t) { return new Color3(this.R + (c.R - this.R) * t, this.G + (c.G - this.G) * t, this.B + (c.B - this.B) * t) }
  ToHex() {
    const h = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')
    return h(this.R) + h(this.G) + h(this.B)
  }
  ToHSV() {
    const max = Math.max(this.R, this.G, this.B)
    const min = Math.min(this.R, this.G, this.B)
    const d = max - min
    let h = 0
    if (d) {
      if (max === this.R) h = ((this.G - this.B) / d) % 6
      else if (max === this.G) h = (this.B - this.R) / d + 2
      else h = (this.R - this.G) / d + 4
      h /= 6
      if (h < 0) h += 1
    }
    return [h, max ? d / max : 0, max]
  }
  equals(c) { return c instanceof Color3 && c.R === this.R && c.G === this.G && c.B === this.B }
  toThree(out = new THREE.Color()) { return out.setRGB(this.R, this.G, this.B, THREE.SRGBColorSpace) }
  toArray() { return [this.R, this.G, this.B] }
  toString() { return `${round(this.R)}, ${round(this.G)}, ${round(this.B)}` }
}

const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _e = new THREE.Euler()
const _m = new THREE.Matrix4()

// A coordinate frame: a position plus a rotation (stored as a quaternion).
export class CFrame {
  // new CFrame(x, y, z), new CFrame(position), new CFrame(position, lookAt)
  constructor(a = 0, b = 0, c = 0, quat = null) {
    if (a instanceof Vector3) {
      this.Position = a
      if (b instanceof Vector3) {
        this.q = lookQuat(a, b, Vector3.yAxis)
      } else {
        this.q = quat || new THREE.Quaternion()
      }
    } else {
      this.Position = new Vector3(a, b, c)
      this.q = quat || new THREE.Quaternion()
    }
  }
  static new(a, b, c) { return new CFrame(a, b, c) }
  static fromQuat(pos, q) { return new CFrame(pos, null, null, q.clone()) }
  static lookAt(at, target, up = Vector3.yAxis) { return new CFrame(at, null, null, lookQuat(at, target, up)) }
  // Same convention as Roblox: CFrame.Angles(rx, ry, rz) rotates about Z, then Y, then X.
  static Angles(rx = 0, ry = 0, rz = 0) {
    return new CFrame(Vector3.zero, null, null, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ')))
  }
  static fromEulerAnglesXYZ(rx, ry, rz) { return CFrame.Angles(rx, ry, rz) }
  static fromEulerAnglesYXZ(rx = 0, ry = 0, rz = 0) {
    return new CFrame(Vector3.zero, null, null, new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')))
  }
  static fromOrientation(rx, ry, rz) { return CFrame.fromEulerAnglesYXZ(rx, ry, rz) }
  static fromAxisAngle(axis, angle) {
    return new CFrame(Vector3.zero, null, null, new THREE.Quaternion().setFromAxisAngle(axis.Unit.toThree(), angle))
  }

  get p() { return this.Position }
  get X() { return this.Position.X }
  get Y() { return this.Position.Y }
  get Z() { return this.Position.Z }
  get Rotation() { return new CFrame(Vector3.zero, null, null, this.q.clone()) }
  get LookVector() { return this.VectorToWorldSpace(new Vector3(0, 0, -1)) }
  get RightVector() { return this.VectorToWorldSpace(new Vector3(1, 0, 0)) }
  get UpVector() { return this.VectorToWorldSpace(new Vector3(0, 1, 0)) }
  get XVector() { return this.RightVector }
  get YVector() { return this.UpVector }
  get ZVector() { return this.VectorToWorldSpace(new Vector3(0, 0, 1)) }

  // cf.mul(cf2) composes frames; cf.mul(vector) transforms a point.
  mul(o) {
    if (o instanceof Vector3) return this.PointToWorldSpace(o)
    const pos = this.PointToWorldSpace(o.Position)
    return new CFrame(pos, null, null, this.q.clone().multiply(o.q))
  }
  add(v) { return new CFrame(this.Position.add(v), null, null, this.q.clone()) }
  sub(v) { return new CFrame(this.Position.sub(v), null, null, this.q.clone()) }
  Inverse() {
    const qi = this.q.clone().invert()
    const p = _v.set(-this.Position.X, -this.Position.Y, -this.Position.Z).applyQuaternion(qi)
    return new CFrame(new Vector3(p.x, p.y, p.z), null, null, qi)
  }
  Lerp(o, t) {
    return new CFrame(this.Position.Lerp(o.Position, t), null, null, this.q.clone().slerp(o.q, t))
  }
  PointToWorldSpace(v) {
    _v.set(v.X, v.Y, v.Z).applyQuaternion(this.q)
    return new Vector3(_v.x + this.Position.X, _v.y + this.Position.Y, _v.z + this.Position.Z)
  }
  PointToObjectSpace(v) {
    _q.copy(this.q).invert()
    _v.set(v.X - this.Position.X, v.Y - this.Position.Y, v.Z - this.Position.Z).applyQuaternion(_q)
    return new Vector3(_v.x, _v.y, _v.z)
  }
  VectorToWorldSpace(v) {
    _v.set(v.X, v.Y, v.Z).applyQuaternion(this.q)
    return new Vector3(_v.x, _v.y, _v.z)
  }
  VectorToObjectSpace(v) {
    _q.copy(this.q).invert()
    _v.set(v.X, v.Y, v.Z).applyQuaternion(_q)
    return new Vector3(_v.x, _v.y, _v.z)
  }
  ToWorldSpace(cf) { return this.mul(cf) }
  ToObjectSpace(cf) { return this.Inverse().mul(cf) }
  ToEulerAnglesXYZ() {
    _e.setFromQuaternion(this.q, 'XYZ')
    return [_e.x, _e.y, _e.z]
  }
  ToEulerAnglesYXZ() {
    _e.setFromQuaternion(this.q, 'YXZ')
    return [_e.x, _e.y, _e.z]
  }
  ToOrientation() { return this.ToEulerAnglesYXZ() }
  // Orientation in degrees, as Part.Orientation reports it.
  get OrientationDegrees() {
    const [x, y, z] = this.ToEulerAnglesYXZ()
    return new Vector3(x / DEG, y / DEG, z / DEG)
  }
  equals(o) { return o instanceof CFrame && o.Position.equals(this.Position) && o.q.equals(this.q) }
  toMatrix4(size, out = new THREE.Matrix4()) {
    return out.compose(
      _v.set(this.Position.X, this.Position.Y, this.Position.Z),
      this.q,
      size ? new THREE.Vector3(size.X, size.Y, size.Z) : new THREE.Vector3(1, 1, 1),
    )
  }
  toArray() { return [this.Position.X, this.Position.Y, this.Position.Z, this.q.x, this.q.y, this.q.z, this.q.w] }
  static fromArray(a) { return new CFrame(new Vector3(a[0], a[1], a[2]), null, null, new THREE.Quaternion(a[3], a[4], a[5], a[6])) }
  toString() { return `${this.Position} @ ${this.OrientationDegrees}` }
}
CFrame.identity = new CFrame()

function lookQuat(at, target, up) {
  const dir = target.sub(at)
  if (dir.Magnitude < 1e-9) return new THREE.Quaternion()
  // Matrix4.lookAt points the -Z axis from eye to target when used for cameras.
  _m.lookAt(at.toThree(new THREE.Vector3()), target.toThree(new THREE.Vector3()), up.toThree(new THREE.Vector3()))
  return new THREE.Quaternion().setFromRotationMatrix(_m)
}

function round(n) { return Math.round(n * 1000) / 1000 }

export const DEG2RAD = DEG
