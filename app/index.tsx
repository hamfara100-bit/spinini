/**
 * Smart router — runs on every app start and decides where to go.
 *
 * Logic:
 *   deviceRole = null  → /onboarding         (role chooser, first launch)
 *   deviceRole = "parent":
 *     - Not signed in or no family yet        → /onboarding/parent
 *     - Signed in, family exists, has kids    → /parent/dashboard
 *     - Signed in, family exists, NO kids yet → /onboarding/parent (QR step)
 *   deviceRole = "kid":
 *     - Not signed in or not linked           → /onboarding/kid
 *     - Signed in and linked to a family      → /kid/[id]/home
 */
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../lib/data/store";
import { Colors } from "../lib/theme";
import { getMembership, listMembers } from "../lib/family-account";

export default function SmartRouter() {
  const { state, hydrated } = useData();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!hydrated) return;
    route();
  }, [hydrated]);

  async function route() {
    setChecking(true);
    try {
      const role = state.deviceRole;

      // ── No role chosen yet → first launch ─────────────────────────────────
      if (!role) {
        router.replace("/onboarding");
        return;
      }

      // ── Parent device ──────────────────────────────────────────────────────
      if (role === "parent") {
        const m = await getMembership().catch(() => null);
        if (!m) {
          // Not signed in or no family
          router.replace("/onboarding/parent");
          return;
        }
        const members = await listMembers().catch(() => []);
        const hasKids = members.some(mem => mem.role === "kid");
        if (hasKids || state.kids.length > 0) {
          router.replace("/parent/dashboard");
        } else {
          // Signed in and family exists but no kids linked yet — back to QR
          router.replace("/onboarding/parent");
        }
        return;
      }

      // ── Kid device ─────────────────────────────────────────────────────────
      if (role === "kid") {
        const m = await getMembership().catch(() => null);
        if (!m?.familyId) {
          // Not linked to a family yet
          router.replace("/onboarding/kid");
          return;
        }
        // Find the kid's local profile (auto-created during onboarding)
        const kid = state.kids[0];
        if (kid) {
          router.replace(`/kid/${kid.profile.id}/home`);
        } else {
          // Profile not yet synced — go back to kid onboarding scan step
          router.replace("/onboarding/kid");
        }
      }
    } catch {
      // If Supabase is unreachable, fall back to onboarding
      router.replace(state.deviceRole === "parent" ? "/onboarding/parent" : "/onboarding/kid");
    } finally {
      setChecking(false);
    }
  }

  // Show spinner while checking
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bgLight }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}
