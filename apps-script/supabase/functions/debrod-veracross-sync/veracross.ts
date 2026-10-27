// Reading homework from Veracross, read-only, for the debrod-veracross-sync
// Edge Function. Nothing in here touches the database or Deno, so the tests
// (veracross.test.ts) run it under Node too.
//
// Two sources share one shape:
// - veracrossSource(): the real Data API, OAuth 2.0 client credentials,
//   only GET requests, only the five list scopes in SCOPES.
// - mockSource(): made-up classes and assignments, so the whole pipeline
//   can be shown before the school issues a client.
//
// What comes back is already cut down to what DEBROD keeps: class names,
// assignment titles and due dates, and a completion status. Score, grade
// and comment fields are never copied out of a response.

export const SCOPES = [
  'students:list',
  'classes:list',
  'academics.enrollments:list',
  'academics.classes.assignments:list',
  'academics.assignments.grades:list',
]

// Paths under https://api.veracross.com/{school_route}/v3/. These follow
// the scope names; check each one against api-docs.veracross.com in the
// school's sandbox before going live, and change it here if it differs.
export const PATHS = {
  enrollments: 'academics/enrollments',
  classes: 'classes',
  assignments: (classId: number) => `academics/classes/${classId}/assignments`,
  grades: (assignmentId: number) => `academics/assignments/${assignmentId}/grades`,
}

export type Status = 'pending' | 'turned_in' | 'late' | 'missing' | 'excused'
export interface Klass { id: number; name: string }
export interface Assignment { id: number; class_id: number; title: string; due: string | null }
export interface StudentStatus { veracross_id: number; assignment_id: number; status: Status }
export interface Snapshot { classes: Klass[]; assignments: Assignment[]; statuses: StudentStatus[] }

export interface Source {
  name: 'mock' | 'veracross'
  // Everything for these students only. Rows about anyone else are dropped.
  snapshot(studentIds: number[], window: { from: string; to: string }): Promise<Snapshot>
}

type Row = Record<string, unknown>
type Fetch = (url: string, init?: RequestInit) => Promise<Response>

// ── Picking fields ──────────────────────────────────────────────────────
// Veracross field names vary a little between endpoints, so each value is
// looked for under a short list of names. Only these are ever read.

const num = (r: Row, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = r[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
    if (v && typeof v === 'object' && 'id' in (v as Row)) {
      const inner = num(v as Row, 'id')
      if (inner != null) return inner
    }
  }
  return null
}
const str = (r: Row, ...keys: string[]): string => {
  for (const k of keys) {
    const v = r[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}
const day = (r: Row, ...keys: string[]): string | null => {
  const v = str(r, ...keys)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v)
  return m ? m[1] : null
}

// Completion status, in whatever words the school's Veracross uses, down to
// five values. Anything unrecognised counts as not turned in yet, so an
// unknown word never pays coins.
export function toStatus(raw: unknown): Status {
  const s = String(raw ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  if (!s) return 'pending'
  if (/\bexcus|exempt|\bn a\b|not applicable/.test(s)) return 'excused'
  if (/\bmissing|incomplete/.test(s)) return 'missing'
  if (/\bnot\b|\bno\b|pending|\bdue\b/.test(s)) return 'pending'
  if (/\blate\b/.test(s)) return 'late'
  if (/turned in|submitted|complete|done|on time|received|handed in/.test(s)) return 'turned_in'
  return 'pending'
}

export function pickClass(r: Row): Klass | null {
  const id = num(r, 'id', 'class_id', 'internal_class_id')
  const name = str(r, 'name', 'class_name', 'description', 'course_name')
  return id == null ? null : { id, name: (name || `Class ${id}`).slice(0, 120) }
}

export function pickAssignment(r: Row, classId: number): Assignment | null {
  const id = num(r, 'id', 'assignment_id')
  if (id == null) return null
  return {
    id,
    class_id: num(r, 'class_id', 'class', 'internal_class_id') ?? classId,
    title: (str(r, 'description', 'name', 'title', 'assignment_description') || 'Assignment').slice(0, 300),
    due: day(r, 'due_date', 'date_due', 'due', 'assignment_date'),
  }
}

// A grade row has scores in it too. Only who, which assignment and the
// completion status are taken; the rest of the row is never looked at.
export function pickStatus(r: Row, assignmentId: number): StudentStatus | null {
  const student = num(r, 'student_id', 'person_id', 'student')
  if (student == null) return null
  return {
    veracross_id: student,
    assignment_id: num(r, 'assignment_id', 'assignment') ?? assignmentId,
    status: toStatus(r.completion_status ?? r.submission_status ?? r.status),
  }
}

// ── The real API ────────────────────────────────────────────────────────

export interface VeracrossConfig {
  schoolRoute: string
  clientId: string
  clientSecret: string
  fetch?: Fetch
  pageSize?: number
  sleep?: (ms: number) => Promise<void>
  accountsBase?: string   // https://accounts.veracross.com
  apiBase?: string        // https://api.veracross.com
}

export class VeracrossClient {
  private token = ''
  private tokenExpires = 0
  private readonly f: Fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly cfg: VeracrossConfig
  readonly pageSize: number
  requests = 0

  constructor(cfg: VeracrossConfig) {
    this.cfg = cfg
    if (!/^[A-Za-z0-9_-]+$/.test(cfg.schoolRoute || '')) throw new Error('VERACROSS_SCHOOL_ROUTE is missing or has odd characters.')
    if (!cfg.clientId || !cfg.clientSecret) throw new Error('VERACROSS_CLIENT_ID and VERACROSS_CLIENT_SECRET are both needed.')
    this.f = cfg.fetch ?? ((u, i) => fetch(u, i))
    this.sleep = cfg.sleep ?? (ms => new Promise(r => setTimeout(r, ms)))
    this.pageSize = cfg.pageSize ?? 100
  }

  private get api() { return `${(this.cfg.apiBase ?? 'https://api.veracross.com').replace(/\/+$/, '')}/${this.cfg.schoolRoute}/v3/` }

  // A short-lived token, reused until a minute before it runs out.
  async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpires - 60_000) return this.token
    const url = `${(this.cfg.accountsBase ?? 'https://accounts.veracross.com').replace(/\/+$/, '')}/${this.cfg.schoolRoute}/oauth/token`
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: SCOPES.join(' '),
    })
    const res = await this.f(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body })
    const data = await res.json().catch(() => ({})) as Row
    if (!res.ok || typeof data.access_token !== 'string') {
      // Never echo the request: it holds the secret.
      throw new Error(`Veracross refused the token request (${res.status}${typeof data.error === 'string' ? `: ${data.error}` : ''}).`)
    }
    this.token = data.access_token
    this.tokenExpires = Date.now() + (typeof data.expires_in === 'number' ? data.expires_in : 3600) * 1000
    return this.token
  }

  // Every page of a list endpoint. Veracross pages with X-Page-Number and
  // X-Page-Size headers; a short page is the last one. 429s wait for
  // Retry-After and try again, up to five times.
  async list(path: string, query: Record<string, string> = {}): Promise<Row[]> {
    const out: Row[] = []
    const qs = new URLSearchParams(query).toString()
    for (let page = 1; page <= 500; page++) {
      let res: Response | null = null
      for (let attempt = 0; attempt < 6; attempt++) {
        this.requests++
        res = await this.f(`${this.api}${path}${qs ? `?${qs}` : ''}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${await this.accessToken()}`,
            Accept: 'application/json',
            'X-Page-Number': String(page),
            'X-Page-Size': String(this.pageSize),
          },
        })
        if (res.status === 401 && attempt === 0) { this.token = ''; continue }
        if (res.status !== 429 && res.status < 500) break
        if (attempt === 5) break
        const wait = Number(res.headers.get('Retry-After'))
        await this.sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 60) * 1000 : 2 ** attempt * 1000)
      }
      if (!res || !res.ok) throw new Error(`Veracross answered ${res ? res.status : 'nothing'} for ${path}.`)
      const body = await res.json().catch(() => null) as Row | Row[] | null
      const rows = Array.isArray(body) ? body : body && Array.isArray(body.data) ? body.data as Row[] : []
      out.push(...rows)
      if (rows.length < this.pageSize) break
    }
    return out
  }
}

export function veracrossSource(cfg: VeracrossConfig): Source & { client: VeracrossClient } {
  const client = new VeracrossClient(cfg)
  return {
    name: 'veracross',
    client,
    async snapshot(studentIds, window) {
      const pilot = new Set(studentIds)
      if (!pilot.size) return { classes: [], assignments: [], statuses: [] }

      // Which classes each pilot student is in.
      const classIds = new Set<number>()
      for (const r of await client.list(PATHS.enrollments)) {
        const student = num(r, 'student_id', 'person_id', 'student')
        const klass = num(r, 'class_id', 'internal_class_id', 'class')
        if (student != null && klass != null && pilot.has(student)) classIds.add(klass)
      }

      const classes: Klass[] = []
      for (const r of await client.list(PATHS.classes)) {
        const c = pickClass(r)
        if (c && classIds.has(c.id)) classes.push(c)
      }

      // Assignments due inside the window, then each one's statuses for
      // pilot students only.
      const assignments: Assignment[] = []
      const statuses: StudentStatus[] = []
      for (const c of classes) {
        for (const r of await client.list(PATHS.assignments(c.id))) {
          const a = pickAssignment(r, c.id)
          if (!a || !a.due || a.due < window.from || a.due > window.to) continue
          assignments.push(a)
          for (const g of await client.list(PATHS.grades(a.id))) {
            const s = pickStatus(g, a.id)
            if (s && pilot.has(s.veracross_id)) statuses.push(s)
          }
        }
      }
      return { classes, assignments, statuses }
    },
  }
}

// ── Made-up data ────────────────────────────────────────────────────────

const MOCK_CLASSES = [
  { id: 9101, name: 'Algebra II' },
  { id: 9102, name: 'Chemistry' },
  { id: 9103, name: 'English 10' },
  { id: 9104, name: 'US History' },
  { id: 9105, name: 'Spanish III' },
]
const MOCK_WORK = [
  'Problem set', 'Reading questions', 'Lab report', 'Vocabulary quiz prep', 'Essay outline',
  'Worksheet', 'Chapter notes', 'Practice test', 'Short response', 'Project check-in',
]

// The same student and day always give the same answer, so syncing twice
// changes nothing. Work due before today is mostly turned in, some late,
// a little missing; today's turns in after 3 p.m. UTC, so a demo sync later
// in the day shows coins arriving.
function hash(...parts: number[]) {
  let h = 2166136261
  for (const p of parts) { h ^= p; h = Math.imul(h, 16777619) >>> 0 }
  return h
}

export function mockSource(now: () => Date = () => new Date()): Source {
  return {
    name: 'mock',
    async snapshot(studentIds, window) {
      const today = now().toISOString().slice(0, 10)
      const afternoon = now().getUTCHours() >= 15
      const classes = new Map<number, Klass>()
      const assignments = new Map<number, Assignment>()
      const statuses: StudentStatus[] = []
      const start = Date.parse(`${window.from}T00:00:00Z`)
      const end = Date.parse(`${window.to}T00:00:00Z`)
      for (const sid of studentIds) {
        // Four of the five classes, by student.
        const mine = MOCK_CLASSES.filter((_, i) => i !== sid % MOCK_CLASSES.length)
        for (let t = start; t <= end; t += 86_400_000) {
          const d = new Date(t)
          const dow = d.getUTCDay()
          if (dow === 0 || dow === 6) continue
          const due = d.toISOString().slice(0, 10)
          const dayNo = Math.floor(t / 86_400_000)
          for (const c of mine) {
            // Each class sets work on about two school days a week.
            if (hash(c.id, dayNo) % 5 >= 2) continue
            const id = c.id * 100000 + (dayNo % 100000)
            classes.set(c.id, c)
            assignments.set(id, { id, class_id: c.id, title: `${MOCK_WORK[hash(id) % MOCK_WORK.length]} ${1 + (dayNo % 9)}.${1 + (hash(id, 7) % 4)}`, due })
            const roll = hash(sid, id) % 100
            let status: Status = 'pending'
            if (due < today) status = roll < 72 ? 'turned_in' : roll < 88 ? 'late' : roll < 97 ? 'missing' : 'excused'
            else if (due === today && afternoon && roll < 60) status = 'turned_in'
            statuses.push({ veracross_id: sid, assignment_id: id, status })
          }
        }
      }
      return { classes: [...classes.values()], assignments: [...assignments.values()], statuses }
    },
  }
}

// The days a sync covers: two weeks back (to catch late turn-ins) and three
// weeks ahead.
export function syncWindow(now = new Date()) {
  const d = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString().slice(0, 10)
  return { from: d(-14), to: d(21) }
}
