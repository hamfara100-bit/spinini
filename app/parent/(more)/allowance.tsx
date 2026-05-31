import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Switch,
  Alert, ScrollView, Modal, Linking, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, today, nowIso, POINT_VALUE, pointsToMoney } from "../../../lib/utils";
import type {
  AllowanceSchedule, PointPayout, PayoutMethod,
  KidPaymentHandle, PaymentRequest,
} from "../../../lib/data/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCIES = [
  { key: "weekly",   label: "Weekly" },
  { key: "biweekly", label: "Every 2 weeks" },
  { key: "monthly",  label: "Monthly" },
] as const;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const METHOD_META: Record<PayoutMethod, { emoji: string; label: string; desc: string; color: string }> = {
  cash:       { emoji: "💵", label: "Cash",       desc: "Given directly",      color: "#10B981" },
  piggy_bank: { emoji: "🐷", label: "Piggy Bank", desc: "Added to balance",    color: "#7C5CFF" },
  sent:       { emoji: "📤", label: "Sent",        desc: "Transfer / other",   color: "#3B82F6" },
  venmo:      { emoji: "💙", label: "Venmo",       desc: "Via Venmo app",      color: "#008CFF" },
  cashapp:    { emoji: "💚", label: "Cash App",    desc: "Via Cash App",       color: "#00D632" },
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  points:    "⭐ Points Payout",
  allowance: "💰 Allowance",
  both:      "⭐💰 Points + Allowance",
};

type Tab = "schedules" | "cashout" | "history";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function isoWeekStart()  { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split("T")[0]; }
function isoMonthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
function isoYearStart()  { return `${new Date().getFullYear()}-01-01`; }

function sumPayouts(payouts: (PointPayout & { kidName?: string })[], since: string) {
  return payouts
    .filter(p => p.date >= since)
    .reduce((a, p) => ({ points: a.points + p.points, amount: a.amount + p.amount }), { points: 0, amount: 0 });
}

function buildVenmoLink(username: string, amount: number, note: string): string {
  const enc = encodeURIComponent;
  return `https://venmo.com/?txn=pay&recipients=${enc(username)}&amount=${amount.toFixed(2)}&note=${enc(note)}`;
}

function buildCashAppLink(tag: string, amount: number): string {
  const clean = tag.replace(/^\$/, "");
  return `https://cash.app/$${clean}/${amount.toFixed(2)}`;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AllowanceScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("schedules");
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");

  // Schedule form
  const [showForm, setShowForm]       = useState(false);
  const [amount, setAmount]           = useState("5");
  const [label, setLabel]             = useState("Weekly allowance");
  const [frequency, setFrequency]     = useState<AllowanceSchedule["frequency"]>("weekly");
  const [dayOfWeek, setDayOfWeek]     = useState(5);
  const [dayOfMonth, setDayOfMonth]   = useState(1);

  // Payout modal
  const [showPayout, setShowPayout]     = useState(false);
  const [payoutKidId, setPayoutKidId]   = useState("");
  const [payoutPoints, setPayoutPoints] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("cash");
  const [payoutNote, setPayoutNote]     = useState("");
  const [awaitConfirm, setAwaitConfirm] = useState(false); // after deep-link opens

  // Handle editor modal
  const [showHandleEdit, setShowHandleEdit]     = useState(false);
  const [handleKidId, setHandleKidId]           = useState("");
  const [editVenmo, setEditVenmo]               = useState("");
  const [editCashapp, setEditCashapp]           = useState("");

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const schedules = kid?.allowanceSchedules ?? [];
  const allPayouts = state.kids.flatMap(k =>
    (k.pointPayouts ?? []).map(p => ({ ...p, kidName: k.profile.name }))
  );

  // ── Schedule helpers ────────────────────────────────────────────────────────
  function openForm() {
    setAmount("5"); setLabel("Weekly allowance");
    setFrequency("weekly"); setDayOfWeek(5); setDayOfMonth(1);
    setShowForm(true);
  }

  function addSchedule() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { Alert.alert("Invalid amount"); return; }
    if (!label.trim()) { Alert.alert("Label required"); return; }
    const schedule: AllowanceSchedule = {
      id: uid(), amount: amt, currency: kid?.money.currency ?? "USD",
      frequency, label: label.trim(), enabled: true,
      dayOfWeek: frequency !== "monthly" ? dayOfWeek : undefined,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
    };
    dispatch({ type: "ALLOWANCE_SCHEDULE_ADD", kidId: selectedKidId, schedule });
    setShowForm(false);
  }

  function payNow(s: AllowanceSchedule) {
    dispatch({ type: "ALLOWANCE_PAY", kidId: selectedKidId, scheduleId: s.id, amount: s.amount, label: s.label });
    Alert.alert("Paid! 🐷", `$${s.amount.toFixed(2)} added to ${kid?.profile.name}'s piggy bank.`);
  }

  function removeSchedule(scheduleId: string) {
    Alert.alert("Delete schedule?", "This will stop future auto-payments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () =>
        dispatch({ type: "ALLOWANCE_SCHEDULE_DELETE", kidId: selectedKidId, scheduleId })
      },
    ]);
  }

  // ── Handle editor ───────────────────────────────────────────────────────────
  function openHandleEdit(kidId: string) {
    const k = state.kids.find(x => x.profile.id === kidId);
    setHandleKidId(kidId);
    setEditVenmo(k?.paymentHandle?.venmoUsername ?? "");
    setEditCashapp(k?.paymentHandle?.cashappTag ?? "");
    setShowHandleEdit(true);
  }

  function saveHandle() {
    const handle: KidPaymentHandle = {};
    if (editVenmo.trim())   handle.venmoUsername = editVenmo.trim().replace(/^@/, "");
    if (editCashapp.trim()) handle.cashappTag    = editCashapp.trim().replace(/^\$/, "");
    dispatch({ type: "SET_KID_PAYMENT_HANDLE", kidId: handleKidId, handle });
    setShowHandleEdit(false);
  }

  // ── Payout ──────────────────────────────────────────────────────────────────
  function openPayout(kidId: string, requestId?: string) {
    const k = state.kids.find(x => x.profile.id === kidId);
    const pts = k?.behavior.totalPoints ?? 0;
    setPayoutKidId(kidId);
    setPayoutPoints(String(pts));
    setPayoutMethod("cash");
    setPayoutNote("");
    setAwaitConfirm(false);
    if (requestId) {
      const req = k?.paymentRequests?.find(r => r.id === requestId);
      if (req) {
        if (req.type === "points" && req.pointsAmount) setPayoutPoints(String(req.pointsAmount));
        if (req.type === "allowance" && req.allowanceAmount) {
          setPayoutPoints("0");
          setPayoutNote(`Allowance: $${req.allowanceAmount?.toFixed(2)}`);
        }
        if (req.type === "both") {
          if (req.pointsAmount) setPayoutPoints(String(req.pointsAmount));
        }
        if (req.message) setPayoutNote(req.message);
      }
    }
    setShowPayout(true);
  }

  async function openDeepLink(method: PayoutMethod, amount: number, note: string, kidId: string) {
    const k = state.kids.find(x => x.profile.id === kidId);
    const handle = k?.paymentHandle;
    let url = "";
    if (method === "venmo") {
      const user = handle?.venmoUsername;
      if (!user) { Alert.alert("No Venmo username", "Add this kid's Venmo username first."); return; }
      url = buildVenmoLink(user, amount, note || "Spinini payout");
    } else if (method === "cashapp") {
      const tag = handle?.cashappTag;
      if (!tag) { Alert.alert("No Cash App tag", "Add this kid's Cash App $tag first."); return; }
      url = buildCashAppLink(tag, amount);
    }
    if (url) {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else if (Platform.OS === "web") {
        (window as any).open(url, "_blank");
      } else {
        Alert.alert("App not found", "Make sure Venmo or Cash App is installed.");
        return;
      }
      setAwaitConfirm(true);
    }
  }

  function confirmPayout(requestId?: string) {
    const pts  = parseInt(payoutPoints) || 0;
    const dollarVal = pts * POINT_VALUE;
    if (pts <= 0 && !["cash","sent","venmo","cashapp"].includes(payoutMethod)) {
      Alert.alert("Enter points", "Enter the number of points to cash out."); return;
    }
    const k = state.kids.find(x => x.profile.id === payoutKidId);
    const available = k?.behavior.totalPoints ?? 0;
    if (pts > 0 && pts > available) {
      Alert.alert("Not enough points", `${k?.profile.name} only has ${available} pts.`); return;
    }
    const payout: PointPayout = {
      id: uid(), points: pts, amount: dollarVal, method: payoutMethod,
      note: payoutNote.trim() || undefined,
      paidBy: state.parent.name,
      date: today(), createdAt: nowIso(),
    };
    dispatch({ type: "POINT_PAYOUT", kidId: payoutKidId, payout });
    // Mark linked payment request as paid
    if (requestId) {
      dispatch({
        type: "PAYMENT_REQUEST_UPDATE", kidId: payoutKidId, requestId,
        payload: { status: "paid", respondedAt: nowIso(), respondedBy: state.parent.name, responseNote: payoutNote.trim() || undefined },
      });
    }
    setShowPayout(false);
    setAwaitConfirm(false);
    Alert.alert("Payout recorded! 🎉", `${k?.profile.name}: ${pts} pts = $${dollarVal.toFixed(2)} via ${METHOD_META[payoutMethod].label}. Paid by ${state.parent.name}.`);
  }

  function declineRequest(kidId: string, requestId: string) {
    Alert.alert("Decline request?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () =>
        dispatch({
          type: "PAYMENT_REQUEST_UPDATE", kidId, requestId,
          payload: { status: "declined", respondedAt: nowIso(), respondedBy: state.parent.name },
        })
      },
    ]);
  }

  if (state.kids.length === 0) {
    return <ScreenContainer><Text style={s.empty}>No kids added yet.</Text></ScreenContainer>;
  }

  const thisWeek  = sumPayouts(allPayouts, isoWeekStart());
  const thisMonth = sumPayouts(allPayouts, isoMonthStart());
  const thisYear  = sumPayouts(allPayouts, isoYearStart());

  // Pending payment requests across all kids
  const pendingRequests = state.kids.flatMap(k =>
    (k.paymentRequests ?? [])
      .filter(r => r.status === "pending")
      .map(r => ({ ...r, kidName: k.profile.name, kidId: k.profile.id }))
  );

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>💰 Allowance</Text>

      {/* Tab bar */}
      <View style={s.tabRow}>
        {(["schedules","cashout","history"] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "schedules" ? "📅 Schedules" : t === "cashout" ? "⭐ Cash Out" : "📋 History"}
            </Text>
            {t === "cashout" && pendingRequests.length > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeText}>{pendingRequests.length}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Schedules tab ── */}
      {tab === "schedules" && (
        <>
          <View style={s.rowBetween}>
            <Text style={[s.sub, { flex: 1 }]}>Auto-deposit allowance to your kid's piggy bank.</Text>
            <TouchableOpacity style={s.addBtn} onPress={openForm}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {state.kids.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {state.kids.map(k => (
                <TouchableOpacity key={k.profile.id}
                  style={[s.kidChip, selectedKidId === k.profile.id && s.kidChipActive]}
                  onPress={() => setSelectedKidId(k.profile.id)}>
                  <Text style={[s.kidChipText, selectedKidId === k.profile.id && s.kidChipTextActive]}>{k.profile.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {schedules.length === 0 ? (
            <View style={s.emptyCard}><Text style={s.emptyEmoji}>💸</Text><Text style={s.emptyText}>No schedules yet.{"\n"}Tap + Add to create one.</Text></View>
          ) : (
            schedules.map(sc => (
              <View key={sc.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardLabel}>{sc.label}</Text>
                    <Text style={s.cardAmount}>
                      ${sc.amount.toFixed(2)} · {sc.frequency === "monthly" ? `Day ${sc.dayOfMonth} of month` : sc.frequency === "biweekly" ? `Every 2nd ${DAYS[sc.dayOfWeek ?? 5]}` : `Every ${DAYS[sc.dayOfWeek ?? 5]}`}
                    </Text>
                    <Text style={s.cardLast}>Last paid: {sc.lastPaidAt ? fmtDate(sc.lastPaidAt) : "Never"}</Text>
                  </View>
                  <Switch value={sc.enabled} onValueChange={v => dispatch({ type: "ALLOWANCE_SCHEDULE_UPDATE", kidId: selectedKidId, scheduleId: sc.id, payload: { enabled: v } })} trackColor={{ true: Colors.primary }} thumbColor="#fff" />
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.payBtn} onPress={() => payNow(sc)}><Text style={s.payBtnText}>Pay Now</Text></TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => removeSchedule(sc.id)}><Text style={s.deleteBtnText}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>ℹ️ How it works</Text>
            <Text style={s.infoText}>Schedules auto-pay when the app is opened on or after the scheduled day. Payment goes directly into your kid's piggy bank.</Text>
          </View>
        </>
      )}

      {/* ── Cash Out tab ── */}
      {tab === "cashout" && (
        <>
          {/* Rate banner */}
          <View style={s.rateCard}>
            <Text style={s.rateEmoji}>⭐</Text>
            <Text style={s.rateText}>1 point = <Text style={s.rateValue}>${POINT_VALUE.toFixed(2)}</Text></Text>
          </View>

          {/* Pending kid requests */}
          {pendingRequests.length > 0 && (
            <View style={s.requestsSection}>
              <Text style={s.sectionTitle}>📬 Payment Requests</Text>
              {pendingRequests.map(req => (
                <View key={req.id} style={s.requestCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.requestKid}>{req.kidName}</Text>
                    <Text style={s.requestType}>{REQUEST_TYPE_LABELS[req.type]}</Text>
                    {req.pointsAmount != null && (
                      <Text style={s.requestDetail}>⭐ {req.pointsAmount} pts = {pointsToMoney(req.pointsAmount)}</Text>
                    )}
                    {req.allowanceAmount != null && (
                      <Text style={s.requestDetail}>💰 ${req.allowanceAmount.toFixed(2)} allowance</Text>
                    )}
                    {req.message ? <Text style={s.requestMsg}>"{req.message}"</Text> : null}
                    <Text style={s.requestDate}>{fmtDateTime(req.requestedAt)}</Text>
                  </View>
                  <View style={s.requestBtns}>
                    <TouchableOpacity style={s.requestPayBtn} onPress={() => openPayout(req.kidId, req.id)}>
                      <Text style={s.requestPayBtnText}>Pay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.requestDeclineBtn} onPress={() => declineRequest(req.kidId, req.id)}>
                      <Text style={s.requestDeclineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Per-kid cash out cards */}
          <Text style={s.sectionTitle}>Cash Out by Kid</Text>
          {state.kids.map(k => {
            const pts = k.behavior?.totalPoints ?? 0;
            const handle = k.paymentHandle;
            return (
              <View key={k.profile.id} style={s.kidPointCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.kidPointName}>{k.profile.name}</Text>
                  <Text style={s.kidPointBal}>{pts} pts</Text>
                  <Text style={s.kidPointVal}>= {pointsToMoney(pts)}</Text>
                  {/* Payment handles */}
                  <View style={s.handleRow}>
                    {handle?.venmoUsername
                      ? <Text style={s.handleTag}>💙 @{handle.venmoUsername}</Text>
                      : <Text style={s.handleMissing}>💙 No Venmo</Text>}
                    {handle?.cashappTag
                      ? <Text style={s.handleTag}>💚 ${handle.cashappTag}</Text>
                      : <Text style={s.handleMissing}>💚 No Cash App</Text>}
                  </View>
                  <TouchableOpacity style={s.editHandleBtn} onPress={() => openHandleEdit(k.profile.id)}>
                    <Text style={s.editHandleBtnText}>✏️ Edit handles</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[s.cashOutBtn, pts === 0 && s.cashOutBtnDisabled]}
                  onPress={() => openPayout(k.profile.id)}
                  disabled={pts === 0}>
                  <Text style={s.cashOutBtnText}>Cash Out</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <>
          <View style={s.statRow}>
            {[
              { label: "This Week",  data: thisWeek  },
              { label: "This Month", data: thisMonth },
              { label: "This Year",  data: thisYear  },
            ].map(({ label: lbl, data }) => (
              <View key={lbl} style={s.statCard}>
                <Text style={s.statLabel}>{lbl}</Text>
                <Text style={s.statAmount}>${data.amount.toFixed(2)}</Text>
                <Text style={s.statPts}>{data.points} pts</Text>
              </View>
            ))}
          </View>

          {state.kids.map(k => {
            const payouts = (k.pointPayouts ?? []);
            if (payouts.length === 0) return null;
            const kidTotal = payouts.reduce((a, p) => a + p.amount, 0);
            return (
              <View key={k.profile.id} style={s.kidHistSection}>
                <View style={s.kidHistHeader}>
                  <Text style={s.kidHistName}>{k.profile.name}</Text>
                  <Text style={s.kidHistTotal}>Total earned: ${kidTotal.toFixed(2)}</Text>
                </View>
                {payouts.map(p => (
                  <View key={p.id} style={s.histRow}>
                    <Text style={s.histMethodEmoji}>{METHOD_META[p.method]?.emoji ?? "💰"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histDesc}>
                        {METHOD_META[p.method]?.label} · {p.points > 0 ? `${p.points} pts` : "allowance"}
                        {p.note ? ` · "${p.note}"` : ""}
                      </Text>
                      <Text style={s.histMeta}>
                        {fmtDateTime(p.createdAt)}{p.paidBy ? ` · Paid by ${p.paidBy}` : ""}
                      </Text>
                    </View>
                    <Text style={s.histAmount}>${p.amount.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          {allPayouts.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>📋</Text>
              <Text style={s.emptyText}>No payouts yet.{"\n"}Cash out your kid's points to see history here.</Text>
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />

      {/* ── Schedule modal ── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <ScrollView>
              <Text style={s.modalTitle}>New Allowance Schedule</Text>
              <Text style={s.fieldLabel}>Label</Text>
              <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder="e.g. Weekly allowance" />
              <Text style={s.fieldLabel}>Amount ($)</Text>
              <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5.00" />
              <Text style={s.fieldLabel}>Frequency</Text>
              <View style={s.chipRow}>
                {FREQUENCIES.map(f => (
                  <TouchableOpacity key={f.key} style={[s.chip, frequency === f.key && s.chipActive]} onPress={() => setFrequency(f.key)}>
                    <Text style={[s.chipText, frequency === f.key && s.chipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {frequency !== "monthly" ? (
                <>
                  <Text style={s.fieldLabel}>Day of week</Text>
                  <View style={s.chipRow}>
                    {DAYS.map((d, i) => (
                      <TouchableOpacity key={i} style={[s.dayChip, dayOfWeek === i && s.chipActive]} onPress={() => setDayOfWeek(i)}>
                        <Text style={[s.chipText, dayOfWeek === i && s.chipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.fieldLabel}>Day of month (1–28)</Text>
                  <TextInput style={s.input} value={String(dayOfMonth)} onChangeText={v => setDayOfMonth(Math.min(28, Math.max(1, parseInt(v) || 1)))} keyboardType="number-pad" />
                </>
              )}
              <View style={s.modalBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={addSchedule}><Text style={s.saveBtnText}>Create</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Payment handle editor modal ── */}
      <Modal visible={showHandleEdit} animationType="slide" transparent onRequestClose={() => setShowHandleEdit(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Payment Handles</Text>
            <Text style={s.fieldDesc}>Set this kid's Venmo and Cash App usernames so you can pay them directly from Spinini.</Text>

            <Text style={s.fieldLabel}>💙 Venmo Username</Text>
            <TextInput
              style={s.input}
              value={editVenmo}
              onChangeText={setEditVenmo}
              placeholder="@username (no @)"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.fieldLabel}>💚 Cash App $Cashtag</Text>
            <TextInput
              style={s.input}
              value={editCashapp}
              onChangeText={setEditCashapp}
              placeholder="$YourCashtag (no $)"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowHandleEdit(false)}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveHandle}><Text style={s.saveBtnText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Cash Out modal ── */}
      <Modal visible={showPayout} animationType="slide" transparent onRequestClose={() => { setShowPayout(false); setAwaitConfirm(false); }}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <ScrollView>
              {(() => {
                const pk      = state.kids.find(k => k.profile.id === payoutKidId);
                const available = pk?.behavior.totalPoints ?? 0;
                const pts       = parseInt(payoutPoints) || 0;
                const dollarVal = pts * POINT_VALUE;
                const handle    = pk?.paymentHandle;

                if (awaitConfirm) {
                  return (
                    <>
                      <Text style={s.modalTitle}>Confirm Payment</Text>
                      <View style={s.confirmBox}>
                        <Text style={s.confirmEmoji}>{METHOD_META[payoutMethod].emoji}</Text>
                        <Text style={s.confirmText}>
                          Did you complete the ${dollarVal.toFixed(2)} payment to {pk?.profile.name} via {METHOD_META[payoutMethod].label}?
                        </Text>
                      </View>
                      <Text style={s.confirmSub}>
                        Tap "Yes, Paid" to record the payout and deduct {pts} pts from {pk?.profile.name}'s balance.
                      </Text>
                      <View style={s.modalBtns}>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => setAwaitConfirm(false)}>
                          <Text style={s.cancelBtnText}>Not Yet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.saveBtn, { backgroundColor: Colors.success }]} onPress={() => confirmPayout()}>
                          <Text style={s.saveBtnText}>✅ Yes, Paid</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={s.reOpenLinkBtn} onPress={() => openDeepLink(payoutMethod, dollarVal, payoutNote, payoutKidId)}>
                        <Text style={s.reOpenLinkText}>Re-open {METHOD_META[payoutMethod].label} →</Text>
                      </TouchableOpacity>
                    </>
                  );
                }

                return (
                  <>
                    <Text style={s.modalTitle}>Cash Out Points</Text>
                    {pk && (
                      <View style={s.payoutBalRow}>
                        <Text style={s.payoutBalName}>{pk.profile.name}</Text>
                        <Text style={s.payoutBalPts}>{available} pts available ({pointsToMoney(available)})</Text>
                      </View>
                    )}

                    <Text style={s.fieldLabel}>Points to Cash Out</Text>
                    <TextInput
                      style={s.input}
                      value={payoutPoints}
                      onChangeText={v => setPayoutPoints(v.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholder={String(available)}
                    />
                    {pts > 0 && (
                      <Text style={s.exchangeHint}>= ${dollarVal.toFixed(2)} (1 pt = ${POINT_VALUE.toFixed(2)})</Text>
                    )}

                    <Text style={s.fieldLabel}>Payment Method</Text>
                    <View style={s.methodGrid}>
                      {(Object.keys(METHOD_META) as PayoutMethod[]).map(m => {
                        const needsHandle = m === "venmo" || m === "cashapp";
                        const hasHandle   = m === "venmo" ? !!handle?.venmoUsername : m === "cashapp" ? !!handle?.cashappTag : true;
                        return (
                          <TouchableOpacity
                            key={m}
                            style={[s.methodBtn, payoutMethod === m && { backgroundColor: METHOD_META[m].color, borderColor: METHOD_META[m].color }]}
                            onPress={() => setPayoutMethod(m)}
                          >
                            <Text style={s.methodEmoji}>{METHOD_META[m].emoji}</Text>
                            <Text style={[s.methodLabel, payoutMethod === m && { color: "#fff" }]}>{METHOD_META[m].label}</Text>
                            {needsHandle && !hasHandle && (
                              <Text style={[s.methodWarn, payoutMethod === m && { color: "#ffe" }]}>⚠️ No handle</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={s.fieldLabel}>Note (optional)</Text>
                    <TextInput style={s.input} value={payoutNote} onChangeText={setPayoutNote} placeholder='e.g. "Great week! 🎉"' />

                    <Text style={s.fieldLabel}>Paid By</Text>
                    <View style={s.paidByBadge}>
                      <Text style={s.paidByText}>👤 {state.parent.name}</Text>
                    </View>

                    <View style={s.modalBtns}>
                      <TouchableOpacity style={s.cancelBtn} onPress={() => setShowPayout(false)}>
                        <Text style={s.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      {(payoutMethod === "venmo" || payoutMethod === "cashapp") ? (
                        <TouchableOpacity
                          style={[s.saveBtn, pts <= 0 && { opacity: 0.4 }]}
                          onPress={() => openDeepLink(payoutMethod, dollarVal, payoutNote, payoutKidId)}
                          disabled={pts <= 0}
                        >
                          <Text style={s.saveBtnText}>
                            Open {METHOD_META[payoutMethod].label} ${dollarVal.toFixed(2)} →
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[s.saveBtn, pts <= 0 && { opacity: 0.4 }]}
                          onPress={() => confirmPayout()}
                          disabled={pts <= 0}
                        >
                          <Text style={s.saveBtnText}>Record ${dollarVal.toFixed(2)} Payout</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  title:       { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  sub:         { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  empty:       { textAlign: "center", color: Colors.textMuted, marginTop: 40 },
  rowBetween:  { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm, gap: 10 },
  sectionTitle:{ fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: 4 },

  // Tabs
  tabRow:         { flexDirection: "row", gap: 6, marginBottom: Spacing.md },
  tab:            { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 },
  tabActive:      { backgroundColor: Colors.primary },
  tabText:        { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  tabTextActive:  { color: "#fff" },
  tabBadge:       { backgroundColor: Colors.error, borderRadius: Radius.full, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  tabBadgeText:   { color: "#fff", fontSize: 9, fontWeight: "800" },

  // Kid chips
  kidChip:          { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  kidChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipText:      { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive:{ color: "#fff" },

  // Schedule cards
  addBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText:   { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  card:         { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  cardTop:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  cardLabel:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardAmount:   { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginTop: 2 },
  cardLast:     { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  cardActions:  { flexDirection: "row", gap: 10 },
  payBtn:       { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  payBtnText:   { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  deleteBtn:    { borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, paddingHorizontal: 16 },
  deleteBtnText:{ color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  infoCard:     { backgroundColor: "#EFF6FF", borderRadius: Radius.xl, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: "#BFDBFE" },
  infoTitle:    { fontSize: FontSize.sm, fontWeight: "700", color: "#1D4ED8", marginBottom: 4 },
  infoText:     { fontSize: FontSize.xs, color: "#1E40AF", lineHeight: 18 },

  // Empty
  emptyCard:  { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText:  { color: Colors.textMuted, textAlign: "center", fontSize: FontSize.base, lineHeight: 24 },

  // Payment requests section
  requestsSection: { backgroundColor: Colors.warning + "15", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + "40" },
  requestCard:     { flexDirection: "row", alignItems: "flex-start", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.warning + "30", gap: 10 },
  requestKid:      { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  requestType:     { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginTop: 2 },
  requestDetail:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  requestMsg:      { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: "italic", marginTop: 2 },
  requestDate:     { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  requestBtns:     { gap: 6, alignItems: "flex-end" },
  requestPayBtn:   { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  requestPayBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  requestDeclineBtn: { borderWidth: 1.5, borderColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  requestDeclineBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.xs },

  // Cash Out tab
  rateCard:    { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.secondary + "25", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md },
  rateEmoji:   { fontSize: 28 },
  rateText:    { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  rateValue:   { color: Colors.success, fontWeight: "800" },
  kidPointCard:{ backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  kidPointName:{ fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  kidPointBal: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginTop: 2 },
  kidPointVal: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700" },
  handleRow:   { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  handleTag:   { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary, backgroundColor: Colors.cardLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  handleMissing: { fontSize: FontSize.xs, color: Colors.textMuted, backgroundColor: Colors.border + "40", paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  editHandleBtn: { marginTop: 6, alignSelf: "flex-start" },
  editHandleBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700" },
  cashOutBtn:  { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start", marginTop: 4 },
  cashOutBtnDisabled: { opacity: 0.35 },
  cashOutBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  // History
  statRow:    { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  statCard:   { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.sm, alignItems: "center", ...Shadow.sm },
  statLabel:  { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center", marginBottom: 4 },
  statAmount: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  statPts:    { fontSize: FontSize.xs, color: Colors.textMuted },
  kidHistSection: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 12, ...Shadow.sm },
  kidHistHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  kidHistName:    { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  kidHistTotal:   { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },
  histRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + "60" },
  histMethodEmoji:{ fontSize: 22 },
  histDesc:       { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },
  histMeta:       { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  histAmount:     { fontSize: FontSize.base, fontWeight: "800", color: Colors.success },

  // Payout modal
  payoutBalRow:  { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  payoutBalName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  payoutBalPts:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  exchangeHint:  { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700", marginBottom: Spacing.sm, marginLeft: 2 },
  methodGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.sm },
  methodBtn:     { width: "30%", minWidth: 80, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 10, alignItems: "center", gap: 3 },
  methodEmoji:   { fontSize: 20 },
  methodLabel:   { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  methodWarn:    { fontSize: 9, color: Colors.warning, textAlign: "center" },
  paidByBadge:   { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.sm },
  paidByText:    { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  confirmBox:    { flexDirection: "row", gap: 12, backgroundColor: Colors.success + "15", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, alignItems: "center" },
  confirmEmoji:  { fontSize: 36 },
  confirmText:   { flex: 1, fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, lineHeight: 22 },
  confirmSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  reOpenLinkBtn: { alignItems: "center", marginTop: Spacing.sm, paddingVertical: Spacing.sm },
  reOpenLinkText:{ fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700" },
  fieldDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },

  // Modal shared
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal:         { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "90%" },
  modalTitle:    { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  fieldLabel:    { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", marginBottom: 6, marginTop: 10 },
  input:         { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginBottom: 4 },
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip:          { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  dayChip:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  chipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:      { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive:{ color: "#fff" },
  modalBtns:     { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn:     { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn:       { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  saveBtnText:   { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
