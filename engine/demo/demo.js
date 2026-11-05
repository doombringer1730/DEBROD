// Sandbox for the engine: a small place, build tools, a script runner,
// an explorer and Roblox file import.
import { Engine, Instance, Vector3, Color3, CFrame, BLOCK, BLOCKS } from '../src/index.js'

const engine = new Engine(document.getElementById('game'), { terrain: 'hills', seed: 7, world: { sizeX: 128, sizeY: 40, sizeZ: 128 } })
window.engine = engine
const { game, workspace } = engine
const $ = (id) => document.getElementById(id)

// ---------- the sample place ----------
function buildSample() {
  const L = game.GetService('Lighting')
  L.FogStart = 200
  L.FogEnd = 700
  const ground = engine.voxels.surfaceY(0, 0)
  const spawn = Instance.new('SpawnLocation')
  spawn.Position = new Vector3(0, ground + 0.5, 0)
  spawn.Color = Color3.fromRGB(90, 90, 100)
  spawn.Material = 'SmoothPlastic'
  spawn.Parent = workspace

  const part = (props, parent = workspace) => {
    const p = Instance.new(props.ClassName || 'Part')
    delete props.ClassName
    Object.assign(p, { Anchored: true, ...props })
    p.Parent = parent
    return p
  }
  const y = ground

  // A stack of crates to knock over.
  const crates = Instance.new('Model')
  crates.Name = 'Crates'
  for (let i = 0; i < 6; i++) {
    part({ Name: 'Crate', Size: new Vector3(3, 3, 3), Position: new Vector3(18 + (i % 2) * 3.2, y + 1.5 + Math.floor(i / 2) * 3, -10), Color: Color3.fromRGB(176, 128, 72), Material: 'WoodPlanks', Anchored: false }, crates)
  }
  crates.Parent = workspace

  // A lava strip that hurts.
  const lava = part({ Name: 'Lava', Size: new Vector3(16, 1, 6), Position: new Vector3(-20, y + 0.5, -14), Color: Color3.fromRGB(255, 92, 30), Material: 'Neon' })
  addScript(lava, 'Hurt', EXAMPLES['Damage on touch'])

  // A spinning neon ring of blocks.
  const spinner = part({ Name: 'Spinner', Size: new Vector3(10, 1, 2), Position: new Vector3(0, y + 6, -26), Color: Color3.fromRGB(80, 200, 255), Material: 'Neon' })
  addScript(spinner, 'Spin', EXAMPLES['Spin a part'])

  // A moving platform.
  const plat = part({ Name: 'Platform', Size: new Vector3(8, 1, 8), Position: new Vector3(24, y + 4, 14), Color: Color3.fromRGB(240, 240, 240), Material: 'SmoothPlastic' })
  addScript(plat, 'Move', EXAMPLES['Moving platform'])

  // A button that toggles day and night.
  const button = part({ Name: 'NightButton', Size: new Vector3(2, 2, 2), Position: new Vector3(-8, y + 1, 10), Color: Color3.fromRGB(255, 210, 60), Material: 'Neon' })
  Instance.new('ClickDetector', button)
  addScript(button, 'Toggle', EXAMPLES['Click to toggle night'])

  // Coins and a leaderboard.
  const coins = Instance.new('Folder')
  coins.Name = 'Coins'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const c = part({ Name: 'Coin', Shape: 'Cylinder', Size: new Vector3(0.4, 2, 2), Position: new Vector3(Math.cos(a) * 30, engine.voxels.surfaceY(Math.cos(a) * 30, Math.sin(a) * 30) + 2.5, Math.sin(a) * 30), Color: Color3.fromRGB(255, 205, 50), Material: 'Metal', CanCollide: false })
    c.Parent = coins
  }
  coins.Parent = workspace
  const leader = Instance.new('Script')
  leader.Name = 'Coins'
  leader.Source = EXAMPLES['Coins and leaderstats']
  leader.Parent = game.GetService('ServerScriptService')
}

function addScript(parent, name, source) {
  const s = Instance.new('Script')
  s.Name = name
  s.Source = source
  s.Parent = parent
  return s
}

const EXAMPLES = {
  'Damage on touch': `// Hurts any character that touches this part.
const part = script.Parent
const cooldown = new Set()
part.Touched.Connect((hit) => {
  const hum = hit.Parent && hit.Parent.FindFirstChildOfClass('Humanoid')
  if (!hum || cooldown.has(hum)) return
  cooldown.add(hum)
  hum.TakeDamage(25)
  task.delay(0.5, () => cooldown.delete(hum))
})`,
  'Spin a part': `// Rotates the parent part every frame.
const RunService = game.GetService('RunService')
const part = script.Parent
RunService.Heartbeat.Connect((dt) => {
  part.CFrame = part.CFrame.mul(CFrame.Angles(0, dt * 2, 0))
})`,
  'Moving platform': `// Slides the platform back and forth forever. Stand on it to ride.
const TweenService = game.GetService('TweenService')
const part = script.Parent
const goal = { Position: part.Position.add(new Vector3(0, 0, 30)) }
TweenService.Create(part, new TweenInfo(3, 'Sine', 'InOut', -1, true), goal).Play()`,
  'Click to toggle night': `// Click the part to switch between day and night.
const Lighting = game.GetService('Lighting')
const TweenService = game.GetService('TweenService')
script.Parent.FindFirstChildOfClass('ClickDetector').MouseClick.Connect((player) => {
  const night = Lighting.ClockTime > 6 && Lighting.ClockTime < 18
  TweenService.Create(Lighting, new TweenInfo(2), { ClockTime: night ? 23 : 13 }).Play()
  print(player.Name, 'turned it', night ? 'night' : 'day')
})`,
  'Coins and leaderstats': `// Gives each player a Coins stat and collects coins on touch.
const Players = game.GetService('Players')
Players.PlayerAdded.Connect((player) => {
  const stats = Instance.new('Folder')
  stats.Name = 'leaderstats'
  const coins = Instance.new('IntValue')
  coins.Name = 'Coins'
  coins.Parent = stats
  stats.Parent = player
})
for (const coin of workspace.Coins.GetChildren()) {
  coin.Touched.Connect((hit) => {
    const player = Players.GetPlayerFromCharacter(hit.Parent)
    if (!player || coin.Transparency > 0) return
    player.leaderstats.Coins.Value += 1
    coin.Transparency = 1
    task.delay(5, () => { coin.Transparency = 0 })
  })
}
game.GetService('RunService').Heartbeat.Connect((dt) => {
  for (const coin of workspace.Coins.GetChildren()) coin.CFrame = coin.CFrame.mul(CFrame.Angles(0, dt * 3, 0))
})`,
  'Rain of parts': `// Drops a colored ball every half second for ten seconds.
for (let i = 0; i < 20; i++) {
  const ball = Instance.new('Part')
  ball.Shape = 'Ball'
  ball.Size = new Vector3(2, 2, 2)
  ball.Color = Color3.fromHSV(Math.random(), 0.7, 1)
  ball.Position = new Vector3(math.random(-20, 20), 80, math.random(-20, 20))
  ball.Parent = workspace
  game.GetService('Debris').AddItem(ball, 15)
  await task.wait(0.5)
}`,
  'Build a tower with terrain': `// Fills terrain cells next to the spawn.
const t = workspace.Terrain
const base = t.WorldToCell(new Vector3(12, 0, 12))
const ground = t.WorldToCell(new Vector3(12, t.SurfaceHeight(12, 12), 12)).Y
for (let y = 0; y < 8; y++) {
  t.SetCell(base.X, ground + y, base.Z, y % 2 ? 'Brick' : 'Whitewash')
  await task.wait(0.1)
}`,
  'Speed boost key': `// Hold E to run faster.
const UIS = game.GetService('UserInputService')
const Players = game.GetService('Players')
UIS.InputBegan.Connect((input, processed) => {
  if (processed || input.KeyCode !== Enum.KeyCode.E) return
  const hum = Players.LocalPlayer.Character?.FindFirstChildOfClass('Humanoid')
  if (hum) hum.WalkSpeed = 32
})
UIS.InputEnded.Connect((input) => {
  if (input.KeyCode !== Enum.KeyCode.E) return
  const hum = Players.LocalPlayer.Character?.FindFirstChildOfClass('Humanoid')
  if (hum) hum.WalkSpeed = 16
})`,
}

// ---------- tools ----------
const TOOLS = [
  { name: 'Hand', icon: '✋' },
  { name: 'Break', icon: '⛏' },
  ...['Grass', 'Dirt', 'Stone', 'Planks', 'Brick', 'Glass'].map((b) => ({ name: b, block: b })),
  { name: 'Part', icon: '▣', part: true },
]
let tool = 0
function drawHotbar() {
  $('hotbar').innerHTML = TOOLS.map((t, i) => {
    const color = t.block ? '#' + BLOCKS.find((b) => b.name === t.block).top.toString(16).padStart(6, '0') : '#39404c'
    return `<div data-i="${i}" class="${i === tool ? 'on' : ''}"><i style="background:${color}">${t.icon || ''}</i><b>${i + 1}</b>${t.name}</div>`
  }).join('')
}
$('hotbar').addEventListener('click', (e) => {
  const d = e.target.closest('[data-i]')
  if (d) { tool = +d.dataset.i; drawHotbar() }
})
drawHotbar()
engine.onKey = (k, down) => {
  if (!down) return
  const n = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'].indexOf(k.Name)
  if (n >= 0 && n < TOOLS.length) { tool = n; drawHotbar() }
}
engine.onMouseButton = (button, down) => {
  if (!down || button !== 0 || !engine.running) return
  const t = TOOLS[tool]
  const m = engine.input.mouse
  if (t.name === 'Hand' || !m.Target) return
  const hum = engine.localHumanoid
  if (hum && hum.RootPart && hum.RootPart.Position.sub(m.Hit.Position).Magnitude > 40) return
  const vox = engine.voxels
  if (t.name === 'Break') {
    if (m.Target === workspace.Terrain && m._cell) vox.set(m._cell[0], m._cell[1], m._cell[2], 0)
    else if (m.Target.IsA('BasePart') && !m.Target.Locked && !m.Target.IsDescendantOf(hum?.Parent ?? game)) m.Target.Destroy()
    return
  }
  const n = m._normal || [0, 1, 0]
  const p = m.Hit.Position
  if (t.block) {
    const c = vox.worldToCell(p.X + n[0] * 0.5, p.Y + n[1] * 0.5, p.Z + n[2] * 0.5)
    const cmin = vox.cellToWorld(c[0], c[1], c[2]).map((v) => v - BLOCK / 2)
    const cmax = cmin.map((v) => v + BLOCK)
    for (const b of engine.physics.bodies) {
      if (cmin[0] < b.max[0] && cmax[0] > b.min[0] && cmin[1] < b.max[1] && cmax[1] > b.min[1] && cmin[2] < b.max[2] && cmax[2] > b.min[2]) return
    }
    vox.set(c[0], c[1], c[2], t.block)
  } else if (t.part) {
    const b = Instance.new('Part')
    b.Size = new Vector3(2, 2, 2)
    b.Color = Color3.fromHSV(Math.random(), 0.55, 0.95)
    b.Position = new Vector3(p.X + n[0] * 1.2, p.Y + n[1] * 1.2 + 1, p.Z + n[2] * 1.2)
    b.Parent = workspace
  }
}

// ---------- play / stop ----------
let snapshot = null
$('play').onclick = () => {
  snapshot = engine.save()
  engine.start()
  $('play').disabled = true
  $('stop').disabled = false
  engine.canvas.focus()
}
$('stop').onclick = () => {
  engine.stop()
  if (snapshot) engine.load(snapshot)
  $('play').disabled = false
  $('stop').disabled = true
}

// ---------- save / load / import ----------
$('save').onclick = () => {
  try {
    localStorage.setItem('brickframe-place', JSON.stringify(snapshot && engine.running ? snapshot : engine.save()))
    engine.log('Saved the place in this browser.', 'info')
  } catch (e) { engine.log('Could not save: ' + e.message, 'error') }
}
$('load').onclick = () => {
  let data = null
  try { data = localStorage.getItem('brickframe-place') } catch { /* blocked */ }
  if (!data) return engine.log('No saved place in this browser yet.', 'warning')
  engine.load(data)
  engine.log('Loaded the saved place.', 'info')
}
$('export').onclick = () => {
  const blob = new Blob([JSON.stringify(engine.save())], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'place.brickframe.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
$('import').onchange = async (e) => {
  const f = e.target.files[0]
  e.target.value = ''
  if (!f) return
  try {
    const buf = await f.arrayBuffer()
    if (f.name.endsWith('.json')) { engine.load(new TextDecoder().decode(buf)); return }
    const r = engine.importRoblox(buf)
    const parts = Object.entries(r.counts).filter(([k]) => /Part|Union/.test(k)).reduce((a, [, n]) => a + n, 0)
    engine.log(`Imported ${f.name}: ${parts} parts, ${r.scripts} scripts (kept as disabled Lua source).`, 'info')
    const unknown = Object.keys(r.unknownClasses)
    if (unknown.length) engine.log(`Kept as plain containers (not simulated): ${unknown.join(', ')}`, 'warning')
    showPanel('output')
  } catch (err) {
    engine.log(`Import failed: ${err.message}`, 'error')
    showPanel('output')
  }
}

// ---------- studio panel ----------
function showPanel(tab) {
  $('panel').hidden = false
  for (const b of document.querySelectorAll('.panel nav button')) b.classList.toggle('on', b.dataset.tab === tab)
  for (const s of document.querySelectorAll('.panel section')) s.hidden = s.dataset.tab !== tab
  if (tab === 'explorer') drawTree()
}
$('panelToggle').onclick = () => { if ($('panel').hidden) showPanel('explorer'); else $('panel').hidden = true }
for (const b of document.querySelectorAll('.panel nav button')) b.onclick = () => showPanel(b.dataset.tab)

const open = new Set(['Workspace'])
function drawTree() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  const node = (inst, path) => {
    const kids = inst.GetChildren()
    const label = `${esc(inst.Name)} <span class="cls">${inst.ClassName}</span>`
    if (!kids.length) return `<div class="leaf">${label}</div>`
    const shown = kids.slice(0, 200).map((c, i) => node(c, path + '/' + i)).join('')
    const more = kids.length > 200 ? `<div class="leaf cls">… ${kids.length - 200} more</div>` : ''
    return `<details data-path="${path}" ${open.has(path) ? 'open' : ''}><summary>${label}</summary>${open.has(path) ? shown + more : ''}</details>`
  }
  const roots = ['Workspace', 'Players', 'Lighting', 'ReplicatedStorage', 'ServerStorage', 'ServerScriptService', 'StarterPlayer']
  $('tree').innerHTML = roots.map((n) => node(game.GetService(n), n)).join('')
}
$('tree').addEventListener('toggle', (e) => {
  const p = e.target.dataset.path
  if (!p) return
  if (e.target.open) open.add(p); else open.delete(p)
  if (e.target.open && !e.target.querySelector('details,.leaf')) drawTree()
}, true)

$('examples').innerHTML = Object.keys(EXAMPLES).map((k) => `<option>${k}</option>`).join('')
$('examples').onchange = () => { $('source').value = EXAMPLES[$('examples').value] }
$('source').value = EXAMPLES['Rain of parts']
$('examples').value = 'Rain of parts'
$('run').onclick = () => {
  if (!engine.running) $('play').onclick()
  const s = Instance.new('Script')
  s.Name = 'MyScript'
  s.SetAttribute('FromSandbox', true)
  s.Source = $('source').value
  s.Parent = workspace
  engine.log(`Running ${s.GetFullName()}`, 'info')
}
$('stopScripts').onclick = () => {
  for (const d of game.GetDescendants()) if (d.IsA('BaseScript') && d.GetAttribute('FromSandbox')) d.Destroy()
}

const out = $('output')
engine.onLog = ({ message, type }) => {
  const line = document.createElement('div')
  line.className = type
  line.textContent = `${new Date().toLocaleTimeString()}  ${message}`
  out.appendChild(line)
  while (out.childNodes.length > 400) out.firstChild.remove()
  out.scrollTop = out.scrollHeight
}

buildSample()
engine.log('Press Play to spawn. Open Studio for the explorer, scripts and output.', 'info')
