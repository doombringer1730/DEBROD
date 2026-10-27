// Tests for veracross.ts, with a fake Veracross. Run either way:
//   deno test supabase/functions/debrod-veracross-sync/
//   node --experimental-strip-types --test supabase/functions/debrod-veracross-sync/veracross.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockSource, pickStatus, SCOPES, syncWindow, toStatus, VeracrossClient, veracrossSource } from './veracross.ts'

type Call = { url: string; init?: RequestInit }

// A fake Veracross: a token endpoint, and list endpoints served from `pages`
// (path → rows), split into pages the way the real one does.
function fakeVeracross(pages: Record<string, unknown[]>, opts: { fail429?: number; tokenStatus?: number } = {}) {
  const calls: Call[] = []
  let throttled = opts.fail429 ?? 0
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/oauth/token')) {
      if (opts.tokenStatus) return new Response(JSON.stringify({ error: 'invalid_client' }), { status: opts.tokenStatus })
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
    }
    if (throttled > 0) { throttled--; return new Response('', { status: 429, headers: { 'Retry-After': '1' } }) }
    const path = url.split('/v3/')[1].split('?')[0]
    const h = new Headers(init?.headers)
    const page = Number(h.get('X-Page-Number'))
    const size = Number(h.get('X-Page-Size'))
    const rows = pages[path] ?? []
    return new Response(JSON.stringify({ data: rows.slice((page - 1) * size, page * size) }), { status: 200 })
  }
  return { f, calls }
}

const base = { schoolRoute: 'school', clientId: 'id', clientSecret: 'shh', sleep: async () => {} }

test('completion words map to five statuses, and unknown words never pay', () => {
  assert.equal(toStatus('Turned In'), 'turned_in')
  assert.equal(toStatus('Complete'), 'turned_in')
  assert.equal(toStatus('Turned in late'), 'late')
  assert.equal(toStatus('Late'), 'late')
  assert.equal(toStatus('Missing'), 'missing')
  assert.equal(toStatus('Incomplete'), 'missing')
  assert.equal(toStatus('Not Turned In'), 'pending')
  assert.equal(toStatus('Not submitted'), 'pending')
  assert.equal(toStatus('Excused'), 'excused')
  assert.equal(toStatus(''), 'pending')
  assert.equal(toStatus(null), 'pending')
  assert.equal(toStatus('something new'), 'pending')
})

test('a grade row keeps only who, which assignment and the status', () => {
  const s = pickStatus({ student_id: 7, assignment_id: 3, completion_status: 'Turned In', score: 98, raw_score: '49/50', letter_grade: 'A', comment: 'Great work' }, 3)
  assert.deepEqual(s, { veracross_id: 7, assignment_id: 3, status: 'turned_in' })
  assert.deepEqual(Object.keys(s!).sort(), ['assignment_id', 'status', 'veracross_id'])
})

test('the token request uses client credentials and only the five read-only scopes', async () => {
  const { f, calls } = fakeVeracross({})
  const c = new VeracrossClient({ ...base, fetch: f })
  await c.accessToken()
  await c.accessToken() // reused, not asked for again
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://accounts.veracross.com/school/oauth/token')
  const body = new URLSearchParams(String(calls[0].init!.body))
  assert.equal(body.get('grant_type'), 'client_credentials')
  assert.deepEqual(body.get('scope')!.split(' '), SCOPES)
  for (const s of SCOPES) assert.match(s, /:list$/)
})

test('a refused token says so without echoing the secret', async () => {
  const { f } = fakeVeracross({}, { tokenStatus: 401 })
  const c = new VeracrossClient({ ...base, fetch: f })
  await assert.rejects(c.accessToken(), (e: Error) => /401/.test(e.message) && !e.message.includes('shh'))
})

test('lists follow every page, and wait out 429s', async () => {
  const rows = Array.from({ length: 250 }, (_, i) => ({ id: i + 1 }))
  const { f, calls } = fakeVeracross({ classes: rows }, { fail429: 2 })
  const c = new VeracrossClient({ ...base, fetch: f, pageSize: 100 })
  const got = await c.list('classes')
  assert.equal(got.length, 250)
  const gets = calls.filter(x => !x.url.endsWith('/oauth/token'))
  assert.equal(gets.length, 5) // two 429s, then pages 1, 2 and 3
  for (const g of gets) assert.equal(g.init!.method, 'GET')
})

test('only GET requests reach the API, and nothing about other students comes back', async () => {
  const { f, calls } = fakeVeracross({
    'academics/enrollments': [
      { student_id: 1, class_id: 10 }, { student_id: 2, class_id: 11 }, { student_id: 99, class_id: 12 },
    ],
    classes: [{ id: 10, name: 'Algebra II' }, { id: 11, name: 'Chemistry' }, { id: 12, name: 'Not ours' }],
    'academics/classes/10/assignments': [
      { id: 100, description: 'Problem set 4.2', due_date: '2026-10-20' },
      { id: 101, description: 'Way in the future', due_date: '2027-06-01' },
    ],
    'academics/classes/11/assignments': [{ id: 110, description: 'Lab report', due_date: '2026-10-21T00:00:00' }],
    'academics/assignments/100/grades': [
      { student_id: 1, completion_status: 'Turned In', score: 10 },
      { student_id: 99, completion_status: 'Missing', score: 0 },
    ],
    'academics/assignments/110/grades': [{ student_id: 2, completion_status: 'Late', score: 7 }],
  })
  const src = veracrossSource({ ...base, fetch: f })
  const snap = await src.snapshot([1, 2], { from: '2026-10-13', to: '2026-11-17' })
  assert.deepEqual(snap.classes.map(c => c.id).sort(), [10, 11])
  assert.deepEqual(snap.assignments.map(a => [a.id, a.due]), [[100, '2026-10-20'], [110, '2026-10-21']])
  assert.deepEqual(snap.statuses, [
    { veracross_id: 1, assignment_id: 100, status: 'turned_in' },
    { veracross_id: 2, assignment_id: 110, status: 'late' },
  ])
  assert.ok(!JSON.stringify(snap).includes('score'))
  assert.ok(!calls.some(c => c.url.includes('/12/')))
  for (const c of calls) if (!c.url.endsWith('/oauth/token')) assert.equal(c.init!.method, 'GET')
})

test('no pilot students means no API calls at all', async () => {
  const { f, calls } = fakeVeracross({})
  const snap = await veracrossSource({ ...base, fetch: f }).snapshot([], syncWindow())
  assert.deepEqual(snap, { classes: [], assignments: [], statuses: [] })
  assert.equal(calls.length, 0)
})

test('a bad school route is caught before anything is sent', () => {
  assert.throws(() => new VeracrossClient({ ...base, schoolRoute: '../evil' }))
  assert.throws(() => new VeracrossClient({ ...base, clientSecret: '' }))
})

test('mock data is the same every time for the same day', async () => {
  const now = () => new Date('2026-10-27T12:00:00Z')
  const a = await mockSource(now).snapshot([1001, 1002], syncWindow(now()))
  const b = await mockSource(now).snapshot([1001, 1002], syncWindow(now()))
  assert.deepEqual(a, b)
  assert.ok(a.assignments.length > 10)
  assert.ok(a.statuses.some(s => s.status === 'turned_in'))
  assert.ok(a.statuses.some(s => s.status === 'late'))
  assert.ok(a.statuses.some(s => s.status === 'pending'))
  // Nothing due later than today is ever marked turned in before the afternoon.
  assert.ok(a.statuses.every(s => s.status === 'pending' || a.assignments.find(x => x.id === s.assignment_id)!.due! < '2026-10-27'))
  // Only the students asked about.
  assert.deepEqual([...new Set(a.statuses.map(s => s.veracross_id))].sort(), [1001, 1002])
})
