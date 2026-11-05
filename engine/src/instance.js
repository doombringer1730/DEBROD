// The instance tree. Every object in a place (parts, models, scripts,
// services) is an Instance with a Name, a Parent and children, exactly like
// Roblox. Children can be reached as properties: workspace.Baseplate.

import { Signal } from './signal.js'
import { Vector3, Color3, CFrame } from './math.js'
import { EnumItem } from './enum.js'

const registry = new Map()
const propCache = new Map()
let nextId = 1

// Children are reachable as properties (workspace.Coins). Each parent gets a
// getter for every child name that doesn't clash with a real member.
function exposeChild(parent, name) {
  if (!name || name in parent) return
  if (!parent._exposed) parent._exposed = new Set()
  parent._exposed.add(name)
  Object.defineProperty(parent, name, { configurable: true, enumerable: false, get() { return this._childByName(name) } })
}
function unexposeChild(parent, name) {
  if (!parent._exposed || !parent._exposed.has(name)) return
  if (parent._childByName(name)) return
  parent._exposed.delete(name)
  delete parent[name]
}
export function adoptChild(parent, child) {
  child._parent = parent
  parent._children.push(child)
  exposeChild(parent, child._p.Name)
}

function sameValue(a, b) {
  if (a === b) return true
  if (a && typeof a.equals === 'function') return a.equals(b)
  return false
}

function coerceValue(def, v) {
  if (def.coerce) return def.coerce(v)
  if (v instanceof EnumItem) return v.Name
  return v
}

// Every property a class has, its own and inherited: Map<name, definition>.
export function allProps(cls) {
  let map = propCache.get(cls)
  if (map) return map
  const parent = Object.getPrototypeOf(cls)
  map = new Map(parent && parent !== Function.prototype && parent.props ? allProps(parent) : [])
  if (Object.prototype.hasOwnProperty.call(cls, 'props')) {
    for (const [k, d] of Object.entries(cls.props)) map.set(k, d)
  }
  propCache.set(cls, map)
  return map
}

export class Instance {
  static className = 'Instance'
  static props = {
    Name: { default: null, coerce: String },
    Archivable: { default: true, coerce: Boolean },
  }

  constructor() {
    this._id = nextId++
    this._p = {}
    for (const [k, d] of allProps(this.constructor)) {
      this._p[k] = typeof d.default === 'function' ? d.default() : d.default
    }
    if (this._p.Name == null) this._p.Name = this.constructor.className
    this._parent = null
    this._children = []
    this._attributes = new Map()
    this._propSignals = new Map()
    this._attrSignals = new Map()
    this._destroyed = false
    this._dm = null
    this._ws = null
    this.Changed = new Signal()
    this.ChildAdded = new Signal()
    this.ChildRemoved = new Signal()
    this.DescendantAdded = new Signal()
    this.DescendantRemoving = new Signal()
    this.AncestryChanged = new Signal()
    this.AttributeChanged = new Signal()
    this.Destroying = new Signal()
  }

  // Registers a class so Instance.new can create it, and turns its static
  // `props` into getters and setters that fire Changed.
  static register(cls) {
    registry.set(cls.className, cls)
    if (Object.prototype.hasOwnProperty.call(cls, 'props')) {
      for (const [key, def] of Object.entries(cls.props)) {
        if (Object.getOwnPropertyDescriptor(cls.prototype, key)) continue
        Object.defineProperty(cls.prototype, key, {
          configurable: true,
          get() { return this._p[key] },
          set(v) {
            v = coerceValue(def, v)
            const old = this._p[key]
            if (sameValue(old, v)) return
            this._p[key] = v
            this._propChanged(key, v, old)
          },
        })
      }
    }
    return cls
  }

  static new(className, parent) {
    const cls = registry.get(className)
    if (!cls || isNotCreatable(cls)) throw new Error(`Unable to create an Instance of type "${className}"`)
    const inst = new cls()
    if (parent) inst.Parent = parent
    return inst
  }

  static classFor(className) { return registry.get(className) }
  static get classNames() { return [...registry.keys()] }

  get ClassName() { return this.constructor.className }

  get Parent() { return this._parent }
  set Parent(p) {
    if (p === undefined) p = null
    if (p === this._parent) return
    if (this._destroyed) throw new Error(`The Parent property of ${this._p.Name} is locked`)
    if (this._isService && this._parent) throw new Error(`${this._p.Name} cannot be reparented`)
    if (p && !(p instanceof Instance)) throw new TypeError('Parent must be an Instance or null')
    if (p && (p === this || p.IsDescendantOf(this))) {
      throw new Error(`Attempt to set parent of ${this._p.Name} would result in circular reference`)
    }
    this._setParent(p)
  }

  _setParent(p) {
    const old = this._parent
    if (old) {
      for (let a = old; a; a = a._parent) a.DescendantRemoving.Fire(this)
      const i = old._children.indexOf(this)
      if (i >= 0) old._children.splice(i, 1)
      unexposeChild(old, this._p.Name)
    }
    this._parent = p
    if (p) {
      p._children.push(this)
      exposeChild(p, this._p.Name)
    }
    this._refreshContext()
    if (old) old.ChildRemoved.Fire(this)
    this._propChanged('Parent', p, old)
    this.AncestryChanged.Fire(this, p)
    for (const d of this.GetDescendants()) d.AncestryChanged.Fire(this, p)
    if (p) {
      p.ChildAdded.Fire(this)
      const added = [this, ...this.GetDescendants()]
      for (let a = p; a; a = a._parent) for (const d of added) a.DescendantAdded.Fire(d)
    }
  }

  _refreshContext() {
    let root = this
    let ws = null
    for (let a = this; a; a = a._parent) {
      if (!ws && a._isWorkspace) ws = a
      root = a
    }
    const dm = root._isDataModel ? root : null
    this._applyContext(dm, dm ? ws : null)
  }

  _applyContext(dm, ws) {
    const oldWs = this._ws
    const oldDm = this._dm
    this._dm = dm
    this._ws = ws
    if (oldWs !== this._ws) {
      if (oldWs) this._leaveWorkspace(oldWs)
      if (this._ws) this._enterWorkspace(this._ws)
    }
    if (oldDm !== dm || oldWs !== this._ws) this._contextChanged()
    for (const c of this._children) c._applyContext(dm, this._ws)
  }

  // Hooks for subclasses.
  _enterWorkspace() {}
  _leaveWorkspace() {}
  _contextChanged() {}
  _onProp() {}

  get _engine() { return this._dm ? this._dm._engine : null }

  _propChanged(key, v, old) {
    if (key === 'Name' && this._parent) {
      unexposeChild(this._parent, old)
      exposeChild(this._parent, v)
    }
    this._onProp(key, v, old)
    this.Changed.Fire(key)
    const s = this._propSignals.get(key)
    if (s) s.Fire()
  }

  _childByName(name) {
    for (const c of this._children) if (c._p.Name === name) return c
    return undefined
  }

  GetPropertyChangedSignal(prop) {
    let s = this._propSignals.get(prop)
    if (!s) this._propSignals.set(prop, (s = new Signal()))
    return s
  }

  GetChildren() { return this._children.slice() }
  GetDescendants() {
    const out = []
    const walk = (n) => {
      for (const c of n._children) {
        out.push(c)
        walk(c)
      }
    }
    walk(this)
    return out
  }
  FindFirstChild(name, recursive = false) {
    for (const c of this._children) if (c._p.Name === name) return c
    if (recursive) {
      for (const c of this._children) {
        const f = c.FindFirstChild(name, true)
        if (f) return f
      }
    }
    return null
  }
  FindFirstChildOfClass(className) {
    return this._children.find((c) => c.ClassName === className) || null
  }
  FindFirstChildWhichIsA(className, recursive = false) {
    for (const c of this._children) if (c.IsA(className)) return c
    if (recursive) {
      for (const c of this._children) {
        const f = c.FindFirstChildWhichIsA(className, true)
        if (f) return f
      }
    }
    return null
  }
  FindFirstAncestor(name) {
    for (let a = this._parent; a; a = a._parent) if (a._p.Name === name) return a
    return null
  }
  FindFirstAncestorOfClass(className) {
    for (let a = this._parent; a; a = a._parent) if (a.ClassName === className) return a
    return null
  }
  FindFirstAncestorWhichIsA(className) {
    for (let a = this._parent; a; a = a._parent) if (a.IsA(className)) return a
    return null
  }
  // Resolves with the child once it exists. `await part.WaitForChild('Handle')`
  WaitForChild(name, timeout) {
    const found = this.FindFirstChild(name)
    if (found) return Promise.resolve(found)
    return new Promise((resolve) => {
      const c = this.ChildAdded.Connect((child) => {
        if (child._p.Name === name) {
          c.Disconnect()
          resolve(child)
        }
      })
      if (timeout != null) {
        setTimeout(() => {
          if (c.Connected) {
            c.Disconnect()
            resolve(null)
          }
        }, timeout * 1000)
      }
    })
  }
  IsA(className) {
    for (let c = this.constructor; c && c.className; c = Object.getPrototypeOf(c)) {
      if (c.className === className) return true
      if (c.aliases && c.aliases.includes(className)) return true
    }
    return false
  }
  IsDescendantOf(other) {
    for (let a = this._parent; a; a = a._parent) if (a === other) return true
    return false
  }
  IsAncestorOf(other) { return other ? other.IsDescendantOf(this) : false }
  GetFullName() {
    const names = []
    for (let a = this; a && !a._isDataModel; a = a._parent) names.unshift(a._p.Name)
    return names.join('.')
  }
  ClearAllChildren() {
    for (const c of this._children.slice()) if (!c._isService) c.Destroy()
  }
  Destroy() {
    if (this._destroyed || this._isService) return
    this.Destroying.Fire()
    for (const c of this._children.slice()) c.Destroy()
    if (this._parent) this._setParent(null)
    this._destroyed = true
    this._onDestroy()
    for (const v of Object.values(this)) if (v instanceof Signal) v.DisconnectAll()
    for (const s of this._propSignals.values()) s.DisconnectAll()
    for (const s of this._attrSignals.values()) s.DisconnectAll()
  }
  _onDestroy() {}
  Remove() { this.Parent = null }

  Clone() {
    if (!this._p.Archivable || isNotCreatable(this.constructor)) return null
    const map = new Map()
    const copy = this._cloneInto(map)
    // Point object references (Model.PrimaryPart, ObjectValue.Value) at the copies.
    for (const [orig, clone] of map) {
      for (const [k, d] of allProps(orig.constructor)) {
        if (d.ref && map.has(orig._p[k])) clone._p[k] = map.get(orig._p[k])
      }
    }
    return copy
  }
  _cloneInto(map) {
    const copy = new this.constructor()
    map.set(this, copy)
    for (const [k] of allProps(this.constructor)) copy._p[k] = this._p[k]
    for (const [k, v] of this._attributes) copy._attributes.set(k, v)
    copy._afterClone(this)
    for (const c of this._children) {
      if (!c._p.Archivable || isNotCreatable(c.constructor)) continue
      adoptChild(copy, c._cloneInto(map))
    }
    return copy
  }
  _afterClone() {}

  GetAttribute(name) { return this._attributes.get(name) }
  GetAttributes() { return Object.fromEntries(this._attributes) }
  SetAttribute(name, value) {
    if (sameValue(this._attributes.get(name), value)) return
    if (value === undefined || value === null) this._attributes.delete(name)
    else this._attributes.set(name, value)
    this.AttributeChanged.Fire(name)
    const s = this._attrSignals.get(name)
    if (s) s.Fire()
  }
  GetAttributeChangedSignal(name) {
    let s = this._attrSignals.get(name)
    if (!s) this._attrSignals.set(name, (s = new Signal()))
    return s
  }

  toString() { return this._p.Name }
}
Instance.register(Instance)
Instance.notCreatable = true

export function isNotCreatable(cls) {
  return Object.prototype.hasOwnProperty.call(cls, 'notCreatable') && cls.notCreatable
}

// Helpers for property definitions.
export const P = {
  vec: (x, y, z) => ({ default: () => new Vector3(x, y, z), coerce: (v) => toVector3(v) }),
  color: (r, g, b) => ({ default: () => Color3.fromRGB(r, g, b), coerce: (v) => toColor3(v) }),
  cframe: () => ({ default: () => new CFrame(), coerce: (v) => { if (!(v instanceof CFrame)) throw new TypeError('Expected a CFrame'); return v } }),
  num: (d) => ({ default: d, coerce: Number }),
  bool: (d) => ({ default: d, coerce: Boolean }),
  str: (d) => ({ default: d, coerce: String }),
  enum: (d) => ({ default: d }),
  ref: () => ({ default: null, ref: true, coerce: (v) => { if (v && !(v instanceof Instance)) throw new TypeError('Expected an Instance'); return v || null } }),
}

function toVector3(v) {
  if (v instanceof Vector3) return v
  if (Array.isArray(v)) return Vector3.fromArray(v)
  if (v && typeof v === 'object' && 'x' in v) return new Vector3(v.x, v.y, v.z)
  throw new TypeError('Expected a Vector3')
}
function toColor3(v) {
  if (v instanceof Color3) return v
  if (typeof v === 'string') return Color3.fromHex(v)
  if (Array.isArray(v)) return new Color3(v[0], v[1], v[2])
  throw new TypeError('Expected a Color3')
}

export class Folder extends Instance {
  static className = 'Folder'
}
Instance.register(Folder)
