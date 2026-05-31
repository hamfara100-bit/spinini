import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Modal, Alert, Image, Animated, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../lib/data/store";
import { ScreenContainer } from "../components/screen-container";
import { Mascot } from "../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { PASTEL_COLORS } from "../lib/data/types";
import type { KidState } from "../lib/data/types";
import * as AppleAuthentication from "expo-apple-authentication";

function BlinkBadge({ count }: { count: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.1, duration: 550, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Animated.View style={[styles.pendingBadge, { opacity }]}>
      <Text style={styles.pendingBadgeText}>{count}</Text>
    </Animated.View>
  );
}

export default function ProfilePicker() {
  const { state, hydrated, dispatch } = useData();
  const router = useRouter();
  const [showParentModal, setShowParentModal] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!state.setupDone) router.replace("/setup/welcome");
  }, [hydrated, state.setupDone]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bgLight }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!state.setupDone) return null;

  function selectKid(kid: KidState) {
    // Enter the kid's home (any per-kid PIN is handled inside the kid layout).
    router.push(`/kid/${kid.profile.id}/home`);
  }

  async function signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
        : undefined;
      dispatch({
        type: "SET_PARENT_APPLE",
        userId: credential.user,
        email: credential.email ?? undefined,
        fullName: fullName || undefined,
      });
      setShowParentModal(false);
      router.push("/parent/dashboard");
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign In Failed", "Apple Sign In could not be completed. Please try again.");
      }
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Spinini</Text>
        <Text style={styles.subtitle}>Who's using the app?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {state.kids.map(kid => (
          <TouchableOpacity
            key={kid.profile.id}
            style={[styles.card, { backgroundColor: PASTEL_COLORS[kid.profile.color] }]}
            onPress={() => selectKid(kid)}
            activeOpacity={0.85}
          >
            {kid.profile.photoUri
              ? <Image source={{ uri: kid.profile.photoUri }} style={styles.kidPhoto} />
              : <Mascot type={kid.profile.mascot} size={64} animate={false} />}
            <Text style={styles.kidName}>{kid.profile.name}</Text>
            <Text style={styles.kidAge}>Age {kid.profile.age}</Text>
            {(() => {
              const n = kid.chores.filter(c => c.status === "open" || c.status === "submitted").length;
              return n > 0 ? <BlinkBadge count={n} /> : null;
            })()}
          </TouchableOpacity>
        ))}

        {/* Parent card */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: Colors.cardLight }]}
          onPress={() => state.parentSettings.pin ? router.push("/parent/dashboard") : setShowParentModal(true)}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 48 }}>
            {state.parentSettings.appleUserId ? "" : "🔒"}
          </Text>
          <Text style={styles.kidName}>Parent</Text>
          <Text style={styles.kidAge}>
            {state.parentSettings.appleFullName
              ? state.parentSettings.appleFullName
              : state.parentSettings.pin
              ? "PIN required"
              : "Tap to enter"}
          </Text>
          {state.parentSettings.appleUserId && (
            <View style={[styles.googleBadge, { backgroundColor: "#00000015" }]}>
              <Text style={[styles.googleBadgeText, { color: "#000" }]}> Apple ID</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/setup/add-kid")}>
        <Text style={styles.addBtnText}>+ Add Kid</Text>
      </TouchableOpacity>

      {/* Parent sign-in modal — PIN or Apple Sign In */}
      <Modal
        visible={showParentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔒 Parent Access</Text>
            <Text style={styles.modalSub}>Verify your identity to continue</Text>

            <TouchableOpacity
              style={[styles.continueBtn, { marginTop: 8 }]}
              onPress={() => { setShowParentModal(false); router.push("/parent/dashboard"); }}
            >
              <Text style={styles.continueBtnText}>Enter PIN →</Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ width: "100%", height: 48, marginTop: 12 }}
                onPress={signInWithApple}
              />
            )}

            <TouchableOpacity onPress={() => setShowParentModal(false)} style={styles.skipBtn}>
              <Text style={styles.skipText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, paddingBottom: Spacing.xl },
  card: { width: 150, borderRadius: Radius.xl, alignItems: "center", paddingVertical: Spacing.lg, ...Shadow.md },
  kidPhoto: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: "#fff" },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginTop: 8 },
  kidAge: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  googleBadge: { marginTop: 6, backgroundColor: "#4285F415", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  googleBadgeText: { fontSize: 10, fontWeight: "700", color: "#4285F4" },
  pendingBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: Colors.error, borderRadius: 12, minWidth: 22, height: 22,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5,
    borderWidth: 2, borderColor: "#fff",
  },
  pendingBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  addBtn: { alignSelf: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 2, borderColor: Colors.primary, marginBottom: Spacing.lg },
  addBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.xl, alignItems: "center", gap: 12, paddingBottom: 48 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  continueBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 24, width: "100%" },
  continueBtnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  skipBtn: { padding: Spacing.sm },
  skipText: { color: Colors.textMuted, fontSize: FontSize.sm, textDecorationLine: "underline" },
});
