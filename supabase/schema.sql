-- ============================================================================
-- FamKids / Spinini — account + family-pairing schema
-- ----------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Model: a PARENT signs up and creates a FAMILY (the hub). Kids (and a second
-- parent) join by redeeming a short PAIRING code. Membership in a family is
-- what derives the per-family P2P sync room (`family:<family_id>`), which is the
-- piece that lets two devices actually find each other.
--
-- Writes go through SECURITY DEFINER functions (create_family / create_pairing /
-- redeem_pairing) so clients never insert rows directly — RLS only needs to gate
-- READS to your own family.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner      uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  role         text not null check (role in ('parent','kid')),
  display_name text not null,
  age          int,
  created_at   timestamptz not null default now()
);

create index if not exists members_family_idx on public.members (family_id);

create table if not exists public.pairings (
  code       text primary key,
  family_id  uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'kid' check (role in ('parent','kid')),
  expires_at timestamptz not null,
  used_by    uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ── Helper: the caller's family id (SECURITY DEFINER avoids RLS recursion) ────

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.members where user_id = auth.uid();
$$;

-- ── Row-Level Security: you can only READ your own family ─────────────────────

alter table public.families enable row level security;
alter table public.members  enable row level security;
alter table public.pairings enable row level security;

drop policy if exists families_read on public.families;
create policy families_read on public.families
  for select using (id = public.my_family_id() or owner = auth.uid());

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (family_id = public.my_family_id());

drop policy if exists pairings_read on public.pairings;
create policy pairings_read on public.pairings
  for select using (family_id = public.my_family_id() or created_by = auth.uid());

-- ── Write paths (SECURITY DEFINER functions, called via supabase.rpc) ─────────

-- Parent creates their family hub + their own parent membership.
create or replace function public.create_family(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already in a family';
  end if;

  insert into public.families (name, owner) values (p_name, v_uid) returning id into v_family;
  insert into public.members (user_id, family_id, role, display_name)
    values (v_uid, v_family, 'parent', p_display_name);
  return v_family;
end;
$$;

-- Parent generates a short, time-limited invite code for a kid (or co-parent).
create or replace function public.create_pairing(p_role text default 'kid', p_ttl_minutes int default 30)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_code   text;
begin
  select family_id into v_family from public.members where user_id = v_uid and role = 'parent';
  if v_family is null then raise exception 'only a parent can create pairings'; end if;

  -- 6-char hex code from a random uuid (gen_random_uuid is on the default path;
  -- avoids pgcrypto's extensions-schema gen_random_bytes and unsupported base32).
  -- Hex (0-9 A-F) has no O/I, so there's no 0/O or 1/I ambiguity.
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.pairings (code, family_id, created_by, role, expires_at)
    values (v_code, v_family, v_uid, p_role, now() + make_interval(mins => p_ttl_minutes));
  return v_code;
end;
$$;

-- Kid / co-parent redeems a code → becomes a member of that family.
create or replace function public.redeem_pairing(p_code text, p_display_name text, p_age int default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_family uuid;
  v_role   text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'already in a family';
  end if;

  select family_id, role into v_family, v_role
    from public.pairings
   where code = upper(p_code) and used_by is null and expires_at > now();
  if v_family is null then raise exception 'invalid or expired code'; end if;

  insert into public.members (user_id, family_id, role, display_name, age)
    values (v_uid, v_family, v_role, p_display_name, p_age);
  update public.pairings set used_by = v_uid where code = upper(p_code);
  return v_family;
end;
$$;

-- ── Offline action queue (store-and-forward) ─────────────────────────────────
-- The live P2P relay only delivers when BOTH devices are online at once. This
-- table is the durable catch-up path: every syncable reducer action is also
-- appended here, and each device drains rows newer than its local cursor when it
-- (re)connects. The client dedups by `id`, so an action delivered BOTH live
-- (P2P) and via this queue is still applied exactly once.
--
-- `author` defaults to auth.uid() so the INSERT policy's `author = auth.uid()`
-- check passes without the client having to send it. `origin_peer` is the
-- emitting device's Trystero selfId — a device skips its OWN rows on drain
-- (it already applied them locally).
create table if not exists public.sync_events (
  id          uuid primary key,                 -- client-generated event id (dedup key)
  family_id   uuid not null references public.families (id) on delete cascade,
  author      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origin_peer text not null,                     -- emitting device's selfId
  payload     jsonb not null,                    -- the reducer action
  created_at  timestamptz not null default now()
);

create index if not exists sync_events_family_created_idx
  on public.sync_events (family_id, created_at);

alter table public.sync_events enable row level security;

-- Read: any member of your family. Insert: only as yourself, into your family.
drop policy if exists sync_events_read on public.sync_events;
create policy sync_events_read on public.sync_events
  for select using (family_id = public.my_family_id());

drop policy if exists sync_events_insert on public.sync_events;
create policy sync_events_insert on public.sync_events
  for insert with check (author = auth.uid() and family_id = public.my_family_id());

-- Retention: events accumulate forever. Prune ones older than 30 days so the
-- table (and each fresh device's first drain) stays bounded. A brand-new device
-- still gets full current state from a peer's P2P snapshot; the queue only needs
-- to cover the recent offline window. Schedule via pg_cron, or call manually.
create or replace function public.prune_sync_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sync_events where created_at < now() - interval '30 days';
$$;
