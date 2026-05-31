export type SessionRole = "host" | "viewer";
export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface RemoteSession {
  sessionId: string;
  role: SessionRole;
  state: ConnectionState;
  peerDeviceName?: string;
  startedAt?: string;
  latencyMs?: number;
}

export interface TouchEvent {
  type: "down" | "move" | "up";
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  pointerId?: number;
}

export interface RemoteCommand {
  type: "touch" | "key" | "scroll" | "home" | "back" | "recents" | "volume_up" | "volume_down" | "screenshot";
  touch?: TouchEvent;
  keyCode?: number;
  scrollDeltaX?: number;
  scrollDeltaY?: number;
}

export interface FrameInfo {
  width: number;
  height: number;
  fps: number;
  quality: number; // JPEG quality 0-100
  bitrateKbps: number;
}
