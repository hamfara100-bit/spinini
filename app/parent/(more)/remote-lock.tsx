import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, Switch, Alert, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import { useData } from "../../../lib/data/store";
import { isLocked, getRemainingMinutes, isInDowntime } from "../../../lib/data/logic";
import { DurationPicker, DurationMinutes, tomorrowMidnight, minutesUntilMidnight } from "../../../components/duration-picker";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { Mascot } from "../../../components/mascot";
import { LOCK_FEATURES } from "../../../lib/lock-features";
import { PASTEL_COLORS } from "../../../lib/data/types";
import { uid, nowIso } from "../../../lib/utils";

const MESSAGES = ["Time for dinner! 🍽️", "Bedtime! 🌙", "Homework time! 📚", "Family time! 👨‍👩‍👧", "Take a break! 🌳"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOCKDOWN_MESSAGES = [
  "Mom set a timer before lockdown — finish what you're doing! ⏰",
  "Dad started the countdown. Wrap it up soon! 🕐",
  "Almost bedtime — your screen will lock when the timer ends. 🌙",
  "Dinner's nearly ready — save your game! 🍽️",
];

// ─── Fun Lock Setup for one kid ───────────────────────────────────────────────

function FunLockPanel({ kidId, kidName }: { kidId: string; kidName: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const fl = kid?.rules.funLock ?? { enabled: false };

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(fl.soundUri ?? "");
  const [recording, setRecording] = useState(false);
  const [recTimer, setRecTimer] = useState(0);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);

  function set(payload: Partial<typeof fl>) {
    dispatch({ type: "SET_FUN_LOCK", kidId, payload });
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.85 });
    if (!res.canceled && res.assets[0]) set({ imageUri: res.assets[0].uri });
  }

  async function takePhoto() {
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!res.canceled && res.assets[0]) set({ imageUri: res.assets[0].uri });
  }

  async function startRecording() {
    try {
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecTimer(0);
      const t = setInterval(() => setRecTimer(s => s + 1), 1000);
      setTimerRef(t);
    } catch {
      Alert.alert("Mic Error", "Could not access microphone.");
    }
  }

  async function stopRecording() {
    if (timerRef) clearInterval(timerRef);
    setRecording(false);
    await recorder.stop();
    const uri = recorder.uri;
    if (uri) set({ soundUri: uri });
  }

  function toggleDay(d: number) {
    const days = fl.scheduledDays ?? [];
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    set({ scheduledDays: next });
  }

  return (
    <View style={styles.funPanel}>
      <View style={styles.funHeader}>
        <Text style={styles.funTitle}>🎭 Fun Lock for {kidName}</Text>
        <Switch
          value={fl.enabled}
          onValueChange={v => set({ enabled: v })}
          trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
          thumbColor={fl.enabled ? Colors.primary : "#ccc"}
        />
      </View>
      {fl.enabled && (
        <>
          {/* Funny Image */}
          <Text style={styles.funLabel}>📸 Funny Lock Screen Image</Text>
          {fl.imageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: fl.imageUri }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => set({ imageUri: undefined })}>
                <Text style={styles.removeImgText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imgBtnRow}>
              <TouchableOpacity style={styles.imgBtn} onPress={pickImage}>
                <Text style={styles.imgBtnText}>🖼 Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imgBtn} onPress={takePhoto}>
                <Text style={styles.imgBtnText}>📷 Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Voice Recording */}
          <Text style={styles.funLabel}>🎙️ Record Your Voice / Sound</Text>
          {fl.soundUri && !recording ? (
            <View style={styles.soundRow}>
              <TouchableOpacity
                style={[styles.soundBtn, { backgroundColor: Colors.success }]}
                onPress={() => player.playing ? player.pause() : player.play()}
              >
                <Text style={styles.soundBtnText}>{player.playing ? "⏸ Pause" : "▶ Play"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.soundBtn, { backgroundColor: Colors.error }]} onPress={startRecording}>
                <Text style={styles.soundBtnText}>🔴 Re-record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.soundBtn, { backgroundColor: Colors.border }]} onPress={() => set({ soundUri: undefined })}>
                <Text style={[styles.soundBtnText, { color: Colors.textPrimary }]}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          ) : recording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recDot} />
              <Text style={styles.recTimer}>{recTimer}s — Recording…</Text>
              <TouchableOpacity style={styles.stopRecBtn} onPress={stopRecording}>
                <Text style={styles.stopRecText}>⏹ Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.recBtn} onPress={startRecording}>
              <Text style={styles.recBtnText}>🎙️ Start Recording</Text>
            </TouchableOpacity>
          )}

          {/* Auto-lock Schedule */}
          <Text style={styles.funLabel}>⏰ Auto-Lock Time (optional)</Text>
          <TextInput
            style={styles.timeInput}
            value={fl.scheduledTime ?? ""}
            onChangeText={t => set({ scheduledTime: t })}
            placeholder="HH:MM e.g. 21:00"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <View style={styles.daysRow}>
            {DAYS.map((d, i) => {
              const on = (fl.scheduledDays ?? []).includes(i);
              return (
                <TouchableOpacity key={d} style={[styles.dayBtn, on && styles.dayBtnOn]} onPress={() => toggleDay(i)}>
                  <Text style={[styles.dayText, on && styles.dayTextOn]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Lock caption */}
          <Text style={styles.funLabel}>💬 Lock Screen Caption</Text>
          <TextInput
            style={styles.input}
            value={fl.message ?? ""}
            onChangeText={t => set({ message: t })}
            placeholder="e.g. Caught ya! 😂"
          />
        </>
      )}
    </View>
  );
}

// ─── Dead Phone + Lockdown Timer for one kid ─────────────────────────────────

function RemoteControlPanel({ kidId, kidName }: { kidId: string; kidName: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const deadPhone = kid?.rules.deadPhone ?? false;
  const activeTimer = kid?.rules.lockdownTimer ?? null;

  const [ldMessage, setLdMessage] = useState(LOCKDOWN_MESSAGES[0]);
  const [ldMinutes, setLdMinutes] = useState(30);
  const [ldImage, setLdImage] = useState<string | undefined>(undefined);

  function toggleDead(v: boolean) {
    dispatch({ type: "SET_DEAD_PHONE", kidId, on: v });
    if (v) dispatch({ type: "SET_FREE_MODE", kidId, enabled: false });
    Alert.alert(
      v ? "📵 Phone looks dead" : "✅ Phone restored",
      v
        ? `${kidName}'s screen now shows a black, powered-off screen. They can tap 4 times to reveal the parent PIN exit.`
        : `${kidName}'s phone is back to normal.`,
    );
  }

  function startLockdown() {
    if (!ldMessage.trim()) { Alert.alert("Add a message", "Write what the countdown popup should say."); return; }
    dispatch({
      type: "SET_LOCKDOWN_TIMER",
      kidId,
      timer: { message: ldMessage.trim(), imageUri: ldImage, startedAt: nowIso(), minutes: ldMinutes },
    });
    dispatch({ type: "SET_FREE_MODE", kidId, enabled: false });
    Alert.alert("⏳ Countdown sent!", `${kidName}'s device will lock in ${ldMinutes} minutes.`);
  }

  function cancelLockdown() {
    dispatch({ type: "SET_LOCKDOWN_TIMER", kidId, timer: null });
    Alert.alert("Countdown cancelled", `${kidName}'s lockdown timer was stopped.`);
  }

  async function pickLdImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.85 });
    if (!res.canceled && res.assets[0]) setLdImage(res.assets[0].uri);
  }

  return (
    <View style={styles.funPanel}>
      {/* Fake dead phone */}
      <View style={styles.funHeader}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.funTitle}>📵 Fake Dead Phone</Text>
          <Text style={styles.helperText}>Show a black "powered-off" screen on {kidName}'s device.</Text>
        </View>
        <Switch
          value={deadPhone}
          onValueChange={toggleDead}
          trackColor={{ false: Colors.border, true: Colors.error + "80" }}
          thumbColor={deadPhone ? Colors.error : "#ccc"}
        />
      </View>

      {/* Lockdown timer */}
      <Text style={[styles.funTitle, { marginTop: 8 }]}>⏳ Lockdown Timer</Text>
      {activeTimer ? (
        <View style={styles.activeTimerBox}>
          <Text style={styles.activeTimerText}>
            ⏳ Countdown running — {activeTimer.minutes} min from start.
          </Text>
          <Text style={styles.activeTimerSub}>"{activeTimer.message}"</Text>
          <TouchableOpacity style={styles.cancelTimerBtn} onPress={cancelLockdown}>
            <Text style={styles.cancelTimerText}>✕ Cancel Countdown</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.funLabel}>💬 Popup Message</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
            {LOCKDOWN_MESSAGES.map(m => (
              <TouchableOpacity key={m} style={[styles.msgChip, ldMessage === m && styles.msgChipActive]} onPress={() => setLdMessage(m)}>
                <Text style={[styles.msgChipText, ldMessage === m && styles.msgChipTextActive]} numberOfLines={1}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={styles.input} value={ldMessage} onChangeText={setLdMessage} placeholder="Custom countdown message…" multiline />

          <Text style={styles.funLabel}>🖼 Image (optional)</Text>
          {ldImage ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: ldImage }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImgBtn} onPress={() => setLdImage(undefined)}>
                <Text style={styles.removeImgText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.imgBtn} onPress={pickLdImage}>
              <Text style={styles.imgBtnText}>🖼 Choose Image</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.funLabel}>⏱ Time before lockdown</Text>
          <View style={styles.durationRow}>
            {[5, 15, 30, 60].map(d => (
              <TouchableOpacity key={d} style={[styles.durBtn, ldMinutes === d && styles.durBtnActive]} onPress={() => setLdMinutes(d)}>
                <Text style={[styles.durBtnText, ldMinutes === d && styles.durBtnTextActive]}>{d}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.startTimerBtn} onPress={startLockdown}>
            <Text style={styles.startTimerText}>⏳ Start {ldMinutes}-min Countdown</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function RemoteLockScreen() {
  const { state, dispatch } = useData();
  const [message, setMessage] = useState("Time for dinner! 🍽️");
  const [durationMins, setDurationMins] = useState(30);
  const [expandFunLock, setExpandFunLock] = useState<string | null>(null);
  const [expandRemote, setExpandRemote] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: "lock" | "unlock"; kidId: string; kidName: string } | null>(null);
  const [showAllow, setShowAllow] = useState(false);
  const [allowFeatures, setAllowFeatures] = useState<string[]>([]);
  const [allowApps, setAllowApps] = useState<string[]>([]);

  // Every external app the kids have rules for (package → name) — pick which
  // remain usable during a lock.
  const allExternalApps = Array.from(
    new Map(state.kids.flatMap(k => (k.rules.appRules ?? []).map(a => [a.appId, a.appName] as const))).entries()
  );

  function applyLock(kidId: string, kidName: string, mins: DurationMinutes) {
    let until: string | undefined;
    if (mins === -1)      until = tomorrowMidnight();
    else if (mins > 0)    until = new Date(Date.now() + mins * 60000).toISOString();
    else                  until = undefined; // indefinite
    dispatch({ type: "SET_INSTANT_LOCK", kidId, locked: true, message, until, allowedFeatures: allowFeatures, allowedApps: allowApps });
    dispatch({ type: "SET_FREE_MODE", kidId, enabled: false });
    setPicker(null);
    const durText = mins === -1 ? "until tomorrow" : mins === 0 ? "indefinitely" : `for ${mins} min`;
    Alert.alert("🔒 Locked!", `${kidName}'s screen is now locked ${durText}.`);
  }

  function applyUnlock(kidId: string, kidName: string, mins: DurationMinutes) {
    dispatch({ type: "SET_INSTANT_LOCK", kidId, locked: false, message: undefined, until: undefined });
    let bonus = 0;
    if (mins === 0) {
      dispatch({ type: "SET_FREE_MODE", kidId, enabled: true });
    } else {
      bonus = mins === -1 ? minutesUntilMidnight() : mins;
      dispatch({ type: "BANK_DELTA", kidId, delta: bonus, reason: `Parent unlocked for ${bonus} min` });
      dispatch({ type: "SET_FREE_MODE", kidId, enabled: true });
    }
    setPicker(null);
    const durText = mins === 0 ? "with no time limit" : mins === -1 ? "until tomorrow midnight" : `for ${bonus} min`;
    Alert.alert("🔓 Unlocked!", `${kidName} can now use their screen ${durText}.`);
  }

  return (
    <>
    <ScreenContainer scroll>
      <Text style={styles.title}>🔒 Remote Lock</Text>

      {/* Message + Duration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lock Message</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }} contentContainerStyle={{ alignItems: "center" }}>
          {MESSAGES.map(m => (
            <TouchableOpacity key={m} style={[styles.msgChip, message === m && styles.msgChipActive]} onPress={() => setMessage(m)}>
              <Text style={[styles.msgChipText, message === m && styles.msgChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput style={styles.input} value={message} onChangeText={setMessage} placeholder="Custom message…" />

        <Text style={[styles.cardTitle, { marginTop: 12 }]}>Duration</Text>
        <View style={styles.durationRow}>
          {[15, 30, 60, 120].map(d => (
            <TouchableOpacity key={d} style={[styles.durBtn, durationMins === d && styles.durBtnActive]} onPress={() => setDurationMins(d)}>
              <Text style={[styles.durBtnText, durationMins === d && styles.durBtnTextActive]}>{d}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Focus Lock — allow some things while locked */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.allowHeader} onPress={() => setShowAllow(v => !v)}>
          <Text style={styles.cardTitle}>🎯 Allow during lock {allowFeatures.length + allowApps.length > 0 ? `(${allowFeatures.length + allowApps.length})` : ""}</Text>
          <Text style={{ color: Colors.textSecondary, fontSize: 18 }}>{showAllow ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showAllow && (
          <>
            <Text style={styles.allowHint}>Locked, but these stay usable — e.g. let them keep drawing.</Text>
            <Text style={styles.allowSub}>In Spinini</Text>
            <View style={styles.allowChips}>
              {LOCK_FEATURES.map(f => {
                const on = allowFeatures.includes(f.key);
                return (
                  <TouchableOpacity key={f.key} style={[styles.allowChip, on && styles.allowChipOn]} onPress={() => setAllowFeatures(s => on ? s.filter(x => x !== f.key) : [...s, f.key])}>
                    <Text style={[styles.allowChipText, on && { color: "#fff" }]}>{f.emoji} {f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {allExternalApps.length > 0 && (
              <>
                <Text style={styles.allowSub}>Other apps</Text>
                <View style={styles.allowChips}>
                  {allExternalApps.map(([pkg, name]) => {
                    const on = allowApps.includes(pkg);
                    return (
                      <TouchableOpacity key={pkg} style={[styles.allowChip, on && styles.allowChipOn]} onPress={() => setAllowApps(s => on ? s.filter(x => x !== pkg) : [...s, pkg])}>
                        <Text style={[styles.allowChipText, on && { color: "#fff" }]} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.allowNote}>Other apps need the Accessibility hard-lock active on the child's device.</Text>
              </>
            )}
          </>
        )}
      </View>

      {/* Kids */}
      <Text style={styles.section}>Kids</Text>
      {state.kids.map(kid => (
        <View key={kid.profile.id}>
          <View style={styles.kidCard}>
            <Mascot type={kid.profile.mascot} size={40} animate={false} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kidName}>{kid.profile.name}</Text>
              {(() => {
                const locked = isLocked(kid);
                let reason = "🔓 Unlocked";
                if (locked) {
                  if (kid.rules.instantLocked) reason = "🔒 Locked by parent";
                  else if (kid.rules.lockUntil && new Date() < new Date(kid.rules.lockUntil)) reason = "🔒 Timed lock active";
                  else if (isInDowntime(kid)) reason = "🔒 Bedtime / downtime";
                  else if (getRemainingMinutes(kid) <= 0) reason = "🔒 Screen time used up";
                  else reason = "🔒 Locked";
                }
                return (
                  <Text style={[styles.kidStatus, { color: locked ? Colors.error : Colors.success }]}>
                    {reason}
                  </Text>
                );
              })()}
            </View>
            {isLocked(kid) ? (
              <TouchableOpacity style={styles.unlockBtn} onPress={() => setPicker({ mode: "unlock", kidId: kid.profile.id, kidName: kid.profile.name })}>
                <Text style={styles.unlockBtnText}>Unlock</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.lockBtn} onPress={() => setPicker({ mode: "lock", kidId: kid.profile.id, kidName: kid.profile.name })}>
                <Text style={styles.lockBtnText}>Lock Now</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Anti-tamper: block Settings so the kid can't Force-Stop / uninstall */}
          <TouchableOpacity
            style={styles.funLockToggleRow}
            onPress={() => dispatch({ type: "SET_LOCK_SETTINGS", kidId: kid.profile.id, on: !kid.rules.lockSettings })}
          >
            <Text style={styles.funLockToggleIcon}>🛡️</Text>
            <Text style={styles.funLockToggleText}>
              Block Settings — stops Force-Stop / uninstall {kid.rules.lockSettings ? "(ON)" : "(OFF)"}
            </Text>
            <Text style={styles.funLockChevron}>{kid.rules.lockSettings ? "✅" : "○"}</Text>
          </TouchableOpacity>
          {kid.rules.lockSettings && (
            <Text style={[styles.allowNote, { marginHorizontal: 12, marginTop: -4, marginBottom: 6 }]}>
              Needs the Accessibility service ON. To reconfigure the child's device, turn this OFF from here first.
            </Text>
          )}

          {/* Fun Lock toggle row */}
          <TouchableOpacity
            style={styles.funLockToggleRow}
            onPress={() => setExpandFunLock(expandFunLock === kid.profile.id ? null : kid.profile.id)}
          >
            <Text style={styles.funLockToggleIcon}>{kid.rules.funLock?.enabled ? "🎭" : "🎭"}</Text>
            <Text style={styles.funLockToggleText}>
              Fun Lock {kid.rules.funLock?.enabled ? "(ON)" : "(OFF)"}
            </Text>
            <Text style={styles.funLockChevron}>{expandFunLock === kid.profile.id ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {expandFunLock === kid.profile.id && (
            <FunLockPanel kidId={kid.profile.id} kidName={kid.profile.name} />
          )}

          {/* Remote control (dead phone + lockdown timer) toggle row */}
          <TouchableOpacity
            style={styles.funLockToggleRow}
            onPress={() => setExpandRemote(expandRemote === kid.profile.id ? null : kid.profile.id)}
          >
            <Text style={styles.funLockToggleIcon}>📵</Text>
            <Text style={styles.funLockToggleText}>
              Dead Phone & Lockdown Timer
              {kid.rules.deadPhone ? " (DEAD)" : kid.rules.lockdownTimer ? " (TIMER ON)" : ""}
            </Text>
            <Text style={styles.funLockChevron}>{expandRemote === kid.profile.id ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {expandRemote === kid.profile.id && (
            <RemoteControlPanel kidId={kid.profile.id} kidName={kid.profile.name} />
          )}
        </View>
      ))}
    </ScreenContainer>

    <DurationPicker
      visible={picker !== null}
      mode={picker?.mode ?? "lock"}
      kidName={picker?.kidName ?? ""}
      onPick={mins => {
        if (!picker) return;
        if (picker.mode === "lock") applyLock(picker.kidId, picker.kidName, mins);
        else applyUnlock(picker.kidId, picker.kidName, mins);
      }}
      onCancel={() => setPicker(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, marginTop: 4 },
  msgChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  msgChipActive: { backgroundColor: Colors.primary },
  msgChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  msgChipTextActive: { color: "#fff" },
  durationRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  durBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  durBtnActive: { backgroundColor: Colors.primary },
  durBtnText: { fontWeight: "600", color: Colors.textSecondary },
  durBtnTextActive: { color: "#fff" },
  allowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  allowHint: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 8 },
  allowSub: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.textMuted, marginTop: 8, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  allowChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allowChip: { backgroundColor: Colors.cardLight, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: Colors.border, maxWidth: 200 },
  allowChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  allowChipText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },
  allowNote: { fontSize: 11, color: Colors.textMuted, marginTop: 8, fontStyle: "italic" },
  section: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.sm },
  kidCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 2, ...Shadow.sm },
  kidName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  kidStatus: { fontSize: FontSize.sm, fontWeight: "600", marginTop: 2 },
  lockBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  lockBtnText: { color: "#fff", fontWeight: "700" },
  unlockBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  unlockBtnText: { color: "#fff", fontWeight: "700" },
  // Fun Lock toggle row
  funLockToggleRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    backgroundColor: Colors.cardLight, borderRadius: Radius.md, marginBottom: 8,
  },
  funLockToggleIcon: { fontSize: 18 },
  funLockToggleText: { flex: 1, fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  funLockChevron: { color: Colors.textMuted, fontWeight: "700" },
  // Fun Lock panel
  funPanel: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 12, ...Shadow.sm, gap: 8 },
  funHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  funTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  funLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginTop: 4 },
  imagePreviewWrap: { alignItems: "center", gap: 8 },
  imagePreview: { width: "100%", height: 160, borderRadius: Radius.lg },
  removeImgBtn: { backgroundColor: Colors.error + "20", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "center" },
  removeImgText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  imgBtnRow: { flexDirection: "row", gap: 10 },
  imgBtn: { flex: 1, backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, alignItems: "center", paddingVertical: 12 },
  imgBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  soundRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  soundBtn: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  soundBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  recBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, marginHorizontal: Spacing.sm },
  recBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  recordingRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recTimer: { flex: 1, color: Colors.error, fontWeight: "700" },
  stopRecBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start" },
  stopRecText: { color: "#fff", fontWeight: "700" },
  timeInput: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  daysRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  dayBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 1, borderColor: Colors.border },
  dayBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  dayTextOn: { color: "#fff" },
  // Remote control panel
  helperText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  startTimerBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: 10 },
  startTimerText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  activeTimerBox: { backgroundColor: Colors.error + "12", borderRadius: Radius.lg, padding: Spacing.md, gap: 6, marginTop: 4 },
  activeTimerText: { color: Colors.error, fontWeight: "800", fontSize: FontSize.base },
  activeTimerSub: { color: Colors.textSecondary, fontStyle: "italic", fontSize: FontSize.sm },
  cancelTimerBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, marginTop: 6 },
  cancelTimerText: { color: "#fff", fontWeight: "700" },
});
