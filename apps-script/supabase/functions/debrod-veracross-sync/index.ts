// debrod-veracross-sync: brings pilot students' homework in from Veracross
// and pays coins for what they've turned in, as a Supabase Edge Function.
//
// Who can start it:
// - the schedule (pg_cron, see supabase/README-homework.md), sending the
//   SYNC_SECRET in an x-sync-secret header;
// - Huddy, with **Sync now** on the Homework admin page (the caller's own
//   session must belong to an approved admin).
//
// Secrets (Edge Functions → Secrets; never in the repo or the page):
//   VERACROSS_MODE            'veracross' for the real API. Anything else,
//                             or unset, uses made-up data (mockSource).
//   VERACROSS_SCHOOL_ROUTE    the school's route, as in
//                             https://api.veracross.com/{route}/v3/
//   VERACROSS_CLIENT_ID       from the OAuth application IT creates
//   VERACROSS_CLIENT_SECRET
//   SYNC_SECRET               any long random string, also given to the schedule
//
// It only reads from Veracross. It writes only to DEBROD's debrod_hw_*
// tables, and only rows for students linked in debrod_hw_students.
//
// Deploy with "Verify JWT" OFF: the schedule has no user session, and the
// function checks the secret or the admin session itself.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { mockSource, syncWindow, veracrossSource, type Source } from './veracross.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Compares without leaking how much matched through timing.
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function chunks<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

function source(): Source {
  if ((Deno.env.get('VERACROSS_MODE') || '').trim().toLowerCase() !== 'veracross') return mockSource()
  return veracrossSource({
    schoolRoute: (Deno.env.get('VERACROSS_SCHOOL_ROUTE') || '').trim(),
    clientId: (Deno.env.get('VERACROSS_CLIENT_ID') || '').trim(),
    clientSecret: (Deno.env.get('VERACROSS_CLIENT_SECRET') || '').trim(),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'POST only' })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // The schedule's secret, or an admin's session.
  if (!sameSecret(req.headers.get('x-sync-secret') || '', Deno.env.get('SYNC_SECRET') || '')) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: who } = await db.auth.getUser(token)
    const caller = who?.user?.id
    if (!caller) return reply(401, { error: 'Sign in first.' })
    const { data: me } = await db.from('debrod_profiles').select('is_admin, status').eq('id', caller).maybeSingle()
    if (!me || !me.is_admin || me.status !== 'approved') return reply(403, { error: 'Only the admin can sync.' })
  }

  let src: Source
  try { src = source() } catch (e) { return reply(500, { error: (e as Error).message }) }

  const { data: run, error: runErr } = await db.from('debrod_hw_sync_runs').insert({ source: src.name }).select('id').single()
  if (runErr) return reply(500, { error: runErr.message })
  const finish = (fields: Record<string, unknown>) =>
    db.from('debrod_hw_sync_runs').update({ finished_at: new Date().toISOString(), ...fields }).eq('id', run.id)

  try {
    const { data: students, error: sErr } = await db.from('debrod_hw_students').select('profile_id, veracross_id')
    if (sErr) throw new Error(sErr.message)
    const byVeracross = new Map<number, string>((students || []).map(s => [Number(s.veracross_id), s.profile_id as string]))

    const snap = await src.snapshot([...byVeracross.keys()], syncWindow())

    // Only what at least one pilot student has a status for.
    const statuses = snap.statuses
      .filter(s => byVeracross.has(s.veracross_id))
      .map(s => ({ profile_id: byVeracross.get(s.veracross_id)!, assignment_id: s.assignment_id, status: s.status, synced_at: new Date().toISOString() }))
    const usedAssignments = new Set(statuses.map(s => s.assignment_id))
    const assignments = snap.assignments.filter(a => usedAssignments.has(a.id))
    const usedClasses = new Set(assignments.map(a => a.class_id))
    const classes = snap.classes.filter(c => usedClasses.has(c.id))
    // An assignment whose class didn't come back still needs a class row.
    for (const id of usedClasses) if (!classes.some(c => c.id === id)) classes.push({ id, name: `Class ${id}` })

    for (const part of chunks(classes)) {
      const { error } = await db.from('debrod_hw_classes').upsert(part, { onConflict: 'id' })
      if (error) throw new Error(`classes: ${error.message}`)
    }
    for (const part of chunks(assignments)) {
      const { error } = await db.from('debrod_hw_assignments').upsert(part, { onConflict: 'id' })
      if (error) throw new Error(`assignments: ${error.message}`)
    }
    for (const part of chunks(statuses)) {
      const { error } = await db.from('debrod_hw_status').upsert(part, { onConflict: 'profile_id,assignment_id' })
      if (error) throw new Error(`statuses: ${error.message}`)
    }

    // Pays once per assignment, however many times this runs.
    const { data: awarded, error: aErr } = await db.rpc('debrod_hw_award')
    if (aErr) throw new Error(`coins: ${aErr.message}`)

    if (byVeracross.size) {
      await db.from('debrod_hw_students').update({ last_synced_at: new Date().toISOString() }).in('profile_id', [...byVeracross.values()])
    }
    const result = { source: src.name, students: byVeracross.size, assignments: assignments.length, awarded: Number(awarded) || 0 }
    await finish({ ok: true, ...result })
    return reply(200, { ok: true, ...result })
  } catch (e) {
    // Coins are only paid once everything above saved, and every write is
    // an upsert, so the next run simply picks up from here. The page keeps
    // showing the last good data meanwhile.
    const message = String((e as Error).message || e).slice(0, 500)
    await finish({ ok: false, error: message })
    return reply(502, { error: message })
  }
})
