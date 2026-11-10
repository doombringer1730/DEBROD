// Content check for the Anatomía game: every answer and synonym must be
// accepted typed with and without accents, every item must cite a page, and
// every item must have an English version, and every 3D item must name a mesh that exists in its model in public/anatomia/.
// Run: node --experimental-strip-types scripts/check-anatomia.mts
import { readFileSync, readdirSync } from 'node:fs'
import { accepts, fold, type Item } from '../app/anatomia/engine.ts'
import { DIAGRAMS, partsOf } from '../app/anatomia/diagrams/index.ts'

const dir = new URL('../app/anatomia/data/units/', import.meta.url)
const nodeCache = new Map<string, string[]>()
function nodesOf(model: string): string[] {
  if (!nodeCache.has(model)) {
    const glb = readFileSync(new URL(`../public/anatomia/${model}.glb`, import.meta.url))
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'))
    nodeCache.set(model, json.nodes.map((n: { name: string }) => n.name))
  }
  return nodeCache.get(model)!
}

const HINTS = new Set(['region', 'between', 'attaches', 'innervates', 'supplies', 'passes', 'along', 'source', 'example'])
const plain = (s: string) => fold(s).replace(/ñ/g, 'n')
let failures = 0
const fail = (msg: string) => { failures++; console.log('FAIL', msg) }
const ids = new Set<string>()
let total = 0

for (const file of readdirSync(dir).sort()) {
  const items: Item[] = JSON.parse(readFileSync(new URL(file, dir), 'utf8'))
  for (const it of items) {
    total++
    if (ids.has(it.id)) fail(`${it.id}: duplicate id`)
    ids.add(it.id)
    if (!Number.isInteger(it.page) || it.page < 1 || it.page > 134) fail(`${it.id}: bad page ${it.page}`)
    if (it.type === 'clue' && !it.prompt) fail(`${it.id}: clue without prompt`)
    if (it.type === 'identify' && !it.mesh) fail(`${it.id}: 3D item without mesh`)
    if (it.mesh) {
      const model = it.model ?? 'skull'
      for (const part of it.mesh.split('+'))
        if (!nodesOf(model).some((n) => n === part || n.startsWith(`${part}__`)))
          fail(`${it.id}: mesh "${part}" not in ${model}.glb`)
      if (it.hint && !HINTS.has(it.hint)) fail(`${it.id}: unknown hint "${it.hint}"`)
    }
    if (it.diagram) {
      const d = DIAGRAMS[it.diagram]
      if (!d) fail(`${it.id}: no diagram "${it.diagram}"`)
      else for (const part of (it.part ?? '').split('+'))
        if (!partsOf(d).has(part)) fail(`${it.id}: part "${part}" not in diagram ${it.diagram}`)
      if (it.mesh) fail(`${it.id}: both a mesh and a diagram`)
      if (it.hint && !HINTS.has(it.hint)) fail(`${it.id}: unknown hint "${it.hint}"`)
    }
    for (const a of [it.answer, ...it.accept]) {
      for (const typed of [a, plain(a), a.toUpperCase(), a.replace(/ /g, '')])
        if (!accepts(it, typed)) fail(`${it.id}: "${typed}" not accepted`)
    }
    if (!it.en?.answer) fail(`${it.id}: no English answer`)
    else {
      if (it.type === 'clue' && !it.en.prompt) fail(`${it.id}: no English prompt`)
      for (const a of [it.en.answer, ...it.en.accept]) {
        for (const typed of [a, plain(a), a.toUpperCase()])
          if (!accepts(it, typed, 'en')) fail(`${it.id}: English "${typed}" not accepted`)
      }
    }
  }
  console.log(`${file.padEnd(28)} ${String(items.length).padStart(3)} items`)
}

// Spot checks of the matching rules.
const probe = (unit: string, id: string, typed: string, want: boolean) => {
  const it: Item = JSON.parse(readFileSync(new URL(unit, dir), 'utf8')).find((i: Item) => i.id === id)
  if (accepts(it, typed) !== want) fail(`${id}: "${typed}" should ${want ? '' : 'not '}be accepted`)
}
probe('02-craneo.json', 'craneo-004', 'hueso occipital', true)
probe('02-craneo.json', 'craneo-009', 'cigomatico', true)
probe('02-craneo.json', 'craneo-009', 'malar', true)
probe('02-craneo.json', 'craneo-008', 'unguis', true)
probe('07-cara.json', 'cara-007', 'businador', false) // typo in the notes is not accepted
probe('04-pares.json', 'pares-048', 'XII', true)
probe('13-miembro-superior.json', 'miembro-superior-012', 'ulna', true)
probe('14-miembro-inferior.json', 'miembro-inferior-014', 'fibula', true)
const probeEn = (unit: string, id: string, typed: string, want: boolean) => {
  const it: Item = JSON.parse(readFileSync(new URL(unit, dir), 'utf8')).find((i: Item) => i.id === id)
  if (accepts(it, typed, 'en') !== want) fail(`${id}: English "${typed}" should ${want ? '' : 'not '}be accepted`)
}
probeEn('02-craneo.json', 'craneo-004', 'occipital bone', true)
probeEn('02-craneo.json', 'craneo-004', 'occipital', true)
probeEn('02-craneo.json', 'craneo-004', 'hueso occipital', false)
probeEn('07-cara.json', 'cara-044', 'masseter muscle', true)

console.log(`\n${total} items, ${failures} failures`)
process.exit(failures ? 1 : 0)
