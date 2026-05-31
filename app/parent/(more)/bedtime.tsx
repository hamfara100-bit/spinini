import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Modal, Switch, Alert,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS, BedtimeSoftLock } from "../../../lib/data/types";
import { Mascot } from "../../../components/mascot";
import { isInBedtimeSoftLock } from "../../../lib/data/logic";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function fmt12(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${ampm}`;
}

// ─── Time Picker Row ──────────────────────────────────────────────────────────

function TimePicker({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const hour = parseInt(value.split(":")[0]) || 0;
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={p.fieldLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={p.timeScroll}
        contentContainerStyle={{ gap: 6 }}
      >
        {HOURS.map(h => (
          <TouchableOpacity
            key={h}
            style={[p.timeBtn, hour === h && p.timeBtnActive]}
            onPress={() => onChange(`${String(h).padStart(2, "0")}:00`)}
          >
            <Text style={[p.timeBtnText, hour === h && p.timeBtnTextActive]}>{fmt12(h)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Day Selector ─────────────────────────────────────────────────────────────

function DaySelector({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  function toggle(d: number) {
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d]);
  }
  return (
    <View style={p.dayRow}>
      {DAYS.map((d, i) => (
        <TouchableOpacity
          key={d}
          style={[p.dayBtn, value.includes(i) && p.dayBtnActive]}
          onPress={() => toggle(i)}
        >
          <Text style={[p.dayText, value.includes(i) && p.dayTextActive]}>{d}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Per-kid edit modal ───────────────────────────────────────────────────────

function EditModal({ kid, onClose }: { kid: any; onClose: () => void }) {
  const { dispatch } = useData();
  const kidId = kid.profile.id;
  const cfg: BedtimeSoftLock = kid.rules?.bedtimeSoftLock ?? {
    enabled: false, start: "20:00", end: "07:00",
    days: [0,1,2,3,4,5,6], message: "It's bedtime! 🌙 You can listen to stories and sleep sounds.",
  };

  const [enabled, setEnabled] = useState(cfg.enabled);
  const [start, setStart] = useState(cfg.start);
  const [end, setEnd] = useState(cfg.end);
  const [days, setDays] = useState<number[]>(cfg.days);
  const [message, setMessage] = useState(cfg.message);

  function save() {
    if (days.length === 0) { Alert.alert("Pick days", "Select at least one day for bedtime mode."); return; }
    dispatch({
      type: "SET_BEDTIME_SOFT_LOCK",
      kidId,
      payload: { enabled, start, end, days, message: message.trim() || cfg.message },
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
        {/* Header */}
        <View style={p.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={p.backBtn}>Cancel</Text>
          </TouchableOpacity>
          <Text style={p.modalTitle}>🌙 Bedtime Mode</Text>
          <TouchableOpacity onPress={save}>
            <Text style={p.saveBtn}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={p.modalScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Kid name */}
          <Text style={p.kidName}>{kid.profile.name}</Text>

          {/* Enable toggle */}
          <View style={p.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={p.toggleLabel}>🌙 Enable Bedtime Mode</Text>
              <Text style={p.toggleSub}>
                When active, {kid.profile.name}'s phone will only show Stories and Sleep Sounds.
                All other features are hidden until morning.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: Colors.border, true: "#7C5CFF99" }}
              thumbColor={enabled ? Colors.primary : "#ccc"}
            />
          </View>

          {enabled && (
            <>
              {/* Time range */}
              <View style={p.section}>
                <Text style={p.sectionTitle}>⏰ Time Window</Text>
                <TimePicker label="Bedtime starts at" value={start} onChange={setStart} />
                <TimePicker label="Normal access resumes at" value={end} onChange={setEnd} />
                <View style={p.timePreview}>
                  <Text style={p.timePreviewText}>
                    🌙 Bedtime: {fmt12(parseInt(start))} → ☀️ Wake: {fmt12(parseInt(end))}
                  </Text>
                </View>
              </View>

              {/* Days */}
              <View style={p.section}>
                <Text style={p.sectionTitle}>📅 Active Days</Text>
                <DaySelector value={days} onChange={setDays} />
                <TouchableOpacity
                  style={p.allDaysBtn}
                  onPress={() => setDays(days.length === 7 ? [] : [0,1,2,3,4,5,6])}
                >
                  <Text style={p.allDaysBtnText}>{days.length === 7 ? "Clear all days" : "Select all days"}</Text>
                </TouchableOpacity>
              </View>

              {/* Message */}
              <View style={p.section}>
                <Text style={p.sectionTitle}>💬 Message to {kid.profile.name}</Text>
                <TextInput
                  style={p.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="e.g. Time to wind down! Only stories and sounds tonight."
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* What's allowed */}
              <View style={p.allowedBox}>
                <Text style={p.allowedTitle}>✅ Always available during bedtime</Text>
                <View style={p.allowedRow}>
                  <View style={p.allowedItem}>
                    <Text style={p.allowedEmoji}>🌙</Text>
                    <Text style={p.allowedName}>Bedtime Stories</Text>
                  </View>
                  <View style={p.allowedItem}>
                    <Text style={p.allowedEmoji}>🎵</Text>
                    <Text style={p.allowedName}>Sleep Sounds</Text>
                  </View>
                </View>
                <Text style={p.allowedNote}>Everything else is hidden until bedtime ends.</Text>
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Per-kid card ─────────────────────────────────────────────────────────────

function KidBedtimeCard({ kid, onEdit }: { kid: any; onEdit: () => void }) {
  const bg = PASTEL_COLORS[kid.profile.color as keyof typeof PASTEL_COLORS] ?? "#F0EDFF";
  const cfg: BedtimeSoftLock | undefined = kid.rules?.bedtimeSoftLock;
  const isActive = isInBedtimeSoftLock(kid);

  return (
    <TouchableOpacity style={[s.kidCard, { backgroundColor: bg }]} onPress={onEdit} activeOpacity={0.85}>
      <Mascot type={kid.profile.mascot} size={52} animate={false} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.kidName}>{kid.profile.name}</Text>

        {cfg?.enabled ? (
          <>
            <Text style={s.kidTime}>
              🌙 {fmt12(parseInt(cfg.start))} → ☀️ {fmt12(parseInt(cfg.end))}
            </Text>
            <Text style={s.kidDays}>
              {cfg.days.length === 7 ? "Every night" : cfg.days.map(d => DAYS[d]).join(", ")}
            </Text>
          </>
        ) : (
          <Text style={s.kidOff}>Bedtime mode is off</Text>
        )}
      </View>

      <View style={{ alignItems: "flex-end", gap: 6 }}>
        {cfg?.enabled && (
          <View style={[s.statusBadge, { backgroundColor: isActive ? "#7C5CFF" : Colors.border }]}>
            <Text style={[s.statusText, { color: isActive ? "#fff" : Colors.textMuted }]}>
              {isActive ? "🌙 Active now" : "⏳ Waiting"}
            </Text>
          </View>
        )}
        <Text style={s.editHint}>Tap to edit →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BedtimeScreen() {
  const { state } = useData();
  const [editingKidId, setEditingKidId] = useState<string | null>(null);

  const editingKid = state.kids.find(k => k.profile.id === editingKidId);
  const activeCount = state.kids.filter(k => isInBedtimeSoftLock(k)).length;
  const enabledCount = state.kids.filter(k => k.rules?.bedtimeSoftLock?.enabled).length;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🌙 Bedtime Mode</Text>

      {/* Summary */}
      <View style={s.summaryCard}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{enabledCount}</Text>
          <Text style={s.summaryLbl}>Configured</Text>
        </View>
        <View style={s.summaryDiv} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{activeCount}</Text>
          <Text style={s.summaryLbl}>Active now 🌙</Text>
        </View>
        <View style={s.summaryDiv} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{state.kids.length - enabledCount}</Text>
          <Text style={s.summaryLbl}>Not set up</Text>
        </View>
      </View>

      {/* Info box */}
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>🌙 What is Bedtime Mode?</Text>
        <Text style={s.infoText}>
          At the time you set, your child's home screen switches to a calm night-time view.
          Only <Text style={{ fontWeight: "800" }}>Bedtime Stories</Text> and{" "}
          <Text style={{ fontWeight: "800" }}>Sleep Sounds</Text> are accessible — everything
          else is hidden until morning. Great for winding down without a full lock.
        </Text>
      </View>

      {/* Kids */}
      {state.kids.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 52 }}>🌙</Text>
          <Text style={s.emptyTitle}>No kids yet</Text>
          <Text style={s.emptySub}>Add a kid profile to configure bedtime mode.</Text>
        </View>
      ) : (
        state.kids.map(kid => (
          <KidBedtimeCard key={kid.profile.id} kid={kid} onEdit={() => setEditingKidId(kid.profile.id)} />
        ))
      )}

      <View style={{ height: 32 }} />

      {editingKid && (
        <EditModal kid={editingKid} onClose={() => setEditingKidId(null)} />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  summaryCard: {
    flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md, alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  summaryLbl: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  summaryDiv: { width: 1, height: 36, backgroundColor: Colors.border },
  infoBox: {
    backgroundColor: "#7C5CFF12", borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  infoText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  kidCard: {
    flexDirection: "row", alignItems: "center", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  kidName: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  kidTime: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  kidDays: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  kidOff: { fontSize: FontSize.sm, color: Colors.textMuted },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: "700" },
  editHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
});

const p = StyleSheet.create({
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
    backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base },
  saveBtn: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  modalTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },
  modalScroll: { padding: Spacing.lg },
  kidName: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md, textAlign: "center" },
  toggleCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 12,
  },
  toggleLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  toggleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  section: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase" },
  timeScroll: { maxHeight: 42, marginBottom: Spacing.sm },
  timeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  timeBtnActive: { backgroundColor: Colors.primary },
  timeBtnText: { fontSize: 11, fontWeight: "600", color: Colors.textSecondary },
  timeBtnTextActive: { color: "#fff" },
  timePreview: {
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    padding: 10, alignItems: "center", marginTop: 4,
  },
  timePreviewText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  dayRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  dayBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayText: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  dayTextActive: { color: "#fff" },
  allDaysBtn: { alignSelf: "center", paddingVertical: 6 },
  allDaysBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700" },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: FontSize.sm, color: Colors.textPrimary,
    backgroundColor: Colors.bgLight, minHeight: 70, textAlignVertical: "top",
  },
  allowedBox: {
    backgroundColor: Colors.success + "15", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success + "40",
  },
  allowedTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.success, marginBottom: Spacing.sm },
  allowedRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  allowedItem: { flex: 1, alignItems: "center", backgroundColor: "#fff", borderRadius: Radius.lg, padding: 12, gap: 6 },
  allowedEmoji: { fontSize: 32 },
  allowedName: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  allowedNote: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center" },
});
