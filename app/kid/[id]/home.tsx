import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Animated, Alert, ScrollView, Platform, useWindowDimensions } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { aggregateWebUsage, aggregateAppUsage, aggregateFeatureTaps, daysAgoDate } from "../../../lib/usage-tracker";

const GRID_H_PAD = 16;
const GRID_GAP   = 10;
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useAudioPlayer, createAudioPlayer, useAudioRecorder, RecordingPresets } from "expo-audio";
import { useKid, useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Mascot } from "../../../components/mascot";
import { AnimatedFeatureCard, FeatureDef } from "../../../components/animated-feature-card";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS, FEATURE_LABELS } from "../../../lib/data/types";
import { socialBadgeCount, chatUnreadCount, kidNotificationBadges } from "../../../lib/data/badges";
import { uploadMedia } from "../../../lib/media-upload";
import type { FunnySoundMessage, SosAlert, VoiceNote } from "../../../lib/data/types";
import { getRemainingMinutes, getUsagePct, getBankBalance, isLocked, isInBedtimeSoftLock, formatMinutes } from "../../../lib/data/logic";
import { FUNNY_PRESETS } from "../../../lib/funny-sounds";
import { useColors } from "../../../hooks/use-colors";
import { uid, nowIso } from "../../../lib/utils";

// These features are NEVER locked — always accessible to kids
// communicate is included so kids can ALWAYS reach parents even during lockdown
const ALWAYS_OPEN = new Set(["chores", "help", "important-info", "incident", "contacts", "communicate", "checkin"]);

// ─── Funny Sound Popup ────────────────────────────────────────────────────────

function FunnySoundPopup({ msg, onDismiss }: { msg: FunnySoundMessage; onDismiss: () => void }) {
  const bounce = useRef(new Animated.Value(0)).current;
  const preset = msg.presetId ? FUNNY_PRESETS.find(p => p.id === msg.presetId) : null;
  const player = useAudioPlayer(msg.soundUri ?? "");

  useEffect(() => {
    // Bounce-in animation
    Animated.spring(bounce, { toValue: 1, damping: 10, stiffness: 180, useNativeDriver: true }).start();
    // Play sound
    if (preset) {
      Speech.speak(preset.text, { pitch: preset.pitch, rate: preset.rate });
    } else if (msg.soundUri) {
      player.play();
    }
    return () => {
      Speech.stop();
      try { player.pause(); } catch {}
    };
  }, []);

  const cardBg = preset?.color ?? "#FFF3DC";
  const icon = preset?.emoji ?? (msg.soundUri ? "🎙️" : msg.videoUri ? "🎬" : "🎵");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={popupS.overlay}>
        <Animated.View style={[popupS.card, { backgroundColor: cardBg, transform: [{ scale: bounce }] }]}>
          {/* Burst emoji row */}
          <Text style={popupS.burst}>✨🎉✨</Text>
          <Text style={popupS.icon}>{icon}</Text>
          <Text style={popupS.from}>📬 Message from {msg.fromName}!</Text>
          {preset && (
            <View style={popupS.voiceTag}>
              <Text style={popupS.voiceTagText}>{preset.emoji} {preset.label} voice</Text>
            </View>
          )}
          {msg.message ? (
            <Text style={popupS.caption}>"{msg.message}"</Text>
          ) : null}
          {/* Replay button for presets */}
          {preset && (
            <TouchableOpacity
              style={popupS.replayBtn}
              onPress={() => Speech.speak(preset.text, { pitch: preset.pitch, rate: preset.rate })}
            >
              <Text style={popupS.replayText}>🔁 Play Again</Text>
            </TouchableOpacity>
          )}
          {msg.soundUri && (
            <TouchableOpacity
              style={popupS.replayBtn}
              onPress={() => { player.seekTo(0); player.play(); }}
            >
              <Text style={popupS.replayText}>🔁 Play Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={popupS.dismissBtn} onPress={onDismiss}>
            <Text style={popupS.dismissText}>Got it! 😂</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Voice Notes Modal ────────────────────────────────────────────────────────

function VoiceNotesModal({
  notes,
  kidId,
  visible,
  onClose,
  dispatch,
}: {
  notes: VoiceNote[];
  kidId: string;
  visible: boolean;
  onClose: () => void;
  dispatch: (a: any) => void;
}) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  function stopCurrent() {
    if (playerRef.current) {
      try { playerRef.current.pause(); playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
    setPlayingId(null);
  }

  function toggleNote(note: VoiceNote) {
    if (playingId === note.id) { stopCurrent(); return; }
    stopCurrent();
    try {
      const p = createAudioPlayer(note.uri);
      p.play();
      playerRef.current = p;
      setPlayingId(note.id);
    } catch { Alert.alert("Playback Error", "Could not play this message."); }
    // Mark as listened
    if (!note.listenedAt) {
      dispatch({ type: "VOICE_NOTE_LISTENED", kidId, noteId: note.id });
    }
  }

  function handleClose() {
    stopCurrent();
    onClose();
  }

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={vmStyles.overlay}>
        <View style={vmStyles.sheet}>
          <View style={vmStyles.handle} />
          <Text style={vmStyles.title}>🎙️ Messages from Parent</Text>
          <Text style={vmStyles.subtitle}>{notes.length} voice message{notes.length !== 1 ? "s" : ""} for you</Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            {notes.map(note => {
              const isPlaying = playingId === note.id;
              const date = new Date(note.createdAt).toLocaleString("en-AU", {
                day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
              });
              return (
                <TouchableOpacity
                  key={note.id}
                  style={[vmStyles.noteRow, isPlaying && vmStyles.noteRowActive]}
                  onPress={() => toggleNote(note)}
                  activeOpacity={0.8}
                >
                  <View style={[vmStyles.playBtn, isPlaying && vmStyles.playBtnActive]}>
                    <Text style={vmStyles.playBtnText}>{isPlaying ? "⏸" : "▶"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={vmStyles.noteTitle} numberOfLines={1}>{note.title || "Voice message"}</Text>
                    <Text style={vmStyles.noteMeta}>From {note.from} · {fmtSecs(note.durationSecs)} · {date}</Text>
                  </View>
                  {note.listenedAt ? (
                    <Text style={vmStyles.listenedIcon}>✅</Text>
                  ) : (
                    <View style={vmStyles.newDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={vmStyles.closeBtn} onPress={handleClose}>
            <Text style={vmStyles.closeBtnText}>Close 👍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Category color palettes — rich, modern, distinct per category
const C = {
  ai:       { bg: "#9B72F8", shadow: "#5B21B6" }, // vivid violet — AI & smart
  creative: { bg: "#F472B6", shadow: "#BE185D" }, // hot pink     — art & creative
  learning: { bg: "#38BDF8", shadow: "#0369A1" }, // sky blue     — school & learn
  rewards:  { bg: "#FBBF24", shadow: "#B45309" }, // amber        — rewards & goals
  tools:    { bg: "#34D399", shadow: "#065F46" }, // emerald      — apps & tools
  family:   { bg: "#4ADE80", shadow: "#166534" }, // green        — family & social
  safety:   { bg: "#EF4444", shadow: "#991B1B" }, // red          — safety & emergency
  misc:     { bg: "#94A3B8", shadow: "#334155" }, // slate        — misc
};

const FEATURES: FeatureDef[] = [
  // Row 1 — AI & Buddy (featured, pulse)
  { id: "buddy",         emoji: "✨", label: "AI Buddy",       ...C.ai,       pulse: true  },
  { id: "stories",       emoji: "🌙", label: "Bedtime Stories",...C.ai                     },
  { id: "sounds",        emoji: "🎶", label: "Sleep Sounds",   ...C.ai                     },
  { id: "advice",        emoji: "💬", label: "Parent Advice",  ...C.ai                     },
  { id: "voice-changer", emoji: "🎙️", label: "Voice Changer",  ...C.ai                     },

  // Row 2 — Creative
  { id: "create",      emoji: "🎨", label: "Create",         ...C.creative, pulse: true  },
  { id: "journal",     emoji: "📓", label: "My Journal/Books",...C.creative              },
  { id: "ideas",        emoji: "🪄", label: "Ideas / Discoveries", ...C.creative          },

  // Row 3 — Learning
  { id: "school",        emoji: "🏫", label: "School",         ...C.learning              },
  { id: "browser",       emoji: "🌐", label: "Safe Browser",   ...C.learning              },
  { id: "calculator",    emoji: "🧮", label: "Calculator",     ...C.learning              },
  { id: "reading-list",  emoji: "📚", label: "Books I Read",   ...C.learning              },

  // Health
  { id: "fitness",     emoji: "🏃", label: "Fitness & Meals",...C.tools,    pulse: true  },

  // Row 4 — Rewards & Chores
  { id: "rewards",     emoji: "🏆", label: "Rewards",        ...C.rewards,  pulse: true  },
  { id: "chores",      emoji: "🧹", label: "Chores/Earn It", ...C.rewards               },
  { id: "wishes",      emoji: "🌟", label: "Wish List",      ...C.rewards               },
  { id: "money",       emoji: "🪙", label: "Piggy Bank",     ...C.rewards               },

  // Row 5 — Apps & Tools
  { id: "apps",        emoji: "📲", label: "My Apps",        ...C.tools                 },
  { id: "alarms",      emoji: "⏰", label: "Alarms & Timer", ...C.tools                 },
  { id: "vault",       emoji: "🔐", label: "Passwords",      ...C.tools                 },
  { id: "contacts",    emoji: "📇", label: "Contacts",       ...C.tools                 },

  // Row 6 — Family & Social
  { id: "communicate",    emoji: "💬", label: "Call & Chat",    ...C.family,   pulse: true  },
  { id: "album",          emoji: "📸", label: "Memories",       ...C.family                },

  // Personal
  { id: "favorites",      emoji: "❤️", label: "My Favorites",     ...C.rewards               },
  { id: "gadgets",        emoji: "🏆", label: "My Cool Things",   ...C.creative              },
  { id: "achievements",   emoji: "🏅", label: "Achievements",     ...C.rewards,  pulse: true },

  // Feelings & Growth
  { id: "apology",      emoji: "💌", label: "Heart to Heart",   ...C.family              },
  { id: "quiz",         emoji: "📝", label: "My Quiz",          ...C.learning            },
  { id: "wellbeing",    emoji: "💙", label: "How I Feel",       ...C.family              },
  { id: "family-vote",  emoji: "🎬", label: "Family Vote",      ...C.family, pulse: true },
  { id: "social",       emoji: "📱", label: "Family Social",    ...C.family, pulse: true },
  { id: "game-night",   emoji: "🎮", label: "Game Night",       ...C.family, pulse: true },

  // Safety
  { id: "find-phone",     emoji: "📱", label: "Find a Phone",   ...C.safety,  pulse: true  },
  { id: "incident",       emoji: "⚠️", label: "Report Incident",...C.safety,  pulse: true  },
  { id: "important-info", emoji: "ℹ️", label: "Important Info",  ...C.safety               },
  { id: "checkin",        emoji: "📍", label: "Check In",        ...C.safety,  pulse: true  },

  // New features
  { id: "morning-routine",  emoji: "🌅", label: "Morning Routine",   ...C.tools,   pulse: true },
  { id: "borrow-time",      emoji: "⏱️", label: "Borrow Time",       ...C.tools               },
  { id: "family-calendar",  emoji: "📅", label: "Family Calendar",   ...C.family              },
  { id: "trophy-room",      emoji: "🏆", label: "Trophy Room",       ...C.rewards, pulse: true },
  { id: "mood",             emoji: "😊", label: "Mood Check-in",     ...C.family,  pulse: true },
  { id: "request",          emoji: "📩", label: "Ask a Parent",      ...C.tools,   pulse: true },
  { id: "homework-helper",  emoji: "📚", label: "Homework Helper",   ...C.learning            },
  { id: "my-reports",       emoji: "📊", label: "My Reports",        ...C.tools               },
  { id: "family-movies",    emoji: "🎬", label: "Movies & Shows",    ...C.learning            },
  { id: "family-music",     emoji: "🎵", label: "Family Music",      ...C.learning            },
  { id: "family-books",     emoji: "📖", label: "Books & Reading",   ...C.learning            },

  // Misc
  { id: "help",           emoji: "❓", label: "Help & Privacy",  ...C.misc                 },
];

// Category section headers for grouping. Like the parent dashboard, EVERY
// feature lives in a purpose-based bucket — no "misc / new" catch-all — so the
// grid reads as a clean, predictable set of categories.
const SECTIONS = [
  { label: "🎨 Create & Express", ids: ["create","journal","ideas","gadgets","favorites"] },
  { label: "📚 School & Learn",   ids: ["school","homework-helper","browser","calculator","reading-list","quiz","family-books","family-movies","family-music"] },
  { label: "🏆 Rewards & Goals",  ids: ["rewards","chores","morning-routine","borrow-time","money","wishes","achievements","trophy-room","fitness"] },
  { label: "💬 Family & Friends", ids: ["communicate","contacts","album","game-night","family-vote","social","family-calendar","mood","wellbeing","apology","request"] },
  { label: "✨ Smart & AI",       ids: ["buddy","stories","sounds","advice","voice-changer"] },
  { label: "⚡ Apps & Tools",     ids: ["apps","alarms","vault","my-reports"] },
  { label: "🚨 Safety & Help",    ids: ["find-phone","checkin","incident","important-info","help"] },
];

const featureMap = Object.fromEntries(FEATURES.map(f => [f.id, f]));

// Bedtime-allowed feature ids
const BEDTIME_ALLOWED = ["stories", "sounds"];

// ─── Most Used mini-component ─────────────────────────────────────────────────
function MostUsed({ kid, onPress }: { kid: any; onPress: (featureId: string) => void }) {
  const since = daysAgoDate(7);

  const topFeatures = useMemo(() => {
    const taps = aggregateFeatureTaps(kid.usage ?? [], since);
    return taps.slice(0, 3);
  }, [kid.usage]);

  const topSites = useMemo(() => {
    const sites = aggregateWebUsage(kid.usage ?? [], since);
    return sites.slice(0, 3);
  }, [kid.usage]);

  if (topFeatures.length === 0 && topSites.length === 0) return null;

  return (
    <View style={muS.container}>
      <Text style={muS.title}>⚡ Most Used This Week</Text>

      {topFeatures.length > 0 && (
        <>
          <Text style={muS.sub}>Top Features</Text>
          <View style={muS.row}>
            {topFeatures.map(feat => (
              <TouchableOpacity
                key={feat.featureId}
                style={muS.chip}
                onPress={() => onPress(feat.featureId)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 22 }}>{feat.featureEmoji}</Text>
                <Text style={muS.chipLabel} numberOfLines={1}>{feat.featureName}</Text>
                <Text style={muS.chipCount}>{feat.count}×</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {topSites.length > 0 && (
        <>
          <Text style={muS.sub}>Top Websites</Text>
          <View style={muS.row}>
            {topSites.map(site => (
              <View key={site.domain} style={[muS.chip, { backgroundColor: "#E0F2FE" }]}>
                <Text style={{ fontSize: 22 }}>🌐</Text>
                <Text style={muS.chipLabel} numberOfLines={1}>{site.title || site.domain}</Text>
                <Text style={muS.chipCount}>{site.visits}x</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const muS = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceLight, borderRadius: 18,
    padding: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  title: { fontSize: 13, fontWeight: "800", color: Colors.primary, marginBottom: 6 },
  sub: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.primary + "15",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
    maxWidth: "47%",
  },
  chipLabel: { flex: 1, fontSize: 12, fontWeight: "700", color: Colors.textPrimary },
  chipCount: { fontSize: 11, fontWeight: "800", color: Colors.primary },
});

export default function KidHome() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const { state, dispatch } = useData();
  const router = useRouter();
  const theme = useColors();
  const { width: screenW } = useWindowDimensions();
  const numCols = screenW >= 1100 ? 6 : screenW >= 840 ? 5 : screenW >= 580 ? 4 : 3;
  const CARD_W  = Math.floor((screenW - GRID_H_PAD * 2 - GRID_GAP * (numCols - 1)) / numCols);
  const [lockedFeature, setLockedFeature] = useState<{ id: string; label: string; unlockMsg?: string } | null>(null);
  const [pendingSound, setPendingSound] = useState<FunnySoundMessage | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [tick, setTick] = useState(0);
  const [sosLoading, setSosLoading] = useState(false);
  const [search, setSearch] = useState("");
  // #7 Smart bedtime dimming
  const dimAnim = useRef(new Animated.Value(0)).current;
  // #9 Snapshot ref
  const screenRef = useRef<View>(null);

  // Re-render every 60 s so countdown updates
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── #1 Screen-time notifications (80 % / 100 %) ─────────────────────────────
  const notifSentRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!kid || kid.rules.freeMode) return;
    const pctNow = getUsagePct(kid);
    const key80  = `${id}_80_${new Date().toISOString().split("T")[0]}`;
    const key100 = `${id}_100_${new Date().toISOString().split("T")[0]}`;
    if (pctNow >= 0.8 && !notifSentRef.current.has(key80)) {
      notifSentRef.current.add(key80);
      Notifications.scheduleNotificationAsync({
        content: { title: "⏱️ 80% of screen time used", body: `${kid.profile.name} has used 80% of today's screen time.`, sound: true },
        trigger: null,
      }).catch(() => {});
    }
    if (pctNow >= 1.0 && !notifSentRef.current.has(key100)) {
      notifSentRef.current.add(key100);
      Notifications.scheduleNotificationAsync({
        content: { title: "🔴 Screen time limit reached!", body: `${kid.profile.name} has used all of today's screen time.`, sound: true },
        trigger: null,
      }).catch(() => {});
    }
  }, [tick, kid?.usage]);

  // ── Location capture + geofence — runs ALWAYS (not only when safe zones
  //    exist) so the parent always has the kid's last location. ───────────────
  useEffect(() => {
    if (!kid) return;
    let cancelled = false;
    async function capture() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        // This LOCATION_UPDATE syncs to the parent device so 📍 Location shows it.
        dispatch({ type: "LOCATION_UPDATE", kidId: id, location: { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? undefined, timestamp: new Date().toISOString() } });
        // Geofence checks only if zones exist.
        for (const zone of (kid!.safeZones ?? [])) {
          const dlat = loc.coords.latitude  - zone.lat;
          const dlng = loc.coords.longitude - zone.lng;
          const distM = Math.sqrt(dlat * dlat + dlng * dlng) * 111_000;
          if (distM > zone.radiusMeters) {
            await Notifications.scheduleNotificationAsync({
              content: { title: `📍 ${kid!.profile.name} left ${zone.name ?? "safe zone"}`, body: `Your child may be outside the expected area. Distance: ~${Math.round(distM)}m`, sound: true },
              trigger: null,
            }).catch(() => {});
          }
        }
      } catch {}
    }
    capture();
    const interval = setInterval(capture, 2 * 60_000); // every 2 minutes
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Report THIS device's installed apps to the parent ───────────────────────
  // The kid device enumerates its own apps and syncs them up so the parent's App
  // Manager can allow/limit them. (Previously the parent listed its OWN apps,
  // which was the wrong device.)
  useEffect(() => {
    if (!kid) return;
    let cancelled = false;
    async function reportApps() {
      try {
        const mod = require("../../../modules/expo-usage-stats/src");
        const UsageStats = mod.UsageStats ?? mod.default?.UsageStats;
        if (!UsageStats?.getInstalledApps) return;
        const apps = await UsageStats.getInstalledApps();
        if (cancelled || !Array.isArray(apps) || apps.length === 0) return;
        dispatch({ type: "SYNC_INSTALLED_APPS", kidId: id, apps });
      } catch {}
    }
    reportApps();
    const interval = setInterval(reportApps, 10 * 60_000); // refresh every 10 min
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── #7 Smart bedtime dimming — starts 15 min before bedtime ─────────────────
  useEffect(() => {
    if (!kid || kid.rules.freeMode) return;
    const cfg = kid.rules.screenTimeSchedule;
    if (!cfg.bedtimeEnabled) return;
    const now = new Date();
    const [bh, bm] = cfg.bedtimeStart.split(":").map(Number);
    const bedtimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bh, bm).getTime();
    const diffMin = (bedtimeMs - now.getTime()) / 60_000;
    if (diffMin > 0 && diffMin <= 15) {
      const dimVal = Math.min(0.6, (15 - diffMin) / 15 * 0.6);
      Animated.timing(dimAnim, { toValue: dimVal, duration: 2000, useNativeDriver: true }).start();
    } else {
      dimAnim.setValue(0);
    }
  }, [tick]);

  // ── Ambient listen — parent-requested voice check-in (DISCLOSED) ─────────────
  // Google Play policy and basic trust require the child to know they're being
  // recorded. We show a visible banner on screen AND fire a notification for the
  // full duration so the child is always aware. The parent-side label says
  // "voice check-in" not "silent recording."
  const ambientRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isAmbientRecording, setIsAmbientRecording] = useState(false);
  useEffect(() => {
    const req = kid?.ambientListenRequest;
    if (!req || req.fulfilled) return;
    let cancelled = false;
    (async () => {
      try {
        // Notify the child visibly before the mic opens.
        setIsAmbientRecording(true);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🎙️ Voice check-in",
            body: "Your parent requested a 30-second voice check-in. Your microphone is on.",
            sound: true,
          },
          trigger: null, // fire immediately
        });
        await ambientRecorder.prepareToRecordAsync();
        ambientRecorder.record();
        const secs = req.durationSecs ?? 30;
        await new Promise(r => setTimeout(r, secs * 1000));
        if (cancelled) return;
        await ambientRecorder.stop();
        const uri2 = ambientRecorder.uri;
        if (uri2) {
          // Upload so the parent's device can play it (needs the storage bucket).
          const sharedUri = (await uploadMedia(uri2, { folder: "ambient" })) ?? uri2;
          dispatch({ type: "AMBIENT_RECORDING_ADD", kidId: id, recording: {
            id: uid(), uri: sharedUri, durationSecs: secs,
            requestedAt: req.requestedAt, recordedAt: nowIso(),
          }});
        }
      } catch {}
      finally { if (!cancelled) setIsAmbientRecording(false); }
    })();
    return () => { cancelled = true; setIsAmbientRecording(false); };
  }, [kid?.ambientListenRequest?.requestedAt]);

  // ── #9 Snapshot capture ───────────────────────────────────────────────────────
  async function takeSnapshot() {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Allow media access to save snapshots."); return; }
      if (!screenRef.current) return;
      const uri = await captureRef(screenRef, { format: "png", quality: 0.85 });
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("📸 Snapshot saved!", "Saved to your photo library.");
    } catch { Alert.alert("Oops!", "Could not take snapshot."); }
  }

  // Show funny sound popup when kid opens home
  useEffect(() => {
    if (!kid) return;
    const next = kid.funnySounds.find(m => !m.played);
    if (next) setPendingSound(next);
  }, [kid?.funnySounds?.length]);

  useEffect(() => {
    if (kid && isLocked(kid) && !kid.rules.freeMode) {
      router.replace(`/lock?id=${id}`);
    }
  }, [kid]);

  // SOS handler — get location (with timeout) then dispatch alert + local notification
  const sendSos = useCallback(async () => {
    if (!kid || sosLoading) return;
    Alert.alert("🚨 Send SOS?", "This will alert your parents immediately with your location.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send SOS", style: "destructive", onPress: async () => {
          setSosLoading(true);
          let lat: number | undefined, lng: number | undefined;

          // Try to get location with a 5-second hard timeout
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === "granted") {
              const locPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 5000)
              );
              const loc = await Promise.race([locPromise, timeoutPromise]) as Awaited<typeof locPromise>;
              lat = loc.coords.latitude;
              lng = loc.coords.longitude;
            }
          } catch {
            // Location unavailable or timed out — SOS still sends without coordinates
          }

          const sosAlert: SosAlert = {
            id: uid(), kidId: id, kidName: kid.profile.name,
            lat, lng, timestamp: nowIso(), acknowledged: false,
          };
          // Only dispatch the alert — it syncs to the PARENT device, which raises
          // the loud SOS alarm + notification. The sender (kid) gets NO push for
          // their own alert; just a quiet on-screen confirmation.
          dispatch({ type: "SOS_ALERT", alert: sosAlert });
          // Push so a closed parent app still gets the SOS immediately.
          try {
            const { sendPush } = require("../../../lib/push");
            sendPush({ targetRole: "parent" }, `🚨 SOS from ${kid.profile.name}!`, lat ? `Location: ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : "Check on your child now!", { kind: "sos", kidId: id });
          } catch {}

          setSosLoading(false);
          Alert.alert("✅ SOS Sent!", "Your parents have been notified and are on their way.");
        },
      },
    ]);
  }, [kid, id, sosLoading]);

  // Check-in response handler
  const respondCheckIn = useCallback(async (requestId: string, status: "safe" | "help_needed") => {
    let lat: number | undefined, lng: number | undefined;
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm === "granted") {
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((_, r) => setTimeout(() => r(new Error("timeout")), 4000)),
        ]) as any;
        lat = loc?.coords?.latitude;
        lng = loc?.coords?.longitude;
      }
    } catch {}
    dispatch({ type: "CHECK_IN_RESPOND", kidId: id, requestId, status, lat, lng });
  }, [id]);

  // Pending check-in (sent within last 15 minutes, not yet responded)
  const pendingCheckIn = (kid?.checkInRequests ?? []).find(r =>
    r.status === "pending" &&
    Date.now() - new Date(r.requestedAt).getTime() < 15 * 60_000
  );

  if (!kid) return null;

  // Return null immediately if the lock redirect is about to fire — prevents
  // the bedtime UI from flashing for one frame before navigating to /lock.
  if (isLocked(kid) && !kid.rules.freeMode) return null;

  const remaining = getRemainingMinutes(kid);
  const pct = getUsagePct(kid);
  const banked = getBankBalance(kid.bank);
  const streak = kid.streak?.currentDays ?? 0;
  const bg = PASTEL_COLORS[kid.profile.color];
  const bedtime = isInBedtimeSoftLock(kid);

  // ── #2 Bedtime 10-min grace warning ──────────────────────────────────────
  const isBedtimeSoon = !bedtime && !kid.rules.freeMode && (() => {
    const cfg = kid.rules.screenTimeSchedule;
    if (!cfg?.bedtimeEnabled) return false;
    const now = new Date();
    const parts = cfg.bedtimeStart?.split(":").map(Number);
    if (!parts || parts.length < 2) return false;
    const [bh, bm] = parts;
    const bedtimeMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bh, bm).getTime();
    const diffMin = (bedtimeMs - now.getTime()) / 60_000;
    return diffMin > 0 && diffMin <= 10;
  })();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── Bedtime mode — restricted home (skipped in free mode) ──────────────────
  if (bedtime && !kid.rules.freeMode) {
    const cfg = kid.rules.bedtimeSoftLock;
    const bedtimeFeatures = BEDTIME_ALLOWED.map(fid => featureMap[fid]).filter(Boolean);
    return (
      <ScreenContainer scroll bg="#0F0B2A">
        {/* Stars header */}
        <View style={styles.bedtimeHeader}>
          <Text style={styles.bedtimeStars}>✨ 🌙 ✨</Text>
          <Text style={styles.bedtimeName}>Night time, {kid.profile.name}</Text>
          <Text style={styles.bedtimeMsg}>{cfg?.message ?? "Time to wind down and get ready for sleep."}</Text>
        </View>

        {/* Mascot sleeping */}
        <View style={styles.bedtimeMascot}>
          <Mascot type={kid.profile.mascot} size={100} animate />
        </View>

        {/* Allowed features */}
        <Text style={styles.bedtimeAllowedLabel}>Available now:</Text>
        <View style={styles.bedtimeGrid}>
          {bedtimeFeatures.map((feature, idx) => (
            <AnimatedFeatureCard
              key={feature.id}
              feature={feature}
              index={idx}
              size="lg"
              onPress={() => router.push(`/kid/${id}/(more)/${feature.id}` as any)}
            />
          ))}
        </View>

        {/* Always-available: call & chat with family */}
        <TouchableOpacity
          style={styles.bedtimeCallBtn}
          onPress={() => router.push(`/kid/${id}/(more)/communicate` as any)}
        >
          <Text style={styles.bedtimeCallEmoji}>📞</Text>
          <View>
            <Text style={styles.bedtimeCallLabel}>Call or Text Family</Text>
            <Text style={styles.bedtimeCallSub}>Always available — even at night</Text>
          </View>
        </TouchableOpacity>

        {/* Locked message */}
        <View style={styles.bedtimeLock}>
          <Text style={styles.bedtimeLockIcon}>🔒</Text>
          <Text style={styles.bedtimeLockText}>
            Everything else is locked until morning.{"\n"}Sweet dreams! 🌟
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // ── Normal home ─────────────────────────────────────────────────────────────
  let cardIndex = 0;

  // Feature search: a query shows one flat grid of matching tiles instead of the
  // grouped sections (e.g. "ga" → Game Night). Matches the label or the id.
  const q = search.trim().toLowerCase();
  const searchResults: FeatureDef[] = q
    ? FEATURES.filter(f => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
    : [];

  // Unread badges per feature button: social activity, chat, and any kid
  // notifications (chore approved, story, advice, etc.) mapped to their feature.
  const featureBadges: Record<string, number> = (() => {
    const map: Record<string, number> = { ...kidNotificationBadges(kid.notifications ?? []) };
    const social = socialBadgeCount(state, id);
    if (social > 0) map.social = (map.social ?? 0) + social;
    const chat = chatUnreadCount(state, id);
    if (chat > 0) map.communicate = (map.communicate ?? 0) + chat;
    return map;
  })();

  const renderTile = (feature: FeatureDef) => {
    const idx = cardIndex++;
    const badge = featureBadges[feature.id];
    const isFeatureLocked = !kid.rules.freeMode &&
      !ALWAYS_OPEN.has(feature.id) &&
      (kid.rules.lockedFeatures ?? []).includes(feature.id);
    const linkedChore = isFeatureLocked
      ? kid.chores.find(c => c.status === "open" && c.unlocksFeatures?.includes(feature.id))
      : undefined;
    return (
      <View key={feature.id} style={{ position: "relative" }}>
        <AnimatedFeatureCard
          feature={isFeatureLocked
            ? { ...feature, bg: "#9CA3AF", shadow: "#374151", pulse: false }
            : feature}
          index={idx}
          width={CARD_W}
          badge={badge}
          onPress={() => {
            if (isFeatureLocked) {
              setLockedFeature({
                id: feature.id,
                label: feature.label,
                unlockMsg: linkedChore?.unlockMessage ?? linkedChore?.title,
              });
            } else {
              // Opening a feature clears its notification badge.
              if (badge) dispatch({ type: "NOTIFICATIONS_MARK_FEATURE_READ", kidId: id, feature: feature.id });
              router.push(`/kid/${id}/(more)/${feature.id}` as any);
            }
          }}
        />
        {isFeatureLocked && (
          <View style={styles.lockOverlay} pointerEvents="none">
            <Text style={styles.lockOverlayIcon}>🔒</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
    <ScreenContainer scroll bg={bg}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.textSub }]}>{greeting},</Text>
          <Text style={[styles.name, { color: theme.text }]}>{kid.profile.name}! 👋</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* #9 Snapshot button */}
          <TouchableOpacity onPress={takeSnapshot} style={styles.snapBtn} activeOpacity={0.7} accessibilityLabel="Take screenshot">
            <Text style={{ fontSize: 18 }}>📸</Text>
          </TouchableOpacity>
          <Mascot type={kid.profile.mascot} size={72} animate />
        </View>
      </View>

      {/* ── Ambient recording disclosure banner ── */}
      {isAmbientRecording && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.recordingTitle}>🎙️ Voice check-in active</Text>
            <Text style={styles.recordingSub}>Your parent requested a quick voice check-in. Microphone is on for 30 seconds.</Text>
          </View>
        </View>
      )}

      {/* ── Check-in Request Banner ── */}
      {pendingCheckIn && (
        <View style={styles.checkInCard}>
          <Text style={styles.checkInTitle}>👋 Your parent wants to check in!</Text>
          <Text style={styles.checkInSub}>Tap to let them know you're OK</Text>
          <View style={styles.checkInBtns}>
            <TouchableOpacity
              style={[styles.checkInBtn, { backgroundColor: Colors.success }]}
              onPress={() => respondCheckIn(pendingCheckIn.id, "safe")}
            >
              <Text style={styles.checkInBtnText}>👍 I'm Safe!</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.checkInBtn, { backgroundColor: Colors.error }]}
              onPress={() => respondCheckIn(pendingCheckIn.id, "help_needed")}
            >
              <Text style={styles.checkInBtnText}>🆘 Need Help</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Free Mode Banner */}
      {kid.rules.freeMode && (
        <View style={styles.freeModeBanner}>
          <Text style={styles.freeModeBannerText}>🔓 Free Mode — enjoy everything!</Text>
        </View>
      )}

      {/* Study Mode Break Banner */}
      {kid.rules.studyMode && !kid.rules.freeMode &&
       kid.rules.studyModeBreakUntil && new Date(kid.rules.studyModeBreakUntil) > new Date() && (
        <View style={[styles.studyBanner, { backgroundColor: "#10B981" }]}>
          <Text style={styles.studyBannerText}>
            🏃 Break time! {Math.ceil((new Date(kid.rules.studyModeBreakUntil).getTime() - Date.now()) / 60_000)} min left
          </Text>
        </View>
      )}

      {/* Study Mode Banner (hidden during break) */}
      {kid.rules.studyMode && !kid.rules.freeMode &&
       !(kid.rules.studyModeBreakUntil && new Date(kid.rules.studyModeBreakUntil) > new Date()) && (
        <View style={styles.studyBanner}>
          <Text style={styles.studyBannerText}>📚 Study Mode — games & entertainment are paused</Text>
        </View>
      )}

      {/* #2 Bedtime 10-min grace warning */}
      {isBedtimeSoon && (
        <View style={styles.bedtimeSoonBanner}>
          <Text style={styles.bedtimeSoonText}>🌙 Bedtime in ~10 minutes — start wrapping up!</Text>
        </View>
      )}

      {/* Streak badge */}
      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>🔥 {streak}-day streak!</Text>
          {(kid.streak?.longestDays ?? 0) > 0 && (
            <Text style={styles.streakBest}>Best: {kid.streak!.longestDays} days</Text>
          )}
        </View>
      )}

      {/* Time Card */}
      <View style={[styles.timeCard, { backgroundColor: theme.surface }]}>
        <View style={styles.timeInfo}>
          {kid.rules.freeMode ? (
            <>
              <Text style={styles.timeLeft}>∞</Text>
              <Text style={styles.timeLabel}>no limit today</Text>
            </>
          ) : (
            <>
              <Text style={styles.timeLeft}>{formatMinutes(remaining)}</Text>
              <Text style={styles.timeLabel}>left today</Text>
            </>
          )}
          {banked > 0 && (
            <View style={styles.bankPill}>
              <Text style={styles.bankText}>+{formatMinutes(banked)} banked ⭐</Text>
            </View>
          )}
        </View>
        <View style={styles.ring}>
          <View style={[styles.ringBg]} />
          <View style={[styles.ringFill, {
            borderColor: pct > 0.8 ? Colors.error : pct > 0.6 ? Colors.warning : Colors.success,
            opacity: Math.max(0.15, 1 - pct),
          }]} />
          <Text style={styles.ringPct}>{Math.round((1 - pct) * 100)}%</Text>
        </View>
      </View>

      {/* Notifications */}
      {kid.notifications.filter(n => !n.read).length > 0 && (
        <TouchableOpacity style={styles.notifBanner}>
          <Text style={styles.notifText}>
            🔔 {kid.notifications.filter(n => !n.read).length} new notification{kid.notifications.filter(n => !n.read).length > 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}

      {/* Voice Notes Banner */}
      {(() => {
        const voiceNotes = kid.voiceNotes ?? [];
        const unlistened = voiceNotes.filter(n => !n.listenedAt);
        if (voiceNotes.length === 0) return null;
        return (
          <TouchableOpacity
            style={[styles.voiceBanner, unlistened.length > 0 && styles.voiceBannerNew]}
            onPress={() => setShowVoiceModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.voiceBannerEmoji}>🎙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceBannerTitle}>
                {unlistened.length > 0
                  ? `${unlistened.length} new voice message${unlistened.length !== 1 ? "s" : ""} from your parent!`
                  : `Voice messages from your parent`}
              </Text>
              <Text style={styles.voiceBannerSub}>Tap to listen 👂</Text>
            </View>
            {unlistened.length > 0 && (
              <View style={styles.voiceBannerDot}>
                <Text style={styles.voiceBannerDotText}>{unlistened.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })()}

      {/* SOS Panic Button */}
      <TouchableOpacity
        style={styles.sosBtn}
        onPress={sendSos}
        activeOpacity={0.8}
        disabled={sosLoading}
        accessibilityLabel={sosLoading ? "Sending SOS emergency alert" : "Send SOS emergency alert to parents"}
        accessibilityRole="button"
        accessibilityHint="Immediately notifies your parents with your location"
      >
        <Text style={styles.sosBtnText}>{sosLoading ? "Sending…" : "🚨 SOS Emergency"}</Text>
      </TouchableOpacity>

      {/* ── Most Used Section ── */}
      <MostUsed kid={kid} onPress={(featureId) => {
        const feat = featureMap[featureId];
        if (feat) router.push(`/kid/${kid.profile.id}/(more)/${featureId}`);
      }} />

      {/* Feature search */}
      <View style={[styles.searchWrap, { backgroundColor: theme.surface }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search… try 'ga' for Game Night"
          placeholderTextColor={theme.textSub}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.searchClear, { color: theme.textSub }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {q ? (
        /* Search results — one flat grid */
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🔍 {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</Text>
          {searchResults.length === 0 ? (
            <Text style={[styles.searchEmpty, { color: theme.textSub }]}>Nothing found — try fewer letters.</Text>
          ) : (
            <View style={styles.grid}>{searchResults.map(renderTile)}</View>
          )}
        </View>
      ) : (
        /* Feature Sections */
        SECTIONS.map(section => {
          const sectionFeatures = section.ids.map(fid => featureMap[fid]).filter(Boolean);
          if (sectionFeatures.length === 0) return null;
          return (
            <View key={section.label} style={styles.section}>
              <Text style={styles.sectionLabel}>{section.label}</Text>
              <View style={styles.grid}>
                {sectionFeatures.map(renderTile)}
              </View>
            </View>
          );
        })
      )}

      {/* Voice notes modal */}
      <VoiceNotesModal
        notes={kid.voiceNotes ?? []}
        kidId={id}
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        dispatch={dispatch}
      />

      {/* Funny sound popup */}
      {pendingSound && (
        <FunnySoundPopup
          msg={pendingSound}
          onDismiss={() => {
            dispatch({ type: "MARK_FUNNY_SOUND_PLAYED", kidId: id, msgId: pendingSound.id });
            setPendingSound(null);
          }}
        />
      )}

      {/* Locked feature modal */}
      <Modal
        visible={!!lockedFeature}
        transparent
        animationType="fade"
        onRequestClose={() => setLockedFeature(null)}
      >
        <View style={styles.lockedOverlay}>
          <View style={styles.lockedCard}>
            <Text style={styles.lockedCardIcon}>🔒</Text>
            <Text style={styles.lockedCardTitle}>{lockedFeature?.label} is Locked</Text>
            <Text style={styles.lockedCardMsg}>
              {lockedFeature?.unlockMsg
                ? `Complete "${lockedFeature.unlockMsg}" to unlock this!`
                : "Complete your chores to unlock this feature!"}
            </Text>
            <TouchableOpacity
              style={styles.goChoresBtn}
              onPress={() => {
                setLockedFeature(null);
                router.push(`/kid/${id}/(more)/chores` as any);
              }}
            >
              <Text style={styles.goChoresBtnText}>🔨 Go to My Chores</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeLockedBtn} onPress={() => setLockedFeature(null)}>
              <Text style={styles.closeLockedText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
    {/* #7 Smart bedtime dim overlay — ramps up 15 min before bedtime */}
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: dimAnim }]}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  freeModeBanner: {
    backgroundColor: "#D1FAE5", borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    alignSelf: "center", marginBottom: Spacing.sm,
  },
  freeModeBannerText: { fontSize: FontSize.sm, fontWeight: "700", color: "#065F46" },
  studyBanner: {
    backgroundColor: "#DBEAFE", borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    alignSelf: "center", marginBottom: Spacing.sm,
  },
  studyBannerText: { fontSize: FontSize.sm, fontWeight: "700", color: "#1E40AF" },
  streakRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: Spacing.sm },
  streakText: { fontSize: FontSize.base, fontWeight: "800", color: "#D97706" },
  streakBest: { fontSize: FontSize.xs, color: Colors.textSecondary },
  sosBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.full,
    paddingVertical: 14, marginVertical: Spacing.sm,
    alignItems: "center", ...Shadow.md,
  },
  sosBtnText: { color: "#fff", fontWeight: "900", fontSize: FontSize.base, letterSpacing: 0.5 },
  // Ambient recording disclosure — must be impossible to miss
  recordingBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.error, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 10,
  },
  recordingDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff",
    // Pulse is done via opacity animation; static here for APK compatibility
  },
  recordingTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },
  recordingSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.85)", marginTop: 2, lineHeight: 16 },

  checkInCard: {
    backgroundColor: Colors.primary + "12", borderRadius: 20, padding: 18,
    borderWidth: 2, borderColor: Colors.primary + "40", marginBottom: 12, gap: 8,
  },
  checkInTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary, textAlign: "center" },
  checkInSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  checkInBtns: { flexDirection: "row", gap: 10, marginTop: 6 },
  checkInBtn: { flex: 1, borderRadius: Radius.full, paddingVertical: 14, alignItems: "center" },
  checkInBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  greeting: { fontSize: FontSize.base, color: Colors.textSecondary },
  name: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  timeCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg,
    marginBottom: Spacing.md, ...Shadow.md,
  },
  timeInfo: { flex: 1 },
  timeLeft: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary },
  timeLabel: { fontSize: FontSize.base, color: Colors.textSecondary },
  bankPill: {
    marginTop: 6, backgroundColor: Colors.secondary + "30",
    borderRadius: Radius.full, alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 3,
  },
  bankText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  ring: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ringBg: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    borderWidth: 8, borderColor: Colors.border,
  },
  ringFill: {
    position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 8,
  },
  ringPct: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  notifBanner: {
    backgroundColor: Colors.primary + "20", borderRadius: Radius.md,
    padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  notifText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },
  voiceBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#E0E7FF", borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: "#C7D2FE",
  },
  voiceBannerNew: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary + "40" },
  voiceBannerEmoji: { fontSize: 26 },
  voiceBannerTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  voiceBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  voiceBannerDot: {
    backgroundColor: Colors.error, borderRadius: 12,
    minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  voiceBannerDotText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  section: { marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: Radius.xl, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: Spacing.md, ...Shadow.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: FontSize.base, paddingVertical: 10 },
  searchClear: { fontSize: 16, fontWeight: "800", paddingHorizontal: 4 },
  searchEmpty: { fontSize: FontSize.sm, fontStyle: "italic", paddingVertical: 8 },

  // Bedtime mode
  bedtimeHeader: { alignItems: "center", paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  bedtimeStars: { fontSize: 32, marginBottom: 8 },
  bedtimeName: { fontSize: FontSize.xl, fontWeight: "800", color: "#E2D5FF", textAlign: "center" },
  bedtimeMsg: { fontSize: FontSize.base, color: "#9B8FCC", textAlign: "center", marginTop: 8, lineHeight: 22, paddingHorizontal: 16 },
  bedtimeMascot: { alignItems: "center", marginVertical: Spacing.lg },
  bedtimeAllowedLabel: { fontSize: FontSize.xs, fontWeight: "700", color: "#9B8FCC", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  bedtimeGrid: { flexDirection: "row", gap: 16, marginBottom: Spacing.xl, justifyContent: "center" },
  bedtimeCallBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1E1560", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: "#7C5CFF60",
  },
  bedtimeCallEmoji:  { fontSize: 36 },
  bedtimeCallLabel:  { fontSize: FontSize.base, fontWeight: "800", color: "#E8E0FF" },
  bedtimeCallSub:    { fontSize: FontSize.xs, color: "#9B8FCC", marginTop: 2 },
  bedtimeLock: { alignItems: "center", backgroundColor: "#1A1040", borderRadius: Radius.xl, padding: Spacing.lg, gap: 8 },
  bedtimeLockIcon: { fontSize: 36 },
  bedtimeLockText: { fontSize: FontSize.sm, color: "#9B8FCC", textAlign: "center", lineHeight: 22 },

  // #2 Bedtime soon warning banner
  bedtimeSoonBanner: {
    backgroundColor: "#FEF3C7", borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    alignSelf: "center", marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: "#FCD34D",
  },
  bedtimeSoonText: { fontSize: FontSize.sm, fontWeight: "700", color: "#92400E" },

  // #9 Snapshot button
  snapBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },

  // Feature lock overlay
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 24, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  lockOverlayIcon: { fontSize: 22 },

  // Locked feature modal
  lockedOverlay: { flex: 1, backgroundColor: "#00000070", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  lockedCard: {
    backgroundColor: Colors.bgLight, borderRadius: 24, padding: Spacing.xl,
    alignItems: "center", gap: 12, width: "100%", maxWidth: 340, ...Shadow.md,
  },
  lockedCardIcon: { fontSize: 52 },
  lockedCardTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  lockedCardMsg: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  goChoresBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 13, width: "100%", alignItems: "center",
  },
  goChoresBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  closeLockedBtn: { padding: Spacing.sm },
  closeLockedText: { color: Colors.textMuted, fontWeight: "600", fontSize: FontSize.sm, textDecorationLine: "underline" },
});

const popupS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000080", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  card: {
    borderRadius: 28, padding: Spacing.xl, alignItems: "center", gap: 10,
    width: "100%", maxWidth: 340,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  burst: { fontSize: 24 },
  icon: { fontSize: 64 },
  from: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  voiceTag: {
    backgroundColor: "rgba(0,0,0,0.08)", borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 5,
  },
  voiceTagText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  caption: {
    fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center",
    fontStyle: "italic", lineHeight: 22,
  },
  replayBtn: {
    backgroundColor: "rgba(0,0,0,0.10)", borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  replayText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  dismissBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 32, paddingVertical: 14, width: "100%", alignItems: "center", marginTop: 4,
  },
  dismissText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
});

const vmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingBottom: 40, gap: 6,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 8 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },
  noteRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: 8, ...Shadow.sm,
  },
  noteRowActive: { backgroundColor: Colors.primary + "10", borderWidth: 1.5, borderColor: Colors.primary + "40" },
  playBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center",
  },
  playBtnActive: { backgroundColor: Colors.error },
  playBtnText: { fontSize: 20, color: "#fff" },
  noteTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  noteMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  listenedIcon: { fontSize: 20 },
  newDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  closeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    alignItems: "center", paddingVertical: 14, marginTop: 8,
  },
  closeBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
});
