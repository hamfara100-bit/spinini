import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Switch, Alert, Animated, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso, today as todayIso, pointsToMoney, POINT_VALUE } from "../../../../lib/utils";
import type { EarnScheduleEntry, MoneyTransaction, SavingsGoal, PaymentRequest, PaymentRequestType } from "../../../../lib/data/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS  = ["S", "M", "T", "W", "T", "F", "S"];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function todayDow() { return new Date().getDay(); }

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function weeklyFromSchedules(schedules: EarnScheduleEntry[]): number {
  return schedules
    .filter(s => s.active)
    .reduce((sum, s) => sum + s.amount * s.days.length, 0);
}

type Tab = "overview" | "schedule" | "goals" | "history";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MoneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [tab, setTab] = useState<Tab>("overview");

  // Apply any due auto-earn schedules on mount
  useEffect(() => {
    if (!kid) return;
    const today = todayStr();
    const dow   = todayDow();
    (kid.money.earnSchedules ?? []).forEach(s => {
      if (!s.active) return;
      if (s.lastAppliedDate === today) return;
      if (!s.days.includes(dow)) return;
      dispatch({
        type: "MONEY_APPLY_AUTO_EARN",
        kidId: id,
        scheduleId: s.id,
        date: today,
        tx: {
          id: uid(),
          amount: s.amount,
          type: "auto-earn",
          description: `⚡ Auto: ${s.label}`,
          date: today,
          scheduleId: s.id,
        },
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!kid) return null;
  const { money } = kid;
  const schedules = money.earnSchedules ?? [];

  // Projection math
  const weeklyEarn  = weeklyFromSchedules(schedules);
  const monthlyEarn = weeklyEarn * 4.33;
  const yearlyEarn  = weeklyEarn * 52;

  // "What could have been" math
  const totalEarned = money.transactions
    .filter(t => t.type === "earn" || t.type === "auto-earn")
    .reduce((s, t) => s + t.amount, 0);
  const totalSpent = money.transactions
    .filter(t => t.type === "spend")
    .reduce((s, t) => s + t.amount, 0);
  const couldHave = money.balance + totalSpent;

  const [showPayReq, setShowPayReq]       = useState(false);
  const [reqType, setReqType]             = useState<PaymentRequestType>("points");
  const [reqPointsAmt, setReqPointsAmt]   = useState("");
  const [reqAllowAmt, setReqAllowAmt]     = useState("");
  const [reqMessage, setReqMessage]       = useState("");

  const pendingReqs = (kid.paymentRequests ?? []).filter(r => r.status === "pending");

  function submitPaymentRequest() {
    if (reqType === "points" && !reqPointsAmt.trim()) { return; }
    if (reqType === "allowance" && !reqAllowAmt.trim()) { return; }
    const request: PaymentRequest = {
      id: uid(),
      type: reqType,
      pointsAmount:    reqType !== "allowance"  ? (parseInt(reqPointsAmt) || undefined) : undefined,
      allowanceAmount: reqType !== "points"      ? (parseFloat(reqAllowAmt) || undefined) : undefined,
      message: reqMessage.trim() || undefined,
      status: "pending",
      requestedAt: nowIso(),
    };
    dispatch({ type: "PAYMENT_REQUEST_ADD", kidId: id, request });
    setShowPayReq(false);
    setReqMessage(""); setReqPointsAmt(""); setReqAllowAmt("");
  }

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview",  label: "Overview",  emoji: "🐷" },
    { id: "schedule",  label: "Schedule",  emoji: "📅" },
    { id: "goals",     label: "Goals",     emoji: "🎯" },
    { id: "history",   label: "History",   emoji: "📋" },
  ];

  return (
    <View style={styles.root}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === "overview" && (
          <OverviewTab
            money={money}
            weeklyEarn={weeklyEarn}
            monthlyEarn={monthlyEarn}
            yearlyEarn={yearlyEarn}
            totalSpent={totalSpent}
            couldHave={couldHave}
            kidId={id}
            dispatch={dispatch}
            onGoToSchedule={() => setTab("schedule")}
            totalPoints={kid.behavior?.totalPoints ?? 0}
          />
        )}
        {tab === "schedule" && (
          <ScheduleTab kidId={id} schedules={schedules} dispatch={dispatch} />
        )}
        {tab === "goals" && (
          <GoalsTab kidId={id} goals={money.goals} balance={money.balance} dispatch={dispatch} />
        )}
        {tab === "history" && (
          <HistoryTab transactions={money.transactions} kidId={id} dispatch={dispatch} />
        )}
      </ScrollView>

      {/* Request Payment button */}
      <View style={styles.requestPayRow}>
        {pendingReqs.length > 0 && (
          <View style={styles.pendingReqPill}>
            <Text style={styles.pendingReqText}>⏳ {pendingReqs.length} request{pendingReqs.length > 1 ? "s" : ""} pending</Text>
          </View>
        )}
        <TouchableOpacity style={styles.requestPayBtn} onPress={() => setShowPayReq(true)}>
          <Text style={styles.requestPayBtnText}>💸 Request Payment</Text>
        </TouchableOpacity>
      </View>

      {/* Payment Request Modal */}
      <Modal visible={showPayReq} animationType="slide" transparent onRequestClose={() => setShowPayReq(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitle}>💸 Request Payment</Text>

              <Text style={styles.modalLabel}>What do you want paid?</Text>
              <View style={styles.reqTypeRow}>
                {(["points","allowance","both"] as PaymentRequestType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.reqTypeBtn, reqType === t && styles.reqTypeBtnActive]}
                    onPress={() => setReqType(t)}
                  >
                    <Text style={[styles.reqTypeBtnText, reqType === t && styles.reqTypeBtnTextActive]}>
                      {t === "points" ? "⭐ Points" : t === "allowance" ? "💰 Allowance" : "⭐💰 Both"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {reqType !== "allowance" && (
                <>
                  <Text style={styles.modalLabel}>Points to cash out</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={reqPointsAmt}
                    onChangeText={v => setReqPointsAmt(v.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    placeholder={`${kid.behavior?.totalPoints ?? 0} pts available`}
                  />
                  {!!reqPointsAmt && parseInt(reqPointsAmt) > 0 && (
                    <Text style={styles.modalExchange}>= {pointsToMoney(parseInt(reqPointsAmt))} (1 pt = ${POINT_VALUE.toFixed(2)})</Text>
                  )}
                </>
              )}

              {reqType !== "points" && (
                <>
                  <Text style={styles.modalLabel}>Allowance amount ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={reqAllowAmt}
                    onChangeText={v => setReqAllowAmt(v.replace(/[^0-9.]/g, ""))}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 5.00"
                  />
                </>
              )}

              <Text style={styles.modalLabel}>Message (optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 70, textAlignVertical: "top" }]}
                value={reqMessage}
                onChangeText={setReqMessage}
                placeholder='e.g. "Can I get my allowance? 🙏"'
                multiline
              />

              <View style={styles.modalBtnsRow}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPayReq(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSendBtn} onPress={submitPaymentRequest}>
                  <Text style={styles.modalSendText}>Send Request 📬</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  money, weeklyEarn, monthlyEarn, yearlyEarn,
  totalSpent, couldHave, kidId, dispatch, onGoToSchedule, totalPoints,
}: any) {
  const hasSchedules = weeklyEarn > 0;

  return (
    <>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balancePig}>🐷</Text>
        <Text style={styles.balanceAmt}>{fmt(money.balance)}</Text>
        <Text style={styles.balanceSub}>My Piggy Bank</Text>
        {totalSpent > 0 && (
          <View style={styles.spentPill}>
            <Text style={styles.spentPillText}>Spent so far: {fmt(totalSpent)}</Text>
          </View>
        )}
      </View>

      {/* Points exchange card */}
      {totalPoints > 0 && (
        <View style={styles.pointsExCard}>
          <Text style={styles.pointsExStar}>⭐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsExTitle}>{totalPoints} Behavior Points</Text>
            <Text style={styles.pointsExVal}>= {pointsToMoney(totalPoints)} (1 pt = ${POINT_VALUE.toFixed(2)})</Text>
          </View>
        </View>
      )}

      {/* Auto-earn projections */}
      {hasSchedules ? (
        <View style={styles.projCard}>
          <View style={styles.projHeader}>
            <Text style={styles.projTitle}>📈 Savings Projections</Text>
            <Text style={styles.projSub}>Based on your earn schedule</Text>
          </View>
          <View style={styles.projRow}>
            <ProjCell label="This Week" value={fmt(weeklyEarn)} accent={Colors.success} />
            <ProjCell label="This Month" value={fmt(monthlyEarn)} accent={Colors.primary} />
            <ProjCell label="This Year" value={fmt(yearlyEarn)} accent="#F59E0B" />
          </View>
          <View style={styles.projOnTrack}>
            <Text style={styles.projOnTrackText}>
              🔥 Keep it up! Earn {fmt(weeklyEarn)}/week and you'll have{" "}
              <Text style={{ fontWeight: "900", color: Colors.primary }}>{fmt(money.balance + yearlyEarn)}</Text>{" "}
              in a year!
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.noScheduleCard} onPress={onGoToSchedule} activeOpacity={0.85}>
          <Text style={{ fontSize: 36 }}>📅</Text>
          <Text style={styles.noScheduleTitle}>Set Up Auto-Earn!</Text>
          <Text style={styles.noScheduleSub}>Add a schedule and see how your money grows week by week, month by month, year by year!</Text>
          <View style={styles.noScheduleBtn}>
            <Text style={styles.noScheduleBtnText}>+ Add Earn Schedule →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* What could have been */}
      {totalSpent > 0 && (
        <View style={styles.wchbCard}>
          <Text style={styles.wchbTitle}>💭 What Could Have Been...</Text>
          <Text style={styles.wchbSub}>If you hadn't spent any money</Text>

          <View style={styles.wchbRow}>
            <View style={styles.wchbCol}>
              <Text style={styles.wchbColLabel}>You Have Now</Text>
              <Text style={[styles.wchbColAmt, { color: Colors.success }]}>{fmt(money.balance)}</Text>
            </View>
            <Text style={styles.wchbArrow}>→</Text>
            <View style={styles.wchbCol}>
              <Text style={styles.wchbColLabel}>Could Have Had</Text>
              <Text style={[styles.wchbColAmt, { color: Colors.primary }]}>{fmt(couldHave)}</Text>
            </View>
          </View>

          {/* Visual bar */}
          <View style={styles.wchbBarBg}>
            <View style={[styles.wchbBarSave, { flex: money.balance }]} />
            <View style={[styles.wchbBarSpent, { flex: totalSpent }]} />
          </View>
          <View style={styles.wchbLegend}>
            <View style={styles.wchbLegendDot} />
            <Text style={styles.wchbLegendText}>Saved: {fmt(money.balance)}</Text>
            <View style={[styles.wchbLegendDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.wchbLegendText}>Spent: {fmt(totalSpent)}</Text>
          </View>

          <Text style={styles.wchbTip}>
            💡 Next time you want to spend, think:{" "}
            <Text style={{ fontWeight: "800", color: Colors.primary }}>
              "Will future me be happy about this?"
            </Text>
          </Text>
        </View>
      )}

      {/* If schedules exist, show next scheduled day */}
      {hasSchedules && <NextEarnCard schedules={money.earnSchedules ?? []} />}

      {/* Quick add transaction */}
      <QuickTransact kidId={kidId} dispatch={dispatch} />
    </>
  );
}

function ProjCell({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.projCell}>
      <Text style={[styles.projCellAmt, { color: accent }]}>{value}</Text>
      <Text style={styles.projCellLabel}>{label}</Text>
    </View>
  );
}

function NextEarnCard({ schedules }: { schedules: EarnScheduleEntry[] }) {
  const active = schedules.filter(s => s.active);
  if (!active.length) return null;

  const today = todayDow();
  // Find next upcoming day across all active schedules
  type Hit = { daysAway: number; dow: number; schedules: EarnScheduleEntry[]; totalAmt: number };
  const hits: Record<number, Hit> = {};

  active.forEach(s => {
    s.days.forEach(d => {
      let away = d - today;
      if (away < 0) away += 7;
      if (away === 0) away = 0; // today
      if (!hits[d]) hits[d] = { daysAway: away, dow: d, schedules: [], totalAmt: 0 };
      hits[d].schedules.push(s);
      hits[d].totalAmt += s.amount;
    });
  });

  const sorted = Object.values(hits).sort((a, b) => a.daysAway - b.daysAway);
  const next = sorted[0];
  if (!next) return null;

  const label = next.daysAway === 0 ? "Today!" : next.daysAway === 1 ? "Tomorrow" : `In ${next.daysAway} days (${DAY_NAMES[next.dow]})`;

  return (
    <View style={styles.nextEarnCard}>
      <Text style={styles.nextEarnEmoji}>⚡</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.nextEarnTitle}>Next Auto-Earn: {label}</Text>
        <Text style={styles.nextEarnSub}>
          {next.schedules.map(s => s.label).join(", ")} — {fmt(next.totalAmt)}
        </Text>
      </View>
      <Text style={styles.nextEarnAmt}>{fmt(next.totalAmt)}</Text>
    </View>
  );
}

function QuickTransact({ kidId, dispatch }: { kidId: string; dispatch: any }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"earn" | "spend">("earn");

  function submit() {
    const n = parseFloat(amount);
    if (!n || n <= 0 || !desc.trim()) return;
    dispatch({
      type: "MONEY_TRANSACT",
      kidId,
      tx: {
        id: uid(), amount: n, type,
        description: desc.trim(), date: todayStr(),
      },
    });
    setAmount("");
    setDesc("");
  }

  return (
    <View style={styles.quickCard}>
      <Text style={styles.quickTitle}>+ Add Transaction</Text>
      <View style={styles.quickTypeRow}>
        {(["earn", "spend"] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.quickTypeBtn, type === t && (t === "earn" ? styles.quickTypeBtnEarn : styles.quickTypeBtnSpend)]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.quickTypeBtnText, type === t && { color: "#fff" }]}>
              {t === "earn" ? "💰 Earned" : "💸 Spent"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.quickInput}
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount ($)"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
      />
      <TextInput
        style={styles.quickInput}
        value={desc}
        onChangeText={setDesc}
        placeholder="What for?"
        placeholderTextColor={Colors.textMuted}
      />
      <TouchableOpacity
        style={[styles.quickBtn, (!amount || !desc.trim()) && { opacity: 0.5 }]}
        onPress={submit}
        disabled={!amount || !desc.trim()}
      >
        <Text style={styles.quickBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ kidId, schedules, dispatch }: { kidId: string; schedules: EarnScheduleEntry[]; dispatch: any }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      {/* What-if projector */}
      <View style={styles.schedProjectorCard}>
        <Text style={styles.schedProjectorTitle}>💡 How Your Money Grows</Text>
        <ProjectionPreview schedules={schedules} />
      </View>

      {/* Schedule list */}
      {schedules.length === 0 && !adding && (
        <View style={styles.emptySchedule}>
          <Text style={{ fontSize: 52 }}>📅</Text>
          <Text style={styles.emptyScheduleTitle}>No Earn Schedules Yet</Text>
          <Text style={styles.emptyScheduleSub}>
            Set up recurring earnings — like getting paid $10 every Monday for taking out the trash!
          </Text>
        </View>
      )}

      {schedules.map(s => (
        <ScheduleCard key={s.id} schedule={s} kidId={kidId} dispatch={dispatch} />
      ))}

      {adding ? (
        <AddScheduleForm
          kidId={kidId}
          dispatch={dispatch}
          onDone={() => setAdding(false)}
        />
      ) : (
        <TouchableOpacity style={styles.addScheduleBtn} onPress={() => setAdding(true)} activeOpacity={0.85}>
          <Text style={styles.addScheduleBtnText}>+ Add Earn Schedule</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

function ProjectionPreview({ schedules }: { schedules: EarnScheduleEntry[] }) {
  const weekly  = weeklyFromSchedules(schedules);
  const monthly = weekly * 4.33;
  const yearly  = weekly * 52;

  if (weekly === 0) {
    return (
      <Text style={styles.projPreviewEmpty}>
        Add a schedule below to see how your money grows!
      </Text>
    );
  }

  return (
    <View style={styles.projPreviewGrid}>
      {[
        { label: "Per Week", value: fmt(weekly), emoji: "📆", color: Colors.success },
        { label: "Per Month", value: fmt(monthly), emoji: "🗓️", color: Colors.primary },
        { label: "Per Year", value: fmt(yearly), emoji: "🏆", color: "#F59E0B" },
        { label: "5 Years", value: fmt(yearly * 5), emoji: "🚀", color: "#EC4899" },
      ].map(item => (
        <View key={item.label} style={styles.projPreviewCell}>
          <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
          <Text style={[styles.projPreviewAmt, { color: item.color }]}>{item.value}</Text>
          <Text style={styles.projPreviewLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ScheduleCard({ schedule, kidId, dispatch }: { schedule: EarnScheduleEntry; kidId: string; dispatch: any }) {
  const weeklyThis = schedule.active ? schedule.amount * schedule.days.length : 0;

  function toggleActive() {
    dispatch({
      type: "MONEY_UPDATE_SCHEDULE",
      kidId,
      scheduleId: schedule.id,
      payload: { active: !schedule.active },
    });
  }

  function remove() {
    Alert.alert("Remove Schedule", `Remove "${schedule.label}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "MONEY_REMOVE_SCHEDULE", kidId, scheduleId: schedule.id }) },
    ]);
  }

  return (
    <View style={[styles.schedCard, !schedule.active && styles.schedCardInactive]}>
      <View style={styles.schedCardHeader}>
        <View style={styles.schedCardLeft}>
          <Text style={styles.schedCardLabel}>{schedule.label}</Text>
          <Text style={styles.schedCardAmt}>
            {fmt(schedule.amount)} per day • {fmt(schedule.amount * schedule.days.length)}/week
          </Text>
        </View>
        <Switch
          value={schedule.active}
          onValueChange={toggleActive}
          trackColor={{ false: Colors.border, true: Colors.primary + "88" }}
          thumbColor={schedule.active ? Colors.primary : Colors.textMuted}
        />
      </View>

      {/* Day badges */}
      <View style={styles.dayBadgeRow}>
        {DAY_LABELS.map((d, i) => (
          <View
            key={i}
            style={[
              styles.dayBadge,
              schedule.days.includes(i) && (schedule.active ? styles.dayBadgeActive : styles.dayBadgeActiveOff),
            ]}
          >
            <Text style={[styles.dayBadgeText, schedule.days.includes(i) && { color: "#fff" }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Projection for this schedule */}
      {schedule.active && (
        <View style={styles.schedMiniProj}>
          <Text style={styles.schedMiniProjText}>
            📈 Monthly: <Text style={{ color: Colors.primary, fontWeight: "800" }}>{fmt(weeklyThis * 4.33)}</Text>
            {"  "}
            Yearly: <Text style={{ color: "#F59E0B", fontWeight: "800" }}>{fmt(weeklyThis * 52)}</Text>
          </Text>
        </View>
      )}

      {schedule.lastAppliedDate && (
        <Text style={styles.schedLastApplied}>✅ Last earned: {schedule.lastAppliedDate}</Text>
      )}

      <TouchableOpacity onPress={remove} style={styles.schedRemoveBtn}>
        <Text style={styles.schedRemoveBtnText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddScheduleForm({ kidId, dispatch, onDone }: { kidId: string; dispatch: any; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState<number[]>([]);

  const previewWeekly = days.length > 0 && parseFloat(amount) > 0
    ? parseFloat(amount) * days.length
    : 0;

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function save() {
    const n = parseFloat(amount);
    if (!label.trim() || !n || n <= 0 || days.length === 0) {
      Alert.alert("Fill in all fields", "Enter a job name, amount, and at least one day.");
      return;
    }
    dispatch({
      type: "MONEY_ADD_SCHEDULE",
      kidId,
      schedule: {
        id: uid(),
        label: label.trim(),
        amount: n,
        days: [...days].sort(),
        active: true,
        createdAt: nowIso(),
      } as EarnScheduleEntry,
    });
    onDone();
  }

  return (
    <View style={styles.addForm}>
      <Text style={styles.addFormTitle}>📅 New Earn Schedule</Text>

      <Text style={styles.addFormLabel}>Job / Task Name</Text>
      <TextInput
        style={styles.addFormInput}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Wash dishes, Take out trash…"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.addFormLabel}>Amount Earned Each Time ($)</Text>
      <TextInput
        style={styles.addFormInput}
        value={amount}
        onChangeText={setAmount}
        placeholder="e.g. 5.00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="decimal-pad"
      />

      <Text style={styles.addFormLabel}>Which Days?</Text>
      <View style={styles.addFormDays}>
        {DAY_NAMES.map((name, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.addFormDay, days.includes(i) && styles.addFormDayActive]}
            onPress={() => toggleDay(i)}
          >
            <Text style={[styles.addFormDayText, days.includes(i) && { color: "#fff" }]}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Live preview */}
      {previewWeekly > 0 && (
        <View style={styles.addFormPreview}>
          <Text style={styles.addFormPreviewTitle}>📊 If you stick to this schedule:</Text>
          <View style={styles.addFormPreviewGrid}>
            {[
              { l: "Per Week",  v: fmt(previewWeekly) },
              { l: "Per Month", v: fmt(previewWeekly * 4.33) },
              { l: "Per Year",  v: fmt(previewWeekly * 52) },
              { l: "5 Years",   v: fmt(previewWeekly * 52 * 5) },
            ].map(({ l, v }) => (
              <View key={l} style={styles.addFormPreviewCell}>
                <Text style={styles.addFormPreviewAmt}>{v}</Text>
                <Text style={styles.addFormPreviewLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.addFormBtns}>
        <TouchableOpacity style={styles.addFormCancel} onPress={onDone}>
          <Text style={styles.addFormCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addFormSave, (!label.trim() || !amount || days.length === 0) && { opacity: 0.5 }]}
          onPress={save}
          disabled={!label.trim() || !amount || days.length === 0}
        >
          <Text style={styles.addFormSaveText}>💾 Save Schedule</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab({ kidId, goals, balance, dispatch }: { kidId: string; goals: SavingsGoal[]; balance: number; dispatch: any }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState("🎯");

  const GOAL_EMOJIS = ["🎯","🚀","🎮","🏄","🐕","🎸","✈️","🏆","🎁","💻","📱","🎨","🦋","🌈","❤️"];

  function saveGoal() {
    const n = parseFloat(target);
    if (!label.trim() || !n || n <= 0) return;
    dispatch({
      type: "MONEY_ADD_GOAL",
      kidId,
      goal: { id: uid(), label: label.trim(), targetAmount: n, currentAmount: 0, emoji },
    });
    setLabel(""); setTarget(""); setEmoji("🎯"); setAdding(false);
  }

  function contribute(goal: SavingsGoal) {
    const maxContribute = Math.min(balance, goal.targetAmount - goal.currentAmount);
    if (maxContribute <= 0) { Alert.alert("Goal complete! 🎉"); return; }
    Alert.prompt(
      "Add to Goal",
      `How much to add? (Max ${fmt(maxContribute)})`,
      (val) => {
        const n = parseFloat(val ?? "0");
        if (!n || n <= 0 || n > maxContribute) return;
        dispatch({ type: "MONEY_UPDATE_GOAL", kidId, goalId: goal.id, payload: { currentAmount: goal.currentAmount + n } });
        dispatch({
          type: "MONEY_TRANSACT", kidId,
          tx: { id: uid(), amount: n, type: "save", description: `💰 Saved for: ${goal.label}`, date: todayStr() },
        });
      },
      "plain-text",
    );
  }

  return (
    <>
      {goals.length === 0 && !adding && (
        <View style={styles.emptyGoals}>
          <Text style={{ fontSize: 52 }}>🎯</Text>
          <Text style={styles.emptyGoalsTitle}>No Goals Yet!</Text>
          <Text style={styles.emptyGoalsSub}>What are you saving up for? Add a goal and watch your progress!</Text>
        </View>
      )}

      {goals.map(g => {
        const pct = Math.min(1, g.currentAmount / g.targetAmount);
        const remaining = g.targetAmount - g.currentAmount;
        return (
          <View key={g.id} style={styles.goalCard}>
            <View style={styles.goalCardHeader}>
              <Text style={{ fontSize: 32 }}>{g.emoji ?? "🎯"}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.goalCardLabel}>{g.label}</Text>
                <Text style={styles.goalCardAmt}>{fmt(g.currentAmount)} / {fmt(g.targetAmount)}</Text>
              </View>
              <Text style={styles.goalCardPct}>{Math.round(pct * 100)}%</Text>
            </View>
            <View style={styles.goalBar}>
              <Animated.View style={[styles.goalBarFill, { width: `${pct * 100}%` as any }]} />
            </View>
            {pct < 1 ? (
              <View style={styles.goalCardFooter}>
                <Text style={styles.goalRemaining}>{fmt(remaining)} to go</Text>
                <TouchableOpacity style={styles.goalContributeBtn} onPress={() => contribute(g)}>
                  <Text style={styles.goalContributeBtnText}>+ Add</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dispatch({ type: "MONEY_REMOVE_GOAL", kidId, goalId: g.id })}>
                  <Text style={styles.goalRemoveBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.goalComplete}>
                <Text style={styles.goalCompleteText}>🎉 Goal Reached!</Text>
              </View>
            )}
          </View>
        );
      })}

      {adding ? (
        <View style={styles.addGoalForm}>
          <Text style={styles.addFormTitle}>🎯 New Savings Goal</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {GOAL_EMOJIS.map(e => (
              <TouchableOpacity key={e} style={[styles.emojiOption, emoji === e && styles.emojiOptionActive]} onPress={() => setEmoji(e)}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={styles.addFormInput} value={label} onChangeText={setLabel} placeholder="Goal name (e.g. New bike)" placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.addFormInput} value={target} onChangeText={setTarget} placeholder="Target amount ($)" placeholderTextColor={Colors.textMuted} keyboardType="decimal-pad" />
          <View style={styles.addFormBtns}>
            <TouchableOpacity style={styles.addFormCancel} onPress={() => setAdding(false)}><Text style={styles.addFormCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.addFormSave, (!label || !target) && { opacity: 0.5 }]} onPress={saveGoal} disabled={!label || !target}><Text style={styles.addFormSaveText}>Save Goal</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addScheduleBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addScheduleBtnText}>+ Add Savings Goal</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ transactions, kidId, dispatch }: { transactions: MoneyTransaction[]; kidId: string; dispatch: any }) {
  const [filter, setFilter] = useState<"all" | "earn" | "spend">("all");

  const filtered = transactions.filter(t =>
    filter === "all" ? true :
    filter === "earn" ? (t.type === "earn" || t.type === "auto-earn" || t.type === "save") :
    t.type === "spend"
  );

  const totalEarn = transactions.filter(t => t.type === "earn" || t.type === "auto-earn").reduce((s, t) => s + t.amount, 0);
  const totalSpend = transactions.filter(t => t.type === "spend").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      {/* Summary row */}
      <View style={styles.historySummary}>
        <View style={[styles.historySummaryCell, { borderRightWidth: 1, borderColor: Colors.border }]}>
          <Text style={styles.historySumLabel}>Total Earned</Text>
          <Text style={[styles.historySumAmt, { color: Colors.success }]}>{fmt(totalEarn)}</Text>
        </View>
        <View style={styles.historySummaryCell}>
          <Text style={styles.historySumLabel}>Total Spent</Text>
          <Text style={[styles.historySumAmt, { color: Colors.error }]}>{fmt(totalSpend)}</Text>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(["all", "earn", "spend"] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterPill, filter === f && styles.filterPillActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterPillText, filter === f && { color: "#fff" }]}>
              {f === "all" ? "All" : f === "earn" ? "💰 Earned" : "💸 Spent"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.historyEmpty}>No transactions yet.</Text>
      ) : (
        filtered.map(t => {
          const isEarn = t.type !== "spend";
          return (
            <View key={t.id} style={styles.txRow}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {t.type === "auto-earn" ? "⚡" : isEarn ? "💰" : "💸"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{t.description}</Text>
                <Text style={styles.txDate}>{t.date}</Text>
              </View>
              <Text style={[styles.txAmt, { color: isEarn ? Colors.success : Colors.error }]}>
                {isEarn ? "+" : "-"}{fmt(t.amount)}
              </Text>
            </View>
          );
        })
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },

  tabBar: { flexDirection: "row", gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontSize: 9, fontWeight: "600", color: Colors.textSecondary, marginTop: 1 },
  tabLabelActive: { color: "#fff" },

  // Balance
  balanceCard: {
    backgroundColor: Colors.secondary + "25", borderRadius: Radius.xl,
    alignItems: "center", padding: Spacing.xl, marginBottom: Spacing.md, ...Shadow.md,
  },
  balancePig: { fontSize: 72 },
  balanceAmt: { fontSize: 48, fontWeight: "900", color: Colors.textPrimary, marginTop: 4 },
  balanceSub: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600" },
  spentPill: { marginTop: 8, backgroundColor: Colors.error + "22", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 4 },
  pointsExCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.warning + "20", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + "40" },
  pointsExStar: { fontSize: 32 },
  pointsExTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  pointsExVal:   { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700", marginTop: 2 },

  // Payment request UI
  requestPayRow:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  requestPayBtn:    { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 12 },
  requestPayBtnText:{ color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  pendingReqPill:   { backgroundColor: Colors.warning + "25", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  pendingReqText:   { fontSize: FontSize.xs, fontWeight: "700", color: Colors.warning },
  overlay:          { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal:            { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: "90%" },
  modalTitle:       { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  modalLabel:       { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", marginBottom: 6, marginTop: 10 },
  modalInput:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginBottom: 4 },
  modalExchange:    { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700", marginBottom: 6, marginLeft: 2 },
  reqTypeRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  reqTypeBtn:       { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 9 },
  reqTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reqTypeBtnText:   { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  reqTypeBtnTextActive: { color: "#fff" },
  modalBtnsRow:     { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  modalCancelBtn:   { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  modalCancelText:  { fontWeight: "700", color: Colors.textSecondary },
  modalSendBtn:     { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  modalSendText:    { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  spentPillText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: "700" },

  // Projections
  projCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md, borderWidth: 1.5, borderColor: Colors.primary + "22" },
  projHeader: { marginBottom: Spacing.sm },
  projTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  projSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  projRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.sm },
  projCell: { alignItems: "center" },
  projCellAmt: { fontSize: FontSize.lg, fontWeight: "900" },
  projCellLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  projOnTrack: { backgroundColor: Colors.primary + "10", borderRadius: Radius.md, padding: Spacing.sm },
  projOnTrackText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  // No schedule nudge
  noScheduleCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: Colors.primary + "33", borderStyle: "dashed" },
  noScheduleTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  noScheduleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 18 },
  noScheduleBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  noScheduleBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  // What could have been
  wchbCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  wchbTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 2 },
  wchbSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  wchbRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  wchbArrow: { fontSize: 22, color: Colors.textMuted },
  wchbCol: { alignItems: "center", flex: 1 },
  wchbColLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  wchbColAmt: { fontSize: FontSize.xl, fontWeight: "900", marginTop: 2 },
  wchbBarBg: { height: 12, borderRadius: 6, overflow: "hidden", flexDirection: "row", backgroundColor: Colors.border, marginBottom: 6 },
  wchbBarSave: { backgroundColor: Colors.success },
  wchbBarSpent: { backgroundColor: Colors.error + "BB" },
  wchbLegend: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
  wchbLegendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  wchbLegendText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  wchbTip: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, backgroundColor: Colors.primary + "08", borderRadius: Radius.md, padding: Spacing.sm },

  // Next earn
  nextEarnCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.success + "18", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success + "44" },
  nextEarnEmoji: { fontSize: 28 },
  nextEarnTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  nextEarnSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  nextEarnAmt: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.success },

  // Quick transact
  quickCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  quickTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },
  quickTypeRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  quickTypeBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cardLight },
  quickTypeBtnEarn: { backgroundColor: Colors.success, borderColor: Colors.success },
  quickTypeBtnSpend: { backgroundColor: Colors.error, borderColor: Colors.error },
  quickTypeBtnText: { fontWeight: "700", fontSize: FontSize.sm, color: Colors.textPrimary },
  quickInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.bgLight, marginBottom: 8 },
  quickBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: "center" },
  quickBtnText: { color: "#fff", fontWeight: "800" },

  // Schedule projector
  schedProjectorCard: { backgroundColor: Colors.primary + "10", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + "33" },
  schedProjectorTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  projPreviewEmpty: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: "center", paddingVertical: Spacing.sm },
  projPreviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  projPreviewCell: { flex: 1, minWidth: "40%", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: "center", ...Shadow.sm },
  projPreviewAmt: { fontSize: FontSize.md, fontWeight: "900" },
  projPreviewLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Empty states
  emptySchedule: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyScheduleTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptyScheduleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 18 },

  // Schedule card
  schedCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  schedCardInactive: { opacity: 0.6 },
  schedCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  schedCardLeft: { flex: 1 },
  schedCardLabel: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  schedCardAmt: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  dayBadgeRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  dayBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight, borderWidth: 1, borderColor: Colors.border },
  dayBadgeActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayBadgeActiveOff: { backgroundColor: Colors.textMuted, borderColor: Colors.textMuted },
  dayBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  schedMiniProj: { backgroundColor: Colors.primary + "10", borderRadius: Radius.md, padding: 6, marginBottom: 6 },
  schedMiniProjText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  schedLastApplied: { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600", marginBottom: 4 },
  schedRemoveBtn: { alignSelf: "flex-end" },
  schedRemoveBtnText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: "700" },

  // Add schedule button
  addScheduleBtn: { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", borderWidth: 1.5, borderColor: Colors.primary + "44", borderStyle: "dashed" },
  addScheduleBtnText: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },

  // Add form
  addForm: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md },
  addFormTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },
  addFormLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary, marginBottom: 4, marginTop: 8 },
  addFormInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.bgLight },
  addFormDays: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  addFormDay: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cardLight },
  addFormDayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  addFormDayText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  addFormPreview: { backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: Spacing.sm, marginTop: Spacing.sm },
  addFormPreviewTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginBottom: 8 },
  addFormPreviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addFormPreviewCell: { flex: 1, minWidth: "40%", backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 8, alignItems: "center" },
  addFormPreviewAmt: { fontSize: FontSize.md, fontWeight: "900", color: Colors.primary },
  addFormPreviewLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  addFormBtns: { flexDirection: "row", gap: 8, marginTop: Spacing.md },
  addFormCancel: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: "center" },
  addFormCancelText: { color: Colors.textSecondary, fontWeight: "700" },
  addFormSave: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: "center" },
  addFormSaveText: { color: "#fff", fontWeight: "800" },

  // Goals
  emptyGoals: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyGoalsTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptyGoalsSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 18 },
  goalCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  goalCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  goalCardLabel: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  goalCardAmt: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  goalCardPct: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary },
  goalBar: { height: 10, backgroundColor: Colors.border, borderRadius: 5, overflow: "hidden", marginBottom: 8 },
  goalBarFill: { height: 10, backgroundColor: Colors.primary, borderRadius: 5 },
  goalCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalRemaining: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  goalContributeBtn: { backgroundColor: Colors.primary + "18", borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary + "44", marginRight: 8 },
  goalContributeBtnText: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.sm },
  goalRemoveBtn: { color: Colors.error, fontSize: 16, fontWeight: "700" },
  goalComplete: { backgroundColor: Colors.success + "18", borderRadius: Radius.lg, padding: 8, alignItems: "center" },
  goalCompleteText: { color: Colors.success, fontWeight: "800" },
  emojiOption: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight, marginRight: 6 },
  emojiOptionActive: { backgroundColor: Colors.primary + "22", borderWidth: 2, borderColor: Colors.primary },
  addGoalForm: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, ...Shadow.sm },

  // History
  historySummary: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: Spacing.sm, ...Shadow.sm, overflow: "hidden" },
  historySummaryCell: { flex: 1, alignItems: "center", padding: Spacing.md },
  historySumLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  historySumAmt: { fontSize: FontSize.xl, fontWeight: "900", marginTop: 4 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  filterPill: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 1, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterPillText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  historyEmpty: { color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.xl, fontSize: FontSize.base },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txDesc: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "500" },
  txDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  txAmt: { fontSize: FontSize.base, fontWeight: "800" },
});
