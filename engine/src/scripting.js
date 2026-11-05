// Runs Script and ModuleScript sources. Sources are JavaScript; each Script
// body runs inside an async function, so `await task.wait(1)` works.
// Scripts are trusted code: they run in the page with full access to it.
import { Runtime } from './signal.js'
import { Instance } from './instance.js'
import { Vector3, Color3, CFrame } from './math.js'
import { Enum } from './enum.js'
import { BaseScript, ModuleScript } from './parts.js'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

export class RaycastParams {
  constructor() {
    this.FilterDescendantsInstances = []
    this.FilterType = Enum.RaycastFilterType.Exclude
    this.IgnoreWater = true
    this.CollisionGroup = 'Default'
  }
  static new() { return new RaycastParams() }
}

export class TweenInfo {
  constructor(time = 1, easingStyle = 'Quad', easingDirection = 'Out', repeatCount = 0, reverses = false, delayTime = 0) {
    this.Time = time
    this.EasingStyle = easingStyle && easingStyle.Name ? easingStyle.Name : easingStyle
    this.EasingDirection = easingDirection && easingDirection.Name ? easingDirection.Name : easingDirection
    this.RepeatCount = repeatCount
    this.Reverses = reverses
    this.DelayTime = delayTime
  }
  static new(...a) { return new TweenInfo(...a) }
}

const RUN_IN = new Set(['Workspace', 'ServerScriptService', 'StarterPlayerScripts', 'Players'])

export class Scheduler {
  constructor() {
    this.time = 0
    this.waits = []
    this.deferred = []
  }
  wait(sec, ctx) {
    return new Promise((resolve) => {
      this.waits.push({ at: this.time + Math.max(0, sec || 0), start: this.time, resolve, ctx })
    })
  }
  tick(dt) {
    this.time += dt
    if (this.deferred.length) {
      const d = this.deferred
      this.deferred = []
      for (const f of d) f()
    }
    if (!this.waits.length) return
    const due = []
    this.waits = this.waits.filter((w) => {
      if (w.ctx && w.ctx.stopped) return false
      if (w.at <= this.time) { due.push(w); return false }
      return true
    })
    for (const w of due) w.resolve(this.time - w.start)
  }
}

export class ScriptService {
  constructor(engine) {
    this.engine = engine
    this.contexts = new Map()
    this.modules = new Map()
    Runtime.report = (err, ctx) => this.report(err, ctx)
  }

  shouldRun(s) {
    if (!(s instanceof BaseScript) || !s._p.Enabled || !s._dm || !this.engine.running) return false
    if (s.GetAttribute('SourceLanguage') === 'Lua') return false
    for (let a = s._parent; a; a = a._parent) if (RUN_IN.has(a.ClassName)) return true
    return false
  }
  sync(s) {
    s._runner = this.engine
    const running = this.contexts.has(s)
    const want = this.shouldRun(s)
    if (want && !running) this.start(s)
    else if (!want && running) this.stop(s)
  }
  syncAll() {
    for (const d of this.engine.game.GetDescendants()) if (d instanceof BaseScript) this.sync(d)
  }
  stopAll() {
    for (const s of [...this.contexts.keys()]) this.stop(s)
    this.modules.clear()
  }

  start(s) {
    const ctx = { script: s, stopped: false, connections: new Set(), name: s.GetFullName() }
    this.contexts.set(s, ctx)
    const env = this.env(ctx)
    let fn
    try {
      fn = new AsyncFunction(...Object.keys(env), `${s._p.Source}\n//# sourceURL=${encodeURI(ctx.name)}.js`)
    } catch (e) {
      this.report(e, ctx)
      return
    }
    const prev = Runtime.current
    Runtime.current = ctx
    try {
      const p = fn(...Object.values(env))
      p.then(null, (e) => this.report(e, ctx))
    } catch (e) {
      this.report(e, ctx)
    } finally {
      Runtime.current = prev
    }
  }
  stop(s) {
    const ctx = this.contexts.get(s)
    if (!ctx) return
    ctx.stopped = true
    for (const c of [...ctx.connections]) c.Disconnect()
    this.contexts.delete(s)
  }

  require(mod, fromCtx) {
    if (!(mod instanceof ModuleScript)) throw new TypeError('require expects a ModuleScript')
    if (this.modules.has(mod)) {
      const m = this.modules.get(mod)
      if (m.loading) throw new Error(`Recursive require of ${mod.GetFullName()}`)
      return m.value
    }
    const entry = { loading: true, value: undefined }
    this.modules.set(mod, entry)
    const ctx = { script: mod, stopped: false, connections: new Set(), name: mod.GetFullName(), parent: fromCtx }
    const env = this.env(ctx)
    const fn = new Function(...Object.keys(env), `${mod._p.Source}\n//# sourceURL=${encodeURI(ctx.name)}.js`)
    const prev = Runtime.current
    Runtime.current = ctx
    try {
      entry.value = fn(...Object.values(env))
    } catch (e) {
      this.modules.delete(mod)
      throw e
    } finally {
      Runtime.current = prev
      entry.loading = false
    }
    return entry.value
  }

  report(err, ctx) {
    const where = ctx ? ctx.name : 'Engine'
    const msg = err && err.message ? err.message : String(err)
    this.engine.log(`${where}: ${msg}`, 'error')
    if (err && err.stack) console.error(err)
  }

  // The globals a script sees.
  env(ctx) {
    const e = this.engine
    const sched = e.scheduler
    const wait = (sec) => sched.wait(sec, ctx)
    const fmt = (args) => args.map((a) => (typeof a === 'string' ? a : a instanceof Instance ? a.Name : a && a.toString !== Object.prototype.toString ? String(a) : safeJSON(a))).join(' ')
    const run = (fn, args) => {
      if (ctx.stopped) return
      const prev = Runtime.current
      Runtime.current = ctx
      try {
        const r = fn(...args)
        if (r && r.then) r.then(null, (err) => this.report(err, ctx))
      } catch (err) {
        this.report(err, ctx)
      } finally {
        Runtime.current = prev
      }
    }
    const task = {
      wait,
      spawn: (fn, ...args) => { run(fn, args) },
      defer: (fn, ...args) => { sched.deferred.push(() => run(fn, args)) },
      delay: (sec, fn, ...args) => {
        const h = { cancelled: false }
        wait(sec).then(() => { if (!h.cancelled) run(fn, args) })
        return h
      },
      cancel: (h) => { if (h) h.cancelled = true },
    }
    const math = Object.assign(Object.create(Math), {
      clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
      random: (a, b) => (a === undefined ? Math.random() : b === undefined ? 1 + Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a + 1))),
      lerp: (a, b, t) => a + (b - a) * t,
      rad: (d) => d * Math.PI / 180,
      deg: (r) => r * 180 / Math.PI,
      huge: Infinity,
      pi: Math.PI,
      noise: (x = 0, y = 0, z = 0) => Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5,
    })
    return {
      game: e.game,
      workspace: e.workspace,
      script: ctx.script,
      Instance,
      Vector3,
      Color3,
      CFrame,
      Enum,
      RaycastParams,
      TweenInfo,
      task,
      wait,
      delay: task.delay,
      spawn: task.spawn,
      print: (...a) => e.log(fmt(a), 'output'),
      warn: (...a) => e.log(fmt(a), 'warning'),
      require: (m) => this.require(m, ctx),
      tick: () => Date.now() / 1000,
      time: () => sched.time,
      os: { time: () => Math.floor(Date.now() / 1000), clock: () => performance.now() / 1000, date: (f, t) => new Date(t ? t * 1000 : Date.now()) },
      math,
    }
  }
}

function safeJSON(v) {
  try { return JSON.stringify(v) } catch { return String(v) }
}
