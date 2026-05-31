/**
 * Feature 17: Context-Aware / Smart Screen Time
 * Automatically adjusts screen time limits based on day/context:
 * - Extends on weekends/holidays
 * - Reduces during exam periods
 * - Smart rules: "if past 9pm on school night → lock non-educational"
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  TextInput, ScrollView, Alert,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, confirmDestructive } from "../../../lib/utils";
import type { SmartScreenTimeRule, SmartRuleTrigger } from "../../../lib/data/types";

const TRIGGER_META: Record<SmartRuleTrigger, { emoji: string; label: string; desc: string }> = {
  weekend:                { emoji: "🏖️", label: "Weekend",            desc: "Saturdays and Sundays" },
  holiday:                { emoji: "🎉", label: "Holiday",            desc: "US public holidays" },
  exam_week:              { emoji: "📚", label: "Exam Week",          desc: "Custom exam dates you set" },
  after_9pm_schoolnight:  { emoji: "🌙", label: "School Night 9pm+",  desc: "Mon–Thu after 9:00 PM" },
  always:                 { emoji: "📋", label: "Always Active",      desc: "Rule applies every day" },
};

const ACTION_META: Record<SmartScreenTimeRule["action"], { emoji: string; label: string; color: string }> = {
  extend:       { emoji: "➕", label: "Extend screen time",         color: Colors.success },
  reduce:       { emoji: "➖", label: "Reduce screen time",          color: Colors.error },
  lock_non_edu: { emoji: "🔒", label: "Lock non-educational apps",  color: Colors.primary },
};

const QUICK_RULES: Omit<SmartScreenTimeRule, "id" | "createdAt" | "kidId">[] = [
  { label: "Weekend +60 min", trigger: "weekend", action: "extend", minutesDelta: 60, enabled: true },
  { label: "Holiday +90 min", trigger: "holiday", action: "extend", minutesDelta: 90, enabled: true },
  { label: "Exam week −30 min", trigger: "exam_week", action: "reduce", minutesDelta: 30, enabled: true },
  { label: "School nights after 9pm: edu-only", trigger: "after_9pm_schoolnight", action: "lock_non_edu", minutesDelta: 0, enabled: true },
];

export default function ContextScreenTimeScreen() {
  const { state, dispatch } = useData();
  const allRules = state.smartScreenTimeRules ?? [];

  const [selectedKid, setSelectedKid] = useState(state.kids[0]?.profile.id ?? "");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [trigger, setTrigger] = useState<SmartRuleTrigger>("weekend");
  const [action, setAction] = useState<SmartScreenTimeRule["action"]>("extend");
  const [minutesDelta, setMinutesDelta] = useState("60");

  function resetForm() {
    setLabel(""); setTrigger("weekend"); setAction("extend"); setMinutesDelta("60"); setEditId(null);
  }

  function openEdit(r: SmartScreenTimeRule) {
    setLabel(r.label); setTrigger(r.trigger); setAction(r.action);
    setMinutesDelta(Math.abs(r.minutesDelta).toString()); setEditId(r.id);
    setShowForm(true);
  }

  function save() {
    if (!label.trim()) { Alert.alert("Please enter a label."); return; }
    const delta = parseInt(minutesDelta, 10) || 0;
    if (editId) {
      dispatch({ type: "SMART_RULE_UPDATE", ruleId: editId, payload: {
        label: label.trim(), trigger, action, minutesDelta: delta, kidId: selectedKid,
      }});
    } else {
      dispatch({ type: "SMART_RULE_ADD", rule: {
        id: uid(), kidId: selectedKid, label: label.trim(),
        trigger, action, minutesDelta: delta, enabled: true, createdAt: nowIso(),
      }});
    }
    setShowForm(false); resetForm();
  }

  function addQuickRule(template: Omit<SmartScreenTimeRule, "id" | "createdAt" | "kidId">) {
    dispatch({ type: "SMART_RULE_ADD", rule: {
      ...template,
      id: uid(), kidId: selectedKid, createdAt: nowIso(),
    }});
  }

  function toggleRule(r: SmartScreenTimeRule) {
    dispatch({ type: "SMART_RULE_UPDATE", ruleId: r.id, payload: { enabled: !r.enabled } });
  }

  function deleteRule(id: string) {
    confirmDestructive("Delete rule?", "", () => dispatch({ type: "SMART_RULE_DELETE", ruleId: id }));
  }

  const kidRules = allRules.filter(r => r.kidId === selectedKid);
  const kid = state.kids.find(k => k.profile.id === selectedKid);

  // Effective limit today = base + smart delta (if applied today)
  const today = new Date().toISOString().split("T")[0];
  const baseLimit = kid?.rules?.dailyLimitMinutes ?? 120;
  const smartDelta = kid?.rules?.smartDeltaDate === today ? (kid?.rules?.smartDeltaMinutes ?? 0) : 0;
  const effectiveLimit = baseLimit + smartDelta;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🧠 Smart Screen Time</Text>
      <Text style={s.sub}>
        Rules that automatically adjust screen time based on day, time, and context.
        Set it once — no more manual holiday adjustments!
      </Text>

      {/* Today's effective limit banner */}
      {kid && (
        <View style={[s.infoCard, smartDelta !== 0 && { backgroundColor: smartDelta > 0 ? "#F0FDF4" : "#FEF2F2", borderColor: smartDelta > 0 ? "#BBF7D0" : "#FECACA" }]}>
          <Text style={s.infoTitle}>
            {smartDelta > 0 ? "➕ Extended today" : smartDelta < 0 ? "➖ Reduced today" : "📋 Today's limit"}
          </Text>
          <Text style={s.infoText}>
            {kid.profile.name}'s effective limit today:{" "}
            <Text style={{ fontWeight: "800" }}>{effectiveLimit} min</Text>
            {smartDelta !== 0 && ` (base ${baseLimit} min ${smartDelta > 0 ? "+" : ""}${smartDelta} min from rules)`}
          </Text>
        </View>
      )}

      {/* How it works */}
      <View style={s.infoCard}>
        <Text style={s.infoTitle}>💡 How it works</Text>
        <Text style={s.infoText}>
          {`• Weekend/Holiday: extends the daily limit automatically\n`}
          {`• Exam week: reduces limit to encourage studying\n`}
          {`• School night after 9pm: locks games, social & video — only edu apps remain\n`}
          {`Rules run every background cycle and apply to the active daily limit.`}
        </Text>
      </View>

      {/* Kid selector */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: Spacing.md }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[s.kidTab, selectedKid === k.profile.id && s.kidTabActive]}
              onPress={() => setSelectedKid(k.profile.id)}
            >
              <Text style={[s.kidTabText, selectedKid === k.profile.id && s.kidTabTextActive]}>{k.profile.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
        <Text style={s.addBtnText}>+ Add Custom Rule</Text>
      </TouchableOpacity>

      {/* Quick start templates */}
      {kidRules.length === 0 && (
        <View style={s.quickSection}>
          <Text style={s.quickTitle}>⚡ Quick Start — Tap to Add</Text>
          {QUICK_RULES.map((t, i) => {
            const trig = TRIGGER_META[t.trigger];
            const act = ACTION_META[t.action];
            const alreadyAdded = allRules.some(r => r.kidId === selectedKid && r.label === t.label);
            return (
              <TouchableOpacity
                key={i}
                style={[s.quickCard, alreadyAdded && s.quickCardAdded]}
                onPress={() => !alreadyAdded && addQuickRule(t)}
                disabled={alreadyAdded}
              >
                <Text style={s.quickEmoji}>{trig.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.quickLabel}>{t.label}</Text>
                  <Text style={s.quickDesc}>{trig.desc} → {act.label}{t.minutesDelta > 0 ? ` (${t.minutesDelta} min)` : ""}</Text>
                </View>
                <Text style={[s.quickAdd, { color: alreadyAdded ? Colors.success : Colors.primary }]}>
                  {alreadyAdded ? "✓" : "+"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Active rules */}
      {kidRules.length > 0 && (
        <>
          <Text style={s.sectionLabel}>{kid?.profile.name ?? "Kid"}'s Rules ({kidRules.length})</Text>
          {kidRules.map(r => {
            const trig = TRIGGER_META[r.trigger];
            const act = ACTION_META[r.action];
            return (
              <View key={r.id} style={s.ruleCard}>
                <View style={s.ruleLeft}>
                  <Text style={s.ruleEmoji}>{trig.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.ruleLabel, !r.enabled && s.ruleLabelDisabled]}>{r.label}</Text>
                    <Text style={s.ruleMeta}>{trig.label} → <Text style={{ color: act.color }}>{act.label}{r.minutesDelta > 0 ? ` (${r.minutesDelta} min)` : ""}</Text></Text>
                  </View>
                </View>
                <View style={s.ruleRight}>
                  <Switch
                    value={r.enabled}
                    onValueChange={() => toggleRule(r)}
                    trackColor={{ true: Colors.primary }}
                  />
                  <TouchableOpacity onPress={() => openEdit(r)}>
                    <Text style={s.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRule(r.id)}>
                    <Text style={s.deleteText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* Inline form */}
      {showForm && (
        <View style={s.formCard}>
          <Text style={s.formTitle}>{editId ? "✏️ Edit Rule" : "➕ New Rule"}</Text>

          <Text style={s.fieldLabel}>Label</Text>
          <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder="e.g. Weekend extension" />

          <Text style={s.fieldLabel}>Trigger</Text>
          <View style={s.optionGrid}>
            {(Object.keys(TRIGGER_META) as SmartRuleTrigger[]).map(k => {
              const m = TRIGGER_META[k];
              return (
                <TouchableOpacity key={k} style={[s.optionChip, trigger === k && s.optionChipActive]} onPress={() => setTrigger(k)}>
                  <Text style={[s.optionChipText, trigger === k && { color: "#fff" }]}>{m.emoji} {m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.fieldLabel}>Action</Text>
          <View style={s.optionGrid}>
            {(["extend", "reduce", "lock_non_edu"] as SmartScreenTimeRule["action"][]).map(a => {
              const m = ACTION_META[a];
              return (
                <TouchableOpacity key={a} style={[s.optionChip, action === a && { backgroundColor: m.color, borderColor: m.color }]} onPress={() => setAction(a)}>
                  <Text style={[s.optionChipText, action === a && { color: "#fff" }]}>{m.emoji} {m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {action !== "lock_non_edu" && (
            <>
              <Text style={s.fieldLabel}>Minutes {action === "extend" ? "to Add" : "to Remove"}</Text>
              <TextInput
                style={s.input}
                value={minutesDelta}
                onChangeText={setMinutesDelta}
                keyboardType="number-pad"
                placeholder="60"
              />
            </>
          )}

          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={save}>
              <Text style={s.saveBtnText}>Save Rule</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  infoCard: { backgroundColor: "#EFF6FF", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#BAE6FD" },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: "#0369A1", marginBottom: 4 },
  infoText: { fontSize: FontSize.xs, color: "#075985", lineHeight: 20 },
  kidTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  kidTabTextActive: { color: "#fff" },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm, marginBottom: Spacing.md },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  quickSection: { marginBottom: Spacing.md },
  quickTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  quickCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  quickCardAdded: { borderColor: Colors.success, backgroundColor: Colors.success + "08" },
  quickEmoji: { fontSize: 28 },
  quickLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  quickDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  quickAdd: { fontSize: 22, fontWeight: "700", width: 24, textAlign: "center" },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  ruleCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  ruleLeft: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  ruleEmoji: { fontSize: 28 },
  ruleLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  ruleLabelDisabled: { color: Colors.textMuted },
  ruleMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  ruleRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  editText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },
  deleteText: { color: Colors.error, fontWeight: "700", fontSize: 18 },
  formCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginTop: Spacing.sm, ...Shadow.md, borderWidth: 1, borderColor: Colors.primary + "30" },
  formTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, marginBottom: 12 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  optionChip: { borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.cardLight },
  optionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionChipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", padding: 12 },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "700" },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 12 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
