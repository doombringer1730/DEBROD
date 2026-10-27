-- Checks homework.sql's rules: who can see what, coins paid once, spending
-- limits, and opting out. Run with tests/run.sh (a throwaway local Postgres).
-- Any failed check stops with an error naming it.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Three approved members: Huddy (admin), Ava and Ben (pilot students), and
-- Cal, who isn't in the pilot.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');
insert into public.debrod_profiles (id, username, display, status, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'huddy', 'Huddy', 'approved', true),
  ('00000000-0000-0000-0000-00000000000b', 'ava', 'Ava', 'approved', false),
  ('00000000-0000-0000-0000-00000000000c', 'ben', 'Ben', 'approved', false),
  ('00000000-0000-0000-0000-00000000000d', 'cal', 'Cal', 'approved', false);

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
set client_min_messages = notice;

-- ── Linking ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.debrod_hw_link('00000000-0000-0000-0000-00000000000b', 1001, 'Ava');
  raise exception 'FAILED: a student linked themselves';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: only the admin can link students';
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.debrod_hw_link('00000000-0000-0000-0000-00000000000b', 1001, 'Ava');
select public.debrod_hw_link('00000000-0000-0000-0000-00000000000c', 1002, 'Ben');
select pg_temp.check((select count(*) from public.debrod_hw_roster()) = 2, 'the admin sees both pilot students on the roster');
reset role;

-- ── What the sync writes (as the service role) ──
set role service_role;
insert into public.debrod_hw_classes values (10, 'Algebra II'), (11, 'Chemistry');
insert into public.debrod_hw_assignments values (100, 10, 'Problem set 4.2', '2026-10-20'), (101, 10, 'Problem set 4.3', '2026-10-22'),
  (110, 11, 'Lab report', '2026-10-21'), (111, 11, 'Lab quiz prep', '2026-10-30');
insert into public.debrod_hw_status (profile_id, assignment_id, status) values
  ('00000000-0000-0000-0000-00000000000b', 100, 'turned_in'),
  ('00000000-0000-0000-0000-00000000000b', 101, 'late'),
  ('00000000-0000-0000-0000-00000000000b', 110, 'turned_in'),
  ('00000000-0000-0000-0000-00000000000b', 111, 'pending'),
  ('00000000-0000-0000-0000-00000000000c', 110, 'missing');
select pg_temp.check(public.debrod_hw_award() = 3, 'the first award pays three turn-ins');
select pg_temp.check(public.debrod_hw_award() = 0, 'running it again pays nothing');
-- Ben turns in late after all: one more payment, once.
update public.debrod_hw_status set status = 'late' where profile_id = '00000000-0000-0000-0000-00000000000c' and assignment_id = 110;
select pg_temp.check(public.debrod_hw_award() = 1, 'a late turn-in is paid when it shows up');
select pg_temp.check(public.debrod_hw_award() = 0, 'and only once');
-- Flipping a status back and forth never pays twice.
update public.debrod_hw_status set status = 'pending' where assignment_id = 100;
update public.debrod_hw_status set status = 'turned_in' where assignment_id = 100;
select pg_temp.check(public.debrod_hw_award() = 0, 'an assignment that flips back to turned in isn''t paid again');
reset role;

-- ── What each student can see ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((public.debrod_hw_me() ->> 'balance')::int = 23, 'Ava''s balance is 10 + 3 + 10');
select pg_temp.check((select count(*) from public.debrod_hw_status) = 4, 'Ava sees her four statuses');
select pg_temp.check((select count(*) from public.debrod_hw_assignments) = 4, 'Ava sees her four assignments');
select pg_temp.check((select count(*) from public.debrod_hw_ledger) = 3, 'Ava sees her own three coin rows');
select pg_temp.check((select count(*) from public.debrod_hw_students) = 1, 'Ava sees only her own link');
select pg_temp.check((select count(*) from public.debrod_hw_sync_runs) = 0, 'students can''t read the sync log');
do $$ begin
  perform public.debrod_hw_roster();
  raise exception 'FAILED: a student read the roster';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: students can''t read the roster';
end $$;
do $$ begin
  insert into public.debrod_hw_ledger (profile_id, amount, reason) values ('00000000-0000-0000-0000-00000000000b', 1000, 'adjust');
  raise exception 'FAILED: a student gave themselves coins';
exception when insufficient_privilege then raise notice 'ok: students can''t write coins';
end $$;
do $$ begin
  update public.debrod_hw_status set status = 'turned_in' where assignment_id = 111;
  if found then raise exception 'FAILED: a student marked their own work turned in'; end if;
  raise notice 'ok: students can''t change their status';
exception when insufficient_privilege then raise notice 'ok: students can''t change their status';
end $$;
do $$ begin
  update public.debrod_hw_settings set coins_on_time = 1000;
  if found then raise exception 'FAILED: a student changed the coin settings'; end if;
  raise notice 'ok: students can''t change settings';
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.debrod_hw_assignments) = 1, 'Ben sees only the one assignment he has');
select pg_temp.check((select count(*) from public.debrod_hw_classes) = 1, 'and only its class');
select pg_temp.check((public.debrod_hw_me() ->> 'balance')::int = 3, 'Ben''s balance is 3');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(public.debrod_hw_me() is null, 'Cal isn''t in the pilot');
select pg_temp.check((select count(*) from public.debrod_hw_assignments) = 0, 'Cal sees no assignments');
reset role;

-- The admin sees the roster and balances, but not students' assignments.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.debrod_hw_assignments) = 0, 'the admin can''t read students'' assignments');
select pg_temp.check((select balance from public.debrod_hw_roster() where veracross_id = 1001) = 23, 'the admin sees Ava''s balance');
update public.debrod_hw_settings set daily_cap_minutes = 30;
reset role;

-- ── Spending ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  perform public.debrod_hw_spend();
  raise exception 'FAILED: Ben spent coins he doesn''t have';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: not enough coins is refused (%)', sqlerrm;
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.debrod_hw_spend() > now(), 'Ava buys a session');
select pg_temp.check((public.debrod_hw_me() ->> 'balance')::int = 3, 'it cost 20');
select pg_temp.check((public.debrod_hw_me() ->> 'minutes_today')::int = 10, 'and counts 10 minutes today');
select pg_temp.check(public.debrod_hw_me() ->> 'session_ends_at' is not null, 'the session is running');
select public.debrod_hw_spend();
select pg_temp.check((public.debrod_hw_me() ->> 'balance')::int = 3, 'a second click during the session costs nothing');
reset role;

-- The daily cap, with plenty of coins and the first session over.
set role service_role;
insert into public.debrod_hw_ledger (profile_id, amount, reason, note) values ('00000000-0000-0000-0000-00000000000b', 500, 'adjust', 'test');
update public.debrod_hw_ledger set created_at = now() - interval '11 minutes' where reason = 'arcade';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.debrod_hw_spend();
reset role;
update public.debrod_hw_ledger set created_at = now() - interval '11 minutes' where reason = 'arcade';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.debrod_hw_spend();
select pg_temp.check((public.debrod_hw_me() ->> 'minutes_today')::int = 30, 'three sessions make 30 minutes');
reset role;
update public.debrod_hw_ledger set created_at = now() - interval '11 minutes' where reason = 'arcade';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.debrod_hw_spend();
  raise exception 'FAILED: a fourth session went past the daily cap';
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: the daily cap holds (%)', sqlerrm;
end $$;
reset role;

-- ── Opting out deletes everything about that student ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.debrod_hw_opt_out();
select pg_temp.check(public.debrod_hw_me() is null, 'Ava is out of the pilot');
reset role;
select pg_temp.check((select count(*) from public.debrod_hw_ledger where profile_id = '00000000-0000-0000-0000-00000000000b') = 0, 'her coins are deleted');
select pg_temp.check((select count(*) from public.debrod_hw_status where profile_id = '00000000-0000-0000-0000-00000000000b') = 0, 'her statuses are deleted');
select pg_temp.check((select count(*) from public.debrod_hw_assignments) = 1, 'assignments only she had are deleted');
select pg_temp.check((select count(*) from public.debrod_hw_classes) = 1, 'and classes only she had');

-- ── Deleting a DEBROD account takes its pilot data with it ──
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from public.debrod_hw_students) = 0, 'a deleted account leaves no pilot link');
select pg_temp.check((select count(*) from public.debrod_hw_ledger) = 0, 'or coins');

-- ── The end of the pilot ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.debrod_hw_link('00000000-0000-0000-0000-00000000000d', 1003, 'Cal');
select public.debrod_hw_end_pilot();
reset role;
select pg_temp.check((select count(*) from public.debrod_hw_students) + (select count(*) from public.debrod_hw_assignments)
  + (select count(*) from public.debrod_hw_classes) + (select count(*) from public.debrod_hw_sync_runs) = 0, 'ending the pilot deletes everything');

-- ── Anonymous visitors get nothing ──
set role anon;
do $$ begin
  perform 1 from public.debrod_hw_status;
  raise exception 'FAILED: anon read statuses';
exception when insufficient_privilege then raise notice 'ok: signed-out visitors can''t read anything';
end $$;
reset role;

\echo 'All homework checks passed.'
