// Keyboard and mouse. Exposed to scripts as UserInputService and Mouse.
import { Instance, P } from './instance.js'
import { Signal } from './signal.js'
import { Enum, keyCodeFromEvent } from './enum.js'
import { Vector3, CFrame } from './math.js'

class InputObject {
  constructor(type, state, keyCode = Enum.KeyCode.Unknown, position = new Vector3(), delta = new Vector3()) {
    this.UserInputType = type
    this.UserInputState = state
    this.KeyCode = keyCode
    this.Position = position
    this.Delta = delta
  }
}

function typing(target) {
  if (!target || !target.tagName) return false
  const t = target.tagName
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || target.isContentEditable
}

export class UserInputService extends Instance {
  static className = 'UserInputService'
  static notCreatable = true
  static props = { MouseBehavior: { default: 'Default', coerce: (v) => (v && v.Name) || String(v) }, MouseIconEnabled: P.bool(true) }
  constructor() {
    super()
    this.InputBegan = new Signal()
    this.InputEnded = new Signal()
    this.InputChanged = new Signal()
    this.KeyboardEnabled = true
    this.MouseEnabled = true
    this.TouchEnabled = typeof window !== 'undefined' && 'ontouchstart' in window
    this._keys = new Set()
    this._buttons = new Set()
    this._mouse = [0, 0]
  }
  IsKeyDown(k) { return this._keys.has(typeof k === 'string' ? Enum.KeyCode[k] : k) }
  IsMouseButtonPressed(t) { return this._buttons.has(typeof t === 'string' ? Enum.UserInputType[t] : t) }
  GetKeysPressed() { return [...this._keys].map((k) => new InputObject(Enum.UserInputType.Keyboard, Enum.UserInputState.Begin, k)) }
  GetMouseLocation() { return new Vector3(this._mouse[0], this._mouse[1], 0) }
  GetFocusedTextBox() { return null }
}
Instance.register(UserInputService)

export class Mouse {
  constructor(engine) {
    this._engine = engine
    this.Button1Down = new Signal()
    this.Button1Up = new Signal()
    this.Button2Down = new Signal()
    this.Button2Up = new Signal()
    this.Move = new Signal()
    this.WheelForward = new Signal()
    this.WheelBackward = new Signal()
    this.KeyDown = new Signal()
    this.Hit = new CFrame()
    this.Target = null
    this.TargetSurface = null
    this.TargetFilter = null
    this.UnitRay = null
    this.X = 0
    this.Y = 0
    this.Icon = ''
  }
  get ViewSizeX() { return this._engine.width }
  get ViewSizeY() { return this._engine.height }
}

// Wires DOM events to UserInputService, the Mouse and the camera.
export class InputManager {
  constructor(engine, el) {
    this.engine = engine
    this.el = el
    this.uis = engine.game.GetService('UserInputService')
    this.mouse = new Mouse(engine)
    this.locked = false
    this._handlers = []
    const on = (target, ev, fn, opts) => {
      target.addEventListener(ev, fn, opts)
      this._handlers.push([target, ev, fn, opts])
    }
    on(window, 'keydown', (e) => this._key(e, true))
    on(window, 'keyup', (e) => this._key(e, false))
    on(window, 'blur', () => {
      for (const k of [...this.uis._keys]) this._fireKey(k, false, false)
      this.uis._buttons.clear()
    })
    on(el, 'contextmenu', (e) => e.preventDefault())
    on(el, 'mousedown', (e) => this._button(e, true))
    on(window, 'mouseup', (e) => this._button(e, false))
    on(window, 'mousemove', (e) => this._move(e))
    on(el, 'wheel', (e) => {
      e.preventDefault()
      const pos = this._pos(e)
      const io = new InputObject(Enum.UserInputType.MouseWheel, Enum.UserInputState.Change, undefined, pos, new Vector3(0, 0, -Math.sign(e.deltaY)))
      this.uis.InputChanged.Fire(io, false)
      if (e.deltaY < 0) this.mouse.WheelForward.Fire()
      else this.mouse.WheelBackward.Fire()
      engine.cameraController.wheel(e.deltaY)
    }, { passive: false })
    on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === el })
    this._touch(on)
  }
  dispose() {
    for (const [t, ev, fn, opts] of this._handlers) t.removeEventListener(ev, fn, opts)
  }
  _pos(e) {
    const r = this.el.getBoundingClientRect()
    return new Vector3(e.clientX - r.left, e.clientY - r.top, 0)
  }
  _key(e, down) {
    if (e.repeat && down) return
    const processed = typing(e.target)
    const k = keyCodeFromEvent(e.code)
    if (!processed && down && (k === Enum.KeyCode.Space || k.Name.length <= 5 && /^(Up|Down|Left|Right)$/.test(k.Name))) {
      if (this.engine.running) e.preventDefault()
    }
    this._fireKey(k, down, processed)
  }
  _fireKey(k, down, processed) {
    if (down) this.uis._keys.add(k)
    else this.uis._keys.delete(k)
    const io = new InputObject(Enum.UserInputType.Keyboard, down ? Enum.UserInputState.Begin : Enum.UserInputState.End, k)
    io._processed = processed
    if (down) {
      this.uis.InputBegan.Fire(io, processed)
      if (!processed) this.mouse.KeyDown.Fire(k.Name.toLowerCase())
    } else this.uis.InputEnded.Fire(io, processed)
    if (!processed) this.engine._onKey(k, down)
  }
  _button(e, down) {
    if (down && e.target !== this.el && !this.el.contains(e.target)) return
    const processed = down && e.target !== this.el && !(e.target && e.target.tagName === 'CANVAS')
    const type = [Enum.UserInputType.MouseButton1, Enum.UserInputType.MouseButton3, Enum.UserInputType.MouseButton2][e.button]
    if (!type) return
    if (down) this.uis._buttons.add(type)
    else if (!this.uis._buttons.has(type)) return
    else this.uis._buttons.delete(type)
    const io = new InputObject(type, down ? Enum.UserInputState.Begin : Enum.UserInputState.End, undefined, this._pos(e))
    if (down) this.uis.InputBegan.Fire(io, processed)
    else this.uis.InputEnded.Fire(io, processed)
    if (processed) return
    if (e.button === 0) (down ? this.mouse.Button1Down : this.mouse.Button1Up).Fire()
    if (e.button === 2) (down ? this.mouse.Button2Down : this.mouse.Button2Up).Fire()
    this.engine._onMouseButton(e.button, down, e)
  }
  _move(e) {
    const pos = this._pos(e)
    if (!this.locked) {
      this.uis._mouse = [pos.X, pos.Y]
      this.mouse.X = pos.X
      this.mouse.Y = pos.Y
    }
    const io = new InputObject(Enum.UserInputType.MouseMovement, Enum.UserInputState.Change, undefined, pos, new Vector3(e.movementX, e.movementY, 0))
    this.uis.InputChanged.Fire(io, false)
    this.mouse.Move.Fire()
    this.engine.cameraController.mouseMove(e.movementX, e.movementY, this.locked || this.uis._buttons.has(Enum.UserInputType.MouseButton2))
  }
  lock() { if (!this.locked && this.el.requestPointerLock) this.el.requestPointerLock() }
  unlock() { if (this.locked) document.exitPointerLock() }

  // Touch: left half of the screen is a move stick, right half drags the camera, two-finger tap jumps.
  _touch(on) {
    this.touchMove = new Vector3()
    let stick = null, look = null
    on(this.el, 'touchstart', (e) => {
      for (const t of e.changedTouches) {
        const r = this.el.getBoundingClientRect()
        if (t.clientX - r.left < r.width / 2 && !stick) stick = { id: t.identifier, x: t.clientX, y: t.clientY }
        else if (!look) look = { id: t.identifier, x: t.clientX, y: t.clientY }
      }
      if (e.touches.length >= 2 && !stick) this.engine._onKey(Enum.KeyCode.Space, true)
      e.preventDefault()
    }, { passive: false })
    on(this.el, 'touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (stick && t.identifier === stick.id) {
          const dx = (t.clientX - stick.x) / 50, dy = (t.clientY - stick.y) / 50
          const m = Math.min(1, Math.hypot(dx, dy))
          const a = Math.atan2(dy, dx)
          this.touchMove = m > 0.15 ? new Vector3(Math.cos(a) * m, 0, Math.sin(a) * m) : new Vector3()
        } else if (look && t.identifier === look.id) {
          this.engine.cameraController.mouseMove((t.clientX - look.x) * 2, (t.clientY - look.y) * 2, true)
          look.x = t.clientX
          look.y = t.clientY
        }
      }
      e.preventDefault()
    }, { passive: false })
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (stick && t.identifier === stick.id) { stick = null; this.touchMove = new Vector3() }
        if (look && t.identifier === look.id) look = null
      }
      this.engine._onKey(Enum.KeyCode.Space, false)
    }
    on(this.el, 'touchend', end)
    on(this.el, 'touchcancel', end)
  }
}
