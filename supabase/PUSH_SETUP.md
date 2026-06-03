# Push notifications (self-hosted FCM v1)

This makes pings / locks / SOS / game invites / bad-word + tamper alarms reach a
**fully-closed** app — which the foreground-service + sync approach can't.

The app code is already wired and ships inert: it no-ops until you complete the
3 setup steps below, so nothing breaks in the meantime.

## 1. Firebase project (gives the app an FCM identity)

1. Firebase console → **Add project** (or reuse one) for `com.famkids.app`.
2. **Add app → Android**, package name `com.famkids.app`, download
   **`google-services.json`** and place it at `android/app/google-services.json`.
3. Ensure the Google Services Gradle plugin is applied (Expo's `expo-notifications`
   config plugin + a prebuild normally do this; if building `android/` directly,
   add `classpath 'com.google.gms:google-services:4.4.2'` to `android/build.gradle`
   and `apply plugin: 'com.google.gms.google-services'` at the bottom of
   `android/app/build.gradle`).
4. Rebuild the APK. Devices now obtain an FCM token on launch
   (`registerForPush` in `lib/push.ts`).

> Emulators without Google Play Services can't get an FCM token — test on a real
> device (e.g. the Samsung S25).

## 2. Database — token table

Run **`supabase/push_tokens.sql`** in the Supabase SQL editor (after `schema.sql`).
It creates `device_push_tokens` + RLS + the `register_push_token()` RPC.

## 3. Edge Function — the sender

The function mints a Google OAuth token from a **service account** and calls
FCM HTTP v1.

1. Firebase console → Project settings → **Service accounts** →
   **Generate new private key** → downloads `service-account.json`.
2. Deploy + set the secret:
   ```bash
   supabase functions deploy send-push
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```

That's it. `sendPush()` (already called from SOS, lock, ping, game invite,
bad-word and tamper) will now deliver to closed apps.

## How targeting works
- Each device registers `{ family_id, owner_id, role, token }` where `owner_id`
  is `"parent"` or a kid profile id.
- Kid→parent events push to `targetRole: "parent"`.
- Parent→kid events push to `targetOwnerId: <kidId>`.
- The Edge Function looks up tokens with the **caller's JWT**, so RLS guarantees
  you can only push within your own family.
