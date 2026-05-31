import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Animated, Modal, Alert, Dimensions, AppState as RNAppState } from "react-native";
import { MonetizationModal } from "../../components/monetization-modal";
import { AdMobBanner } from "../../components/admob-banner";
import { aggregateWebUsage, aggregateAppUsage, aggregateFeatureTaps, daysAgoDate, fmtDuration } from "../../lib/usage-tracker";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_H_PAD = 16;
const GRID_GAP   = 10;
// Keep tiles phone-sized (~108px) on every screen: 3 columns on a phone, more
// columns on a tablet. Hardcoding 3 columns made tablet tiles balloon to ~380px.
const TARGET_TILE = 108;
const GRID_COLS  = Math.max(3, Math.floor((SCREEN_W - GRID_H_PAD * 2 + GRID_GAP) / (TARGET_TILE + GRID_GAP)));
const CARD_W     = Math.floor((SCREEN_W - GRID_H_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { useColors } from "../../hooks/use-colors";
import { ScreenContainer } from "../../components/screen-container";
import { Mascot } from "../../components/mascot";
import { AnimatedFeatureCard, FeatureDef } from "../../components/animated-feature-card";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { PASTEL_COLORS } from "../../lib/data/types";
import type { KidState } from "../../lib/data/types";
import { getTodayUsage, getRemainingMinutes, formatMinutes, isLocked, getThrivingScore, getThrivingLabel, getStreak } from "../../lib/data/logic";
import { uid, nowIso } from "../../lib/utils";

function BlinkingBadge({ count, onPress }: { count: number; onPress: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <TouchableOpacity onPress={onPress} style={styles.badgeWrap} activeOpacity={0.8}>
      <Animated.View style={[styles.badge, { opacity }]}>
        <Text style={styles.badgeText}>{count}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function PauseAllRow() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const allPaused = state.kids.length > 0 && state.kids.every(k => k.rules.instantLocked);
  function toggle() {
    dispatch({ type: "PAUSE_ALL_DEVICES", locked: !allPaused, message: allPaused ? undefined : "⏸ Paused by parent" });
  }
  if (state.kids.length === 0) return null;
  return (
    <TouchableOpacity style={[styles.pauseRow, allPaused && styles.pauseRowActive]} onPress={toggle}>
      <Text style={styles.pauseEmoji}>{allPaused ? "▶️" : "⏸"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pauseTitle, allPaused && { color: "#fff" }]}>
          {allPaused ? "All Devices Paused" : "Pause All Devices"}
        </Text>
        <Text style={[styles.pauseSub, allPaused && { color: "rgba(255,255,255,0.75)" }]}>
          {allPaused ? "Tap to resume all kids' devices" : "One tap to freeze every kid's screen"}
        </Text>
      </View>
      <View style={[styles.pauseToggle, allPaused && styles.pauseToggleActive]}>
        <Text style={{ color: allPaused ? "#fff" : Colors.textMuted, fontSize: 12, fontWeight: "700" }}>
          {allPaused ? "ON" : "OFF"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SocialAlertsRow() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const unacked = (state.socialAlerts ?? []).filter(a => !a.acknowledged);
  if (unacked.length === 0) return null;
  return (
    <TouchableOpacity
      style={styles.socialAlertBanner}
      onPress={() => router.push("/parent/(more)/social-monitor" as any)}
    >
      <Text style={styles.socialAlertEmoji}>🔍</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.socialAlertTitle}>
          {unacked.length} Social Media Alert{unacked.length !== 1 ? "s" : ""}
        </Text>
        <Text style={styles.socialAlertSub}>
          Dangerous content detected — tap to review
        </Text>
      </View>
      <Text style={styles.socialAlertArrow}>›</Text>
    </TouchableOpacity>
  );
}

function PendingTasksModal({ kid, visible, onClose }: { kid: KidState | null; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  if (!kid) return null;
  const pending = kid.chores.filter(c => c.status === "open" || c.status === "submitted");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>⏳ Pending for {kid.profile.name}</Text>
          <Text style={styles.modalSub}>{pending.length} task{pending.length !== 1 ? "s" : ""} need attention</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {pending.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.taskRow}
                onPress={() => { onClose(); router.push("/parent/(more)/chores" as any); }}
              >
                <View style={[styles.taskDot, { backgroundColor: c.status === "submitted" ? Colors.warning : Colors.error }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{c.title}</Text>
                  <Text style={styles.taskMeta}>
                    {c.status === "submitted" ? "✅ Submitted — awaiting approval" : "🧹 Not started yet"}
                    {c.points ? `  •  ${c.points} pts` : ""}
                  </Text>
                </View>
                <Text style={styles.taskArrow}>›</Text>
              </TouchableOpacity>
            ))}
            {pending.length === 0 && (
              <Text style={styles.taskEmpty}>All caught up! 🎉</Text>
            )}
          </ScrollView>
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => { onClose(); router.push("/parent/(more)/chores" as any); }}>
            <Text style={styles.viewAllText}>View All Chores →</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Color palettes per control category — rich, modern
const C = {
  safety:   { bg: "#F87171", shadow: "#991B1B" }, // bold red    — locks & safety
  monitor:  { bg: "#FB923C", shadow: "#9A3412" }, // deep orange — monitoring
  rules:    { bg: "#FBBF24", shadow: "#92400E" }, // amber       — rules & limits
  content:  { bg: "#34D399", shadow: "#065F46" }, // emerald     — content & learn
  family:   { bg: "#38BDF8", shadow: "#0369A1" }, // sky blue    — family features
  admin:    { bg: "#A78BFA", shadow: "#4C1D95" }, // violet      — account & admin
  ai:       { bg: "#818CF8", shadow: "#3730A3" }, // indigo      — AI tools
};

const PARENT_FEATURES: FeatureDef[] = [
  // Safety & Control (most important — shown first)
  { id: "find-phone",       emoji: "📱", label: "Find a Phone",     ...C.safety,  pulse: true },
  { id: "remote-lock",     emoji: "🔒", label: "Remote Lock",      ...C.safety,  pulse: true },
  { id: "remote-control",  emoji: "📲", label: "Remote Control",   ...C.safety,  pulse: true },
  { id: "device-guardian", emoji: "🛡️", label: "OS Guardian",      ...C.safety              },
  { id: "call-guard",      emoji: "🔇", label: "Call & Text Guard", ...C.safety, pulse: true },
  { id: "bedtime",         emoji: "🌙", label: "Bedtime Mode",      ...C.rules,  pulse: true },
  { id: "rules",           emoji: "⏱️", label: "Screen Rules",      ...C.rules               },
  { id: "remote-apps",     emoji: "📲", label: "App Rules",         ...C.rules               },
  { id: "web-allowlist",   emoji: "🌐", label: "Web Filter",        ...C.rules,  pulse: true },

  // Monitoring
  { id: "reports",       emoji: "📊", label: "Reports",        ...C.monitor             },
  { id: "location",      emoji: "🗺️", label: "Location",       ...C.monitor             },
  { id: "watch",         emoji: "📹", label: "Camera Watch",   ...C.monitor             },
  { id: "ping",          emoji: "📣", label: "Ping Kid",       ...C.monitor             },

  // Family & Content
  { id: "fitness",       emoji: "🏃", label: "Fitness & Meals", ...C.content, pulse: true },
  { id: "chores",        emoji: "🧹", label: "Chores/Earn It",  ...C.content             },
  { id: "school-mgmt",   emoji: "🏫", label: "School",          ...C.content             },
  { id: "learning-apps", emoji: "🎓", label: "Learning Apps",   ...C.content             },
  { id: "wishes",         emoji: "🌟", label: "Kid Wishes",      ...C.content             },
  { id: "reward-shop",    emoji: "🛍️", label: "Reward Shop",     ...C.content, pulse: true },
  { id: "achievements",   emoji: "🏅", label: "Achievements",    ...C.content, pulse: true },
  { id: "notifications",  emoji: "🔔", label: "Notifications",   ...C.safety,  pulse: true },
  { id: "important-info", emoji: "ℹ️", label: "Important Info",  ...C.safety              },
  { id: "medications",    emoji: "💊", label: "Medications",      ...C.safety, pulse: true },
  { id: "co-parenting",   emoji: "🤝", label: "Co-Parenting",    ...C.family              },
  { id: "family-tree",   emoji: "🌳", label: "Family Tree",      ...C.family, pulse: true },
  { id: "communicate",    emoji: "💬", label: "Call & Chat",     ...C.family, pulse: true },
  { id: "funny-sounds",   emoji: "🎭", label: "Fun Sounds & Video",...C.family, pulse: true },
  { id: "memories",       emoji: "📸", label: "Memories",        ...C.family              },
  { id: "stories",        emoji: "🌙", label: "Stories",         ...C.family              },
  { id: "advice",         emoji: "💬", label: "Life Advice",     ...C.family              },
  { id: "apology",        emoji: "💌", label: "Explain Yourself",...C.family              },
  { id: "wellbeing",      emoji: "💙", label: "Well-Being",      ...C.family              },
  { id: "family-vote",    emoji: "🎬", label: "Family Vote",     ...C.family, pulse: true },
  { id: "social",         emoji: "📱", label: "Family Social",   ...C.family, pulse: true },

  // Growth & Learning
  { id: "quiz",           emoji: "📝", label: "Send Quiz",       ...C.safety, pulse: true },

  // New features
  { id: "morning-routine",   emoji: "🌅", label: "Morning Routine",    ...C.rules,   pulse: true },
  { id: "family-calendar",   emoji: "📅", label: "Family Calendar",    ...C.family,  pulse: true },
  { id: "allowance",         emoji: "💰", label: "Allowance",          ...C.content, pulse: true },
  { id: "mood-graph",        emoji: "😊", label: "Mood Tracker",       ...C.monitor             },
  { id: "leaderboard",       emoji: "🏅", label: "Leaderboard",        ...C.monitor             },
  { id: "teen-mode",         emoji: "🧑", label: "Teen Mode",          ...C.rules               },
  { id: "behavior-insights", emoji: "📊", label: "Behavior Insights",  ...C.monitor             },
  { id: "kid-requests",      emoji: "📩", label: "Kid Requests",       ...C.content, pulse: true },
  { id: "family-movies",     emoji: "🎬", label: "Movies & Shows",     ...C.content             },
  { id: "family-music",      emoji: "🎵", label: "Family Music",       ...C.content             },
  { id: "family-books",      emoji: "📚", label: "Books & PDFs",       ...C.content             },
  { id: "digest",            emoji: "📧", label: "Weekly Digest",      ...C.admin               },
  { id: "quick-setup",       emoji: "🚀", label: "Quick Setup",        ...C.admin               },
  { id: "widgets",           emoji: "📱", label: "Home Widgets",       ...C.admin               },

  // AI & Voice
  { id: "agent",          emoji: "✨", label: "AI Agent",        ...C.ai,   pulse: true },
  { id: "voice-commands", emoji: "🎙️", label: "Voice Commands",  ...C.ai               },
  { id: "ai-results",     emoji: "📁", label: "AI Results",       ...C.ai               },

  // New Safety & Monitoring features
  { id: "social-monitor",       emoji: "🔍", label: "Social Monitor",      ...C.monitor, pulse: true },
  { id: "weekly-report",        emoji: "📧", label: "Weekly Report",       ...C.monitor             },
  { id: "stranger-alert",       emoji: "🚨", label: "Stranger Alert",      ...C.safety,  pulse: true },
  { id: "context-screen-time",  emoji: "🧠", label: "Smart Screen Time",   ...C.rules,  pulse: true  },
  { id: "digital-agreement",    emoji: "🤝", label: "Family Agreement",    ...C.family, pulse: true  },
  { id: "mood-insight",         emoji: "💡", label: "Mood Insights",       ...C.monitor, pulse: true },

  // Admin
  { id: "permissions",   emoji: "🔐", label: "Permissions",    ...C.admin               },
  { id: "cloud-backup",  emoji: "☁️", label: "Cloud Backup",   ...C.admin               },
  { id: "account",       emoji: "👤", label: "Account",        ...C.admin               },
  { id: "settings",      emoji: "⚙️", label: "Settings",       ...C.admin               },
  { id: "help",          emoji: "❓", label: "Help & Privacy",  ...C.admin               },
];

const SECTIONS = [
  { label: "🔒 Safety & Rules",   ids: ["find-phone","remote-lock","remote-control","device-guardian","call-guard","bedtime","rules","remote-apps","web-allowlist","morning-routine","teen-mode","stranger-alert","context-screen-time"] },
  { label: "📊 Monitoring",       ids: ["reports","location","watch","ping","notifications","mood-graph","behavior-insights","leaderboard","social-monitor","weekly-report","mood-insight"] },
  { label: "📚 School & Content", ids: ["fitness","chores","school-mgmt","learning-apps","wishes","reward-shop","achievements","important-info","medications","quiz","allowance","kid-requests","family-movies","family-music","family-books"] },
  { label: "💬 Family & Growth",  ids: ["communicate","funny-sounds","memories","stories","advice","apology","wellbeing","family-vote","social","family-calendar","co-parenting","family-tree","digital-agreement"] },
  { label: "✨ AI & Voice",       ids: ["agent","voice-commands","ai-results"] },
  { label: "⚙️ Settings & Admin", ids: ["permissions","cloud-backup","account","settings","help","digest","quick-setup","widgets"] },
];

const featureMap = Object.fromEntries(PARENT_FEATURES.map(f => [f.id, f]));

// ─── Per-kid Most Used card ───────────────────────────────────────────────────
function KidMostUsed({ kid, onOpenReports }: { kid: KidState; onOpenReports: () => void }) {
  const since = daysAgoDate(7);

  const topFeatures = useMemo(
    () => aggregateFeatureTaps(kid.usage ?? [], since).slice(0, 3),
    [kid.usage],
  );
  const topSites = useMemo(
    () => aggregateWebUsage(kid.usage ?? [], since).slice(0, 3),
    [kid.usage],
  );
  const topApps = useMemo(
    () => aggregateAppUsage(kid.usage ?? [], since).slice(0, 3),
    [kid.usage],
  );

  const hasData = topFeatures.length > 0 || topSites.length > 0 || topApps.length > 0;

  return (
    <View style={styles.muCard}>
      <View style={styles.muHeader}>
        <Text style={styles.muKidName}>👤 {kid.profile.name}</Text>
        <TouchableOpacity onPress={onOpenReports}>
          <Text style={styles.muReportsLink}>Full Report →</Text>
        </TouchableOpacity>
      </View>

      {!hasData ? (
        <Text style={styles.muEmpty}>No usage recorded yet this week</Text>
      ) : (
        <>
          {topFeatures.length > 0 && (
            <View style={styles.muGroup}>
              <Text style={styles.muGroupLabel}>Features</Text>
              <View style={styles.muRow}>
                {topFeatures.map(f => (
                  <View key={f.featureId} style={styles.muChip}>
                    <Text>{f.featureEmoji}</Text>
                    <Text style={styles.muChipText} numberOfLines={1}>{f.featureName}</Text>
                    <Text style={styles.muChipCount}>{f.count}×</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {topSites.length > 0 && (
            <View style={styles.muGroup}>
              <Text style={styles.muGroupLabel}>Websites</Text>
              <View style={styles.muRow}>
                {topSites.map(s => (
                  <View key={s.domain} style={[styles.muChip, { backgroundColor: "#E0F2FE" }]}>
                    <Text>🌐</Text>
                    <Text style={styles.muChipText} numberOfLines={1}>{s.title || s.domain}</Text>
                    <Text style={styles.muChipCount}>{fmtDuration(s.totalSeconds)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {topApps.length > 0 && (
            <View style={styles.muGroup}>
              <Text style={styles.muGroupLabel}>Apps</Text>
              <View style={styles.muRow}>
                {topApps.map(a => (
                  <View key={a.appId} style={[styles.muChip, { backgroundColor: "#FFF3E0" }]}>
                    <Text>{a.appEmoji ?? "📱"}</Text>
                    <Text style={styles.muChipText} numberOfLines={1}>{a.appName}</Text>
                    <Text style={styles.muChipCount}>{formatMinutes(a.minutes)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function ParentDashboard() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const C = useColors();
  const [badgeKid, setBadgeKid] = useState<KidState | null>(null);

  // ── Ad refresh on foreground ─────────────────────────────────────────────────
  const [adKey, setAdKey] = useState(0);
  const appStateRef = useRef(RNAppState.currentState);
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", nextState => {
      if (appStateRef.current !== "active" && nextState === "active") {
        setAdKey(k => k + 1);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // ── Monetisation ────────────────────────────────────────────────────────────
  const hasSeenAd  = state.parentSettings.hasSeenAdDisclosure ?? false;
  const isAdFree   = state.parentSettings.adFree ?? false;
  // Show the full-screen disclosure on first ever launch; suppress after that
  const [showMonetModal, setShowMonetModal] = useState(!hasSeenAd);
  const [search, setSearch] = useState("");

  const totalUsageToday = state.kids.reduce((sum, k) => sum + getTodayUsage(k), 0);
  const unackedSos = (state.sosAlerts ?? []).filter(a => !a.acknowledged);
  const pendingRedemptions = state.kids.flatMap(k => (k.rewardRedemptions ?? []).filter(r => r.status === "pending"));
  const pendingFlipbooks = state.kids.flatMap(k =>
    (k.stopMotionProjects ?? [])
      .filter(p => p.submittedAt && p.parentApproved === null)
      .map(p => ({ ...p, kidName: k.profile.name, kidId: k.profile.id }))
  );

  let cardIndex = 0;
  const installAlertCount = state.kids.reduce((n, k) => n + (k.installAlerts?.length ?? 0), 0);

  // Feature search: when there's a query, show one flat grid of matches instead
  // of the grouped sections (e.g. "ga" → Game Night, ...). Matches label OR id.
  const q = search.trim().toLowerCase();
  const searchResults = q
    ? PARENT_FEATURES.filter(f => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
    : [];

  const renderFeatureTile = (feature: FeatureDef) => {
    const idx = cardIndex++;
    const route = feature.id === "agent"
      ? "/parent/agent"
      : feature.id === "web-allowlist"
      ? "/parent/(more)/dns-filter"
      : `/parent/(more)/${feature.id}`;
    const badge = feature.id === "remote-apps" ? installAlertCount : undefined;
    return (
      <AnimatedFeatureCard
        key={feature.id}
        feature={feature}
        index={idx}
        width={CARD_W}
        badge={badge}
        onPress={() => router.push(route as any)}
      />
    );
  };

  return (
    <ScreenContainer scroll>

      {/* ── First-launch full-screen monetisation disclosure ─────────────────── */}
      <MonetizationModal
        visible={showMonetModal}
        onDismiss={() => setShowMonetModal(false)}
      />

      {/* ── Parent-side ad banner (refreshes on every foreground return, hidden if ad-free) ── */}
      {hasSeenAd && !isAdFree && <AdMobBanner key={adKey} />}

      <Text style={[styles.title, { color: C.isDark ? C.primary : Colors.primary }]}>Parent Dashboard</Text>

      {/* SOS Alerts Banner */}
      {unackedSos.map(alert => {
        const kid = state.kids.find(k => k.profile.id === alert.kidId);
        return (
          <View key={alert.id} style={styles.sosBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sosTitle}>🚨 SOS from {kid?.profile.name ?? alert.kidName}</Text>
              <Text style={styles.sosMeta}>
                {new Date(alert.timestamp).toLocaleTimeString()}
                {alert.lat ? ` · (${alert.lat.toFixed(4)}, ${alert.lng?.toFixed(4)})` : ""}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sosAckBtn}
              accessibilityLabel={`Acknowledge SOS alert from ${kid?.profile.name ?? "kid"}`}
              accessibilityRole="button"
              onPress={() => {
                dispatch({ type: "SOS_ACK", alertId: alert.id });
                if (alert.kidId) {
                  dispatch({
                    type: "NOTIFICATION_ADD",
                    kidId: alert.kidId,
                    notification: {
                      id: uid(), kidId: alert.kidId, kind: "ping",
                      title: "You're safe! 💚",
                      body: "Your parent got your SOS and is on the way. Stay calm — help is coming! 🤗",
                      read: false, createdAt: nowIso(),
                    },
                  });
                }
              }}
            >
              <Text style={styles.sosAckText}>Ack</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* ── Pause All Devices Row ────────────────────────────────────────────── */}
      <PauseAllRow />

      {/* ── Unread Social Monitoring Alerts ──────────────────────────────────── */}
      <SocialAlertsRow />

      {/* Pending Reward Redemptions Banner */}
      {pendingRedemptions.length > 0 && (
        <TouchableOpacity style={styles.rewardBanner} onPress={() => router.push("/parent/(more)/reward-shop" as any)}>
          <Text style={styles.rewardBannerText}>
            🛍️ {pendingRedemptions.length} reward request{pendingRedemptions.length !== 1 ? "s" : ""} waiting for approval
          </Text>
          <Text style={styles.rewardBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Pending Flipbook Submissions Banner */}
      {pendingFlipbooks.length > 0 && (
        <View style={styles.flipbookBanner}>
          <Text style={styles.flipbookBannerEmoji}>🎬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.flipbookBannerTitle}>
              {pendingFlipbooks.length} flipbook{pendingFlipbooks.length !== 1 ? "s" : ""} waiting for your review!
            </Text>
            <Text style={styles.flipbookBannerSub}>
              {pendingFlipbooks.map(f => f.kidName).join(", ")} submitted their work
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            {pendingFlipbooks.map(f => (
              <TouchableOpacity
                key={f.id}
                style={styles.flipbookApproveBtn}
                onPress={() => Alert.alert(
                  `🎬 "${f.title}"`,
                  `${f.kidName} submitted this flipbook (${f.frames.length} frames). Award points?`,
                  [
                    { text: "Reject", style: "destructive", onPress: () => dispatch({ type: "UPDATE_STOP_MOTION", kidId: f.kidId, projectId: f.id, payload: { parentApproved: false } }) },
                    { text: "+5 pts", onPress: () => dispatch({ type: "FLIPBOOK_APPROVE", kidId: f.kidId, projectId: f.id, points: 5 }) },
                    { text: "+10 pts", onPress: () => dispatch({ type: "FLIPBOOK_APPROVE", kidId: f.kidId, projectId: f.id, points: 10 }) },
                    { text: "+15 pts", onPress: () => dispatch({ type: "FLIPBOOK_APPROVE", kidId: f.kidId, projectId: f.id, points: 15 }) },
                  ]
                )}
              >
                <Text style={styles.flipbookApproveBtnText}>⭐ {f.kidName}: {f.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Family Time Button + Summary ── */}
      <View style={styles.heroRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Family screen time today</Text>
          <Text style={styles.summaryValue}>{formatMinutes(totalUsageToday)}</Text>
        </View>
        <TouchableOpacity
          style={styles.familyTimeBtn}
          accessibilityLabel={state.kids.every(k => isLocked(k)) && state.kids.length > 0 ? "Resume all kids' devices" : "Start family time — pause all devices"}
          accessibilityRole="button"
          onPress={() => {
            const allLocked = state.kids.every(k => isLocked(k));
            if (allLocked) {
              state.kids.forEach(k => dispatch({ type: "SET_INSTANT_LOCK", kidId: k.profile.id, locked: false }));
            } else {
              Alert.alert(
                "⏸️ Family Time",
                "This will pause all kids' devices and send them a friendly message. Great for meals, outings, or bedtime!",
                [
                  { text: "Cancel" },
                  {
                    text: "Pause All 🍕",
                    onPress: () => {
                      state.kids.forEach(k => {
                        dispatch({ type: "SET_INSTANT_LOCK", kidId: k.profile.id, locked: true });
                        dispatch({
                          type: "NOTIFICATION_ADD", kidId: k.profile.id,
                          notification: { id: uid(), kidId: k.profile.id, kind: "ping", title: "⏸️ Family Time!", body: "Put the screen down — it's family time! 🍕 See you soon!", read: false, createdAt: nowIso() },
                        });
                      });
                    },
                  },
                ]
              );
            }
          }}
        >
          <Text style={styles.familyTimeBtnEmoji}>
            {state.kids.every(k => isLocked(k)) && state.kids.length > 0 ? "▶️" : "⏸️"}
          </Text>
          <Text style={styles.familyTimeBtnLabel}>
            {state.kids.every(k => isLocked(k)) && state.kids.length > 0 ? "Resume All" : "Family Time"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Kid Cards (redesigned with Thriving Score) ── */}
      <View style={styles.kidCardsHeader}>
        <Text style={[styles.sectionHeader, { color: C.text }]}>Your Kids</Text>
        <TouchableOpacity onPress={() => router.push("/parent/(more)/weekly-snapshot" as any)}>
          <Text style={styles.snapshotLink}>📊 Weekly Snapshot →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg, flexGrow: 0 }} contentContainerStyle={{ alignItems: "flex-start", paddingVertical: 4 }}>
        {state.kids.map(kid => {
          const used = getTodayUsage(kid);
          const remaining = getRemainingMinutes(kid);
          const locked = isLocked(kid);
          const pendingCount = kid.chores.filter(c => c.status === "open" || c.status === "submitted").length;
          const score = getThrivingScore(kid);
          const thriving = getThrivingLabel(score);
          const streak = getStreak(kid);
          const usagePct = Math.min(1, used / Math.max(1, kid.rules.dailyLimitMinutes));
          const pastel = PASTEL_COLORS[kid.profile.color];
          return (
            <TouchableOpacity
              key={kid.profile.id}
              style={[styles.kidCard, { backgroundColor: pastel }]}
              onPress={() => router.push(`/parent/(more)/kid/${kid.profile.id}` as any)}
              activeOpacity={0.85}
              accessibilityLabel={`View ${kid.profile.name}'s details`}
              accessibilityRole="button"
            >
              {/* Thriving badge */}
              <View style={[styles.thrivingBadge, { backgroundColor: thriving.color + "20", borderColor: thriving.color + "50" }]}>
                <Text style={[styles.thrivingBadgeText, { color: thriving.color }]}>{thriving.emoji} {thriving.label}</Text>
              </View>

              <Mascot type={kid.profile.mascot} size={52} animate={false} />
              <Text style={styles.kidName}>{kid.profile.name}</Text>

              {/* Thriving score ring */}
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreNum, { color: thriving.color }]}>{score}</Text>
                <Text style={styles.scoreLabel}>/100</Text>
              </View>

              {/* Usage bar */}
              <View style={styles.usageBarBg}>
                <View style={[styles.usageBarFill, { width: `${Math.round(usagePct * 100)}%` as any, backgroundColor: usagePct > 0.85 ? Colors.error : Colors.primary }]} />
              </View>
              <Text style={styles.kidUsage}>{formatMinutes(used)} used · {formatMinutes(remaining)} left</Text>

              {/* Streak */}
              {streak > 0 && <Text style={styles.streakText}>🔥 {streak}-day streak</Text>}

              {/* Quick actions row: lock + +15 min */}
              <View style={{ flexDirection: "row", gap: 6, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.quickLockBtn, { flex: 1, backgroundColor: locked ? "#FF000020" : "#00000010" }]}
                  onPress={() => dispatch({ type: "SET_INSTANT_LOCK", kidId: kid.profile.id, locked: !locked })}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: locked ? Colors.error : Colors.textSecondary }}>
                    {locked ? "🔒 Locked" : "🔓 Active"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickLockBtn, { flex: 1, backgroundColor: "#10B98120" }]}
                  onPress={() => {
                    dispatch({ type: "UPDATE_RULES", kidId: kid.profile.id, payload: { dailyLimitMinutes: kid.rules.dailyLimitMinutes + 15 } });
                    dispatch({ type: "NOTIFICATION_ADD", kidId: kid.profile.id, notification: { id: uid(), kidId: kid.profile.id, kind: "ping", title: "⏱️ +15 min granted!", body: "Your parent gave you 15 extra minutes today!", read: false, createdAt: nowIso() } });
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>⏱️ +15 min</Text>
                </TouchableOpacity>
              </View>

              {kid.notifications.filter(n => !n.read).length > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{kid.notifications.filter(n => !n.read).length}</Text>
                </View>
              )}
              {pendingCount > 0 && (
                <BlinkingBadge count={pendingCount} onPress={() => setBadgeKid(kid)} />
              )}
            </TouchableOpacity>
          );
        })}
        {state.kids.length === 0 && (
          <View style={styles.noKids}>
            <Text style={styles.noKidsText}>No kids added yet.</Text>
            <TouchableOpacity onPress={() => router.push("/setup/add-kid" as any)}>
              <Text style={{ color: Colors.primary, fontWeight: "700" }}>+ Add Kid</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <PendingTasksModal kid={badgeKid} visible={!!badgeKid} onClose={() => setBadgeKid(null)} />

      {/* ── Most Used — per child ── */}
      {state.kids.length > 0 && (
        <View style={styles.mostUsedSection}>
          <Text style={[styles.sectionHeader, { color: C.text, marginBottom: Spacing.sm }]}>⚡ Most Used This Week</Text>
          {state.kids.map(kid => (
            <KidMostUsed key={kid.profile.id} kid={kid} onOpenReports={() => router.push("/parent/(more)/reports" as any)} />
          ))}
        </View>
      )}

      {/* Feature search */}
      <View style={[styles.searchWrap, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: C.text }]}
          placeholder="Search tools…  (try 'ga' for Game Night)"
          placeholderTextColor={C.textSub}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.searchClear, { color: C.textSub }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {q ? (
        /* Search results — one flat grid */
        <View style={styles.featureSection}>
          <Text style={[styles.featureSectionLabel, { color: C.textSub }]}>
            🔍 {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for “{search.trim()}”
          </Text>
          {searchResults.length === 0 ? (
            <Text style={[styles.searchEmpty, { color: C.textSub }]}>No tools match — try fewer letters.</Text>
          ) : (
            <View style={styles.grid}>{searchResults.map(renderFeatureTile)}</View>
          )}
        </View>
      ) : (
        /* Feature Sections */
        SECTIONS.map(section => {
          const sectionFeatures = section.ids.map(id => featureMap[id]).filter(Boolean);
          return (
            <View key={section.label} style={styles.featureSection}>
              <Text style={[styles.featureSectionLabel, { color: C.textSub }]}>{section.label}</Text>
              <View style={styles.grid}>
                {sectionFeatures.map(renderFeatureTile)}
              </View>
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  // Pause All
  pauseRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.border },
  pauseRowActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  pauseEmoji: { fontSize: 28 },
  pauseTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  pauseSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  pauseToggle: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.md, backgroundColor: Colors.border },
  pauseToggleActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  // Social alerts
  socialAlertBanner: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FEF9C3", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, borderWidth: 1.5, borderColor: "#FDE047" },
  socialAlertEmoji: { fontSize: 26 },
  socialAlertTitle: { fontSize: FontSize.base, fontWeight: "800", color: "#713F12" },
  socialAlertSub: { fontSize: FontSize.xs, color: "#92400E", marginTop: 2 },
  socialAlertArrow: { fontSize: 22, color: "#92400E" },
  sosBanner: { backgroundColor: Colors.error, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  sosTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  sosMeta: { color: "#FCA5A5", fontSize: FontSize.sm, marginTop: 2 },
  sosAckBtn: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  sosAckText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  rewardBanner: { backgroundColor: Colors.secondary + "30", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  rewardBannerText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.sm, flex: 1 },
  rewardBannerArrow: { fontSize: 22, color: Colors.textSecondary },
  flipbookBanner: { backgroundColor: Colors.primary + "12", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.primary + "30", gap: 8 },
  flipbookBannerEmoji: { fontSize: 28 },
  flipbookBannerTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  flipbookBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  flipbookApproveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  flipbookApproveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },
  // Hero row
  heroRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.md, alignItems: "stretch" },
  summaryCard: {
    flex: 1, backgroundColor: Colors.primary + "15", borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: "center", justifyContent: "center",
  },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  familyTimeBtn: {
    backgroundColor: Colors.secondary, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: "center", justifyContent: "center", ...Shadow.sm, minWidth: 90,
  },
  familyTimeBtnEmoji: { fontSize: 26 },
  familyTimeBtnLabel: { fontSize: 11, fontWeight: "800", color: "#fff", marginTop: 2 },

  // Kid cards header
  kidCardsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  sectionHeader: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  snapshotLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },

  // Kid card redesign
  kidCard: { width: 168, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginRight: 12, ...Shadow.md, gap: 4 },
  thrivingBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginBottom: 4 },
  thrivingBadgeText: { fontSize: 10, fontWeight: "700" },
  kidName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginTop: 2 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  scoreNum: { fontSize: FontSize.xl, fontWeight: "900" },
  scoreLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  usageBarBg: { height: 6, width: "100%", backgroundColor: "#00000015", borderRadius: 3, overflow: "hidden", marginTop: 4 },
  usageBarFill: { height: 6, borderRadius: 3 },
  kidUsage: { fontSize: 10, color: Colors.textSecondary, textAlign: "center" },
  streakText: { fontSize: 11, fontWeight: "700", color: Colors.warning },
  kidRemaining: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.success },
  quickLockBtn: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  cardArrow: { fontSize: 10, color: Colors.textMuted, marginTop: 4, fontWeight: "600" },
  notifDot: {
    position: "absolute", top: 8, right: 8, backgroundColor: Colors.error,
    borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  notifDotText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },
  badgeWrap: { position: "absolute", bottom: 8, right: 8 },
  badge: {
    backgroundColor: Colors.error, borderRadius: 14, minWidth: 24, height: 24,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
    borderWidth: 2, borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: Colors.bgLight, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 36, gap: 12,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: -4 },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: 6, ...Shadow.sm,
  },
  taskDot: { width: 10, height: 10, borderRadius: 5 },
  taskTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  taskMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  taskArrow: { fontSize: 20, color: Colors.textMuted },
  taskEmpty: { textAlign: "center", color: Colors.textSecondary, paddingVertical: Spacing.md },
  viewAllBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  viewAllText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  noKids: { alignItems: "center", justifyContent: "center", width: 140, height: 140, gap: 8 },
  noKidsText: { color: Colors.textSecondary },
  featureSection: { marginBottom: Spacing.md },
  featureSectionLabel: {
    fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary,
    marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginBottom: 4 },

  // Feature search
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: Radius.lg, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: FontSize.base, paddingVertical: 10 },
  searchClear: { fontSize: 16, fontWeight: "800", paddingHorizontal: 4 },
  searchEmpty: { fontSize: FontSize.sm, fontStyle: "italic", paddingVertical: 8 },

  // Most Used section
  mostUsedSection: { marginBottom: Spacing.lg },
  muCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  muHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  muKidName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  muReportsLink: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primary },
  muEmpty: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: "center", paddingVertical: 8 },
  muGroup: { marginBottom: 8 },
  muGroupLabel: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  muRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  muChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: Colors.primary + "15",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
    maxWidth: "47%",
  },
  muChipText: { flex: 1, fontSize: 11, fontWeight: "700", color: Colors.textPrimary },
  muChipCount: { fontSize: 10, fontWeight: "800", color: Colors.primary },
});
