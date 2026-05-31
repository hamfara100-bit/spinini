/**
 * Supabase client — the family account / pairing / offline backend.
 * ----------------------------------------------------------------------------
 * HYBRID design: this backend only does identity (parent + kid username/password
 * accounts), family pairing (which derives the per-family sync room), and the
 * offline queue. Live chat/calls/state still ride the Trystero P2P transport.
 *
 * `react-native-url-polyfill/auto` MUST be imported before createClient so the
 * global URL/URLSearchParams exist in Hermes (supabase-js parses URLs at init).
 */

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection in a native app (no redirect callback URL).
    detectSessionInUrl: false,
    // PKCE so native OAuth (Google) returns a ?code we exchange for a session;
    // the code verifier is stashed in AsyncStorage between launch of the browser
    // and the redirect back. Required by signInWithGoogle in family-account.ts.
    flowType: "pkce",
  },
});
