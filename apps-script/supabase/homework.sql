-- Homework: school assignments from Veracross, and coins for turning them in.
-- Run this after schema.sql (it uses debrod_profiles, debrod_approved() and
-- debrod_admin()). It's its own file so the pilot can be reviewed, or split
-- out, without the rest of DEBROD.
--
-- How it fits together:
-- - Huddy links an opted-in member to their Veracross student ID
--   (debrod_hw_link). Only linked members are ever synced.
-- - The debrod-veracross-sync Edge Function reads Veracross (read-only) with
--   the service role and writes classes, assignments and each student's
--   completion status here. No scores or grades are stored: the table has
--   nowhere to put them.
-- - debrod_hw_award(), run by the sync, pays coins once per assignment:
--   on time or late. The unique key on the ledger makes a second payment
--   impossible, however often the sync runs.
-- - Students spend coins on arcade time through debrod_hw_spend(), which
--   checks the balance and the daily cap inside the database.
-- - Every table has row-level security. Students read only their own rows,
--   and nobody writes from the page: all writes go through the functions
--   below or the sync's service role.
-- - Opting out (debrod_hw_opt_out) deletes that student's synced data and
--   coins at once. debrod_hw_end_pilot() deletes everything.

-- ── Settings (one row) ───────────────────────────────────────────────────
create table if not exists public.debrod_hw_settings (
  id int primary key default 1 check (id = 1),
  coins_on_time int not null default 10 check (coins_on_time between 0 and 1000),
  coins_late int not null default 3 check (coins_late between 0 and 1000),
  session_cost int not null default 20 check (session_cost between 1 and 1000),
  session_minutes int not null default 10 check (session_minutes between 1 and 120),
  daily_cap_minutes int not null default 30 check (daily_cap_minutes between 0 and 600),
  lock_arcade boolean not null default true,   -- linked students pay for arcade time
  time_zone text not null default 'America/New_York',
  updated_at timestamptz not null default now()
);
insert into public.debrod_hw_settings (id) values (1) on conflict (id) do nothing;
alter table public.debrod_hw_settings enable row level security;
drop policy if exists "approved people read homework settings" on public.debrod_hw_settings;
create policy "approved people read homework settings" on public.debrod_hw_settings
  for select to authenticated using (public.debrod_approved());
drop policy if exists "admins change homework settings" on public.debrod_hw_settings;
create policy "admins change homework settings" on public.debrod_hw_settings
  for update to authenticated using (public.debrod_admin()) with check (public.debrod_admin());

-- ── Pilot students ───────────────────────────────────────────────────────
create table if not exists public.debrod_hw_students (
  profile_id uuid primary key references public.debrod_profiles (id) on delete cascade,
  veracross_id bigint not null unique check (veracross_id > 0),
  first_name text not null default '' check (char_length(first_name) <= 40),
  opted_in_at timestamptz not null default now(),
  linked_by uuid references auth.users (id) on delete set null,
  last_synced_at timestamptz
);
alter table public.debrod_hw_students enable row level security;
drop policy if exists "see your own link, or all if admin" on public.debrod_hw_students;
create policy "see your own link, or all if admin" on public.debrod_hw_students
  for select to authenticated using (profile_id = auth.uid() or public.debrod_admin());

-- ── What the sync brings in ──────────────────────────────────────────────
create table if not exists public.debrod_hw_classes (
  id bigint primary key,                       -- Veracross class ID
  name text not null check (char_length(name) <= 120)
);
create table if not exists public.debrod_hw_assignments (
  id bigint primary key,                       -- Veracross assignment ID
  class_id bigint not null references public.debrod_hw_classes (id) on delete cascade,
  title text not null check (char_length(title) <= 300),
  due date
);
create index if not exists debrod_hw_assignments_by_class on public.debrod_hw_assignments (class_id);
-- One row per student per assignment. Status only: there is no column for a
-- score, a grade or a teacher comment.
create table if not exists public.debrod_hw_status (
  profile_id uuid not null references public.debrod_hw_students (profile_id) on delete cascade,
  assignment_id bigint not null references public.debrod_hw_assignments (id) on delete cascade,
  status text not null check (status in ('pending', 'turned_in', 'late', 'missing', 'excused')),
  synced_at timestamptz not null default now(),
  primary key (profile_id, assignment_id)
);
create index if not exists debrod_hw_status_by_assignment on public.debrod_hw_status (assignment_id);
alter table public.debrod_hw_classes enable row level security;
alter table public.debrod_hw_assignments enable row level security;
alter table public.debrod_hw_status enable row level security;

create or replace function public.debrod_hw_has_assignment(a bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.debrod_hw_status where assignment_id = a and profile_id = auth.uid())
$$;
create or replace function public.debrod_hw_has_class(c bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.debrod_hw_status s join public.debrod_hw_assignments a on a.id = s.assignment_id
    where a.class_id = c and s.profile_id = auth.uid())
$$;

drop policy if exists "students see their own status" on public.debrod_hw_status;
create policy "students see their own status" on public.debrod_hw_status
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists "students see their own assignments" on public.debrod_hw_assignments;
create policy "students see their own assignments" on public.debrod_hw_assignments
  for select to authenticated using (public.debrod_hw_has_assignment(id));
drop policy if exists "students see their own classes" on public.debrod_hw_classes;
create policy "students see their own classes" on public.debrod_hw_classes
  for select to authenticated using (public.debrod_hw_has_class(id));

-- ── Coins ────────────────────────────────────────────────────────────────
-- Every coin earned or spent is a row; a balance is the sum. Earning rows
-- carry the assignment, and (profile_id, assignment_id) is unique, so each
-- assignment pays once. Spending rows have no assignment (NULLs never clash).
create table if not exists public.debrod_hw_ledger (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.debrod_hw_students (profile_id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null check (reason in ('on_time', 'late', 'arcade', 'adjust')),
  assignment_id bigint references public.debrod_hw_assignments (id) on delete set null,
  minutes int check (minutes is null or minutes > 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (profile_id, assignment_id)
);
create index if not exists debrod_hw_ledger_by_profile on public.debrod_hw_ledger (profile_id, created_at desc);
alter table public.debrod_hw_ledger enable row level security;
drop policy if exists "students see their own coins" on public.debrod_hw_ledger;
create policy "students see their own coins" on public.debrod_hw_ledger
  for select to authenticated using (profile_id = auth.uid());

-- ── Sync log (for Huddy and IT) ──────────────────────────────────────────
create table if not exists public.debrod_hw_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source text not null check (source in ('mock', 'veracross')),
  ok boolean,
  students int not null default 0,
  assignments int not null default 0,
  awarded int not null default 0,
  error text check (error is null or char_length(error) <= 500)
);
alter table public.debrod_hw_sync_runs enable row level security;
drop policy if exists "admins read the sync log" on public.debrod_hw_sync_runs;
create policy "admins read the sync log" on public.debrod_hw_sync_runs
  for select to authenticated using (public.debrod_admin());

-- Drop assignments and classes nobody in the pilot has anymore.
create or replace function public.debrod_hw_prune() returns void
language sql security definer set search_path = public as $$
  delete from public.debrod_hw_assignments a where not exists (select 1 from public.debrod_hw_status s where s.assignment_id = a.id);
  delete from public.debrod_hw_classes c where not exists (select 1 from public.debrod_hw_assignments a where a.class_id = c.id);
$$;

-- ── Functions the page calls ─────────────────────────────────────────────

-- Your balance, today's arcade time and any running session. Null if you
-- aren't in the pilot.
create or replace function public.debrod_hw_me() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.debrod_hw_settings;
  st public.debrod_hw_students;
  today_start timestamptz;
  bal int;
  used int;
  ends timestamptz;
begin
  select * into st from public.debrod_hw_students where profile_id = me;
  if st.profile_id is null or not public.debrod_approved() then return null; end if;
  select * into s from public.debrod_hw_settings where id = 1;
  today_start := date_trunc('day', now() at time zone s.time_zone) at time zone s.time_zone;
  select coalesce(sum(amount), 0) into bal from public.debrod_hw_ledger where profile_id = me;
  select coalesce(sum(minutes), 0) into used from public.debrod_hw_ledger
    where profile_id = me and reason = 'arcade' and created_at >= today_start;
  select max(created_at + make_interval(mins => minutes)) into ends from public.debrod_hw_ledger
    where profile_id = me and reason = 'arcade';
  return jsonb_build_object(
    'balance', bal,
    'minutes_today', used,
    'session_ends_at', case when ends > now() then ends end,
    'first_name', st.first_name,
    'last_synced_at', st.last_synced_at,
    'settings', jsonb_build_object(
      'coins_on_time', s.coins_on_time, 'coins_late', s.coins_late,
      'session_cost', s.session_cost, 'session_minutes', s.session_minutes,
      'daily_cap_minutes', s.daily_cap_minutes, 'lock_arcade', s.lock_arcade))
  ;
end $$;

-- Spend coins on one arcade session. The row lock makes two clicks at once
-- count as one, and the balance and daily cap are checked here, not in the
-- page. Returns when the session ends.
create or replace function public.debrod_hw_spend() returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.debrod_hw_settings;
  today_start timestamptz;
  bal int;
  used int;
  ends timestamptz;
begin
  if not public.debrod_approved() then raise exception 'Sign in first.'; end if;
  perform 1 from public.debrod_hw_students where profile_id = me for update;
  if not found then raise exception 'You are not in the homework pilot.'; end if;
  select * into s from public.debrod_hw_settings where id = 1;
  select max(created_at + make_interval(mins => minutes)) into ends from public.debrod_hw_ledger
    where profile_id = me and reason = 'arcade';
  if ends > now() then return ends; end if;   -- one session at a time
  today_start := date_trunc('day', now() at time zone s.time_zone) at time zone s.time_zone;
  select coalesce(sum(amount), 0) into bal from public.debrod_hw_ledger where profile_id = me;
  select coalesce(sum(minutes), 0) into used from public.debrod_hw_ledger
    where profile_id = me and reason = 'arcade' and created_at >= today_start;
  if bal < s.session_cost then
    raise exception 'Not enough coins: a session costs %, and you have %.', s.session_cost, bal;
  end if;
  if used + s.session_minutes > s.daily_cap_minutes then
    raise exception 'That would pass today''s limit of % minutes. It resets at midnight.', s.daily_cap_minutes;
  end if;
  insert into public.debrod_hw_ledger (profile_id, amount, reason, minutes)
    values (me, -s.session_cost, 'arcade', s.session_minutes);
  return now() + make_interval(mins => s.session_minutes);
end $$;

-- Leave the pilot: your link, synced assignments and coins are deleted now.
create or replace function public.debrod_hw_opt_out() returns void
language sql security definer set search_path = public as $$
  delete from public.debrod_hw_students where profile_id = auth.uid();
  select public.debrod_hw_prune();
$$;

-- ── Admin functions ──────────────────────────────────────────────────────

-- Link a member who has opted in to their Veracross student ID.
create or replace function public.debrod_hw_link(p_profile uuid, p_veracross_id bigint, p_first_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.debrod_admin() then raise exception 'Only the admin can do that.'; end if;
  if not exists (select 1 from public.debrod_profiles where id = p_profile and status = 'approved') then
    raise exception 'That member isn''t approved.';
  end if;
  insert into public.debrod_hw_students (profile_id, veracross_id, first_name, linked_by)
    values (p_profile, p_veracross_id, left(trim(coalesce(p_first_name, '')), 40), auth.uid())
    on conflict (profile_id) do update set veracross_id = excluded.veracross_id, first_name = excluded.first_name, linked_by = excluded.linked_by;
end $$;

-- Remove someone from the pilot (same as them opting out).
create or replace function public.debrod_hw_unlink(p_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.debrod_admin() then raise exception 'Only the admin can do that.'; end if;
  delete from public.debrod_hw_students where profile_id = p_profile;
  perform public.debrod_hw_prune();
end $$;

-- Who's in the pilot and their balances. Not their assignments: those are
-- each student's own.
create or replace function public.debrod_hw_roster()
returns table (profile_id uuid, display text, username text, veracross_id bigint, first_name text,
  opted_in_at timestamptz, last_synced_at timestamptz, balance int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.debrod_admin() then raise exception 'Only the admin can do that.'; end if;
  return query
    select st.profile_id, p.display, p.username, st.veracross_id, st.first_name, st.opted_in_at, st.last_synced_at,
      coalesce((select sum(l.amount) from public.debrod_hw_ledger l where l.profile_id = st.profile_id), 0)::int
    from public.debrod_hw_students st join public.debrod_profiles p on p.id = st.profile_id
    order by p.display;
end $$;

-- The end of the pilot: delete every student link, assignment and coin.
create or replace function public.debrod_hw_end_pilot() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.debrod_admin() then raise exception 'Only the admin can do that.'; end if;
  delete from public.debrod_hw_students where true;
  delete from public.debrod_hw_assignments where true;
  delete from public.debrod_hw_classes where true;
  delete from public.debrod_hw_sync_runs where true;
end $$;

-- ── Functions only the sync calls (service role) ─────────────────────────

-- Pay for every turned-in assignment that hasn't been paid yet. Running it
-- twice pays nothing the second time. Returns how many were paid.
create or replace function public.debrod_hw_award() returns int
language plpgsql security definer set search_path = public as $$
declare
  s public.debrod_hw_settings;
  n int;
begin
  select * into s from public.debrod_hw_settings where id = 1;
  insert into public.debrod_hw_ledger (profile_id, amount, reason, assignment_id)
    select st.profile_id,
      case st.status when 'turned_in' then s.coins_on_time else s.coins_late end,
      case st.status when 'turned_in' then 'on_time' else 'late' end,
      st.assignment_id
    from public.debrod_hw_status st
    where st.status in ('turned_in', 'late')
      and (case st.status when 'turned_in' then s.coins_on_time else s.coins_late end) > 0
    on conflict (profile_id, assignment_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Grants ───────────────────────────────────────────────────────────────
grant select on public.debrod_hw_settings, public.debrod_hw_students, public.debrod_hw_classes,
  public.debrod_hw_assignments, public.debrod_hw_status, public.debrod_hw_ledger, public.debrod_hw_sync_runs to authenticated;
grant update on public.debrod_hw_settings to authenticated;
revoke all on public.debrod_hw_settings, public.debrod_hw_students, public.debrod_hw_classes,
  public.debrod_hw_assignments, public.debrod_hw_status, public.debrod_hw_ledger, public.debrod_hw_sync_runs from anon;

revoke execute on function public.debrod_hw_me(), public.debrod_hw_spend(), public.debrod_hw_opt_out(),
  public.debrod_hw_link(uuid, bigint, text), public.debrod_hw_unlink(uuid), public.debrod_hw_roster(),
  public.debrod_hw_end_pilot() from anon, public;
grant execute on function public.debrod_hw_me(), public.debrod_hw_spend(), public.debrod_hw_opt_out(),
  public.debrod_hw_link(uuid, bigint, text), public.debrod_hw_unlink(uuid), public.debrod_hw_roster(),
  public.debrod_hw_end_pilot() to authenticated;
revoke execute on function public.debrod_hw_has_assignment(bigint), public.debrod_hw_has_class(bigint) from anon, public;
grant execute on function public.debrod_hw_has_assignment(bigint), public.debrod_hw_has_class(bigint) to authenticated;
revoke execute on function public.debrod_hw_award(), public.debrod_hw_prune() from anon, authenticated, public;
grant execute on function public.debrod_hw_award(), public.debrod_hw_prune() to service_role;
