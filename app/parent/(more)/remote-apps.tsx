import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Switch, Modal, TextInput, ActivityIndicator,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import type { AppRule, AppSchedule, AppRuleMode } from "../../../lib/data/types";
import { computeScheduledMode, isScheduleActive, nextWindowLabel } from "../../../lib/app-scheduler";

// ─── Letter-avatar helper ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C5CFF","#FF6B6B","#4ECDC4","#45B7D1","#96CEB4",
  "#F7DC6F","#DDA0DD","#98D8C8","#FF9F43","#82E0AA",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + h * 31;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function AppAvatar({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 4,
      backgroundColor: avatarColor(name),
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ fontSize: size * 0.45, color: "#fff", fontWeight: "800" }}>
        {(name || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Device app type ─────────────────────────────────────────────────────────

type DeviceApp = { packageName: string; appName: string };

// ─── Schedule presets ─────────────────────────────────────────────────────────

const SCHEDULE_PRESETS: { label: string; emoji: string; schedules: Omit<AppSchedule, "id">[] }[] = [
  {
    label: "After School Weekdays",
    emoji: "🏫",
    schedules: [{ label: "After school", startTime: "15:00", endTime: "20:00", days: [1,2,3,4,5], enabled: true }],
  },
  {
    label: "Weekends Only",
    emoji: "🎉",
    schedules: [{ label: "Weekend", startTime: "08:00", endTime: "21:00", days: [0,6], enabled: true }],
  },
  {
    label: "After Homework (4–8pm Daily)",
    emoji: "📖",
    schedules: [{ label: "Evening", startTime: "16:00", endTime: "20:00", days: [0,1,2,3,4,5,6], enabled: true }],
  },
  {
    label: "Weekend Mornings",
    emoji: "☀️",
    schedules: [{ label: "Morning", startTime: "07:00", endTime: "12:00", days: [0,6], enabled: true }],
  },
  {
    label: "Always On (No Restriction)",
    emoji: "✅",
    schedules: [{ label: "All day", startTime: "00:00", endTime: "23:59", days: [0,1,2,3,4,5,6], enabled: true }],
  },
];

const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2,"0")}:${m}`;
});

function uid() { return Math.random().toString(36).slice(2, 10); }

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RemoteAppsScreen() {
  const { state, dispatch } = useData();
  const [kidId, setKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AppRule | null>(null);
  const [addSearch, setAddSearch] = useState("");

  const kid = state.kids.find(k => k.profile.id === kidId);
  const managedIds: string[] = kid?.rules.installedApps ?? [];
  const installAlerts = kid?.installAlerts ?? [];

  // The apps installed on the KID's device — reported by the kid device via
  // SYNC_INSTALLED_APPS and synced here. (Previously this listed the PARENT's
  // own apps, which was wrong.)
  const deviceApps: DeviceApp[] = kid?.deviceApps ?? [];
  const loading = false;

  // Map packageName → appName for quick lookup
  const deviceMap = Object.fromEntries(deviceApps.map(a => [a.packageName, a.appName]));

  function getRule(appId: string, appName?: string): AppRule {
    return kid?.rules.appRules.find(r => r.appId === appId) ?? {
      appId,
      appName: appName ?? deviceMap[appId] ?? appId,
      mode: "block",
      scheduleEnabled: false,
      schedules: [],
    };
  }

  function setMode(appId: string, appName: string, mode: AppRuleMode) {
    const rule = getRule(appId, appName);
    dispatch({ type: "SET_APP_RULE", kidId, rule: { ...rule, mode, scheduleEnabled: false } });
  }

  function addApp(app: DeviceApp) {
    dispatch({ type: "INSTALL_APP", kidId, appId: app.packageName, appName: app.appName });
    Alert.alert(
      "📱 App Added",
      `${app.appName} is now managed for ${kid?.profile.name}.\n\nIt is blocked by default — tap it to set access rules.`,
    );
  }

  function addAllApps() {
    const toAdd = filteredUnmanaged;
    if (toAdd.length === 0) return;
    Alert.alert(
      "Add all apps?",
      `Add all ${toAdd.length} app${toAdd.length === 1 ? "" : "s"} to manage for ${kid?.profile.name}? They'll be blocked by default — tap any to set access rules.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Add all ${toAdd.length}`,
          onPress: () => {
            toAdd.forEach(a => dispatch({ type: "INSTALL_APP", kidId, appId: a.packageName, appName: a.appName }));
            setShowAddModal(false);
          },
        },
      ],
    );
  }

  function removeApp(appId: string, appName: string) {
    Alert.alert("Remove App", `Stop managing ${appName} for ${kid?.profile.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "REMOVE_APP", kidId, appId }) },
    ]);
  }

  // Apps the parent has added to manage
  const managedApps: DeviceApp[] = managedIds.map(id => ({
    packageName: id,
    appName: deviceMap[id] ?? kid?.rules.appRules.find(r => r.appId === id)?.appName ?? id,
  }));

  // Apps on device but not yet managed (for the add modal)
  const unmanagedApps = deviceApps.filter(a => !managedIds.includes(a.packageName));

  const filteredUnmanaged = unmanagedApps.filter(a =>
    a.appName.toLowerCase().includes(addSearch.toLowerCase()) ||
    a.packageName.toLowerCase().includes(addSearch.toLowerCase())
  );

  return (
    <ScreenContainer>
      <Text style={styles.title}>📱 App Manager</Text>
      <Text style={styles.sub}>Manage which apps {kid?.profile.name ?? "your kid"} can access.</Text>

      {/* Kid tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }}>
        {state.kids.map(k => (
          <TouchableOpacity
            key={k.profile.id}
            style={[styles.kidTab, kidId === k.profile.id && styles.kidTabActive]}
            onPress={() => setKidId(k.profile.id)}
          >
            <Text style={[styles.kidTabText, kidId === k.profile.id && styles.kidTabTextActive]}>
              {k.profile.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Installed apps list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Loading device apps…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {installAlerts.length > 0 && (
            <View style={styles.alertCard}>
              <Text style={styles.alertHeader}>🆕 Newly installed ({installAlerts.length})</Text>
              <Text style={styles.alertSub}>
                New apps appeared on {kid?.profile.name ?? "this"}'s device. Tap Manage to set rules, or Dismiss.
              </Text>
              {installAlerts.map(a => (
                <View key={a.packageName} style={styles.alertRow}>
                  <AppAvatar name={a.appName} size={40} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.appName} numberOfLines={1}>{a.appName}</Text>
                    <Text style={styles.appPkg} numberOfLines={1}>{a.packageName}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.alertManageBtn}
                    onPress={() => {
                      dispatch({ type: "INSTALL_APP", kidId, appId: a.packageName, appName: a.appName });
                      dispatch({ type: "DISMISS_INSTALL_ALERT", kidId, packageName: a.packageName });
                    }}
                  >
                    <Text style={styles.alertManageText}>Manage</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.alertDismissBtn}
                    onPress={() => dispatch({ type: "DISMISS_INSTALL_ALERT", kidId, packageName: a.packageName })}
                  >
                    <Text style={styles.alertDismissText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {managedApps.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>📭</Text>
              <Text style={styles.emptyTitle}>No apps being managed</Text>
              <Text style={styles.emptySub}>
                Tap the <Text style={{ fontWeight: "800", color: Colors.primary }}>+</Text> button to add apps installed on {kid?.profile.name ?? "your kid"}'s device.
              </Text>
              {deviceApps.length === 0 && (
                <View style={styles.permHint}>
                  <Text style={styles.permHintText}>
                    ⏳ Waiting for {kid?.profile.name ?? "your kid"}'s device to report its installed apps. Make sure their device is online and the app has been opened recently.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            managedApps.map(app => {
              const rule = getRule(app.packageName, app.appName);
              const effectiveMode = rule.scheduleEnabled
                ? (computeScheduledMode(rule) ?? rule.mode)
                : rule.mode;
              const isAllowed = effectiveMode === "allow" || effectiveMode === "limit";
              const next = rule.scheduleEnabled ? nextWindowLabel(rule) : null;

              return (
                <TouchableOpacity
                  key={app.packageName}
                  style={styles.appRow}
                  onPress={() => setEditingRule(getRule(app.packageName, app.appName))}
                  activeOpacity={0.85}
                >
                  <AppAvatar name={app.appName} size={52} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.appName}>{app.appName}</Text>
                    <Text style={styles.appPkg} numberOfLines={1}>{app.packageName}</Text>
                    <View style={styles.statusLine}>
                      <View style={[styles.statusDot, { backgroundColor: isAllowed ? Colors.success : Colors.error }]} />
                      <Text style={[styles.statusText, { color: isAllowed ? Colors.success : Colors.error }]}>
                        {rule.scheduleEnabled
                          ? (isAllowed ? "Scheduled ON" : "Scheduled OFF")
                          : (effectiveMode === "allow" ? "Allowed"
                            : effectiveMode === "limit" ? `Limited ${rule.limitMinutes ?? 0}m/day`
                            : effectiveMode === "earned" ? "Must Earn"
                            : "Blocked")}
                      </Text>
                      {rule.scheduleEnabled && <Text style={styles.scheduleTag}>🕐 Auto</Text>}
                    </View>
                    {next && <Text style={styles.nextWindow}>{next}</Text>}
                  </View>
                  <Switch
                    value={isAllowed}
                    onValueChange={v => {
                      if (rule.scheduleEnabled) {
                        dispatch({ type: "SET_APP_SCHEDULE_ENABLED", kidId, appId: app.packageName, enabled: false });
                      }
                      setMode(app.packageName, app.appName, v ? "allow" : "block");
                    }}
                    trackColor={{ true: Colors.success, false: Colors.error }}
                    thumbColor="#fff"
                  />
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* FAB: Add app */}
      <TouchableOpacity style={styles.fab} onPress={() => { setAddSearch(""); setShowAddModal(true); }}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add App Modal — shows real device apps */}
      {showAddModal && (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
          <View style={modal.root}>
            <View style={modal.header}>
              <Text style={modal.headerTitle}>📱 Add App to Manage</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={modal.closeBtn}>
                <Text style={modal.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={modal.searchRow}>
              <TextInput
                style={modal.searchInput}
                value={addSearch}
                onChangeText={setAddSearch}
                placeholder="Search installed apps…"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
              {deviceApps.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 12 }}>
                  <Text style={{ fontSize: 40 }}>⚠️</Text>
                  <Text style={{ color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.base, textAlign: "center" }}>
                    No apps reported yet
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: "center", lineHeight: 20 }}>
                    {kid?.profile.name ?? "Your kid"}'s device hasn't reported its installed apps yet. Make sure their device is online and the Spinini app has been opened recently.
                  </Text>
                </View>
              ) : filteredUnmanaged.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
                  <Text style={{ fontSize: 40 }}>{addSearch ? "🔍" : "✅"}</Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: "center" }}>
                    {addSearch ? "No apps match your search" : "All installed apps are already being managed"}
                  </Text>
                </View>
              ) : (
                filteredUnmanaged.map(app => (
                  <View key={app.packageName} style={styles.libRow}>
                    <AppAvatar name={app.appName} size={48} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.appName}>{app.appName}</Text>
                      <Text style={styles.appPkg} numberOfLines={1}>{app.packageName}</Text>
                    </View>
                    <TouchableOpacity style={styles.installBtn} onPress={() => {
                      addApp(app);
                      if (filteredUnmanaged.length === 1) setShowAddModal(false);
                    }}>
                      <Text style={styles.installBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
            {filteredUnmanaged.length > 0 && (
              <View style={modal.footer}>
                <TouchableOpacity style={modal.addAllBtn} onPress={addAllApps}>
                  <Text style={modal.addAllText}>➕ Add ALL {filteredUnmanaged.length} apps</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Schedule editor modal */}
      {editingRule && (
        <AppScheduleEditor
          rule={editingRule}
          kidId={kidId}
          kidName={kid?.profile.name ?? ""}
          onClose={() => setEditingRule(null)}
          onSave={updated => {
            dispatch({ type: "SET_APP_RULE", kidId, rule: updated });
            setEditingRule(null);
          }}
          onRemove={() => {
            removeApp(editingRule.appId, editingRule.appName);
            setEditingRule(null);
          }}
          onAddSchedule={sched => dispatch({ type: "SET_APP_SCHEDULE", kidId, appId: editingRule.appId, schedule: sched })}
          onRemoveSchedule={schedId => dispatch({ type: "REMOVE_APP_SCHEDULE", kidId, appId: editingRule.appId, scheduleId: schedId })}
          onToggleScheduleMode={enabled => {
            dispatch({ type: "SET_APP_SCHEDULE_ENABLED", kidId, appId: editingRule.appId, enabled });
            setEditingRule(r => r ? { ...r, scheduleEnabled: enabled } : r);
          }}
          dispatch={dispatch}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Schedule editor ──────────────────────────────────────────────────────────

interface EditorProps {
  rule: AppRule;
  kidId: string;
  kidName: string;
  onClose: () => void;
  onSave: (rule: AppRule) => void;
  onRemove: () => void;
  onAddSchedule: (s: AppSchedule) => void;
  onRemoveSchedule: (id: string) => void;
  onToggleScheduleMode: (enabled: boolean) => void;
  dispatch: (a: any) => void;
}

function AppScheduleEditor({
  rule, kidId, kidName,
  onClose, onSave, onRemove,
  onAddSchedule, onRemoveSchedule, onToggleScheduleMode,
}: EditorProps) {
  const [draft, setDraft] = useState<AppRule>({ ...rule });
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newSched, setNewSched] = useState<Omit<AppSchedule, "id">>({
    label: "Custom schedule",
    startTime: "15:00",
    endTime: "20:00",
    days: [1,2,3,4,5],
    enabled: true,
  });

  const MODES: { mode: AppRuleMode; emoji: string; label: string; sub: string; color: string }[] = [
    { mode: "allow",  emoji: "✅", label: "Always On",    sub: "No time limit",            color: Colors.success },
    { mode: "limit",  emoji: "⏱",  label: "Time Limited", sub: "Set daily minutes below",  color: Colors.warning },
    { mode: "earned", emoji: "⭐", label: "Must Earn",    sub: "Via chores / time bank",   color: Colors.primary },
    { mode: "block",  emoji: "🚫", label: "Blocked",      sub: "Not accessible",           color: Colors.error   },
  ];

  function applyPreset(preset: typeof SCHEDULE_PRESETS[0]) {
    for (const s of preset.schedules) {
      onAddSchedule({ ...s, id: uid() });
    }
    onToggleScheduleMode(true);
    setDraft(d => ({ ...d, scheduleEnabled: true }));
  }

  const effectiveMode = draft.scheduleEnabled
    ? (computeScheduledMode(draft) ?? draft.mode)
    : draft.mode;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.root}>
        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Text style={modal.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <AppAvatar name={rule.appName} size={56} />
            <Text style={modal.headerTitle}>{rule.appName}</Text>
            <Text style={modal.headerSub}>{kidName}'s device</Text>
          </View>
          <TouchableOpacity onPress={() => onSave(draft)} style={modal.saveBtn}>
            <Text style={modal.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
          {/* Current status */}
          <View style={[modal.statusCard, { backgroundColor: effectiveMode === "allow" || effectiveMode === "limit" ? "#D1FAE5" : "#FEE2E2" }]}>
            <Text style={modal.statusText}>
              {effectiveMode === "allow" ? "✅ Currently ALLOWED"
               : effectiveMode === "limit" ? `⏱ Limited to ${draft.limitMinutes ?? 0}m/day`
               : effectiveMode === "earned" ? "⭐ Must be earned"
               : "🚫 Currently BLOCKED"}
            </Text>
            {draft.scheduleEnabled && <Text style={modal.scheduleTag}>🕐 Schedule active</Text>}
          </View>

          {/* Schedule mode toggle */}
          <Section title="Use Automatic Schedule">
            <View style={modal.row}>
              <View style={{ flex: 1 }}>
                <Text style={modal.itemTitle}>Auto On/Off by Schedule</Text>
                <Text style={modal.itemSub}>App turns on and off automatically based on the times you set below</Text>
              </View>
              <Switch
                value={draft.scheduleEnabled}
                onValueChange={v => {
                  onToggleScheduleMode(v);
                  setDraft(d => ({ ...d, scheduleEnabled: v }));
                }}
                trackColor={{ true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </Section>

          {/* Manual mode */}
          {!draft.scheduleEnabled && (
            <Section title="Access Mode">
              {MODES.map(m => (
                <TouchableOpacity
                  key={m.mode}
                  style={[modal.modeRow, draft.mode === m.mode && { backgroundColor: m.color + "18", borderColor: m.color }]}
                  onPress={() => setDraft(d => ({ ...d, mode: m.mode }))}
                >
                  <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={modal.itemTitle}>{m.label}</Text>
                    <Text style={modal.itemSub}>{m.sub}</Text>
                  </View>
                  {draft.mode === m.mode && <Text style={{ color: m.color, fontWeight: "800" }}>✓</Text>}
                </TouchableOpacity>
              ))}
              {draft.mode === "limit" && (
                <View style={modal.limitRow}>
                  <Text style={modal.itemTitle}>Daily limit (minutes)</Text>
                  <View style={modal.limitBtns}>
                    {[15,30,45,60,90,120].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[modal.limitBtn, draft.limitMinutes === v && modal.limitBtnActive]}
                        onPress={() => setDraft(d => ({ ...d, limitMinutes: v }))}
                      >
                        <Text style={[modal.limitBtnText, draft.limitMinutes === v && { color: "#fff" }]}>{v}m</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </Section>
          )}

          {/* Schedule presets */}
          {draft.scheduleEnabled && (
            <Section title="Quick Presets">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SCHEDULE_PRESETS.map(p => (
                  <TouchableOpacity key={p.label} style={modal.presetBtn} onPress={() => applyPreset(p)}>
                    <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                    <Text style={modal.presetLabel}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Schedules list */}
          {draft.scheduleEnabled && (
            <Section title="Time Windows">
              <Text style={modal.itemSub}>App is ON during these windows, OFF at all other times</Text>
              {(draft.schedules ?? []).length === 0 && (
                <Text style={[modal.itemSub, { textAlign: "center", paddingVertical: 12 }]}>
                  No schedules yet. Add one below or choose a preset.
                </Text>
              )}
              {(draft.schedules ?? []).map(s => (
                <View key={s.id} style={[modal.schedRow, isScheduleActive(s) && { borderLeftColor: Colors.success, borderLeftWidth: 3 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.schedLabel}>{s.label}</Text>
                    <Text style={modal.schedTime}>{s.startTime} – {s.endTime}</Text>
                    <Text style={modal.schedDays}>{s.days.map(d => DAYS_SHORT[d]).join(" · ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    {isScheduleActive(s) && <Text style={modal.activeNow}>● ON now</Text>}
                    <TouchableOpacity onPress={() => {
                      onRemoveSchedule(s.id);
                      setDraft(d => ({ ...d, schedules: (d.schedules ?? []).filter(x => x.id !== s.id) }));
                    }}>
                      <Text style={{ color: Colors.error, fontWeight: "700" }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {!addingSchedule ? (
                <TouchableOpacity style={modal.addSchedBtn} onPress={() => setAddingSchedule(true)}>
                  <Text style={modal.addSchedBtnText}>+ Add Time Window</Text>
                </TouchableOpacity>
              ) : (
                <View style={modal.newSchedCard}>
                  <Text style={modal.newSchedTitle}>New Time Window</Text>

                  <Text style={modal.fieldLabel}>Start time</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
                    {TIMES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[modal.timeChip, newSched.startTime === t && modal.timeChipActive]}
                        onPress={() => setNewSched(s => ({ ...s, startTime: t }))}
                      >
                        <Text style={[modal.timeChipText, newSched.startTime === t && { color: "#fff" }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={modal.fieldLabel}>End time</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
                    {TIMES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[modal.timeChip, newSched.endTime === t && modal.timeChipActive]}
                        onPress={() => setNewSched(s => ({ ...s, endTime: t }))}
                      >
                        <Text style={[modal.timeChipText, newSched.endTime === t && { color: "#fff" }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={modal.fieldLabel}>Days</Text>
                  <View style={modal.dayRow}>
                    {DAYS_SHORT.map((d, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[modal.dayBtn, newSched.days.includes(i) && modal.dayBtnActive]}
                        onPress={() => setNewSched(s => ({
                          ...s,
                          days: s.days.includes(i) ? s.days.filter(x => x !== i) : [...s.days, i],
                        }))}
                      >
                        <Text style={[modal.dayBtnText, newSched.days.includes(i) && { color: "#fff" }]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={modal.newSchedActions}>
                    <TouchableOpacity style={modal.cancelBtn} onPress={() => setAddingSchedule(false)}>
                      <Text style={modal.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={modal.confirmBtn}
                      onPress={() => {
                        if (!newSched.days.length) { Alert.alert("Pick at least one day"); return; }
                        const sched: AppSchedule = { ...newSched, id: uid() };
                        onAddSchedule(sched);
                        setDraft(d => ({ ...d, schedules: [...(d.schedules ?? []), sched] }));
                        setAddingSchedule(false);
                        setNewSched({ label: "Custom schedule", startTime: "15:00", endTime: "20:00", days: [1,2,3,4,5], enabled: true });
                      }}
                    >
                      <Text style={modal.confirmBtnText}>Add Window</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Section>
          )}

          {/* Remove app */}
          <TouchableOpacity style={modal.removeBtn} onPress={onRemove}>
            <Text style={modal.removeBtnText}>🗑 Stop Managing This App</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={modal.section}>
      <Text style={modal.sectionTitle}>{title}</Text>
      <View style={modal.sectionCard}>{children}</View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 2 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },
  kidTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive: { color: "#fff" },
  appRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: 8, ...Shadow.sm,
  },
  appName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  appPkg: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  scheduleTag: { fontSize: 11, color: Colors.primary, backgroundColor: Colors.primary + "18", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  nextWindow: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted, marginLeft: 8 },
  libRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: 8, ...Shadow.sm,
  },
  installBtn: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md },
  installBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  permHint: {
    backgroundColor: Colors.warning + "18", borderRadius: Radius.lg,
    padding: Spacing.sm, marginTop: 8, borderWidth: 1, borderColor: Colors.warning + "40",
  },
  permHintText: { color: Colors.warning, fontSize: FontSize.sm, textAlign: "center", fontWeight: "600", lineHeight: 18 },
  alertCard: {
    backgroundColor: Colors.warning + "14", borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.warning + "55",
    padding: Spacing.sm, marginBottom: 12,
  },
  alertHeader: { fontSize: FontSize.base, fontWeight: "800", color: Colors.warning },
  alertSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, marginBottom: 8, lineHeight: 16 },
  alertRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.md,
    padding: 8, marginTop: 6,
  },
  alertManageBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md, marginLeft: 6 },
  alertManageText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  alertDismissBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md, marginLeft: 4 },
  alertDismissText: { color: Colors.textSecondary, fontWeight: "700", fontSize: 12 },
  fab: {
    position: "absolute", bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    ...Shadow.md,
  },
  fabText: { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36 },
});

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  footer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surfaceLight },
  addAllBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 16, alignItems: "center", ...Shadow.sm },
  addAllText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 16 },
  headerTitle: { fontWeight: "800", fontSize: FontSize.lg, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  searchRow: { padding: Spacing.md, paddingBottom: 0 },
  searchInput: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: FontSize.base, color: Colors.textPrimary,
  },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.md },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  statusCard: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 12, alignItems: "center", gap: 4 },
  statusText: { fontWeight: "800", fontSize: FontSize.base, color: Colors.textPrimary },
  scheduleTag: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  sectionCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  itemSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  modeRow: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: Radius.lg, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.border },
  limitRow: { marginTop: 12, gap: 8 },
  limitBtns: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  limitBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  limitBtnActive: { backgroundColor: Colors.primary },
  limitBtnText: { fontWeight: "700", color: Colors.textSecondary },
  presetBtn: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.sm, marginRight: 10, alignItems: "center", gap: 4, minWidth: 120 },
  presetLabel: { fontSize: 11, fontWeight: "600", color: Colors.textPrimary, textAlign: "center" },
  schedRow: { backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: 8, flexDirection: "row", alignItems: "flex-start" },
  schedLabel: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.sm },
  schedTime: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary, marginTop: 2 },
  schedDays: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  activeNow: { fontSize: 11, color: Colors.success, fontWeight: "700" },
  addSchedBtn: { borderWidth: 2, borderColor: Colors.primary, borderStyle: "dashed", borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", marginTop: 8 },
  addSchedBtnText: { color: Colors.primary, fontWeight: "700" },
  newSchedCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: 8, gap: 4 },
  newSchedTitle: { fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  timeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, backgroundColor: Colors.surfaceLight, marginRight: 6 },
  timeChipActive: { backgroundColor: Colors.primary },
  timeChipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  dayRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  dayBtn: { flex: 1, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center" },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayBtnText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  newSchedActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surfaceLight, alignItems: "center" },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  confirmBtn: { flex: 1, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: "center" },
  confirmBtnText: { fontWeight: "700", color: "#fff" },
  removeBtn: { borderWidth: 1.5, borderColor: Colors.error + "40", borderRadius: Radius.lg, padding: 14, alignItems: "center" },
  removeBtnText: { color: Colors.error, fontWeight: "700" },
});
