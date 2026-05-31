import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  Modal, ScrollView, TextInput, Alert, Vibration,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { formatTime } from "../../../../lib/utils";
import { Alarm } from "../../../../lib/data/types";
import { uid } from "../../../../lib/utils";

// Lazy-load expo-notifications so its module-level push-token side-effect
// doesn't fire during Expo Router's eager route scan at startup.
async function notif() {
  return import("expo-notifications");
}

const DAYS    = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const TIMER_PRESETS = [
  { label: "5m",  mins: 5 },
  { label: "10m", mins: 10 },
  { label: "15m", mins: 15 },
  { label: "25m", mins: 25, pomodoro: true },
  { label: "30m", mins: 30 },
  { label: "45m", mins: 45 },
  { label: "60m", mins: 60 },
];

function fmt12(h: number, m: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Alarm scheduling helpers ─────────────────────────────────────────────────

async function scheduleAlarmNotification(alarm: Alarm) {
  try {
    const N = await notif();
    const { status } = await N.requestPermissionsAsync();
    if (status !== "granted") return;
    const [hStr, mStr] = alarm.time.split(":");
    const hour   = parseInt(hStr);
    const minute = parseInt(mStr);
    if (alarm.recurringDays.length > 0) {
      for (const day of alarm.recurringDays) {
        await N.cancelScheduledNotificationAsync(`alarm-${alarm.id}-${day}`).catch(() => {});
        await N.scheduleNotificationAsync({
          identifier: `alarm-${alarm.id}-${day}`,
          content: { title: `⏰ ${alarm.label}`, body: fmt12(hour, minute), sound: true },
          trigger: { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute },
        });
      }
    } else {
      await N.cancelScheduledNotificationAsync(`alarm-${alarm.id}`).catch(() => {});
      const triggerDate = new Date();
      triggerDate.setHours(hour, minute, 0, 0);
      if (triggerDate <= new Date()) triggerDate.setDate(triggerDate.getDate() + 1);
      await N.scheduleNotificationAsync({
        identifier: `alarm-${alarm.id}`,
        content: { title: `⏰ ${alarm.label}`, body: fmt12(hour, minute), sound: true },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    }
  } catch {}
}

async function cancelAlarmNotification(alarm: Alarm) {
  try {
    const N = await notif();
    if (alarm.recurringDays.length > 0) {
      for (const day of alarm.recurringDays)
        await N.cancelScheduledNotificationAsync(`alarm-${alarm.id}-${day}`).catch(() => {});
    } else {
      await N.cancelScheduledNotificationAsync(`alarm-${alarm.id}`).catch(() => {});
    }
  } catch {}
}

// ─── Add Alarm Modal ──────────────────────────────────────────────────────────

function AddAlarmModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (a: Omit<Alarm, "id" | "kidId">) => void;
}) {
  const [hour, setHour]     = useState(7);
  const [minute, setMinute] = useState(0);
  const [label, setLabel]   = useState("Wake up");
  const [days, setDays]     = useState<number[]>([1, 2, 3, 4, 5]);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function save() {
    if (!label.trim()) { Alert.alert("Label needed", "Give your alarm a name."); return; }
    onSave({
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      label: label.trim(),
      recurringDays: days,
      enabled: true,
    });
    setLabel("Wake up"); setHour(7); setMinute(0); setDays([1, 2, 3, 4, 5]);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <ScrollView style={ms.sheet} keyboardShouldPersistTaps="handled">
          <Text style={ms.sheetTitle}>⏰ New Alarm</Text>

          <View style={ms.timeDisplay}>
            <Text style={ms.timeText}>{fmt12(hour, minute)}</Text>
          </View>

          <Text style={ms.label}>Hour</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.scroll} contentContainerStyle={{ gap: 6 }}>
            {HOURS.map(h => (
              <TouchableOpacity key={h} style={[ms.pill, hour === h && ms.pillActive]} onPress={() => setHour(h)}>
                <Text style={[ms.pillText, hour === h && ms.pillTextActive]}>
                  {fmt12(h, 0).split(":")[0] + " " + (h < 12 ? "AM" : "PM")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Minute</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.scroll} contentContainerStyle={{ gap: 6 }}>
            {MINUTES.map(m => (
              <TouchableOpacity key={m} style={[ms.pill, minute === m && ms.pillActive]} onPress={() => setMinute(m)}>
                <Text style={[ms.pillText, minute === m && ms.pillTextActive]}>{String(m).padStart(2, "0")}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={ms.label}>Label</Text>
          <TextInput style={ms.input} value={label} onChangeText={setLabel} placeholder="e.g. Wake up, School bus…" placeholderTextColor={Colors.textMuted} />

          <Text style={ms.label}>Repeat Days</Text>
          <View style={ms.daysRow}>
            {DAYS.map((d, i) => (
              <TouchableOpacity key={d} style={[ms.dayBtn, days.includes(i) && ms.dayBtnActive]} onPress={() => toggleDay(i)}>
                <Text style={[ms.dayText, days.includes(i) && ms.dayTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {days.length === 0 && <Text style={ms.hint}>No days selected = one-time alarm</Text>}

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveText}>Add Alarm</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Alarms Tab ───────────────────────────────────────────────────────────────

function AlarmsTab({ kidId }: { kidId: string }) {
  const { dispatch } = useData();
  const kid = useKid(kidId);
  const [showAdd, setShowAdd] = useState(false);

  async function addAlarm(data: Omit<Alarm, "id" | "kidId">) {
    const alarm: Alarm = { id: uid(), kidId, ...data };
    dispatch({ type: "ALARM_ADD", kidId, alarm });
    await scheduleAlarmNotification(alarm);
  }

  async function toggleAlarm(alarm: Alarm) {
    dispatch({ type: "ALARM_TOGGLE", kidId, alarmId: alarm.id });
    if (alarm.enabled) await cancelAlarmNotification(alarm);
    else await scheduleAlarmNotification({ ...alarm, enabled: true });
  }

  async function deleteAlarm(alarm: Alarm) {
    Alert.alert("Delete alarm?", `"${alarm.label}" at ${formatTime(alarm.time)}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          dispatch({ type: "ALARM_REMOVE", kidId, alarmId: alarm.id });
          await cancelAlarmNotification(alarm);
        },
      },
    ]);
  }

  const alarms = kid?.alarms ?? [];

  return (
    <View>
      {alarms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>⏰</Text>
          <Text style={styles.emptyTitle}>No alarms yet</Text>
          <Text style={styles.emptySub}>Add wake-up or reminder alarms!</Text>
        </View>
      ) : (
        alarms.map(a => (
          <TouchableOpacity
            key={a.id}
            style={[styles.alarmCard, !a.enabled && { opacity: 0.5 }]}
            onLongPress={() => deleteAlarm(a)}
            delayLongPress={600}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.alarmTime}>{formatTime(a.time)}</Text>
              <Text style={styles.alarmLabel}>{a.label}</Text>
              <Text style={styles.alarmDays}>
                {a.recurringDays.length > 0 ? a.recurringDays.map(d => DAYS[d]).join(", ") : "One-time"}
              </Text>
            </View>
            <View style={styles.alarmRight}>
              <Switch value={a.enabled} onValueChange={() => toggleAlarm(a)} trackColor={{ true: Colors.primary }} />
              <TouchableOpacity onPress={() => deleteAlarm(a)} style={styles.deleteBtn}>
                <Text style={{ fontSize: 18 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={styles.addBtnText}>+ Add Alarm</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Hold an alarm to delete it</Text>

      <AddAlarmModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={addAlarm} />
    </View>
  );
}

// ─── Timer Tab ────────────────────────────────────────────────────────────────

function TimerTab() {
  const [seconds, setSeconds]       = useState(0);
  const [total, setTotal]           = useState(0);
  const [running, setRunning]       = useState(false);
  const [selectedMins, setSelectedMins] = useState(25);
  const [finished, setFinished]     = useState(false);
  const notifId = useRef<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          setRunning(false);
          setFinished(true);
          handleFinish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  async function handleFinish() {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    try {
      const N = await notif();
      await N.scheduleNotificationAsync({
        content: { title: "⏱️ Time's up!", body: "Your timer has finished. Great work! 🎉", sound: true },
        trigger: null,
      });
    } catch {}
  }

  async function start() {
    setFinished(false);
    setTotal(selectedMins * 60);
    setSeconds(selectedMins * 60);
    setRunning(true);
    try {
      const N = await notif();
      const { status } = await N.requestPermissionsAsync();
      if (status === "granted") {
        if (notifId.current)
          await N.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
        const nid = await N.scheduleNotificationAsync({
          content: { title: "⏱️ Time's up!", body: `Your ${selectedMins}-minute timer is done! 🎉`, sound: true },
          trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: selectedMins * 60 },
        });
        notifId.current = nid;
      }
    } catch {}
  }

  async function stop() {
    setRunning(false); setSeconds(0); setTotal(0); setFinished(false);
    if (notifId.current) {
      const N = await notif();
      await N.cancelScheduledNotificationAsync(notifId.current).catch(() => {});
      notifId.current = null;
    }
  }

  const mins     = Math.floor(seconds / 60);
  const secs     = seconds % 60;
  const progress = total > 0 ? (total - seconds) / total : 0;
  const progDeg  = Math.round(progress * 360);

  return (
    <View style={styles.timerWrap}>
      {/* Clock ring */}
      <View style={styles.ringOuter}>
        <View style={[styles.ringArc, { transform: [{ rotate: `${progDeg}deg` }] }]} />
        <View style={styles.ringInner}>
          {finished ? (
            <>
              <Text style={{ fontSize: 48 }}>🎉</Text>
              <Text style={styles.finishText}>Done!</Text>
            </>
          ) : (
            <>
              <Text style={styles.clock}>{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</Text>
              {!running && <Text style={styles.clockSub}>{selectedMins} min</Text>}
              {running  && <Text style={styles.clockSub}>{Math.ceil(seconds / 60)}m left</Text>}
            </>
          )}
        </View>
      </View>

      {/* Presets */}
      {!running && !finished && (
        <View style={styles.presets}>
          {TIMER_PRESETS.map(p => (
            <TouchableOpacity
              key={p.mins}
              style={[styles.presetBtn, selectedMins === p.mins && styles.presetBtnActive]}
              onPress={() => setSelectedMins(p.mins)}
            >
              <Text style={[styles.presetText, selectedMins === p.mins && styles.presetTextActive]}>{p.label}</Text>
              {p.pomodoro && <Text style={{ fontSize: 10 }}>🍅</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Controls */}
      <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
        {!running ? (
          <TouchableOpacity style={styles.startBtn} onPress={start}>
            <Text style={styles.startBtnText}>{finished ? "▶ Start Again" : "▶ Start"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: Colors.error }]} onPress={stop}>
            <Text style={styles.startBtnText}>⏹ Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      {!running && (
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Tips</Text>
          <Text style={styles.tipsText}>• 25 minutes = Pomodoro technique 🍅</Text>
          <Text style={styles.tipsText}>• Take a 5-minute break after each session</Text>
          <Text style={styles.tipsText}>• You'll get notified when time is up!</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Tab = "alarms" | "timer";

export default function AlarmsTimerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("alarms");

  useEffect(() => {
    notif().then(N => {
      try {
        N.setNotificationHandler({
          handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
        });
      } catch {}
    }).catch(() => {});
  }, []);

  return (
    <ScreenContainer scroll>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "alarms" && styles.tabBtnActive]}
          onPress={() => setTab("alarms")}
        >
          <Text style={[styles.tabText, tab === "alarms" && styles.tabTextActive]}>⏰ Alarms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "timer" && styles.tabBtnActive]}
          onPress={() => setTab("timer")}
        >
          <Text style={[styles.tabText, tab === "timer" && styles.tabTextActive]}>⏱️ Focus Timer</Text>
        </TouchableOpacity>
      </View>

      {tab === "alarms" ? <AlarmsTab kidId={id} /> : <TimerTab />}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row", gap: 8, marginBottom: Spacing.lg,
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: "center",
  },
  tabBtnActive: { backgroundColor: Colors.primary, ...Shadow.sm },
  tabText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  // Alarms tab
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  alarmCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 8, ...Shadow.sm,
  },
  alarmTime: { fontSize: 32, fontWeight: "800", color: Colors.primary },
  alarmLabel: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  alarmDays: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  alarmRight: { alignItems: "center", gap: 6 },
  deleteBtn: { padding: 4 },
  addBtn: {
    alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 12, marginTop: Spacing.md, ...Shadow.sm,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  hint: { textAlign: "center", fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm },

  // Timer tab
  timerWrap: { alignItems: "stretch" },
  ringOuter: {
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.primary + "20",
    alignSelf: "center", alignItems: "center", justifyContent: "center",
    marginBottom: Spacing.lg, position: "relative",
  },
  ringArc: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    borderWidth: 10, borderColor: Colors.primary,
    borderTopColor: "transparent", borderRightColor: "transparent",
  },
  ringInner: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.surfaceLight,
    alignItems: "center", justifyContent: "center", ...Shadow.md,
  },
  clock: { fontSize: 48, fontWeight: "800", color: Colors.primary, fontVariant: ["tabular-nums"] },
  clockSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  finishText: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.success, marginTop: 4 },
  presets: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    justifyContent: "center", marginBottom: Spacing.lg,
  },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.cardLight, flexDirection: "row", alignItems: "center", gap: 4,
  },
  presetBtnActive: { backgroundColor: Colors.primary },
  presetText: { fontWeight: "600", color: Colors.textPrimary },
  presetTextActive: { color: "#fff" },
  startBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 48, paddingVertical: 16,
    borderRadius: Radius.full, ...Shadow.md,
  },
  startBtnText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "700" },
  tipsCard: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 6,
  },
  tipsTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  tipsText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surfaceLight,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: "92%",
  },
  sheetTitle: {
    fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary,
    marginBottom: Spacing.md, textAlign: "center",
  },
  timeDisplay: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.md,
  },
  timeText: { fontSize: 48, fontWeight: "900", color: "#fff", letterSpacing: 2 },
  label: {
    fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  scroll: { maxHeight: 40 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.full, backgroundColor: Colors.cardLight,
  },
  pillActive: { backgroundColor: Colors.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  pillTextActive: { color: "#fff" },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight,
    color: Colors.textPrimary,
  },
  daysRow: { flexDirection: "row", gap: 6 },
  dayBtn: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderRadius: Radius.md, backgroundColor: Colors.cardLight,
  },
  dayBtnActive: { backgroundColor: Colors.primary },
  dayText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  dayTextActive: { color: "#fff" },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, borderWidth: 2, borderColor: Colors.border,
    borderRadius: Radius.full, alignItems: "center", paddingVertical: 14,
  },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: {
    flex: 2, backgroundColor: Colors.primary,
    borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.sm,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
