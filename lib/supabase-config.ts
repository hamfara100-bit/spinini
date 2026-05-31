/**
 * Supabase connection config.
 * ----------------------------------------------------------------------------
 * Both values below are PUBLISHABLE — safe to embed in the shipped app:
 *   • SUPABASE_URL            — the project's REST/Auth endpoint.
 *   • SUPABASE_PUBLISHABLE_KEY — the "publishable" (anon) key; Row-Level
 *     Security on the database is what actually protects data, not key secrecy.
 *
 * NEVER put the `service_role` (secret) key here — it bypasses RLS and must
 * stay server-side only.
 */

export const SUPABASE_URL = "https://ivldpavzkapddizipkpq.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_36UT2CLhTSIc26dE8_P0cQ_0MB6aQMD";

/** True once a real project URL has been filled in (gates the client wiring). */
export const SUPABASE_CONFIGURED = !SUPABASE_URL.includes("YOUR_PROJECT_REF");
