import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
  TextInput, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Mascot } from "../../../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { PASTEL_COLORS } from "../../../../lib/data/types";
import { getTodayUsage, getRemainingMinutes, getBankBalance, formatMinutes, getStreak, isLocked } from "../../../../lib/data/logic";
import { DurationPicker, DurationMinutes, tomorrowMidnight, minutesUntilMidnight } from "../../../../components/duration-picker";
import type { AgePreset, VoiceNote } from "../../../../lib/data/types";
import { uid, nowIso } from "../../../../lib/utils";

type Tab = "overview" | "controls" | "voice" | "chores";

// ─── Voice Note Player Row ────────────────────────────────────────────────────
function VoiceNoteRow({
  note,
  onDelete,
}: {
  note: VoiceNote;
  onDelete: () => void;
}) {
  const player = useAudioPlayer(note.uri);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.seekTo(0);
      player.play();
      setPlaying(true);
      // Auto-reset after duration
      setTimeout(() => setPlaying(false), (note.durationSecs + 1) * 1000);
    }
  }

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const date = new Date(note.createdAt).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

  return (
    <View style={vnStyles.row}>
      <TouchableOpacity style={[vnStyles.playBtn, playing && vnStyles.playBtnActive]} onPress={toggle}>
        <Text style={vnStyles.playBtnText}>{playing ? "⏹" : "▶"}</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={vnStyles.noteTitle} numberOfLines={1}>{note.title || "Voice message"}</Text>
        <Text style={vnStyles.noteMeta}>{fmtSecs(note.durationSecs)} · {date}</Text>
        {note.listenedAt ? (
          <Text style={vnStyles.listenedBadge}>✅ Listened</Text>
        ) : (
          <Text style={vnStyles.newBadge}>🔵 New</Text>
        )}
      </View>
      <TouchableOpacity
        style={vnStyles.deleteBtn}
        onPress={() =>
          Alert.alert("Delete voice message?", `Delete "${note.title || "this message"}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ])
        }
      >
        <Text style={vnStyles.deleteBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Voice Tab ────────────────────────────────────────────────────────────────
function VoiceTab({ kidId, kidName, parentName }: { kidId: string; kidName: string; parentName: string }) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const notes = kid?.voiceNotes ?? [];

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRec() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone Access", "Please allow microphone access in Settings to record voice messages.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
    } catch {
      Alert.alert("Recording Error", "Could not start recording. Please try again.");
    }
  }

  async function stopRec() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    setSaving(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { Alert.alert("Error", "Recording failed — no file was saved."); setSaving(false); return; }
      const note: VoiceNote = {
        id: uid(),
        title: title.trim() || `Voice message from ${parentName}`,
        uri,
        durationSecs: recSecs,
        createdAt: nowIso(),
        from: parentName,
      };
      dispatch({ type: "VOICE_NOTE_ADD", kidId, note });
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId,
        notification: {
          id: uid(), kidId, kind: "ping",
          title: `🎙️ Voice message from ${parentName}!`,
          body: note.title,
          read: false, createdAt: nowIso(),
        },
      });
      setTitle("");
      Alert.alert("✅ Sent!", `${kidName} will see a notification to listen to your message.`);
    } catch {
      Alert.alert("Error", "Could not save the recording. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Info banner */}
      <View style={vnStyles.infoBanner}>
        <Text style={vnStyles.infoBannerText}>
          🎙️ Record a voice message for {kidName}. They'll get a notification and can play it on their home screen.
        </Text>
      </View>

      {/* Record section */}
      <Section title="Record a Message">
        <TextInput
          style={vnStyles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Label (e.g. 'Bedtime story tonight')"
          placeholderTextColor={Colors.textSecondary}
          maxLength={60}
          editable={!recording}
        />

        <View style={vnStyles.recCenter}>
          {recording ? (
            <>
              <View style={vnStyles.recIndicator}>
                <Text style={vnStyles.recDot}>●</Text>
                <Text style={vnStyles.recTimer}>{fmtSecs(recSecs)}</Text>
              </View>
              <TouchableOpacity
                style={vnStyles.stopBtn}
                onPress={stopRec}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={vnStyles.stopBtnIcon}>⏹</Text>
                <Text style={vnStyles.stopBtnLabel}>Stop & Save</Text>
              </TouchableOpacity>
              <Text style={vnStyles.recHint}>Recording… tap to stop and send</Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[vnStyles.recBtn, saving && { opacity: 0.5 }]}
                onPress={startRec}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={vnStyles.recBtnIcon}>🎙️</Text>
                <Text style={vnStyles.recBtnLabel}>Start Recording</Text>
              </TouchableOpacity>
              <Text style={vnStyles.recHint}>Tap to record a voice message for {kidName}</Text>
            </>
          )}
        </View>
      </Section>

      {/* Sent messages */}
      <Section title={`Messages You've Sent (${notes.length})`}>
        {notes.length === 0 ? (
          <Text style={vnStyles.empty}>No voice messages yet. Record one above!</Text>
        ) : (
          notes.map(note => (
            <VoiceNoteRow
              key={note.id}
              note={note}
              onDelete={() => dispatch({ type: "VOICE_NOTE_DELETE", kidId, noteId: note.id })}
            />
          ))
        )}
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ParentKidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [lockPicker, setLockPicker] = useState<"lock" | "unlock" | null>(null);
  const parentName = state.parentSettings.name || "Parent";

  if (!kid) return null;

  const { profile, rules, chores, notifications, bank } = kid;
  const used      = getTodayUsage(kid);
  const remaining = getRemainingMinutes(kid);
  const balance   = getBankBalance(bank);
  const streak    = getStreak(kid);
  const bg        = PASTEL_COLORS[profile.color];

  const pendingChores  = chores.filter(c => c.status === "submitted");
  const unreadNotifs   = notifications.filter(n => !n.read);
  const installedCount = rules.installedApps.length;
  const unlistenedNotes = (kid.voiceNotes ?? []).filter(n => !n.listenedAt).length;
  const kidIsLocked    = isLocked(kid);

  function applyLockPick(mins: DurationMinutes) {
    const mode = lockPicker; // capture before setLockPicker(null) closes it
    setLockPicker(null);

    if (mode === "lock") {
      let until: string | undefined;
      if (mins === -1)   until = tomorrowMidnight();
      else if (mins > 0) until = new Date(Date.now() + mins * 60000).toISOString();
      else               until = undefined;
      dispatch({ type: "SET_INSTANT_LOCK", kidId: id, locked: true, message: "Time for a break! 🌟", until });
      dispatch({ type: "SET_FREE_MODE", kidId: id, enabled: false });
      const durText = mins === -1 ? "until tomorrow" : mins === 0 ? "indefinitely" : `for ${mins} min`;
      Alert.alert("🔒 Locked!", `${profile.name}'s screen is now locked ${durText}.`);
    } else {
      dispatch({ type: "SET_INSTANT_LOCK", kidId: id, locked: false, message: undefined, until: undefined });
      let bonus = 0;
      if (mins === 0) {
        dispatch({ type: "SET_FREE_MODE", kidId: id, enabled: true });
      } else {
        bonus = mins === -1 ? minutesUntilMidnight() : mins;
        dispatch({ type: "BANK_DELTA", kidId: id, delta: bonus, reason: `Parent unlocked for ${bonus} min` });
        dispatch({ type: "SET_FREE_MODE", kidId: id, enabled: true });
      }
      const durText = mins === 0 ? "with no time limit" : mins === -1 ? "until tomorrow midnight" : `for ${bonus} min`;
      Alert.alert(
        "🔓 Unlocked!",
        `${profile.name} can now use their screen ${durText}.`,
        [
          { text: "Stay here", style: "cancel" },
          { text: "Go to kid's screen →", onPress: () => router.replace(`/kid/${id}/home` as any) },
        ]
      );
    }
  }

  function approveChore(choreId: string) {
    dispatch({ type: "UPDATE_CHORE", choreId, payload: { status: "approved" } });
  }
  function rejectChore(choreId: string) {
    dispatch({ type: "UPDATE_CHORE", choreId, payload: { status: "rejected" } });
  }

  const TABS: { id: Tab; emoji: string; label: string }[] = [
    { id: "overview",  emoji: "📊", label: "Overview" },
    { id: "controls",  emoji: "🎛️", label: "Controls" },
    { id: "voice",     emoji: "🎙️", label: `Voice${unlistenedNotes ? ` (${unlistenedNotes})` : ""}` },
    { id: "chores",    emoji: "✅", label: `Chores${pendingChores.length ? ` (${pendingChores.length})` : ""}` },
  ];

  return (
    <>
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: bg + "60" }]}>
        <Mascot type={profile.mascot} size={56} animate />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.age}>Age {profile.age}</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push("/parent/family" as any)}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[
          { value: formatMinutes(used),      label: "Used today", color: used > rules.dailyLimitMinutes * 0.8 ? Colors.error : Colors.primary },
          { value: formatMinutes(remaining), label: "Remaining",  color: Colors.success },
          { value: `${balance}m`,            label: "TimeBank",   color: Colors.warning },
          { value: `${streak}🔥`,            label: "Streak",     color: Colors.primary },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLbl}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ fontSize: 13 }}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {tab === "voice" ? (
        <VoiceTab kidId={id} kidName={profile.name} parentName={parentName} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

          {tab === "overview" && (
            <>
              <Section title="Quick Actions">
                <View style={styles.actionRow}>
                  {[
                    { emoji: "🔒", label: "Lock Now",  onPress: () => setLockPicker("lock") },
                    { emoji: "🔓", label: "Unlock",    onPress: () => setLockPicker("unlock") },
                    { emoji: "🏆", label: "+15 min",   onPress: () => dispatch({ type: "BANK_DELTA", kidId: id, delta: 15, reason: "Parent bonus" }) },
                    { emoji: "📱", label: `${installedCount} apps`, onPress: () => router.push("/parent/(more)/remote-apps" as any) },
                  ].map(a => (
                    <TouchableOpacity key={a.label} style={styles.actionBtn} onPress={a.onPress}>
                      <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
                      <Text style={styles.actionLabel}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Check-in request */}
                <TouchableOpacity
                  style={styles.checkInBtn}
                  onPress={() => {
                    dispatch({
                      type: "CHECK_IN_REQUEST", kidId: id,
                      request: { id: uid(), kidId: id, requestedAt: nowIso(), status: "pending" },
                    });
                    Alert.alert("✅ Check-in sent!", `${profile.name} will see a prompt to respond on their screen.`);
                  }}
                >
                  <Text style={styles.checkInBtnEmoji}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkInBtnLabel}>Send Check-in Request</Text>
                    <Text style={styles.checkInBtnSub}>Ask {profile.name} to confirm they're safe</Text>
                  </View>
                  <Text style={styles.checkInArrow}>›</Text>
                </TouchableOpacity>

                {/* Voice message shortcut */}
                <TouchableOpacity
                  style={[styles.checkInBtn, { backgroundColor: Colors.primary + "10", borderColor: Colors.primary + "30", marginTop: 8 }]}
                  onPress={() => setTab("voice")}
                >
                  <Text style={styles.checkInBtnEmoji}>🎙️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkInBtnLabel, { color: Colors.primary }]}>Send Voice Message</Text>
                    <Text style={styles.checkInBtnSub}>
                      {unlistenedNotes > 0
                        ? `${unlistenedNotes} message${unlistenedNotes !== 1 ? "s" : ""} waiting to be heard`
                        : "Record a personal message for " + profile.name}
                    </Text>
                  </View>
                  <Text style={styles.checkInArrow}>›</Text>
                </TouchableOpacity>
              </Section>

              {/* Recent check-in history */}
              {(kid.checkInRequests ?? []).length > 0 && (
                <Section title="Check-in History">
                  {(kid.checkInRequests ?? []).slice(0, 5).map(r => {
                    const date = new Date(r.requestedAt);
                    const fmtDate = date.toLocaleString("en-AU", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                    const statusColor = r.status === "safe" ? Colors.success : r.status === "help_needed" ? Colors.error : Colors.textMuted;
                    const statusLabel = r.status === "safe" ? "👍 Safe" : r.status === "help_needed" ? "🆘 Help needed!" : "⏳ Pending";
                    return (
                      <View key={r.id} style={styles.checkInRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.checkInDate}>{fmtDate}</Text>
                          {r.respondedAt && (
                            <Text style={styles.checkInResponseTime}>
                              Responded {Math.round((new Date(r.respondedAt).getTime() - new Date(r.requestedAt).getTime()) / 60_000)} min later
                            </Text>
                          )}
                        </View>
                        <View style={[styles.checkInStatus, { backgroundColor: statusColor + "20" }]}>
                          <Text style={[styles.checkInStatusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      </View>
                    );
                  })}
                </Section>
              )}

              <Section title="Device Status">
                <View style={styles.statusRow}>
                  <StatusDot label="Screen"     active={!kidIsLocked}                             onColor={Colors.success} offColor={Colors.error} />
                  <StatusDot label="Bedtime"    active={rules.screenTimeSchedule.bedtimeEnabled}  onColor={Colors.primary} />
                  <StatusDot label="Safe Search" active={rules.safeSearch.googleSafeSearch}       onColor={Colors.primary} />
                </View>
              </Section>

              {unreadNotifs.length > 0 && (
                <Section title={`Unread Notifications (${unreadNotifs.length})`}>
                  {unreadNotifs.slice(0, 5).map(n => (
                    <View key={n.id} style={styles.notifCard}>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.notifTitle}>{n.title}</Text>
                        <Text style={styles.notifBody}>{n.body}</Text>
                      </View>
                    </View>
                  ))}
                </Section>
              )}
            </>
          )}

          {tab === "controls" && (
            <>
              {/* Age presets */}
              <Section title="⚡ Quick Setup — Age Presets">
                <Text style={styles.presetHint}>
                  One tap applies recommended screen time, content filters, bedtime, and privacy settings for each age group.
                </Text>
                <View style={styles.presetGrid}>
                  {([
                    { preset: "young_child" as AgePreset, emoji: "🐣", label: "Young Child", sub: "Ages 5–8\n1hr/day, strict" },
                    { preset: "preteen"    as AgePreset, emoji: "🎒", label: "Preteen",      sub: "Ages 9–11\n2hr/day, strict" },
                    { preset: "teen"       as AgePreset, emoji: "🎧", label: "Teen",         sub: "Ages 12–14\n3hr/day, balanced" },
                    { preset: "older_teen" as AgePreset, emoji: "🎓", label: "Older Teen",   sub: "Ages 15+\n5hr/day, light" },
                  ] as const).map(p => (
                    <TouchableOpacity
                      key={p.preset}
                      style={styles.presetCard}
                      onPress={() => Alert.alert(
                        `Apply "${p.label}" preset?`,
                        `This will update ${profile.name}'s screen time limits, content filters, bedtime, and privacy settings to match recommended settings for ${p.sub.split("\n")[0]}.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Apply", onPress: () => dispatch({ type: "APPLY_AGE_PRESET", kidId: id, preset: p.preset }) },
                        ]
                      )}
                    >
                      <Text style={styles.presetEmoji}>{p.emoji}</Text>
                      <Text style={styles.presetLabel}>{p.label}</Text>
                      <Text style={styles.presetSub}>{p.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Section>

              <Section title="Screen Time">
                <SwitchRow
                  label="🔒 Instant Lock" sub="Lock device right now"
                  value={rules.instantLocked}
                  onChange={v => dispatch({ type: "SET_INSTANT_LOCK", kidId: id, locked: v })}
                  color={Colors.error}
                />
                <Divider />
                <SwitchRow
                  label="🌙 Bedtime Lock" sub={`${rules.screenTimeSchedule.bedtimeStart} – ${rules.screenTimeSchedule.bedtimeEnd}`}
                  value={rules.screenTimeSchedule.bedtimeEnabled}
                  onChange={v => dispatch({ type: "UPDATE_RULES", kidId: id, payload: { screenTimeSchedule: { ...rules.screenTimeSchedule, bedtimeEnabled: v } } })}
                  color={Colors.primary}
                />
                <Divider />
                <SwitchRow
                  label="📚 Educational Apps Exempt" sub="Learning apps don't count toward daily limit"
                  value={rules.screenTimeSchedule.educationalAppsExempt}
                  onChange={v => dispatch({ type: "UPDATE_RULES", kidId: id, payload: { screenTimeSchedule: { ...rules.screenTimeSchedule, educationalAppsExempt: v } } })}
                  color={Colors.success}
                />
              </Section>

              <Section title="Content & Safety">
                <SwitchRow
                  label="🔍 Google Safe Search" sub="Block explicit image results"
                  value={rules.safeSearch.googleSafeSearch}
                  onChange={v => dispatch({ type: "UPDATE_RULES", kidId: id, payload: { safeSearch: { ...rules.safeSearch, googleSafeSearch: v } } })}
                  color={Colors.primary}
                />
                <Divider />
                <SwitchRow
                  label="▶️ YouTube Restricted" sub="Hide inappropriate videos"
                  value={rules.safeSearch.youtubeRestricted}
                  onChange={v => dispatch({ type: "UPDATE_RULES", kidId: id, payload: { safeSearch: { ...rules.safeSearch, youtubeRestricted: v } } })}
                  color={Colors.error}
                />
                <Divider />
                <SwitchRow
                  label="🔐 Require Approval to Download" sub="PIN required to install apps"
                  value={rules.downloadApprovalRequired}
                  onChange={v => dispatch({ type: "UPDATE_RULES", kidId: id, payload: { downloadApprovalRequired: v } })}
                  color={Colors.warning}
                />
              </Section>

              <TouchableOpacity style={styles.fullRulesBtn} onPress={() => router.push("/parent/(more)/rules" as any)}>
                <Text style={styles.fullRulesBtnText}>Open Full Rules & Controls →</Text>
              </TouchableOpacity>
            </>
          )}

          {tab === "chores" && (
            <>
              {pendingChores.length > 0 && (
                <Section title={`⏳ Waiting for Approval (${pendingChores.length})`}>
                  {pendingChores.map(c => (
                    <View key={c.id} style={styles.choreCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.choreTitle}>{c.title}</Text>
                        {c.proofs[0]?.note && <Text style={styles.choreSub}>"{c.proofs[0].note}"</Text>}
                      </View>
                      <View style={styles.choreActions}>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => approveChore(c.id)}>
                          <Text style={{ color: "#fff", fontWeight: "700" }}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectChore(c.id)}>
                          <Text style={{ color: "#fff", fontWeight: "700" }}>✗</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </Section>
              )}
              <Section title="All Chores">
                {chores.length === 0
                  ? <Text style={styles.empty}>No chores assigned yet.</Text>
                  : chores.map(c => (
                    <View key={c.id} style={[styles.choreCard, { opacity: c.status === "approved" ? 0.6 : 1 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.choreTitle}>{c.title}</Text>
                        <Text style={[styles.choreSub, { color: statusColor(c.status) }]}>{c.status}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.primary }}>{c.points}pts</Text>
                    </View>
                  ))
                }
              </Section>
            </>
          )}


          <View style={{ height: 40 }} />
        </ScrollView>
      )}

    </ScreenContainer>

    <DurationPicker
      visible={lockPicker !== null}
      mode={lockPicker ?? "lock"}
      kidName={profile.name}
      onPick={applyLockPick}
      onCancel={() => setLockPicker(null)}
    />
    </>
  );
}

function statusColor(s: string) {
  if (s === "approved") return Colors.success;
  if (s === "rejected") return Colors.error;
  if (s === "submitted") return Colors.warning;
  return Colors.textSecondary;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}
function Divider() { return <View style={styles.divider} />; }
function SwitchRow({ label, sub, value, onChange, color }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{label}</Text>
        {sub && <Text style={styles.cardSub}>{sub}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: color ?? Colors.primary }} thumbColor="#fff" />
    </View>
  );
}
function StatusDot({ label, active, onColor, offColor = Colors.cardLight }: { label: string; active: boolean; onColor: string; offColor?: string }) {
  return (
    <View style={styles.statusDotWrap}>
      <View style={[styles.dot, { backgroundColor: active ? onColor : offColor }]} />
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 14 },
  name: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  age: { fontSize: FontSize.sm, color: Colors.textSecondary },
  googleBadge: { fontSize: 11, color: "#4285F4", fontWeight: "600", marginTop: 2 },
  editBtn: { backgroundColor: Colors.primary + "20", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, alignItems: "center", ...Shadow.sm },
  statVal: { fontSize: FontSize.md, fontWeight: "800" },
  statLbl: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },
  tabRow: { flexDirection: "row", gap: 4, marginBottom: 14, flexWrap: "nowrap" },
  tabBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 3, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: Colors.cardLight },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 9, fontWeight: "700", color: Colors.textSecondary },
  tabLabelActive: { color: "#fff" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: { flex: 1, alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.lg, paddingVertical: 12, marginHorizontal: 3 },
  actionLabel: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary, marginTop: 4 },
  statusRow: { flexDirection: "row", justifyContent: "space-around" },
  statusDotWrap: { alignItems: "center", gap: 4 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotLabel: { fontSize: 10, color: Colors.textSecondary },
  notifCard: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  notifTitle: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.sm },
  notifBody: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  fullRulesBtn: { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: 14, alignItems: "center", marginBottom: 10 },
  fullRulesBtnText: { color: Colors.primary, fontWeight: "700" },
  backupHeader: { alignItems: "center", paddingVertical: Spacing.lg, gap: 8 },
  backupTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  backupSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.md },
  noGoogleBox: { backgroundColor: Colors.warning + "15", borderRadius: Radius.lg, padding: Spacing.md, marginTop: 8 },
  noGoogleText: { fontSize: FontSize.sm, color: Colors.warning, lineHeight: 20 },
  choreCard: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  choreTitle: { fontWeight: "700", color: Colors.textPrimary },
  choreSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, textTransform: "capitalize" },
  choreActions: { flexDirection: "row", gap: 8 },
  approveBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.success, alignItems: "center", justifyContent: "center" },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.error, alignItems: "center", justifyContent: "center" },
  empty: { color: Colors.textSecondary, fontSize: FontSize.sm },
  // Check-in
  checkInBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    padding: 14, marginTop: 10,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  checkInBtnEmoji: { fontSize: 28 },
  checkInBtnLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  checkInBtnSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  checkInArrow: { fontSize: 22, color: Colors.primary, fontWeight: "700" },
  checkInRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  checkInDate: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  checkInResponseTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  checkInStatus: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  checkInStatusText: { fontSize: FontSize.xs, fontWeight: "800" },
  // Age presets
  presetHint: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetCard: {
    width: "47%", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: 14, alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: Colors.border,
  },
  presetEmoji: { fontSize: 28 },
  presetLabel: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary },
  presetSub: { fontSize: 10, color: Colors.textSecondary, textAlign: "center", lineHeight: 14 },
});

// ─── Voice note styles ────────────────────────────────────────────────────────
const vnStyles = StyleSheet.create({
  infoBanner: {
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.primary + "25",
  },
  infoBannerText: { fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
  titleInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.bgLight, marginBottom: 16,
  },
  recCenter: { alignItems: "center", gap: 12, paddingVertical: 8 },
  recBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.error,
    alignItems: "center", justifyContent: "center",
    ...Shadow.md,
  },
  recBtnIcon: { fontSize: 36 },
  recBtnLabel: { fontSize: FontSize.xs, fontWeight: "700", color: "#fff", marginTop: 4 },
  stopBtn: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.textPrimary,
    alignItems: "center", justifyContent: "center",
    ...Shadow.md,
  },
  stopBtnIcon: { fontSize: 32 },
  stopBtnLabel: { fontSize: FontSize.xs, fontWeight: "700", color: "#fff", marginTop: 4 },
  recIndicator: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.error + "20", borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  recDot: { color: Colors.error, fontSize: 14, fontWeight: "900" },
  recTimer: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.error, fontVariant: ["tabular-nums"] },
  recHint: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center" },
  // Notes list
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  playBtnActive: { backgroundColor: Colors.error },
  playBtnText: { fontSize: 18, color: "#fff" },
  noteTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  noteMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  listenedBadge: { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600", marginTop: 2 },
  newBadge: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700", marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 20 },
  empty: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", paddingVertical: 20 },
});
