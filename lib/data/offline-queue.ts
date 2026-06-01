/**
 * Offline action queue — Supabase store-and-forward (Piece 2 of the comms gap).
 * ----------------------------------------------------------------------------
 * The P2P relay in `sync-bridge.ts` only reaches devices that are online RIGHT
 * NOW. This module is the durable catch-up path so a parent's "Remote Lock"
 * (or a chore / allowance / rule change) still lands on a child's phone that was
 * asleep when it was sent:
 *
 *   • On every local syncable action, `sync-bridge` ALSO writes it here
 *     (`enqueueEvent`) — best-effort, in addition to the live P2P send.
 *   • On (re)connect, a device `fetchEvents` since its stored cursor and replays
 *     the new ones, then advances the cursor.
 *
 * Dedup is the caller's job (`sync-bridge` keeps a persisted applied-id set), so
 * an action delivered BOTH live and via this queue is applied exactly once. We
 * fetch with `>=` (gte) the cursor rather than `>` so rows sharing the cursor's
 * exact timestamp are never skipped — the boundary rows simply re-appear and are
 * dropped by the dedup set.
 *
 * All calls are wrapped so a backend/offline failure degrades to "no catch-up"
 * (the live P2P path still works); the queue never throws into the store.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Max rows pulled per page. The drain loop paginates until a short page. */
export const QUEUE_PAGE_LIMIT = 500;

export interface QueuedEvent {
  id: string;
  payload: any;          // the reducer action
  origin_peer: string;   // emitting device's selfId
  created_at: string;    // ISO timestamp (server time)
}

const CURSOR_KEY = (familyId: string) => `sync:cursor:${familyId}`;

/**
 * Append a syncable action to the durable queue for offline peers. Best-effort:
 * if we're offline or the insert is rejected, we swallow it (the live P2P path
 * still delivers to online peers). `id` is the same event id used in the P2P
 * envelope, so the two delivery paths dedup against each other.
 */
export async function enqueueEvent(
  familyId: string,
  id: string,
  action: any,
  originPeer: string,
): Promise<void> {
  try {
    const { supabase } = await import("../supabase");
    // author defaults to auth.uid() in the DB; created_at defaults to now().
    const { error } = await supabase.from("sync_events").insert({
      id,
      family_id: familyId,
      payload: action,
      origin_peer: originPeer,
    });
    if (error) console.warn("[SYNC] enqueue failed:", error.message, "| action:", action?.type);
    else console.log("[SYNC] enqueued", action?.type, "fam", familyId.slice(0, 8));
  } catch (e) {
    console.warn("[SYNC] enqueue threw:", String(e));
  }
}

/**
 * Fetch up to `limit` events for the family, oldest-first, with
 * `created_at >= since` (since=null → from the beginning). Returns [] on any
 * failure so the caller can treat "couldn't reach backend" as "nothing new".
 */
export async function fetchEvents(
  familyId: string,
  since: string | null,
  limit: number = QUEUE_PAGE_LIMIT,
): Promise<QueuedEvent[]> {
  try {
    const { supabase } = await import("../supabase");
    let q = supabase
      .from("sync_events")
      .select("id, payload, origin_peer, created_at")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) { console.warn("[SYNC] fetch failed:", error.message); return []; }
    if (!data) return [];
    if (data.length > 0) console.log("[SYNC] fetched", data.length, "events for fam", familyId.slice(0, 8));
    return data as QueuedEvent[];
  } catch (e) {
    console.warn("[SYNC] fetch threw:", String(e));
    return [];
  }
}

/** The device's drain cursor (ISO of the newest event it has accounted for). */
export async function getCursor(familyId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURSOR_KEY(familyId));
  } catch {
    return null;
  }
}

export async function setCursor(familyId: string, createdAtIso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURSOR_KEY(familyId), createdAtIso);
  } catch {
    /* a lost cursor only means we re-fetch + re-dedup next time — harmless */
  }
}
