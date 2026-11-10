// Typing engine: answer matching, the dotted word and keyboard hints.

export type Lang = 'es' | 'en'

export type Hint = 'region' | 'between' | 'attaches' | 'innervates' | 'supplies' | 'passes' | 'along' | 'source' | 'example'

export type Text = { prompt: string; answer: string; accept: string[] }

export type Item = {
  id: string
  unit: string
  type: 'identify' | 'clue'
  prompt: string
  answer: string
  accept: string[]
  page: number
  model?: string // 3D model file in public/anatomia, default "skull"
  mesh?: string // a node in the model; "a+b" lights several
  /** What the red means when it is not the answer itself (see HINTS in round.tsx). */
  hint?: Hint
  en: Text // the same item in English
}

/** The item's prompt and answers in the chosen language. */
export function textOf(item: Item, lang: Lang): Text {
  return lang === 'en' ? item.en : item
}

export type Candidate = { display: string; norm: string }

// A leading kind word is optional: "hueso occipital" and "occipital" both count.
const KINDS: Record<string, RegExp> = {
  hueso: /\bhuesos?\b/,
  musculo: /\bmusculos?\b|\bmasticacion\b|hioideo\b/,
  arteria: /\barterias?\b/,
  nervio: /\bnervios?\b|\bpar(es)? craneal(es)?\b/,
  vena: /\bvenas?\b/,
  glandula: /\bglandulas?\b/,
  cartilago: /\bcartilagos?\b/,
  ligamento: /\bligamentos?\b/,
}
const KIND_WORDS = /^(huesos?|musculos?|arterias?|nervios?|venas?|glandulas?|cartilagos?|ligamentos?|el|la|los|las)\s+(?=\S)/

/** Lowercase and drop accents. ñ survives, so "n" can stand in for it but not the reverse. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
}

/** Only the characters you actually type: letters, digits and ñ. */
export function keyOf(s: string): string {
  return fold(s).replace(/[^a-z0-9ñ]/g, '')
}

// English kind words come after the name: "frontal bone", "masseter muscle".
const EN_KINDS: Record<string, RegExp> = {
  bone: /\bbones?\b/,
  muscle: /\bmuscles?\b|\bchewing\b/,
  artery: /\barter(y|ies)\b/,
  nerve: /\bnerves?\b|\bcranial\b/,
  vein: /\bveins?\b/,
  gland: /\bglands?\b/,
  cartilage: /\bcartilages?\b/,
  ligament: /\bligaments?\b/,
}

export function candidates(item: Item, lang: Lang = 'es'): Candidate[] {
  if (lang === 'en') return englishCandidates(item)
  const out: Candidate[] = []
  const seen = new Set<string>()
  const add = (display: string) => {
    const norm = keyOf(display)
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      out.push({ display, norm })
    }
  }
  const bases = [item.answer, ...item.accept]
  for (const b of bases) add(b)
  // The same answers without their leading kind word…
  const cores = bases.map((b) => {
    const m = fold(b).match(KIND_WORDS)
    return m ? b.slice(m[0].length) : b
  })
  for (const c of cores) add(c)
  // …and with the kind word the prompt is asking about.
  const context = fold(item.prompt) || (item.type === 'identify' ? 'hueso' : '')
  for (const [word, re] of Object.entries(KINDS)) {
    if (!re.test(context)) continue
    for (const c of cores) if (!/^[ivx]+\d?$/i.test(c)) add(`${word} ${c}`)
  }
  return out
}

function englishCandidates(item: Item): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  const add = (display: string) => {
    const norm = keyOf(display)
    if (norm && !seen.has(norm)) {
      seen.add(norm)
      out.push({ display, norm })
    }
  }
  const { prompt, answer, accept } = item.en
  const bases = [answer, ...accept]
  for (const b of bases) add(b)
  const context = fold(prompt) || (item.type === 'identify' ? 'bone' : '')
  for (const [word, re] of Object.entries(EN_KINDS)) {
    if (!re.test(context)) continue
    for (const b of bases) if (!/^[ivx]+\d?$/i.test(b) && !fold(b).endsWith(word)) add(`${b} ${word}`)
  }
  return out
}

const charMatches = (typed: string, expected: string) => typed === expected || (typed === 'n' && expected === 'ñ')

function startsWith(norm: string, typed: string): boolean {
  if (typed.length > norm.length) return false
  for (let i = 0; i < typed.length; i++) if (!charMatches(typed[i], norm[i])) return false
  return true
}

/** Candidates the typed prefix could still become, canonical answer first. */
export function alive(cands: Candidate[], typed: string): Candidate[] {
  return cands.filter((c) => startsWith(c.norm, typed))
}

export function isComplete(cands: Candidate[], typed: string): boolean {
  return cands.some((c) => c.norm.length === typed.length && startsWith(c.norm, typed))
}

export type Glyph = { ch: string; state: 'typed' | 'todo' | 'gap' }

/** The word as shown: typed letters, then one dot per letter still to go. */
export function glyphs(c: Candidate, typedLength: number): Glyph[] {
  let n = 0
  return [...c.display].map((ch) => {
    if (!keyOf(ch)) return { ch, state: 'gap' }
    return n++ < typedLength ? { ch, state: 'typed' } : { ch: '·', state: 'todo' }
  })
}

/** Would a full answer typed as given be accepted? Used by the content check. */
export function accepts(item: Item, input: string, lang: Lang = 'es'): boolean {
  return isComplete(candidates(item, lang), keyOf(input))
}
