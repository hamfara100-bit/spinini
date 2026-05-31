import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Image, ActionSheetIOS, Alert, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { ScreenContainer } from "../../components/screen-container";
import { Button } from "../../components/ui/primitives";
import { Mascot } from "../../components/mascot";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../../lib/theme";
import { MascotType, PastelColor, PASTEL_COLORS } from "../../lib/data/types";
import { uid } from "../../lib/utils";

const MASCOTS: MascotType[] = ["fox","panda","bunny","dino","owl","cat","bear","frog"];
const COLORS: PastelColor[] = ["pink","blue","green","yellow","purple","orange","sky","rose"];

export default function AddKid() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const isFirstKid = !state.setupDone;
  const [name, setName] = useState("");
  const [age, setAge] = useState("8");
  const [mascot, setMascot] = useState<MascotType>("fox");
  const [color, setColor] = useState<PastelColor>("pink");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to pick a picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  function showPhotoOptions() {
    Alert.alert("Kid's Photo", "Choose a photo source", [
      { text: "📷 Take Photo", onPress: pickFromCamera },
      { text: "🖼️ Choose from Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleAdd() {
    if (!name.trim()) { setError("Please enter a name"); return; }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 17) { setError("Age must be 1–17"); return; }
    dispatch({
      type: "ADD_KID",
      payload: {
        id: uid(),
        name: name.trim(),
        age: ageNum,
        mascot,
        color,
        photoUri: photoUri ?? undefined,
        createdAt: new Date().toISOString(),
      },
    });
    if (isFirstKid) dispatch({ type: "SETUP_COMPLETE" });
    router.replace("/");
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{isFirstKid ? "Add Your First Kid 👦" : "Add Another Kid 👶"}</Text>

      {/* Photo picker */}
      <TouchableOpacity style={styles.avatarWrap} onPress={showPhotoOptions}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Mascot type={mascot} size={56} animate={false} />
          </View>
        )}
        <View style={styles.cameraBtn}>
          <Text style={styles.cameraBtnText}>📷</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.avatarHint}>Tap to add a photo</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Maya"
        autoFocus
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={[styles.input, { width: 80 }]}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        maxLength={2}
      />

      <Text style={styles.label}>Mascot</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {MASCOTS.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.mascotBtn, mascot === m && styles.mascotBtnActive]}
            onPress={() => setMascot(m)}
          >
            <Mascot type={m} size={44} animate={false} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>Color</Text>
      <View style={styles.colorRow}>
        {COLORS.map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.colorDot, { backgroundColor: PASTEL_COLORS[c] }, color === c && styles.colorDotActive]}
            onPress={() => setColor(c)}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Add Kid & Continue" onPress={handleAdd} size="lg" fullWidth style={{ marginTop: Spacing.lg }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: Spacing.lg, marginTop: Spacing.md },
  avatarWrap: { alignSelf: "center", marginBottom: 6, position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.primary },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.cardLight, borderWidth: 2.5,
    borderColor: Colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
    ...Shadow.sm,
  },
  cameraBtnText: { fontSize: 14 },
  avatarHint: { textAlign: "center", fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  label: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6, marginTop: Spacing.md },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight },
  mascotBtn: { padding: 8, borderRadius: Radius.md, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  mascotBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight + "30" },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.md },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: Colors.primary },
  error: { color: Colors.error, fontSize: FontSize.sm, marginTop: Spacing.sm },
});
