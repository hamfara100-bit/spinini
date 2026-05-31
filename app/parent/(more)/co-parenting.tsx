import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Switch,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso, confirmDestructive, alertMessage } from "../../../lib/utils";
import type {
  CoParentScheduleEvent, CannotPickupAlert, SharedExpense,
  CoScheduleEventType, SharedExpenseCategory,
} from "../../../lib/data/types";

const TABS = ["Schedule", "Alerts", "Expenses"] as const;
type Tab = typeof TABS[number];

const EVENT_TYPES: { type: CoScheduleEventType; label: string; emoji: string }[] = [
  { type: "pickup",       label: "Pickup",       emoji: "🚗" },
  { type: "dropoff",      label: "Drop-off",      emoji: "📍" },
  { type: "school_drop",  label: "School Drop",   emoji: "🏫" },
  { type: "quality_time", label: "Quality Time",  emoji: "💛" },
  { type: "work",         label: "Work",          emoji: "💼" },
  { type: "custom",       label: "Custom",        emoji: "📅" },
];

const EXPENSE_CATS: { cat: SharedExpenseCategory; label: string; emoji: string }[] = [
  { cat: "school_supplies", label: "School Supplies", emoji: "🎒" },
  { cat: "clothing",        label: "Clothing",        emoji: "👕" },
  { cat: "electronics",     label: "Electronics",     emoji: "💻" },
  { cat: "groceries",       label: "Groceries",       emoji: "🛒" },
  { cat: "medical",         label: "Medical",         emoji: "🏥" },
  { cat: "activities",      label: "Activities",      emoji: "🎯" },
  { cat: "other",           label: "Other",           emoji: "📦" },
];

function scheduleBadge(status: string) {
  if (status === "agreed") return { label: "Agreed", color: Colors.success };
  if (status === "cancelled") return { label: "Cancelled", color: Colors.error };
  return { label: "Pending", color: Colors.secondary };
}

function alertBadge(status: string) {
  if (status === "accepted") return { label: "Accepted", color: Colors.success };
  if (status === "denied")   return { label: "Denied",   color: Colors.error };
  return { label: "Pending", color: Colors.secondary };
}

function expenseBadge(status: string) {
  if (status === "accepted") return { label: "Accepted", color: Colors.success };
  if (status === "denied")   return { label: "Denied",   color: Colors.error };
  return { label: "Pending", color: Colors.secondary };
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function ScheduleTab() {
  const { state, dispatch } = useData();
  const events = state.coParentSchedule ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [evType, setEvType] = useState<CoScheduleEventType>("pickup");
  const [customLabel, setCustomLabel] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [shareWithKids, setShareWithKids] = useState(true);
  const [remindOther, setRemindOther] = useState(true);

  function reset() {
    setEvType("pickup"); setCustomLabel(""); setDate(""); setTime("");
    setEndTime(""); setNotes(""); setShareWithKids(true); setRemindOther(true);
    setEditId(null);
  }

  function openEdit(ev: CoParentScheduleEvent) {
    setEvType(ev.type); setCustomLabel(ev.customLabel ?? "");
    setDate(ev.date); setTime(ev.time); setEndTime(ev.endTime ?? "");
    setNotes(ev.notes ?? ""); setShareWithKids(ev.shareWithKids);
    setRemindOther(ev.remindOtherParent); setEditId(ev.id);
    setShowForm(true);
  }

  function save() {
    if (!date.trim() || !time.trim()) { alertMessage("Date and time are required."); return; }
    if (evType === "custom" && !customLabel.trim()) { alertMessage("Custom label required."); return; }
    const parentId = state.parent.id ?? "parent-1";
    if (editId) {
      dispatch({ type: "CO_SCHEDULE_UPDATE", eventId: editId, payload: {
        type: evType, customLabel: customLabel || undefined, date: date.trim(),
        time: time.trim(), endTime: endTime.trim() || undefined, notes: notes.trim() || undefined,
        shareWithKids, remindOtherParent: remindOther,
        // Editing agreed events requires re-agreement from the other parent
        status: "pending_agreement", agreedByOther: false,
      }});
    } else {
      const ev: CoParentScheduleEvent = {
        id: uid(), type: evType, customLabel: customLabel || undefined,
        date: date.trim(), time: time.trim(), endTime: endTime.trim() || undefined,
        parentId, proposedBy: parentId, status: "pending_agreement",
        remindOtherParent: remindOther, shareWithKids,
        notes: notes.trim() || undefined, createdAt: nowIso(),
      };
      dispatch({ type: "CO_SCHEDULE_ADD", event: ev });
    }
    setShowForm(false); reset();
  }

  function remove(id: string) {
    confirmDestructive("Delete event?", "", () => dispatch({ type: "CO_SCHEDULE_DELETE", eventId: id }));
  }

  function agree(ev: CoParentScheduleEvent) {
    dispatch({ type: "CO_SCHEDULE_UPDATE", eventId: ev.id, payload: { status: "agreed", agreedByOther: true } });
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <TouchableOpacity style={styles.addBtn} onPress={() => { reset(); setShowForm(true); }}>
        <Text style={styles.addBtnText}>+ Add Schedule Event</Text>
      </TouchableOpacity>

      {sorted.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyText}>No schedule events yet.</Text>
          <Text style={styles.emptySub}>Add pickups, drop-offs, and quality time with your co-parent.</Text>
        </View>
      )}

      {sorted.map(ev => {
        const badge = scheduleBadge(ev.status);
        const typeInfo = EVENT_TYPES.find(t => t.type === ev.type);
        return (
          <View key={ev.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventEmoji}>{typeInfo?.emoji ?? "📅"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{ev.customLabel || typeInfo?.label}</Text>
                <Text style={styles.eventMeta}>{ev.date} · {ev.time}{ev.endTime ? ` – ${ev.endTime}` : ""}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>
            {ev.notes ? <Text style={styles.eventNotes}>{ev.notes}</Text> : null}
            <View style={styles.eventTags}>
              {ev.shareWithKids && <Text style={styles.tag}>👧 Shared with kids</Text>}
              {ev.remindOtherParent && <Text style={styles.tag}>🔔 Notify co-parent</Text>}
            </View>
            <View style={styles.cardActions}>
              {ev.status === "pending_agreement" && (
                <TouchableOpacity style={styles.agreeBtn} onPress={() => agree(ev)}>
                  <Text style={styles.agreeBtnText}>✓ Agree</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.editCardBtn} onPress={() => openEdit(ev)}>
                <Text style={styles.editCardText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(ev.id)}>
                <Text style={styles.deleteCardText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editId ? "✏️ Edit Event" : "📅 New Schedule Event"}</Text>

            <Text style={styles.fieldLabel}>Event Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.typeChip, evType === t.type && styles.typeChipActive]}
                  onPress={() => setEvType(t.type)}
                >
                  <Text style={evType === t.type ? { color: "#fff", fontWeight: "700" } : {}}>{t.emoji} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {evType === "custom" && (
              <TextInput style={styles.input} value={customLabel} onChangeText={setCustomLabel}
                placeholder="Custom label (e.g. Soccer practice drop)" />
            )}

            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-06-01" />

            <Text style={styles.fieldLabel}>Start Time (HH:MM)</Text>
            <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="15:30" />

            <Text style={styles.fieldLabel}>End Time (optional)</Text>
            <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="17:00" />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              value={notes} onChangeText={setNotes} multiline placeholder="Any notes…" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Share with kids</Text>
              <Switch value={shareWithKids} onValueChange={setShareWithKids} trackColor={{ true: Colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Notify co-parent</Text>
              <Switch value={remindOther} onValueChange={setRemindOther} trackColor={{ true: Colors.primary }} />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); reset(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={save}>
                <Text style={styles.saveModalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab() {
  const { state, dispatch } = useData();
  const alerts = state.cannotPickupAlerts ?? [];
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [responseMsg, setResponseMsg] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  function sendAlert() {
    if (!reason.trim()) { alertMessage("Please describe why you cannot pickup."); return; }
    const a: CannotPickupAlert = {
      id: uid(), fromParentId: state.parent.id ?? "parent-1",
      reason: reason.trim(), status: "pending", createdAt: nowIso(),
    };
    dispatch({ type: "CANNOT_PICKUP_ADD", alert: a });
    setReason(""); setShowForm(false);
  }

  function respond(id: string, status: "accepted" | "denied") {
    dispatch({ type: "CANNOT_PICKUP_UPDATE", alertId: id, payload: {
      status, responseMessage: responseMsg.trim() || undefined,
      respondedAt: nowIso(),
    }});
    setRespondingId(null); setResponseMsg("");
  }

  function remove(id: string) {
    confirmDestructive("Delete alert?", "", () => dispatch({ type: "CANNOT_PICKUP_DELETE", alertId: id }));
  }

  return (
    <>
      <View style={styles.alertInfoBox}>
        <Text style={styles.alertInfoText}>🚨 Use this to notify your co-parent when you cannot make a pickup or drop-off, and coordinate coverage.</Text>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>+ I Can't Make a Pickup</Text>
      </TouchableOpacity>

      {alerts.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyText}>No pickup alerts.</Text>
          <Text style={styles.emptySub}>Use this when you can't make a scheduled pickup or drop-off.</Text>
        </View>
      )}

      {alerts.map(a => {
        const badge = alertBadge(a.status);
        const isResponding = respondingId === a.id;
        return (
          <View key={a.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventEmoji}>🚫</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>Cannot Pickup</Text>
                <Text style={styles.eventMeta}>{new Date(a.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>
            <Text style={styles.alertReason}>"{a.reason}"</Text>
            {a.responseMessage ? (
              <Text style={styles.responseMsg}>Reply: "{a.responseMessage}"</Text>
            ) : null}

            {!isResponding && (
              <View style={styles.cardActions}>
                {a.status === "pending" && (
                  <TouchableOpacity style={styles.agreeBtn} onPress={() => setRespondingId(a.id)}>
                    <Text style={styles.agreeBtnText}>Respond</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(a.id)}>
                  <Text style={styles.deleteCardText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}

            {isResponding && (
              <View style={{ marginTop: 8, gap: 8 }}>
                <TextInput style={styles.input} value={responseMsg} onChangeText={setResponseMsg}
                  placeholder="Optional message to co-parent…" />
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.agreeBtn} onPress={() => respond(a.id, "accepted")}>
                    <Text style={styles.agreeBtnText}>✓ Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.agreeBtn, { backgroundColor: Colors.error + "22", borderColor: Colors.error }]}
                    onPress={() => respond(a.id, "denied")}>
                    <Text style={[styles.agreeBtnText, { color: Colors.error }]}>✕ Deny</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editCardBtn} onPress={() => { setRespondingId(null); setResponseMsg(""); }}>
                    <Text style={styles.editCardText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); setReason(""); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🚫 Can't Make a Pickup</Text>
            <Text style={styles.fieldLabel}>Reason</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={reason} onChangeText={setReason} multiline
              placeholder="e.g. Work emergency, car trouble, appointment…" autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setReason(""); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={sendAlert}>
                <Text style={styles.saveModalBtnText}>Send Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab() {
  const { state, dispatch } = useData();
  const expenses = state.sharedExpenses ?? [];
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<SharedExpenseCategory>("school_supplies");
  const [notes, setNotes] = useState("");

  function reset() { setTitle(""); setAmount(""); setCat("school_supplies"); setNotes(""); }

  function save() {
    if (!title.trim()) { alertMessage("Title is required."); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alertMessage("Enter a valid amount."); return; }
    const ex: SharedExpense = {
      id: uid(), title: title.trim(), amount: amt, category: cat,
      addedByParentId: state.parent.id ?? "parent-1",
      status: "pending", fulfilled: false,
      date: new Date().toISOString().split("T")[0],
      notes: notes.trim() || undefined,
    };
    dispatch({ type: "SHARED_EXPENSE_ADD", expense: ex });
    setShowForm(false); reset();
  }

  function respond(id: string, status: "accepted" | "denied") {
    dispatch({ type: "SHARED_EXPENSE_UPDATE", expenseId: id, payload: { status } });
  }

  function markFulfilled(id: string) {
    dispatch({ type: "SHARED_EXPENSE_UPDATE", expenseId: id, payload: { fulfilled: true, fulfilledAt: nowIso() } });
  }

  function remove(id: string) {
    confirmDestructive("Delete expense?", "", () => dispatch({ type: "SHARED_EXPENSE_DELETE", expenseId: id }));
  }

  const totalPending = expenses.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  return (
    <>
      {totalPending > 0 && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>💰 ${totalPending.toFixed(2)} pending co-parent expenses</Text>
        </View>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>+ Add Shared Expense</Text>
      </TouchableOpacity>

      {expenses.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💳</Text>
          <Text style={styles.emptyText}>No shared expenses yet.</Text>
          <Text style={styles.emptySub}>Track school supplies, clothing, medical, and other shared costs.</Text>
        </View>
      )}

      {expenses.map(ex => {
        const badge = expenseBadge(ex.status);
        const catInfo = EXPENSE_CATS.find(c => c.cat === ex.category);
        return (
          <View key={ex.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventEmoji}>{catInfo?.emoji ?? "💳"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{ex.title}</Text>
                <Text style={styles.eventMeta}>{catInfo?.label} · {ex.date}</Text>
              </View>
              <Text style={styles.expenseAmount}>${ex.amount.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, alignItems: "center" }}>
              <View style={[styles.statusBadge, { backgroundColor: badge.color + "22", borderColor: badge.color }]}>
                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
              </View>
              {ex.fulfilled && <Text style={styles.tag}>✅ Fulfilled</Text>}
              {ex.receiptPhotoUri && <Text style={styles.tag}>📷 Receipt</Text>}
            </View>
            {ex.notes ? <Text style={styles.eventNotes}>{ex.notes}</Text> : null}
            <View style={styles.cardActions}>
              {ex.status === "pending" && (
                <>
                  <TouchableOpacity style={styles.agreeBtn} onPress={() => respond(ex.id, "accepted")}>
                    <Text style={styles.agreeBtnText}>✓ Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.agreeBtn, { backgroundColor: Colors.error + "22", borderColor: Colors.error }]}
                    onPress={() => respond(ex.id, "denied")}>
                    <Text style={[styles.agreeBtnText, { color: Colors.error }]}>✕ Deny</Text>
                  </TouchableOpacity>
                </>
              )}
              {ex.status === "accepted" && !ex.fulfilled && (
                <TouchableOpacity style={styles.agreeBtn} onPress={() => markFulfilled(ex.id)}>
                  <Text style={styles.agreeBtnText}>Mark Paid</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.deleteCardBtn} onPress={() => remove(ex.id)}>
                <Text style={styles.deleteCardText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => { setShowForm(false); reset(); }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>💳 Add Shared Expense</Text>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="e.g. Winter jacket, School backpack" autoFocus />

            <Text style={styles.fieldLabel}>Amount ($)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount}
              placeholder="0.00" keyboardType="decimal-pad" />

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {EXPENSE_CATS.map(c => (
                <TouchableOpacity key={c.cat}
                  style={[styles.typeChip, cat === c.cat && styles.typeChipActive]}
                  onPress={() => setCat(c.cat)}>
                  <Text style={cat === c.cat ? { color: "#fff", fontWeight: "700" } : {}}>{c.emoji} {c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
              value={notes} onChangeText={setNotes} multiline placeholder="Any notes…" />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); reset(); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={save}>
                <Text style={styles.saveModalBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoParentingScreen() {
  const [tab, setTab] = useState<Tab>("Schedule");

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🤝 Co-Parenting</Text>
      <Text style={styles.sub}>Coordinate schedules, pickups, and shared expenses with your co-parent.</Text>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "Schedule" && <ScheduleTab />}
      {tab === "Alerts"   && <AlertsTab />}
      {tab === "Expenses" && <ExpensesTab />}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },

  tabBar: { flexDirection: "row", backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: 4, marginBottom: Spacing.md, gap: 4 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.lg },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },

  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 13, marginBottom: Spacing.md, ...Shadow.md },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  eventCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 14, marginBottom: 10, ...Shadow.sm },
  eventHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  eventEmoji: { fontSize: 22, marginTop: 2 },
  eventTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  eventMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  eventNotes: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, fontStyle: "italic" },
  eventTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },

  statusBadge: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: "700" },

  tag: { fontSize: FontSize.xs, backgroundColor: Colors.cardLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, color: Colors.textSecondary, fontWeight: "600" },

  cardActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  agreeBtn: { borderWidth: 1.5, borderColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.success + "22" },
  agreeBtnText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },
  editCardBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primary + "15" },
  editCardText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  deleteCardBtn: { borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.error + "15" },
  deleteCardText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error },

  alertInfoBox: { backgroundColor: "#FFF8E7", borderRadius: Radius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.secondary + "44" },
  alertInfoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  alertReason: { fontSize: FontSize.base, color: Colors.textPrimary, marginTop: 8, fontStyle: "italic" },
  responseMsg: { fontSize: FontSize.sm, color: Colors.success, marginTop: 4 },

  summaryBox: { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.primary + "33" },
  summaryText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  expenseAmount: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: Colors.surfaceLight, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: 10, paddingBottom: 40 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { borderWidth: 2, borderColor: "#E5E0FF", borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, marginBottom: 0 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0EAF8" },
  switchLabel: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "500" },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: "#E5E0FF", marginRight: 8, backgroundColor: Colors.cardLight },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: "#E5E0FF", borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveModalBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.md },
  saveModalBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
