// Supabase Edge Function: send-push
// Sends an FCM HTTP v1 push to a family member's device(s).
//
// Deploy:
//   supabase functions deploy send-push
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
//
// The service account JSON comes from Firebase console → Project settings →
// Service accounts → Generate new private key (it has client_email, private_key,
// project_id). FCM_SERVICE_ACCOUNT must hold that whole JSON string.
//
// Request body: { familyId, targetOwnerId?, targetRole?, title, body, data? }
//   - targetOwnerId: "parent" or a kid profile id (exact device)
//   - targetRole:    "parent" | "kid" (all devices of that role in the family)
// The caller's JWT (forwarded automatically by supabase.functions.invoke) scopes
// token lookup to the caller's own family via RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// Mint a short-lived Google OAuth2 access token from the service account.
async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claim = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("oauth: " + JSON.stringify(json));
  return json.access_token;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) return new Response(JSON.stringify({ error: "FCM_SERVICE_ACCOUNT not set" }), { status: 500 });
    const sa = JSON.parse(saRaw);

    const { familyId, targetOwnerId, targetRole, targetAllExcept, title, body, data } = await req.json();
    if (!familyId || (!targetOwnerId && !targetRole && !targetAllExcept)) {
      return new Response(JSON.stringify({ error: "familyId and a target required" }), { status: 400 });
    }

    // Look up recipient tokens with the CALLER's JWT so RLS limits it to their family.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    let q = supabase.from("device_push_tokens").select("token, owner_id, role").eq("family_id", familyId);
    if (targetOwnerId) q = q.eq("owner_id", targetOwnerId);
    else if (targetRole) q = q.eq("role", targetRole);
    else if (targetAllExcept) q = q.neq("owner_id", targetAllExcept);
    const { data: rows, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    const tokens: string[] = [...new Set((rows ?? []).map((r: any) => r.token))];
    if (tokens.length === 0) return new Response(JSON.stringify({ sent: 0, reason: "no tokens" }), { status: 200 });

    const accessToken = await getAccessToken(sa);
    const projectId = sa.project_id;

    // Stringify data values (FCM data must be string→string).
    const dataStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(data ?? {})) dataStr[k] = typeof v === "string" ? v : JSON.stringify(v);

    let sent = 0;
    const results: any[] = [];
    for (const token of tokens) {
      const message = {
        message: {
          token,
          notification: { title: title ?? "Spinini", body: body ?? "" },
          data: dataStr,
          android: { priority: "HIGH", notification: { channel_id: "spinini-alerts-v1", sound: "spinini_notify", default_sound: false } },
        },
      };
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (r.ok) sent++;
      else results.push({ token: token.slice(0, 8), status: r.status, body: await r.text() });
    }

    return new Response(JSON.stringify({ sent, total: tokens.length, errors: results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
