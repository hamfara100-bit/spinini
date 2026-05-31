/**
 * Hermes WebCrypto + WebRTC polyfill bootstrap for Trystero.
 * ----------------------------------------------------------------------------
 * MUST be imported exactly once, as early as possible (top of app/_layout.tsx),
 * BEFORE any code path calls joinRoom(). Trystero reads crypto.subtle at the
 * moment a room is joined, so the globals must exist by then.
 *
 * WHY this file exists (the spike's core finding):
 *   RN 0.81's Hermes engine ships NEITHER crypto.getRandomValues NOR
 *   crypto.subtle. Trystero ALWAYS derives an AES-GCM key from appId+roomId to
 *   encrypt the SDP during signaling — even for password-less rooms — so
 *   crypto.subtle is required, not optional. Without these polyfills, joinRoom()
 *   throws immediately on this device.
 *
 * STRATEGY (per product decision — pure-JS first, no extra NATIVE crypto module):
 *   • crypto.getRandomValues  ← react-native-get-random-values   (sync, native-backed entropy)
 *   • crypto.subtle           ← isomorphic-webcrypto             (msrCrypto under Hermes, pure JS)
 *   • TextEncoder/TextDecoder ← text-encoding                    (only if Hermes lacks them)
 *   • RTCPeerConnection etc.  ← react-native-webrtc registerGlobals()
 *
 * KNOWN RISK to validate at build time:
 *   isomorphic-webcrypto's subtle is pure-JS (slower than native) and seeds its
 *   RNG asynchronously via ensureSecure(). If it proves too slow or flaky in
 *   practice, swap the `crypto.subtle` source below for react-native-quick-crypto
 *   (native JSI) — that is the only line that needs to change.
 *
 * NOTE: the imports below resolve only AFTER the deps are installed (see the
 * deferred build task). They are @ts-ignore'd so `tsc` stays green until then,
 * and nothing in the live bundle imports this file yet.
 */

// @ts-ignore — installed at the build step; polyfills global.crypto.getRandomValues on import
import "react-native-get-random-values";
// @ts-ignore — installed at the build step
import isoCrypto from "isomorphic-webcrypto";
// @ts-ignore — installed at the build step
import { TextEncoder as TE, TextDecoder as TD } from "text-encoding";
// @ts-ignore — installed at the build step
import { registerGlobals } from "react-native-webrtc";

const g: any = globalThis as any;

// ─── crypto.subtle (the actual blocker) ────────────────────────────────────────
if (!g.crypto) g.crypto = {};
if (!g.crypto.subtle && isoCrypto?.subtle) {
  g.crypto.subtle = isoCrypto.subtle;
}
// msrCrypto seeds its RNG lazily; kick it off best-effort so the first
// joinRoom() isn't racing the seed. getRandomValues itself is already provided
// synchronously by react-native-get-random-values above.
isoCrypto?.ensureSecure?.().catch(() => {});

// ─── TextEncoder / TextDecoder ──────────────────────────────────────────────────
// Hermes added partial support in recent RN; only polyfill if genuinely missing.
if (typeof g.TextEncoder === "undefined") g.TextEncoder = TE;
if (typeof g.TextDecoder === "undefined") g.TextDecoder = TD;

// ─── Global addEventListener / removeEventListener (the "beforeunload" blocker) ──
// Trystero's room.ts unconditionally calls the BARE GLOBAL addEventListener(
// "beforeunload", …) when the first room is created (it is NOT behind its
// isBrowser guard, unlike the "online"/"offline" listeners). Hermes has no global
// addEventListener, so joinRoom() throws "Property 'addEventListener' doesn't
// exist" before any networking starts. "beforeunload" never fires in React Native
// (we clean rooms up explicitly via leave()/disconnect()), so no-ops are correct.
if (typeof g.addEventListener === "undefined") g.addEventListener = () => {};
if (typeof g.removeEventListener === "undefined") g.removeEventListener = () => {};

// ─── WebRTC globals ─────────────────────────────────────────────────────────────
// Sets up RTCPeerConnection, RTCSessionDescription, MediaStream, and
// navigator.mediaDevices.getUserMedia on the global scope. Trystero can then use
// them; we also pass RTCPeerConnection explicitly via `rtcPolyfill` in the
// transport for belt-and-suspenders.
try {
  registerGlobals?.();
} catch {
  // registerGlobals throws on non-RN runtimes (e.g. web preview) — safe to skip.
}

export {};
