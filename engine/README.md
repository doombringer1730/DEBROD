# Brickframe

A small web game engine in the style of Roblox: a block world, parts and
models, a walking and jumping character with a third-person camera, physics,
and scripting with a Roblox-like API in JavaScript. It can also import Roblox
place and model files.

It is plain ES modules with [three.js](https://threejs.org) as its only
dependency, and it is not wired into the DEBROD app yet.

## Run the sandbox

```bash
cd engine
python3 -m http.server 8000
```

Open <http://localhost:8000>. Press **Play** to spawn. **Studio** opens an
explorer, a script editor with examples, and the output log. **Stop** puts
the place back the way it was before Play.

| Input | Action |
| --- | --- |
| WASD | Walk |
| Space | Jump |
| Right-drag, ← → | Orbit the camera |
| Wheel, I / O | Zoom; zoom all the way in for first person |
| Shift | Shift-lock (mouse turns the camera, character faces forward) |
| 1–9 | Pick a tool: hand, break, six block types, spawn a part |
| Click | Use the tool, or click a part that has a ClickDetector |
| Touch | Left half moves, right half turns, two fingers jump |

## Use it in a page

```html
<script type="importmap">
{ "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js" } }
</script>
<div id="game" style="width:100vw;height:100vh"></div>
<script type="module">
  import { Engine, Instance, Vector3, Color3 } from './engine/src/index.js'

  const engine = new Engine(document.getElementById('game'), {
    terrain: 'hills',          // 'hills' | 'flat' | 'none'
    seed: 1,
    world: { sizeX: 128, sizeY: 48, sizeZ: 128 }, // in blocks, 4 studs each
    playerName: 'Player1',
  })

  const part = Instance.new('Part')
  part.Size = new Vector3(4, 1, 4)
  part.Position = new Vector3(0, 60, 0)
  part.Color = Color3.fromRGB(255, 120, 0)
  part.Parent = engine.workspace

  engine.start() // runs scripts and spawns the player
</script>
```

| Engine method | What it does |
| --- | --- |
| `start()` / `stop()` | Play and stop. Scripts and physics only run while playing. |
| `save()` / `load(data)` | Place as JSON: terrain, Lighting and the instance trees. |
| `importRoblox(bytes)` | Imports a `.rbxl`, `.rbxm`, `.rbxlx` or `.rbxmx` file. |
| `clearPlace()` | Removes everything placed in the services. |
| `dispose()` | Tears the engine down and frees the canvas. |
| `onLog`, `onKey`, `onMouseButton` | Hooks for host pages. |

## Scripts

Scripts are `Script` (or `LocalScript`) instances with a JavaScript
`Source`. They run while they sit in Workspace, ServerScriptService or
StarterPlayerScripts, and while the engine is playing. Each script body runs
inside an async function, so it can `await`. Scripts in
StarterCharacterScripts are copied into each new character.

```js
const Players = game.GetService('Players')
const part = script.Parent

part.Touched.Connect((hit) => {
  const hum = hit.Parent.FindFirstChildOfClass('Humanoid')
  if (hum) hum.TakeDamage(10)
})

while (true) {
  part.Color = Color3.fromHSV(Math.random(), 0.8, 1)
  await task.wait(1)
}
```

Scripts are trusted code. They run in the page with full access to it, so
only run scripts you or people you trust wrote.

### Globals

`game`, `workspace`, `script`, `Instance`, `Vector3`, `Color3`, `CFrame`,
`Enum`, `RaycastParams`, `TweenInfo`, `task` (`wait`, `spawn`, `defer`,
`delay`, `cancel`), `wait`, `delay`, `spawn`, `print`, `warn`, `require`,
`tick`, `time`, `os` (`time`, `clock`, `date`), and `math` (JavaScript's
`Math` plus `clamp`, `random(a, b)`, `lerp`, `rad`, `deg`, `huge`, `pi`).

A `ModuleScript` body runs as a normal (not async) function and `return`s its
value; `require(module)` caches it.

### What's there

| Area | Supported |
| --- | --- |
| Instances | `Instance.new`, `Name`, `Parent`, `Clone`, `Destroy`, `FindFirstChild(name, recursive)`, `FindFirstChildOfClass`, `FindFirstChildWhichIsA`, `FindFirstAncestor…`, `WaitForChild`, `GetChildren`, `GetDescendants`, `IsA`, `IsDescendantOf`, `GetFullName`, attributes, `Changed`, `GetPropertyChangedSignal`, `ChildAdded`, `DescendantAdded`, `Destroying`… Children can be reached as properties: `workspace.Coins`. |
| Parts | `Part` (Block, Ball, Cylinder), `WedgePart`, `SpawnLocation`, `TrussPart`, `Seat`, `UnionOperation` and `MeshPart` (drawn as boxes). `Size`, `CFrame`, `Position`, `Orientation`, `Color`, `Material`, `Transparency`, `Anchored`, `CanCollide`, `CanTouch`, `CastShadow`, `AssemblyLinearVelocity`, `ApplyImpulse`, `GetTouchingParts`, `Touched`, `TouchEnded`. |
| Looks | `Decal`, `Texture`, `SpecialMesh` (Brick, Sphere, Cylinder, Head, Wedge), `BlockMesh`, `CylinderMesh`, `PointLight`, `SpotLight`, `SurfaceLight` (up to 12 lights). Materials: Plastic, SmoothPlastic, Neon, Glass, Metal, Wood, WoodPlanks and more. |
| Models | `Model` with `PrimaryPart`, `GetPivot`, `PivotTo`, `MoveTo`, `TranslateBy`, `GetBoundingBox`, `GetExtentsSize`; `Folder`. |
| Joints | `Weld`, `Motor6D` (with `Transform`), `WeldConstraint`. |
| Characters | `Humanoid`: `Health`, `MaxHealth`, `WalkSpeed`, `JumpPower`, `Jump`, `AutoRotate`, `PlatformStand`, `MoveDirection`, `FloorMaterial`, `Move`, `MoveTo`, `TakeDamage`, `Died`, `HealthChanged`, `Running`, `Jumping`, `StateChanged`, `MoveToFinished`. Any model with a Humanoid and a HumanoidRootPart walks. R6-style rigs get a walk animation. Characters ride moving platforms, push loose parts and fall apart when they die. |
| Values | `IntValue`, `NumberValue`, `StringValue`, `BoolValue`, `ObjectValue`, `Vector3Value`, `Color3Value`, `CFrameValue`. A `leaderstats` folder on a Player shows on the leaderboard. |
| Services | `Workspace` (`Gravity`, `Raycast`, `GetPartBoundsInBox`, `CurrentCamera`, `Terrain`), `Players` (`LocalPlayer`, `PlayerAdded`, `GetPlayerFromCharacter`, `RespawnTime`), `Player` (`Character`, `CharacterAdded`, `LoadCharacter`, `GetMouse`, `Kick`), `Lighting` (`ClockTime`, `TimeOfDay`, `Brightness`, `Ambient`, `OutdoorAmbient`, `FogStart`/`FogEnd`/`FogColor`, `GlobalShadows`), `RunService` (`Heartbeat`, `Stepped`, `RenderStepped`, `BindToRenderStep`), `UserInputService` (`InputBegan`/`Ended`/`Changed`, `IsKeyDown`, `GetMouseLocation`), `TweenService`, `Debris`, `CollectionService`, `HttpService` (JSON, GUIDs), `LogService`, `ReplicatedStorage`, `ServerStorage`, `ServerScriptService`, `StarterPlayer`. |
| Other | `ClickDetector` (`MouseClick`, hover events), `Hint` and `Message`, `Camera` (`CFrame`, `FieldOfView`, `CameraType` Custom/Scriptable, `CameraSubject`, `ScreenPointToRay`, `WorldToScreenPoint`), `Mouse` (`Hit`, `Target`, `Button1Down`…). |
| Terrain | `workspace.Terrain`: `GetCell`, `SetCell`, `FillBlock`, `FillBall`, `WorldToCell`, `CellCenterToWorld`, `SurfaceHeight`, `Clear`. Blocks are 4 studs: Grass, Dirt, Stone, Sand, Wood, Leaves, Planks, Brick, Cobblestone, Snow, Glass, Water, Path, Roof, Whitewash. |

### Limits

- Collision uses axis-aligned boxes. A rotated part collides as the box
  around it. Wedges and cylinders collide as boxes.
- Loose parts fall, slide and stack but do not tumble or spin.
- One player, in the browser. There is no server and no networking yet.
- No GUI objects (ScreenGui, Frame, TextLabel…), sounds, particles, or
  `Animation` assets. They import as plain containers.
- Each part is its own draw call. Places with many thousands of parts run,
  but slower on weak GPUs.

## Porting Lua scripts

Scripts translate almost line for line:

| Roblox Lua | Brickframe JavaScript |
| --- | --- |
| `game:GetService("Players")` | `game.GetService('Players')` |
| `local p = Instance.new("Part", workspace)` | `const p = Instance.new('Part', workspace)` |
| `part.Touched:Connect(function(hit) ... end)` | `part.Touched.Connect((hit) => { ... })` |
| `conn:Disconnect()` | `conn.Disconnect()` |
| `task.wait(1)` / `wait(1)` | `await task.wait(1)` |
| `local child = obj:WaitForChild("Handle")` | `const child = await obj.WaitForChild('Handle')` |
| `local hit = signal:Wait()` | `const hit = await signal.Wait()` |
| `a + b`, `a - b`, `v * 2` (Vector3) | `a.add(b)`, `a.sub(b)`, `v.mul(2)` |
| `cf1 * cf2`, `cf * v` | `cf1.mul(cf2)`, `cf.mul(v)` |
| `cf.Position`, `cf.LookVector` | same |
| `CFrame.new(pos, lookAt)` | `new CFrame(pos, lookAt)` or `CFrame.new(pos, lookAt)` |
| `Vector3.new(1, 2, 3)` | `new Vector3(1, 2, 3)` or `Vector3.new(1, 2, 3)` |
| `Enum.Material.Neon` | `Enum.Material.Neon` or `'Neon'` |
| `for _, v in ipairs(t) do` | `for (const v of t) {` |
| `for i = 1, 10 do` | `for (let i = 1; i <= 10; i++) {` |
| `local t = {}` / `t.x = 1` | `const t = {}` / `t.x = 1` |
| `#list` | `list.length` |
| `"a" .. "b"` | `'a' + 'b'` or `` `${a}${b}` `` |
| `~=`, `and`, `or`, `not` | `!==`, `&&`, `\|\|`, `!` |
| `nil` | `null` (`undefined` for missing properties) |
| `local M = {} ... return M` (ModuleScript) | same: `const M = {}` … `return M` |
| `math.random(1, 6)` | `math.random(1, 6)` |
| `tostring(x)`, `tonumber(s)` | `String(x)`, `Number(s)` |
| `pcall(f)` | `try { f() } catch (e) { }` |

Lua arrays start at 1 and JavaScript arrays at 0, so check index math.

## Importing Roblox files

`engine.importRoblox(bytes)` reads binary and XML place and model files:

- **Imports:** names and hierarchy, parts and wedges, sizes, CFrames, colors
  (Color3uint8 and BrickColor), materials, transparency, anchoring,
  collision, models and PrimaryPart, welds and Motor6Ds, humanoids, values,
  decals, meshes, lights, Lighting settings, and SpawnLocations.
- **Scripts:** sources come in as text, disabled, with a `SourceLanguage`
  attribute of `"Lua"`, so you can port them (see above) and then enable them.
- **Not imported:** anything loaded from `rbxassetid://` (meshes, images,
  sounds, animations) is hosted by Roblox, so mesh parts and unions are drawn
  as boxes of their size. Classes the engine doesn't know (GUIs, particles,
  body movers…) are kept as plain containers with their names and children,
  and the importer reports which ones.
- Binary files compressed with Zstandard aren't read yet. Re-save them as
  `.rbxlx` or `.rbxmx` from Roblox Studio and import that.

Only import places you made or have the rights to use.

## Files

| File | |
| --- | --- |
| `src/index.js` | Public exports |
| `src/engine.js` | Renderer, frame loop, part drawing, lighting, sky, overlay |
| `src/instance.js` | Instance tree and property system |
| `src/math.js` | Vector3, Color3, CFrame |
| `src/signal.js` | Events and connections |
| `src/enum.js` | Enums |
| `src/parts.js` | Parts, models, values, scripts, ClickDetector, Hint |
| `src/extras.js` | Decals, meshes, lights, unions and mesh parts |
| `src/character.js` | Joints, Humanoid, default character |
| `src/physics.js` | Collision, loose-part physics, touches, raycasts |
| `src/voxels.js` | Block world, meshing, terrain generators |
| `src/camera.js` | Camera and the default camera controller |
| `src/input.js` | Keyboard, mouse and touch; UserInputService and Mouse |
| `src/scripting.js` | Script runner, scheduler, `task`, RaycastParams, TweenInfo |
| `src/services.js` | DataModel and services, Terrain, tweens |
| `src/serialize.js` | Place save and load |
| `src/rbxl.js` | Roblox file importer |
| `index.html`, `demo/` | The sandbox |
