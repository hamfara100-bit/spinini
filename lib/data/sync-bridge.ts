/**
 * Cross-device family-state sync (Pieces 1 + 2 of the comms gap).
 * ----------------------------------------------------------------------------
 * The data store persists ONLY to local AsyncStorage, so a parent toggling
 * "Remote Lock" (or assigning a chore, sending allowance, casting a vote…) only
 * mutates THIS device's copy. This bridge relays reducer actions to the other
 * device(s) over two complementary paths:
 *
 *   • LIVE (P2P, Piece 1) — over the existing Trystero swarm: a local action is
 *     applied locally, then `broadcast(action)` sends a {kind:"action"} frame;
 *     peers replay it through their reducer. Both devices run the SAME reducer,
 *     so state converges (event-sourcing style). New peers request a full
 *     {kind:"snapshot"} to catch up on history P2P can't replay.
 *
 *   • DURABLE (Supabase queue, Piece 2) — `broadcast` ALSO appends the action to
 *     the `sync_events` table (see ./offline-queue). A device that was OFFLINE
 *     when the action was sent drains the queue on reconnect and replays it. This
 *     is the store-and-forward layer pure P2P lacks.
 *
 * EXACTLY-ONCE: every broadcast action gets a unique `eventId`, carried on BOTH
 * the P2P frame and the queue row. Each device keeps a persisted applied-id set;
 * any action whose id is already in the set is skipped, so live + queue delivery
 * of the same action applies it once. A device skips its OWN queue rows entirely
 * (matched by origin selfId) — it already applied them locally.
 *
 * ROOM / FAMILY: the relay only runs when handed a non-null per-family `roomId`
 * (`family:<familyId>`, from Supabase membership). A device not signed into a
 * family joins no swarm and queues nothing → no cross-family leak.
 *
 * Secrets (Google tokens, recovery code, password vault) are denylisted and
 * never leave the device — not over P2P, not into the queue.
 */

import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createCommsTransport } from "../comms/transport";
import type { CommsSyncTransport, SyncEnvelope } from "../comms/transport";
import { supabase } from "../supabase";
import type { AppState } from "./types";
import { uid, uuidv4 } from "../utils";
import {
  enqueueEvent, fetchEvents, getCursor, setCursor, QUEUE_PAGE_LIMIT,
} from "./offline-queue";
import { startNativeTicker, stopNativeTicker, addTickListener } from "../../modules/expo-foreground-service/src";

// Master switch. The relay only ever runs when `useFamilySync` is handed a
// non-null per-family `roomId`, so a device that isn't signed into a family
// never joins any swarm and never writes to the queue.
export const SYNC_ENABLED = true;

/**
 * Action types that must NEVER be relayed: they carry device-local secrets or
 * are internal/ephemeral. Everything else syncs (chores, allowance, locks,
 * rules, votes, location, etc.). Matched by exact type.
 */
const SYNC_DENYLIST = new Set<string>([
  "@@HYDRATE",
  "SET_PIN_RECOVERY_CODE",
  "VAULT_ADD", "VAULT_REMOVE",       // password manager — parent-device-only
  "FAMILY_CHAT_MARK_READ",           // chat read-state is per-device, not synced
  "VOICE_RECORDING_ADD",             // local audio file URIs — only valid on the kid's own device
  "VOICE_RECORDING_DELETE",
  "RELINK_KID_ID",                   // parent-local placeholder→userId reconciliation
  "SOCIAL_MARK_SEEN",                // per-device read-state for the social badge
]);

export function isSyncable(action: { type: string }): boolean {
  return !SYNC_DENYLIST.has(action.type);
}

function hasSync(t: unknown): t is CommsSyncTransport {
  return !!t && typeof (t as any).sendSync === "function";
}

/** `family:<id>` → `<id>`. The queue/table key off the bare family id. */
function familyIdFromRoom(roomId: string): string {
  return roomId.replace(/^family:/, "");
}

// Persisted dedup set. Capped: we only need to recognise recently-applied ids
// long enough to drop a live/queue duplicate; older ids fall out of the cursor
// window and won't be re-fetched anyway.
const APPLIED_KEY = (familyId: string) => `sync:applied:${familyId}`;
const APPLIED_CAP = 1000;
const DRAIN_MAX_PAGES = 50; // hard stop so a degenerate timestamp cluster can't loop forever

export interface FamilySync {
  /** Broadcast a locally-applied action to peers + the durable queue. */
  broadcast: (action: { type: string }) => void;
}

/**
 * Wires the relay into the store. `rawDispatch` is the bare reducer dispatch
 * (NOT secureDispatch) so applying a remote action doesn't re-broadcast it.
 * `getState` returns the latest AppState for answering snapshot requests.
 */
export function useFamilySync(
  rawDispatch: (action: any) => void,
  getState: () => AppState,
  hydrated: boolean,
  roomId: string | null,
): FamilySync {
  const transportRef = useRef<CommsSyncTransport | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const familyIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const getStateRef = useRef(getState);
  getStateRef.current = getState;

  // Dedup state: an in-memory Set for O(1) lookup + an ordered list for the cap,
  // mirrored to AsyncStorage (debounced) so it survives a restart.
  const appliedRef = useRef<Set<string>>(new Set());
  const appliedOrderRef = useRef<string[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistApplied = () => {
    const fid = familyIdRef.current;
    if (!fid) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(APPLIED_KEY(fid), JSON.stringify(appliedOrderRef.current)).catch(() => {});
    }, 500);
  };

  const markApplied = (id: string) => {
    if (appliedRef.current.has(id)) return;
    appliedRef.current.add(id);
    appliedOrderRef.current.push(id);
    if (appliedOrderRef.current.length > APPLIED_CAP) {
      const dropped = appliedOrderRef.current.splice(0, appliedOrderRef.current.length - APPLIED_CAP);
      for (const d of dropped) appliedRef.current.delete(d);
    }
    persistApplied();
  };

  useEffect(() => {
    // No room = not signed into a family = relay stays fully off.
    if (!SYNC_ENABLED || !hydrated || !roomId) return;

    const familyId = familyIdFromRoom(roomId);
    familyIdRef.current = familyId;

    let cancelled = false;
    let unsub: (() => void) | null = null;
    let unsubPeers: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let tickSub: { remove: () => void } | null = null;

    // A per-session id for this device, used as the queue's origin_peer so we can
    // skip our OWN rows on drain. Independent of Trystero — the Supabase queue
    // must work even when WebRTC/Trystero is unavailable (emulators, locked-down
    // devices). This is the key fix: the durable queue is no longer gated behind
    // the P2P transport loading successfully.
    const self = uid();
    selfIdRef.current = self;

    // Apply a remote action exactly once (dedup by eventId). Frames from older
    // peers without an eventId can't be deduped, so they're applied as-is.
    const applyAction = (eventId: string | undefined, action: any) => {
      if (eventId) {
        if (appliedRef.current.has(eventId)) return;
        markApplied(eventId);
      }
      rawDispatch(action);
    };

    // Walk the queue from `since`, page by page, invoking `onEvent` for each row.
    const walkQueue = async (
      since: string | null,
      onEvent: (e: { id: string; payload: any; origin_peer: string; created_at: string }) => void,
    ): Promise<string | null> => {
      let cursor = since;
      let last = since;
      for (let page = 0; page < DRAIN_MAX_PAGES; page++) {
        const rows = await fetchEvents(familyId, cursor, QUEUE_PAGE_LIMIT);
        if (cancelled || rows.length === 0) break;
        for (const e of rows) { onEvent(e); last = e.created_at; }
        if (rows.length < QUEUE_PAGE_LIMIT) break;
        if (last === cursor) break; // no forward progress (degenerate tie) — stop
        cursor = last;
      }
      return last;
    };

    // Pull events authored by OTHER devices and replay the new ones. Our own
    // rows are skipped (already applied locally) but still advance the cursor.
    let draining = false;
    const drainAndApply = async () => {
      if (draining) return;       // avoid overlapping polls
      draining = true;
      try {
        const start = await getCursor(familyId);
        const last = await walkQueue(start, (e) => {
          if (e.origin_peer === self) markApplied(e.id);
          else applyAction(e.id, e.payload);
        });
        if (!cancelled && last && last !== start) await setCursor(familyId, last);
      } finally {
        draining = false;
      }
    };

    const baselineFromSnapshot = async () => {
      const start = await getCursor(familyId);
      const last = await walkQueue(start, (e) => markApplied(e.id));
      if (!cancelled && last && last !== start) await setCursor(familyId, last);
    };

    (async () => {
      // Load this family's dedup set before we apply anything.
      try {
        const raw = await AsyncStorage.getItem(APPLIED_KEY(familyId));
        const ids: string[] = raw ? JSON.parse(raw) : [];
        appliedOrderRef.current = ids;
        appliedRef.current = new Set(ids);
      } catch {
        appliedOrderRef.current = [];
        appliedRef.current = new Set();
      }

      // ── DURABLE PATH (always on, only needs Supabase) ──────────────────────
      // Drain once now. We poll the queue as a backstop AND subscribe to Supabase
      // Realtime for instant delivery. The poll is ADAPTIVE: a fast 3s cadence
      // until realtime confirms it's connected, then it relaxes to 20s (saving
      // battery/egress). If realtime never connects (e.g. publication not
      // enabled), it stays fast so chat/alarms still arrive within a few seconds.
      const setPoll = (ms: number) => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => { if (!cancelled) void drainAndApply(); }, ms);
      };
      await drainAndApply();
      if (cancelled) return;
      setPoll(3000);

      try {
        realtimeChannel = supabase
          .channel(`sync_events:${familyId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "sync_events", filter: `family_id=eq.${familyId}` },
            () => { if (!cancelled) void drainAndApply(); },
          )
          .subscribe((status) => {
            if (cancelled) return;
            // NOTE: "SUBSCRIBED" only means the channel connected — it does NOT
            // guarantee postgres_changes are delivered (they aren't unless
            // sync_events is in the realtime publication). So keep a brisk
            // backstop poll regardless, bounding cross-device latency to a few
            // seconds even when realtime/P2P silently deliver nothing.
            if (status === "SUBSCRIBED") { void drainAndApply(); setPoll(2500); }
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setPoll(2500); }
          });
      } catch {
        // Realtime unavailable — the fast backstop poll still delivers everything.
      }

      // ── NATIVE HEARTBEAT (keeps delivering when backgrounded / screen off) ──
      // Android pauses the JS setInterval poll once the app isn't in the
      // foreground, so on a device without FCM (e.g. emulators) nothing arrived
      // with the screen off. This OS-thread timer fires regardless and drives
      // the same drain, so alerts/chat/calls land in the background too.
      try {
        startNativeTicker(2500);
        tickSub = addTickListener(() => { if (!cancelled) void drainAndApply(); });
      } catch {}

      // ── OPTIONAL LIVE PATH (Trystero P2P, instant delivery) ────────────────
      // Layered on top. If it fails to load/connect, the polling above still
      // delivers everything — just a few seconds slower.
      const t = createCommsTransport("trystero");
      if (!hasSync(t)) return;
      try {
        await t.connect(roomId, "sync");
      } catch {
        return; // no swarm — durable polling handles it
      }
      if (cancelled) { t.disconnect(); return; }
      transportRef.current = t;

      unsub = t.onSync((env: SyncEnvelope) => {
        if (env.origin === self) return; // ignore our own echo
        if (env.kind === "action" && env.payload) {
          applyAction(env.eventId, env.payload);
        } else if (env.kind === "snapshot" && env.payload) {
          rawDispatch({ type: "@@HYDRATE", payload: env.payload });
          void baselineFromSnapshot();
        } else if (env.kind === "request-snapshot") {
          const s = getStateRef.current();
          if (s.setupDone) {
            t.sendSync({ kind: "snapshot", payload: s, origin: self, seq: ++seqRef.current });
          }
        }
      });

      let lastPeers = 1;
      unsubPeers = t.onPeers((n: number) => {
        if (n > lastPeers) {
          t.sendSync({ kind: "request-snapshot", origin: self, seq: ++seqRef.current });
          void drainAndApply();
        }
        lastPeers = n;
      });
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      try { stopNativeTicker(); } catch {}
      tickSub?.remove();
      if (realtimeChannel) { try { supabase.removeChannel(realtimeChannel); } catch {} realtimeChannel = null; }
      unsub?.();
      unsubPeers?.();
      transportRef.current?.disconnect();
      transportRef.current = null;
      selfIdRef.current = null;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [hydrated, rawDispatch, roomId]);

  return {
    broadcast: (action: { type: string }) => {
      const fid = familyIdRef.current;
      const self = selfIdRef.current;
      // No family or a denylisted secret → don't relay. (No longer requires the
      // P2P transport to be up — the durable queue works regardless.)
      if (!fid || !self || !isSyncable(action)) return;

      const eventId = uuidv4();   // must be a real UUID — sync_events.id is uuid
      // DURABLE: persist for the other device(s) — this is the primary path now.
      void enqueueEvent(fid, eventId, action, self);
      // LIVE: instant delivery to any currently-connected P2P peers (bonus).
      const t = transportRef.current;
      if (t && t.status() === "connected") {
        t.sendSync({ kind: "action", payload: action, origin: self, seq: ++seqRef.current, eventId });
      }
    },
  };
}
