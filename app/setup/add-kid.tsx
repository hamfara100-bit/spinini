import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Image, Alert, Platform, Modal, Dimensions, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { useData } from "../../lib/data/store";
import { ScreenContainer } from "../../components/screen-container";
import { Button } from "../../components/ui/primitives";
import { Mascot } from "../../components/mascot";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../../lib/theme";
import { MascotType, PastelColor, PASTEL_COLORS } from "../../lib/data/types";
import { uid } from "../../lib/utils";
import { getMembership, createPairing } from "../../lib/family-account";

const MASCOTS: MascotType[] = ["fox","panda","bunny","dino","owl","cat","bear","frog"];
const COLORS: PastelColor[]  = ["pink","blue","green","yellow","purple","orange","sky","rose"];
const QR_SCHEME  = "spinini://join/";
const QR_SIZE    = Math.min(Dimensions.get("window").width - 96, 220);

type Step = "form" | "where" | "qr";

export default function AddKid() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const isFirstKid = !state.setupDone;

  // ── Kid form ────────────────────────────────────────────────────────────────
  const [name,    setName]    = useState("");
  const [age,     setAge]     = useState("8");
  const [mascot,  setMascot]  = useState<MascotType>("fox");
  const [color,   setColor]   = useState<PastelColor>("pink");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error,   setError]   = useState("");

  // ── Wizard step ─────────────────────────────────────────────────────────────
  const [step,        setStep]        = useState<Step>("form");
  const [pairingCode, setPairingCode] = useState("");
  const [busy,        setBusy]        = useState(false);

  // ── QR scanner (for kid-side pairing — not used here but scaffolded) ───────
  const [showScanner, setShowScanner] = useState(false);
  const [camPerm, requestCamPerm]     = useCameraPermissions();
  const scannedRef                    = useRef(false);

  // ── Photo picker ────────────────────────────────────────────────────────────
  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to pick a picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }
  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }
  function showPhotoOptions() {
    Alert.alert("Kid's Photo", "Choose a photo source", [
      { text: "📷 Take Photo",            onPress: pickFromCamera  },
      { text: "🖼️ Choose from Library",   onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // ── Validation + add to store ───────────────────────────────────────────────
  function validateForm(): boolean {
    if (!name.trim()) { setError("Please enter a name"); return false; }
    const a = parseInt(age);
    if (isNaN(a) || a < 1 || a > 17) { setError("Age must be 1–17"); return false; }
    return true;
  }

  function addKidToStore() {
    dispatch({
      type: "ADD_KID",
      payload: { id: uid(), name: name.trim(), age: parseInt(age), mascot, color, photoUri: photoUri ?? undefined, createdAt: new Date().toISOString() },
    });
    if (isFirstKid) dispatch({ type: "SETUP_COMPLETE" });
  }

  // ── "On this device" path ───────────────────────────────────────────────────
  function handleThisDevice() {
    addKidToStore();
    router.replace("/");
  }

  // ── "On their own device" path — generate Supabase pairing QR ──────────────
  async function handleRemoteDevice() {
    setBusy(true);
    try {
      const membership = await getMembership();
      if (!membership) {
        Alert.alert(
          "Family Account required",
          "To invite a child to their own device, you need a Family Cloud Account set up first.\n\nGo to: Account → Family Cloud Account → Create family, then come back here.",
          [{ text: "OK" }],
        );
        return;
      }
      const code = await createPairing("kid", 30);
      addKidToStore();
      setPairingCode(code);
      setStep("qr");
    } catch (e) {
      Alert.alert("Couldn't create invite", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ── Step: form → where ──────────────────────────────────────────────────────
  function handleNext() {
    if (!validateForm()) return;
    setError("");
    setStep("where");
  }

  // ── Render: form ────────────────────────────────────────────────────────────
  if (step === "form") {
    return (
      <ScreenContainer scroll>
        <Text style={styles.title}>{isFirstKid ? "Add Your First Kid 👦" : "Add Another Kid 👶"}</Text>

        <TouchableOpacity style={styles.avatarWrap} onPress={showPhotoOptions}>
          {photoUri
            ? <Image source={{ uri: photoUri }} style={styles.avatar} />
            : <View style={styles.avatarPlaceholder}><Mascot type={mascot} size={56} animate={false} /></View>}
          <View style={styles.cameraBtn}><Text style={styles.cameraBtnText}>📷</Text></View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to add a photo</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Maya" autoFocus />

        <Text style={styles.label}>Age</Text>
        <TextInput style={[styles.input, { width: 80 }]} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={2} />

        <Text style={styles.label}>Mascot</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {MASCOTS.map(m => (
            <TouchableOpacity key={m} style={[styles.mascotBtn, mascot === m && styles.mascotBtnActive]} onPress={() => setMascot(m)}>
              <Mascot type={m} size={44} animate={false} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map(c => (
            <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: PASTEL_COLORS[c] }, color === c && styles.colorDotActive]} onPress={() => setColor(c)} />
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button label="Next →" onPress={handleNext} size="lg" fullWidth style={{ marginTop: Spacing.lg }} />
      </ScreenContainer>
    );
  }

  // ── Render: where will the kid use the app? ─────────────────────────────────
  if (step === "where") {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Where will {name} use Spinini?</Text>
        <Text style={styles.whereSub}>Choose how {name} will connect to your family.</Text>

        <TouchableOpacity style={styles.whereCard} onPress={handleThisDevice} activeOpacity={0.85}>
          <Text style={styles.whereEmoji}>📱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.whereTitle}>On THIS device</Text>
            <Text style={styles.whereSub2}>You and {name} share this phone. They tap their avatar on the home screen to enter kid mode.</Text>
          </View>
          <Text style={styles.whereArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.whereCard, styles.whereCardRemote]} onPress={handleRemoteDevice} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={Colors.primary} style={{ marginRight: 12 }} /> : <Text style={styles.whereEmoji}>📲</Text>}
          <View style={{ flex: 1 }}>
            <Text style={styles.whereTitle}>{busy ? "Generating invite…" : "On THEIR OWN device"}</Text>
            <Text style={styles.whereSub2}>{name} has their own phone. We'll generate a QR code they scan to join your family.</Text>
          </View>
          {!busy && <Text style={styles.whereArrow}>›</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setStep("form")} style={{ alignSelf: "center", marginTop: Spacing.md }}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ── Render: QR code for the kid to scan on their device ─────────────────────
  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📲 Invite {name}</Text>
      <Text style={styles.whereSub}>{name} has been added to your family. Now let them scan this QR code on their phone to join.</Text>

      <View style={styles.qrBox}>
        <View style={styles.qrWrap}>
          <QRCode value={QR_SCHEME + pairingCode} size={QR_SIZE} color={Colors.primary} backgroundColor="#fff" />
        </View>
        <Text style={styles.qrCode}>{pairingCode}</Text>
        <Text style={styles.qrHelp}>
          On {name}'s phone:{"\n"}
          Open Spinini → Account → Family Cloud Account{"\n"}
          → "I have an invite code" → 📷 Scan QR Code{"\n\n"}
          Or they can type the code manually. Expires in 30 min.
        </Text>
      </View>

      <Button label="Done ✓" onPress={() => router.replace("/")} size="lg" fullWidth style={{ marginTop: Spacing.lg }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:           { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: Spacing.lg, marginTop: Spacing.md },
  avatarWrap:      { alignSelf: "center", marginBottom: 6, position: "relative" },
  avatar:          { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.cardLight, borderWidth: 2.5, borderColor: Colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  cameraBtn:       { position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", ...Shadow.sm },
  cameraBtnText:   { fontSize: 14 },
  avatarHint:      { textAlign: "center", fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  label:           { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6, marginTop: Spacing.md },
  input:           { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight },
  mascotBtn:       { padding: 8, borderRadius: Radius.md, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  mascotBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + "30" },
  colorRow:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.md },
  colorDot:        { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  colorDotActive:  { borderColor: Colors.primary },
  error:           { color: Colors.error, fontSize: FontSize.sm, marginTop: Spacing.sm },

  // Where step
  whereSub:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, lineHeight: 20, paddingHorizontal: Spacing.md },
  whereCard:       { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: 14, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  whereCardRemote: { borderColor: Colors.primary + "55", backgroundColor: Colors.primary + "08" },
  whereEmoji:      { fontSize: 38 },
  whereTitle:      { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  whereSub2:       { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  whereArrow:      { fontSize: 26, color: Colors.textMuted, fontWeight: "300" },
  back:            { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },

  // QR step
  qrBox:           { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", gap: 14, ...Shadow.md },
  qrWrap:          { padding: 14, backgroundColor: "#fff", borderRadius: Radius.lg, ...Shadow.sm },
  qrCode:          { fontSize: 34, fontWeight: "900", color: Colors.primary, letterSpacing: 8 },
  qrHelp:          { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 21 },
});
