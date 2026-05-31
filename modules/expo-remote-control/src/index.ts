import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import type {
  RemoteSession,
  RemoteCommand,
  FrameInfo,
  ConnectionState,
} from "./types";

const { RemoteControlModule } = NativeModules;

// Build a NativeEventEmitter only when the native module is actually present.
// In Expo Go or on web, RemoteControlModule is undefined, so we skip creation.
const emitter: NativeEventEmitter | null =
  RemoteControlModule ? new NativeEventEmitter(RemoteControlModule) : null;

// ---------------------------------------------------------------------------
// Host (kid's device) API
// ---------------------------------------------------------------------------

/**
 * Start screen capture on the host (kid's) device and begin streaming frames
 * over the built-in WebSocket server on port 9876.
 *
 * @param sessionId  Unique string identifying this session.
 * @param frameInfo  Capture resolution, FPS and JPEG quality settings.
 * @returns          true on success, false when native module is unavailable.
 */
export function startHostSession(
  sessionId: string,
  frameInfo: FrameInfo
): Promise<boolean> {
  if (RemoteControlModule) {
    return RemoteControlModule.startHostSession(
      sessionId,
      JSON.stringify(frameInfo)
    );
  }
  return Promise.resolve(false);
}

/**
 * Stop screen capture and shut down the WebSocket server on the host device.
 */
export function stopHostSession(): Promise<void> {
  if (RemoteControlModule) {
    return RemoteControlModule.stopHostSession();
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Viewer (parent's device) API
// ---------------------------------------------------------------------------

/**
 * Connect the viewer (parent) device to a running host session.
 *
 * @param sessionId  Must match the sessionId used on the host.
 * @param serverUrl  IP or hostname of the host device (port 9876 is fixed).
 * @returns          true on success.
 */
export function startViewerSession(
  sessionId: string,
  serverUrl: string
): Promise<boolean> {
  if (RemoteControlModule) {
    return RemoteControlModule.startViewerSession(sessionId, serverUrl);
  }
  return Promise.resolve(false);
}

/**
 * Disconnect the viewer and close the WebSocket connection.
 */
export function stopViewerSession(): Promise<void> {
  if (RemoteControlModule) {
    return RemoteControlModule.stopViewerSession();
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Command delivery
// ---------------------------------------------------------------------------

/**
 * Send a remote command (touch, key, scroll, system action) from the viewer
 * to the host device over the established WebSocket connection.
 */
export function sendCommand(command: RemoteCommand): Promise<void> {
  if (RemoteControlModule) {
    return RemoteControlModule.sendCommand(JSON.stringify(command));
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Session info & quality control
// ---------------------------------------------------------------------------

/**
 * Return the current session state, role, and optional latency information.
 */
export function getSessionInfo(): Promise<RemoteSession> {
  if (RemoteControlModule) {
    return RemoteControlModule.getSessionInfo();
  }
  return Promise.resolve({
    sessionId: "",
    role: "viewer",
    state: "idle",
  });
}

/**
 * Dynamically adjust JPEG compression quality and capture frame-rate.
 *
 * @param quality  JPEG quality 0-100 (higher = better image, more bandwidth).
 * @param fps      Target frames per second for capture.
 */
export function setFrameQuality(quality: number, fps: number): Promise<void> {
  if (RemoteControlModule) {
    return RemoteControlModule.setFrameQuality(quality, fps);
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Android MediaProjection permission
// ---------------------------------------------------------------------------

/**
 * Trigger the Android MediaProjection permission dialog so the user can grant
 * screen capture access.  Must be called before `startHostSession` on Android.
 *
 * @returns true when the user grants permission, false when denied or on iOS.
 */
export function requestScreenCapturePermission(): Promise<boolean> {
  if (Platform.OS === "android" && RemoteControlModule) {
    return RemoteControlModule.requestScreenCapturePermission();
  }
  // iOS permission is requested implicitly by RPScreenRecorder; no explicit
  // call is required from JS.
  return Promise.resolve(Platform.OS === "ios");
}

/**
 * Check whether screen capture is supported on this device / OS version.
 * Android requires API 21+; iOS requires iOS 11+.
 */
export function isScreenCaptureAvailable(): Promise<boolean> {
  if (RemoteControlModule) {
    return RemoteControlModule.isScreenCaptureAvailable();
  }
  return Promise.resolve(false);
}

// ---------------------------------------------------------------------------
// Event subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribe to incoming video frames on the **viewer** side.
 * The callback receives a base-64 encoded JPEG string for each frame.
 *
 * @returns An unsubscribe function — call it to stop receiving frames.
 */
export function onFrame(callback: (base64Jpeg: string) => void): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener("RCFrame", (event: { data: string }) => {
    callback(event.data);
  });
  return () => subscription.remove();
}

/**
 * Subscribe to commands received on the **host** (kid's) device.
 * Commands are forwarded from the viewer and can include touch, key, and
 * system-action events.
 *
 * @returns An unsubscribe function.
 */
export function onCommandReceived(
  callback: (cmd: RemoteCommand) => void
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener("RCCommand", (event: RemoteCommand) => {
    callback(event);
  });
  return () => subscription.remove();
}

/**
 * Subscribe to WebSocket connection-state changes.
 * States: "idle" | "connecting" | "connected" | "disconnected" | "error".
 *
 * @returns An unsubscribe function.
 */
export function onSessionStateChanged(
  callback: (state: ConnectionState) => void
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener(
    "RCState",
    (event: { state: ConnectionState }) => {
      callback(event.state);
    }
  );
  return () => subscription.remove();
}
