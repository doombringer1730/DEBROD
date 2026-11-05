// The engine: owns the renderer, the DataModel, physics, scripts and the frame loop.
import * as THREE from 'three'
import { Instance } from './instance.js'
import { Vector3, CFrame, Color3 } from './math.js'
import { Enum } from './enum.js'
import { BasePart, SpawnLocation, ClickDetector } from './parts.js'
import { Decal, Texture, SpecialMesh, BlockMesh, CylinderMesh, Light } from './extras.js'
import { Humanoid, JointSolver, buildCharacter } from './character.js'
import { DataModel, Player } from './services.js'
import { Camera, CameraController } from './camera.js'
import { InputManager } from './input.js'
import { Physics } from './physics.js'
import { Scheduler, ScriptService } from './scripting.js'
import { VoxelWorld, generateHills, generateFlat } from './voxels.js'
import { savePlace, loadPlace } from './serialize.js'
import { importRoblox } from './rbxl.js'

const STEP = 1 / 60
const MAX_LIGHTS = 12

export class Engine {
  // container: an element to fill. options:
  //   world: { sizeX, sizeY, sizeZ }   block counts (4 studs each)
  //   terrain: 'hills' | 'flat' | 'none'
  //   seed: number
  //   playerName: string
  constructor(container, options = {}) {
    this.options = options
    this.container = container
    container.classList.add('bf-root')
    injectStyle()
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!options.preserveDrawingBuffer })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.canvas = this.renderer.domElement
    this.canvas.tabIndex = 0
    container.appendChild(this.canvas)
    this.ui = new Overlay(this, container)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 6000)
    this.hemi = new THREE.HemisphereLight(0xbcd7ff, 0x5b4a33, 0.9)
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25)
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 800
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.05
    this.scene.add(this.hemi, this.ambient, this.sun, this.sun.target)
    this.sky = makeSky()
    this.scene.add(this.sky)
    this.scene.fog = new THREE.Fog(0xc0d2e6, 0, 100000)

    this.meshes = new Map()
    this.renderDirty = new Set()
    this.humanoids = new Set()
    this.lightCount = 0
    this.running = false
    this.time = 0
    this._acc = 0

    this.physics = new Physics(this)
    this.joints = new JointSolver(this)
    this.scheduler = new Scheduler()
    this.scripts = new ScriptService(this)

    const w = options.world || {}
    this.voxels = new VoxelWorld(this, w)
    this.scene.add(this.voxels.group)

    this.game = new DataModel(this)
    this.workspace = this.game.GetService('Workspace')
    for (const s of ['Players', 'Lighting', 'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'StarterPlayer', 'StarterGui', 'RunService', 'UserInputService', 'TweenService', 'LogService']) this.game.GetService(s)
    const sp = this.game.GetService('StarterPlayer')
    Instance.new('StarterPlayerScripts', sp)
    Instance.new('StarterCharacterScripts', sp)
    const terrain = new (Instance.classFor('Terrain'))()
    terrain._setParent(this.workspace)
    const cam = new Camera()
    cam.Name = 'Camera'
    cam._setParent(this.workspace)
    this.workspace.CurrentCamera = cam
    cam.Focus = new CFrame(0, 20, 0)

    this.lighting = this.game.GetService('Lighting')
    this.runService = this.game.GetService('RunService')
    this.tweens = this.game.GetService('TweenService')
    this.logService = this.game.GetService('LogService')
    this.players = this.game.GetService('Players')

    this.cameraController = new CameraController(this)
    this.input = new InputManager(this, container)

    const seed = options.seed ?? 1
    if (options.terrain === 'hills') generateHills(this.voxels, { seed })
    else if (options.terrain === 'flat') generateFlat(this.voxels, { height: 4 })
    this.voxels.flush()

    this._resize = () => this.resize()
    window.addEventListener('resize', this._resize)
    this.resize()
    this._frame = this._frame.bind(this)
    this._raf = requestAnimationFrame(this._frame)
    this._last = performance.now()
  }

  get width() { return this.container.clientWidth || 1 }
  get height() { return this.container.clientHeight || 1 }
  resize() {
    this.renderer.setSize(this.width, this.height, false)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  // ---- play / stop ----
  // Runs scripts, adds the local player and spawns their character.
  start() {
    if (this.running) return
    this.running = true
    this.scripts.syncAll()
    let player = this.players.LocalPlayer
    if (!player) {
      player = new Player()
      player.Name = this.options.playerName || 'Player1'
      player.DisplayName = player.Name
      player._setParent(this.players)
      this.players.LocalPlayer = player
      this.scheduler.deferred.push(() => this.players.PlayerAdded.Fire(player))
    }
    this.scheduler.deferred.push(() => { if (this.players.CharacterAutoLoads && !player.Character) this.spawnCharacter(player) })
  }
  // Stops scripts and removes the character. The place keeps any changes made while running.
  stop() {
    if (!this.running) return
    this.running = false
    this.scripts.stopAll()
    const p = this.players.LocalPlayer
    if (p && p.Character) {
      p.Character.Destroy()
      p.Character = null
    }
    this.workspace.CurrentCamera.CameraSubject = null
    this.input.unlock()
  }
  dispose() {
    this.stop()
    cancelAnimationFrame(this._raf)
    window.removeEventListener('resize', this._resize)
    this.input.dispose()
    this.renderer.dispose()
    this.canvas.remove()
    this.ui.el.remove()
  }

  spawnCharacter(player) {
    const old = player.Character
    if (old) {
      player.CharacterRemoving.Fire(old)
      old.Destroy()
    }
    const model = buildCharacter(player.Name)
    const spawns = this.workspace.GetDescendants().filter((d) => d instanceof SpawnLocation && d.Enabled)
    let cf
    if (spawns.length) {
      const s = spawns[Math.floor(Math.random() * spawns.length)]
      const top = s.getAABB().max[1]
      const [, yaw] = s.CFrame.ToEulerAnglesYXZ()
      cf = new CFrame(s.Position.X, top + 3.05, s.Position.Z).mul(CFrame.Angles(0, yaw, 0))
    } else {
      const y = Math.max(this.voxels.surfaceY(0, 0), 0)
      cf = new CFrame(0, y + 3.05, 0)
    }
    model.PivotTo(cf)
    const sc = this.game.GetService('StarterPlayer').FindFirstChildOfClass('StarterCharacterScripts')
    if (sc) for (const s of sc.GetChildren()) { const c = s.Clone(); if (c) c.Parent = model }
    model.Parent = this.workspace
    this.joints.solve()
    player.Character = model
    const hum = model.FindFirstChildOfClass('Humanoid')
    this.workspace.CurrentCamera.CameraSubject = hum
    this.cameraController.yaw = CFrame.identity.equals(cf) ? 0 : cf.ToEulerAnglesYXZ()[1]
    hum.Died.Connect(() => {
      this.scheduler.wait(this.players.RespawnTime).then(() => {
        if (this.running && player.Character === model && this.players.CharacterAutoLoads) this.spawnCharacter(player)
      })
    })
    player.CharacterAdded.Fire(model)
    return model
  }
  get localHumanoid() {
    const p = this.players.LocalPlayer
    const c = p && p.Character
    return c ? c.FindFirstChildOfClass('Humanoid') : null
  }

  // ---- output ----
  log(message, type = 'output') {
    const entry = { message, type, time: Date.now() }
    this.logService._history.push(entry)
    if (this.logService._history.length > 500) this.logService._history.shift()
    this.logService.MessageOut.Fire(message, type)
    if (this.onLog) this.onLog(entry)
    if (type === 'error') console.warn(message)
  }
  kick(message) {
    this.stop()
    this.ui.showText('kick', message, 'Message')
  }

  // ---- parts ----
  addPart(part) {
    this.physics.add(part)
    part._lastPos = part._p.CFrame.Position.toArray()
    this.renderDirty.add(part)
  }
  removePart(part) {
    this.physics.remove(part)
    this.renderDirty.delete(part)
    const r = this.meshes.get(part)
    if (r) {
      this.scene.remove(r.mesh)
      if (r.lights) this.lightCount -= r.lights
      this.meshes.delete(part)
    }
  }
  partChanged(part, key) {
    if (key !== 'Decoration') this.physics.changed(part, key)
    this.renderDirty.add(part)
  }
  markRender(part) { if (part._ws) this.renderDirty.add(part) }

  _updateMesh(part) {
    let r = this.meshes.get(part)
    const look = partLook(part)
    if (!r || r.key !== look.key) {
      if (r) {
        this.scene.remove(r.mesh)
        if (r.lights) this.lightCount -= r.lights
      }
      const mesh = new THREE.Mesh(geometry(look.shape), material(part, look))
      mesh.matrixAutoUpdate = false
      mesh.userData.part = part
      r = { mesh, key: look.key, lights: 0 }
      for (const d of part._children) {
        if (d instanceof Decal) {
          const m = decalMesh(d, part)
          if (m) mesh.add(m)
        } else if (d instanceof Light && d._p.Enabled && this.lightCount < MAX_LIGHTS) {
          const l = new THREE.PointLight(d._p.Color.toThree(), d._p.Brightness * 6, d._p.Range * 1.5, 1)
          mesh.add(l)
          r.lights++
          this.lightCount++
        }
      }
      this.scene.add(mesh)
      this.meshes.set(part, r)
    }
    const mesh = r.mesh
    const t = Math.max(part._p.Transparency, part._localTransparency || 0)
    mesh.visible = t < 0.999
    const m = mesh.material
    const opacity = look.glass ? Math.min(1 - t, 0.45) : 1 - t
    if (m.opacity !== opacity) {
      m.opacity = opacity
      const tr = opacity < 0.999
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true }
      m.depthWrite = !tr
    }
    mesh.castShadow = part._p.CastShadow && t < 0.5
    mesh.receiveShadow = true
    for (const c of mesh.children) if (c.isMesh) c.visible = t < 0.999
    let cf = part._p.CFrame
    if (look.offset) cf = cf.mul(new CFrame(look.offset))
    cf.toMatrix4(look.scale, mesh.matrix)
    mesh.matrixWorldNeedsUpdate = true
  }

  // ---- loop ----
  _frame(now) {
    this._raf = requestAnimationFrame(this._frame)
    const dt = Math.min(0.1, (now - this._last) / 1000)
    this._last = now
    try {
      this.tick(dt)
    } catch (e) {
      console.error(e)
    }
  }
  tick(dt) {
    const uis = this.input.uis
    const hum = this.localHumanoid
    if (this.running && hum) {
      const k = (n) => (uis.IsKeyDown(n) ? 1 : 0)
      let mv = new Vector3(k('D') - k('A'), 0, k('S') - k('W'))
      if (this.input.touchMove.Magnitude > 0) mv = this.input.touchMove
      hum.Move(mv, true)
    }
    if (this.running) {
      this._acc += dt
      let n = 0
      while (this._acc >= STEP && n < 5) {
        this.fixedStep(STEP)
        this._acc -= STEP
        n++
      }
      if (n === 5) this._acc = 0
      this.tweens._step(dt)
    } else {
      this.joints.solve()
    }
    this.runService._render(dt)
    this.cameraController.update(dt, uis)
    this.voxels.update()
    for (const p of this.renderDirty) if (p._ws && !p._destroyed) this._updateMesh(p)
    this.renderDirty.clear()
    this._updateCamera()
    this._updateLighting()
    this._updateMouse()
    this.ui.update(dt)
    this.renderer.render(this.scene, this.camera)
  }
  fixedStep(dt) {
    this.time += dt
    this.scheduler.tick(dt)
    this.runService.Stepped.Fire(this.time, dt)
    this.physics.step(dt)
    this.joints.solve()
    this.runService.Heartbeat.Fire(dt)
  }

  _updateCamera() {
    const cam = this.workspace.CurrentCamera
    if (!cam) return
    const cf = cam._p.CFrame
    const p = cf.Position
    this.camera.position.set(p.X, p.Y, p.Z)
    this.camera.quaternion.copy(cf.q)
    if (this.camera.fov !== cam._p.FieldOfView) {
      this.camera.fov = cam._p.FieldOfView
      this.camera.updateProjectionMatrix()
    }
    this.camera.updateMatrixWorld()
    this.sky.position.copy(this.camera.position)
  }
  _updateLighting() {
    const L = this.lighting._p
    const dir = this.lighting.GetSunDirection()
    const elev = dir.Y
    const day = Math.max(0, Math.min(1, elev * 4 + 0.3))
    const focus = this.workspace.CurrentCamera._p.Focus.Position
    this.sun.position.set(focus.X + dir.X * 300, focus.Y + dir.Y * 300, focus.Z + dir.Z * 300)
    this.sun.target.position.set(focus.X, focus.Y, focus.Z)
    this.sun.target.updateMatrixWorld()
    this.sun.intensity = Math.max(0, elev) > 0 ? (L.Brightness * 1.1) * Math.min(1, elev * 5) : 0
    this.sun.castShadow = L.GlobalShadows && elev > 0
    const dusk = 1 - Math.min(1, Math.abs(elev) * 4)
    this.sun.color.setRGB(1, 1 - dusk * 0.35, 1 - dusk * 0.6)
    const amb = L.Ambient, out = L.OutdoorAmbient
    this.ambient.color.setRGB(amb.R, amb.G, amb.B, THREE.SRGBColorSpace)
    this.ambient.intensity = 0.6
    this.hemi.color.setRGB(out.R * 1.2, out.G * 1.35, out.B * 1.6, THREE.SRGBColorSpace)
    this.hemi.intensity = 0.25 + day * 0.75
    const u = this.sky.material.uniforms
    const top = new THREE.Color(0x0b1026).lerp(new THREE.Color(0x3d7bd9), day)
    const horizon = new THREE.Color(0x1a2140).lerp(new THREE.Color(0xbfd9f2), day).lerp(new THREE.Color(0xf0a060), dusk * day * 0.8)
    u.top.value.copy(top)
    u.horizon.value.copy(horizon)
    u.sunDir.value.set(dir.X, dir.Y, dir.Z)
    const fog = this.scene.fog
    fog.near = L.FogStart
    fog.far = L.FogEnd
    const fc = L.FogColor
    fog.color.setRGB(fc.R, fc.G, fc.B, THREE.SRGBColorSpace).lerp(horizon, 0.5)
    this.renderer.toneMappingExposure = 2 ** L.ExposureCompensation
  }
  _updateMouse() {
    const mouse = this.input.mouse
    const cam = this.workspace.CurrentCamera
    const x = this.input.locked ? this.width / 2 : mouse.X
    const y = this.input.locked ? this.height / 2 : mouse.Y
    const ray = cam.ScreenPointToRay(x, y)
    mouse.UnitRay = ray
    const char = this.players.LocalPlayer && this.players.LocalPlayer.Character
    const tf = mouse.TargetFilter
    const hit = this.physics.raycast(ray.Origin.toArray(), ray.Direction.toArray(), 1000, (o) => {
      if (o === 'terrain') return true
      if (char && o.IsDescendantOf(char)) return false
      if (tf && (o === tf || o.IsDescendantOf(tf))) return false
      return o._p.Transparency < 1
    })
    if (hit) {
      mouse.Hit = new CFrame(Vector3.fromArray(hit.position), null, null, cam._p.CFrame.q)
      mouse.Target = hit.instance === 'terrain' ? this.workspace.Terrain : hit.instance
      mouse._normal = hit.normal
      mouse._cell = hit.cell
    } else {
      mouse.Hit = new CFrame(ray.Origin.add(ray.Direction.mul(1000)))
      mouse.Target = null
      mouse._normal = null
      mouse._cell = null
    }
    // ClickDetector hover
    const cd = this.running ? this._clickDetector(mouse.Target, hit) : null
    if (cd !== this._hoverCd) {
      const player = this.players.LocalPlayer
      if (this._hoverCd && !this._hoverCd._destroyed) this._hoverCd.MouseHoverLeave.Fire(player)
      if (cd) cd.MouseHoverEnter.Fire(player)
      this._hoverCd = cd
      this.canvas.style.cursor = cd ? 'pointer' : ''
    }
  }
  _clickDetector(target, hit) {
    if (!target || !hit || target === this.workspace.Terrain) return null
    let cd = null
    for (let a = target; a && !cd; a = a._parent) cd = a.FindFirstChildOfClass ? a.FindFirstChildOfClass('ClickDetector') : null
    if (!cd) return null
    const hum = this.localHumanoid
    const from = hum && hum.RootPart ? hum.RootPart.Position : this.workspace.CurrentCamera.CFrame.Position
    return from.sub(Vector3.fromArray(hit.position)).Magnitude <= cd.MaxActivationDistance ? cd : null
  }

  _onKey(k, down) {
    const hum = this.localHumanoid
    if (k === Enum.KeyCode.Space && hum && this.running) {
      hum._holdJump = down
      hum.Jump = down
    }
    if (down && (k === Enum.KeyCode.LeftShift || k === Enum.KeyCode.RightShift) && this.running) {
      const c = this.cameraController
      c.shiftLock = !c.shiftLock
      if (c.shiftLock) this.input.lock()
      else if (!c.firstPerson) this.input.unlock()
    }
    if (this.onKey) this.onKey(k, down)
  }
  _onMouseButton(button, down, ev) {
    this.canvas.focus()
    const c = this.cameraController
    if (down && button === 0 && this.running && (c.firstPerson || c.shiftLock) && !this.input.locked) this.input.lock()
    if (down && button === 0 && this.running && this._hoverCd) this._hoverCd.MouseClick.Fire(this.players.LocalPlayer)
    if (this.onMouseButton) this.onMouseButton(button, down, ev)
  }

  // ---- places ----
  save() { return savePlace(this) }
  load(data) {
    const wasRunning = this.running
    this.stop()
    loadPlace(this, typeof data === 'string' ? JSON.parse(data) : data)
    if (wasRunning) this.start()
  }
  // Imports a Roblox .rbxl/.rbxm/.rbxlx/.rbxmx file (ArrayBuffer or Uint8Array).
  importRoblox(buffer, options) { return importRoblox(this, buffer, options) }
  clearPlace() {
    for (const s of ['Workspace', 'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'StarterGui']) {
      const svc = this.game.GetService(s)
      for (const c of svc.GetChildren()) if (!c._isService && c.ClassName !== 'Terrain' && c.ClassName !== 'Camera') c.Destroy()
    }
    for (const s of this.game.GetService('StarterPlayer').GetChildren()) s.ClearAllChildren()
  }
}

// ---- part appearance ----
const MAT = {
  Plastic: { roughness: 0.72, metalness: 0 },
  SmoothPlastic: { roughness: 0.38, metalness: 0 },
  Neon: { roughness: 1, metalness: 0, neon: true },
  Glass: { roughness: 0.05, metalness: 0.1, glass: true },
  Metal: { roughness: 0.35, metalness: 0.7 },
  DiamondPlate: { roughness: 0.35, metalness: 0.7 },
  CorrodedMetal: { roughness: 0.7, metalness: 0.5 },
  Foil: { roughness: 0.2, metalness: 0.9 },
  ForceField: { roughness: 1, metalness: 0, glass: true },
  Ice: { roughness: 0.15, metalness: 0 },
}
const materialCache = new Map()
function material(part, look) {
  const key = look.matKey
  let m = materialCache.get(key)
  if (m) return m.clone()
  const def = MAT[part._p.Material] || { roughness: 0.85, metalness: 0 }
  const color = part._p.Color.toThree()
  m = new THREE.MeshStandardMaterial({
    color,
    roughness: def.roughness,
    metalness: def.metalness,
    emissive: def.neon ? color : 0x000000,
    emissiveIntensity: def.neon ? 1.2 : 0,
  })
  materialCache.set(key, m)
  return m.clone()
}

function partLook(part) {
  let shape = part.shapeName
  let scale = part._p.Size
  let offset = null
  const mesh = part._children.find((c) => c instanceof SpecialMesh || c instanceof BlockMesh || c instanceof CylinderMesh)
  if (mesh) {
    if (mesh instanceof CylinderMesh) shape = 'CylinderY'
    else if (mesh instanceof BlockMesh) shape = 'Block'
    else {
      const t = mesh._p.MeshType
      shape = { Sphere: 'Ball', Cylinder: 'Cylinder', Head: 'Head', Wedge: 'Wedge', Brick: 'Block', Torso: 'Block', FileMesh: 'Block' }[t] || 'Block'
    }
    if (!(mesh instanceof SpecialMesh && mesh._p.MeshType === 'FileMesh')) scale = scale.mul(mesh._p.Scale)
    if (!mesh._p.Offset.equals(Vector3.zero)) offset = mesh._p.Offset
  }
  if (shape === 'Head') {
    const k = mesh ? 1 : 1.25
    const d = Math.min(scale.X, scale.Z) * k
    scale = new Vector3(d, scale.Y * k, d)
  }
  if (shape === 'Ball') {
    const d = Math.min(scale.X, scale.Y, scale.Z)
    if (!mesh) scale = new Vector3(d, d, d)
  }
  const glass = (MAT[part._p.Material] || {}).glass
  const decals = part._children.filter((c) => c instanceof Decal || c instanceof Light)
  const dkey = decals.map((d) => `${d.ClassName}:${d._p.Texture || ''}:${d._p.Face || ''}:${d._p.Transparency ?? ''}:${d._p.Enabled ?? ''}`).join('|')
  const matKey = `${part._p.Color.ToHex()}|${part._p.Material}`
  return { shape, scale, offset, glass, matKey, key: `${shape}|${matKey}|${dkey}` }
}

const geoCache = new Map()
function geometry(shape) {
  let g = geoCache.get(shape)
  if (g) return g
  if (shape === 'Ball') g = new THREE.SphereGeometry(0.5, 24, 16)
  else if (shape === 'Cylinder') g = new THREE.CylinderGeometry(0.5, 0.5, 1, 24).rotateZ(Math.PI / 2)
  else if (shape === 'CylinderY' || shape === 'Head') g = new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
  else if (shape === 'Wedge') g = wedgeGeometry()
  else g = new THREE.BoxGeometry(1, 1, 1)
  geoCache.set(shape, g)
  return g
}
// Roblox wedge: full bottom and back (+Z) faces, slope rising from front-bottom to back-top.
function wedgeGeometry() {
  const v = {
    a: [-0.5, -0.5, -0.5], b: [0.5, -0.5, -0.5], c: [0.5, -0.5, 0.5], d: [-0.5, -0.5, 0.5],
    e: [-0.5, 0.5, 0.5], f: [0.5, 0.5, 0.5],
  }
  const tris = [
    ['a', 'b', 'c'], ['a', 'c', 'd'], // bottom
    ['d', 'c', 'f'], ['d', 'f', 'e'], // back
    ['a', 'e', 'f'], ['a', 'f', 'b'], // slope
    ['a', 'd', 'e'], // left
    ['b', 'f', 'c'], // right
  ]
  const pos = []
  for (const t of tris) for (const k of t) pos.push(...v[k])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

const FACE = {
  Front: { p: [0, 0, -0.502], r: [0, Math.PI, 0] },
  Back: { p: [0, 0, 0.502], r: [0, 0, 0] },
  Right: { p: [0.502, 0, 0], r: [0, Math.PI / 2, 0] },
  Left: { p: [-0.502, 0, 0], r: [0, -Math.PI / 2, 0] },
  Top: { p: [0, 0.502, 0], r: [-Math.PI / 2, 0, 0] },
  Bottom: { p: [0, -0.502, 0], r: [Math.PI / 2, 0, 0] },
}
const texCache = new Map()
const loader = new THREE.TextureLoader()
loader.setCrossOrigin('anonymous')
function textureFor(url) {
  if (!url || /^rbxasset|roblox\.com\/asset|^rbxthumb/i.test(url)) return null
  let t = texCache.get(url)
  if (t) return t
  if (url === 'builtin://face') t = new THREE.CanvasTexture(faceCanvas())
  else t = loader.load(url)
  t.colorSpace = THREE.SRGBColorSpace
  texCache.set(url, t)
  return t
}
function decalMesh(d, part) {
  const tex = textureFor(d._p.Texture)
  if (!tex) return null
  const f = FACE[d._p.Face] || FACE.Front
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 1 - d._p.Transparency, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  if (d instanceof Texture) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    const s = part._p.Size
    const [w, h] = d._p.Face === 'Top' || d._p.Face === 'Bottom' ? [s.X, s.Z] : d._p.Face === 'Left' || d._p.Face === 'Right' ? [s.Z, s.Y] : [s.X, s.Y]
    tex.repeat.set(w / d._p.StudsPerTileU, h / d._p.StudsPerTileV)
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  m.position.set(...f.p)
  m.rotation.set(...f.r)
  return m
}
function faceCanvas() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#111'
  g.beginPath(); g.ellipse(44, 50, 7, 12, 0, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(84, 50, 7, 12, 0, 0, Math.PI * 2); g.fill()
  g.lineWidth = 7
  g.lineCap = 'round'
  g.strokeStyle = '#111'
  g.beginPath(); g.arc(64, 70, 26, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke()
  return c
}

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3d7bd9) },
      horizon: { value: new THREE.Color(0xbfd9f2) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.6));
        if (vDir.y < 0.0) c = horizon * 0.85;
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18) * step(-0.05, sunDir.y);
        float m = max(dot(normalize(vDir), -normalize(sunDir)), 0.0);
        c += vec3(0.8, 0.85, 1.0) * pow(m, 900.0) * step(0.0, -sunDir.y);
        gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
      }`,
  })
  const m = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat)
  m.renderOrder = -1
  m.frustumCulled = false
  return m
}

// HTML layer over the canvas: hints, messages, the leaderboard.
class Overlay {
  constructor(engine, container) {
    this.engine = engine
    this.el = document.createElement('div')
    this.el.className = 'bf-overlay'
    container.appendChild(this.el)
    this.texts = new Map()
    this.board = document.createElement('div')
    this.board.className = 'bf-board'
    this.el.appendChild(this.board)
    this.cross = document.createElement('div')
    this.cross.className = 'bf-cross'
    this.el.appendChild(this.cross)
    this._t = 0
  }
  showText(owner, text, kind) {
    let el = this.texts.get(owner)
    if (!el) {
      el = document.createElement('div')
      el.className = kind === 'Hint' ? 'bf-hint' : 'bf-message'
      this.el.appendChild(el)
      this.texts.set(owner, el)
    }
    el.textContent = text
    el.style.display = text ? '' : 'none'
  }
  hideText(owner) {
    const el = this.texts.get(owner)
    if (el) { el.remove(); this.texts.delete(owner) }
  }
  update(dt) {
    const c = this.engine.cameraController
    this.cross.style.display = this.engine.running && (c.firstPerson || c.shiftLock) ? '' : 'none'
    this._t += dt
    if (this._t < 0.25) return
    this._t = 0
    const rows = []
    let headers = null
    for (const p of this.engine.players.GetPlayers()) {
      const ls = p.FindFirstChild('leaderstats')
      if (!ls) continue
      const stats = ls.GetChildren().filter((v) => 'Value' in v._p)
      headers = headers || stats.map((s) => s.Name)
      rows.push([p.DisplayName || p.Name, ...stats.map((s) => (typeof s.Value === 'number' ? Math.round(s.Value * 100) / 100 : String(s.Value)))])
    }
    const html = headers
      ? `<table><tr><th>Player</th>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`
      : ''
    if (html !== this._html) {
      this._html = html
      this.board.innerHTML = html
      this.board.style.display = html ? '' : 'none'
    }
  }
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) }

let styled = false
function injectStyle() {
  if (styled) return
  styled = true
  const s = document.createElement('style')
  s.textContent = `
.bf-root{position:relative;overflow:hidden;background:#87b5e5;touch-action:none;user-select:none}
.bf-root canvas{display:block;width:100%;height:100%;outline:none}
.bf-overlay{position:absolute;inset:0;pointer-events:none;font:14px/1.4 system-ui,sans-serif;color:#fff}
.bf-hint{position:absolute;top:0;left:0;right:0;padding:6px 12px;background:rgba(0,0,0,.6);text-align:center}
.bf-message{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);max-width:70%;padding:16px 24px;background:rgba(0,0,0,.65);border-radius:8px;font-size:20px;text-align:center}
.bf-board{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.5);border-radius:6px;padding:4px 8px;display:none}
.bf-board th,.bf-board td{padding:2px 8px;text-align:left}.bf-board th{opacity:.75;font-weight:600}
.bf-cross{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 2px #000;display:none}
`
  document.head.appendChild(s)
}

export { Instance, Vector3, Color3, CFrame, Enum, BasePart, Humanoid, ClickDetector }
