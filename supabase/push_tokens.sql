-- ============================================================================
-- device_push_tokens — one FCM registration token per signed-in device.
-- Run this in the Supabase SQL editor (after schema.sql).
--
-- owner_id is the APP-LEVEL identity ("parent" or a kid profile id) so the
-- sender can target a specific family member without knowing their auth uid.
-- ============================================================================

create table if not exists public.device_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  owner_id    text not null,                 -- "parent" or a kid profile id
  role        text not null check (role in ('parent','kid')),
  token       text not null,
  platform    text not null default 'android',
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  unique (token)
);

create index if not exists dpt_family_idx       on public.device_push_tokens (family_id);
create index if not exists dpt_family_owner_idx on public.device_push_tokens (family_id, owner_id);
create index if not exists dpt_family_role_idx  on public.device_push_tokens (family_id, role);

alter table public.device_push_tokens enable row level security;

-- A device may insert / update / delete its OWN token row.
drop policy if exists dpt_insert_own on public.device_push_tokens;
create policy dpt_insert_own on public.device_push_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists dpt_update_own on public.device_push_tokens;
create policy dpt_update_own on public.device_push_tokens
  for update using (user_id = auth.uid());

drop policy if exists dpt_delete_own on public.device_push_tokens;
create policy dpt_delete_own on public.device_push_tokens
  for delete using (user_id = auth.uid());

-- Any member can READ tokens within their own family (so the send-push function,
-- called with the caller's JWT, can look up who to notify).
drop policy if exists dpt_read_family on public.device_push_tokens;
create policy dpt_read_family on public.device_push_tokens
  for select using (family_id = public.my_family_id());

-- Upsert helper: replace a device's token row for (family, owner) atomically.
create or replace function public.register_push_token(
  p_family_id uuid, p_owner_id text, p_role text, p_token text, p_platform text default 'android'
) returns void language plpgsql security definer as $$
begin
  -- one token per device: clear any stale rows holding this token, then upsert
  delete from public.device_push_tokens where token = p_token and user_id <> auth.uid();
  insert into public.device_push_tokens (family_id, owner_id, role, token, platform, user_id, updated_at)
  values (p_family_id, p_owner_id, p_role, p_token, p_platform, auth.uid(), now())
  on conflict (token) do update
    set family_id = excluded.family_id, owner_id = excluded.owner_id,
        role = excluded.role, platform = excluded.platform, updated_at = now();
end; $$;
