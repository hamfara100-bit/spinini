import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, Modal, ScrollView,
} from "react-native";
import { MicButton } from "../../../../components/voice-text-input";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { IncidentCategory } from "../../../../lib/data/types";

const CATEGORIES: { id: IncidentCategory; label: string; emoji: string; color: string; desc: string }[] = [
  { id: "bullying",    label: "Bullying",       emoji: "😢", color: "#EF4444", desc: "Someone was being mean or hurting me" },
  { id: "stranger",   label: "Stranger",        emoji: "⚠️", color: "#F59E0B", desc: "A stranger acted weird or scary" },
  { id: "unsafe_area",label: "Unsafe Place",    emoji: "🚨", color: "#EF4444", desc: "Something felt unsafe where I was" },
  { id: "fight",      label: "Fight/Argument",  emoji: "😤", color: "#F97316", desc: "I saw or was in a fight" },
  { id: "lost_item",  label: "Lost Something",  emoji: "🔍", color: "#6366F1", desc: "I lost something important" },
  { id: "other",      label: "Something Else",  emoji: "📝", color: "#64748B", desc: "Something else happened" },
];

const FEELINGS = ["😢 Sad", "😡 Angry", "😨 Scared", "😤 Frustrated", "😔 Upset", "😐 Okay", "😰 Worried"];

export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<IncidentCategory>("bullying");
  const [description, setDescription] = useState("");
  const [feeling, setFeeling] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const incidents = kid?.incidents ?? [];

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  function addPhotoOptions() {
    Alert.alert("Add a photo", "You can take a photo of what happened if it helps explain.", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function submit() {
    if (!description.trim()) { Alert.alert("Please tell me what happened."); return; }
    const incident = {
      id: uid(),
      kidId: id,
      category,
      description: description.trim(),
      feeling: feeling || undefined,
      photoUri: photoUri ?? undefined,
      sharedToParent: true,
      date: nowIso(),
    };
    dispatch({ type: "INCIDENT_ADD", kidId: id, incident });

    // Alert parent
    const catDef = CATEGORIES.find(c => c.id === category)!;
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: id,
      notification: {
        id: uid(), kidId: id,
        kind: "ping",
        title: `${catDef.emoji} Incident Report from ${kid?.profile.name}`,
        body: description.trim().slice(0, 80),
        read: false,
        createdAt: nowIso(),
      },
    });

    setDescription(""); setFeeling(""); setPhotoUri(null); setCategory("bullying");
    setShowForm(false);
    Alert.alert("✅ Reported!", "Your parent has been notified. You did the right thing by telling someone. 💙");
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🚨 Report an Incident</Text>
      <Text style={styles.sub}>Something bad happened? Write about it here. Your parent will be notified right away.</Text>

      {/* Emergency reminder */}
      <View style={styles.emergencyCard}>
        <Text style={styles.emergencyTitle}>🆘 In immediate danger?</Text>
        <Text style={styles.emergencyText}>Call 911 or go to a trusted adult RIGHT NOW. Then use this app to report it.</Text>
      </View>

      {incidents.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>My Reports</Text>
          {[...incidents].reverse().map(inc => {
            const cat = CATEGORIES.find(c => c.id === inc.category) ?? CATEGORIES[5];
            return (
              <View key={inc.id} style={[styles.incidentCard, { borderLeftColor: cat.color }]}>
                <View style={styles.incidentHeader}>
                  <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.incidentLabel}>{cat.label}</Text>
                    <Text style={styles.incidentDate}>{new Date(inc.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                  </View>
                  {inc.sharedToParent && <Text style={styles.sharedBadge}>✅ Parent notified</Text>}
                </View>
                <Text style={styles.incidentDesc} numberOfLines={3}>{inc.description}</Text>
                {inc.feeling && <Text style={styles.incidentFeeling}>{inc.feeling}</Text>}
                {inc.photoUri && <Image source={{ uri: inc.photoUri }} style={styles.incidentPhoto} resizeMode="cover" />}
              </View>
            );
          })}
        </>
      )}

      {incidents.length === 0 && (
        <View style={styles.noReports}>
          <Text style={{ fontSize: 52 }}>✅</Text>
          <Text style={styles.noReportsText}>No reports yet. If something bad happens, use the button below!</Text>
        </View>
      )}

      <TouchableOpacity style={styles.reportBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.reportBtnText}>📝 Report Something</Text>
      </TouchableOpacity>

      {/* Report form modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>📝 What Happened?</Text>

            <Text style={styles.label}>What kind of thing happened?</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catBtn, category === c.id && { backgroundColor: c.color + "20", borderColor: c.color }]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
                  <Text style={[styles.catLabel, category === c.id && { color: c.color }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.catDesc}>{CATEGORIES.find(c => c.id === category)?.desc}</Text>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.label}>Tell me what happened</Text>
              <MicButton appendTo={description} onAppend={setDescription} onResult={setDescription} size={32} />
            </View>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Write everything you remember… or tap 🎙️ to speak!"
              multiline
              autoFocus
            />

            <Text style={styles.label}>How are you feeling?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feelingScroll} contentContainerStyle={{ gap: 8 }}>
              {FEELINGS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.feelingBtn, feeling === f && styles.feelingBtnActive]}
                  onPress={() => setFeeling(f === feeling ? "" : f)}
                >
                  <Text style={[styles.feelingText, feeling === f && styles.feelingTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Add a photo (optional)</Text>
            {photoUri ? (
              <TouchableOpacity onPress={addPhotoOptions}>
                <Image source={{ uri: photoUri }} style={styles.previewPhoto} resizeMode="cover" />
                <Text style={styles.changePhotoText}>Tap to change</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={addPhotoOptions}>
                <Text style={styles.photoBtnText}>📷 Add Photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submit}>
                <Text style={styles.submitBtnText}>🚨 Send Report</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.reminder}>Your parent will be notified immediately 💙</Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.error, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  emergencyCard: { backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.lg, borderLeftWidth: 4, borderLeftColor: Colors.error },
  emergencyTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.error, marginBottom: 4 },
  emergencyText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.sm },
  incidentCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderLeftWidth: 4, ...Shadow.sm },
  incidentHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  incidentLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  incidentDate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sharedBadge: { fontSize: 10, color: Colors.success, fontWeight: "600" },
  incidentDesc: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  incidentFeeling: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  incidentPhoto: { width: "100%", height: 120, borderRadius: Radius.md, marginTop: 8 },
  noReports: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  noReportsText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  reportBtn: { alignSelf: "center", backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md },
  reportBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalContent: { padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 14 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { width: "47%", borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, padding: 10, alignItems: "center", gap: 4, backgroundColor: Colors.surfaceLight },
  catLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  catDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: "italic", marginTop: 4 },
  textArea: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.base, minHeight: 120, textAlignVertical: "top", backgroundColor: Colors.surfaceLight },
  feelingScroll: { maxHeight: 44 },
  feelingBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  feelingBtnActive: { backgroundColor: Colors.primary },
  feelingText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  feelingTextActive: { color: "#fff" },
  photoBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", backgroundColor: Colors.cardLight },
  photoBtnText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.base },
  previewPhoto: { width: "100%", height: 180, borderRadius: Radius.lg },
  changePhotoText: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  submitBtn: { flex: 2, backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  reminder: { textAlign: "center", fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 12 },
});
