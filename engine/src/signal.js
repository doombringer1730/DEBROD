// Events. A Signal is what Roblox calls an RBXScriptSignal:
//   part.Touched.Connect((hit) => { ... })
// Connections remember which script made them, so stopping a script
// disconnects everything it connected.

// Shared state for the script runtime. `current` is the script context whose
// code is running right now, or null when engine code is running.
export const Runtime = {
  current: null,
  report(err, ctx) {
    console.error(err)
    void ctx
  },
}

export class Connection {
  constructor(signal, fn, owner) {
    this._signal = signal
    this._fn = fn
    this.owner = owner
    this.Connected = true
  }
  Disconnect() {
    if (!this.Connected) return
    this.Connected = false
    const list = this._signal._conns
    const i = list.indexOf(this)
    if (i >= 0) list.splice(i, 1)
    if (this.owner) this.owner.connections.delete(this)
  }
  disconnect() { this.Disconnect() }
}

export class Signal {
  constructor() {
    this._conns = []
  }
  Connect(fn) {
    if (typeof fn !== 'function') throw new TypeError('Connect expects a function')
    const owner = Runtime.current
    const c = new Connection(this, fn, owner)
    this._conns.push(c)
    if (owner) owner.connections.add(c)
    return c
  }
  Once(fn) {
    const c = this.Connect((...args) => {
      c.Disconnect()
      return fn(...args)
    })
    return c
  }
  // Resolves with the first argument of the next Fire. Use `await signal.Wait()`.
  Wait() {
    return new Promise((resolve) => this.Once((...args) => resolve(args.length > 1 ? args : args[0])))
  }
  Fire(...args) {
    if (!this._conns.length) return
    for (const c of this._conns.slice()) {
      if (!c.Connected) continue
      if (c.owner && c.owner.stopped) {
        c.Disconnect()
        continue
      }
      const prev = Runtime.current
      Runtime.current = c.owner
      try {
        const r = c._fn(...args)
        if (r && typeof r.then === 'function') r.then(null, (e) => Runtime.report(e, c.owner))
      } catch (e) {
        Runtime.report(e, c.owner)
      } finally {
        Runtime.current = prev
      }
    }
  }
  DisconnectAll() {
    for (const c of this._conns.slice()) c.Disconnect()
  }
  get connectionCount() { return this._conns.length }
  // lower-case aliases
  connect(fn) { return this.Connect(fn) }
  once(fn) { return this.Once(fn) }
  wait() { return this.Wait() }
}
