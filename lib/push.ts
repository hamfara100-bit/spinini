/**
 * push.ts — thin FCM push layer (self-hosted FCM v1 via the `send-push` Edge
 * Function). Makes pings / locks / SOS / invites / bad-word + tamper alarms
 * reach a fully-closed app, which the foreground-service approach can't.
 *
 * SETUP (one-time, by the project owner):
 *   1. Create a Firebase project for com.famkids.app; add the Android app and
 *      drop google-services.json into android/app/ (+ the google-services gradle
 *      plugin). Rebuild.
 *   2. supabase/push_tokens.sql → run in the Supabase SQL editor.
 *   3. Deploy the function:  supabase functions deploy send-push
 *      Set the secret:       supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
 *
 * Everything here no-ops gracefully until that's done, so the app never breaks.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";
import { getMembership } from "./family-account";

export type PushRole = "parent" | "kid";

let lastRegisteredToken: string | null = null;
let cachedFamilyId: string | null = null;

async function familyId(): Promise<string | null> {
  if (cachedFamilyId) return cachedFamilyId;
  const m = await getMembership();
  cachedFamilyId = m?.familyId ?? null;
  return cachedFamilyId;
}

/**
 * Register THIS device's FCM token against the signed-in family member so others
 * can target it. `ownerId` is the app-level id ("parent" or a kid profile id).
 */
export async function registerForPush(ownerId: string, role: PushRole): Promise<void> {
  try {
    if (Platform.OS !== "android") return; // FCM path is Android-only for now
    const membership = await getMembership();
    if (!membership?.familyId) return;

    // CHECK only — don't prompt on every launch (the pairing flow already asks).
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;

    const tok = await Notifications.getDevicePushTokenAsync(); // FCM registration token
    const token = typeof tok?.data === "string" ? tok.data : null;
    if (!token) return;
    if (token === lastRegisteredToken) return; // already up to date this session

    cachedFamilyId = membership.familyId;
    const { error } = await supabase.rpc("register_push_token", {
      p_family_id: membership.familyId,
      p_owner_id: ownerId,
      p_role: role,
      p_token: token,
      p_platform: "android",
    });
    if (!error) lastRegisteredToken = token;
  } catch {
    // No Firebase config / not signed in / offline → silently skip.
  }
}

export interface PushTarget {
  /** Exact device by app-level id ("parent" or a kid profile id). */
  targetOwnerId?: string;
  /** All devices of a role in the family. */
  targetRole?: PushRole;
  /** Everyone in the family EXCEPT this owner id (e.g. group chat — not the sender). */
  targetAllExcept?: string;
}

/**
 * Send a push to a family member. Safe to call from anywhere — if push isn't set
 * up / the user isn't signed in, it just resolves without doing anything.
 */
export async function sendPush(
  target: PushTarget,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  try {
    const fid = await familyId();
    if (!fid) return;
    await supabase.functions.invoke("send-push", {
      body: {
        familyId: fid,
        targetOwnerId: target.targetOwnerId,
        targetRole: target.targetRole,
        targetAllExcept: target.targetAllExcept,
        title,
        body,
        data: data ?? {},
      },
    });
  } catch {
    // best-effort — local notifications / sync still deliver in-app.
  }
}
