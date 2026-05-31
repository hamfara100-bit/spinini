/**
 * TrysteroTransport — real device-to-device P2P backend for the comms seam.
 * ----------------------------------------------------------------------------
 * Implements CommsMediaTransport (chat + calls + video + media) on top of
 * Trystero, which does serverless WebRTC matchmaking over public BitTorrent
 * trackers (the default `joinRoom` strategy). No backend of our own is needed
 * for live sessions; both peers must be online at the same time (P2P has no
 * offline delivery — that's the separate store-and-forward task).
 *
 * IMPORTANT ordering: `./trystero-polyfills` is imported FIRST (side-effect)
 * so crypto.subtle / getRandomValues / WebRTC globals exist before the
 * `trystero` and `react-native-webrtc` modules are evaluated.
 *
 * The external imports below resolve only AFTER the deps are installed (see the
 * deferred build task) and are @ts-ignore'd so `tsc` stays green until then.
 * Nothing in the live bundle imports this file yet; the factory in transport.ts
 * is flipped to use it as the final wiring step, post-install.
 */

import "./trystero-polyfills";

// @ts-ignore — installed at the build step. Default export = BitTorrent strategy.
import { joinRoom, selfId } from "trystero";
// @ts-ignore — installed at the build step
import { RTCPeerConnection } from "react-native-webrtc";

import type {
  CommsMediaTransport, CommsMessage, CommsStatus, RemoteStream, LocalStream,
} from "./transport";

/** Namespaces the Trystero swarm so we never collide with other apps' rooms. */
const APP_ID = "famkids-comms-v1";

/**
 * ICE servers: a free public STUN for the common case, plus Metered's Open Relay
 * TURN for the ~10–20% of NATs that can't connect peer-to-peer directly. Watch
 * Open Relay's free-tier monthly bandwidth cap — sustained video relay may need
 * a paid tier or a self-hosted coturn later.
 */
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80",  username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

type Room = any;
type SendFn = (data: any, targets?: string | string[]) => void;

export class TrysteroTransport implements CommsMediaTransport {
  readonly backend = "trystero";
  readonly selfPeerId = selfId as string;

  private state: CommsStatus = "disconnected";
  private room: Room = null;
  private sendMsg: SendFn | null = null;

  private msgCbs    = new Set<(m: CommsMessage) => void>();
  private peerCbs   = new Set<(n: number) => void>();
  private streamCbs = new Set<(s: RemoteStream, peerId: string) => void>();
  private peers     = new Set<string>();

  status() { return this.state; }

  async connect(roomId: string, _selfId: string): Promise<void> {
    // _selfId is the app-level author id; Trystero assigns its own selfPeerId.
    this.disconnect();
    this.state = "connecting";

    this.room = joinRoom(
      // rtcPolyfill cast: react-native-webrtc's RTCPeerConnection is runtime-
      // compatible but doesn't declare the static generateCertificate the DOM
      // type requires. Safe — Trystero never calls it.
      { appId: APP_ID, rtcConfig: RTC_CONFIG, rtcPolyfill: RTCPeerConnection as any },
      roomId,
    );

    // Chat channel. Trystero v0.25's makeAction returns an OBJECT
    // ({ send(data, opts), set onMessage(handler), ... }) — NOT the old
    // [send, get] tuple. send(data) broadcasts; send(data, { target }) targets.
    const msgAction = this.room.makeAction("msg");
    this.sendMsg = (data: any, target?: string | string[]) => {
      const p = target !== undefined ? msgAction.send(data, { target }) : msgAction.send(data);
      // send() is async and may reject if no peers / mid-handshake — don't crash.
      p?.catch?.(() => {});
    };
    // onMessage is a setter; handler is (payload, metadata) with metadata.peerId.
    msgAction.onMessage = (data: any) => {
      this.msgCbs.forEach(cb => cb(data as CommsMessage));
    };

    // Presence — onPeerJoin/onPeerLeave are SETTERS in v0.25, not methods.
    this.room.onPeerJoin  = (peerId: string) => { this.peers.add(peerId);    this.emitPeers(); };
    this.room.onPeerLeave = (peerId: string) => { this.peers.delete(peerId); this.emitPeers(); };

    // Inbound media (calls / video) — onPeerStream is also a setter now.
    this.room.onPeerStream = (stream: RemoteStream, peerId: string) => {
      this.streamCbs.forEach(cb => cb(stream, peerId));
    };

    this.state = "connected";
    this.emitPeers();
  }

  send(msg: CommsMessage): void {
    if (this.state !== "connected" || !this.sendMsg) return;
    // Broadcast to the whole room. NOTE: msg.recipients holds APP-level author ids
    // (e.g. "__parent__"), which do NOT map to Trystero peer ids, so we can't use
    // them for transport-level targeting — recipient filtering stays an app concern.
    this.sendMsg(msg);
  }

  onMessage(cb: (m: CommsMessage) => void): () => void {
    this.msgCbs.add(cb);
    return () => this.msgCbs.delete(cb);
  }

  onPeers(cb: (n: number) => void): () => void {
    this.peerCbs.add(cb);
    return () => this.peerCbs.delete(cb);
  }

  // ─── Media ────────────────────────────────────────────────────────────────
  addStream(stream: LocalStream, target?: string | string[]): void {
    // v0.25: addStream(stream, { target }) — options object, not positional.
    this.room?.addStream(stream, target !== undefined ? { target } : {});
  }

  removeStream(stream: LocalStream, target?: string | string[]): void {
    this.room?.removeStream(stream, target !== undefined ? { target } : {});
  }

  onPeerStream(cb: (stream: RemoteStream, peerId: string) => void): () => void {
    this.streamCbs.add(cb);
    return () => this.streamCbs.delete(cb);
  }

  disconnect(): void {
    try { this.room?.leave(); } catch { /* leave() is best-effort */ }
    this.room = null;
    this.sendMsg = null;
    this.peers.clear();
    this.msgCbs.clear();
    this.peerCbs.clear();
    this.streamCbs.clear();
    this.state = "disconnected";
  }

  // Peer count INCLUDES self, matching LocalLoopbackTransport semantics so the
  // chat UI's `peerCount > 1` "live" check works unchanged across backends.
  private emitPeers() {
    const n = this.peers.size + 1;
    this.peerCbs.forEach(cb => cb(n));
  }
}
