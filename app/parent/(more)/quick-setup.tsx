import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

const STEPS = [
  { id: 1, emoji: "👨‍👩‍👧", title: "Your Family", desc: "Set up who's in your family" },
  { id: 2, emoji: "⏱️", title: "Screen Time", desc: "Choose daily limits" },
  { id: 3, emoji: "✅", title: "Chores", desc: "What should kids earn screen time for?" },
  { id: 4, emoji: "🌅", title: "Morning Routine", desc: "Daily checklist before screen time unlocks" },
  { id: 5, emoji: "🎯", title: "You're ready!", desc: "Summary and next steps" },
];

const DEFAULT_CHORES = [
  "Make your bed",
  "Brush your teeth",
  "Finish homework",
  "Read for 20 minutes",
  "Help with dinner",
];

const LIMIT_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "90 min", minutes: 90 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
];

export default function QuickSetupScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 2 state
  const [limitMinutes, setLimitMinutes] = useState(120);

  // Step 3 state
  const [selectedChores, setSelectedChores] = useState<string[]>(DEFAULT_CHORES.slice(0, 3));
  const [customChore, setCustomChore] = useState("");

  // Step 4 state
  const [enableMorning, setEnableMorning] = useState(false);

  function toggleChore(chore: string) {
    setSelectedChores(prev =>
      prev.includes(chore) ? prev.filter(c => c !== chore) : [...prev, chore]
    );
  }

  function addCustomChore() {
    if (!customChore.trim()) return;
    setSelectedChores(prev => [...prev, customChore.trim()]);
    setCustomChore("");
  }

  function applyScreenTimeLimits() {
    state.kids.forEach(k => {
      dispatch({ type: "UPDATE_RULES", kidId: k.profile.id, payload: { dailyLimitMinutes: limitMinutes } });
    });
  }

  function applyMorningRoutine() {
    if (!enableMorning) return;
    const DEFAULT_ITEMS = [
      { id: "1", emoji: "🦷", label: "Brush teeth" },
      { id: "2", emoji: "🛏️", label: "Make bed" },
      { id: "3", emoji: "🥣", label: "Eat breakfast" },
      { id: "4", emoji: "👔", label: "Get dressed" },
    ];
    state.kids.forEach(k => {
      dispatch({ type: "MORNING_ROUTINE_UPDATE", kidId: k.profile.id, routine: { enabled: true, items: DEFAULT_ITEMS, resetHour: 4 } });
    });
  }

  function finish() {
    applyScreenTimeLimits();
    applyMorningRoutine();
    Alert.alert("Setup complete! 🎉", "Your family's Spinini is ready. You can adjust any setting in the parent dashboard.", [
      { text: "Let's go!", onPress: () => router.back() },
    ]);
  }

  const kids = state.kids;

  return (
    <ScreenContainer scroll>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map(s => (
          <View key={s.id} style={[styles.stepDot, step >= s.id && styles.stepDotActive]} />
        ))}
      </View>

      <Text style={styles.stepLabel}>Step {step} of {STEPS.length}</Text>

      {/* Step 1: Family overview */}
      {step === 1 && (
        <View>
          <Text style={styles.stepTitle}>👨‍👩‍👧 Your Family</Text>
          <Text style={styles.stepSub}>Here's who is set up in Spinini. You can add more kids from the main dashboard.</Text>

          {kids.length === 0 ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>No kids added yet. Go back and add a kid profile first to get the most out of this setup wizard.</Text>
            </View>
          ) : (
            kids.map(k => (
              <View key={k.profile.id} style={styles.kidCard}>
                <Text style={styles.kidCardEmoji}>👤</Text>
                <View>
                  <Text style={styles.kidCardName}>{k.profile.name}</Text>
                  <Text style={styles.kidCardAge}>Age {k.profile.age}</Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Tip</Text>
            <Text style={styles.tipText}>Each kid gets their own profile with personalized limits, chores, and rewards. You can customize settings for each kid individually after this wizard.</Text>
          </View>
        </View>
      )}

      {/* Step 2: Screen time */}
      {step === 2 && (
        <View>
          <Text style={styles.stepTitle}>⏱️ Daily Screen Time Limit</Text>
          <Text style={styles.stepSub}>How much screen time should kids get per day? (Applies to all kids — you can customize per-kid later.)</Text>

          <View style={styles.optionGrid}>
            {LIMIT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.minutes}
                style={[styles.optionCard, limitMinutes === opt.minutes && styles.optionCardActive]}
                onPress={() => setLimitMinutes(opt.minutes)}
              >
                <Text style={[styles.optionLabel, limitMinutes === opt.minutes && styles.optionLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Research says</Text>
            <Text style={styles.tipText}>American Academy of Pediatrics recommends 1-2 hours per day for school-age children (6-18). Younger kids (2-5) should have under 1 hour.</Text>
          </View>
        </View>
      )}

      {/* Step 3: Chores */}
      {step === 3 && (
        <View>
          <Text style={styles.stepTitle}>✅ Chores & Tasks</Text>
          <Text style={styles.stepSub}>Pick some chores to get started. Kids complete these to earn screen time, points, and allowance.</Text>

          {DEFAULT_CHORES.map(chore => (
            <TouchableOpacity
              key={chore}
              style={[styles.choreItem, selectedChores.includes(chore) && styles.choreItemActive]}
              onPress={() => toggleChore(chore)}
            >
              <Text style={styles.choreCheck}>{selectedChores.includes(chore) ? "✅" : "○"}</Text>
              <Text style={[styles.choreLabel, selectedChores.includes(chore) && styles.choreLabelActive]}>{chore}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.addChoreRow}>
            <TextInput
              style={styles.addChoreInput}
              value={customChore}
              onChangeText={setCustomChore}
              placeholder="Add your own chore…"
              onSubmitEditing={addCustomChore}
            />
            <TouchableOpacity style={styles.addChoreBtn} onPress={addCustomChore}>
              <Text style={styles.addCoreBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.choreSub}>{selectedChores.length} selected · You can add/edit chores anytime from the Chores screen.</Text>
        </View>
      )}

      {/* Step 4: Morning routine */}
      {step === 4 && (
        <View>
          <Text style={styles.stepTitle}>🌅 Morning Routine</Text>
          <Text style={styles.stepSub}>Kids complete a checklist before screen time unlocks each day. Great for building healthy habits!</Text>

          <TouchableOpacity
            style={[styles.bigToggle, enableMorning && styles.bigToggleActive]}
            onPress={() => setEnableMorning(v => !v)}
          >
            <Text style={styles.bigToggleEmoji}>{enableMorning ? "✅" : "○"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bigToggleTitle, enableMorning && styles.bigToggleTitleActive]}>
                Enable Morning Routine
              </Text>
              <Text style={styles.bigToggleSub}>
                {enableMorning
                  ? "Default checklist: Brush teeth, Make bed, Eat breakfast, Get dressed"
                  : "Tap to enable. You can customize the checklist later."}
              </Text>
            </View>
          </TouchableOpacity>

          {!enableMorning && (
            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>💡 Skip for now</Text>
              <Text style={styles.tipText}>You can always enable morning routines later from Parent → Morning Routine in the settings.</Text>
            </View>
          )}
        </View>
      )}

      {/* Step 5: Done */}
      {step === 5 && (
        <View>
          <View style={styles.doneCard}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>You're all set!</Text>
            <Text style={styles.doneSub}>Here's what's been configured:</Text>
          </View>

          {[
            { emoji: "⏱️", text: `Screen time limit: ${limitMinutes} min/day for ${kids.length} kid${kids.length !== 1 ? "s" : ""}` },
            { emoji: "🌅", text: enableMorning ? "Morning routine: enabled with 4 default items" : "Morning routine: not enabled (configure later)" },
            { emoji: "✅", text: `${selectedChores.length} chore templates ready` },
            { emoji: "🤖", text: "AI Buddy, Bedtime Stories, and Homework Helper are ready" },
            { emoji: "📍", text: "Location sharing available (enable per-device)" },
          ].map(item => (
            <View key={item.text} style={styles.doneItem}>
              <Text style={styles.doneItemEmoji}>{item.emoji}</Text>
              <Text style={styles.doneItemText}>{item.text}</Text>
            </View>
          ))}

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>✨ Next steps</Text>
            <Text style={styles.tipText}>
              {`• Add chores from the Chores section\n• Customize limits per-kid\n• Explore the AI features\n• Share your invite link with your co-parent`}
            </Text>
          </View>
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navRow}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, step === 1 && { flex: 1 }]}
          onPress={() => step < STEPS.length ? setStep(s => s + 1) : finish()}
        >
          <Text style={styles.nextBtnText}>{step === STEPS.length ? "Finish Setup ✓" : "Next →"}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stepIndicator: { flexDirection: "row", gap: 8, justifyContent: "center", marginBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, width: 20 },
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginBottom: Spacing.lg, fontWeight: "600" },
  stepTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 6 },
  stepSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  kidCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  kidCardEmoji: { fontSize: 30 },
  kidCardName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  kidCardAge: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  infoCard: { backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#F59E0B" },
  infoText: { fontSize: FontSize.sm, color: "#92400E", lineHeight: 20 },
  tipCard: { backgroundColor: "#F0F9FF", borderRadius: Radius.xl, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: "#BAE6FD" },
  tipTitle: { fontSize: FontSize.sm, fontWeight: "700", color: "#0369A1", marginBottom: 4 },
  tipText: { fontSize: FontSize.xs, color: "#075985", lineHeight: 18 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.md },
  optionCard: { width: "47%", borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center" },
  optionCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLabel: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  optionLabelActive: { color: "#fff" },
  choreItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: Colors.border },
  choreItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "10" },
  choreCheck: { fontSize: 20 },
  choreLabel: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  choreLabelActive: { color: Colors.primary },
  addChoreRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 8 },
  addChoreInput: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base },
  addChoreBtn: { width: 48, height: 48, backgroundColor: Colors.primary, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  addCoreBtnText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  choreSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md },
  bigToggle: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  bigToggleActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "10" },
  bigToggleEmoji: { fontSize: 28 },
  bigToggleTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  bigToggleTitleActive: { color: Colors.primary },
  bigToggleSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  doneCard: { alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.success },
  doneEmoji: { fontSize: 52, marginBottom: 8 },
  doneTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.success },
  doneSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  doneItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  doneItemEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  doneItemText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  navRow: { flexDirection: "row", gap: 10, marginTop: Spacing.xl },
  backBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 },
  backBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.base },
  nextBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
