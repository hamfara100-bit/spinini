import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, Switch,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS } from "../../../lib/data/types";
import { uid, nowIso } from "../../../lib/utils";
import { Mascot } from "../../../components/mascot";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length >= 4) return `***-***-${digits.slice(-4)}`;
  return `***-${digits}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Add Number Modal ─────────────────────────────────────────────────────────

function AddNumberModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: (number: string) => void;
}) {
  const [value, setValue] = useState("");

  function save() {
    const trimmed = value.trim();
    if (!trimmed) { Alert.alert("Enter a number", "Please type a phone number to allow."); return; }
    onAdd(trimmed);
    setValue("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <Text style={m.title}>✅ Allow a Number</Text>
          <Text style={m.sub}>
            Calls and texts from this number will always get through, even when blocking is on.
          </Text>
          <TextInput
            style={m.input}
            value={value}
            onChangeText={setValue}
            placeholder="e.g. 0412 345 678 or +61412345678"
            keyboardType="phone-pad"
            autoFocus
          />
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={() => { setValue(""); onClose(); }}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.saveBtn} onPress={save}>
              <Text style={m.saveText}>Add Number</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Demo Block Entry (for testing) ──────────────────────────────────────

function addDemoEntry(kidId: string, dispatch: any) {
  const types = ["call", "text"] as const;
  const numbers = ["Unknown", "***-***-8841", "***-***-0023", "Private Number"];
  dispatch({
    type: "BLOCKED_LOG_ADD",
    kidId,
    entry: {
      id: uid(),
      type: types[Math.floor(Math.random() * 2)],
      numberMasked: numbers[Math.floor(Math.random() * numbers.length)],
      timestamp: nowIso(),
    },
  });
}

// ─── Per-kid Guard Card ───────────────────────────────────────────────────────

function KidGuardCard({ kid, onManage }: { kid: any; onManage: () => void }) {
  const guard = kid.commGuard ?? { blockUnknownCalls: false, blockUnknownTexts: false, allowedNumbers: [] };
  const bg = PASTEL_COLORS[kid.profile.color as keyof typeof PASTEL_COLORS] ?? "#F0EDFF";
  const isActive = guard.blockUnknownCalls || guard.blockUnknownTexts;
  const emergencyActive = guard.emergencyUnlockExpiresAt && new Date(guard.emergencyUnlockExpiresAt) > new Date();

  return (
    <TouchableOpacity style={[s.kidCard, { backgroundColor: bg }]} onPress={onManage} activeOpacity={0.85}>
      <Mascot type={kid.profile.mascot} size={48} animate={false} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.kidName}>{kid.profile.name}</Text>
        <View style={s.badgeRow}>
          {guard.blockUnknownCalls ? (
            <View style={[s.badge, { backgroundColor: Colors.error + "20" }]}>
              <Text style={[s.badgeText, { color: Colors.error }]}>📵 Calls blocked</Text>
            </View>
          ) : (
            <View style={[s.badge, { backgroundColor: Colors.border }]}>
              <Text style={[s.badgeText, { color: Colors.textMuted }]}>Calls: off</Text>
            </View>
          )}
          {guard.blockUnknownTexts ? (
            <View style={[s.badge, { backgroundColor: Colors.error + "20" }]}>
              <Text style={[s.badgeText, { color: Colors.error }]}>🚫 Texts blocked</Text>
            </View>
          ) : (
            <View style={[s.badge, { backgroundColor: Colors.border }]}>
              <Text style={[s.badgeText, { color: Colors.textMuted }]}>Texts: off</Text>
            </View>
          )}
        </View>
        {guard.allowedNumbers.length > 0 && (
          <Text style={s.allowedCount}>✅ {guard.allowedNumbers.length} allowed number{guard.allowedNumbers.length !== 1 ? "s" : ""}</Text>
        )}
        {emergencyActive && (
          <Text style={s.emergencyBadge}>🔓 Emergency unlock active</Text>
        )}
      </View>
      <View style={[s.statusDot, { backgroundColor: emergencyActive ? Colors.warning : isActive ? Colors.error : Colors.success }]} />
    </TouchableOpacity>
  );
}

// ─── Kid Detail Modal ─────────────────────────────────────────────────────────

function KidDetailModal({ kid, dispatch, onClose }: { kid: any; dispatch: any; onClose: () => void }) {
  const guard = kid.commGuard ?? { blockUnknownCalls: false, blockUnknownTexts: false, allowedNumbers: [] };
  const [tab, setTab] = useState<"settings" | "whitelist" | "school" | "log">("settings");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [emergencyCode, setEmergencyCode] = useState<string>(guard.emergencyUnlockCode ?? "");
  const [codeSaved, setCodeSaved] = useState(false);
  const kidId = kid.profile.id;

  const schoolContacts: string[] = guard.schoolTimeContacts ?? [];

  const emergencyActive = guard.emergencyUnlockExpiresAt && new Date(guard.emergencyUnlockExpiresAt) > new Date();
  const emergencyExpiry = guard.emergencyUnlockExpiresAt
    ? new Date(guard.emergencyUnlockExpiresAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  function saveEmergencyCode() {
    const trimmed = emergencyCode.trim();
    dispatch({ type: "COMM_GUARD_UPDATE", kidId, payload: { emergencyUnlockCode: trimmed || undefined } });
    setCodeSaved(true);
    setTimeout(() => setCodeSaved(false), 2000);
  }

  function activateEmergency() {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    dispatch({ type: "COMM_EMERGENCY_ACTIVATE", kidId, expiresAt });
    Alert.alert("Emergency Unlock Active", `All calls and texts are allowed for ${kid.profile.name} for the next 24 hours.`);
  }

  function deactivateEmergency() {
    Alert.alert("Deactivate Emergency Unlock?", "This will re-enable call/text blocking.", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => dispatch({ type: "COMM_EMERGENCY_DEACTIVATE", kidId }) },
    ]);
  }

  function toggle(field: "blockUnknownCalls" | "blockUnknownTexts") {
    dispatch({ type: "COMM_GUARD_UPDATE", kidId, payload: { [field]: !guard[field] } });
  }

  function removeNumber(number: string) {
    Alert.alert("Remove number?", `Remove "${number}" from the allowed list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "COMM_WHITELIST_REMOVE", kidId, number }) },
    ]);
  }

  function removeSchoolContact(contact: string) {
    Alert.alert("Remove contact?", `Remove "${contact}" from School Time bypass?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "SCHOOL_TIME_CONTACT_REMOVE", kidId, contact }) },
    ]);
  }

  const blockedLog = kid.blockedLog ?? [];

  const TAB_DEFS = [
    { id: "settings" as const, label: "⚙️ Settings" },
    { id: "whitelist" as const, label: `✅ Allowed (${guard.allowedNumbers.length})` },
    { id: "school" as const, label: `🏫 School (${schoolContacts.length})` },
    { id: "log" as const, label: `📋 Log (${blockedLog.length})` },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
        {/* Header */}
        <View style={d.header}>
          <TouchableOpacity onPress={onClose} style={d.backBtn}>
            <Text style={d.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={d.heading}>📵 Call & Text Guard</Text>
          <Text style={d.subheading}>{kid.profile.name}</Text>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={d.tabsScroll} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          <View style={d.tabs}>
            {TAB_DEFS.map(t => (
              <TouchableOpacity key={t.id} style={[d.tab, tab === t.id && d.tabActive]} onPress={() => setTab(t.id)}>
                <Text style={[d.tabText, tab === t.id && d.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <ScrollView contentContainerStyle={d.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Settings tab ── */}
          {tab === "settings" && (
            <>
              <View style={d.infoBox}>
                <Text style={d.infoTitle}>ℹ️ How it works</Text>
                <Text style={d.infoBody}>
                  When enabled, {kid.profile.name}'s phone will automatically block any incoming call or text
                  from a number that is not saved in their contacts or your allowed list. Saved contacts
                  and numbers you whitelist will always get through.{"\n\n"}
                  On iOS this uses Screen Time's Communication Limits. On Android it uses the call-screening
                  and messaging API. Full enforcement requires the Spinini companion app to be set as the
                  default Phone and SMS app on {kid.profile.name}'s device.
                </Text>
              </View>

              {/* Block calls toggle */}
              <View style={d.toggleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={d.toggleLabel}>📵 Block Unknown Calls</Text>
                  <Text style={d.toggleSub}>
                    Incoming calls from numbers not in contacts or the allowed list will be auto-declined.
                  </Text>
                </View>
                <Switch
                  value={guard.blockUnknownCalls}
                  onValueChange={() => toggle("blockUnknownCalls")}
                  trackColor={{ false: Colors.border, true: Colors.error + "99" }}
                  thumbColor={guard.blockUnknownCalls ? Colors.error : "#ccc"}
                />
              </View>

              {/* Block texts toggle */}
              <View style={d.toggleCard}>
                <View style={{ flex: 1 }}>
                  <Text style={d.toggleLabel}>🚫 Block Unknown Texts</Text>
                  <Text style={d.toggleSub}>
                    SMS messages from unknown numbers are filtered out. They won't appear in{" "}
                    {kid.profile.name}'s inbox.
                  </Text>
                </View>
                <Switch
                  value={guard.blockUnknownTexts}
                  onValueChange={() => toggle("blockUnknownTexts")}
                  trackColor={{ false: Colors.border, true: Colors.error + "99" }}
                  thumbColor={guard.blockUnknownTexts ? Colors.error : "#ccc"}
                />
              </View>

              {guard.blockUnknownCalls || guard.blockUnknownTexts ? (
                <View style={d.activeAlert}>
                  <Text style={d.activeAlertText}>
                    🛡️ Guard is active — only known contacts and allowed numbers can reach {kid.profile.name}.
                  </Text>
                </View>
              ) : (
                <View style={[d.activeAlert, { backgroundColor: Colors.border }]}>
                  <Text style={[d.activeAlertText, { color: Colors.textSecondary }]}>
                    Guard is off — all calls and texts are allowed.
                  </Text>
                </View>
              )}

              {/* ── Emergency Unlock ── */}
              <View style={d.emergencyCard}>
                <Text style={d.emergencyTitle}>🚨 Lost Phone Emergency Unlock</Text>
                <Text style={d.emergencyBody}>
                  If you ever lose your phone, you can unlock {kid.profile.name}'s device to accept calls
                  from any number for 24 hours — just by texting this secret code from any phone.
                  {"\n\n"}The code is case-sensitive. Don't share it with anyone else.
                </Text>

                {emergencyActive && (
                  <View style={d.emergencyActiveBox}>
                    <Text style={d.emergencyActiveText}>🔓 Emergency unlock is ACTIVE</Text>
                    <Text style={d.emergencyActiveSub}>All calls allowed until {emergencyExpiry}</Text>
                    <TouchableOpacity style={d.deactivateBtn} onPress={deactivateEmergency}>
                      <Text style={d.deactivateBtnText}>Deactivate Now</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={d.emergencyLabel}>Secret unlock code (max 20 chars)</Text>
                <View style={d.emergencyInputRow}>
                  <TextInput
                    style={d.emergencyInput}
                    value={emergencyCode}
                    onChangeText={t => setEmergencyCode(t.slice(0, 20))}
                    placeholder="e.g. OPENMYPHONE99"
                    maxLength={20}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={d.charCount}>{emergencyCode.length}/20</Text>
                </View>
                <View style={d.emergencyBtnRow}>
                  <TouchableOpacity
                    style={[d.saveCodeBtn, !emergencyCode.trim() && { opacity: 0.4 }]}
                    onPress={saveEmergencyCode}
                    disabled={!emergencyCode.trim()}
                  >
                    <Text style={d.saveCodeBtnText}>{codeSaved ? "✓ Saved!" : "💾 Save Code"}</Text>
                  </TouchableOpacity>
                  {guard.emergencyUnlockCode && !emergencyActive && (
                    <TouchableOpacity style={d.testBtn} onPress={activateEmergency}>
                      <Text style={d.testBtnText}>🧪 Test (Activate Now)</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {guard.emergencyUnlockCode && (
                  <Text style={d.emergencyHint}>
                    Current code: <Text style={{ fontWeight: "800" }}>"{guard.emergencyUnlockCode}"</Text>
                    {"\n"}To use: text this exact phrase from any number to {kid.profile.name}'s phone.
                  </Text>
                )}
              </View>

              {/* Demo button for testing */}
              <TouchableOpacity style={d.demoBtn} onPress={() => addDemoEntry(kidId, dispatch)}>
                <Text style={d.demoBtnText}>+ Simulate a blocked contact (demo)</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Whitelist tab ── */}
          {tab === "whitelist" && (
            <>
              <View style={d.infoBox}>
                <Text style={d.infoTitle}>✅ Allowed Numbers</Text>
                <Text style={d.infoBody}>
                  Numbers on this list can always reach {kid.profile.name}, even when blocking is enabled.
                  Add family members, coaches, teachers, or any trusted number here.
                </Text>
              </View>

              {guard.allowedNumbers.length === 0 ? (
                <View style={d.empty}>
                  <Text style={{ fontSize: 48 }}>📞</Text>
                  <Text style={d.emptyTitle}>No allowed numbers yet</Text>
                  <Text style={d.emptySub}>Add numbers that should always get through.</Text>
                </View>
              ) : (
                guard.allowedNumbers.map((num: string) => (
                  <View key={num} style={d.numberCard}>
                    <Text style={d.numberEmoji}>✅</Text>
                    <Text style={d.numberText}>{num}</Text>
                    <TouchableOpacity onPress={() => removeNumber(num)} style={d.removeBtn}>
                      <Text style={d.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity style={d.addBtn} onPress={() => setShowAdd(true)}>
                <Text style={d.addBtnText}>+ Add Allowed Number</Text>
              </TouchableOpacity>

              <AddNumberModal
                visible={showAdd}
                onClose={() => setShowAdd(false)}
                onAdd={(number) => dispatch({ type: "COMM_WHITELIST_ADD", kidId, number })}
              />
            </>
          )}

          {/* ── School Time Bypass tab ── */}
          {tab === "school" && (
            <>
              <View style={d.infoBox}>
                <Text style={d.infoTitle}>🏫 School Time Bypass</Text>
                <Text style={d.infoBody}>
                  Contacts added here can call or text {kid.profile.name} even during Study Mode,
                  downtime windows, or when the device is locked. Perfect for parents, teachers,
                  coaches, or anyone who must always be reachable during school hours.
                </Text>
              </View>

              {schoolContacts.length === 0 ? (
                <View style={d.empty}>
                  <Text style={{ fontSize: 48 }}>🏫</Text>
                  <Text style={d.emptyTitle}>No bypass contacts yet</Text>
                  <Text style={d.emptySub}>
                    Add names or numbers that can always reach {kid.profile.name} during school mode.
                  </Text>
                </View>
              ) : (
                schoolContacts.map((contact: string) => (
                  <View key={contact} style={[d.numberCard, { borderLeftColor: "#2563EB", borderLeftWidth: 3 }]}>
                    <Text style={d.numberEmoji}>🏫</Text>
                    <Text style={[d.numberText, { flex: 1 }]}>{contact}</Text>
                    <TouchableOpacity onPress={() => removeSchoolContact(contact)} style={d.removeBtn}>
                      <Text style={d.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity style={[d.addBtn, { backgroundColor: "#2563EB" }]} onPress={() => setShowAddSchool(true)}>
                <Text style={d.addBtnText}>+ Add School Time Contact</Text>
              </TouchableOpacity>

              <AddNumberModal
                visible={showAddSchool}
                onClose={() => setShowAddSchool(false)}
                onAdd={(contact) => dispatch({ type: "SCHOOL_TIME_CONTACT_ADD", kidId, contact })}
              />

              <View style={[d.infoBox, { marginTop: 12, backgroundColor: "#2563EB" + "10" }]}>
                <Text style={[d.infoTitle, { color: "#2563EB" }]}>💡 Tip</Text>
                <Text style={d.infoBody}>
                  You can enter a phone number (e.g. 0412 345 678) or a contact name as it
                  appears on {kid.profile.name}'s device. The companion app will match either.
                </Text>
              </View>
            </>
          )}

          {/* ── Block log tab ── */}
          {tab === "log" && (
            <>
              {blockedLog.length > 0 && (
                <TouchableOpacity
                  style={d.clearBtn}
                  onPress={() => Alert.alert("Clear log?", "This will delete all block history for this kid.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: () => dispatch({ type: "BLOCKED_LOG_CLEAR", kidId }) },
                  ])}
                >
                  <Text style={d.clearBtnText}>🗑 Clear log</Text>
                </TouchableOpacity>
              )}

              {blockedLog.length === 0 ? (
                <View style={d.empty}>
                  <Text style={{ fontSize: 48 }}>🛡️</Text>
                  <Text style={d.emptyTitle}>No blocked contacts yet</Text>
                  <Text style={d.emptySub}>
                    When unknown calls or texts are blocked, they'll appear here.
                  </Text>
                </View>
              ) : (
                blockedLog.map((entry: any) => (
                  <View key={entry.id} style={d.logCard}>
                    <View style={[d.logIcon, { backgroundColor: entry.type === "call" ? Colors.error + "20" : "#F59E0B20" }]}>
                      <Text style={{ fontSize: 20 }}>{entry.type === "call" ? "📵" : "🚫"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={d.logType}>{entry.type === "call" ? "Blocked Call" : "Blocked Text"}</Text>
                      <Text style={d.logNumber}>{entry.numberMasked}</Text>
                    </View>
                    <Text style={d.logTime}>{fmtTime(entry.timestamp)}</Text>
                  </View>
                ))
              )}
            </>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CallGuardScreen() {
  const { state, dispatch } = useData();
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);

  const selectedKid = state.kids.find(k => k.profile.id === selectedKidId);

  const totalBlocked = state.kids.reduce((sum, k) => sum + (k.blockedLog?.length ?? 0), 0);
  const totalActive = state.kids.filter(k => k.commGuard?.blockUnknownCalls || k.commGuard?.blockUnknownTexts).length;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📵 Call & Text Guard</Text>

      {/* Summary card */}
      <View style={s.summaryCard}>
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{totalActive}</Text>
          <Text style={s.summaryLabel}>Kids protected</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>{totalBlocked}</Text>
          <Text style={s.summaryLabel}>Blocked total</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryValue}>
            {state.kids.reduce((sum, k) => sum + (k.commGuard?.allowedNumbers.length ?? 0), 0)}
          </Text>
          <Text style={s.summaryLabel}>Allowed numbers</Text>
        </View>
      </View>

      {/* How it works */}
      <View style={s.howBox}>
        <Text style={s.howTitle}>🛡️ Protect your kids from strangers</Text>
        <Text style={s.howText}>
          Enable blocking per child below. Unknown callers and texts from people not in their contacts
          will be silently blocked. You see a log of everything that was stopped.
        </Text>
      </View>

      {/* Kid list */}
      {state.kids.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 52 }}>👦</Text>
          <Text style={s.emptyTitle}>No kids added yet</Text>
          <Text style={s.emptySub}>Add a kid profile first to set up call and text protection.</Text>
        </View>
      ) : (
        state.kids.map(kid => (
          <KidGuardCard key={kid.profile.id} kid={kid} onManage={() => setSelectedKidId(kid.profile.id)} />
        ))
      )}

      <View style={{ height: 32 }} />

      {selectedKid && (
        <KidDetailModal
          kid={selectedKid}
          dispatch={dispatch}
          onClose={() => setSelectedKidId(null)}
        />
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
  summaryValue: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  howBox: {
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  howTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  howText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  kidCard: {
    flexDirection: "row", alignItems: "center", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: "700" },
  allowedCount: { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600", marginTop: 4 },
  emergencyBadge: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: "700", marginTop: 3 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
});

const d = StyleSheet.create({
  header: {
    backgroundColor: Colors.surfaceLight, paddingHorizontal: Spacing.lg, paddingTop: 56,
    paddingBottom: Spacing.md, ...Shadow.sm,
  },
  backBtn: { marginBottom: 8 },
  backText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  heading: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  subheading: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  tabsScroll: { backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border, flexGrow: 0 },
  tabs: { flexDirection: "row" },
  tab: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 3, borderBottomColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  scroll: { padding: Spacing.lg },
  infoBox: {
    backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  infoBody: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  toggleCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 12, ...Shadow.sm, gap: 12,
  },
  toggleLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  toggleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  activeAlert: {
    backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md,
  },
  activeAlertText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error, textAlign: "center" },
  demoBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  demoBtnText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  numberCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm,
  },
  numberEmoji: { fontSize: 22, marginRight: 10 },
  numberText: { flex: 1, fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  removeBtn: { padding: 6 },
  removeBtnText: { color: Colors.textMuted, fontSize: 16 },
  addBtn: {
    alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: Spacing.md, ...Shadow.sm,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  clearBtn: { alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8 },
  clearBtnText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: "600" },
  logCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm, gap: 12,
  },
  logIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  logType: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  logNumber: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  logTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  // Emergency unlock
  emergencyCard: {
    backgroundColor: "#FFF7ED", borderRadius: Radius.xl, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1.5, borderColor: "#F59E0B55",
  },
  emergencyTitle: { fontSize: FontSize.base, fontWeight: "800", color: "#92400E", marginBottom: 6 },
  emergencyBody: { fontSize: FontSize.sm, color: "#78350F", lineHeight: 20, marginBottom: Spacing.sm },
  emergencyActiveBox: {
    backgroundColor: "#FEF3C7", borderRadius: Radius.lg, padding: Spacing.sm,
    marginBottom: Spacing.sm, borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  emergencyActiveText: { fontSize: FontSize.sm, fontWeight: "800", color: "#92400E" },
  emergencyActiveSub: { fontSize: FontSize.xs, color: "#78350F", marginTop: 2 },
  deactivateBtn: { marginTop: 8, backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 7, alignSelf: "flex-start" },
  deactivateBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  emergencyLabel: { fontSize: FontSize.xs, fontWeight: "700", color: "#92400E", marginBottom: 6, textTransform: "uppercase" },
  emergencyInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  emergencyInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#F59E0B", borderRadius: Radius.lg,
    padding: 11, fontSize: FontSize.base, backgroundColor: "#fff",
    fontFamily: "monospace", letterSpacing: 1,
  },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600", width: 32, textAlign: "right" },
  emergencyBtnRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  saveCodeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 9 },
  saveCodeBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  testBtn: { borderWidth: 1.5, borderColor: Colors.warning, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 9 },
  testBtnText: { color: "#92400E", fontWeight: "700", fontSize: FontSize.sm },
  emergencyHint: { fontSize: FontSize.xs, color: "#78350F", marginTop: 10, lineHeight: 18 },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surfaceLight, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40,
  },
  title: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 6, textAlign: "center" },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: "center", lineHeight: 20 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 14, fontSize: FontSize.base, marginBottom: Spacing.md, backgroundColor: Colors.surfaceLight,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
