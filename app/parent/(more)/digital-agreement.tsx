/**
 * Feature 15: Digital Family Tech Agreement Builder
 * Parent and kids together set the rules → generates a signed "Family Tech Agreement"
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Switch, Alert, Modal, Share,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, confirmDestructive } from "../../../lib/utils";
import type { FamilyAgreement, AgreementRule, AgreementCategory } from "../../../lib/data/types";
import { AGREEMENT_CATEGORY_LABELS } from "../../../lib/data/types";

const RULE_TEMPLATES: { category: AgreementCategory; text: string }[] = [
  { category: "screen_time",  text: "I will not use screens more than __ hours per day on school days." },
  { category: "screen_time",  text: "I will put my phone away during dinner and family time." },
  { category: "social_media", text: "I will not share personal information (address, school) online." },
  { category: "social_media", text: "I will tell a parent if someone online makes me uncomfortable." },
  { category: "gaming",       text: "I will stop gaming when asked without arguing." },
  { category: "gaming",       text: "Homework comes before gaming — every day." },
  { category: "bedtime",      text: "Devices go to a charging station outside my room at bedtime." },
  { category: "bedtime",      text: "No screens after __ pm on school nights." },
  { category: "homework",     text: "I will finish homework before screen time each day." },
  { category: "kindness",     text: "I will be kind and respectful online — no bullying or mean comments." },
  { category: "kindness",     text: "I will not share embarrassing photos of others without permission." },
];

export default function DigitalAgreementScreen() {
  const { state, dispatch } = useData();
  const agreements = state.familyAgreements ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("Our Family Tech Agreement");
  const [rules, setRules] = useState<AgreementRule[]>([]);
  const [newRuleText, setNewRuleText] = useState("");
  const [newRuleCat, setNewRuleCat] = useState<AgreementCategory>("screen_time");
  const [parentSigned, setParentSigned] = useState(false);
  const [selectedKids, setSelectedKids] = useState<string[]>([]);

  function resetForm() {
    setTitle("Our Family Tech Agreement");
    setRules([]);
    setNewRuleText("");
    setNewRuleCat("screen_time");
    setParentSigned(false);
    setSelectedKids([]);
    setEditId(null);
  }

  async function shareAgreement(a: FamilyAgreement) {
    const date = new Date(a.createdAt).toLocaleDateString();
    const signers = [
      a.parentSigned ? "✅ Parent" : "⬜ Parent (not signed)",
      ...state.kids.map(k => {
        const signed = a.kidsSigned?.includes(k.profile.id);
        return (signed ? "✅ " : "⬜ ") + k.profile.name;
      }),
    ].join("\n");
    const ruleLines = a.rules.map((r, i) => {
      const cat = AGREEMENT_CATEGORY_LABELS[r.category];
      return `${i + 1}. [${cat.emoji} ${cat.label}] ${r.text}`;
    }).join("\n");

    const text = [
      "═══════════════════════════════════",
      `📜 ${a.title}`,
      `Created: ${date}`,
      "═══════════════════════════════════",
      "",
      "FAMILY TECH AGREEMENT",
      "We agree to follow these technology rules together:",
      "",
      ruleLines,
      "",
      "─────────────────────────────────",
      "SIGNATURES",
      signers,
      "─────────────────────────────────",
      "",
      "Generated with Spinini Family App",
    ].join("\n");

    try {
      await Share.share({ message: text, title: a.title });
    } catch {
      Alert.alert("Share failed", "Could not open the share sheet.");
    }
  }

  function openEdit(a: FamilyAgreement) {
    setTitle(a.title);
    setRules(a.rules);
    setParentSigned(a.parentSigned);
    setSelectedKids(a.kidsSigned ?? []);
    setEditId(a.id);
    setShowForm(true);
  }

  function addRule(text: string, cat: AgreementCategory) {
    if (!text.trim()) return;
    setRules(prev => [...prev, { id: uid(), category: cat, text: text.trim() }]);
    setNewRuleText("");
  }

  function removeRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id));
  }

  function save() {
    if (!title.trim()) { Alert.alert("Please enter a title."); return; }
    if (rules.length === 0) { Alert.alert("Add at least one rule."); return; }
    if (editId) {
      dispatch({ type: "AGREEMENT_UPDATE", agreementId: editId, payload: {
        title: title.trim(), rules, parentSigned,
        kidsSigned: selectedKids,
      }});
    } else {
      const agreement: FamilyAgreement = {
        id: uid(), title: title.trim(), rules,
        createdAt: nowIso(), parentSigned,
        kidsSigned: selectedKids,
      };
      dispatch({ type: "AGREEMENT_ADD", agreement });
    }
    setShowForm(false);
    resetForm();
  }

  function remove(id: string) {
    confirmDestructive("Delete agreement?", "This cannot be undone.", () =>
      dispatch({ type: "AGREEMENT_DELETE", agreementId: id })
    );
  }

  const catKeys = Object.keys(AGREEMENT_CATEGORY_LABELS) as AgreementCategory[];

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🤝 Family Tech Agreement</Text>
      <Text style={s.sub}>
        Build rules together with your kids — research shows kids follow rules they helped create.
        Generate a signed family agreement in seconds.
      </Text>

      <View style={s.infoCard}>
        <Text style={s.infoTitle}>💡 Why this works</Text>
        <Text style={s.infoText}>
          Studies show that children who participate in rule-making are 3× more likely to follow them.
          A signed agreement creates accountability for the whole family — parents included.
        </Text>
      </View>

      <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setShowForm(true); }}>
        <Text style={s.addBtnText}>+ Create New Agreement</Text>
      </TouchableOpacity>

      {agreements.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📜</Text>
          <Text style={s.emptyText}>No agreements yet.</Text>
          <Text style={s.emptySub}>Sit down with your family and build your first tech agreement together!</Text>
        </View>
      )}

      {agreements.map(a => {
        const signedCount = (a.kidsSigned ?? []).length;
        const totalKids = state.kids.length;
        const allSigned = a.parentSigned && signedCount === totalKids;
        return (
          <View key={a.id} style={s.agreementCard}>
            <View style={s.agreementHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.agreementTitle}>{a.title}</Text>
                <Text style={s.agreementMeta}>{a.rules.length} rules · {new Date(a.createdAt).toLocaleDateString()}</Text>
              </View>
              {allSigned ? (
                <View style={s.signedBadge}><Text style={s.signedBadgeText}>✅ All Signed</Text></View>
              ) : (
                <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>⏳ Pending</Text></View>
              )}
            </View>

            {/* Signatures */}
            <View style={s.sigRow}>
              <View style={[s.sigChip, a.parentSigned && s.sigChipSigned]}>
                <Text style={s.sigText}>{a.parentSigned ? "✓ " : "○ "}Parent</Text>
              </View>
              {state.kids.map(k => {
                const signed = (a.kidsSigned ?? []).includes(k.profile.id);
                return (
                  <View key={k.profile.id} style={[s.sigChip, signed && s.sigChipSigned]}>
                    <Text style={s.sigText}>{signed ? "✓ " : "○ "}{k.profile.name}</Text>
                  </View>
                );
              })}
            </View>

            {/* Rules preview */}
            {a.rules.slice(0, 3).map(r => {
              const cat = AGREEMENT_CATEGORY_LABELS[r.category];
              return (
                <View key={r.id} style={s.rulePreviewRow}>
                  <Text>{cat.emoji}</Text>
                  <Text style={s.rulePreviewText} numberOfLines={1}>{r.text}</Text>
                </View>
              );
            })}
            {a.rules.length > 3 && (
              <Text style={s.moreRules}>+{a.rules.length - 3} more rules…</Text>
            )}

            <View style={s.cardActions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(a)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.printBtn} onPress={() => shareAgreement(a)}>
                <Text style={s.printBtnText}>📤 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => remove(a.id)}>
                <Text style={s.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => { setShowForm(false); resetForm(); }}>
        <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
          <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{editId ? "✏️ Edit Agreement" : "📜 New Agreement"}</Text>

            <Text style={s.fieldLabel}>Agreement Title</Text>
            <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Our Family Tech Agreement" />

            <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>Parent Signs This Agreement</Text>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>✍️ I agree to follow these rules too</Text>
              <Switch value={parentSigned} onValueChange={setParentSigned} trackColor={{ true: Colors.primary }} />
            </View>

            {state.kids.length > 0 && (
              <>
                <Text style={[s.fieldLabel, { marginTop: Spacing.sm }]}>Kids Who Agree</Text>
                {state.kids.map(k => (
                  <View key={k.profile.id} style={s.switchRow}>
                    <Text style={s.switchLabel}>{k.profile.name} agrees ✍️</Text>
                    <Switch
                      value={selectedKids.includes(k.profile.id)}
                      onValueChange={v => setSelectedKids(prev => v ? [...prev, k.profile.id] : prev.filter(id => id !== k.profile.id))}
                      trackColor={{ true: Colors.success }}
                    />
                  </View>
                ))}
              </>
            )}

            <Text style={[s.fieldLabel, { marginTop: Spacing.md }]}>Rules ({rules.length})</Text>

            {rules.map((r, i) => {
              const cat = AGREEMENT_CATEGORY_LABELS[r.category];
              return (
                <View key={r.id} style={s.ruleRow}>
                  <Text style={s.ruleNum}>{i + 1}.</Text>
                  <Text style={s.ruleCatEmoji}>{cat.emoji}</Text>
                  <Text style={s.ruleRowText} numberOfLines={2}>{r.text}</Text>
                  <TouchableOpacity onPress={() => removeRule(r.id)} style={s.removeRuleBtn}>
                    <Text style={s.removeRuleBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add custom rule */}
            <View style={s.addRuleBox}>
              <Text style={s.addRuleTitle}>Add a Rule</Text>
              <Text style={s.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }}>
                {catKeys.map(k => {
                  const meta = AGREEMENT_CATEGORY_LABELS[k];
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[s.catChip, newRuleCat === k && s.catChipActive]}
                      onPress={() => setNewRuleCat(k)}
                    >
                      <Text style={[s.catChipText, newRuleCat === k && { color: "#fff" }]}>{meta.emoji} {meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={[s.input, { minHeight: 60, textAlignVertical: "top" }]}
                value={newRuleText}
                onChangeText={setNewRuleText}
                placeholder="Write the rule here…"
                multiline
              />
              <TouchableOpacity style={s.addRuleBtn} onPress={() => addRule(newRuleText, newRuleCat)}>
                <Text style={s.addRuleBtnText}>+ Add This Rule</Text>
              </TouchableOpacity>
            </View>

            {/* Templates */}
            <Text style={[s.fieldLabel, { marginTop: Spacing.md }]}>💡 Suggested Rules (tap to add)</Text>
            {RULE_TEMPLATES.map((t, i) => {
              const cat = AGREEMENT_CATEGORY_LABELS[t.category];
              const alreadyAdded = rules.some(r => r.text === t.text);
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.templateRow, alreadyAdded && s.templateRowAdded]}
                  onPress={() => !alreadyAdded && setRules(prev => [...prev, { id: uid(), category: t.category, text: t.text }])}
                  disabled={alreadyAdded}
                >
                  <Text>{cat.emoji}</Text>
                  <Text style={s.templateText} numberOfLines={2}>{t.text}</Text>
                  <Text style={s.templateAdd}>{alreadyAdded ? "✓" : "+"}</Text>
                </TouchableOpacity>
              );
            })}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={save}>
                <Text style={s.saveBtnText}>Save Agreement</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  infoCard: { backgroundColor: "#EFF6FF", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#BAE6FD" },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: "#0369A1", marginBottom: 4 },
  infoText: { fontSize: FontSize.xs, color: "#075985", lineHeight: 18 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm, marginBottom: Spacing.md },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  empty: { alignItems: "center", padding: Spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 20 },
  agreementCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 12, ...Shadow.sm, gap: 8 },
  agreementHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  agreementTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  agreementMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  signedBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.success },
  signedBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.success },
  pendingBadge: { backgroundColor: Colors.secondary + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.secondary },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: Colors.secondary },
  sigRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sigChip: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.cardLight, borderWidth: 1, borderColor: Colors.border },
  sigChipSigned: { backgroundColor: Colors.success + "20", borderColor: Colors.success },
  sigText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  rulePreviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rulePreviewText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },
  moreRules: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: "italic" },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  editBtn: { flex: 1, backgroundColor: Colors.primary + "15", borderRadius: Radius.full, alignItems: "center", padding: 8 },
  editBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  printBtn: { flex: 1, backgroundColor: "#7C3AED" + "15", borderRadius: Radius.full, alignItems: "center", padding: 8 },
  printBtnText: { color: "#7C3AED", fontWeight: "700", fontSize: FontSize.sm },
  deleteBtn: { flex: 1, backgroundColor: Colors.error + "12", borderRadius: Radius.full, alignItems: "center", padding: 8 },
  deleteBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  // Modal
  modalContent: { padding: Spacing.md, paddingBottom: 60 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, marginBottom: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 8 },
  switchLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 6 },
  ruleNum: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textMuted, width: 20 },
  ruleCatEmoji: { fontSize: 16 },
  ruleRowText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  removeRuleBtn: { padding: 4 },
  removeRuleBtnText: { color: Colors.error, fontWeight: "700", fontSize: 16 },
  addRuleBox: { backgroundColor: "#F8FAFC", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  addRuleTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 6, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  addRuleBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 10 },
  addRuleBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  templateRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  templateRowAdded: { borderColor: Colors.success, backgroundColor: Colors.success + "10" },
  templateText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  templateAdd: { fontSize: 20, fontWeight: "700", color: Colors.primary, width: 20, textAlign: "center" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", padding: 14 },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "700" },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 14 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
