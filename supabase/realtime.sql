-- ============================================================================
-- Spinini — enable Supabase Realtime for the cross-device sync queue.
-- Run ONCE in the Supabase SQL editor (optional but recommended).
-- ============================================================================
-- With this, new sync_events rows are pushed to the other devices over a
-- websocket near-instantly instead of waiting for the backstop poll. Without it
-- the app still works — it just falls back to the ~20s catch-up poll.
--
-- RLS still applies to realtime, so devices only receive their own family's
-- rows (the existing sync_events SELECT policy governs this).

alter publication supabase_realtime add table public.sync_events;
