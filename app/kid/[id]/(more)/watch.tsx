import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [permission, requestPermission] = useCameraPermissions();
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const session = kid?.cameraWatchSession;
  const isActive = session?.active ?? false;

  async function takeAndSendPhoto() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera needed", "Allow camera access so you can send a check-in photo.");
        return;
      }
    }

    setTakingPhoto(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6, base64: false });
      if (!photo?.uri) return;
      setLastPhoto(photo.uri);

      // Send as family chat message
      dispatch({
        type: "FAMILY_CHAT_PUSH",
        message: {
          id: uid(),
          authorId: id,
          authorName: kid?.profile.name ?? "Kid",
          text: `📸 Check-in from ${kid?.profile.name} — I'm safe! 👋`,
          imageUri: photo.uri,
          sentAt: nowIso(),
          recipients: [],
          readBy: [],
        },
      });

      // Add to shared album too
      dispatch({
        type: "ALBUM_ADD_KID",
        kidId: id,
        item: {
          id: uid(),
          type: "photo",
          uri: photo.uri,
          caption: "Check-in photo 📸",
          uploadedBy: kid?.profile.name ?? "Kid",
          uploadedAt: nowIso(),
        },
      });

      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {
      Alert.alert("Couldn't take photo", "Please try again.");
    } finally {
      setTakingPhoto(false);
    }
  }

  if (isActive) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Active banner */}
        <View style={styles.activeBanner}>
          <View style={styles.recordDot} />
          <Text style={styles.activeBannerText}>🟢 Your parent can check on you</Text>
        </View>

        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing={session?.facing ?? "front"}
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={[styles.snapBtn, takingPhoto && { opacity: 0.6 }]}
                onPress={takeAndSendPhoto}
                disabled={takingPhoto}
              >
                <Text style={styles.snapBtnText}>📸 Send Check-in</Text>
              </TouchableOpacity>
              {sent && (
                <View style={styles.sentBadge}>
                  <Text style={styles.sentText}>✅ Sent to parent!</Text>
                </View>
              )}
            </View>
          </CameraView>
        ) : (
          <View style={styles.permCenter}>
            <Text style={{ fontSize: 52 }}>📷</Text>
            <Text style={styles.permText}>Camera access needed</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>👁️ Camera Watch</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>⚫ Inactive</Text>
          <Text style={styles.statusSub}>Your parent hasn't requested a check-in</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📷 What is Camera Watch?</Text>
        <Text style={styles.infoText}>When your parent wants to check that you're safe, this screen will become active and you can send them a selfie photo so they know you're okay.</Text>
      </View>

      {/* Manual check-in */}
      <Text style={styles.sectionTitle}>Send a Check-in Now</Text>
      <Text style={styles.sectionSub}>Want to let your parent know you're safe? Tap below to send them a photo!</Text>

      {lastPhoto && (
        <View style={styles.lastPhotoCard}>
          <Image source={{ uri: lastPhoto }} style={styles.lastPhoto} />
          {sent && <Text style={styles.sentConfirm}>✅ Sent to parent!</Text>}
        </View>
      )}

      {permission?.granted ? (
        <View style={styles.selfieContainer}>
          <CameraView ref={cameraRef} style={styles.selfieCamera} facing="front" />
          <TouchableOpacity
            style={[styles.checkInBtn, takingPhoto && { opacity: 0.6 }]}
            onPress={takeAndSendPhoto}
            disabled={takingPhoto}
          >
            <Text style={styles.checkInBtnText}>{takingPhoto ? "Sending…" : "📸 Send Check-in Photo"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.checkInBtn} onPress={requestPermission}>
          <Text style={styles.checkInBtnText}>📷 Allow Camera to Check In</Text>
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  // Active state
  activeBanner: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.success, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  activeBannerText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  cameraOverlay: { flex: 1, justifyContent: "flex-end", padding: Spacing.lg },
  snapBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md },
  snapBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md },
  sentBadge: { backgroundColor: Colors.success, borderRadius: Radius.md, alignItems: "center", paddingVertical: 8, marginTop: 8 },
  sentText: { color: "#fff", fontWeight: "700" },
  permCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "#fff" },
  permText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  permBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: "#fff", fontWeight: "700" },
  // Inactive state
  statusCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 12 },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.textMuted },
  statusTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  statusSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  infoCard: { backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginBottom: 6 },
  infoText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  selfieContainer: { borderRadius: Radius.lg, overflow: "hidden", marginBottom: Spacing.md },
  selfieCamera: { height: 200, borderRadius: Radius.lg },
  checkInBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  checkInBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  lastPhotoCard: { marginBottom: Spacing.md, borderRadius: Radius.lg, overflow: "hidden", ...Shadow.sm },
  lastPhoto: { width: "100%", height: 180 },
  sentConfirm: { textAlign: "center", color: Colors.success, fontWeight: "700", padding: 8, backgroundColor: Colors.success + "15" },
});
