/**
 * AddKidQR — the ONLY supported way to add a child.
 *
 * Shows a pairing QR code (+ 6-char code) that the child scans on THEIR OWN
 * device during kid onboarding. The child creates their own account and joins
 * the family; this modal polls Supabase and, once they appear, syncs them into
 * the parent's local store. No more account-less "local" kids.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useData } from "../lib/data/store";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../lib/theme";
import { nowIso } from "../lib/utils";
import {
  getMembership, listMembers, createPairing, type Membership,
} from "../lib/family-account";
import type { AppAction } from "../lib/data/types";

const MASCOTS = ["fox","panda","bunny","dino","owl","cat","bear","frog"] as const;
const COLORS  = ["pink","blue","green","yellow","purple","orange","sky","rose"] as const;
const QR_SIZE = Math.min(Dimensions.get("window").width - 120, 220);

// Reconcile Supabase kid members into the local store (same logic as the app
// router): rekey a name-matched local placeholder, otherwise add by userId.
function syncKids(
  members: Membership[],
  existingKids: { profile: { id: string; name: string } }[],
  dispatch: (a: AppAction) => void,
) {
  const kidMembers = members.filter(m => m.role === "kid");
  const memberIds = new Set(kidMembers.map(m => m.userId));
  const existingIds = new Set(existingKids.map(k => k.profile.id));
  const usedPlaceholders = new Set<string>();
  kidMembers.forEach((m, i) => {
    if (existingIds.has(m.userId)) return;
    const placeholder = existingKids.find(k =>
      !memberIds.has(k.profile.id) &&
      !usedPlaceholders.has(k.profile.id) &&
      k.profile.name.trim().toLowerCase() === m.displayName.trim().toLowerCase()
    );
    if (placeholder) {
      usedPlaceholders.add(placeholder.profile.id);
      dispatch({ type: "RELINK_KID_ID", oldId: placeholder.profile.id, newId: m.userId });
      return;
    }
    dispatch({
      type: "ADD_KID",
      payload: {
        id: m.userId, name: m.displayName, age: m.age ?? 10,
        mascot: MASCOTS[i % MASCOTS.length], color: COLORS[i % COLORS.length],
        createdAt: nowIso(),
      },
    });
  });
}

export function AddKidQR({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { state, dispatch } = useData();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baselineKidIds = useRef<Set<string>>(new Set());

  // Generate a fresh pairing code each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setCode(null); setError(null); setJoinedName(null); setBusy(true);
    (async () => {
      try {
        const m = await getMembership();
        if (!m) {
          if (!cancelled) setError("Set up your Family Cloud Account first (Account → Family Cloud Account → Create family), then add a child.");
          return;
        }
        // Record which kids already exist so we can detect the NEW one.
        const members = await listMembers().catch(() => []);
        baselineKidIds.current = new Set(members.filter(x => x.role === "kid").map(x => x.userId));
        const c = await createPairing("kid", 30);
        if (!cancelled) setCode(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not create an invite code.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  // Poll for the child joining while the modal is open and a code exists.
  useEffect(() => {
    if (!visible || !code || joinedName) return;
    pollRef.current = setInterval(async () => {
      try {
        const members = await listMembers();
        const kids = members.filter(m => m.role === "kid");
        const fresh = kids.find(k => !baselineKidIds.current.has(k.userId));
        if (fresh) {
          if (pollRef.current) clearInterval(pollRef.current);
          syncKids(members, state.kids, dispatch);
          dispatch({ type: "SETUP_COMPLETE" });
          setJoinedName(fresh.displayName);
        }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [visible, code, joinedName, state.kids]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {joinedName ? (
            <>
              <Text style={s.emoji}>🎉</Text>
              <Text style={s.title}>{joinedName} joined!</Text>
              <Text style={s.sub}>They've been added to your family.</Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose}>
                <Text style={s.doneText}>Done ✓</Text>
              </TouchableOpacity>
            </>
          ) : error ? (
            <>
              <Text style={s.emoji}>⚠️</Text>
              <Text style={s.title}>Can't add a child yet</Text>
              <Text style={s.sub}>{error}</Text>
              <TouchableOpacity style={s.doneBtn} onPress={onClose}>
                <Text style={s.doneText}>OK</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.title}>📲 Add a Child</Text>
              <Text style={s.sub}>On your child's OWN phone, open Spinini, choose “I'm a Kid”, and scan this code.</Text>
              <View style={s.qrWrap}>
                {code ? (
                  <QRCode value={code} size={QR_SIZE} color={Colors.primary} backgroundColor="#fff" />
                ) : (
                  <View style={{ width: QR_SIZE, height: QR_SIZE, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                  </View>
                )}
              </View>
              {code && <Text style={s.code}>{code}</Text>}
              <View style={s.waitRow}>
                <ActivityIndicator color={Colors.textMuted} />
                <Text style={s.waitText}>Waiting for your child to join…</Text>
              </View>
              <Text style={s.help}>They can also type this 6-character code manually. It expires in 30 minutes.</Text>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={busy}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingBottom: 40, alignItems: "center", gap: 10, ...Shadow.md,
  },
  emoji: { fontSize: 52 },
  title: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.sm },
  qrWrap: { padding: 16, backgroundColor: "#fff", borderRadius: Radius.lg, ...Shadow.sm, marginTop: 6 },
  code: { fontSize: 30, fontWeight: "900", color: Colors.primary, letterSpacing: 8 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  waitText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: "600" },
  help: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", lineHeight: 18 },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8, ...Shadow.sm },
  doneText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 2 },
  cancelText: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base },
});
