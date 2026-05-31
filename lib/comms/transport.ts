/**
 * Comms transport seam.
 * ----------------------------------------------------------------------------
 * The chat / ping UI talks to this interface instead of any concrete network
 * library, so we can swap the backend without touching screens.
 *
 * Current backend:  LocalLoopbackTransport — an in-process event bus. It does
 *                   NOT cross devices; it only proves the wiring works and lets
 *                   the chat exercise the seam today with zero native deps.
 *
 * Going live (real device-to-device P2P) — the planned path (see project memory):
 *   1. `npx expo install react-native-webrtc` and add its config plugin, then
 *      run a fresh prebuild (this is a NATIVE change → needs a compat spike).
 *   2. `npm i trystero` and implement `TrysteroTransport` below against
 *      `joinRoom` from "trystero" (BitTorrent trackers / Nostr / MQTT for
 *      signaling → direct WebRTC). Add STUN (free) + a TURN relay
 *      (Metered Open Relay) for the ~10-20% of NATs that can't connect directly.
 *   3. For OFFLINE delivery (both peers must be online for pure P2P), add a thin
 *      store-and-forward queue (e.g. Firebase) + push. P2P alone has no offline.
 *
 * Until step 1+2 land, importing "trystero" would break the Metro bundle, so the
 * Trystero adapter is intentionally NOT imported here — only its shape is fixed.
 */

export interface CommsMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  sentAt: string;          // ISO
  recipients?: string[];   // empty/undefined = broadcast to the whole room
}

export type CommsStatus = "disconnected" | "connecting" | "connected";

export interface CommsTransport {
  /** Stable identifier for the backend implementation (telemetry/debug). */
  readonly backend: string;
  /** Current connection state. */
  status(): CommsStatus;
  /** Join a room (e.g. a family id). Resolves once the transport is usable. */
  connect(roomId: string, selfId: string): Promise<void>;
  /** Broadcast / direct-send a message to the room. No-op if disconnected. */
  send(msg: CommsMessage): void;
  /** Subscribe to inbound messages. Returns an unsubscribe function. */
  onMessage(cb: (msg: CommsMessage) => void): () => void;
  /** Subscribe to peer-count changes (presence). Returns an unsubscribe fn. */
  onPeers(cb: (peerCount: number) => void): () => void;
  /** Leave the room and release resources. Safe to call multiple times. */
  disconnect(): void;
}

// ─── Media (calls / video / shared media) ───────────────────────────────────────
// react-native-webrtc's MediaStream — typed loosely here so this file never has
// to import the native lib (which would break the Metro bundle before prebuild).
export type RemoteStream = any;
export type LocalStream = any;

/**
 * Optional media capability layered on top of the chat transport. A backend that
 * supports live audio/video/screen sharing (Trystero/WebRTC) implements this;
 * the loopback backend does not. UI should feature-detect with
 * `"addStream" in transport` before using these.
 */
export interface CommsMediaTransport extends CommsTransport {
  /** The stable peer identity assigned by the backend (e.g. Trystero selfId). */
  readonly selfPeerId: string;
  /** Begin sending a local media stream. Omit `target` to send to all peers. */
  addStream(stream: LocalStream, target?: string | string[]): void;
  /** Stop sending a previously-added local stream. */
  removeStream(stream: LocalStream, target?: string | string[]): void;
  /** Subscribe to inbound media streams from peers. Returns an unsubscribe fn. */
  onPeerStream(cb: (stream: RemoteStream, peerId: string) => void): () => void;
}

// ─── Local in-process transport ───────────────────────────────────────────────
// Shared module-level buses keyed by room, so multiple transports in the same JS
// runtime (e.g. different screens) can exchange messages. Across real devices
// this does nothing — that's what the Trystero backend is for.

type Bus = {
  msgListeners: Set<(m: CommsMessage) => void>;
  members: Set<string>;
  peerListeners: Set<(n: number) => void>;
};

const rooms = new Map<string, Bus>();

function getBus(roomId: string): Bus {
  let bus = rooms.get(roomId);
  if (!bus) {
    bus = { msgListeners: new Set(), members: new Set(), peerListeners: new Set() };
    rooms.set(roomId, bus);
  }
  return bus;
}

export class LocalLoopbackTransport implements CommsTransport {
  readonly backend = "local-loopback";
  private state: CommsStatus = "disconnected";
  private roomId: string | null = null;
  private selfId: string | null = null;
  private msgCbs = new Set<(m: CommsMessage) => void>();
  private peerCbs = new Set<(n: number) => void>();

  status() { return this.state; }

  async connect(roomId: string, selfId: string): Promise<void> {
    this.disconnect();
    this.state = "connecting";
    this.roomId = roomId;
    this.selfId = selfId;
    const bus = getBus(roomId);
    bus.msgListeners.add(this.deliver);
    bus.peerListeners.add(this.notifyPeers);
    bus.members.add(selfId);
    this.state = "connected";
    // Announce presence to everyone in the room.
    bus.peerListeners.forEach(cb => cb(bus.members.size));
  }

  send(msg: CommsMessage): void {
    if (this.state !== "connected" || !this.roomId) return;
    const bus = getBus(this.roomId);
    // Deliver to every listener EXCEPT our own (we already have the message
    // locally) — mirrors how a real peer transport echoes only remote peers.
    bus.msgListeners.forEach(cb => { if (cb !== this.deliver) cb(msg); });
  }

  onMessage(cb: (m: CommsMessage) => void): () => void {
    this.msgCbs.add(cb);
    return () => this.msgCbs.delete(cb);
  }

  onPeers(cb: (n: number) => void): () => void {
    this.peerCbs.add(cb);
    return () => this.peerCbs.delete(cb);
  }

  disconnect(): void {
    if (this.roomId) {
      const bus = getBus(this.roomId);
      bus.msgListeners.delete(this.deliver);
      bus.peerListeners.delete(this.notifyPeers);
      if (this.selfId) bus.members.delete(this.selfId);
      bus.peerListeners.forEach(cb => cb(bus.members.size));
    }
    this.state = "disconnected";
    this.roomId = null;
    this.selfId = null;
    this.msgCbs.clear();
    this.peerCbs.clear();
  }

  // Bound so identity is stable for add/delete on the shared bus.
  private deliver = (m: CommsMessage) => { this.msgCbs.forEach(cb => cb(m)); };
  private notifyPeers = (n: number) => { this.peerCbs.forEach(cb => cb(n)); };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export type CommsBackend = "local" | "trystero";

/**
 * Returns a transport for the requested backend. Defaults to the local loopback.
 *
 * The real Trystero adapter is written and ready in `./trystero-transport`, but
 * it is intentionally NOT imported here yet: it imports "trystero" and
 * "react-native-webrtc", which would break the Metro bundle until those deps are
 * installed + a prebuild has run. To go live (deferred build task), do exactly:
 *
 *   1. Install deps + add the @config-plugins/react-native-webrtc plugin to
 *      app.json, then `npx expo prebuild`.
 *   2. Import the polyfills once at the very top of app/_layout.tsx:
 *          import "../lib/comms/trystero-polyfills";
 *   3. Replace the `case "trystero"` body below with:
 *          const { TrysteroTransport } = require("./trystero-transport");
 *          return new TrysteroTransport();
 *
 * Until then, "trystero" safely falls back to the loopback so the app keeps
 * building and the chat UI keeps working in-process.
 */
export function createCommsTransport(backend: CommsBackend = "local"): CommsTransport {
  switch (backend) {
    case "trystero":
      try {
        // Lazy require so the native deps are only pulled in when actually
        // requested (and so a bundling issue degrades to loopback, not a crash).
        const { TrysteroTransport } = require("./trystero-transport");
        return new TrysteroTransport();
      } catch (e) {
        console.warn("[comms] Trystero unavailable, falling back to loopback:", e);
        return new LocalLoopbackTransport();
      }
    case "local":
    default:
      return new LocalLoopbackTransport();
  }
}
