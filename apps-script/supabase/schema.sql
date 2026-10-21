-- DEBROD accounts, chats, shared deadlines and per-user Study, for the
-- Apps Script version. Run this once in your DEBROD Supabase project
-- (SQL Editor → New query → paste → Run). It's safe to run again.
--
-- How it fits together:
-- - Logins are Supabase Auth users, created by the debrod-auth Edge Function
--   (username + password; the email is a made-up address nobody receives).
-- - Every account has a debrod_profiles row that starts as 'pending'. Only an
--   admin (Huddy) can approve it, and nothing below is readable until it's
--   approved: every policy checks debrod_approved().
-- - DMs and group chats: only members can see a conversation, its members and
--   its messages.
-- - debrod_deadlines is the public tracker on Home: every approved user can
--   read it and add to it; only the poster or an admin can change or remove.
-- - debrod_study keeps each person's Study data (decks, assignments, coins);
--   only its owner can read or write it.

create extension if not exists pgcrypto;

-- ── Accounts ──────────────────────────────────────────────────────────────
create table if not exists public.debrod_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display text not null check (char_length(display) between 1 and 24),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);
alter table public.debrod_profiles enable row level security;

create or replace function public.debrod_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.debrod_profiles where id = auth.uid() and status = 'approved')
$$;

create or replace function public.debrod_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.debrod_profiles where id = auth.uid() and status = 'approved' and is_admin)
$$;

drop policy if exists "see yourself, approved people, or everyone if admin" on public.debrod_profiles;
create policy "see yourself, approved people, or everyone if admin" on public.debrod_profiles
  for select to authenticated
  using (id = auth.uid() or (status = 'approved' and public.debrod_approved()) or public.debrod_admin());

drop policy if exists "admins decide" on public.debrod_profiles;
create policy "admins decide" on public.debrod_profiles
  for update to authenticated using (public.debrod_admin()) with check (public.debrod_admin());
-- New rows only come from the debrod-auth function (service role); deleting
-- an account goes through it too, so the login is removed with it.

-- An admin approving or rejecting someone also records who and when.
create or replace function public.debrod_stamp_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    new.decided_at := now();
    new.decided_by := auth.uid();
  end if;
  -- Nobody makes themselves (or anyone else) an admin from the app.
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists debrod_stamp_decision on public.debrod_profiles;
create trigger debrod_stamp_decision before update on public.debrod_profiles
  for each row execute function public.debrod_stamp_decision();

-- ── Chats: DMs and groups ────────────────────────────────────────────────
create table if not exists public.debrod_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('dm', 'group')),
  name text check (name is null or char_length(name) between 1 and 40),
  study boolean not null default false,      -- a study group
  dm_key text unique,                        -- "<smaller id>:<larger id>" for DMs
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.debrod_members (
  conversation_id uuid not null references public.debrod_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.debrod_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.debrod_conversations (id) on delete cascade,
  sender uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists debrod_messages_by_conversation on public.debrod_messages (conversation_id, created_at desc);
create index if not exists debrod_members_by_user on public.debrod_members (user_id);
alter table public.debrod_conversations enable row level security;
alter table public.debrod_members enable row level security;
alter table public.debrod_messages enable row level security;

create or replace function public.debrod_member(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.debrod_members where conversation_id = conv and user_id = auth.uid())
$$;

drop policy if exists "members see the conversation" on public.debrod_conversations;
create policy "members see the conversation" on public.debrod_conversations
  for select to authenticated using (public.debrod_approved() and public.debrod_member(id));
drop policy if exists "members rename groups" on public.debrod_conversations;
create policy "members rename groups" on public.debrod_conversations
  for update to authenticated using (kind = 'group' and public.debrod_approved() and public.debrod_member(id))
  with check (kind = 'group');

drop policy if exists "members see each other" on public.debrod_members;
create policy "members see each other" on public.debrod_members
  for select to authenticated using (public.debrod_approved() and public.debrod_member(conversation_id));
drop policy if exists "mark your own reads" on public.debrod_members;
create policy "mark your own reads" on public.debrod_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "leave a group" on public.debrod_members;
create policy "leave a group" on public.debrod_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read messages" on public.debrod_messages;
create policy "members read messages" on public.debrod_messages
  for select to authenticated using (public.debrod_approved() and public.debrod_member(conversation_id));
drop policy if exists "members send as themselves" on public.debrod_messages;
create policy "members send as themselves" on public.debrod_messages
  for insert to authenticated
  with check (sender = auth.uid() and public.debrod_approved() and public.debrod_member(conversation_id));

-- Start (or reopen) a DM with an approved person.
create or replace function public.debrod_open_dm(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  key text;
  conv uuid;
begin
  if not public.debrod_approved() then raise exception 'not approved'; end if;
  if other = me or not exists (select 1 from public.debrod_profiles where id = other and status = 'approved') then
    raise exception 'pick an approved person';
  end if;
  key := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  insert into public.debrod_conversations (kind, dm_key, created_by) values ('dm', key, me)
    on conflict (dm_key) do nothing;
  select id into conv from public.debrod_conversations where dm_key = key;
  insert into public.debrod_members (conversation_id, user_id) values (conv, me), (conv, other)
    on conflict do nothing;
  return conv;
end $$;

-- A group chat (or study group) with you and the approved people you pick.
create or replace function public.debrod_new_group(group_name text, people uuid[], is_study boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if not public.debrod_approved() then raise exception 'not approved'; end if;
  insert into public.debrod_conversations (kind, name, study, created_by)
    values ('group', left(coalesce(nullif(trim(group_name), ''), 'Group chat'), 40), coalesce(is_study, false), me)
    returning id into conv;
  insert into public.debrod_members (conversation_id, user_id) values (conv, me);
  insert into public.debrod_members (conversation_id, user_id)
    select conv, p.id from public.debrod_profiles p
    where p.id = any (coalesce(people, '{}')) and p.status = 'approved' and p.id <> me
    on conflict do nothing;
  return conv;
end $$;

-- Members can add more approved people to a group.
create or replace function public.debrod_add_to_group(conv uuid, people uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.debrod_approved() and public.debrod_member(conv)) then raise exception 'not a member'; end if;
  if not exists (select 1 from public.debrod_conversations where id = conv and kind = 'group') then raise exception 'not a group'; end if;
  insert into public.debrod_members (conversation_id, user_id)
    select conv, p.id from public.debrod_profiles p
    where p.id = any (coalesce(people, '{}')) and p.status = 'approved'
    on conflict do nothing;
end $$;

-- Your conversations, newest first, with the last message and unread count.
create or replace function public.debrod_inbox()
returns table (id uuid, kind text, name text, study boolean, members jsonb, last_body text, last_sender uuid, last_at timestamptz, unread integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.name, c.study,
    (select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display', p.display) order by p.display)
       from public.debrod_members m2 join public.debrod_profiles p on p.id = m2.user_id
       where m2.conversation_id = c.id) as members,
    lm.body, lm.sender, coalesce(lm.created_at, c.created_at),
    (select count(*)::int from public.debrod_messages x
       where x.conversation_id = c.id and x.created_at > m.last_read_at and x.sender is distinct from auth.uid())
  from public.debrod_members m
  join public.debrod_conversations c on c.id = m.conversation_id
  left join lateral (select body, sender, created_at from public.debrod_messages
                     where conversation_id = c.id order by created_at desc limit 1) lm on true
  where m.user_id = auth.uid() and public.debrod_approved()
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- ── Public deadline tracker (Home) ───────────────────────────────────────
create table if not exists public.debrod_deadlines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  course text check (course is null or char_length(course) <= 40),
  due date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists debrod_deadlines_by_due on public.debrod_deadlines (due);
alter table public.debrod_deadlines enable row level security;
drop policy if exists "approved people see deadlines" on public.debrod_deadlines;
create policy "approved people see deadlines" on public.debrod_deadlines
  for select to authenticated using (public.debrod_approved());
drop policy if exists "approved people post deadlines" on public.debrod_deadlines;
create policy "approved people post deadlines" on public.debrod_deadlines
  for insert to authenticated with check (public.debrod_approved() and created_by = auth.uid());
drop policy if exists "posters and admins edit" on public.debrod_deadlines;
create policy "posters and admins edit" on public.debrod_deadlines
  for update to authenticated using (public.debrod_approved() and (created_by = auth.uid() or public.debrod_admin()));
drop policy if exists "posters and admins remove" on public.debrod_deadlines;
create policy "posters and admins remove" on public.debrod_deadlines
  for delete to authenticated using (public.debrod_approved() and (created_by = auth.uid() or public.debrod_admin()));

-- ── Your own Study data ──────────────────────────────────────────────────
create table if not exists public.debrod_study (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (octet_length(data::text) < 2000000)
);
alter table public.debrod_study enable row level security;
drop policy if exists "only you" on public.debrod_study;
create policy "only you" on public.debrod_study
  for all to authenticated
  using (user_id = auth.uid() and public.debrod_approved())
  with check (user_id = auth.uid() and public.debrod_approved());

-- ── Grants and live updates ──────────────────────────────────────────────
-- The anon role (not signed in) gets nothing; signed-in users go through the
-- policies above.
revoke all on public.debrod_profiles, public.debrod_conversations, public.debrod_members,
  public.debrod_messages, public.debrod_deadlines, public.debrod_study from anon;
grant select, update on public.debrod_profiles to authenticated;
grant select, update on public.debrod_conversations to authenticated;
grant select, update, delete on public.debrod_members to authenticated;
grant select, insert on public.debrod_messages to authenticated;
grant select, insert, update, delete on public.debrod_deadlines to authenticated;
grant select, insert, update, delete on public.debrod_study to authenticated;
revoke execute on function public.debrod_open_dm(uuid), public.debrod_new_group(text, uuid[], boolean),
  public.debrod_add_to_group(uuid, uuid[]), public.debrod_inbox() from anon, public;
grant execute on function public.debrod_open_dm(uuid), public.debrod_new_group(text, uuid[], boolean),
  public.debrod_add_to_group(uuid, uuid[]), public.debrod_inbox() to authenticated;
-- The policy helpers only answer about the caller, but there's no reason
-- for signed-out visitors to call them; the trigger is never called directly.
revoke execute on function public.debrod_approved(), public.debrod_admin(), public.debrod_member(uuid) from anon, public;
grant execute on function public.debrod_approved(), public.debrod_admin(), public.debrod_member(uuid) to authenticated;
revoke execute on function public.debrod_stamp_decision() from anon, authenticated, public;

-- Messages, new conversations, deadlines and sign-ups arrive live (Realtime
-- still applies the policies above to each subscriber).
do $$
declare t text;
begin
  foreach t in array array['debrod_messages', 'debrod_members', 'debrod_deadlines', 'debrod_profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
