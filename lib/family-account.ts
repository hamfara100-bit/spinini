/**
 * Family account API — thin wrapper over the Supabase client.
 * ----------------------------------------------------------------------------
 * The UI calls these instead of touching `supabase` directly. Auth uses
 * username/password; since Supabase Auth is email-based, a username is mapped to
 * a synthetic email (`<username>@famkids.app`) so the user only ever types a
 * username. `.app` is a real TLD so Supabase's email validator accepts it
 * (`.local` is rejected as invalid). Email confirmation MUST be OFF in the
 * Supabase dashboard — these inboxes don't exist. Passwords are hashed/stored by
 * Supabase, never by us.
 */

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "./supabase";

export type MemberRole = "parent" | "kid";

export interface Membership {
  userId: string;
  familyId: string;
  role: MemberRole;
  displayName: string;
  age: number | null;
}

/** Map a plain username to the synthetic email Supabase Auth stores it under. */
function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@famkids.app`;
}

export async function signUp(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw new Error(error.message);
}

export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw new Error(error.message);
}

/**
 * Sign in (or sign up) with Google, routed entirely through Supabase Auth — no
 * Google client IDs live in the app. Identity only: a Google user becomes a
 * normal `auth.users` row and creates / joins a family exactly like a
 * username/password user.
 *
 * Native PKCE flow: ask Supabase for the provider URL, open it in the system
 * auth browser, and when Google redirects back to our `famkids://` scheme,
 * exchange the returned `?code` for a session. Returns false if the user
 * cancels/dismisses the browser.
 *
 * SETUP (one-time, dashboard): in Supabase → Authentication → Providers, enable
 * Google with a Google Cloud "Web" OAuth client whose redirect URI is
 * `https://<project-ref>.supabase.co/auth/v1/callback`; and in Authentication →
 * URL Configuration → Redirect URLs, allow `famkids://*`.
 *
 * NOTE: this is login only. It does NOT grant Drive/Photos scopes — that backup
 * flow stays on the dedicated expo-auth-session path (components/google-sign-in
 * + lib/google-auth), which keeps the Google access token Supabase doesn't
 * persist.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = makeRedirectUri({ scheme: "famkids", path: "auth-callback" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error("Could not start Google sign-in.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false; // cancelled / dismissed

  const { queryParams } = Linking.parse(result.url);
  const errDesc = queryParams?.error_description;
  if (errDesc) throw new Error(String(errDesc));
  const code = queryParams?.code;
  if (typeof code !== "string") throw new Error("No authorization code returned from Google.");

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw new Error(exchangeError.message);
  return true;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** The current user's membership, or null if signed out / not yet in a family. */
export async function getMembership(): Promise<Membership | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("members")
    .select("user_id, family_id, role, display_name, age")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    userId: data.user_id,
    familyId: data.family_id,
    role: data.role as MemberRole,
    displayName: data.display_name,
    age: data.age,
  };
}

/** Everyone in the caller's family (RLS limits this to your own family). */
export async function listMembers(): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("members")
    .select("user_id, family_id, role, display_name, age")
    .order("role");
  if (error || !data) return [];
  return data.map((d: any) => ({
    userId: d.user_id,
    familyId: d.family_id,
    role: d.role as MemberRole,
    displayName: d.display_name,
    age: d.age,
  }));
}

/** Parent: create the family hub. Returns the new family id. */
export async function createFamily(familyName: string, parentDisplayName: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_family", {
    p_name: familyName,
    p_display_name: parentDisplayName,
  });
  if (error) throw new Error(error.message);
  // Nudge listeners (the store's sync-room watcher) to recompute now that a
  // family exists, so the per-family P2P room wires up without an app restart.
  await supabase.auth.refreshSession();
  return data as string;
}

/** Parent: mint a short invite code for a kid (or co-parent). */
export async function createPairing(role: MemberRole = "kid", ttlMinutes = 30): Promise<string> {
  const { data, error } = await supabase.rpc("create_pairing", {
    p_role: role,
    p_ttl_minutes: ttlMinutes,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Kid / co-parent: redeem a code to join a family. Returns the family id. */
export async function redeemPairing(code: string, displayName: string, age?: number): Promise<string> {
  const { data, error } = await supabase.rpc("redeem_pairing", {
    p_code: code,
    p_display_name: displayName,
    p_age: age ?? null,
  });
  if (error) throw new Error(error.message);
  // Nudge the store's sync-room watcher to recompute now that this device has
  // joined a family, so the per-family P2P room wires up without an app restart.
  await supabase.auth.refreshSession();
  return data as string;
}

/** The P2P sync room derived from family membership — replaces the global room. */
export function familyRoomId(familyId: string): string {
  return `family:${familyId}`;
}
