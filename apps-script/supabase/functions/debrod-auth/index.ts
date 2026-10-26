// debrod-auth: DEBROD's account desk, as a Supabase Edge Function.
//
// - signup { username, password, display? } → creates the login and a
//   'pending' profile. The account named "huddy" is the admin: while there's
//   no admin yet, signing up as huddy is approved and made admin straight
//   away, and the name can't be taken again.
// - reset { user_id, password } and remove { user_id } → admin only (the
//   caller's own session decides), to set a new password or delete an
//   account entirely.
//
// Deploy with "Verify JWT" OFF: sign-up happens before anyone has a session,
// and the admin actions check the caller's session themselves.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ADMIN = 'huddy'
const EMAIL_DOMAIN = 'debrod.example.com' // never mailed; logins are by username
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'POST only' })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return reply(400, { error: 'Send JSON.' }) }
  const action = String(body.action || 'signup')

  if (action === 'signup') {
    const username = String(body.username || '').trim().toLowerCase()
    const password = String(body.password || '')
    const display = String(body.display || body.username || '').trim().slice(0, 24) || username
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return reply(400, { error: 'Usernames are 3–20 letters, numbers or _.' })
    if (password.length < 8) return reply(400, { error: 'Passwords need at least 8 characters.' })
    const { data: taken } = await admin.from('debrod_profiles').select('id').eq('username', username).maybeSingle()
    if (taken) return reply(409, { error: 'That username is taken.' })
    let isAdmin = false
    if (username === ADMIN) {
      const { count } = await admin.from('debrod_profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true)
      isAdmin = !count
    }
    const { data: made, error } = await admin.auth.admin.createUser({
      email: `${username}@${EMAIL_DOMAIN}`, password, email_confirm: true, user_metadata: { username, display },
    })
    if (error || !made.user) return reply(400, { error: error?.message?.includes('registered') ? 'That username is taken.' : (error?.message || 'Could not create the account.') })
    const { error: perr } = await admin.from('debrod_profiles').insert({
      id: made.user.id, username, display, status: isAdmin ? 'approved' : 'pending', is_admin: isAdmin,
    })
    if (perr) {
      await admin.auth.admin.deleteUser(made.user.id)
      return reply(409, { error: perr.message.includes('duplicate') ? 'That username is taken.' : perr.message })
    }
    return reply(200, { ok: true, status: isAdmin ? 'approved' : 'pending' })
  }

  // Admin actions: the caller's session must belong to an approved admin.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: who } = await admin.auth.getUser(token)
  const caller = who?.user?.id
  if (!caller) return reply(401, { error: 'Sign in first.' })
  const { data: me } = await admin.from('debrod_profiles').select('is_admin, status').eq('id', caller).maybeSingle()
  if (!me || !me.is_admin || me.status !== 'approved') return reply(403, { error: 'Only the admin can do that.' })
  const target = String(body.user_id || '')
  if (!target) return reply(400, { error: 'Which account?' })
  if (target === caller && action === 'remove') return reply(400, { error: 'You can\'t remove your own account here.' })

  if (action === 'reset') {
    const password = String(body.password || '')
    if (password.length < 8) return reply(400, { error: 'Passwords need at least 8 characters.' })
    const { error } = await admin.auth.admin.updateUserById(target, { password })
    return error ? reply(400, { error: error.message }) : reply(200, { ok: true })
  }
  if (action === 'remove') {
    const { error } = await admin.auth.admin.deleteUser(target) // the profile and their data go with it
    return error ? reply(400, { error: error.message }) : reply(200, { ok: true })
  }
  return reply(400, { error: 'Unknown action.' })
})
