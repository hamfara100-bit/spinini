-- ============================================================================
-- Spinini — Supabase Storage setup for cross-device family media sharing.
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ============================================================================
-- Creates a `family-media` bucket used to share photos/videos posted to the
-- Family Social feed (and other cross-device media) so they show on every
-- device, not just the one that uploaded them.
--
-- The bucket is public-read, but object paths use a random id, so URLs are
-- effectively unguessable. (For stricter privacy you can later switch to a
-- private bucket + signed URLs.)

insert into storage.buckets (id, name, public)
values ('family-media', 'family-media', true)
on conflict (id) do nothing;

-- Any signed-in family member can upload.
drop policy if exists "family-media authenticated upload" on storage.objects;
create policy "family-media authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'family-media');

-- Public read (bucket is public; paths are random/unguessable).
drop policy if exists "family-media public read" on storage.objects;
create policy "family-media public read"
  on storage.objects for select
  using (bucket_id = 'family-media');

-- Uploaders can delete their own objects.
drop policy if exists "family-media owner delete" on storage.objects;
create policy "family-media owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'family-media' and owner = auth.uid());
