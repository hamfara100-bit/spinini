import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Switch, Alert, Modal, Keyboard,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, pointsToMoney } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import { LOCKABLE_FEATURES, FEATURE_LABELS } from "../../../lib/data/types";
import type { Chore } from "../../../lib/data/types";

const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOUR_OPTS  = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,"0")}:00`);

function todayStr() { return new Date().toISOString().split("T")[0]; }

// ── Urgency helper ──────────────────────────────────────────────────────────
function getUrgencyLabel(deadlineTime?: string): { label: string; color: string } | null {
  if (!deadlineTime) return null;
  const now = new Date();
  const [h, m] = deadlineTime.split(":").map(Number);
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m ?? 0);
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) return { label: "⚠️ Overdue!", color: Colors.error };
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH <= 1) return { label: `⏰ Due in ${Math.round(diffH * 60)}min!`, color: Colors.error };
  if (diffH <= 3) return { label: `⏰ Due in ${Math.round(diffH)}h`, color: "#F59E0B" };
  return null;
}

export default function ParentChoresScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<"pending" | "active" | "new" | "locks">("pending");

  // ── Edit chore modal ──
  const [editingChore, setEditingChore] = useState<(Chore & { kidName: string; kidId: string }) | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPoints, setEditPoints] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function openEdit(c: Chore & { kidName: string; kidId: string }) {
    setEditingChore(c);
    setEditTitle(c.title);
    setEditPoints(String(c.points));
    setEditDesc(c.description ?? "");
  }

  function saveEdit() {
    if (!editingChore || !editTitle.trim()) return;
    dispatch({
      type: "UPDATE_CHORE",
      choreId: editingChore.id,
      payload: { title: editTitle.trim(), points: parseInt(editPoints) || editingChore.points, description: editDesc.trim() || undefined },
    });
    setEditingChore(null);
  }

  // ── New chore form ──
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [points, setPoints] = useState("10");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [isAuto, setIsAuto] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([1,2,3,4,5]); // weekdays
  const [deadlineTime, setDeadlineTime] = useState("18:00");
  const [penaltyPoints, setPenaltyPoints] = useState("5");
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [unlocksFeatures, setUnlocksFeatures] = useState<string[]>([]);
  const [unlockMsg, setUnlockMsg] = useState("");

  function toggleDay(d: number) {
    setRecurringDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function toggleUnlockFeature(fid: string) {
    setUnlocksFeatures(prev =>
      prev.includes(fid) ? prev.filter(x => x !== fid) : [...prev, fid]
    );
  }

  function doCreateChore() {
    const chore = {
      id: uid(),
      title: title.trim(),
      description: desc.trim() || undefined,
      assignedKids: selectedKids,
      points: parseInt(points) || 10,
      status: "open" as const,
      proofs: [],
      approvals: [],
      createdAt: nowIso(),
      createdBy: "parent",
      ...(isAuto && {
        autoChore: true,
        recurringDays,
        deadlineTime,
        penaltyPoints: parseInt(penaltyPoints) || 5,
        penaltyAppliedDates: [],
      }),
      ...(unlocksFeatures.length > 0 && {
        unlocksFeatures,
        unlockMessage: unlockMsg.trim() || title.trim(),
      }),
    };
    dispatch({ type: "ADD_CHORE", chore });

    // Lock the selected features for assigned kids immediately
    if (unlocksFeatures.length > 0) {
      selectedKids.forEach(kidId => {
        unlocksFeatures.forEach(fid => {
          dispatch({ type: "SET_FEATURE_LOCK", kidId, featureId: fid, locked: true });
        });
      });
    }

    setTitle(""); setDesc(""); setPoints("10");
    setSelectedKids([]); setIsAuto(false);
    setRecurringDays([1,2,3,4,5]); setDeadlineTime("18:00");
    setUnlocksFeatures([]); setUnlockMsg("");
    setTab("active");
  }

  function createChore() {
    if (!title.trim() || selectedKids.length === 0) return;

    if (unlocksFeatures.length > 0) {
      const kidNames = state.kids
        .filter(k => selectedKids.includes(k.profile.id))
        .map(k => k.profile.name).join(", ");
      const featureNames = unlocksFeatures.map(fid => FEATURE_LABELS[fid] ?? fid).join(", ");
      Alert.alert(
        "🔒 Lock Features?",
        `Creating this chore will immediately lock the following features for ${kidNames}:\n\n${featureNames}\n\nThey'll be unlocked once you approve the chore.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Create & Lock 🔒", onPress: doCreateChore },
        ]
      );
    } else {
      doCreateChore();
    }
  }

  const pendingChores = state.kids.flatMap(k =>
    k.chores
      .filter(c => c.status === "submitted")
      .map(c => ({ ...c, kidName: k.profile.name, kidId: k.profile.id }))
  );

  const activeChores = state.kids.flatMap(k =>
    k.chores
      .filter(c => c.status === "open")
      .map(c => ({ ...c, kidName: k.profile.name, kidId: k.profile.id }))
  );

  const today = new Date().getDay();
  const today_s = todayStr();

  function approveChore(c: typeof pendingChores[0]) {
    const kidState = state.kids.find(k => k.profile.id === c.kidId);
    const bonusMins = kidState?.rules?.screenTimePerChoreMinutes ?? 15;
    dispatch({
      type: "CHORE_APPROVE",
      choreId: c.id,
      approval: { kidId: c.kidId, approved: true, awardedPoints: c.points, awardedMinutes: bonusMins, reviewedAt: nowIso() },
    });
    dispatch({
      type: "BEHAVIOR_ADD_EVENT",
      kidId: c.kidId,
      event: { id: uid(), points: c.points, reason: `✅ Chore: ${c.title}`, date: nowIso().slice(0, 10) },
    });
    dispatch({ type: "BANK_DELTA", kidId: c.kidId, delta: bonusMins, reason: `✅ Chore: ${c.title}` });
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: c.kidId,
      notification: {
        id: uid(), kidId: c.kidId, kind: "chore_approved",
        title: "Great job! 🎉",
        body: bonusMins > 0
          ? `Your chore "${c.title}" was approved! You earned +${c.points} points and +${bonusMins} bonus minutes.`
          : `Your chore "${c.title}" was approved! You earned +${c.points} points.`,
        read: false, createdAt: nowIso(),
      },
    });
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🔨 Chores</Text>

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {(["pending","active","new","locks"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {t === "pending" ? `⏳ Review${pendingChores.length ? ` (${pendingChores.length})` : ""}` :
               t === "active"  ? "📋 Active" :
               t === "new"     ? "+ New" : "🔒 Locks"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Pending approval tab ── */}
      {tab === "pending" && (
        <View>
          {pendingChores.length === 0 ? (
            <Text style={styles.empty}>No submissions awaiting review. 🎉</Text>
          ) : (
            <>
              {pendingChores.length >= 2 && (
                <TouchableOpacity
                  style={styles.approveAllBtn}
                  onPress={() => Alert.alert(
                    "Approve All?",
                    `Approve all ${pendingChores.length} submitted chores?`,
                    [
                      { text: "Cancel" },
                      { text: `Approve All ✅`, onPress: () => pendingChores.forEach(approveChore) },
                    ]
                  )}
                >
                  <Text style={styles.approveAllText}>✅ Approve All ({pendingChores.length})</Text>
                </TouchableOpacity>
              )}
              {pendingChores.map(c => (
                <View key={`${c.id}-${c.kidId}`} style={styles.choreCard}>
                  <View style={styles.choreCardHeader}>
                    <Text style={styles.choreTitleText}>{c.title}</Text>
                    <Text style={styles.choreKidBadge}>{c.kidName}</Text>
                  </View>
                  <Text style={styles.choreMeta}>+{c.points} pts ({pointsToMoney(c.points)})</Text>
                  {c.proofs[0]?.note ? (
                    <Text style={styles.choreNote}>"{c.proofs[0].note}"</Text>
                  ) : null}
                  <View style={styles.choreActions}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approveChore(c)}>
                      <Text style={styles.approveBtnText}>✓ Approve +{c.points}pts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => dispatch({
                        type: "CHORE_APPROVE",
                        choreId: c.id,
                        approval: { kidId: c.kidId, approved: false, awardedPoints: 0, awardedMinutes: 0, reviewedAt: nowIso() },
                      })}
                    >
                      <Text style={styles.rejectBtnText}>✗ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* ── Active chores tab ── */}
      {tab === "active" && (
        <View>
          {activeChores.length === 0 ? (
            <Text style={styles.empty}>No active chores. Tap "+ New" to create one.</Text>
          ) : (
            activeChores.map(c => {
              const isAutoToday = c.autoChore && c.recurringDays?.includes(today);
              const penaltyDone = c.penaltyAppliedDates?.includes(today_s);
              const urgency = getUrgencyLabel(c.autoChore ? c.deadlineTime : undefined);
              return (
                <View key={`${c.id}-${c.kidId}`} style={[styles.choreCard, isAutoToday && styles.autoChoreCard]}>
                  <View style={styles.choreCardHeader}>
                    <Text style={styles.choreTitleText}>{c.title}</Text>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {c.autoChore && (
                        <View style={styles.autoBadge}>
                          <Text style={styles.autoBadgeText}>🔁 Auto</Text>
                        </View>
                      )}
                      <Text style={styles.choreKidBadge}>{c.kidName}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.choreMeta}>+{c.points} pts ({pointsToMoney(c.points)})</Text>
                    {urgency && !penaltyDone && (
                      <Text style={[styles.urgencyTag, { color: urgency.color, borderColor: urgency.color + "50" }]}>
                        {urgency.label}
                      </Text>
                    )}
                  </View>
                  {c.autoChore && c.deadlineTime && (
                    <Text style={[styles.deadlineMeta, penaltyDone && styles.penaltyMeta]}>
                      {penaltyDone
                        ? `⚠️ Penalty applied — missed ${c.deadlineTime} deadline`
                        : `⏰ Due by ${c.deadlineTime} • −${c.penaltyPoints ?? 0}pts if missed`}
                    </Text>
                  )}
                  {c.autoChore && c.recurringDays && (
                    <View style={styles.dayRow}>
                      {DAY_LABELS.map((d, i) => (
                        <View key={i} style={[styles.dayDot, c.recurringDays!.includes(i) && styles.dayDotActive]}>
                          <Text style={[styles.dayDotText, c.recurringDays!.includes(i) && styles.dayDotTextActive]}>{d[0]}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {c.unlocksFeatures && c.unlocksFeatures.length > 0 && (
                    <View style={styles.unlockRow}>
                      <Text style={styles.unlockLabel}>🔓 Unlocks:</Text>
                      {c.unlocksFeatures.map(fid => (
                        <View key={fid} style={styles.unlockChip}>
                          <Text style={styles.unlockChipText}>{FEATURE_LABELS[fid] ?? fid}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.activeChoreActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(c)}>
                      <Text style={styles.editBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => {
                        const hasLocks = c.unlocksFeatures && c.unlocksFeatures.length > 0;
                        const lockNames = hasLocks
                          ? c.unlocksFeatures!.map(fid => FEATURE_LABELS[fid] ?? fid).join(", ")
                          : "";
                        Alert.alert(
                          "Delete Chore?",
                          hasLocks
                            ? `Remove "${c.title}"?\n\n⚠️ This chore locks: ${lockNames}. Deleting it will also unlock these features for ${c.kidName}.`
                            : `Remove "${c.title}"?`,
                          [
                            { text: "Cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                dispatch({ type: "REMOVE_CHORE", choreId: c.id });
                                // Unlock any features that were tied to this chore
                                if (hasLocks) {
                                  // Find all kids this chore was assigned to
                                  const assignedKids = state.kids.filter(k =>
                                    k.chores.some(ch => ch.id === c.id)
                                  );
                                  // Fall back to the chore's kidId if assignedKids is empty
                                  const targetKidIds = assignedKids.length > 0
                                    ? assignedKids.map(k => k.profile.id)
                                    : [c.kidId];
                                  targetKidIds.forEach(kidId => {
                                    c.unlocksFeatures!.forEach(fid => {
                                      // Only unlock if no other active chore also locks this feature for this kid
                                      const kid = state.kids.find(k => k.profile.id === kidId);
                                      const stillLockedByAnotherChore = (kid?.chores ?? [])
                                        .filter(ch => ch.id !== c.id && ch.status === "open")
                                        .some(ch => ch.unlocksFeatures?.includes(fid));
                                      if (!stillLockedByAnotherChore) {
                                        dispatch({ type: "SET_FEATURE_LOCK", kidId, featureId: fid, locked: false });
                                      }
                                    });
                                  });
                                }
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ── New chore form tab ── */}
      {tab === "new" && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Chore title…"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <TextInput
            style={styles.input}
            value={desc}
            onChangeText={setDesc}
            placeholder="Description (optional)…"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <PointsInput
            inputStyle={styles.input}
            value={points}
            onChangeText={setPoints}
            placeholder="Points to earn"
            onSubmitEditing={Keyboard.dismiss}
          />
          <View style={styles.pointsPresets}>
            <Text style={styles.pointsPresetLabel}>Quick pick:</Text>
            {[5, 10, 15, 20, 30, 50].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.pointsPresetBtn, points === String(p) && styles.pointsPresetBtnActive]}
                onPress={() => setPoints(String(p))}
              >
                <Text style={[styles.pointsPresetText, points === String(p) && styles.pointsPresetTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>
            Assign to: {selectedKids.length === 0 && <Text style={{ color: Colors.error, fontWeight: "700" }}>* required</Text>}
          </Text>
          <View style={styles.kidSelector}>
            {state.kids.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>No kids added yet. Add a kid profile first.</Text>
            ) : (
              state.kids.map(k => {
                const isSelected = selectedKids.includes(k.profile.id);
                return (
                  <TouchableOpacity
                    key={k.profile.id}
                    style={[styles.kidChip, isSelected && styles.kidChipActive]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedKids(s =>
                        s.includes(k.profile.id)
                          ? s.filter(x => x !== k.profile.id)
                          : [...s, k.profile.id]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.kidChipText, isSelected && styles.kidChipTextActive]}>
                      {isSelected ? "✓ " : ""}{k.profile.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Auto-chore toggle */}
          <View style={styles.autoRow}>
            <View style={styles.autoRowLeft}>
              <Text style={styles.autoLabel}>🔁 Auto Chore</Text>
              <Text style={styles.autoSub}>Repeats on set days. Kid loses points if missed.</Text>
            </View>
            <Switch
              value={isAuto}
              onValueChange={setIsAuto}
              trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
              thumbColor={isAuto ? Colors.primary : "#ccc"}
            />
          </View>

          {isAuto && (
            <View style={styles.autoOptions}>
              <Text style={styles.formLabel}>Repeat on days:</Text>
              <View style={styles.dayPicker}>
                {DAY_LABELS.map((d, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayBtn, recurringDays.includes(i) && styles.dayBtnActive]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[styles.dayBtnText, recurringDays.includes(i) && styles.dayBtnTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Must complete by:</Text>
              <TouchableOpacity style={styles.timePicker} onPress={() => setShowHourPicker(!showHourPicker)}>
                <Text style={styles.timePickerText}>⏰ {deadlineTime}</Text>
                <Text style={styles.timePickerChevron}>{showHourPicker ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {showHourPicker && (
                <ScrollView style={styles.hourList} nestedScrollEnabled>
                  {HOUR_OPTS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.hourItem, deadlineTime === h && styles.hourItemActive]}
                      onPress={() => { setDeadlineTime(h); setShowHourPicker(false); }}
                    >
                      <Text style={[styles.hourItemText, deadlineTime === h && styles.hourItemTextActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.formLabel}>Penalty if missed:</Text>
              <View style={styles.penaltyRow}>
                <PointsInput
                  style={{ flex: 1 }}
                  inputStyle={styles.input}
                  value={penaltyPoints}
                  onChangeText={setPenaltyPoints}
                  placeholder="Points lost"
                />
                <View style={styles.penaltyLabel}>
                  <Text style={styles.penaltyLabelText}>pts deducted</Text>
                </View>
              </View>

              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ If the chore isn't submitted by {deadlineTime}, {penaltyPoints} behavior points are automatically deducted.
                </Text>
              </View>
            </View>
          )}

          {/* Unlock Features section */}
          <View style={styles.unlockSection}>
            <Text style={styles.unlockSectionTitle}>🔒 Unlocks Features When Approved</Text>
            <Text style={styles.unlockSectionSub}>
              Selected features will be locked for the assigned kids now, and unlocked automatically when you approve this chore.
            </Text>
            <View style={styles.featureGrid}>
              {LOCKABLE_FEATURES.map(fid => {
                const on = unlocksFeatures.includes(fid);
                return (
                  <TouchableOpacity
                    key={fid}
                    style={[styles.featureChip, on && styles.featureChipOn]}
                    onPress={() => toggleUnlockFeature(fid)}
                  >
                    <Text style={[styles.featureChipText, on && styles.featureChipTextOn]}>
                      {on ? "🔓 " : "🔒 "}{FEATURE_LABELS[fid]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {unlocksFeatures.length > 0 && (
              <TextInput
                style={styles.input}
                value={unlockMsg}
                onChangeText={setUnlockMsg}
                placeholder={`Lock screen message e.g. "Complete ${title || "this chore"} first!"`}
              />
            )}
          </View>

          {(!title.trim() || selectedKids.length === 0) && (
            <View style={styles.validationHint}>
              {!title.trim() && <Text style={styles.validationHintText}>• Enter a chore title</Text>}
              {selectedKids.length === 0 && <Text style={styles.validationHintText}>• Select at least one kid</Text>}
            </View>
          )}
          <TouchableOpacity
            style={[styles.createBtn, (!title.trim() || selectedKids.length === 0) && styles.createBtnDisabled]}
            onPress={() => { Keyboard.dismiss(); createChore(); }}
            disabled={!title.trim() || selectedKids.length === 0}
          >
            <Text style={styles.createBtnText}>
              {isAuto ? "Create Auto Chore 🔁" : "Create Chore ✓"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {/* ── Feature Locks tab ── */}
      {tab === "locks" && (
        <View>
          <Text style={styles.locksIntro}>
            Lock specific features for each kid. Locked features show a 🔒 overlay on their home screen. Link chores to auto-unlock features when approved.
          </Text>
          {state.kids.map(kid => {
            const locked = kid.rules.lockedFeatures ?? [];
            const lockedCount = locked.length;
            return (
              <View key={kid.profile.id} style={styles.lockKidCard}>
                <View style={styles.lockKidHeader}>
                  <Text style={styles.lockKidName}>{kid.profile.name}</Text>
                  <Text style={styles.lockKidCount}>
                    {lockedCount > 0 ? `${lockedCount} locked` : "All unlocked"}
                  </Text>
                </View>
                <View style={styles.lockBtnRow}>
                  <TouchableOpacity
                    style={styles.lockAllBtn}
                    onPress={() => Alert.alert(
                      `Lock All Features for ${kid.profile.name}?`,
                      "This locks everything except Chores, Help, and Safety features.",
                      [
                        { text: "Cancel" },
                        { text: "Lock All 🔒", style: "destructive", onPress: () => dispatch({ type: "LOCK_ALL_FEATURES", kidId: kid.profile.id }) },
                      ]
                    )}
                  >
                    <Text style={styles.lockAllBtnText}>🔒 Lock All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.unlockAllBtn}
                    onPress={() => dispatch({ type: "UNLOCK_ALL_FEATURES", kidId: kid.profile.id })}
                  >
                    <Text style={styles.unlockAllBtnText}>🔓 Unlock All</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.featureGrid}>
                  {LOCKABLE_FEATURES.map(fid => {
                    const isLocked = locked.includes(fid);
                    return (
                      <TouchableOpacity
                        key={fid}
                        style={[styles.featureChip, isLocked && styles.featureChipLocked]}
                        onPress={() => dispatch({ type: "SET_FEATURE_LOCK", kidId: kid.profile.id, featureId: fid, locked: !isLocked })}
                      >
                        <Text style={[styles.featureChipText, isLocked && styles.featureChipTextLocked]}>
                          {isLocked ? "🔒 " : "🔓 "}{FEATURE_LABELS[fid]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {/* ── Edit Chore Modal ── */}
      <Modal visible={!!editingChore} transparent animationType="fade" onRequestClose={() => setEditingChore(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✏️ Edit Chore</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Chore title…"
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Description (optional)…"
            />
            <PointsInput
              inputStyle={styles.input}
              value={editPoints}
              onChangeText={setEditPoints}
              placeholder="Points"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingChore(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !editTitle.trim() && { opacity: 0.4 }]}
                onPress={saveEdit}
                disabled={!editTitle.trim()}
              >
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:     { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  tabRow:    { flexDirection: "row", gap: 6, marginBottom: Spacing.md },
  tab:       { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4, borderRadius: Radius.md, backgroundColor: Colors.cardLight, minHeight: 40 },
  tabActive: { backgroundColor: Colors.primary },
  tabText:   { fontWeight: "700", color: Colors.textSecondary, fontSize: 12, textAlign: "center" },
  tabTextActive: { color: "#fff" },
  empty:     { color: Colors.textSecondary, textAlign: "center", paddingVertical: Spacing.lg },

  // Chore cards
  choreCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  autoChoreCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  choreCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  choreTitleText:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, flex: 1 },
  choreKidBadge:   { backgroundColor: Colors.primary + "20", paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  choreMeta:       { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 4 },
  choreNote:       { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 6 },
  deadlineMeta:    { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginBottom: 4 },
  penaltyMeta:     { color: Colors.error },
  autoBadge:       { backgroundColor: Colors.primary + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  autoBadgeText:   { fontSize: 11, color: Colors.primary, fontWeight: "700" },
  dayRow:          { flexDirection: "row", gap: 4, marginTop: 6 },
  dayDot:          { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  dayDotActive:    { backgroundColor: Colors.primary },
  dayDotText:      { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  dayDotTextActive:{ color: "#fff" },
  choreActions:    { flexDirection: "row", gap: 8, marginTop: Spacing.sm },
  approveBtn:      { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  approveBtnText:  { color: "#fff", fontWeight: "700" },
  rejectBtn:       { flex: 1, backgroundColor: Colors.error + "20", borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  rejectBtnText:   { color: Colors.error, fontWeight: "700" },

  // New chore form
  form:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, gap: 10 },
  input:      { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base },
  formLabel:  { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  kidSelector:{ flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kidChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  kidChipActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  kidChipText: { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: Colors.primary },

  // Auto toggle
  autoRow:    { flexDirection: "row", alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm },
  autoRowLeft:{ flex: 1 },
  autoLabel:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  autoSub:    { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Auto options
  autoOptions:{ backgroundColor: Colors.primary + "08", borderRadius: Radius.md, padding: Spacing.sm, gap: 8, borderWidth: 1, borderColor: Colors.primary + "30" },
  dayPicker:  { flexDirection: "row", gap: 6 },
  dayBtn:     { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  dayBtnActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  dayBtnText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  dayBtnTextActive: { color: Colors.primary },

  timePicker:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 2, borderColor: Colors.primary + "40", borderRadius: Radius.md, padding: Spacing.sm, backgroundColor: Colors.surfaceLight },
  timePickerText:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  timePickerChevron: { color: Colors.textSecondary },
  hourList:        { maxHeight: 160, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.surfaceLight },
  hourItem:        { paddingVertical: 10, paddingHorizontal: Spacing.sm },
  hourItemActive:  { backgroundColor: Colors.primary + "15" },
  hourItemText:    { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "500" },
  hourItemTextActive: { color: Colors.primary, fontWeight: "700" },

  penaltyRow:       { flexDirection: "row", gap: 8, alignItems: "center" },
  penaltyLabel:     { backgroundColor: Colors.error + "15", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: Spacing.sm },
  penaltyLabelText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },

  warningBox:  { backgroundColor: "#FFF3CD", borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: "#F59E0B40" },
  warningText: { color: "#92400E", fontSize: FontSize.sm, lineHeight: 18 },

  createBtn:         { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 14 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText:     { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  validationHint:    { backgroundColor: Colors.error + "12", borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.error + "30" },
  validationHintText:{ color: Colors.error, fontSize: FontSize.sm, fontWeight: "600", marginBottom: 2 },

  // Points presets
  pointsPresets:      { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  pointsPresetLabel:  { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600", marginRight: 2 },
  pointsPresetBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border },
  pointsPresetBtnActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  pointsPresetText:   { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  pointsPresetTextActive: { color: Colors.primary },

  // Active chore unlock badges
  unlockRow:         { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  unlockLabel:       { fontSize: FontSize.xs, fontWeight: "700", color: Colors.success },
  unlockChip:        { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  unlockChipText:    { fontSize: 10, fontWeight: "700", color: Colors.success },

  // New chore form — unlock features
  unlockSection: {
    backgroundColor: Colors.primary + "08", borderRadius: Radius.lg,
    padding: Spacing.sm, gap: 8, borderWidth: 1, borderColor: Colors.primary + "25",
  },
  unlockSectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  unlockSectionSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 17 },
  featureGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  featureChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border,
  },
  featureChipOn:      { backgroundColor: Colors.success + "18", borderColor: Colors.success },
  featureChipText:    { fontSize: 11, fontWeight: "600", color: Colors.textSecondary },
  featureChipTextOn:  { color: Colors.success, fontWeight: "700" },

  // Locks tab
  locksIntro: {
    fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20,
    backgroundColor: Colors.cardLight, borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.md,
  },
  lockKidCard:    { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 12, ...Shadow.sm, gap: 10 },
  lockKidHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lockKidName:    { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  lockKidCount:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  lockBtnRow:     { flexDirection: "row", gap: 10 },
  lockAllBtn:     { flex: 1, backgroundColor: Colors.error + "15", borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.error + "40" },
  lockAllBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  unlockAllBtn:   { flex: 1, backgroundColor: Colors.success + "15", borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.success + "40" },
  unlockAllBtnText: { color: Colors.success, fontWeight: "700", fontSize: FontSize.sm },
  featureChipLocked:     { backgroundColor: Colors.error + "15", borderColor: Colors.error + "60" },
  featureChipTextLocked: { color: Colors.error, fontWeight: "700" },

  // Approve All
  approveAllBtn:  { backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", padding: 14, marginBottom: Spacing.md },
  approveAllText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Urgency
  urgencyTag: { fontSize: 11, fontWeight: "700", borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },

  // Active chore actions
  activeChoreActions: { flexDirection: "row", gap: 8, marginTop: Spacing.sm },
  editBtn:   { flex: 1, borderWidth: 1.5, borderColor: Colors.primary + "60", borderRadius: Radius.full, alignItems: "center", paddingVertical: 8 },
  editBtnText:   { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  deleteBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.error + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 8 },
  deleteBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },

  // Edit modal
  modalOverlay:  { flex: 1, backgroundColor: "#00000088", justifyContent: "center", alignItems: "center", padding: Spacing.lg },
  modalCard:     { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, width: "100%", gap: 12, ...Shadow.md },
  modalTitle:    { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  modalActions:  { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  modalCancelText: { color: Colors.textSecondary, fontWeight: "700" },
  modalSaveBtn:  { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  modalSaveText: { color: "#fff", fontWeight: "800" },
});
