// workspace.CurrentCamera and the default third-person camera:
// right-drag or arrow keys to orbit, wheel to zoom, zoom all the way in for
// first person, Shift toggles shift-lock.
import * as THREE from 'three'
import { Instance, P } from './instance.js'
import { Vector3, CFrame } from './math.js'
import { enumName } from './enum.js'

export class Camera extends Instance {
  static className = 'Camera'
  static props = {
    CFrame: P.cframe(),
    FieldOfView: P.num(70),
    CameraType: { default: 'Custom', coerce: enumName },
    CameraSubject: P.ref(),
    Focus: P.cframe(),
  }
  get ViewportSize() {
    const e = this._engine
    return e ? new Vector3(e.width, e.height, 0) : new Vector3()
  }
  // Returns a ray { Origin, Direction } (unit direction) through a screen point.
  ScreenPointToRay(x, y, depth = 0) {
    const e = this._engine
    const ndc = new THREE.Vector3((x / e.width) * 2 - 1, -(y / e.height) * 2 + 1, 0.5)
    ndc.unproject(e.camera)
    const o = e.camera.position
    const dir = ndc.sub(o).normalize()
    const origin = new Vector3(o.x + dir.x * depth, o.y + dir.y * depth, o.z + dir.z * depth)
    return { Origin: origin, Direction: new Vector3(dir.x, dir.y, dir.z) }
  }
  ViewportPointToRay(x, y, depth) { return this.ScreenPointToRay(x, y, depth) }
  // Returns [Vector3(screenX, screenY, depth), onScreen].
  WorldToScreenPoint(v) {
    const e = this._engine
    const p = new THREE.Vector3(v.X, v.Y, v.Z)
    const depth = p.clone().sub(e.camera.position).dot(e.camera.getWorldDirection(new THREE.Vector3()))
    p.project(e.camera)
    const sx = (p.x + 1) / 2 * e.width, sy = (1 - p.y) / 2 * e.height
    return [new Vector3(sx, sy, depth), depth > 0 && p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1]
  }
  WorldToViewportPoint(v) { return this.WorldToScreenPoint(v) }
}
Instance.register(Camera)

export class CameraController {
  constructor(engine) {
    this.engine = engine
    this.yaw = 0
    this.pitch = -0.35
    this.zoom = 14
    this.minZoom = 0.5
    this.maxZoom = 120
    this.shiftLock = false
    this.firstPerson = false
    this._dist = this.zoom
  }
  get camera() { return this.engine.workspace.CurrentCamera }
  wheel(dy) {
    if (this.camera.CameraType !== 'Custom') return
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * (dy > 0 ? 1.15 : 1 / 1.15)))
  }
  zoomBy(f) { this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * f)) }
  mouseMove(dx, dy, rotating) {
    if (!rotating || this.camera.CameraType !== 'Custom') return
    this.yaw -= dx * 0.005
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.005))
  }
  // Turns a camera-relative move vector (X right, Z back) into world space.
  relative(v) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw)
    return new Vector3(v.X * c + v.Z * s, 0, -v.X * s + v.Z * c)
  }
  update(dt, uis) {
    const cam = this.camera
    if (!cam) return
    if (cam.CameraType !== 'Custom') return
    if (uis.IsKeyDown('Left')) this.yaw += dt * 2.2
    if (uis.IsKeyDown('Right')) this.yaw -= dt * 2.2
    if (uis.IsKeyDown('I')) this.zoomBy(1 - dt * 2)
    if (uis.IsKeyDown('O')) this.zoomBy(1 + dt * 2)

    const subject = cam.CameraSubject
    let focus
    let ignore = null
    if (subject && subject.ClassName === 'Humanoid' && subject.RootPart && subject._parent) {
      const head = subject._parent.FindFirstChild('Head')
      focus = (head && head.Position ? head.Position : subject.RootPart.Position.add(new Vector3(0, 1.5, 0)))
      ignore = subject._parent
    } else if (subject && subject.Position) {
      focus = subject.Position
      ignore = subject
    } else {
      focus = cam.Focus.Position
    }
    this.firstPerson = this.zoom <= 1
    const rot = CFrame.fromEulerAnglesYXZ(this.pitch, this.yaw, 0)
    let offset = new Vector3()
    if (this.shiftLock && !this.firstPerson) offset = rot.RightVector.mul(1.75)
    const pivot = focus.add(offset)
    const back = rot.ZVector
    let want = this.firstPerson ? 0 : this.zoom
    // Pull the camera in when something blocks the view.
    if (want > 0) {
      const hit = this.engine.physics.raycast(
        [pivot.X, pivot.Y, pivot.Z], [back.X, back.Y, back.Z], want + 0.5,
        (o) => o === 'terrain' || (o._p.CanCollide && o._p.Transparency < 0.5 && !(ignore && (o === ignore || o.IsDescendantOf(ignore)))),
      )
      if (hit) want = Math.max(0.5, hit.distance - 0.6)
    }
    this._dist = want < this._dist ? want : this._dist + (want - this._dist) * Math.min(1, dt * 8)
    const pos = pivot.add(back.mul(this._dist))
    cam._p.CFrame = new CFrame(pos, null, null, rot.q)
    cam._p.Focus = new CFrame(focus)

    // Character faces the camera in first person and shift-lock.
    if (subject && subject.ClassName === 'Humanoid') {
      subject._faceYaw = this.firstPerson || this.shiftLock ? this.yaw : null
      const model = subject._parent
      if (model) {
        const t = this.firstPerson ? 1 : Math.max(0, Math.min(1, (2.5 - this._dist) / 2))
        for (const d of model.GetDescendants()) if (d._localTransparency !== undefined && d._localTransparency !== t) {
          d._localTransparency = t
          this.engine.markRender(d)
        }
      }
    }
  }
}
