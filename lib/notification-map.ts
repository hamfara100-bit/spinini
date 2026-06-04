/**
 * notification-map.ts — maps an applied (remote) action to the local
 * notification THIS device should show, if any. Used by the sync drain to fire
 * notifications imperatively when the app is backgrounded (React notifier
 * components don't reliably flush their effects in the background, but the drain
 * runs on every native tick — confirmed via logcat).
 *
 * Returns null when this device shouldn't be notified for the action (e.g. it's
 * the author, or the action targets a different family member).
 */
import type { AppState } from "./data/types";

export interface LocalNote { title: string; body: string; data?: Record<string, any>; dedupId?: string }

// Ids the sync drain has already shown a notification for (while backgrounded).
// The React notifier components check this so they don't re-fire the same item
// when the app returns to the foreground.
const locallyNotified = new Set<string>();
const locallyNotifiedOrder: string[] = [];
export function markLocallyNotified(id?: string) {
  if (!id || locallyNotified.has(id)) return;
  locallyNotified.add(id);
  locallyNotifiedOrder.push(id);
  if (locallyNotifiedOrder.length > 300) {
    const drop = locallyNotifiedOrder.splice(0, locallyNotifiedOrder.length - 300);
    for (const d of drop) locallyNotified.delete(d);
  }
}
export function wasLocallyNotified(id?: string): boolean {
  return !!id && locallyNotified.has(id);
}

export function localNotificationFor(action: any, state: AppState): LocalNote | null {
  const isKid = state.deviceRole === "kid";
  const myKidId = isKid ? (state.kids?.[0]?.profile?.id ?? null) : null;
  const isParent = !isKid;

  switch (action?.type) {
    case "FAMILY_CHAT_PUSH": {
      const m = action.message;
      if (!m) return null;
      const meChat = isKid ? myKidId : "__parent__";
      if (m.authorId === meChat) return null; // my own message
      const preview = m.text || (m.imageUri ? "📷 Photo" : m.audioUri ? "🎤 Voice message" : m.sticker ? `${m.sticker} sticker` : "New message");
      return { title: `💬 ${m.authorName}`, body: preview, data: { route: "communicate" }, dedupId: m.id };
    }
    case "NOTIFICATION_ADD": {
      if (!isKid || action.kidId !== myKidId) return null; // only the target kid
      const n = action.notification;
      return { title: `${n.emoji ?? "🔔"} ${n.title}`, body: n.body || "", data: { route: n.route }, dedupId: n.id };
    }
    case "CALL_REQUEST": {
      const c = action.call;
      // A kid-initiated call rings the parent. (Parent→kid calls ride
      // NOTIFICATION_ADD, handled above.)
      return isParent && c ? { title: `📞 Incoming ${c.callType === "video" ? "video " : ""}call`, body: `${c.kidName} is calling — tap to answer`, data: { route: "communicate" } } : null;
    }
    case "SOS_ALERT":
      return isParent ? { title: `🚨 SOS from ${action.alert?.kidName ?? "your child"}!`, body: action.alert?.lat ? "Location attached — open SOS." : "Check on your child now!", data: { kind: "sos" } } : null;
    case "BADWORD_ALERT_ADD":
      return isParent ? { title: `🚨 Bad word (${action.alert?.appName ?? "an app"})`, body: `"${action.alert?.word}" — ${action.alert?.text || action.alert?.title || ""}`, data: { kind: "badword" } } : null;
    case "TAMPER_ALERT_ADD":
      return isParent ? { title: "⚠️ Protection turned off", body: `${action.alert?.label} disabled on ${action.alert?.kidName ?? "a child"}'s phone`, data: { kind: "tamper" } } : null;
    case "OGAME_INVITE": {
      const inv = action.invite;
      const meId = isKid ? myKidId : "parent";
      return inv && inv.toId === meId ? { title: "🎮 Game Night invite!", body: `${inv.fromName} wants to play ${inv.gameName}`, data: { kind: "game_invite" } } : null;
    }
    case "SET_INSTANT_LOCK":
      if (!action.locked) return null;
      return (isKid && action.kidId === myKidId) ? { title: "🔒 Device Locked", body: action.message || "Your device is locked", data: { kind: "lock" } } : null;
    default:
      return null;
  }
}
